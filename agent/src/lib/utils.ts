import { readFileSync } from 'fs';
import Agent from '../Agent';
import InitAgent from '../InitAgent';
import { AgentConfiguration, CommandErrorReport } from './typing/types';

export function generatePassword(length: number): string {
    var result: string = '';
    var characters: string =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength: number = characters.length;
    for (var i = 0; i < length; i++) {
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
        const fileContent: string = await readFileSync(location, 'utf8');
        const initHadRan: boolean = fileContent.trim() === '1';

        return initHadRan;
    } catch {
        printError('An error has occured checking password changement');
    }
}

export async function readConfFile(
    fileLocation = '/etc/cw/defaultconf.json'
): Promise<AgentConfiguration> {
    let fileContent = '';
    try {
        fileContent = await readFileSync(fileLocation, 'utf8');
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
