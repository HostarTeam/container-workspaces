import type { Configuration } from '../typing/types';
import express, { Application, Router } from 'express';
import { Server as HttpServer, createServer as createHttpServer } from 'http';
import {
    Server as HttpsServer,
    createServer as createHttpsServer,
} from 'https';
import { existsSync, readFileSync } from 'fs';
import { printError, printSuccess } from '../util/utils';
import { initializeApiRouter } from './routers/apiRouter';
import proxyHandler from './proxyHandler';
import httpHandler from './httpHandler';
import validateProxy from './common/validateProxyHost';
import ContainerWorkspaces from '../../ContainerWorkspaces';
import BaseProxy from './proxies/BaseProxy';
import VSCodeProxy from './proxies/vscode';

export default class ProxyManager {
    private httpServer: HttpServer | HttpsServer;
    protected readonly config: Configuration['proxy'];
    protected webApp: Application;
    protected apiRouter: Router;
    protected allowedTokens: Map<string, number>;
    protected containerProxyClient: Map<number, BaseProxy>;

    protected proxyClients: {
        vscode: VSCodeProxy;
    };

    protected httpHandler = httpHandler;
    protected proxyHandler = proxyHandler;

    protected validateProxy = validateProxy;

    private initializeApiRouter = initializeApiRouter;

    constructor(public cw: ContainerWorkspaces) {
        this.config = cw.proxyConfig;
        this.allowedTokens = new Map();
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

        this.webApp.use('/pm/api', this.apiRouter.bind(this));

        this.httpServer.on('request', this.webApp);

        this.httpServer.listen(this.config.listenPort, () => {
            printSuccess(
                `Proxy Manager server listening on ${this.config.protocol}://${this.config.remoteAddress}:${this.config.remoteAddress}`
            );
        });
    }

    private initRouters(): void {
        this.initializeApiRouter();
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

    protected addContainerAccess(containerID: number, token: string): void {
        this.allowedTokens.set(token, containerID);
    }

    protected removeContainerAccess(token: string): void {
        if (this.allowedTokens.has(token)) {
            this.allowedTokens.delete(token);
        }
    }
}
