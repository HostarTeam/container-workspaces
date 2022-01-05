import { readFileSync } from 'fs';
import passwd from 'passwd-linux';
import { AgentConfiguration, CommandErrorReport } from './types';
import fetch, { Response } from 'node-fetch';
import { execSync } from 'child_process';

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

export function changePassword(newPassword: string): void {
    passwd.changePassword(
        'root',
        newPassword,
        function (err: unknown, response): void {
            if (err) console.log(err);
            else if (response) printSuccess('Password initialized');
            else printError('Error changing password');
        }
    );
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

export async function postCTDetails({ password, apiServer }): Promise<void> {
    try {
        await fetch(`${apiServer}/api/agent/newct`, {
            method: 'POST',
            headers: {
                'Content-Type': 'Application/JSON',
            },
            body: JSON.stringify({
                password,
            }),
        });
        printSuccess('Sent CT details successfully');
    } catch (e) {
        console.log(e);
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

export async function getInitCommands(apiServer: string): Promise<string[]> {
    const res: Response = await fetch(`${apiServer}/api/agent/initcommands`);
    return await res.json();
}

export async function runInitCommands(
    commands: string[],
    apiServer: string
): Promise<void | never> {
    for (const command of commands) {
        try {
            await execSync(command, {
                stdio: 'pipe',
            });
        } catch (err: unknown) {
            await reportCommandErrors(command, err, apiServer, true);
            process.exit(1);
        }
    }

    await sendInitSuccessStatus(apiServer);
}

async function sendInitSuccessStatus(apiServer: string): Promise<void> {
    await fetch(`${apiServer}/api/agent/command/initsuccess`, {
        method: 'POST',
    });
}

export async function reportCommandErrors(
    command: string,
    errorData: any,
    apiServer: string,
    isInit = false
): Promise<void> {
    const report: CommandErrorReport = {
        command,
        stderr: errorData.stderr.toString(),
        stdout: errorData.stdout.toString(),
        exitCode: errorData.status,
        stack: errorData.stack,
        message: errorData.message,
    };
    await fetch(
        `${apiServer}/api/agent/command/reporterror?commandType=${
            isInit ? 'init' : 'realtime'
        }`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'Application/JSON',
            },
            body: JSON.stringify(report),
        }
    );
}

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
