import { readFileSync } from 'fs';
import { Configuration, SQLClient } from '../typing/types';
import { Handler, NextFunction, Request, Response } from 'express';
import ProxmoxConnection from '../proxmox/ProxmoxConnection';
import ContainerWorkspaces from '../../ContainerWorkspaces';
import log4js, { Log4js } from 'log4js';
import { compareSync } from 'bcrypt';

enum Colors {
    Reset = '\x1b[0m',
    Red = '\x1b[31m',
    Yellow = '\x1b[33m',
    Green = '\x1b[32m',
}
/**
 * Print an error message to the console
 * @param  {any} message
 * @returns {void}
 */
export function printError(message): void {
    console.log(`${Colors.Red}Error: ${Colors.Reset}${message}`);
}

/**
 * Print a warning message to the console
 * @param  {any} message
 * @returns {void}
 */
export function printWarning(message): void {
    console.log(`${Colors.Yellow}Warning:  ${Colors.Reset}${message}`);
}

/**
 * Print a success message to the console
 * @param {any} message
 * @returns {void}
 */
export function printSuccess(message): void {
    console.log(`${Colors.Green}Success:  ${Colors.Reset}${message}`);
}

/**
 * Get the configuration from the config file and retrieve the content
 * @async
 * @returns {Promise<Configuration>}
 */
export async function readConfFile(): Promise<Configuration> {
    const fileLocation = '/etc/container-workspaces/conf.json';
    let fileContent = '';
    try {
        fileContent = await readFileSync(fileLocation, 'utf8');
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
 * @param  {Request} req
 * @returns {string}
 */
export function getEncodedBasicToken(req: Request): string | null {
    const headerValue = req.headers['authorization'];
    if (!headerValue) return null;
    else return headerValue.split(' ').pop();
}

/**
 * Get the names of all nodes in the Proxmox cluster
 * @returns {Promise<string[]>}
 */
export async function getNodesName(this: ProxmoxConnection): Promise<string[]> {
    const nodesArr = await this.getNodes();
    const nodesName = nodesArr.map((x) => x.node);
    return nodesName;
}

/**
 * Check if the given IP is present in the database
 * @async
 * @param  {string} ip
 * @returns {Promise<boolean>}
 */
export async function checkIP(
    this: ContainerWorkspaces,
    ip: string
): Promise<boolean> {
    const sql = 'SELECT ipv4 from cts';
    const cts: { ipv4?: string }[] = await this.mySQLClient.getQueryResult(sql);
    const ips: string[] = cts.map((x) => x['ipv4']);

    return ips.includes(ip);
}

/**
 * Create loggers with Log4js
 * @param  {string[]} logsName
 * @param  {string} logDir
 * @returns {Log4js}
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
 * @returns {string}
 */
export function generateID(): string {
    return (
        (Math.random() + 1).toString(36).substring(2) +
        (Math.random() + 1).toString(36).substring(2)
    );
}

/**
 * Sleep for a given time in milliseconds
 * @param  {number} ms
 */
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a random password
 * @param  {number} length
 * @returns {string}
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
 * @param  {string} netmask
 * @returns {number}
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
 * @param  {string} ip
 * @returns {boolean}
 */
export function validateIP(ip: string): boolean {
    return /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|$)){4}$/.test(ip);
}

/**
 * Validate that a given string is between 5 and 100 characters long
 * @param  {string} password
 * @returns {boolean}
 */
export function validatePassword(password: string): boolean {
    return password.length >= 5 && password.length <= 100;
}

/**
 * A handler demanding specific properties to exist in the request body
 * @param  {string[]} ...props
 * @returns {Handler}
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
 * @param  {ContainerWorkspaces} this
 * @param  {string} token
 * @returns {Promise<boolean>}
 */
export async function checkAuthToken(
    this: ContainerWorkspaces,
    token: string
): Promise<boolean> {
    const decodedToken: string = Buffer.from(token, 'base64').toString();
    const [client_id, client_secret] = decodedToken.split(':');
    const sql = 'SELECT client_secret FROM clients where client_id = ?';

    const result: SQLClient = await this.mySQLClient.getFirstQueryResult(
        sql,
        client_id
    );

    if (!result) return false;

    return compareSync(client_secret, result.client_secret);
}
