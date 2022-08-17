import ProxyManager from '../ProxyManager';
import { Router, Request, Response } from 'express';

export function initializeApiRouter(this: ProxyManager) {
    const router: Router = Router();
    this.apiRouter = router;

    router.post('/addcontaineraccess', (req: Request, res: Response) => {
        const {
            token,
            containerID,
        }: {
            token: string;
            containerID: string;
        } = req.body;

        const containerIDNumber = parseInt(containerID);
        if (isNaN(containerIDNumber)) {
            res.status(400).send('Invalid container ID');
            return;
        }

        this.addContainerAccess(containerIDNumber, token);

        res.send({ status: 'ok' });
    });

    router.delete('/removecontaineraccess', (req: Request, res: Response) => {
        const {
            token,
        }: {
            token: string;
        } = req.body;

        this.removeContainerAccess(token);

        res.send({ status: 'ok' });
    });
}
