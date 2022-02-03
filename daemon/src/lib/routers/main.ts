import ContainerWorkspaces from '../../ContainerWorkspaces';
import { Router, Request, Response } from 'express';
import { Task } from '../typing/Task';
import { ClientNotFoundError } from '../ws/commandAgent';
import { MessageData } from '../typing/MessageData';

export function initMainRouter(this: ContainerWorkspaces): void {
    this.mainRouter = Router();
    const router: Router = this.mainRouter;

    router.get('/', (req: Request, res: Response) => {
        res.send('hello');
    });

    router.post(
        '/command/send/:ipaddr',
        async (req: Request, res: Response) => {
            const ipaddr: string = req.params.ipaddr;
            const data: MessageData = { ...req.body.data };
            const task: Task = new Task({ data, ipaddr });
            console.log('created new task: ', task.id);
            await this.addTask(task);

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
        }
    );
}
