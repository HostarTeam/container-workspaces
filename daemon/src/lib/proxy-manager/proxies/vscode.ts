import { Request, Response } from 'express';
import fetch from 'node-fetch';
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
                        Cookie: `vscode-tkn=${this.auth}`,
                        Host: `${req.agentIP}:${this.config.port}`,
                    },
                    method: req.method,
                    ...(Object.keys(req.body).length > 0 && { body: req.body }),
                    follow: 0,
                }
            );

            let resp: unknown;
            if (proxyRes.headers.get('content-type').startsWith('image/')) {
                resp = await proxyRes.buffer();
            } else {
                resp = await proxyRes.text();
            }

            res.set(Object.fromEntries(proxyRes.headers.entries()));
            res.removeHeader('Set-Cookie');
            res.status(proxyRes.status);

            res.send(resp);
        } catch (err: unknown) {
            if (err instanceof Error) {
                res.status(500).send({
                    status: 'error',
                    message: `Error occurred while proxying request to VSCode server - ${err.message}`,
                });
            }
        }
    }

    public async fetchAuth(): Promise<void> {
        this.auth = await this.pm.cw.getVSCodePassword(
            this.config.containerID,
            this.config.host
        );
    }
}
