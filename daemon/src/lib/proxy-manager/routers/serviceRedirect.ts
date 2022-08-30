import { NextFunction, Router } from 'express';
import { Request, Response } from 'express';
import { ProxyInfo } from '../common/types';
import { getProxyInfo } from '../common/utils';
import ProxyManager from '../ProxyManager';

export function initServiceRedirectRouter(this: ProxyManager): void {
    this.serviceRedirectRouter = Router();
    const router = this.serviceRedirectRouter;

    router.get('/_redirect', (req: Request, res: Response) => {
        const token = req.query['_pm_token'] as string;

        if (!token) return res.status(401).send('token not specified in query');

        if (!this.accessTokens.has(token))
            return res.status(401).send('invalid token');

        const proxyInfo: ProxyInfo = this.accessTokens.get(token);

        const { service, containerID } = getProxyInfo(req.hostname);
        if (
            service !== proxyInfo.service ||
            containerID !== proxyInfo.containerID
        )
            return res.send(401).send('invalid token');

        return res
            .cookie('pm-token', token, {
                expires: new Date(Date.now() + 1000 * 60 * 60 * 4), // 4 hours
            })
            .status(302)
            .redirect('/');
    });

    router.all('*', (req: Request, res: Response, next: NextFunction) => {
        const token = req.cookies?.['pm-token'];

        if (!token) return res.status(401).send('unauthorized');

        if (!this.accessTokens.has(token))
            return res.status(401).send('unauthorized');

        const proxyInfo: ProxyInfo = this.accessTokens.get(token);

        const { service, containerID } = getProxyInfo(req.hostname);
        if (
            service !== proxyInfo.service ||
            containerID !== proxyInfo.containerID
        )
            return res.status(401).send('unauthorized');

        next('router');
    });
}
