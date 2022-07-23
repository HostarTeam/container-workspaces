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
    if (this.protocol === 'http') {
        this.httpServer = createHttpServer();
    } else if (this.protocol === 'https') {
        if (!existsSync(this.sslOptions.key)) {
            printError(`The key file '${this.sslOptions.key}' does not exist.`);
            process.exit(1);
        } else if (!existsSync(this.sslOptions.cert)) {
            printError(
                `The cert file '${this.sslOptions.cert}' does not exist.`
            );
            process.exit(1);
        }
        this.httpServer = createHttpsServer({
            key: readFileSync(this.sslOptions.key, { encoding: 'utf-8' }),
            cert: readFileSync(this.sslOptions.cert, { encoding: 'utf-8' }),
        });
    } else {
        printError(`Unknown protocol '${this.protocol}'`);
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
    this.webApp.use('/api', this.authMiddleware(), this.mainRouter);

    this.httpServer.on('request', this.webApp);

    this.initWebSocketServer();

    this.httpServer.listen(this.listenPort, this.listenAddress, () => {
        printSuccess(
            `App is running on ${this.listenAddress}:${this.listenPort} - ${this.protocol}://${this.remoteAddress}:${this.remotePort}`
        );
    });
}
