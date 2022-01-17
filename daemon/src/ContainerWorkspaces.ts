import express, {
    Application,
    NextFunction,
    Router,
    Request,
    Response,
    Handler,
} from 'express';
import { createServer, IncomingMessage, Server } from 'http';
import { Log4js, Logger } from 'log4js';
import { initMainRouter } from './lib/routers/main';
import { initAgentRouter } from './lib/routers/agent';
import {
    checkIP,
    createLoggers,
    printSuccess,
    validateAuth,
} from './lib/utils';
import ProxmoxConnection from './lib/proxmox/ProxmoxConnection';
import WebSocket, { RawData, WebSocketServer } from 'ws';
import { connectToDatabase } from './lib/mysql';
import { ConnectionOptions } from 'mysql2/typings/mysql';
import { handleMessage } from './lib/ws/wsMessageHandler';
import { MessageData } from './lib/typing/MessageData';
import { wsCommand } from './lib/ws/routing/wsCommand';
import { sendCommandToAgent } from './lib/ws/commandAgent';
import { Task } from './lib/typing/Task';

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

    protected initMainRouter: () => void = initMainRouter;
    protected initAgentRouter: () => void = initAgentRouter;
    private connectToDatabase: (connectionOptions: ConnectionOptions) => any =
        connectToDatabase;
    protected handleMessage: (
        message: RawData,
        req: IncomingMessage,
        socket: WebSocket
    ) => void = handleMessage;
    protected wsCommand: (
        req: IncomingMessage,
        messageData: MessageData,
        socket: WebSocket
    ) => Promise<void> = wsCommand;
    protected checkIP: (ip: string) => Promise<boolean> = checkIP;
    protected sendCommandToAgent: (task: Task) => void = sendCommandToAgent;

    protected webApp: Application;
    protected wss: WebSocketServer;
    protected mainRouter: Router;
    protected agentRouter: Router;
    protected webSockerRouter;
    protected ProxmoxClient: ProxmoxConnection;
    public mysqlConnection: any;

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

        this.ProxmoxClient = new ProxmoxConnection({
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

    public addTask(task: Task): Task {
        const sql: string = `INSERT INTO tasks (start_time, data) VALUES (?, ?)`;
        this.mysqlConnection.query(sql, [
            task.start_time,
            JSON.stringify(task.data),
        ]);

        return task;
    }

    public async getTask(id: Task['id']): Promise<Task> {
        const sql: string = `SELECT * FROM tasks WHERE id = ?`;
        const result = (await this.mysqlConnection.query(sql, id))[0][0];
        const task = new Task(result);
        return task;
    }

    public async updateTask(task: Task): Promise<Task> {
        const sql: string = `UPDATE tasks SET start_time = ?, end_time = ?, data = ?, status = ?, error = ?, ipaddr = ? WHERE id = ?`;
        await this.mysqlConnection.query(sql, [
            task.start_time,
            task.end_time,
            JSON.stringify(task.data),
            task.status,
            task.error,
            task.ipaddr,
        ]);

        return task;
    }

    public async errorTask(taskid: Task['id'], error: Error): Promise<void> {
        const erroredTask = new Task(await this.getTask(taskid));
        erroredTask.status = 'error';
        erroredTask.error = error.message;

        await this.updateTask(erroredTask);
    }
}
