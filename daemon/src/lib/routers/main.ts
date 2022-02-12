import { Request, Response, Router } from 'express';
import ContainerWorkspaces from '../../ContainerWorkspaces';

export function initMainRouter(this: ContainerWorkspaces): void {
    this.mainRouter = Router();
    const router: Router = this.mainRouter;

    router.get('/', (req: Request, res: Response) => {
        res.send('hello');
    });
}
