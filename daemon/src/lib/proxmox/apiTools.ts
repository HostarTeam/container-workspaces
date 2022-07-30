import fetch, { RequestInit, Response } from 'node-fetch';
import ProxmoxConnection from './ProxmoxConnection';
import { netmaskToCIDR, printError } from '../util/utils';
import {
    ActionResult,
    Backup,
    ClusterNode,
    ContainerStatus,
    LXC,
    Node,
    ProxmoxResponse,
    Snapshot,
    status,
    Storage,
    VMResource,
} from '../typing/types';
import { CreateCTOptions, CTHardwareOptions } from '../typing/options';
import SQLNode from '../entities/SQLNode';
import CT from '../entities/CT';
import SQLIP from '../entities/SQLIP';

/**
 * Call the proxmox API with options and return the response data.
 * @template T
 * @async
 * @param {string} path
 * @param {string} method
 * @param {any} [body=null]
 * @returns {Promise<ProxmoxResponse<T>>}
 */
export async function call<T>(
    this: ProxmoxConnection,
    path: string,
    method: string,
    /*eslint-disable */
    body: any = null
    /*eslint-enable */
): Promise<ProxmoxResponse<T>> {
    const options: RequestInit = {
        headers: {
            Accept: 'application/json',
            Authorization: `PVEAuthCookie=${this.authCookie}`,
        },
        method: method,
    };
    let urlParams = null;

    if (this.protocol === 'https' && !this.verifyCertificate)
        options['agent'] = this.httpsAgent;
    if (['POST', 'PUT', 'DELETE'].includes(method.toUpperCase()))
        options.headers['CSRFPreventionToken'] = this.csrfPreventionToken;
    if (body && method.toUpperCase() === 'GET') {
        urlParams = new URLSearchParams(body);
    } else if (body) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }

    try {
        const res: Response = await fetch(
            `${this.basicURL}/${path}${urlParams ? `?${urlParams}` : ''}`,
            options
        );
        if (res.status == 401) {
            this.pveLogger.warn(
                `${method.toUpperCase()} - ${path} - ${res.status}`
            );
            await this.getAuthKeys();
            return await this.call(path, method, body);
        }
        this.pveLogger.info(
            `${method.toUpperCase()} - ${path} - ${res.status}`
        );
        const jsonRes = await res.json();
        return jsonRes;
    } catch (err) {
        this.pveLogger.error(
            `${method.toUpperCase()} - ${path} - ${
                err.message || 'no error message'
            }`
        );
        throw err;
    }
}

/**
 * Get all the nodes in the database.
 * @async
 * @returns {Promise<Node[]>}
 */
export async function getNodes(this: ProxmoxConnection): Promise<Node[]> {
    const { data: PVENodes } = await this.call<Node[]>('nodes', 'GET');
    const sql = 'SELECT nodename FROM nodes';
    const SQLNodes: SQLNode[] = SQLNode.fromObjects(
        await this.mySQLClient.getQueryResult(sql)
    );
    const SQLNodenames: string[] = SQLNodes.map((node) => node.nodename);
    const nodes = PVENodes.filter((node) => SQLNodenames.includes(node.node));
    return nodes;
}

/**
 * Get a node in the PVE cluster and return it and whether it exists in the database.
 * @async
 * @param  {string} nodename
 * @returns {Promise<{node: Node, exists: boolean}>}
 */
export async function getPVENode(
    this: ProxmoxConnection,
    nodename: string
): Promise<{ node: Node; existsInDatabase: boolean }> {
    const nodes = await this.getNodes();
    const node = nodes.find((node) => node.node === nodename);
    const sql = 'SELECT nodename FROM nodes WHERE nodename = ?';
    const existsInDatabase = !!this.mySQLClient.getFirstQueryResult(
        sql,
        nodename
    );
    return { node, existsInDatabase };
}

/**
 * Get all the nodes saved in the database.
 * @async
 * @returns {Promise<SQLNode[]>}
 */
