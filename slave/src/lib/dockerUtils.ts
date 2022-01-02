import { createNetworkName, printError } from './utils';
import util from 'util';
import { execFile } from 'child_process';

import Dockerode from 'dockerode';
const Docker = new Dockerode({ socketPath: '/var/run/docker.sock' });

export async function createNetwork(
    ip: string,
    gateway: string,
    interfaceName: string
): Promise<{ [key: string]: string } | boolean> {
    let name = createNetworkName(32);
    if (!(await createIP(ip, interfaceName))) throw Error();

    let res = await Docker.createNetwork({
        Name: name,
        Driver: 'macvlan',
        IPAM: {
            Driver: 'macvlan',
            Config: [
                {
                    Subnet: `${ip}/24`,
                    Gateway: gateway,
                    IPRange: `${ip}/32`,
                },
            ],
        },
        Options: {
            parent: interfaceName,
        },
        EnableIPv6: false,
    });
    if ((res as any).message) return false;
    return { name, id: res.id };
}

export async function createIP(
    ip: string,
    interfaceName: string
): Promise<boolean> {
    const exec = util.promisify(execFile);
    try {
        const { stdout, stderr } = await exec('ip', [
            'addr',
            'add',
            `${ip}/24`,
            'brd',
            '+',
            'dev',
            interfaceName,
            'label',
            `${interfaceName}:0`,
        ]);
        return true;
    } catch (error) {
        printError(error);
        return false;
    }
}
