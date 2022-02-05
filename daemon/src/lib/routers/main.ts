import { NextFunction, Request, Response, Router } from 'express';
import ContainerWorkspaces from '../../ContainerWorkspaces';
import { MessageData } from '../typing/MessageData';
import { Task } from '../typing/Task';
import { ActionResult, ContainerStatus, LXC } from '../typing/types';
import { requireBodyProps, validatePassword } from '../utils';
import { ClientNotFoundError } from '../ws/commandAgent';

export function initMainRouter(this: ContainerWorkspaces): void {
    this.mainRouter = Router();
    const router: Router = this.mainRouter;

    router.get('/', (req: Request, res: Response) => {
        res.send('hello');
    });

    /**
     * @param {string} containerID
     * This route is used in order to assure the validity of the given containerID param.
     * This route then forwards the requests to the next routes.
     */
    router.all(
        '/container/:containerID*',
        async (req: Request, res: Response, next: NextFunction) => {
            if (isNaN(Number(req.params.containerID))) return next();
            const containerID: number = Number(req.params.containerID);
            const agentIP: string = await this.proxmoxClient.getContainerIP(
                containerID
            );

            const ipValid: boolean = await this.checkIP(agentIP);

            if (!agentIP) {
                res.status(404).send({
                    status: 'not foud',
                    message: 'Could not find container with such ID',
                });
            } else if (!ipValid) {
                res.status(406).send({
                    status: 'not acceptable',
                    message:
                        'Specified ID belongs to a container which is not managed by our services',
                });
            } else {
                req.agentIP = agentIP;
                next();
            }
        }
    );

    /**
     * @param {string} containerID
     * This route is used in order to get the current configuration of a container.
     */
    router.get(
        '/container/:containerID',
        async (req: Request, res: Response) => {
            const containerID: number = Number(req.params.containerID);
            const container: LXC = await this.proxmoxClient.getContainerInfo(
                containerID
            );

            res.send(container);
        }
    );

    /**
     * @param {string} containerID
     * This route is used in order to get the current status of a container.
     */
    router.get(
        '/container/:containerID/status',
        async (req: Request, res: Response) => {
            const containerID: number = Number(req.params.containerID);
            const status: ContainerStatus =
                await this.proxmoxClient.getContainerStatus(containerID);

            res.send(status);
        }
    );

    /**
     * @param {string} containerID
     * This route is used in order to execute a command or multiple commands on a container.
     */
    router.post(
        '/container/:containerID/exec',
        async (req: Request, res: Response) => {
            const containerID: number = Number(req.params.containerID);
            const data: MessageData = { ...req.body.data };
            const agentIP: string = req.agentIP;

            const task: Task = new Task({ data, containerID });

            try {
                await this.sendTaskToAgent(task, agentIP);
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

    /**
     * @param {string} containerID
     * This route is used in order to start a container.
     */
    router.post(
        '/container/:containerID/start',
        async (req: Request, res: Response) => {
            await this.triggerStatusChange(req, res, 'start');
        }
    );

    /**
     * @param {string} containerID
     * This route is used in order to stop a container.
     */
    router.post(
        '/container/:containerID/stop',
        async (req: Request, res: Response) => {
            await this.triggerStatusChange(req, res, 'stop');
        }
    );

    /**
     * @param {string} containerID
     * This route is used in order to restart a container.
     */
    router.post(
        '/container/:containerID/restart',
        async (req: Request, res: Response) => {
            await this.triggerStatusChange(req, res, 'reboot');
        }
    );

    /**
     * @param {string} containerID
     * This route is used in order to get the last 100 lines of a contrainer's agent logs.
     */
    router.get(
        '/container/:containerID/logs',
        async (req: Request, res: Response) => {
            const containerID: number = Number(req.params.containerID);
            const agentIP: string = req.agentIP;

            const connectedAgent = this.getConnectedClient(agentIP);

            if (!connectedAgent) {
                res.status(409).send({
                    status: 'conflict',
                    message:
                        'Container with given ID is not connected to this server',
                });
            } else {
                const last100lines = await this.getLogs(containerID, agentIP);
                if (last100lines)
                    res.send({ status: 'ok', data: last100lines });
                else
                    res.status(409).send({
                        status: 'conflict',
                        message: 'no logs found',
                    });
            }
        }
    );

    /**
     * @param {string} containerID
     * @param {string} password The new password of the container in req.body.
     * This route is used in order to change the password of a container.
     */
    router.put(
        '/container/:containerID/changepassword',
        async (req: Request, res: Response) => {
            const containerID: number = Number(req.params.containerID);
            const agentIP: string = req.agentIP;

            const connectedAgent = this.getConnectedClient(agentIP);

            if (!connectedAgent) {
                res.status(409).send({
                    status: 'conflict',
                    message:
                        'Container with given ID is not connected to this server',
                });
            } else {
                const newPassword = req.body.password;

                // Not necessarily executed successfully
                const sentSuccessfully = await this.changeContainerPassword(
                    containerID,
                    newPassword
                );
                if (sentSuccessfully) res.send({ status: 'ok' });
                else
                    res.status(409).send({
                        status: 'conflict',
                        message: 'could not change password',
                    });
            }
        }
    );

    /**
     * @param {string} containerID
     * This route is used in order to delete a container.
     */
    router.delete(
        '/container/:containerID/',
        async (req: Request, res: Response) => {
            const containerID: number = Number(req.params.containerID);

            const deleted: ActionResult =
                await this.proxmoxClient.deleteContainer(
                    containerID,
                    req.agentIP
                );
            if (deleted.ok) res.send({ status: 'ok' });
            else
                res.status(409).send({
                    status: 'conflict',
                    message: 'could not delete container',
                    error: deleted.error,
                });
        }
    );

    /**
     * @param {string} containerID
     * @param {string} location The location of the container in req.body.
     * @param {string} template The template of the container in req.body.
     * @param {string} password The password of the container in req.body.
     * Thie route is used in order to create a container.
     */
    router.post(
        '/container/create',
        requireBodyProps('location', 'template', 'password'),
        async (req: Request, res: Response) => {
            const location = String(req.body.location);
            const template = String(req.body.template);
            const password = String(req.body.password);

            const passwordValid: boolean = validatePassword(password);
            if (!passwordValid) {
                return res.status(400).send({
                    status: 'bad request',
                    message:
                        'password is not valid, it must be between 5 and 100 characters long',
                });
            }

            const created = await this.proxmoxClient.createContainer({
                location,
                template,
                password,
            });

            if (created.ok) res.send({ status: 'ok' });
            else
                res.status(409).send({
                    status: 'conflict',
                    message: 'could not create container',
                    error: created.error,
                });
        }
    );
}
