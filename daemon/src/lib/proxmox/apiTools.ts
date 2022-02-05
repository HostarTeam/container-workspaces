import fetch, { Response } from 'node-fetch';
import ProxmoxConnection from './ProxmoxConnection';
import { generatePassword, printError } from '../utils';
import {
    ClusterNode,
    ContainerStatus,
    CTOptions,
    LXC,
    Node,
    SQLNode,
    status,
} from '../typing/types';

export function call(
    this: ProxmoxConnection,
    path: string,
    method: string,
    body: any = null
): Promise<any> {
    let promise = new Promise(async (resolve, reject) => {
        let options = {
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Authorization: `PVEAuthCookie=${this.authCookie}`,
            },
            method: method,
        };
        if (['POST', 'PUT', 'DELETE'].includes(method.toUpperCase()))
            options.headers['CSRFPreventionToken'] = this.csrfPreventionToken;
        if (body) (options as any).body = JSON.stringify(body);
        try {
            var res: Response = await fetch(
                `${this.basicURL}/${path}/`,
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
            resolve(await res.json());
        } catch (err) {
            this.pveLogger.error(
                `${method.toUpperCase()} - ${path} - ${
                    res.status || 'no status code'
                } - ${err.message || 'no error message'}`
            );
            reject(err);
        }
    });
    return promise;
}

export async function getNodes(this: ProxmoxConnection): Promise<Node[]> {
    let res = await this.call('nodes', 'GET');
    return res.data;
}

export async function getAuthKeys(this: ProxmoxConnection): Promise<void> {
    try {
        let username = `${this.username}@pam`,
            password = this.password;
        let res: Response = await fetch(
            `${this.basicURL}/access/ticket?username=${username}&password=${password}`,
            {
                method: 'POST',
            }
        );
        (res as any) = await res.json();
        const data = (res as any).data;
        this.authCookie = data.ticket;
        this.csrfPreventionToken = data.CSRFPreventionToken;
    } catch (error) {
        this.pveLogger.fatal(`Can't connect to the pve server`);
        printError(error);
        throw Error("Can't connect to server");
    }
}

export async function deleteCTContainer(this: ProxmoxConnection, id: number) {
    const node: string = await this.getNodeOfContainer(id);
    await this.call(`nodes/${node}/lxc/${id}?force=1`, 'DELETE');
}

export async function createCTContainer(
    this: ProxmoxConnection,
    location: string,
    template: string
): Promise<void> {
    const sql = `SELECT * FROM config`;
    const config = JSON.parse(
        (await this.mysqlConnection.query(sql))[0][0]['config']
    );

    const node = await this.getNodeByLocation(location);
    const ctOptions = config['ct_options'];
    await this.createCTContainerInProxmox(ctOptions, node, template);
}

export async function createCTContainerInProxmox(
    this: ProxmoxConnection,
    options: CTOptions,
    node: string,
    template: string
): Promise<void> {
    try {
        const nextID: number = await this.call('cluster/nextid', 'GET')['data'];
        if (!nextID) {
            this.pveLogger.error(`Couldn't find LXC container ID`);
            throw Error(`Couldn't find LXC container ID`);
        }

        const generatedPassword: string = generatePassword(16);
        const body: LXC = {
            ostemplate: template, // template for example: 'local:vztmpl/debian-9.0-amd64-standard_9.0-3_amd64.tar.gz'
            vmid: nextID,
            cores: options.ct_cores,
            description: 'Created by the API',
            hostname: nextID.toString(),
            password: generatedPassword,
            rootfs: `local-lvm:${options.ct_disk}`,
            memory: options.ct_ram,
            swap: options.ct_swap,
        };
        const res = await this.call(`nodes/${node}/lxc`, 'POST', body);
        if (res.data && !res.errors)
            this.pveLogger.info(
                `LXC container with ID ${nextID} has been created successfully`
            );
        else
            this.pveLogger.error(
                `LXC container could not be created - ${res.errors
                    .getValues()
                    .join(' - ')}`
            );
        console.log(`LXC container with message\n`, res);
    } catch (err) {
        this.pveLogger.error('Could not create a LXC container');
    }
}

