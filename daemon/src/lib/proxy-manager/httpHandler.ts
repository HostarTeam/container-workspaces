import type { NextFunction, Request, Response } from 'express';
import ProxyManager from './ProxyManager';

export default function httpHandler(
    this: ProxyManager,
    req: Request,
    res: Response,
    next: NextFunction
): void {
    // TODO: Handle API auth
    if (req.hostname === this.config.remoteAddress) {
        return next('router');
    }

    // TODO: Handle proxy auth
    this.proxyHandler(req, res);
}
