import express, {
    Application,
    NextFunction,
    Router,
    Request,
    Response,
    Handler,
} from 'express';
import { createServer, Server } from 'http';
import { Log4js, Logger } from 'log4js';
import { initMainRouter } from './lib/routers/main';
import { initAgentRouter } from './lib/routers/agent';
import { initContainerRouter } from './lib/routers/container';
import {
    checkIP,
    createLoggers,
    printSuccess,
    sleep,
    validateAuth,
} from './lib/utils';
import ProxmoxConnection from './lib/proxmox/ProxmoxConnection';
import { WebSocket, WebSocketServer } from 'ws';
import { connectToDatabase } from './lib/mysql';
import { handleMessage } from './lib/ws/wsMessageHandler';
import { wsCommand } from './lib/ws/routing/wsCommand';
import { sendTaskToAgent } from './lib/ws/commandAgent';
import { Task } from './lib/typing/Task';
import { Connection } from 'mysql2/promise';
import { Config, status, Configuration, CT } from './lib/typing/types';
import { MessageData } from './lib/typing/MessageData';
import { initConfigRouter } from './lib/routers/config';
import { CTOptions } from './lib/typing/options';

export default class ContainerWorkspaces {
    private httpServer: Server;
    private apiKey: string;
    private listenAddress: string;
    private listenPort: number;
    protected remoteAddress: string;
    protected remotePort: number;
    protected protocol: Configuration['protocol'];

    private log4js: Log4js;
    public mainLogger: Logger;
    public httpLogger: Logger;
    public wsLogger: Logger;
    public pveLogger: Logger;
    public logLines: Map<Task['id'], string> = new Map();

    protected initMainRouter = initMainRouter;
    protected initAgentRouter = initAgentRouter;
    protected initConfigRouter = initConfigRouter;
    protected initContainerRouter = initContainerRouter;
    private connectToDatabase = connectToDatabase;
    protected handleMessage = handleMessage;
    protected wsCommand = wsCommand;
    protected checkIP = checkIP;
    protected sendTaskToAgent = sendTaskToAgent;

    protected webApp: Application;
    protected wss: WebSocketServer;
    protected mainRouter: Router;
    protected agentRouter: Router;
    protected containerRouter: Router;
    protected configRouter: Router;
    protected webSockerRouter;
    protected proxmoxClient: ProxmoxConnection;
    public mysqlConnection: Connection;

    constructor({
        apiKey,
        listenAddress,
        listenPort,
        remoteAddress,
        remotePort,
        protocol,
        database: DatabaseConf,
        pve: PVEConf,
    }: Configuration) {
        this.apiKey = apiKey;
        this.listenAddress = listenAddress;
        this.listenPort = listenPort;
        this.remoteAddress = remoteAddress;
        this.remotePort = remotePort;
        this.protocol = protocol;
        this.configureLoggers();

        this.webApp = express();
        this.initRouters();
        this.initWebApp();

        this.mysqlConnection = this.connectToDatabase({
            host: DatabaseConf.host,
            user: DatabaseConf.user,
            password: DatabaseConf.password,
            database: DatabaseConf.database,
        });

        this.proxmoxClient = new ProxmoxConnection({
            hostname: PVEConf.hostname,
            protocol: PVEConf.protocol,
            username: PVEConf.username,
            password: PVEConf.password,
            pveLogger: this.pveLogger,
            mysqlConnection: this.mysqlConnection,
        });
    }

    private initWebApp(): void {
        this.httpServer = createServer();

        this.webApp.use(express.json());
        this.webApp.use(express.urlencoded({ extended: true }));
        this.webApp.use(this.httpLoggerMiddleware(this.httpLogger));
        this.webApp.use(validateAuth(this.apiKey));

        // Routers
        this.webApp.use('/api/agent', this.agentRouter);
        this.webApp.use('/api/container', this.containerRouter);
        this.webApp.use('/api/config', this.configRouter);
        this.webApp.use('/api', this.mainRouter);

        this.httpServer.on('request', this.webApp);

        this.initWebSocketServer();
    }

    private httpLoggerMiddleware(httpLogger: Logger): Handler {
        return function (req: Request, res: Response, next: NextFunction) {
            res.on('finish', () => {
                httpLogger.info(
                    `${req.baseUrl}${req.path} - ${req.method} - ${res.statusCode} - ${req.ip}`
                );
            });
            next();
        };
    }

    private initWebSocketServer(): void {
        this.wss = new WebSocketServer({ noServer: true });
        this.wss.on('connection', (socket, req) => {
            const ip: string = req.socket.remoteAddress;
            socket.on('message', (message) => {
                this.handleMessage(message, req, socket);
            });
        });

        this.httpServer.on('upgrade', (request, socket, head) => {
            const connected = this.getConnectedClient(
                request.socket.remoteAddress
            );
            this.wss.handleUpgrade(request, socket, head, async (socket) => {
                if (connected) socket.close();
                let isAuthorized: boolean = await this.checkIP(
                    request.socket.remoteAddress
                );

                if (isAuthorized) this.wss.emit('connection', socket, request);
                else socket.close();
            });
        });

        this.httpServer.listen(this.listenPort, this.listenAddress, () => {
            printSuccess(
                `App is running on ${this.listenAddress}:${this.listenPort} - ${this.protocol}://${this.remoteAddress}:${this.remotePort}`
            );
        });
    }

    private configureLoggers(logDir: string = '/var/log/cw'): void {
        const logsName = ['main', 'http', 'ws', 'pve'];
        this.log4js = createLoggers(logsName, logDir);

        this.mainLogger = this.log4js.getLogger('main');
        this.httpLogger = this.log4js.getLogger('http');
        this.wsLogger = this.log4js.getLogger('ws');
        this.pveLogger = this.log4js.getLogger('pve');
    }

