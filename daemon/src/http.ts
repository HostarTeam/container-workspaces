import cors from 'cors';
import express, { json, urlencoded } from 'express';
import { existsSync, readFileSync } from 'fs';
import { createServer as createHttpServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import ContainerWorkspaces from './ContainerWorkspaces';
import { printError, printSuccess } from './lib/util/utils';

/**
 * Setup the http server
 * @param  {ContainerWorkspaces} this
 * @returns {void}
 */
export default function setupHttp(this: ContainerWorkspaces): void {
    if (this.config.protocol === 'http') {
        this.httpServer = createHttpServer();
        this.wssHttpServer = createHttpServer();
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
        this.wssHttpServer = createHttpsServer({
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

    this.webApp = express();
    this.initRouters();

    this.webApp.disable('x-powered-by');
    this.webApp.use(cors());
    this.webApp.use(json());
    this.webApp.use(urlencoded({ extended: true }));
    this.webApp.use(this.httpLoggerMiddleware());

    // Routers
    this.webApp.use('/api/agent', this.agentRouter);
    this.webApp.use(
        '/api/container',
        this.authMiddleware(),
        this.containerRouter
    );
    this.webApp.use('/api/config', this.authMiddleware(), this.configRouter);
    this.webApp.use('/api/pm', this.authMiddleware(), this.pmRouter);
    this.webApp.use('/api', this.authMiddleware(), this.mainRouter);

    this.httpServer.on('request', this.webApp);

    this.initWebSocketServer();

    this.httpServer.listen(
        this.config.listenPort,
        this.config.listenAddress,
        () => {
            printSuccess(
                `App is running on ${this.config.listenAddress}:${this.config.listenPort} - ${this.config.protocol}://${this.config.remoteAddress}:${this.config.remotePort}`
            );
        }
    );
}
