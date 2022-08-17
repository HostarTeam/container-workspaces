import type { Request, Response } from 'express';
import ProxyManager from '../ProxyManager';
import { getProxyInfo } from './utils';
import serviceToPort from './serviceToPort';

export default function validateProxy(
    this: ProxyManager,
    req: Request,
    res: Response
) {
    if (req.hostname === this.config.remoteAddress) {
        res.status(500).send({
            message: 'Request on PM base address was routed to proxy handler',
        });
        return false;
    }

    const proxyInfo = getProxyInfo(req.hostname);
    if (!proxyInfo) {
        res.status(500).send({
            message: 'Request on invalid host was routed to proxy handler',
        });
        return false;
    }

    const servicePort = serviceToPort[proxyInfo.service];
    if (!servicePort) {
        res.status(500).send({
            message: 'Invalid service specified on hostname',
        });
        return false;
    }

    return true;
}