    private initRouters(): void {
        this.initConfigRouter();
        this.initContainerRouter();
        this.initMainRouter();
        this.initAgentRouter();
    }

    public async addTask(task: Task): Promise<Task> {
        const sql: string = `INSERT INTO tasks (id, start_time, data, containerID) VALUES (?, ?, ?, ?)`;
        await this.mysqlConnection.query(sql, [
            task.id,
            task.start_time,
            JSON.stringify(task.data),
            task.containerID,
        ]);

        return task;
    }
    public async getTask(id: Task['id']): Promise<Task | null> {
        const sql: string = `SELECT * FROM tasks WHERE id = ?`;
        const result = (await this.mysqlConnection.query(sql, [id]))[0][0];
        if (!result) return null;
        const task = new Task(result);
        return task;
    }

    public async updateTask(task: Task): Promise<Task> {
        const sql: string = `UPDATE tasks SET start_time = ?, end_time = ?, data = ?, status = ?, error = ?, containerID = ? WHERE id = ?`;
        await this.mysqlConnection.query(sql, [
            task.start_time,
            task.end_time,
            JSON.stringify(task.data),
            task.status,
            task.error,
            task.containerID,
            task.id,
        ]);

        return task;
    }

    public async errorTask(taskid: Task['id'], error: Error): Promise<void> {
        const erroredTask = new Task(await this.getTask(taskid));
        erroredTask.status = 'error';
        erroredTask.error = error.message;

        await this.updateTask(erroredTask);
    }

    public async finishTask(taskid: Task['id']): Promise<void> {
        const finishedTask = new Task(await this.getTask(taskid));
        finishedTask.status = 'OK';
        finishedTask.end_time = Date.now();

        await this.updateTask(finishedTask);
    }

    public async triggerStatusChange(
        req: Request,
        res: Response,
        status: status
    ): Promise<void> {
        const containerID: number = Number(req.params.containerID);
        const statusRes = await this.proxmoxClient.changeContainerStatus(
            containerID,
            status
        );
        if (!statusRes)
            res.status(409).send({
                status: 'error',
                message: `could not ${status} container`,
            });
        else res.send({ status: 'ok' });
    }

    protected async getLogs(containerID: number, ip: string): Promise<string> {
        const data: MessageData = {
            action: 'send_logs',
            args: {
                linesCount: 100,
            },
        };
        const task: Task = new Task({ data, containerID });
        await this.sendTaskToAgent(task, ip);

        // God please forgive us for this sin we're about to commit
        for (let i = 0; i < 10; i++) {
            await sleep(20);
            const lines = this.logLines.get(task.id);
            if (lines) return lines;
        }

        return null;
    }

    protected getConnectedClient(ip: string): WebSocket | null {
        const clientList: WebSocket[] = Array.from(this.wss.clients);
        const selectedClient: WebSocket = clientList.find(
            (client: any) => client._socket.remoteAddress === ip
        );

        return selectedClient;
    }

    protected async changeContainerPassword(
        containerID: number,
        newPassword: string
    ): Promise<boolean> {
        const agentIP = await this.proxmoxClient.getContainerIP(containerID);
        if (!agentIP) return false;

        const connection = this.getConnectedClient(agentIP);
        if (!connection) return false;

        const data: MessageData = {
            action: 'change_password',
            args: {
                password: newPassword,
            },
        };

        const task: Task = new Task({ data, containerID });
        await this.sendTaskToAgent(task, agentIP);
        return true;
    }

    protected getContainerIP(): Handler {
        return async (req, res, next) => {
            if (isNaN(Number(req.params.containerID)))
                return res.status(400).send({
                    status: 'bad request',
                    message: 'containerID must be a number',
                });
            const containerID: number = Number(req.params.containerID);
            const agentIP: string = await this.proxmoxClient.getContainerIP(
                containerID
            );

            const ipValid: boolean = await this.checkIP(agentIP);

            if (!agentIP) {
                res.status(404).send({
                    status: 'not found',
                    message: 'Could not find container with such ID',
                });
            } else if (!ipValid) {
                res.status(406).send({
                    status: 'not acceptable',
                    message:
                        'Specified ID belongs to a container which is not managed by our services',
                });
            } else {
                req.agentIP = agentIP;
                next();
            }
        };
    }

    private async getConfig(): Promise<Config> {
        const sql: string = `SELECT * FROM config`;
        const result = (await this.mysqlConnection.query(sql))[0][0];
        if (!result) return null;
        const config: Config = JSON.parse(result.config);
        return config;
    }

    private async updateConfig(config: Config): Promise<void> {
        const sql: string = `UPDATE config SET config = ?`;
        await this.mysqlConnection.query(sql, [JSON.stringify(config)]);
    }

    protected async getCTOptions(): Promise<CTOptions> {
        const config = await this.getConfig();
        return config['ct_options'];
    }

    protected async udpateCTOptions(options: CTOptions): Promise<void> {
        let config = await this.getConfig();
        config['ct_options'] = options;

        await this.updateConfig(config);
    }

    protected async getInitCommands(): Promise<string[]> {
        const config = await this.getConfig();
        return config['init_commands'];
    }

    protected async updateInitCommands(commands: string[]): Promise<void> {
        let config = await this.getConfig();
        config['init_commands'] = commands;

        await this.updateConfig(config);
    }

    protected async getContainerID(ip: string): Promise<number | null> {
        const sql: string = `SELECT id FROM cts WHERE ipv4 = ?`;
        const result: CT = (await this.mysqlConnection.query(sql, [ip]))[0][0];
        if (!result) return null;
        return result.id;
    }
}
