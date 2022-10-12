import { PrismaClient, Task } from '@prisma/client';
import { Application, Handler, Request, Response, Router } from 'express';
import { Server as HttpServer } from 'http';
import { createProxyServer } from 'http-proxy';
import { Server as HttpsServer } from 'https';
import { Log4js, Logger } from 'log4js';
import { parse } from 'path';
import { Server as SocketIOServer, Socket as SocketIOSocket } from 'socket.io';
import { WebSocket, WebSocketServer } from 'ws';
import setupHttp from './http';
import authMiddleware from './lib/middleware/auth';
import httpLoggerMiddleware from './lib/middleware/logging';
import ProxmoxConnection from './lib/proxmox/ProxmoxConnection';
import ProxyManager from './lib/proxy-manager/ProxyManager';
import { initAgentRouter } from './lib/routers/agent';
import { initConfigRouter } from './lib/routers/config';
import { initContainerRouter } from './lib/routers/container';
import { initMainRouter } from './lib/routers/main';
import { initPMRouter } from './lib/routers/pm';
import { MessageData } from './lib/typing/MessageData';
import { CTHardwareOptions } from './lib/typing/options';
import {
    ClientToServerEvents,
    Config,
    Configuration,
    ServerToClientEvents,
    status,
} from './lib/typing/types';
import {
    checkAuthToken,
    checkContainerID,
    checkIP,
    createLoggers,
    getEncodedBasicToken,
    printSuccess,
} from './lib/util/utils';
import { sendTaskToAgent } from './lib/ws/commandAgent';
import { wsCommand } from './lib/ws/routing/wsCommand';
import { handleMessage } from './lib/ws/wsMessageHandler';
import { EventEmitter } from 'events';

export default class ContainerWorkspaces {
    protected httpServer: HttpServer | HttpsServer;

    private log4js: Log4js;
    public mainLogger: Logger;
    public httpLogger: Logger;
    public wsLogger: Logger;
    public pveLogger: Logger;

    protected setupHttp = setupHttp;
    protected initMainRouter = initMainRouter;
    protected initAgentRouter = initAgentRouter;
    protected initConfigRouter = initConfigRouter;
    protected initContainerRouter = initContainerRouter;
    protected initPMRouter = initPMRouter;
    protected handleMessage = handleMessage;
    protected wsCommand = wsCommand;
    protected checkIP = checkIP;
    protected checkContainerID = checkContainerID;
    protected sendTaskToAgent = sendTaskToAgent;
    protected httpLoggerMiddleware = httpLoggerMiddleware;
    public authMiddleware = authMiddleware;
    protected checkAuthToken = checkAuthToken;

    protected webApp: Application;
    protected wssHttpServer: HttpServer | HttpsServer;
    protected wss: WebSocketServer;
    protected mainRouter: Router;
    protected agentRouter: Router;
    protected containerRouter: Router;
    protected configRouter: Router;
    protected pmRouter: Router;
    public proxmoxClient: ProxmoxConnection;
    protected prismaClient: PrismaClient;
    protected proxyManager: ProxyManager;
    public io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>;
    public taskToSocketId: Map<Task['id'], SocketIOSocket['id']>;
    public wsEventEmitter: EventEmitter = new EventEmitter();

    constructor(public readonly config: Configuration) {
        this.taskToSocketId = new Map();
        this.configureLoggers();

        this.proxyManager = new ProxyManager(this);

        this.setupHttp();

        this.connectDatabase();

        this.proxmoxClient = new ProxmoxConnection({
            hostname: config.pve.hostname,
            protocol: config.pve.protocol,
            username: config.pve.username,
            password: config.pve.password,
            port: 80,
            pveLogger: this.pveLogger,
            prismaClient: this.prismaClient,
            cw: this,
            verifyCertificate: false,
        });
    }

    /**
     * Initialize the websocket server.
     */
    protected initWebSocketServer(): void {
        this.wss = new WebSocketServer({ noServer: true });
        this.wss.on('connection', (socket, req) => {
            socket.on('message', (message) => {
                this.handleMessage(message, req, socket);
            });
        });

        this.wssHttpServer.on('upgrade', async (request, socket, head) => {
            const connected = this.getConnectedClient(
                request.socket.remoteAddress
            );
            const { dir } = parse(request.url);
            if (dir === '/') {
                this.wss.handleUpgrade(
                    request,
                    socket,
                    head,
                    async (socket) => {
                        if (connected) socket.close();
                        const isAuthorized: boolean = await this.checkIP(
                            request.socket.remoteAddress
                        );
                        if (isAuthorized)
                            this.wss.emit('connection', socket, request);
                        else socket.close();
                    }
                );
            } else if (dir === '/webshell') {
                const rawContainerID: string | null = request.url
                    .split('/')[2]
                    ?.split('/')[0]
                    ?.split('?')[0];

                const containerID = Number(rawContainerID);
                if (!Number.isInteger(containerID)) request.destroy();
                const agentIP = await this.proxmoxClient.getContainerIP(
                    containerID
                );
                if (
                    !agentIP ||
                    !this.checkIP(agentIP) ||
                    !this.getConnectedClient(agentIP)
                )
                    return request.destroy();
                const proxy = createProxyServer({
                    target: {
                        protocol: 'http',
                        host: agentIP,
                        port: 49150,
                    },
                    ws: true,
                });
                try {
                    proxy.ws(
                        request,
                        socket,
                        head,
                        {
                            proxyTimeout: 5000,
                        },
                        () => null
                    );
                } catch (e) {
                    this.wsLogger.error(`Got error while proxying: ${e}`);
                }
            } else request.destroy();
        });
    }