export async function getSQLNodes(this: ProxmoxConnection): Promise<SQLNode[]> {
    const sql = 'SELECT * FROM nodes';
    const res: SQLNode[] = SQLNode.fromObjects(
        await this.mySQLClient.getQueryResult(sql)
    );
    if (res.length < 1) return null;
    return res;
}

/**
 * Get a node saved in the database.
 * @async
 * @param  {string} nodename
 * @returns {Promise<SQLNode>}
 */
export async function getSQLNode(
    this: ProxmoxConnection,
    nodename: string
): Promise<SQLNode> {
    const sql = 'SELECT * FROM nodes WHERE nodename = ?';
    const node: SQLNode = SQLNode.fromObject(
        await this.mySQLClient.getFirstQueryResult(sql, nodename)
    );
    if (!node) return null;
    node.is_main = !!node.is_main;
    return node;
}

/**
 * Add a node to the database.
 * @async
 * @param  {SQLNode} node
 * @returns {Promise<void>}
 */
export async function addNodeToDatabase(
    this: ProxmoxConnection,
    node: SQLNode
): Promise<void> {
    const sql =
        'INSERT INTO nodes (nodename, is_main ip, location) VALUES (?, ?, ?, ?)';
    await this.mySQLClient.executeQuery(sql, [
        node.nodename,
        node.is_main ? 1 : 0,
        node.ip,
        node.location,
    ]);
}

/**
 * Remove a node from the database.
 * @async
 * @param  {string} nodename
 * @returns {Promise<void>}
 */
export async function removeNodeFromDatabase(
    this: ProxmoxConnection,
    nodename: string
): Promise<void> {
    const sql = 'DELETE FROM nodes WHERE nodename = ?';
    await this.mySQLClient.executeQuery(sql, [nodename]);
}

/**
 * Get all the locations from the nodes table in the database
 * @async
 * @returns {Promise<string[]>}
 */
export async function getLocations(this: ProxmoxConnection): Promise<string[]> {
    const sql = 'SELECT DISTINCT location FROM nodes';
    const res: SQLNode[] = SQLNode.fromObjects(
        await this.mySQLClient.getQueryResult(sql)
    );

    return res.map((node: SQLNode) => node.location);
}

/**
 * Get all locations where there are fine nodes
 * @async
 * @returns {Promise<string[]>}
 */
export async function getAvailableLocations(
    this: ProxmoxConnection
): Promise<string[]> {
    const availableLocations: string[] = [];
    const nodes = await this.getNodes();
    for (const node of nodes) {
        const sqlNode = await this.getSQLNode(node.node);
        if (
            sqlNode &&
            !availableLocations.includes(sqlNode.location) &&
            this.returnIfNodeIsFine(node.node)
        ) {
            availableLocations.push(sqlNode.location);
        }
    }
    return availableLocations;
}

/**
 * Receive the auth keys from the PVE api and store them on the class.
 * @async
 * @returns {Promise<void>}
 */
export async function getAuthKeys(this: ProxmoxConnection): Promise<void> {
    try {
        const options: RequestInit = { method: 'POST' };

        if (this.protocol === 'https' && !this.verifyCertificate)
            options['agent'] = this.httpsAgent;

        const username = `${this.username}@pam`,
            password = this.password;
        const res: Response = await fetch(
            `${this.basicURL}/access/ticket?username=${username}&password=${password}`,
            options
        );
        const { data } = await res.json();
        this.authCookie = data.ticket;
        this.csrfPreventionToken = data.CSRFPreventionToken;
    } catch (error) {
        this.pveLogger.fatal(`Can't connect to the pve server`);
        printError(error);
        throw Error("Can't connect to server");
    }
}

/**
 * Delete a container from the database.
 * @async
 * @param  {number} id
 * @returns {Promise<void>}
 */
export async function deleteContainerFromDB(
    this: ProxmoxConnection,
    id: number
): Promise<void> {
    const sql = 'DELETE FROM cts WHERE id = ?';
    await this.mySQLClient.executeQuery(sql, [id]);
}

