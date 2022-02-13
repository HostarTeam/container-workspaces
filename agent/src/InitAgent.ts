import { AgentConfiguration, CommandErrorReport } from './lib/typing/types';
import { exec, ExecException } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import fetch, { Response } from 'node-fetch';
import log4js, { Logger } from 'log4js';
import { changeSystemHostname, getInfoFromHostname } from './lib/utils';

export default class InitAgent {
    private readonly address: string;
    private readonly protocol: string;
    private readonly port: number;
    protected logger: Logger;
    protected config: AgentConfiguration;

    constructor() {
        const { protocol, address, port } = getInfoFromHostname();
        this.protocol = protocol;
        this.address = address;
        this.port = port;

        this.config = {
            apiServer: `${this.protocol}://${this.address}:${this.port}`,
            socketServer: `ws://${this.address}:${this.port}`,
        };
        this.writeConfig();
        this.configureLogger();
        this.logger.info('Running init agent');
    }

    private writeConfig(location = '/etc/cw/defaultconf.json'): void {
        mkdirSync(location.split('/').slice(0, -1).join('/'), {
            recursive: true,
        });
        writeFileSync(location, JSON.stringify(this.config));
    }

    public async runInit(): Promise<void> {
        const initCommands: string[] = await this.getInitCommands(
            this.config.apiServer
        );
        this.logger.info('Reveived init commands from api server');

        await this.runInitCommands(initCommands, this.config.apiServer);
        this.logger.info('Executed init commands');

        await this.initHostname();

        await this.setAsRan();
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
            let repstdout = '';
            let repstderr = '';
            try {
                exec(command, (error, stdout, stderr) => {
                    if (error) {
                        repstdout = stdout;
                        repstderr = stderr;
                        throw error;
                    }
                });
            } catch (err: unknown) {
                if (err instanceof Error)
                    this.reportCommandErrors(
                        command,
                        err,
                        { stdout: repstdout, stderr: repstderr },
                        apiServer
                    ).then(() => {
                        process.exit(1);
                    });
            }
        }
    }

    private async reportCommandErrors(
        command: string,
        errorData: ExecException,
        { stdout, stderr }: { stdout: string; stderr: string },
        apiServer: string
    ): Promise<void> {
        const report: CommandErrorReport = {
            command,
            stderr: stderr,
            stdout: stdout,
            exitCode: errorData.code,
            stack: errorData.stack,
            message: errorData.message,
        };
        await fetch(`${apiServer}/api/agent/reporterror`, {
            method: 'POST',
            headers: {
                'Content-Type': 'Application/JSON',
            },
            body: JSON.stringify(report),
        });
    }

    private async setAsRan(location = '/var/local/cw/initran'): Promise<void> {
        writeFileSync(location, '1');
    }

    private configureLogger(location = '/var/log/cw/initagent.log'): void {
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

    private async initHostname(): Promise<void> {
        const res = await fetch(
            `${this.config.apiServer}/api/agent/inithostname`
        );
        const data: { status: 'ok' | 'forbidden'; hostname: string } =
            await res.json();

        if (data.status === 'ok') changeSystemHostname(data.hostname);
        else this.logger.error('Could not set hostname');
    }
}
