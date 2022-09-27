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
    Ticket,
} from './lib/typing/types';
import {
    checkAuthToken,
    checkContainerID,
    checkIP,
    createLoggers,
    getEncodedBasicToken,
    printSuccess,
    sleep,
} from './lib/util/utils';
import { ClientNotFoundError, sendTaskToAgent } from './lib/ws/commandAgent';
import { wsCommand } from './lib/ws/routing/wsCommand';
import { handleMessage } from './lib/ws/wsMessageHandler';

export default class ContainerWorkspaces {
    protected httpServer: HttpServer | HttpsServer;

    private log4js: Log4js;
    public mainLogger: Logger;
    public httpLogger: Logger;
    public wsLogger: Logger;
    public pveLogger: Logger;
    public logLines: Map<Task['id'], string> = new Map();
    public codeServerPasswords: Map<Task['id'], string> = new Map();

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
     * @protected
     * @method
     * @returns {void}
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
     * @protected
     * @method
     * @returns {void}
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
     * @private
     * @method
     * @param  {string} logDir='/var/log/cw'
     * @returns {void}
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
     * @protected
     * @method
     * @returns {void}
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
     * @public
     * @method
     * @async
     * @param  {Task} task
     * @returns {Promise<Task>}
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
     * @public
     * @method
     * @async
     * @param  {string} id
     * @returns {Promise<Task | null>}
     */
    public async getTask(id: Task['id']): Promise<Task | null> {
        const task = await this.prismaClient.task.findFirst({ where: { id } });

        return task;
    }

    /**
     * Update a task in the database
     * @public
     * @method
     * @async
     * @param  {Task} task
     * @returns {Promise<Task>}
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
     * @public
     * @method
     * @async
     * @param  {string} taskid
     * @param  {Error} error
     * @returns {Promise<void>}
     */
    public async errorTask(taskid: Task['id'], error: Error): Promise<void> {
        const erroredTask = await this.getTask(taskid);
        erroredTask.status = 'error';
        erroredTask.error = error.message;

        await this.updateTask(erroredTask);
    }

    /**
     * Mark a task as finished in the database
     * @public
     * @method
     * @async
     * @param  {string} taskid
     * @returns {Promise<void>}
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
     * @public
     * @method
     * @async
     * @param  {Request} req
     * @param  {Response} res
     * @param  {status} status
     * @returns {Promise<void>}
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
     * @protected
     * @method
     * @async
     * @param {number} containerID
     * @param {string} ip
     * @returns {Promise<string>}
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

        // God please forgive us for this sin we're about to commit
        for (let i = 0; i < 20; i++) {
            await sleep(20);
            const lines = this.logLines.get(task.id);
            if (lines) return lines;
        }

        return null;
    }

    /**
     * Get the status of a container
     * @public
     * @method
     * @async
     * @param {number} containerID
     * @param {string} ip
     * @returns {Promise<string>}
     */
    public async getVSCodePassword(
        containerID: number,
        ip: string
    ): Promise<string> {
        const data: MessageData = {
            action: 'get_vscode_password',
            args: {
                linesCount: 100,
            },
        };
        const task = await this.prismaClient.task.create({
            data: { data: JSON.stringify(data), containerID },
        });
        await this.sendTaskToAgent(task, ip);

        // God please forgive us for this sin we're about to commit
        for (let i = 0; i < 10; i++) {
            await sleep(20);
            const lines = this.codeServerPasswords.get(task.id);
            if (lines) return lines;
        }

        return null;
    }

    /**
     * Get a client from the connected clients list
     * @public
     * @method
     * @param  {string} ip
     * @returns {WebSocket | null}
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
     * @protected
     * @method
     * @async
     * @param  {number} containerID
     * @param  {string} newPassword
     * @returns {Promise<boolean>}
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
     * @protected
     * @method
     * @returns {Handler}
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
     * @protected
     * @method
     * @returns {Handler}
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
     * @public
     * @method
     * @async
     * @returns {Promise<Config>}
     */
    public async getConfig(): Promise<Config> {
        const rawConfig = await this.prismaClient.config.findFirst();

        return rawConfig.config as unknown as Config;
    }

    /**
     * Update the configuration in the database
     * @private
     * @method
     * @param  {Config} config
     * @returns {Promise<Config>}
     */
    private async updateConfig(config: Config): Promise<void> {
        await this.prismaClient.config.update({
            where: { id: 1 },
            data: { config: JSON.stringify(config) },
        });
    }

    /**
     * Get the container hardware options from the database
     * @async
     * @returns {Promise<CTHardwareOptions>}
     */
    protected async getCTHardwareOptions(): Promise<CTHardwareOptions> {
        const config = await this.getConfig();
        return config['ct_options'];
    }

    /**
     * Update the container hardware options in the database
     * @protected
     * @method
     * @async
     * @param  {CTHardwareOptions} options
     * @returns {Promise<CTHardwareOptions>}
     */
    protected async udpateCTOptions(options: CTHardwareOptions): Promise<void> {
        const config = await this.getConfig();
        config['ct_options'] = options;

        await this.updateConfig(config);
    }

    /**
     * Get the initialization commands from the database
     * @protected
     * @method
     * @async
     * @returns {Promise<string[]>}
     */
    protected async getInitCommands(): Promise<string[]> {
        const config = await this.getConfig();
        return config['init_commands'];
    }

    /**
     * Update the initialization commands in the database
     * @protected
     * @method
     * @async
     * @param  {string[]} commands
     * @returns {Promise<void>}
     */
    protected async updateInitCommands(commands: string[]): Promise<void> {
        const config = await this.getConfig();
        config['init_commands'] = commands;

        await this.updateConfig(config);
    }

    /**
     * Get the container ID in proxmox via its ip address
     * @protected
     * @method
     * @async
     * @param  {string} ip
     * @returns {Promise<number | null}}
     */
    protected async getContainerID(ip: string): Promise<number | null> {
        const container = await this.prismaClient.container.findFirst({
            where: { ipv4: ip },
        });

        return container.id;
    }

    /**
     * Connect the application to the database
     * @private
     * @method
     * @async
     * @returns {Promise<void>}
     */
    private async connectDatabase() {
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

    /**
     * Tell an agent to create a ticket
     * @protected
     * @method
     * @async
     * @param  {number} containerID
     * @param  {Ticket} ticket
     * @returns {Promise<void>}
     */
    protected async createTicket(containerID: number, ticket: Ticket) {
        const agentIP = await this.proxmoxClient.getContainerIP(
            Number(containerID)
        );
        const connection = this.getConnectedClient(agentIP);
        if (!connection)
            throw new ClientNotFoundError(
                `Could not find client with IP ${agentIP}`
            );

        const data: MessageData = {
            action: 'create_ticket',
            args: {
                ticket,
            },
        };
        const task = await this.prismaClient.task.create({
            data: { containerID, data: JSON.stringify(data) },
        });

        await this.sendTaskToAgent(task, agentIP);
    }
}