/**
 * Delete a container from the PVE node and from the database.
 * @async
 * @param  {number} id
 * @param  {string} ipv4
 * @returns {Promise<ActionResult>}
 */
export async function deleteContainer(
    this: ProxmoxConnection,
    id: number,
    ipv4: string
): Promise<ActionResult> {
    try {
        const node: string = await this.getNodeOfContainer(id);
        const deletedRes = await this.call(
            `nodes/${node}/lxc/${id}?force=1`,
            'DELETE'
        );
        const ip: SQLIP = await this.getIP(ipv4);
        await this.updateIPUsedStatus(ip, false);
        await this.deleteContainerFromDB(id);
        if (deletedRes && deletedRes.data && !deletedRes.errors)
            return { error: null, ok: true };
        this.pveLogger.error(
            `LXC container could not be deleted - ${deletedRes.errors.join(
                ' - '
            )}`
        );
        return { error: 'Could not delete container in proxmox', ok: false };
    } catch (error) {
        this.pveLogger.error(`Can't delete container ${id} - ${error.message}`);
        return { error: error.message, ok: false };
    }
}

/**
 * Get an ip which is not used from the database.
 * @async
 * @returns {Promise<SQLIP | null>}
 */
export async function getFreeIP(
    this: ProxmoxConnection
): Promise<SQLIP | null> {
    const sql = `SELECT * FROM ips WHERE used = 0 LIMIT 1`;
    const result: SQLIP = SQLIP.fromObject(
        await this.mySQLClient.getFirstQueryResult(sql)
    );
    if (!result) return null;
    return result;
}

/**
 * Get all ips saved in the database.
 * @async
 * @returns {Promise<SQLIP[]>}
 */
export async function getIPs(this: ProxmoxConnection): Promise<SQLIP[]> {
    const sql = 'SELECT * FROM ips';
    const res: SQLIP[] = SQLIP.fromObjects(
        await this.mySQLClient.getQueryResult(sql)
    );
    if (!res) return null;
    return res;
}

/**
 * Add an ip to the database.
 * @async
 * @param  {SQLIP} ip
 * @returns {Promise<void>}
 */
export async function addIPToDatabase(
    this: ProxmoxConnection,
    ip: SQLIP
): Promise<void> {
    const sql =
        'INSERT INTO ips (ipv4, gateway, netmask, used) VALUES (?, ?, ?, ?)';
    await this.mySQLClient.executeQuery(sql, [
        ip.ipv4,
        ip.gateway,
        ip.netmask,
        ip.used ? 1 : 0,
    ]);
}

/**
 * Remove an ip from the database.
 * @async
 * @param  {string} ipv4
 * @returns {Promise<void>}
 */
export async function removeIPFromDatabase(
    this: ProxmoxConnection,
    ipv4: string
): Promise<void> {
    const sql = 'DELETE FROM ips WHERE ipv4 = ?';
    await this.mySQLClient.executeQuery(sql, [ipv4]);
}

/**
 * Get an SQLIP from the database based on its ipv4.
 * @async
 * @param  {string} ipv4
 * @returns {Promise<SQLIP | null>}
 */
export async function getIP(
    this: ProxmoxConnection,
    ipv4: string
): Promise<SQLIP | null> {
    const sql = `SELECT * FROM ips WHERE ipv4 = ?`;
    const result: SQLIP = SQLIP.fromObject(
        await this.mySQLClient.getFirstQueryResult(sql, [ipv4])
    );

    return result; // Return value null if no IP was found
}

/**
 * Update an ip's 'used' field in the database.
 * @async
 * @param  {SQLIP} ip
 * @param  {boolean} status
 * @returns {Promise<void>}
 */
export async function updateIPUsedStatus(
    this: ProxmoxConnection,
    ip: SQLIP,
    status: boolean
): Promise<void> {
    const sql = `UPDATE ips SET used = ? WHERE ipv4 = ?`;
    await this.mySQLClient.executeQuery(sql, [Number(status), ip.ipv4]);
}

