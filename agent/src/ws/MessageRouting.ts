import { execSync } from 'child_process';
import Agent from '../Agent';
import { DaemonToClientCommand } from '../lib/typing/DaemonToClientCommand';
import { CommandErrorReport } from '../lib/typing/types';
import { MessageData } from '../lib/typing/MessageData';

export default class MessageRouting {
    [key: string]: (
        agent: Agent,
        messageData: DaemonToClientCommand
    ) => Promise<void>;

    public static async shell_exec(
        agent: Agent,
        messageData: DaemonToClientCommand
    ): Promise<void> {
        const commands: string = messageData.args.commands;
        for (const command of commands) {
            try {
                await execSync(command, {
                    stdio: 'pipe',
                });

                agent.logger.info(`Executed command ${command}`);

                const commandSuccess: MessageData = {
                    action: 'shell_exec',
                    args: {
                        status: 'success',
                    },
                };

                agent.ws.send(JSON.stringify(commandSuccess));
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

                const clientCommand: MessageData = new MessageData({
                    action: 'shell_exec',
                    args: { status: 'error', errorReport },
                });

                agent.ws.send(JSON.stringify(clientCommand));
            }
        }
    }
}
