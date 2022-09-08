import { exec, ExecException } from 'child_process';
import Agent from '../Agent';
import { CommandErrorReport, ErrorReport } from '../lib/typing/types';
import { MessageDataResponse } from '../lib/typing/MessageData';
import { Task } from '../lib/typing/Task';
import { execAsync, getLastLines } from '../lib/utils';
import { ActualExecException, ExecReportError } from '../lib/typing/errors';
import Ticket from '../lib/typing/Ticket';
import { chmodSync, mkdtempSync, writeFileSync } from 'fs';
import { rm } from 'fs/promises';

export default class MessageRouting {
    [key: string]: (agent: Agent, task: Task) => Promise<void>;

    public static async shell_exec(agent: Agent, task: Task): Promise<void> {
        const commands: string[] = task.data.args.commands;
        for (const command of commands) {
            try {
                await execAsync(command).catch((err: ExecException) => {
                    const actualExecException = <ActualExecException>err;
                    throw new ExecReportError(actualExecException);
                });

                agent.logger.info(`Executed command ${command}`);

                const clientCommand: MessageDataResponse =
                    new MessageDataResponse({
                        taskid: task.id,
                        action: 'shell_exec',
                        args: {
                            status: 'success',
                        },
                    });

                agent.sendData(clientCommand);
            } catch (err: unknown) {
                if (err instanceof ExecReportError) {
                    const errorReport: CommandErrorReport = {
                        command,
                        stderr: err.execException.stderr,
                        stdout: err.execException.stdout,
                        exitCode: err.execException.code,
                        stack: err.execException.stack,
                        message: err.message,
                    };

                    agent.logger.error(
                        `Failed executing command ${command} - ${JSON.stringify(
                            errorReport
                        )}`
                    );

                    const clientCommand: MessageDataResponse =
                        new MessageDataResponse({
                            taskid: task.id,
                            action: 'shell_exec',
                            args: { status: 'error', errorReport },
                        });

                    agent.sendData(clientCommand);
                }
            }
        }
    }

    public static async send_logs(agent: Agent, task: Task): Promise<void> {
        try {
            const lines = getLastLines(
                agent.logFilePath,
                task.data.args.linesCount
            );

            const clientCommand: MessageDataResponse = new MessageDataResponse({
                taskid: task.id,
                action: 'send_logs',
                args: { status: 'success', lines },
            });

            agent.sendData(clientCommand);
        } catch (err) {
            agent.logger.error(
                `Failed to read ${task.data.args.linesCount} lines of log file`
            );

            const clientCommand: MessageDataResponse = new MessageDataResponse({
                taskid: task.id,
                action: 'send_logs',
                args: { status: 'error', lines: null },
            });

            agent.sendData(clientCommand);
        }
    }

    public static async change_password(agent: Agent, task: Task) {
        const password = task.data.args.password;

        try {
            await agent.changePassword(password);

            const clientCommand: MessageDataResponse = new MessageDataResponse({
                taskid: task.id,
                action: 'change_password',
                args: { status: 'success' },
            });

            agent.sendData(clientCommand);
        } catch (err) {
            const errorReport: ErrorReport = {
                message: err.message,
                stack: err.stack,
            };

            const clientCommand: MessageDataResponse = new MessageDataResponse({
                taskid: task.id,
                action: 'change_password',
                args: { status: 'error', errorReport },
            });

            agent.sendData(clientCommand);
        }
    }

    public static async create_ticket(agent: Agent, task: Task): Promise<void> {
        const ticket = task.data.args.ticket;
        agent.tickets.set(ticket.id, new Ticket(ticket));
    }

    public static async get_vscode_password(
        agent: Agent,
        task: Task
    ): Promise<void> {
        const clientCommand: MessageDataResponse = new MessageDataResponse({
            taskid: task.id,
            action: 'get_vscode_password',
            args: {
                status: 'success',
                password: agent.serviceJournal.get('vscode_token'),
            },
        });

        agent.sendData(clientCommand);
    }

    public static async shell_exec_sync(
        agent: Agent,
        task: Task
    ): Promise<void> {
        const script: string = task.data.args.script;
        try {
            const tmpDir = mkdtempSync('cw-', { encoding: 'utf-8' });
            const tmpScriptPath = `${tmpDir}/script.sh`;
            writeFileSync(tmpScriptPath, script, {
                encoding: 'utf-8',
                flag: 'w',
            });
            chmodSync(tmpScriptPath, 0o755);

            const shell = exec(`/bin/bash ${tmpScriptPath}`);

            shell.stdout.on('data', (data) => {
                const clientCommand: MessageDataResponse =
                    new MessageDataResponse({
                        taskid: task.id,
                        action: 'shell_exec_sync',
                        args: {
                            status: 'running',
                            output: String(data),
                            outputType: 'stdout',
                        },
                    });

                agent.sendData(clientCommand);
            });

            shell.stderr.on('data', (data) => {
                const clientCommand: MessageDataResponse =
                    new MessageDataResponse({
                        taskid: task.id,
                        action: 'shell_exec_sync',
                        args: {
                            status: 'running',
                            output: String(data),
                            outputType: 'stderr',
                        },
                    });

                agent.sendData(clientCommand);

                shell.kill('SIGKILL');
            });

            shell.on('exit', (code: number) => {
                const clientCommand: MessageDataResponse =
                    new MessageDataResponse({
                        taskid: task.id,
                        action: 'shell_exec_sync',
                        args: {
                            status: code === 0 ? 'success' : 'error',
                            exitCode: code,
                        },
                    });

                agent.sendData(clientCommand);
                agent.logger.info(
                    `Finished executing script with id: ${task.id}`
                );
            });

            // TODO: Handle timeout

            agent.logger.info(`Executed script with task id: ${task.id}`);
            rm(tmpDir, { recursive: true, force: true }).catch(() => {
                agent.logger.error('Could not delete temporary exec directory');
            });
            const clientCommand: MessageDataResponse = new MessageDataResponse({
                taskid: task.id,
                action: 'shell_exec_sync',
                args: {
                    status: 'running',
                },
            });

            agent.sendData(clientCommand);
        } catch (e) {
            agent.logger.error(
                `Failed executing script with task id: ${task.id}, with error: ${e}`
            );

            const clientCommand: MessageDataResponse = new MessageDataResponse({
                taskid: task.id,
                action: 'shell_exec_sync',
                args: {
                    status: 'error',
                    errorReport: {
                        message: e.message,
                        stack: e.stack,
                    },
                },
            });

            agent.sendData(clientCommand);
        }
    }
}