    /**
     * Inititalize the socket.io server.
     */
    protected initSocketIOServer(): void {
        this.io.on(
            'connection',
            async (
                socket: SocketIOSocket<
                    ClientToServerEvents,
                    ServerToClientEvents
                >
            ) => {
                // check authentication
                const authHeaderValue = socket.handshake.headers
                    .authorization as string;
                if (!authHeaderValue || typeof authHeaderValue !== 'string')
                    return socket.disconnect();

                const token = getEncodedBasicToken(socket.handshake);
                const authValid: boolean = await this.checkAuthToken(token);
                if (!authValid) return socket.disconnect();

                socket.on(
                    'shell_exec_sync',
                    async (containerIDRaw: string, script: string) => {
                        try {
                            const containerID = Number(containerIDRaw);
                            if (!Number.isInteger(containerID))
                                return socket.emit(
                                    'shell_exec_error',
                                    'Invalid container ID'
                                );

                            const containerIP =
                                await this.proxmoxClient.getContainerIP(
                                    containerID
                                );
                            if (
                                !containerIP ||
                                !(await this.checkIP(containerIP))
                            )
                                return socket.emit(
                                    'shell_exec_error',
                                    'Container not found'
                                );
                            const task = await this.prismaClient.task.create({
                                data: {
                                    containerID: containerID,
                                    data: {
                                        action: 'shell_exec_sync',
                                        args: {
                                            script: script,
                                        },
                                    },
                                },
                            });

                            this.sendTaskToAgent(task, containerIP).catch(
                                () => {
                                    return socket.emit(
                                        'shell_exec_error',
                                        'Error occurred when trying to send task to agent'
                                    );
                                }
                            );
                            this.taskToSocketId.set(task.id, socket.id);
                        } catch (err: unknown) {
                            if (err instanceof Error) {
                                socket.emit('shell_exec_error', err.message);
                            }
                        }
                    }
                );
            }
        );
    }

    /**
     * Configure loggers.
     */
    private configureLoggers(logDir = '/var/log/cw'): void {
        const logsName = ['main', 'http', 'ws', 'pve'];
        this.log4js = createLoggers(logsName, logDir);

        this.mainLogger = this.log4js.getLogger('main');
        this.httpLogger = this.log4js.getLogger('http');
        this.wsLogger = this.log4js.getLogger('ws');
        this.pveLogger = this.log4js.getLogger('pve');
    }

    /**
     * Initialize all routers.
     */
    protected initRouters(): void {
        this.initConfigRouter();
        this.initContainerRouter();
        this.initMainRouter();
        this.initAgentRouter();
        this.initPMRouter();
    }

    /**
     * Add a task to the database.
     */
    public async addTask(task: Task): Promise<Task> {
        await this.prismaClient.task.create({
            data: {
                id: task.id,
                start_time: new Date(task.start_time),
                data: JSON.stringify(task.data),
                containerID: task.containerID,
            },
        });

        return task;
    }

    /**
     * Get a task from the database.
     */
    public async getTask(id: Task['id']): Promise<Task | null> {
        const task = await this.prismaClient.task.findFirst({ where: { id } });

        return task;
    }

    /**
     * Update a task in the database
     */
    public async updateTask(task: Task): Promise<Task> {
        const updatedTask = await this.prismaClient.task.update({
            where: { id: task.id },
            data: {
                start_time: task.start_time,
                end_time: task.end_time,
                data: task.data,
                error: task.error,
                containerID: task.containerID,
            },
        });

        return updatedTask;
    }

    /**
     * Mark a task as errored in the database
     */
    public async errorTask(taskid: Task['id'], error: Error): Promise<void> {
        const erroredTask = await this.getTask(taskid);
        erroredTask.status = 'error';
        erroredTask.error = error.message;

        await this.updateTask(erroredTask);
    }

    /**
     * Mark a task as finished in the database
     */
    public async finishTask(id: Task['id']): Promise<void> {
        await this.prismaClient.task.update({
            where: { id },
            data: {
                status: 'OK',
                end_time: new Date(),
            },
        });
    }

