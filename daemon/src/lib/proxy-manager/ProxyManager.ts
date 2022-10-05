import type { Configuration } from '../typing/types';
import type { Application, Handler, Router } from 'express';
import express from 'express';
import type { Server as HttpServer, IncomingMessage } from 'http';
import { createServer as createHttpServer } from 'http';
import type { Server as HttpsServer } from 'https';
import { createServer as createHttpsServer } from 'https';
import { existsSync, readFileSync } from 'fs';
import { printError, printSuccess } from '../util/utils';
import proxyHandler from './proxyHandler';
import httpHandler from './httpHandler';
import validateProxy, { validateWSProxy } from './common/validateProxyHost';
import type ContainerWorkspaces from '../../ContainerWorkspaces';
import BaseProxy from './proxies/BaseProxy';
import VSCodeProxy from './proxies/vscode';
import WebShellProxy from './proxies/webshell';
import { getProxyInfo, parseCookieString } from './common/utils';
import serviceToPort from './common/serviceToPort';
import type { Duplex } from 'stream';
import type { AccessTokenInfo, ProxyInfo } from './common/types';
import { initProxyRouter } from './routers/proxy';
import { initServiceRedirectRouter } from './routers/serviceRedirect';
import cookieParser from 'cookie-parser';

export default class ProxyManager {
    private httpServer: HttpServer | HttpsServer;
    protected readonly config: Configuration['proxy'];
    protected webApp: Application;
    protected accessTokens: Map<string, AccessTokenInfo>;
    protected containerProxyClient: Map<string, BaseProxy>;
    protected authMiddleware: () => Handler;
    protected proxyRouter: Router;
    protected serviceRedirectRouter: Router;

    protected proxyClients = {
        vscode: VSCodeProxy,
        webshell: WebShellProxy,
    };

    protected httpHandler = httpHandler;
    protected proxyHandler = proxyHandler;

    protected initProxyRouter = initProxyRouter;
    protected initServiceRedirectRouter = initServiceRedirectRouter;

    protected validateProxy = validateProxy;
    protected validateWSProxy = validateWSProxy;

    constructor(public cw: ContainerWorkspaces) {
        this.config = cw.config.proxy;
        this.authMiddleware = cw.authMiddleware;
        this.accessTokens = new Map();
        this.containerProxyClient = new Map();

        this.initCheckExpiredTokenInterval();
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
        this.webApp.use(cookieParser());

        this.webApp.use('/proxy', this.proxyRouter);
        this.webApp.use(this.serviceRedirectRouter);
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
        this.initProxyRouter();
        this.initServiceRedirectRouter();
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
                    (socket as any).servername
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

                const cookies =
                    request.headers['cookie'] &&
                    parseCookieString(request.headers['cookie']);

                if (!cookies) return socket.destroy();

                const token = cookies['pm-token'];

                if (!token) return socket.destroy();

                if (!this.accessTokens.has(token)) return socket.destroy();

                const {
                    proxyInfo: { service, containerID },
                } = this.accessTokens.get(token);

                if (
                    service !== proxyInfo.service ||
                    containerID !== proxyInfo.containerID
                )
                    return socket.destroy();

                let proxyClient = this.containerProxyClient.get(token);
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

                    this.containerProxyClient.set(token, proxyClient);
                }

                proxyClient.handleHttpUpgrade(request, socket, head);
            }
        );
    }

    private initCheckExpiredTokenInterval(): void {
        setInterval(() => {
            const now = Date.now();
            for (const [token, { expires }] of this.accessTokens) {
                if (now > expires) {
                    this.accessTokens.delete(token);
                    this.containerProxyClient.delete(token);
                }
            }
        }, 1000 * 60);
    }

    /**
     * Method will add a container to the service proxy manager.
     * @public
     * @method
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

    /**
     * Method will add a token to the service proxy manager.
     * @public
     * @method
     * @param {ProxyInfo} proxyInfo - The proxy info to add.
     * @param {string} token - The token to add.
     * @param {number} duration - The time in seconds the token should expire in.
     */
    public addContainerAccess(
        proxyInfo: ProxyInfo,
        token: string,
        duration: number
    ): void {
        const accessTokenInfo: AccessTokenInfo = {
            proxyInfo,
            expires: Date.now() + duration,
        };
        this.accessTokens.set(token, accessTokenInfo);
    }

    /**
     * Method will remove a token from the service proxy manager.
     * @public
     * @method
     * @param {string} token - The token to remove.
     */
    public removeContainerAccess(token: string): void {
        this.accessTokens.delete(token);
    }
}
