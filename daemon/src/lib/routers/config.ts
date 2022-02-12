import { NextFunction, Request, Response, Router } from 'express';
import ContainerWorkspaces from '../../ContainerWorkspaces';
import { Node, SQLIP, SQLNode } from '../typing/types';
import { requireBodyProps } from '../util/utils';
import { CTOptions } from '../typing/options';

export function initConfigRouter(this: ContainerWorkspaces): void {
    this.configRouter = Router();
    const router: Router = this.configRouter;

    /**
     * This route is used in order to get all available nodes.
     */
    router.get(
        '/nodes',
        async (req: Request, res: Response, next: NextFunction) => {
            const nodes: SQLNode[] = await this.proxmoxClient.getSQLNodes();

            res.send(nodes);
        }
    );

    /**
     * This route is used in order to add a PVE node to the available nodes in the databases.
     * @todo Make sure that the node exists on the pve cluster.
     */
    router.post(
        '/nodes/add',
        requireBodyProps('nodename', 'location', 'is_main'),
        async (req: Request, res: Response) => {
            const nodename = String(req.body.nodename);
            const location = String(req.body.location);
            const is_main = Boolean(req.body.is_main);

            const pveNode = await this.proxmoxClient.getPVENode(nodename);
            if (pveNode.existsInDatabase) {
                res.status(409).send({
                    status: 'conflict',
                    message: 'Node already exists in the database',
                });
            } else {
                const nodeIP = await this.proxmoxClient.getNodeIP(nodename);
                await this.proxmoxClient.addNodeToDatabase({
                    nodename,
                    is_main,
                    ip: nodeIP,
                    location,
                });
                res.status(201).send({
                    status: 'created',
                    message: 'Node added successfully',
                });
            }
        }
    );

    /**
     * This route is used in order to remove a PVE node from the available nodes in the databases.
     * @param {string} nodename The name of the node to remove in req.params.
     */
    router.delete(
        '/nodes/:nodeName',
        requireBodyProps('nodename'),
        async (req: Request, res: Response) => {
            const nodeName = String(req.params.nodeName);

            const sqlNode: SQLNode = await this.proxmoxClient.getSQLNode(
                nodeName
            );

            if (!sqlNode) {
                res.status(404).send({
                    status: 'not found',
                    message: 'Node not found in the database',
                });
            } else {
                await this.proxmoxClient.removeNodeFromDatabase(nodeName);
                res.send({
                    status: 'ok',
                    message: 'Node removed successfully',
                });
            }
        }
    );

    /**
     * This route is used in order to get all locations from the database.
     */
    router.get('/locations', async (req: Request, res: Response) => {
        const locations: string[] = await this.proxmoxClient.getLocations();
        res.send(locations);
    });

    /**
     * This route is used in order to get all available locations.
     */
    router.get('/locations/available', async (req: Request, res: Response) => {
        const locations: string[] =
            await this.proxmoxClient.getAvailableLocations();
        res.send(locations);
    });

    /**
     * This route is used in order to get all available ip addresses.
     */
    router.get('/ips', async (req: Request, res: Response) => {
        const ips: SQLIP[] = await this.proxmoxClient.getIPs();

        res.send(ips);
    });

    /**
     * This route is used in order to add a ip address to the available ip addresses in the databases.
     * @param {string} ipv4 The ipv4 address in req.body.
     * @param {string} gateway The gateway address in req.body.
     * @param {string} netmask The netmask address in req.body.
     */
    router.post(
        '/ips/add',
        requireBodyProps('ipv4', 'gateway', 'netmask'),
        async (req: Request, res: Response) => {
            const ipv4 = String(req.body.ipv4);
            const gateway = String(req.body.gateway);
            const netmask = String(req.body.netmask);

            const ip: SQLIP = await this.proxmoxClient.getIP(ipv4);
            if (ip) {
                res.status(409).send({
                    status: 'conflict',
                    message: 'IP already exists in the database',
                });
            } else {
                await this.proxmoxClient.addIPToDatabase({
                    ipv4,
                    gateway,
                    netmask,
                    used: false,
                });
                res.status(201).send({
                    status: 'created',
                    message: 'IP added successfully',
                });
            }
        }
    );

    /**
     * This route is used in order to add ipv4 addresses to the available ip addresses in the database in bulk on the same network.
     * @param {string[]} ipv4s The ipv4 addresses in req.body.
     * @param {string} gateway The gateway address in req.body.
     * @param {string} netmask The netmask address in req.body.
     */
    router.post(
        '/ips/addbulk',
        requireBodyProps('ipv4s', 'gateway', 'netmask'),
        async (req: Request, res: Response) => {
            const ipv4s: string[] = req.body.ipv4s;
            const gateway = String(req.body.gateway);
            const netmask = String(req.body.netmask);

            const ips: SQLIP['ipv4'][] = (
                await this.proxmoxClient.getIPs()
            ).map((ip) => ip.ipv4);

            const ipv4sToAdd: string[] = ipv4s.filter(
                (ipv4) => !ips.includes(ipv4)
            );

            if (ipv4sToAdd.length === 0) {
                res.status(409).send({
                    status: 'conflict',
                    message:
                        'No IPs to add, all IPs already exist in the database',
                });
            } else {
                for (const ipv4 of ipv4sToAdd) {
                    await this.proxmoxClient.addIPToDatabase({
                        ipv4,
                        gateway,
                        netmask,
                        used: false,
                    });
                }
                res.status(201).send({
                    status: 'created',
                    message: 'IPs added successfully',
                });
            }
        }
    );

    /**
     * This route is used in order to remove a ip address from the available ip addresses in the databases.
     * @param {string} ipv4 The ipv4 address in req.params
     */
    router.delete('/ips/:ipv4', async (req: Request, res: Response) => {
        const ipv4 = String(req.params.ipv4);

        const ip: SQLIP = await this.proxmoxClient.getIP(ipv4);
        if (!ip) {
            res.status(404).send({
                status: 'not found',
                message: 'IP not found in the database',
            });
        } else {
            await this.proxmoxClient.removeIPFromDatabase(ipv4);
            res.send({
                status: 'ok',
                message: 'IP removed successfully',
            });
        }
    });

    /**
     * This route is used in order to get the ct options
     */
    router.get('/ctoptions', async (req: Request, res: Response) => {
        const ctOptions: CTOptions = await this.getCTOptions();

        if (ctOptions) res.send(ctOptions);
        else
            res.send({
                status: 'error',
                message: 'Could not find ct options',
            });
    });

    /**
     * This route is used in order to update the ct options in the database
     * @param {CTOptions} CTOptions The ct options in req.body.
     */
    router.put(
        '/ctoptions',
        requireBodyProps('ct_options'),
        async (req: Request, res: Response) => {
            const ctOptions: CTOptions = req.body.ct_options;
            await this.udpateCTOptions(ctOptions);
            res.send({
                status: 'ok',
                message: 'CT options updated successfully',
            });
        }
    );

    /**
     * This route is used in order to get the init commands from the config table in the database.
     */

    router.get('/initcommands', async (req: Request, res: Response) => {
        const initCommands: string[] = await this.getInitCommands();

        res.send(initCommands);
    });

    /**
     * This route is used in order to update the init commands in the database.
     * @param {string[]} initCommands The init commands in req.body.
     */
    router.put('/initcommands', async (req: Request, res: Response) => {
        const initCommands: string[] = req.body.init_commands;
        await this.updateInitCommands(initCommands);
        res.send({
            status: 'ok',
            message: 'Init commands updated successfully',
        });
    });
}
