import { NextFunction, Request, Response, Router } from 'express';
import ContainerWorkspaces from '../../ContainerWorkspaces';
import { MessageData } from '../typing/MessageData';
import { Task } from '../typing/Task';
import { ActionResult, ContainerStatus, LXC } from '../typing/types';
import { requireBodyProps, validatePassword } from '../utils';
import { ClientNotFoundError } from '../ws/commandAgent';

export function initContainerRouter(this: ContainerWorkspaces): void {
    this.containerRouter = Router();
    const router: Router = this.containerRouter;

    /**
     * This route is used to get the current configuration of all containers.
     */
    router.get('/', async (req: Request, res: Response) => {
        const containers: LXC[] = await this.proxmoxClient.getContainers();
        res.send(containers);
    });

    /**
     * This route is used to get the current status of all containers.
     */
    router.get('/status', async (req: Request, res: Response) => {
        const containerStatuses: ContainerStatus[] =
            await this.proxmoxClient.getContainerStatuses();
        res.send(containerStatuses);
    });

    /**
     * @param {string} containerID
     * This route is used in order to get the current configuration of a container.
     */
    router.get(
        '/:containerID',
        this.getContainerIP(),
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
        '/:containerID/status',
        this.getContainerIP(),
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
        '/:containerID/exec',
        requireBodyProps('commands'),
        this.getContainerIP(),
        async (req: Request, res: Response) => {
            const containerID: number = Number(req.params.containerID);
            const commands: string[] = req.body.commands;
            const data: MessageData = {
                action: 'shell_exec',
                args: {
                    commands,
                },
            };

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
    router.patch(
        '/:containerID/start',
        this.getContainerIP(),
        async (req: Request, res: Response) => {
            await this.triggerStatusChange(req, res, 'start');
        }
    );

    /**
     * @param {string} containerID
     * This route is used in order to shutdown a container.
     */
    router.patch(
        '/:containerID/shutdown',
        this.getContainerIP(),
        async (req: Request, res: Response) => {
            await this.triggerStatusChange(req, res, 'shutdown');
        }
    );

    /**
     * @param {string} containerID
     * This route is used in order to stop a container.
     */
    router.patch(
        '/:containerID/stop',
        this.getContainerIP(),
        async (req: Request, res: Response) => {
            await this.triggerStatusChange(req, res, 'stop');
        }
    );

    /**
     * @param {string} containerID
     * This route is used in order to restart a container.
     */
    router.patch(
        '/:containerID/restart',
        this.getContainerIP(),
        async (req: Request, res: Response) => {
            await this.triggerStatusChange(req, res, 'reboot');
        }
    );

    /**
     * @param {string} containerID
     * This route is used in order to get the last 100 lines of a contrainer's agent logs.
     */
    router.get(
        '/:containerID/logs',
        this.getContainerIP(),
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
        '/:containerID/changepassword',
        requireBodyProps('password'),
        this.getContainerIP(),
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
                const newPassword = String(req.body.password);

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
        '/:containerID',
        this.getContainerIP(),
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
        '/',
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

            if (created.ok) res.status(201).send({ status: 'created' });
            else
                res.status(409).send({
                    status: 'conflict',
                    message: 'could not create container',
                    error: created.error,
                });
        }
    );
}
