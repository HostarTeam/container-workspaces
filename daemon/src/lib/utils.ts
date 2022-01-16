import { readFileSync } from 'fs';
import { Configuration } from './typing/types';
import { Handler, NextFunction, Request, Response } from 'express';
import ProxmoxConnection from './proxmox/ProxmoxConnection';
import ContainerWorkspaces from '../ContainerWorkspaces';
import log4js, { Log4js, Logger } from 'log4js';

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
    console.log(`${Colors.Yellow}Warning: ${Colors.Reset}${message}`);
}

export function printSuccess(message): void {
    console.log(`${Colors.Green}Success: ${Colors.Reset}${message}`);
}

export async function readConfFile(): Promise<Configuration> {
    const fileLocation: string = '/etc/container-workspaces/server.json';
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

export async function readInitCommandsFile(): Promise<Configuration> {
    const fileLocation: string = '/etc/container-workspaces/initcommands.json';
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

export function getAuthKey(req: Request): string | null {
    const headerValue = req.headers['authorization'];
    if (!headerValue) return null;
    else return headerValue.split(/ +/).pop();
}

export function validateAuth(apiKey: string): Handler {
    return function (req: Request, res: Response, next: NextFunction) {
        if (req.path.startsWith('/api/agent')) return next();
        const authKey: string | null = getAuthKey(req);
        if (authKey === apiKey) next();
        else res.status(401).send({ status: 'unauthorized' });
    };
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
    let [ips]: Array<any[]> = await this.mysqlConnection.query(sql);
    ips = ips.map((x) => x['ipv4']);

    return ips.includes(ip);
}

export function createLoggers(logsName: string[], logDir: string): Log4js {
    let confObj = {
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
    return (Math.random() + 1).toString(36).substring(2);
}
