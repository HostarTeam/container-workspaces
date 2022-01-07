import ContainerWorkspaces from '../../ContainerWorkspaces';
import { Router, Request, Response } from 'express';
import { readInitCommandsFile } from '../utils';
import { CommandError, CommandType } from '../typing/types';

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

    router.get('/initcommands', async (req: Request, res: Response) => {
        // const ip: string = req.ip;
        const initCommands = await readInitCommandsFile();
        res.send(initCommands);
    });

    router.post('/command/reporterror', (req: Request, res: Response) => {
        const {
            command,
            stderr,
            stdout,
            exitCode,
            stack,
            message,
        }: CommandError = req.body;
        const commandType = req.query.commandType as CommandType;
        if (!commandType)
            return res.status(400).send({
                message: 'commandType not specified',
                status: 'error',
            });
        if (!command)
            return res
                .status(400)
                .send({ message: 'command not specified', status: 'error' });
        if (!exitCode)
            return res
                .status(400)
                .send({ message: 'exitCode not specified', status: 'error' });

        res.send({ status: 'success', message: 'report received' });
    });

    router.post('/command/initsuccess', (req: Request, res: Response) => {
        res.send({ status: 'success', message: 'report received' });
    });
}