/**
 * Create a container on a PVE node based on a location.
 * @async
 * @param {CreateCTOptions} options
 * @param  {string} options.location
 * @param  {string} options.template
 * @param  {string} options.password
 * @returns {Promise<ActionResult>}
 */
export async function createContainer(
    this: ProxmoxConnection,
    { location, template, password }: CreateCTOptions
): Promise<ActionResult<{ ip: string; id: number } | null>> {
    const config = this.cw.getConfig();

    const node = await this.getNodeByLocation(location);
    const options = config['ct_options'];
    const ip = await this.getFreeIP();
    if (!ip) {
        this.pveLogger.error(`Could not find free ip while creating container`);
        return { error: 'Could not find free IP', ok: false };
    }
    await this.updateIPUsedStatus(ip, true);
    return await this.createContainerInProxmox({
        options,
        node,
        template,
        ip,
        password,
    });
}

/**
 * Create a container on a PVE node based on a node.
 * @async
 * @param  {Object} obj
 * @param  {string} obj.options
 * @param  {string} obj.node
 * @param  {string} obj.template
 * @param  {string} obj.ip
 * @param  {string} obj.password
 * @returns {Promise<ActionResult>}
 */
export async function createContainerInProxmox(
    this: ProxmoxConnection,
    {
        options,
        node,
        template,
        ip,
        password,
    }: {
        options: CTHardwareOptions;
        node: string;
        template: string;
        ip: SQLIP;
        password: string;
    }
): Promise<ActionResult<{ ip: string; id: number } | null>> {
    try {
        const nextIDRes = await this.call<string>('cluster/nextid', 'GET');
        const nextID: string = nextIDRes.data;
        if (!nextID) {
            this.pveLogger.error(`Couldn't find LXC container ID`);
            return { error: `Couldn't find LXC container ID`, ok: false };
        }

        const body: LXC = {
            ostemplate: template, // template for example: 'local:vztmpl/debian-9.0-amd64-standard_9.0-3_amd64.tar.gz'
            vmid: Number(nextID),
            cores: options.ct_cores,
            description: 'Created by the API',
            hostname: `${this.cw.protocol}491500${this.cw.remoteAddress}491500${this.cw.remotePort}`,
            password,
            rootfs: `local-lvm:${options.ct_disk}`,
            memory: options.ct_ram,
            swap: options.ct_swap,
            net0: `name=eth0,bridge=vmbr0,firewall=1,gw=${ip.gateway},ip=${
                ip.ipv4
            }/${netmaskToCIDR(ip.netmask)},type=veth`,
            start: true,
        };
        const res = await this.call(`nodes/${node}/lxc`, 'POST', body);
        if (res.data && !res.errors) {
            this.pveLogger.info(
                `LXC container with ID ${nextID} has been created successfully`
            );
            await this.addCotainerToDatabase(Number(nextID), ip.ipv4);
            return {
                error: null,
                ok: true,
                data: { ip: ip.ipv4, id: Number(nextID) },
            };
        }
        this.pveLogger.error(
            `LXC container could not be created - ${res.errors.join(' - ')}`
        );
        return { error: 'Could not create container in proxmox', ok: false };
    } catch (err) {
        this.pveLogger.error('Could not create a LXC container');
        return { error: err.message, ok: false };
    }
}

/**
 * Add a container to the database.
 * @async
 * @param  {number} id
 * @param  {string} ipv4
 * @returns {Promise<void>}
 */
export async function addCotainerToDatabase(
    this: ProxmoxConnection,
    id: number,
    ipv4: string
): Promise<void> {
    const sql = `INSERT INTO cts (id, ipv4) VALUES (?, ?)`;
    await this.mySQLClient.executeQuery(sql, [id, ipv4]);
}

/**
 * Get the ip of a PVE node based on its name.
 * @async
 * @param  {string} node
 * @returns {Promise<string>}
 */
export async function getNodeIP(
    this: ProxmoxConnection,
    node: string
): Promise<string> {
    const { data }: { data?: ClusterNode[] } = await this.call(
        'cluster/status',
        'GET'
    );

    if (!data) return null;

    return data.find((x) => x.name == node).ip;
}

