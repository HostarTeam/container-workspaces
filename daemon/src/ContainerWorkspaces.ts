import { Application, Router, Request, Response, Handler } from 'express';
import { Server } from 'http';
import { Log4js, Logger } from 'log4js';
import { initMainRouter } from './lib/routers/main';
import { initAgentRouter } from './lib/routers/agent';
import { initContainerRouter } from './lib/routers/container';
import {
    checkAuthToken,
    checkIP,
    createLoggers,
    printSuccess,
    sleep,
} from './lib/util/utils';
import ProxmoxConnection from './lib/proxmox/ProxmoxConnection';
import { WebSocket, WebSocketServer } from 'ws';
import { handleMessage } from './lib/ws/wsMessageHandler';
import { wsCommand } from './lib/ws/routing/wsCommand';
import { sendTaskToAgent } from './lib/ws/commandAgent';
import { Config, status, Configuration } from './lib/typing/types';
import { MessageData } from './lib/typing/MessageData';
import { initConfigRouter } from './lib/routers/config';
import { CTHardwareOptions } from './lib/typing/options';
import setupHttp from './http';
import httpLoggerMiddleware from './lib/middleware/logging';
import authMiddleware from './lib/middleware/auth';
import { MySQLClient, ConnectionOptions } from '@hostarteam/mysqlclient';
import CT from './lib/entities/CT';
import Task from './lib/entities/Task';

export default class ContainerWorkspaces {
    protected httpServer: Server;
    protected apiKey: string;
    protected readonly listenAddress: string;
    protected readonly listenPort: number;
    protected readonly remoteAddress: string;
    protected readonly remotePort: number;
    protected readonly protocol: Configuration['protocol'];

    private log4js: Log4js;
    public mainLogger: Logger;
    public httpLogger: Logger;
    public wsLogger: Logger;
    public pveLogger: Logger;
    public logLines: Map<Task['id'], string> = new Map();

    protected setupHttp = setupHttp;
    protected initMainRouter = initMainRouter;
    protected initAgentRouter = initAgentRouter;
    protected initConfigRouter = initConfigRouter;
    protected initContainerRouter = initContainerRouter;
    protected handleMessage = handleMessage;
    protected wsCommand = wsCommand;
    protected checkIP = checkIP;
    protected sendTaskToAgent = sendTaskToAgent;
    protected httpLoggerMiddleware = httpLoggerMiddleware;
    protected authMiddleware = authMiddleware;
    protected checkAuthToken = checkAuthToken;

    protected webApp: Application;
    protected wss: WebSocketServer;
    protected mainRouter: Router;
    protected agentRouter: Router;
    protected containerRouter: Router;
    protected configRouter: Router;
    protected webSockerRouter;
    protected proxmoxClient: ProxmoxConnection;
    protected mySQLClient: MySQLClient;

    constructor({
        apiKey,
        listenAddress,
        listenPort,
        remoteAddress,
        remotePort,
        protocol,
        database: databaseConf,
        pve: PVEConf,
    }: Configuration) {
        this.apiKey = apiKey;
        this.listenAddress = listenAddress;
        this.listenPort = listenPort;
        this.remoteAddress = remoteAddress;
        this.remotePort = remotePort;
        this.protocol = protocol;
        this.configureLoggers();

        this.setupHttp();

        this.connectDatabase(databaseConf);

        this.proxmoxClient = new ProxmoxConnection({
            hostname: PVEConf.hostname,
            protocol: PVEConf.protocol,
            username: PVEConf.username,
            password: PVEConf.password,
            pveLogger: this.pveLogger,
            mySQLClient: this.mySQLClient,
            cw: this,
        });
    }

