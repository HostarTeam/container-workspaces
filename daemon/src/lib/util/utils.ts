import { readFileSync } from 'fs';
import { Configuration } from '../typing/types';
import { Handler, NextFunction, Request, Response } from 'express';
import ProxmoxConnection from '../proxmox/ProxmoxConnection';
import ContainerWorkspaces from '../../ContainerWorkspaces';
import log4js, { Log4js } from 'log4js';
import { compareSync } from 'bcryptjs';
import { Handshake } from 'socket.io/dist/socket';

enum Colors {
    Reset = '\x1b[0m',
    Red = '\x1b[31m',
    Yellow = '\x1b[33m',
    Green = '\x1b[32m',
}
/**
 * Print an error message to the console
 */
export function printError(message): void {
    console.log(`${Colors.Red}Error: ${Colors.Reset}${message}`);
}

/**
 * Print a warning message to the console
 */
export function printWarning(message): void {
    console.log(`${Colors.Yellow}Warning:  ${Colors.Reset}${message}`);
}

/**
 * Print a success message to the console
 */
export function printSuccess(message): void {
    console.log(`${Colors.Green}Success:  ${Colors.Reset}${message}`);
}

/**
 * Get the configuration from the config file and retrieve the content
 */
export async function readConfFile(): Promise<Configuration> {
    const fileLocation = '/etc/container-workspaces/conf.json';
    let fileContent = '';
    try {
        fileContent = readFileSync(fileLocation, 'utf8');
    } catch (error: unknown) {
        printError(`Could not read from config file at ${fileLocation}`);
        process.exit(1);
    }
    try {
        const config: Configuration = JSON.parse(fileContent);
        return config;
    } catch (error: unknown) {
        printError('Could not parse config file');
        process.exit(1);
    }
}

/**
 * Get the encoded basic token from the Authorization header of a request
 */
export function getEncodedBasicToken(req: Request | Handshake): string | null {
    const headerValue = req.headers['authorization'];
    if (!headerValue) return null;
    else return headerValue.split(' ').pop();
}

/**
 * Get the names of all nodes in the Proxmox cluster
 */
export async function getNodesName(this: ProxmoxConnection): Promise<string[]> {
    const nodesArr = await this.getNodes();
    const nodesName = nodesArr.map((x) => x.node);
    return nodesName;
}

/**
 * Check if the given IP is present in the database
 */
export async function checkIP(
    this: ContainerWorkspaces,
    ip: string
): Promise<boolean> {
    const cts = await this.prismaClient.container.findMany({
        select: {
            ipv4: true,
        },
    });
    const ips: string[] = cts.map((x) => x['ipv4']);

    return ips.includes(ip);
}

/**
 * Check if the given containerID is present in the database
 */
export async function checkContainerID(
    this: ContainerWorkspaces,
    containerID: number
): Promise<boolean> {
    const ct = await this.prismaClient.container.findFirst({
        where: {
            id: containerID,
        },
    });

    return !!ct;
}

/**
 * Create loggers with Log4js
 */
export function createLoggers(logsName: string[], logDir: string): Log4js {
    const confObj = {
        appenders: {
            all: {
                type: 'console',
            },
        },
        categories: {
            default: { appenders: ['all'], level: 'all' },
        },
    };
    for (const logName of logsName) {
        confObj.appenders[logName] = {
            type: 'file',
            filename: `${logDir}/${logName.toLowerCase()}.log`,
        };
        confObj.categories[logName] = { appenders: [logName], level: 'all' };
    }

    return log4js.configure(confObj);
}

/**
 * Generate a random string
 */
export function generateID(): string {
    return (
        (Math.random() + 1).toString(36).substring(2) +
        (Math.random() + 1).toString(36).substring(2)
    );
}

/**
 * Sleep for a given time in milliseconds
 */
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a random password
 */
export function generatePassword(length: number): string {
    let result = '';
    const characters =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength: number = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(
            Math.floor(Math.random() * charactersLength)
        );
    }
    return result;
}

/**
 * Convert a netmask to a CIDR
 */
export function netmaskToCIDR(netmask: string): number {
    return (
        netmask
            .split('.')
            .map(Number)
            .map((part) => (part >>> 0).toString(2))
            .join('')
            .split('1').length - 1
    );
}

/**
 * Check if a given string is a valid IP address
 */
export function validateIP(ip: string): boolean {
    return /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|$)){4}$/.test(ip);
}

/**
 * Validate that a given string is between 5 and 100 characters long
 */
export function validatePassword(password: string): boolean {
    return password.length >= 5 && password.length <= 100;
}

/**
 * A handler demanding specific properties to exist in the request body
 */
export function requireBodyProps(...props: string[]): Handler {
    return function (req: Request, res: Response, next: NextFunction) {
        for (const prop of props) {
            if (!req.body[prop]) {
                return res.status(400).send({
                    status: 'bad request',
                    message: `Property ${prop} is missing from body`,
                });
            }
        }
        next();
    };
}

/**
 * Validate an authorization header
 */
export async function checkAuthToken(
    this: ContainerWorkspaces,
    token: string
): Promise<boolean> {
    const decodedToken: string = Buffer.from(token, 'base64').toString();
    const [client_id, client_secret] = decodedToken.split(':');

    const result = await this.prismaClient.client.findFirst({
        where: {
            client_id,
        },
    });

    if (!result) return false;

    return compareSync(client_secret, result.client_secret);
}

/**
 * Wait for a specified amount of time
 */
export const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));
