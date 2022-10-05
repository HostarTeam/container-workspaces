import { Router } from 'express';
import { Request, Response } from 'express';
import ProxyManager from '../ProxyManager';

export function initProxyRouter(this: ProxyManager) {
    this.proxyRouter = Router();
    const router = this.proxyRouter;

    router.get('/redirect', (req: Request, res: Response) => {
        const token = req.query.token as string;

        if (!token) return res.status(400).send('token must be specified');

        if (!this.accessTokens.has(token))
            return res.status(400).send('invalid token');

        const { proxyInfo } = this.accessTokens.get(token);

        return res
            .status(302)
            .redirect(
                `${this.config.protocol}://${proxyInfo.service}-${
                    proxyInfo.containerID
                }.${this.config.wildcardBaseAddress}${
                    this.config.remotePort ? `:${this.config.remotePort}` : ''
                }/_redirect?_pm_token=${token}`
            );
    });
}