/**
 * Check if a node is fine.
 * @async
 * @param  {string} nodename
 * @returns {Promise<boolean>}
 */
export async function returnNodeIfFine(
    this: ProxmoxConnection,
    nodename: string
): Promise<Node | null> {
    const nodes: Node[] = await this.getNodes();
    const node: Node = nodes.find((x) => x.node == nodename);
    if (node) {
        if (node.type !== 'node') return null;
        if (node.status == 'offline' || node.status == 'unknown') return null;
        if (node.cpu * 100 > 90) return null;
        if ((node.mem / node.maxmem) * 100 > 90) return null;
        if ((node.disk / node.maxdisk) * 100 > 90) return null;
        return node;
    }
    return null;
}

/**
 * Get the first fine node in the cluster
 * @async
 * @param  {SQLNode[]} nodes
 * @returns {Promise<string>}
 */
export async function getFirstFineNode(
    this: ProxmoxConnection,
    nodes: SQLNode[]
): Promise<string | null> {
    const fineNodesAsPromises: Promise<Node | null>[] = [];
    for (const node of nodes) {
        fineNodesAsPromises.push(this.returnIfNodeIsFine(node.nodename));
    }

    const filteredNodes: Node[] = (
        await Promise.all(fineNodesAsPromises)
    ).filter((x) => x !== null);

    const nodeScores: number[] = filteredNodes.map((node) =>
        this.scoreNode(node)
    );

    const highestScoreIndex: number = nodeScores.indexOf(
        Math.max(...nodeScores)
    );

    if (highestScoreIndex === -1) return null;

    return filteredNodes[highestScoreIndex].node;
}

/**
 * Score a node based on its resource use and availability and return a number between 0 and 100.
 * @param  {Node} node
 * @returns {Promise<number>}
 */
export function scoreNode(this: ProxmoxConnection, node: Node): number {
    let score = 0;
    if (node.status !== 'online') {
        return 0;
    } else {
        score++;
    }
    const cpuPercentage = node.cpu * 100;
    score += Math.floor((100 - cpuPercentage) / 3);
    const memPercentage = (node.mem / node.maxmem) * 100;
    score += Math.floor((100 - memPercentage) / 3);
    const diskPercentage = (node.disk / node.maxdisk) * 100;
    score += Math.floor((100 - diskPercentage) / 3);
    return score;
}

/**
 * Get the first fine node in a given location
 * @async
 * @param  {string} location
 * @returns {Promise<string>}
 */
export async function getNodeByLocation(
    this: ProxmoxConnection,
    location: string
): Promise<string> {
    const query = 'SELECT * FROM nodes WHERE location = ?';
    const nodes: SQLNode[] = SQLNode.fromObjects(
        await this.mySQLClient.getQueryResult(query, [location])
    );

    return await this.getFirstFineNode(nodes);
}

/**
 * Get the resources of a node.
 * @async
 * @returns {Promise<VMResource>}
 */
export async function getResources(
    this: ProxmoxConnection
): Promise<VMResource[]> {
    return (
        await this.call<VMResource[]>('cluster/resources', 'GET', {
            type: 'vm',
        })
    ).data;
}

/**
 * Get the node a given container is running on
 * @async
 * @param  {number} id
 * @returns {Promise<string>}
 */
export async function getNodeOfContainer(
    this: ProxmoxConnection,
    id: number
): Promise<string> {
    const resources = await this.getResources();
    const resource = resources.find((x) => x.vmid == id);
    if (!resource) return null;
    return resource.node;
}

/**
 * Get the ip of a container based on its id.
 * @async
 * @param  {number} id
 * @returns {Promise<string>}
 */
