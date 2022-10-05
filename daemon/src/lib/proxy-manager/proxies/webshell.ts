import { Request, Response } from 'express';
import { IncomingMessage } from 'http';
import { createProxy } from 'http-proxy';
import fetch from 'node-fetch';
import { Duplex } from 'stream';
import ProxyManager from '../ProxyManager';
import BaseProxy, { ProxyOptions } from './BaseProxy';

export default class WebShellProxy extends BaseProxy<ProxyOptions, string> {
    public authRequired = true;
    constructor(config: ProxyOptions, pm: ProxyManager) {
        super(config, pm);
        // this.initWebSocket(`ws://${this.config.host}:${this.config.port}/ws`);
    }

    public async handleFetch(req: Request, res: Response): Promise<void> {
        try {
            const proxyRes = await fetch(
                `http://${this.config.host}:${this.config.port}${req.url}`,
                {
                    headers: {
                        ...Object(req.headers),
                        accept: '*/*',
                        'upgrade-insecure-requests': '1',
                        authorization: `bearer ${this.auth}`,
                        host: `${req.agentIP}:${this.config.port}`,
                    },
                    method: req.method,
                    ...(Object.keys(req.body).length > 0 && { body: req.body }),
                    follow: 0,
                }
            );

            if (proxyRes.status === 401) {
                await this.fetchAuth();
                return await this.handleFetch(req, res);
            }

            res.set(Object.fromEntries(proxyRes.headers.entries()));
            res.status(proxyRes.status);
            proxyRes.body.pipe(res);
        } catch (err: unknown) {
            if (err instanceof Error && !res.headersSent) {
                res.status(500).send({
                    status: 'error',
                    message: `Error occurred while proxying request to WebShell server - ${err.message}`,
                });
            }
        }
    }

    public async fetchAuth(): Promise<void> {
        this.auth = await this.pm.cw.getServiceAuth<string>(
            this.config.containerID,
            this.config.host,
            'webshell'
        );
    }

    public handleHttpUpgrade(
        request: IncomingMessage,
        socket: Duplex,
        head: Buffer
    ): void {
        const proxy = createProxy({
            target: `ws://${this.config.host}:${this.config.port}${request.url}`,
            headers: {
                authorization: `bearer ${this.auth}`,
            },
        });

        proxy.ws(request, socket, head, null, () => null);
    }
}