    protected initWebSocketServer(): void {
        this.wss = new WebSocketServer({ noServer: true });
        this.wss.on('connection', (socket, req) => {
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
                const isAuthorized: boolean = await this.checkIP(
                    request.socket.remoteAddress
                );
                if (isAuthorized) this.wss.emit('connection', socket, request);
                else socket.close();
            });
        });
    }

    private configureLoggers(logDir = '/var/log/cw'): void {
        const logsName = ['main', 'http', 'ws', 'pve'];
        this.log4js = createLoggers(logsName, logDir);

        this.mainLogger = this.log4js.getLogger('main');
        this.httpLogger = this.log4js.getLogger('http');
        this.wsLogger = this.log4js.getLogger('ws');
        this.pveLogger = this.log4js.getLogger('pve');
    }

    protected initRouters(): void {
        this.initConfigRouter();
        this.initContainerRouter();
        this.initMainRouter();
        this.initAgentRouter();
    }

    public async addTask(task: Task): Promise<Task> {
        const sql =
            'INSERT INTO tasks (id, start_time, data, containerID) VALUES (?, ?, ?, ?)';
        await this.mySQLClient.executeQuery(sql, [
            task.id,
            task.start_time,
            JSON.stringify(task.data),
            task.containerID,
        ]);

        return task;
    }
    public async getTask(id: Task['id']): Promise<Task | null> {
        const sql = 'SELECT * FROM tasks WHERE id = ?';
        const result = await this.mySQLClient.getFirstQueryResult(sql, [id]);
        if (!result) return null;
        const task = Task.fromObject(result);
        return task;
    }

    public async updateTask(task: Task): Promise<Task> {
        const sql =
            'UPDATE tasks SET start_time = ?, end_time = ?, data = ?, status = ?, error = ?, containerID = ? WHERE id = ?';
        await this.mySQLClient.executeQuery(sql, [
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
        const erroredTask = await this.getTask(taskid);
        erroredTask.status = 'error';
        erroredTask.error = error.message;

        await this.updateTask(erroredTask);
    }

    public async finishTask(taskid: Task['id']): Promise<void> {
        const finishedTask = await this.getTask(taskid);
        finishedTask.status = 'OK';
        finishedTask.end_time = Date.now();

        await this.updateTask(finishedTask);
    }

    public async triggerStatusChange(
        req: Request,
        res: Response,
        status: status
    ): Promise<void> {
        const containerID = Number(req.params.containerID);
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
            /*eslint-disable */
            (client: any) => client._socket.remoteAddress === ip
            /*eslint-enable */
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
            const containerID = Number(req.params.containerID);
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

    public async getConfig(): Promise<Config> {
        const sql = 'SELECT * FROM config';
        const result = await this.mySQLClient.getFirstQueryResult(sql);
        if (!result) return null;
        const config: Config = JSON.parse(String(result.config));
        return config;
    }

    private async updateConfig(config: Config): Promise<void> {
        const sql = 'UPDATE config SET config = ?';
        await this.mySQLClient.executeQuery(sql, [JSON.stringify(config)]);
    }

    protected async getCTHardwareOptions(): Promise<CTHardwareOptions> {
        const config = await this.getConfig();
        return config['ct_options'];
    }

    protected async udpateCTOptions(options: CTHardwareOptions): Promise<void> {
        const config = await this.getConfig();
        config['ct_options'] = options;

        await this.updateConfig(config);
    }

    protected async getInitCommands(): Promise<string[]> {
        const config = await this.getConfig();
        return config['init_commands'];
    }

    protected async updateInitCommands(commands: string[]): Promise<void> {
        const config = await this.getConfig();
        config['init_commands'] = commands;

        await this.updateConfig(config);
    }

    protected async getContainerID(ip: string): Promise<number | null> {
        const sql = 'SELECT id FROM cts WHERE ipv4 = ?';
        const result = await this.mySQLClient.getFirstQueryResult(sql, ip);
        if (!result) return null;
        const ct = CT.fromObject(result);
        return ct.id;
    }

    private async connectDatabase(connectionConfig: ConnectionOptions) {
        this.mySQLClient = new MySQLClient(connectionConfig);
        await this.mySQLClient.connect();
        printSuccess('Connected to database');
    }
}
