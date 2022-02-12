import { IncomingMessage } from 'http';
import WebSocket from 'ws';
import ContainerWorkspaces from '../../../ContainerWorkspaces';
import { MessageDataResponse } from '../../typing/MessageData';
import { Task } from '../../typing/Task';

/* I shouldn't do this but there's a bug in eslint.
 As you can see, this variable is clearly used but it marks it as not used. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type MessageRouter = (
    cw: ContainerWorkspaces,
    req: IncomingMessage,
    messageData: MessageDataResponse,
    socket: WebSocket
) => Promise<void>;

export default class MessageRouting {
    [key: string]: MessageRouter;

    public static async shell_exec(
        cw: ContainerWorkspaces,
        req: IncomingMessage,
        messageData: MessageDataResponse
    ): Promise<void> {
        const task: Task = await cw.getTask(messageData.taskid);
        if (!task) return;
        if (
            messageData.args?.status === 'error' &&
            messageData.args?.errorReport
        ) {
            cw.errorTask(
                task.id,
                <Error>(<unknown>messageData.args.errorReport)
            );
            cw.wsLogger.error(
                `Error in agent with id ${task.containerID} in task ${task.id} - ${messageData.args.errorReport.message}`
            );
        } else {
            cw.wsLogger.info(
                `Succeded agent with id ${task.containerID} in task ${task.id} - ${messageData.args.status}`
            );

            cw.finishTask(task.id);
        }
    }

    public static async send_logs(
        cw: ContainerWorkspaces,
        req: IncomingMessage,
        messageData: MessageDataResponse
    ): Promise<void> {
        const task: Task = await cw.getTask(messageData.taskid);
        if (!task) return;
        if (
            messageData.args?.status === 'error' &&
            messageData.args?.errorReport
        ) {
            cw.errorTask(
                task.id,
                <Error>(<unknown>messageData.args.errorReport)
            );
            cw.wsLogger.error(
                `Error in agent with id ${task.containerID} in task ${task.id} - ${messageData.args.errorReport.message}`
            );
        } else {
            cw.logLines.set(task.id, messageData.args.lines.join());
            cw.wsLogger.info(
                `Succeded agent with id ${task.containerID} in task ${task.id} - ${messageData.args.status}`
            );
            cw.finishTask(task.id);
        }
    }

    public static async change_password(
        cw: ContainerWorkspaces,
        req: IncomingMessage,
        messageData: MessageDataResponse
    ): Promise<void> {
        const task: Task = await cw.getTask(messageData.taskid);
        if (!task) return;
        if (
            messageData.args?.status === 'error' &&
            messageData.args?.errorReport
        ) {
            cw.errorTask(
                task.id,
                <Error>(<unknown>messageData.args.errorReport)
            );
            cw.wsLogger.error(
                `Error in agent with id ${task.containerID} in task ${task.id} - ${messageData.args.errorReport.message}`
            );
        } else {
            cw.wsLogger.info(
                `Succeded agent with id ${task.containerID} in task ${task.id} - ${messageData.args.status}`
            );
            cw.finishTask(task.id);
        }
    }
}
