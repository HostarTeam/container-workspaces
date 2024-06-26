import { Request, Response } from 'express';
import { IncomingMessage } from 'http';
import { createProxy } from 'http-proxy';
import fetch from 'node-fetch';
import { Duplex } from 'stream';
import ProxyManager from '../ProxyManager';
import BaseProxy, { ProxyOptions } from './BaseProxy';

export default class VSCodeProxy extends BaseProxy<ProxyOptions, string> {
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
                        cookie: `vscode-tkn=${this.auth}`,
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
                    message: `Error occurred while proxying request to VSCode server - ${err.message}`,
                });
            }
        }
    }

    public async fetchAuth(): Promise<void> {
        this.auth = await this.pm.cw.getServiceAuth<string>(
            this.config.containerID,
            this.config.host,
            'vscode'
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
                Cookie: `vscode-tkn=${this.auth}`,
            },
        });

        proxy.ws(request, socket, head, null, () => null);
    }
}
