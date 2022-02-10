import { lookup } from 'dns/promises';
import prompts from 'prompts';
import { SQLInfo } from './types';
import { Connection as PromiseConnection } from 'mysql2/promise';

enum Colors {
    Reset = '\x1b[0m',
    Red = '\x1b[31m',
    Yellow = '\x1b[33m',
    Green = '\x1b[32m',
    FatalPurple = '\x1b[35m',
}

export function printFatal(message): void {
    console.log(`${Colors.FatalPurple}Fatal: ${Colors.Reset}${message}`);
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

// Prompt user for input using inquirer
export async function promptUser(question: prompts.PromptObject): Promise<any> {
    const answer = await prompts(question);
    return answer[question.name.toString()];
}

export function fatalApp(message: string): never {
    printFatal(message);
    return process.exit(1);
}

export async function promptForSQLInfo(): Promise<SQLInfo> {
    const host = await promptUser({
        type: 'text',
        name: 'sqlHost',
        message: 'Enter the host of the SQL server:',
        initial: 'localhost',
        validate: async (value) => {
            // Validate the host is a valid host
            try {
                await lookup(value.toString());
                return true;
            } catch {
                return `${value} is not a valid host`;
            }
        },
    });

    const port = await promptUser({
        type: 'number',
        name: 'sqlPort',
        message: 'Enter SQL Server port',
        initial: 3306,
        validate: (value: number) => {
            if (isNaN(value) || value < 0 || value > 65535) {
                return 'Please enter a valid port number';
            }
            return true;
        },
        max: 65535,
        min: 0,
    });

    const user = await promptUser({
        type: 'text',
        name: 'sqlUser',
        message: 'Enter SQL Server user',
        initial: 'root',
    });

    const password = await promptUser({
        type: 'password',
        name: 'sqlPassword',
        message: 'Enter SQL Server password',
        initial: '',
    });

    return {
        host,
        port,
        user,
        password,
    };
}

export function handleFatalCatch(phase: string): (err: unknown) => never {
    return function (err) {
        printFatal(`Error occurred during ${phase}`);
        if (typeof err === 'string') fatalApp(err);
        else if (err instanceof Error) fatalApp(err.message);
        else fatalApp(`Unknown Error`);
    };
}

export async function runSQLSetup(
    connection: PromiseConnection,
    setup: string
): Promise<void> {
    await connection.query(setup);
}

export function anyNull(...args: any[]): boolean {
    return args.some((arg) => arg === null || arg === undefined);
}
