import ContainerWorkspaces from '../../ContainerWorkspaces';
import { Router, Request, Response } from 'express';

export function initMainRouter(this: ContainerWorkspaces): void {
    this.mainRouter = Router();
    const router: Router = this.mainRouter;

    router.get('/', (req: Request, res: Response) => {
        res.send('hello');
    });
}
