import Slave from '../../Slave';
import { Router, Request, Response } from 'express';

export function initMainRouter(this: Slave): void {
    this.mainRouter = Router();
    const router: Router = this.mainRouter;

    router.get('/', (req: Request, res: Response) => {
        res.send('hello');
    });
}
