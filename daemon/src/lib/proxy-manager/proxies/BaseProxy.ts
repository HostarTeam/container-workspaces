import type { Request, Response } from 'express';
import { IncomingMessage } from 'http';
import { Duplex } from 'stream';
import ProxyManager from '../ProxyManager';

export interface ProxyOptions {
    host: string;
    port: number;
    containerID: number;
}

export default abstract class BaseProxy<
    T extends ProxyOptions | unknown = unknown,
    U = unknown
> {
    public abstract readonly authRequired: boolean;
    protected auth: U;

    constructor(protected config: T, protected pm: ProxyManager) {}

    public abstract handleFetch(req: Request, res: Response): Promise<void>;

    public initWebSocket(url: string): void {
        url;
        throw new Error('Method not implemented.');
    }

    public fetchAuth(): Promise<void> {
        throw new Error('Method not implemented.');
    }

    public handleHttpUpgrade(
        request: IncomingMessage,
        socket: Duplex,
        head: Buffer
    ): void {
        request;
        socket;
        head;
        throw new Error('Method not implemented.');
    }
}
