import ContainerWorkspaces from '../../ContainerWorkspaces';
import { Router, Request, Response, NextFunction } from 'express';
import { CommandError } from '../typing/types';

export function initAgentRouter(this: ContainerWorkspaces): void {
    this.agentRouter = Router();
    const router: Router = this.agentRouter;

    router.all('*', async (req: Request, res: Response, next: NextFunction) => {
        const validIP = this.checkIP(req.ip);
        if (validIP) next();
        else {
            res.status(403).send({
                status: 'forbidden',
                message: 'IP not allowed',
            });
        }
    });

    router.get('/initcommands', async (req: Request, res: Response) => {
        const initCommands = await this.getInitCommands();
        res.send(initCommands);
    });

    router.post('/reporterror', (req: Request, res: Response) => {
        const { command, stderr, stdout, exitCode, message }: CommandError =
            req.body;
        if (!command)
            return res
                .status(400)
                .send({ message: 'command not specified', status: 'error' });
        if (!exitCode)
            return res
                .status(400)
                .send({ message: 'exitCode not specified', status: 'error' });

        this.httpLogger.error(
            `Error report - ${command} - ${message} - Exit code: ${exitCode} - Stdout: ${stdout} - Stderr: ${stderr}`
        );
        res.send({ status: 'ok', message: 'report received' });
    });

    router.patch('/inithostname', async (req: Request, res: Response) => {
        const agentIP = req.ip;
        const containerID = await this.getContainerID(agentIP);
        if (!containerID)
            return res.status(403).send({
                status: 'forbidden',
                message: 'Your IP is not allowed',
                hostname: null,
            });

        await this.proxmoxClient.changeCTHostname(
            containerID,
            containerID.toString()
        );
        res.send({ hostname: containerID.toString(), status: 'ok' });
    });
}
