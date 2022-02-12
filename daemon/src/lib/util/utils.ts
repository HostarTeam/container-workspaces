import { readFileSync } from 'fs';
import { Configuration, CT, SQLClient } from '../typing/types';
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

export function printError(message): void {
    console.log(`${Colors.Red}Error: ${Colors.Reset}${message}`);
}

export function printWarning(message): void {
    console.log(`${Colors.Yellow}Warning:  ${Colors.Reset}${message}`);
}

export function printSuccess(message): void {
    console.log(`${Colors.Green}Success:  ${Colors.Reset}${message}`);
}

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

export function getEncodedBasicToken(req: Request): string | null {
    const headerValue = req.headers['authorization'];
    if (!headerValue) return null;
    else return headerValue.split(' ').pop();
}

export async function getNodesName(this: ProxmoxConnection): Promise<string[]> {
    const nodesArr = await this.getNodes();
    const nodesName = nodesArr.map((x) => x.node);
    return nodesName;
}

export async function checkIP(
    this: ContainerWorkspaces,
    ip: string
): Promise<boolean> {
    const sql = 'SELECT ipv4 from cts';
    const cts: CT[] = await this.mySQLClient.getQueryResult(sql);
    const ips: string[] = cts.map((x) => x['ipv4']);

    return ips.includes(ip);
}

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

export function generateID(): string {
    return (
        (Math.random() + 1).toString(36).substring(2) +
        (Math.random() + 1).toString(36).substring(2)
    );
}

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

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

export function validateIP(ip: string): boolean {
    return /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|$)){4}$/.test(ip);
}

// Validate that a given string is between 5 and 100 characters long
export function validatePassword(password: string): boolean {
    return password.length >= 5 && password.length <= 100;
}

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