export async function getContainerIP(
    this: ProxmoxConnection,
    id: number
): Promise<string> {
    const nodename = await this.getNodeOfContainer(id);
    if (!nodename) return null;
    const { data: ctConfig }: { data?: LXC } = await this.call(
        `nodes/${nodename}/lxc/${id}/config`,
        'GET'
    );
    // net config for example "net0": "name=eth0,bridge=vmbr0,firewall=1,gw=195.133.95.1,hwaddr=2E:EA:FA:B4:21:47,ip=195.133.95.121/24,type=veth"
    const netConf = ctConfig.net0;
    return netConf?.split('ip=')?.[1]?.split('/')?.[0] || null;
}

/**
 * Get the information of a container based on its id.
 * @async
 * @param  {number} id
 * @returns {Promise<LXC>}
 */
export async function getContainerInfo(
    this: ProxmoxConnection,
    id: number
): Promise<LXC> {
    const nodename = await this.getNodeOfContainer(id);
    if (!nodename) return null;
    const { data: ctConfig }: { data?: LXC } = await this.call<LXC>(
        `nodes/${nodename}/lxc/${id}/config`,
        'GET'
    );
    if (!ctConfig) return null;
    if (ctConfig.unprivileged != null)
        ctConfig.unprivileged = !!ctConfig.unprivileged;

    return ctConfig;
}

/**
 * Get the status of container based on its id.
 * @async
 * @param {number} id
 * @returns {Promise<ContainerStatus>}
 */
export async function getContainerStatus(
    this: ProxmoxConnection,
    id: number
): Promise<ContainerStatus> {
    const nodename = await this.getNodeOfContainer(id);
    if (!nodename) return null;
    const { data: ctStatus } = await this.call<ContainerStatus>(
        `nodes/${nodename}/lxc/${id}/status/current`,
        'GET'
    );
    if (!ctStatus) return null;
    if (ctStatus.ha?.managed != null)
        ctStatus.ha.managed = !!ctStatus.ha.managed;

    return ctStatus;
}

/**
 * Change the power status of a container.
 * @async
 * @param {number} containerID
 * @param {status} status
 * @returns {Promise<string>}
 */
export async function changeContainerStatus(
    this: ProxmoxConnection,
    containerID: number,
    status: status
): Promise<ActionResult<string | null>> {
    try {
        const nodename = await this.getNodeOfContainer(containerID);
        if (!nodename) return null;
        const res = await this.call<string | null>(
            `nodes/${nodename}/lxc/${containerID}/status/${status}`,
            'POST'
        );

        if (res?.success === 1) {
            return {
                ok: true,
            };
        } else {
            return {
                ok: false,
                error: res?.message.replaceAll('\n', '') || 'Unknown error',
            };
        }
    } catch (err) {
        console.error(err);
        return null;
    }
}

/**
 * Change the hostname of a container.
 * @async
 * @param {number} id
 * @param {string} hostname
 * @returns {*}  {Promise<void>}
 */
export async function changeCTHostname(
    this: ProxmoxConnection,
    id: number,
    hostname: string
): Promise<void> {
    const node = await this.getNodeOfContainer(id);
    await this.call(`nodes/${node}/lxc/${id}/config`, 'PUT', {
        hostname,
    });
}

/**
 * Mark a container as ready in the database.
 * @async
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function setCTAsReady(
    this: ProxmoxConnection,
    id: number
): Promise<void> {
    const sql = `UPDATE cts SET status = '1' WHERE id = ?`;
    await this.mySQLClient.executeQuery(sql, [id]);
}

/**
 * Get information on all containers.
 * @async
 * @returns {Promise<LXC[]>}
 */
export async function getContainers(this: ProxmoxConnection): Promise<LXC[]> {
    const containersAsPromises: Promise<LXC>[] = [];
    const sql = 'SELECT * FROM cts';
    const cts: CT[] = CT.fromObjects(
        await this.mySQLClient.getQueryResult(sql)
    );
    for (const ct of cts) {
        const containerData = this.getContainerInfo(ct.id);
        if (containerData) containersAsPromises.push(containerData);
    }
    return await Promise.all(containersAsPromises);
}

/**
 * Get current status of all containers.
 * @async
 * @returns {Promise<ContainerStatus[]>}
 */
