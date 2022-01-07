import { generatePassword, printError, printSuccess } from './lib/utils';
import passwd from 'passwd-linux';
import { AgentConfiguration, CommandErrorReport } from './lib/types';
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import fetch, { Response } from 'node-fetch';
import log4js, { Logger } from 'log4js';

export default class InitAgent {
    protected logger: Logger;

    constructor(
        protected config: AgentConfiguration,
        private developmentMode = true
    ) {
        this.configureLogger();
        this.logger.info('Running init agent');
    }

    public async runInit(): Promise<void> {
        const generatedPassword: string = generatePassword(32);
        this.logger.info('Generated password successfully');
        if (!this.developmentMode) this.changePassword(generatedPassword);
        else console.log('development mode, not changing password');

        await this.postCTDetails({
            password: generatedPassword,
            apiServer: this.config.apiServer,
        });

        const initCommands: string[] = await this.getInitCommands(
            this.config.apiServer
        );
        this.logger.info('Reveived init commands from api server');

        await this.runInitCommands(initCommands, this.config.apiServer);
        this.logger.info('Executed init commands');

        // await this.setAsRan();
    }

    private changePassword(newPassword: string): void {
        passwd.changePassword(
            'root',
            newPassword,
            (err: unknown, response): void => {
                if (err)
                    this.logger.error(`Error changing password: ${<Error>err}`);
                else if (response) this.logger.info('Password changed');
                else this.logger.error('Could not change password');
            }
        );
    }

    private async postCTDetails({ password, apiServer }): Promise<void> {
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
        } catch (err: unknown) {
            this.logger.error(<Error>err);
        }
    }

    private async getInitCommands(apiServer: string): Promise<string[]> {
        const res: Response = await fetch(
            `${apiServer}/api/agent/initcommands`
        );
        return await res.json();
    }

    private async runInitCommands(
        commands: string[],
        apiServer: string
    ): Promise<void | never> {
        for (const command of commands) {
            try {
                await execSync(command, {
                    stdio: 'pipe',
                });
            } catch (err: unknown) {
                await this.reportCommandErrors(command, err, apiServer, true);
                process.exit(1);
            }
        }

        await this.sendInitSuccessStatus(apiServer);
    }

    private async sendInitSuccessStatus(apiServer: string): Promise<void> {
        await fetch(`${apiServer}/api/agent/command/initsuccess`, {
            method: 'POST',
        });
    }

    private async reportCommandErrors(
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

    private async setAsRan(location = '/var/local/cw/initran'): Promise<void> {
        await writeFileSync(location, '1');
    }

    private configureLogger(
        location: string = '/var/log/cw/initagent.log'
    ): void {
        this.logger = log4js
            .configure({
                appenders: {
                    init: {
                        type: 'file',
                        filename: location,
                    },
                },
                categories: { default: { appenders: ['init'], level: 'all' } },
            })
            .getLogger();
    }
}
