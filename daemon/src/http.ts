import cors from 'cors';
import express, { json, urlencoded } from 'express';
import { createServer } from 'http';
import ContainerWorkspaces from './ContainerWorkspaces';
import { validateAuth, printSuccess } from './lib/utils';

export default function setupHttp(this: ContainerWorkspaces): void {
    this.httpServer = createServer();

    this.webApp = express();
    this.initRouters();

    this.webApp.disable('x-powered-by');
    this.webApp.use(cors());
    this.webApp.use(json());
    this.webApp.use(urlencoded({ extended: true }));
    this.webApp.use(this.httpLoggerMiddleware(this.httpLogger));
    this.webApp.use(validateAuth(this.apiKey));

    // Routers
    this.webApp.use('/api/agent', this.agentRouter);
    this.webApp.use('/api/container', this.containerRouter);
    this.webApp.use('/api/config', this.configRouter);
    this.webApp.use('/api', this.mainRouter);

    this.httpServer.on('request', this.webApp);

    this.initWebSocketServer();

    this.httpServer.listen(this.listenPort, this.listenAddress, () => {
        printSuccess(
            `App is running on ${this.listenAddress}:${this.listenPort} - ${this.protocol}://${this.remoteAddress}:${this.remotePort}`
        );
    });
}
