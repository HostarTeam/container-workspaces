import type { Configuration } from '../typing/types';
import express, { Application, Handler } from 'express';
import {
    Server as HttpServer,
    createServer as createHttpServer,
    IncomingMessage,
} from 'http';
import {
    Server as HttpsServer,
    createServer as createHttpsServer,
} from 'https';
import { existsSync, readFileSync } from 'fs';
import { printError, printSuccess } from '../util/utils';
import proxyHandler from './proxyHandler';
import httpHandler from './httpHandler';
import validateProxy, { validateWSProxy } from './common/validateProxyHost';
import ContainerWorkspaces from '../../ContainerWorkspaces';
import BaseProxy from './proxies/BaseProxy';
import VSCodeProxy from './proxies/vscode';
import { WebSocketServer } from 'ws';
import { getProxyInfo } from './common/utils';
import serviceToPort from './common/serviceToPort';
import { Duplex } from 'stream';
import { ProxyInfo } from './common/types';

export default class ProxyManager {
    private httpServer: HttpServer | HttpsServer;
    private wss: WebSocketServer;
    protected readonly config: Configuration['proxy'];
    protected webApp: Application;
    private accessTokens: Map<string, ProxyInfo>;
    protected containerProxyClient: Map<number, BaseProxy>;
    protected authMiddleware: () => Handler;

    protected proxyClients = {
        vscode: VSCodeProxy,
    };

    protected httpHandler = httpHandler;
    protected proxyHandler = proxyHandler;

    protected validateProxy = validateProxy;
    protected validateWSProxy = validateWSProxy;

    constructor(public cw: ContainerWorkspaces) {
        this.config = cw.proxyConfig;
        this.authMiddleware = cw.authMiddleware;
        this.accessTokens = new Map();
        this.containerProxyClient = new Map();

        this.startWebServer();
    }

    private startWebServer(): void {
        if (this.config.protocol === 'http') {
            this.httpServer = createHttpServer(this.webApp);
        } else if (this.config.protocol === 'https') {
            if (!existsSync(this.config.sslOptions.key)) {
                printError(
                    `The key file '${this.config.sslOptions.key}' does not exist.`
                );
                process.exit(1);
            } else if (!existsSync(this.config.sslOptions.cert)) {
                printError(
                    `The cert file '${this.config.sslOptions.cert}' does not exist.`
                );
                process.exit(1);
            }
            this.httpServer = createHttpsServer({
                key: readFileSync(this.config.sslOptions.key, {
                    encoding: 'utf-8',
                }),
                cert: readFileSync(this.config.sslOptions.cert, {
                    encoding: 'utf-8',
                }),
            });
        } else {
            printError(`Unknown protocol '${this.config.protocol}'`);
            process.exit(1);
        }

        this.initRouters();

        this.webApp = express();

        this.webApp.disable('x-powered-by');
        this.webApp.use(express.json());
        this.webApp.use(express.urlencoded({ extended: true }));

        this.webApp.use(this.httpHandler.bind(this));

        this.httpServer.on('request', this.webApp);
        this.initWebSocketServer();

        this.httpServer.listen(this.config.listenPort, () => {
            printSuccess(
                `Proxy Manager server listening on ${this.config.protocol}://${this.config.remoteAddress}:${this.config.remotePort}`
            );
        });
    }

    private initRouters(): void {
        return;
    }

    private initWebSocketServer(): void {
        this.httpServer.on(
            'upgrade',
            async (request: IncomingMessage, socket: Duplex, head: Buffer) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if ((socket as any).servername === this.config.remoteAddress)
                    return socket.destroy();

                const proxyInfo = getProxyInfo(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (request.socket as any).servername
                );

                const targetAddress =
                    await this.cw.proxmoxClient.getContainerIP(
                        proxyInfo.containerID
                    );

                if (!targetAddress) {
                    return socket.destroy();
                }

                if (!this.validateWSProxy(request, socket))
                    return socket.destroy();

                let proxyClient = this.containerProxyClient.get(
                    proxyInfo.containerID
                );
                if (!proxyClient) {
                    proxyClient = new this.proxyClients[proxyInfo.service](
                        {
                            host: targetAddress,
                            port: serviceToPort[proxyInfo.service],
                            containerID: proxyInfo.containerID,
                        },
                        this
                    );

                    if (proxyClient.authRequired) {
                        await proxyClient.fetchAuth();
                    }

                    this.containerProxyClient.set(
                        proxyInfo.containerID,
                        proxyClient
                    );
                }

                proxyClient.handleHttpUpgrade(request, socket, head);
            }
        );
    }

    /**
     * Method will add a container to the service proxy manager.
     * @param {string} containerID - The container ID to proxy to.
     * @param {string} containerIP - The container IP to proxy to.
     */
    public addContainer(containerID: number, containerIP: string): void {
        containerID;
        containerIP;
        throw new Error('Method not implemented.');
    }

    /**
     * Method will remove a container from the service proxy manager.
     * @param {string} containerID - The container ID to remove.
     */
    public removeContainer(containerID: number): void {
        containerID;
        throw new Error('Method not implemented.');
    }

    public addContainerAccess(proxyInfo: ProxyInfo, token: string): void {
        this.accessTokens.set(token, proxyInfo);
    }

    public removeContainerAccess(token: string): void {
        this.accessTokens.delete(token);
    }
}
