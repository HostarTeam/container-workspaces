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
import {
    checkIP,
    createLoggers,
    printSuccess,
    sleep,
    validateAuth,
} from './lib/utils';
import ProxmoxConnection from './lib/proxmox/ProxmoxConnection';
import { WebSocketServer } from 'ws';
import { connectToDatabase } from './lib/mysql';
import { handleMessage } from './lib/ws/wsMessageHandler';
import { wsCommand } from './lib/ws/routing/wsCommand';
import { sendTaskToAgent } from './lib/ws/commandAgent';
import { Task } from './lib/typing/Task';
import { Connection } from 'mysql2/promise';
import { status } from './lib/typing/types';
import { MessageData } from './lib/typing/MessageData';

export default class ContainerWorkspaces {
    private httpServer: Server;
    private apiKey: string;
    private address: string;
    private port: number;

    private log4js: Log4js;
    public mainLogger: Logger;
    public httpLogger: Logger;
    public wsLogger: Logger;
    public pveLogger: Logger;
    public loglines: Map<Task['id'], string> = new Map();

    protected initMainRouter = initMainRouter;
    protected initAgentRouter = initAgentRouter;
    private connectToDatabase = connectToDatabase;
    protected handleMessage = handleMessage;
    protected wsCommand = wsCommand;
    protected checkIP = checkIP;
    protected sendTaskToAgent = sendTaskToAgent;

    protected webApp: Application;
    protected wss: WebSocketServer;
    protected mainRouter: Router;
    protected agentRouter: Router;
    protected webSockerRouter;
    protected proxmoxClient: ProxmoxConnection;
    public mysqlConnection: Connection;

    constructor({ apiKey, address, port }) {
        this.apiKey = apiKey;
        this.address = address;
        this.port = port;
        this.configureLoggers();

        this.webApp = express();
        this.initRouters();
        this.initWebApp();

        const {
            PVE_HOSTNAME,
            PVE_PROTOCOL,
            PVE_USERNAME,
            PVE_PASSWORD,
            DB_HOST,
            DB_USER,
            DB_PASSWORD,
            DB_NAME,
        } = process.env;

        this.mysqlConnection = this.connectToDatabase({
            host: DB_HOST,
            user: DB_USER,
            password: DB_PASSWORD,
            database: DB_NAME,
        });

        this.proxmoxClient = new ProxmoxConnection({
            hostname: PVE_HOSTNAME,
            protocol: PVE_PROTOCOL,
            username: PVE_USERNAME,
            password: PVE_PASSWORD,
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
            this.wss.handleUpgrade(request, socket, head, async (socket) => {
                // TODO: bring back the checkIP function on production
                let isAuthorized: boolean = true; /*await this.checkIP(
                    request.socket.remoteAddress
                ); */

                if (isAuthorized) this.wss.emit('connection', socket, request);
                else socket.close();
            });
        });

        this.httpServer.listen(this.port, this.address, () => {
            printSuccess(`App is running on ${this.address}:${this.port}`);
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
        this.initMainRouter();
        this.initAgentRouter();
    }

    public async addTask(task: Task): Promise<Task> {
        const sql: string = `INSERT INTO tasks (id, start_time, data, containerID) VALUES (?, ?, ?, ?)`;
        await this.mysqlConnection.query(sql, [
            task.id,
            task.start_time.getTime(),
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
            task.start_time.getTime(),
            task.end_time.getTime(),
            JSON.stringify(task.data),
            task.status,
            task.error,
            task.containerID,
        ]);

        return task;
    }

    public async errorTask(taskid: Task['id'], error: Error): Promise<void> {
        const erroredTask = new Task(await this.getTask(taskid));
        erroredTask.status = 'error';
        erroredTask.error = error.message;

        await this.updateTask(erroredTask);
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
        for (let i = 0; i < 8; i++) {
            await sleep(300);
            const lines = this.loglines.get(task.id);
            if (lines) return lines;
        }

        return null;
    }
}
