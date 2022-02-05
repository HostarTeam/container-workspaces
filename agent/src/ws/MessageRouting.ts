import { execSync } from 'child_process';
import Agent from '../Agent';
import { CommandErrorReport, ErrorReport } from '../lib/typing/types';
import { MessageDataResponse } from '../lib/typing/MessageData';
import { Task } from '../lib/typing/Task';
import { getLastLines } from '../lib/utils';

export default class MessageRouting {
    [key: string]: (agent: Agent, task: Task) => Promise<void>;

    public static async shell_exec(agent: Agent, task: Task): Promise<void> {
        const commands: string = task.data.args.commands;
        for (const command of commands) {
            try {
                await execSync(command, {
                    stdio: 'pipe',
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
            } catch (err: any) {
                const errorReport: CommandErrorReport = {
                    command,
                    stderr: err.stderr.toString(),
                    stdout: err.stdout.toString(),
                    exitCode: err.status,
                    stack: err.stack,
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
}