export async function getNodeIP(
    this: ProxmoxConnection,
    node: string
): Promise<string> {
    // const netowrk: NetowrkInteface[] = await this.call(
    //     `${node}/network`,
    //     'GET'
    // );
    // const netowrkInteface = netowrk.find((x) => x.iface == 'vmbr0');
    // return netowrkInteface.address;

    const data: ClusterNode[] = await this.call('cluster/status', 'GET');
    return data.find((x) => x.name == node).ip;
}

export async function checkIfNodeIsFine(
    this: ProxmoxConnection,
    nodename: string
): Promise<boolean> {
    const nodes: Node[] = await this.getNodes();
    let node: Node = nodes.find((x) => x.node == nodename);
    if (node) {
        if (node.type !== 'node') return false;
        if (node.status == 'offline' || node.status == 'unknown') return false;
        if (node.cpu * 100 > 90) return false;
        if ((node.mem / node.maxmem) * 100 > 90) return false;
        if ((node.disk / node.maxdisk) * 100 > 90) return false;
        return true;
    }
    return false;
}

export async function getFirstFineNode(
    this: ProxmoxConnection,
    nodes: SQLNode[]
) {
    for (let node of nodes) {
        if (await this.checkIfNodeIsFine(node.nodename)) return node.nodename;
    }

    return null;
}

export async function getNodeByLocation(
    this: ProxmoxConnection,
    location: string
): Promise<string> {
    const query = 'SELECT * FROM nodes WHERE location = ?';
    const [nodes]: SQLNode[][] = await this.mysqlConnection.query(query, [
        location,
    ]);

    return await this.getFirstFineNode(nodes);
}

export async function getNodeOfContainer(
    this: ProxmoxConnection,
    id: number
): Promise<string> {
    const nodes = await this.getNodes();
    for (const node of nodes) {
        const res = await this.call(`/nodes/${node.node}/lxc/${id}`, 'GET');

        if (res.data) return node.node;
    }
    return null;
}

export async function getContainerIP(
    this: ProxmoxConnection,
    id: number
): Promise<string> {
    const nodename = await this.getNodeOfContainer(id);
    if (!nodename) return null;
    let ctConfig = await this.call(`nodes/${nodename}/lxc/${id}/config`, 'GET');
    // net config for example "net0": "name=eth0,bridge=vmbr0,firewall=1,gw=195.133.95.1,hwaddr=2E:EA:FA:B4:21:47,ip=195.133.95.121/24,type=veth"
    const netConf = ctConfig.data.net0;
    return netConf.split('ip=')[1].split('/')[0];
}

export async function getContainerInfo(
    this: ProxmoxConnection,
    id: number
): Promise<LXC> {
    const nodename = await this.getNodeOfContainer(id);
    if (!nodename) return null;
    let ctConfig = await this.call(`nodes/${nodename}/lxc/${id}/config`, 'GET');
    const containerData: LXC = ctConfig.data;
    return containerData;
}

export async function getContainerStatus(
    this: ProxmoxConnection,
    id: number
): Promise<ContainerStatus> {
    const nodename = await this.getNodeOfContainer(id);
    if (!nodename) return null;
    let ctConfig = await this.call(`nodes/${nodename}/lxc/${id}/status`, 'GET');
    const containerData: ContainerStatus = ctConfig.data;
    return containerData;
}

export async function changeContainerStatus(
    this: ProxmoxConnection,
    containerID: number,
    status: status
): Promise<string | null> {
    const nodename = await this.getNodeOfContainer(containerID);
    if (!nodename) return null;
    let ctConfig = await this.call(
        `nodes/${nodename}/lxc/${containerID}/status/${status}`,
        'POST'
    );
    return ctConfig.data;
}
