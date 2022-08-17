import type { NextFunction, Request, Response } from 'express';
import ProxyManager from './ProxyManager';

export default function httpHandler(
    this: ProxyManager,
    req: Request,
    res: Response,
    next: NextFunction
): void {
    if (req.hostname === this.config.remoteAddress) {
        return next('router');
    }

    this.proxyHandler(req, res);
}
