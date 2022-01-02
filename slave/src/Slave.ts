import express, { Application, Router } from 'express';
import { initMainRouter } from './lib/routers/main';
import { getAuthKey, printSuccess, validateAuth } from './lib/utils';

export default class Slave {
    private apiKey: string;
    public address: string;
    public port: number;
    protected dockerNetworkInterface: string;

    protected initMainRouter: () => void = initMainRouter;

    protected webApp: Application;
    protected mainRouter: Router;

    constructor({ apiKey, address, port, dockerNetworkInterface }) {
        this.apiKey = apiKey;
        this.address = address;
        this.port = port;
        this.dockerNetworkInterface = dockerNetworkInterface;

        this.webApp = express();
        this.initRouters();
        this.initWebApp();
    }

    private initWebApp(): void {
        this.webApp.use(express.json());
        this.webApp.use(express.urlencoded({ extended: true }));
        this.webApp.use(validateAuth(this.apiKey));
        // Routers
        this.webApp.use('/api', this.mainRouter);

        this.webApp.listen(this.port, this.address, () => {
            printSuccess(`App is running on ${this.address}:${this.port}`);
        });
    }

    private initRouters(): void {
        this.initMainRouter();
    }
}
