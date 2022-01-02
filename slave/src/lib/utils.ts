import { readFileSync } from 'fs';
import { Configuration } from './types';
import { Handler, NextFunction, Request, Response } from 'express';

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
    const fileLocation: string = '/etc/docker-workspaces/server.json';
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

export function createNetworkName(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(
            Math.floor(Math.random() * charactersLength)
        );
    }
    return result;
}

export function getAuthKey(req: Request): string | null {
    const headerValue = req.headers['authorization'];
    if (!headerValue) return null;
    else return headerValue.split(' ').pop();
}

export function validateAuth(apiKey: string): Handler {
    return function (req: Request, res: Response, next: NextFunction) {
        const authKey: string | null = getAuthKey(req);
        if (authKey === apiKey) next();
        else res.status(401).send({ status: 'unauthorized' });
    };
}
