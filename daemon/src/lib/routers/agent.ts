import ContainerWorkspaces from '../../ContainerWorkspaces';
import { Router, Request, Response } from 'express';

export function initAgentRouter(this: ContainerWorkspaces): void {
    this.agentRouter = Router();
    const router: Router = this.agentRouter;

    router.get('/', (req: Request, res: Response) => {
        res.send('hello');
    });

    router.post('/newct', (req: Request, res: Response) => {
        const password: string = req.body.password;
        const ip: string = req.ip;

        if (!password)
            return res.status(400).send({
                status: 'error',
                message: "password isn't specified in body",
            });
        res.send({ status: 'success' });
    });
}
