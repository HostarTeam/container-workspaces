import ContainerWorkspaces from '../../ContainerWorkspaces';
import { Router, Request, Response } from 'express';
import { generatePassword, requireBodyProps } from '../util/utils';
import serviceToPort from '../proxy-manager/common/serviceToPort';
import { ProxyInfo } from '../proxy-manager/common/types';
import ProxyManager from '../proxy-manager/ProxyManager';

export function initPMRouter(this: ContainerWorkspaces) {
    this.pmRouter = Router();
    const router: Router = this.pmRouter;
    const pm: ProxyManager = this.proxyManager;

    router.post(
        '/addcontaineraccess',
        requireBodyProps('containerID', 'service'),
        (req: Request, res: Response) => {
            const {
                containerID,
                service,
                duration = 4 * 60 * 60 * 1000, // 4 hours
            }: {
                containerID: string;
                service: keyof typeof serviceToPort;
                duration?: string | number;
            } = req.body;

            const containerIDNumber = parseInt(containerID);
            if (isNaN(containerIDNumber))
                return res
                    .status(400)
                    .send({ status: 'error', message: 'Invalid container ID' });

            if (typeof service !== 'string')
                return res.status(400).send({
                    status: 'error',
                    message: 'service must be a valid string',
                });
            // eslint-disable-next-line no-prototype-builtins
            else if (!serviceToPort.hasOwnProperty(service))
                return res.status(400).send({
                    status: 'error',
                    message: 'service must be an existing service',
                });

            const durationNumber = Number(duration);
            if (isNaN(durationNumber))
                return res.status(400).send({
                    status: 'error',
                    message: 'duration must be a valid number',
                });
            else if (durationNumber > 24 * 60 * 60 * 1000)
                return res.status(400).send({
                    status: 'error',
                    message: 'duration must be less than 24 hours',
                });

            const token: string = generatePassword(64);

            const proxyInfo: ProxyInfo = {
                containerID: containerIDNumber,
                service,
            };

            pm.addContainerAccess(proxyInfo, token, durationNumber);

            res.send({ status: 'ok', token });
        }
    );

    router.post(
        '/removecontaineraccess',
        requireBodyProps('token'),
        (req: Request, res: Response) => {
            const {
                token,
            }: {
                token: string;
            } = req.body;

            pm.removeContainerAccess(token);

            res.send({ status: 'ok' });
        }
    );
}
