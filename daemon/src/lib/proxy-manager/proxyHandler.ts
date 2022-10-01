import type { Request, Response } from 'express';
import ProxyManager from './ProxyManager';
import { getProxyInfo } from './common/utils';
import serviceToPort from './common/serviceToPort';

export default async function proxyHandler(
    this: ProxyManager,
    req: Request,
    res: Response
) {
    const valid = this.validateProxy(req, res);
    if (!valid) return;

    const proxyInfo = getProxyInfo(req.hostname);

    const targetAddress = await this.cw.proxmoxClient.getContainerIP(
        proxyInfo.containerID
    );

    if (!targetAddress) {
        return res.status(404).send({
            message: 'No such container',
        });
    }

    const targetConnected = this.cw.getConnectedClient(targetAddress);

    if (!targetConnected) {
        res.status(409).send({
            status: 'conflict',
            message: 'Container with given ID is not connected to this server',
        });
    }

    const token: string = req.cookies['pm-token'];
    let proxyClient = this.containerProxyClient.get(token);
    if (!proxyClient) {
        proxyClient = new this.proxyClients[proxyInfo.service](
            {
                host: targetAddress,
                port: serviceToPort[proxyInfo.service],
                containerID: proxyInfo.containerID,
            },
            this
        );
        if (proxyClient.authRequired) {
            await proxyClient.fetchAuth();
        }

        this.containerProxyClient.set(token, proxyClient);
    }

    proxyClient.handleFetch(req, res);
}
