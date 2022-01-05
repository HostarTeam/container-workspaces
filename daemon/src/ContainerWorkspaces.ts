import express, { Application, Router } from 'express';
import { initMainRouter } from './lib/routers/main';
import { initAgentRouter } from './lib/routers/agent';
import { printSuccess, validateAuth } from './lib/utils';
import ProxmoxConnection from './lib/proxmox/ProxmoxConnection';
import { WebSocketServer } from 'ws';

export default class ContainerWorkspaces {
    private apiKey: string;
    public address: string;
    public port: number;
    protected dockerNetworkInterface: string;

    protected initMainRouter: () => void = initMainRouter;
    protected initAgentRouter: () => void = initAgentRouter;

    protected webApp: Application;
    protected mainRouter: Router;
    protected agentRouter: Router;
    protected ProxmoxClient: ProxmoxConnection;

    constructor({ apiKey, address, port, dockerNetworkInterface }) {
        this.apiKey = apiKey;
        this.address = address;
        this.port = port;
        this.dockerNetworkInterface = dockerNetworkInterface;

        this.webApp = express();
        this.initRouters();
        this.initWebApp();

        const { PVE_HOSTNAME, PVE_PROTOCOL, PVE_USERNAME, PVE_PASSWORD } =
            process.env;

        this.ProxmoxClient = new ProxmoxConnection({
            hostname: PVE_HOSTNAME,
            protocol: PVE_PROTOCOL,
            username: PVE_USERNAME,
            password: PVE_PASSWORD,
        });
    }

    private initWebApp(): void {
        this.webApp.use(express.json());
        this.webApp.use(express.urlencoded({ extended: true }));

        this.webApp.use(validateAuth(this.apiKey));

        // Routers
        this.webApp.use('/api/agent', this.agentRouter);
        this.webApp.use('/api', this.mainRouter);

        this.webApp.listen(this.port, this.address, () => {
            printSuccess(`App is running on ${this.address}:${this.port}`);
        });
    }

    private initRouters(): void {
        this.initMainRouter();
        this.initAgentRouter();
    }
}
