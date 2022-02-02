import ContainerWorkspaces from '../../ContainerWorkspaces';
import { Router, Request, Response } from 'express';
import { Task } from '../typing/Task';
import { ClientNotFoundError } from '../ws/commandAgent';

export function initMainRouter(this: ContainerWorkspaces): void {
    this.mainRouter = Router();
    const router: Router = this.mainRouter;

    router.get('/', (req: Request, res: Response) => {
        res.send('hello');
    });

    router.post('/command/send/:ipaddr', (req: Request, res: Response) => {
        const ipaddr: string = req.params.ipaddr;

        const bodyTask: Task = { ...req.body };
        delete bodyTask.id;
        bodyTask.ipaddr = ipaddr;

        const task: Task = new Task(bodyTask);
        try {
            this.sendCommandToAgent(task);
            res.send({ status: 'ok' });
        } catch (err: unknown) {
            if (err instanceof ClientNotFoundError) {
                res.status(404).send({
                    status: 'not found',
                    message: 'could not find client with give ip address',
                });
            } else if (err instanceof Error) {
                res.status(500).send({
                    status: 'error',
                    message: err.message,
                });
                this.httpLogger.error(err.message);
            }
        }
    });
}