export async function getContainerStatuses(
    this: ProxmoxConnection
): Promise<ContainerStatus[]> {
    const containerStatusesAsPromises: Promise<ContainerStatus>[] = [];
    const sql = 'SELECT * FROM cts';
    const cts: CT[] = CT.fromObjects(
        await this.mySQLClient.getQueryResult(sql)
    );
    for (const ct of cts) {
        const containerData = this.getContainerStatus(ct.id);
        if (containerData) containerStatusesAsPromises.push(containerData);
    }
    return await Promise.all(containerStatusesAsPromises);
}

export async function getStorages(
    this: ProxmoxConnection,
    nodename: string
): Promise<Storage[]> {
    const res = await this.call<Storage[]>(
        `nodes/${nodename}/storage?format=1&content=backup`,
        'GET'
    );
    if (!res) return [];
    let storages = res.data;
    storages = storages.filter(
        (storage) =>
            storage.used_fraction * 100 < 90 ||
            !!storage.enabled ||
            !!storage.active
    );
    return storages;
}

export async function getStorageNamesAndAvailSize(
    this: ProxmoxConnection,
    nodename: string
): Promise<{ storage: string; avail: number }[]> {
    const storages = await this.getStorages(nodename);
    return storages.map((storage) => {
        return { storage: storage.storage, avail: storage.avail };
    });
}

export async function getStorageNames(
    this: ProxmoxConnection,
    nodename: string
): Promise<string[]> {
    const storages = await this.getStorages(nodename);
    return storages.map((storage) => storage.storage);
}

export async function getStorageOfBackup(
    this: ProxmoxConnection,
    nodename: string,
    backupID: string
): Promise<string | null> {
    const storages = await this.getStorageNames(nodename);
    for (const storage of storages) {
        const res = await this.call<string>(
            `nodes/${nodename}/storage/${storage}/content/${storage}:backup/${backupID}`,
            'GET'
        );
        if (res?.data) return storage;
    }

    return null;
}

export async function createBackup(
    this: ProxmoxConnection,
    containerID: number
): Promise<ActionResult<string>> {
    const node = await this.getNodeOfContainer(containerID);
    const storages = await this.getStorageNamesAndAvailSize(node);
    if (storages.length < 1) return { error: 'No storage found', ok: false };

    let index = 0;
    const containerStatus = await this.getContainerStatus(containerID);
    while (storages[index].avail < containerStatus.disk * 0.5) {
        index++;
        if (index >= storages.length)
            return { error: 'Not enough space', ok: false };
    }

    const storage: string = storages[index].storage;
    const res = await this.call<string | null>(`nodes/${node}/vzdump`, 'POST', {
        storage,
        vmid: containerID,
        mode: 'snapshot',
        remove: '0',
        compress: 'zstd',
    });

    if (!res.data)
        return { error: res.message || "Couldn't create backup", ok: false };
    return { ok: true, data: res.data };
}

export async function deleteBackup(
    this: ProxmoxConnection,
    containerID: number,
    backupID: string
): Promise<ActionResult<string>> {
    const node = await this.getNodeOfContainer(containerID);
    const storage = await this.getStorageOfBackup(node, backupID);
    if (!storage) return { error: 'No storage found', ok: false };

    const res = await this.call<string | null>(
        `nodes/${node}/storage/${storage}/content/${storage}:backup/${backupID}`,
        'DELETE'
    );
    if (!res.success)
        return { error: res.message || "Couldn't delete backup", ok: false };
    return { ok: true, data: res.data };
}

export async function getBackups(
    this: ProxmoxConnection,
    containerID: number
): Promise<Backup[]> {
    let backups: Backup[] = [];
    const node = await this.getNodeOfContainer(containerID);
    const storages: string[] = await this.getStorageNames(node);

    for (const storage of storages) {
        const res = await this.call<Backup[]>(
            `nodes/${node}/storage/${storage}/content?content=backup&vmid=${containerID}`,
            'GET'
        );
        if (!res.data) continue;
        const tempBackups = res.data.map(
            (backup) =>
                <Backup>{
                    storage,
                    notes: backup.notes,
                    size: backup.size,
                    ctime: backup.ctime,
                    volid: backup.volid,
                    backupid: backup.volid.split('backup/')[1],
                    format: backup.format,
                }
        );
        // concat the tempBackups that we found in the storage to the global backups array
        backups = backups.concat(tempBackups);
    }

    return backups;
}

