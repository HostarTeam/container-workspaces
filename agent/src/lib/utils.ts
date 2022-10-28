import { existsSync, mkdirSync, readFileSync } from 'fs';
import { AgentConfiguration } from './typing/types';
import { exec, execFileSync, execSync } from 'child_process';
import os from 'os';
import { WebSocket } from 'ws';
import { promisify } from 'util';

export const execAsync = promisify(exec);

export function generatePassword(length: number): string {
    let result = '';
    const characters =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(
            Math.floor(Math.random() * charactersLength)
        );
    }
    return result;
}

export async function checkIfInitHadRan(
    location = '/var/local/cw/initran'
): Promise<boolean> {
    try {
        if (existsSync(location)) {
            const fileContent: string = readFileSync(location, 'utf8');
            const initHadRan: boolean = fileContent.trim() === '1';
            return initHadRan;
        } else {
            const dirPath = location.split('/').slice(0, -1).join('/');
            mkdirSync(dirPath, { recursive: true });
            return false;
        }
    } catch {
        printError('Failed to check if init agent had ran');
    }
}

export function readConfFile(
    fileLocation = '/etc/cw/defaultconf.json'
): AgentConfiguration {
    let fileContent = '';
    try {
        fileContent = readFileSync(fileLocation, 'utf8');
    } catch (error: unknown) {
        printError(`Could not read from config file at ${fileLocation}`);
        process.exit(1);
    }
    try {
        const config: AgentConfiguration = JSON.parse(fileContent);
        return config;
    } catch (error: unknown) {
        printError('Could not parse config file');
        process.exit(1);
    }
}

export function getLastLines(logFilePath: string, lines = 100): string {
    const stdout = execSync(`tail -n ${lines} ${logFilePath}`, {
        encoding: 'utf8',
    });

    return stdout;
}

export function getInfoFromHostname(): {
    protocol: string;
    address: string;
    httpPort: number;
    wsPort: number;
} {
    const hostname: string = os.hostname();
    const protocol = hostname.split('491500')[0];
    const address = hostname.split('491500')[1];
    const httpPort = Number(hostname.split('491500')[2]);
    const wsPort = Number(hostname.split('491500')[3]);
    return { protocol, address, httpPort, wsPort };
}

export function changeSystemHostname(newHostname: string): void {
    execFileSync('hostname', [newHostname], {
        stdio: 'pipe',
    });
}

enum Colors {
    Reset = '\x1b[0m',
    ErrorRed = '\x1b[31m',
    WarningYellow = '\x1b[33m',
    SuccessGreen = '\x1b[32m',
    FatalPurple = '\x1b[35m',
}

export function printError(message): void {
    console.log(`${Colors.ErrorRed}Error: ${Colors.Reset}${message}`);
}

export function printWarning(message): void {
    console.log(`${Colors.WarningYellow}Warning: ${Colors.Reset}${message}`);
}

export function printSuccess(message): void {
    console.log(`${Colors.SuccessGreen}Success: ${Colors.Reset}${message}`);
}

export function printFatal(message): void {
    console.log(`${Colors.FatalPurple}Fatal: ${Colors.Reset}${message}`);
}

export function getSocketID(socket: WebSocket) {
    /* eslint-disable */
    return `${(<any>socket)._socket.remoteAddress}:${
        (<any>socket)._socket.remotePort
    }`;
    /* eslint-enable */
}

export function checkIfSocketClosed(socket: WebSocket): boolean {
    return (
        socket.readyState === WebSocket.CLOSED ||
        socket.readyState === WebSocket.CLOSING
    );
}

export const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));