    /**
     * Change the status of a container
     */
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
        if (!statusRes.ok)
            res.status(409).send({
                status: 'error',
                message: statusRes.data,
                error: statusRes.error,
            });
        else res.send({ status: 'ok' });
    }

    /**
     * Get the status of a container
     */
    protected async getLogs(containerID: number, ip: string): Promise<string> {
        const data: MessageData = {
            action: 'send_logs',
            args: {
                linesCount: 100,
            },
        };
        const task = await this.prismaClient.task.create({
            data: { data: JSON.stringify(data), containerID },
        });
        await this.sendTaskToAgent(task, ip);

        return await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject('Timeout reached'), 5000);
            this.wsEventEmitter.once(
                task.id.toString(),
                (lines: string | null) => {
                    if (!lines) reject('Got no lines');
                    clearTimeout(timeout);
                    resolve(lines);
                }
            );
        });
    }

    /**
     * Get the status of a container
     */
    public async getServiceAuth<T>(
        containerID: number,
        ip: string,
        service: string
    ): Promise<T> {
        const data: MessageData = {
            action: 'get_service_auth_token',
            args: {
                service,
            },
        };
        const task = await this.prismaClient.task.create({
            data: { data: JSON.stringify(data), containerID },
        });
        await this.sendTaskToAgent(task, ip);

        return await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject('Timeout reached'), 5000);
            this.wsEventEmitter.once(task.id.toString(), (auth: T | null) => {
                if (!auth) reject('No auth');
                clearTimeout(timeout);
                resolve(auth);
            });
        });
    }

    /**
     * Get a client from the connected clients list
     */
    public getConnectedClient(ip: string): WebSocket | null {
        const clientList: WebSocket[] = Array.from(this.wss.clients);
        const selectedClient: WebSocket = clientList.find(
            /*eslint-disable */
            (client: any) => client._socket.remoteAddress === ip
            /*eslint-enable */
        );

        return selectedClient;
    }

    /**
     * Change the password of a container
     */
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

        const task = await this.prismaClient.task.create({
            data: { data: JSON.stringify(data), containerID },
        });
        await this.sendTaskToAgent(task, agentIP);
        return true;
    }

    /**
     * Get ip of container and set in in req
     */
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

    /**
     * Validates the containerID of the request
     */
    protected validateContainerID(): Handler {
        return async (req, res, next) => {
            if (isNaN(Number(req.params.containerID)))
                return res.status(400).send({
                    status: 'bad request',
                    message: 'containerID must be a number',
                });
            const containerID = Number(req.params.containerID);
            const node = await this.proxmoxClient.getNodeOfContainer(
                containerID
            );

            if (!node) {
                res.status(404).send({
                    status: 'not found',
                    message: 'Could not find container with such ID',
                });
            } else if (!(await this.checkContainerID(containerID))) {
                res.status(406).send({
                    status: 'not acceptable',
                    message:
                        'Specified ID belongs to a container which is not managed by our services',
                });
            } else next();
        };
    }

    /**
     * Get the configuration from the database
     */
    public async getConfig(): Promise<Config> {
        const rawConfig = await this.prismaClient.config.findFirst();

        return rawConfig.config as unknown as Config;
    }

    /**
     * Update the configuration in the database
     */
    private async updateConfig(config: Config): Promise<void> {
        await this.prismaClient.config.update({
            where: { id: 1 },
            data: { config: JSON.stringify(config) },
        });
    }

    /**
     * Get the container hardware options from the database
     */
    protected async getCTHardwareOptions(): Promise<CTHardwareOptions> {
        const config = await this.getConfig();
        return config['ct_options'];
    }

    /**
     * Update the container hardware options in the database
     */
    protected async udpateCTOptions(options: CTHardwareOptions): Promise<void> {
        const config = await this.getConfig();
        config['ct_options'] = options;

        await this.updateConfig(config);
    }

    /**
     * Get the initialization commands from the database
     */
    protected async getInitCommands(): Promise<string[]> {
        const config = await this.getConfig();
        return config['init_commands'];
    }

    /**
     * Update the initialization commands in the database
     */
    protected async updateInitCommands(commands: string[]): Promise<void> {
        const config = await this.getConfig();
        config['init_commands'] = commands;

        await this.updateConfig(config);
    }

    /**
     * Get the container ID in proxmox via its ip address
     */
    protected async getContainerID(ip: string): Promise<number | null> {
        const container = await this.prismaClient.container.findFirst({
            where: { ipv4: ip },
        });

        return container.id;
    }

    /**
     * Connect the application to the database
     */
    private async connectDatabase(): Promise<void> {
        this.prismaClient = new PrismaClient({
            datasources: {
                db: {
                    url: `mysql://${this.config.database.user}:${this.config.database.password}@${this.config.database.host}:${this.config.database.port}/${this.config.database.database}`,
                },
            },
        });
        await this.prismaClient.$connect();
        printSuccess('Connected to database');
    }
}