export async function restoreBackup(
    this: ProxmoxConnection,
    containerID: number,
    backupID: string
): Promise<ActionResult<string>> {
    const node = await this.getNodeOfContainer(containerID);
    const storage = await this.getStorageOfBackup(node, backupID);
    if (!storage) return { error: 'No storage found', ok: false };

    const res = await this.call<string>(`nodes/${node}/lxc`, 'POST', {
        vmid: containerID,
        force: 1,
        storage,
        ostemplate: `${storage}:backup/${backupID}`,
        restore: 1,
        start: 1,
        node,
    });
    if (!res.success)
        return { error: res.message || "Couldn't restore backup", ok: false };
    return { ok: true, data: res.data };
}

export async function ctHasFeature(
    this: ProxmoxConnection,
    containerID: number,
    feature: string
): Promise<boolean> {
    const node = await this.getNodeOfContainer(containerID);
    const res = await this.call<{ hasFeature: boolean }>(
        `nodes/${node}/feature?feature=${feature}`,
        'GET'
    );
    if (res.success === 1) return res.data.hasFeature;
    return false;
}

export async function getSnapshots(
    this: ProxmoxConnection,
    containerID: number
): Promise<Snapshot[]> {
    const node = await this.getNodeOfContainer(containerID);
    const res = await this.call<Snapshot[]>(
        `nodes/${node}/lxc/${containerID}/snapshot`,
        'GET'
    );
    if (!res.data) return [];
    return res.data;
}

export async function getSnapshotLXC(
    this: ProxmoxConnection,
    containerID: number,
    snapshotName: string
): Promise<LXC | null> {
    const node = await this.getNodeOfContainer(containerID);
    const res = await this.call<LXC | null>(
        `nodes/${node}/lxc/${containerID}/snapshot/${snapshotName}/config`,
        'GET'
    );

    if (!res.data) return null;

    return res.data;
}

export async function deleteSnapshot(
    this: ProxmoxConnection,
    containerID: number,
    snapshotName: string
): Promise<ActionResult<string>> {
    const node = await this.getNodeOfContainer(containerID);

    const snapshotExists = !!(await this.getSnapshotLXC(
        containerID,
        snapshotName
    ));

    if (!snapshotExists) return { error: 'Snapshot does not exist', ok: false };

    const res = await this.call<string | null>(
        `nodes/${node}/lxc/${containerID}/snapshot/${snapshotName}`,
        'DELETE'
    );
    if (!res.success)
        return { error: res.message || "Couldn't delete snapshot", ok: false };
    return { ok: true, data: res.data };
}

export async function createSnapshot(
    this: ProxmoxConnection,
    containerID: number,
    options: Omit<Snapshot, 'parent' | 'snaptime'>
): Promise<ActionResult<string>> {
    const node = await this.getNodeOfContainer(containerID);
    const res = await this.call<string | null>(
        `nodes/${node}/lxc/${containerID}/snapshot`,
        'POST',
        {
            snapname: options.name,
            description: options.description,
        }
    );
    if (!res.success)
        return { error: res.message || "Couldn't create snapshot", ok: false };
    return { ok: true, data: res.data };
}

export async function rollbackSnapshot(
    this: ProxmoxConnection,
    containerID: number,
    snapshotName: string
): Promise<ActionResult<string>> {
    const node = await this.getNodeOfContainer(containerID);
    const res = await this.call<string | null>(
        `nodes/${node}/lxc/${containerID}/snapshot/${snapshotName}/rollback`,
        'POST'
    );
    if (!res.success)
        return {
            error: res.message || "Couldn't rollback snapshot",
            ok: false,
        };
    return { ok: true, data: res.data };
}
