import { IncomingMessage } from 'http';
import WebSocket from 'ws';
import ContainerWorkspaces from '../../../ContainerWorkspaces';
import { MessageData, MessageDataResponse } from '../../typing/MessageData';
import { Task } from '../../typing/Task';

export default class MessageRouting {
    [key: string]: MessageRouter;

    public static async shell_exec(
        cw: ContainerWorkspaces,
        req: IncomingMessage,
        messageData: MessageDataResponse,
        socket: WebSocket
    ): Promise<void> {
        const task: Task = await cw.getTask(messageData.taskid);
        if (!task) return;
        if (
            messageData.args?.status === 'error' &&
            messageData.args?.errorReport
        ) {
            cw.errorTask(task.id, <Error>messageData.args.errorReport);
            cw.wsLogger.error(
                `Error in agent with id ${task.containerID} in task ${task.id} - ${messageData.args.errorReport.message}`
            );
        } else {
            // cw.updateTask(messageData);
            cw.wsLogger.info(
                `Succeded agent with id ${task.containerID} in task ${task.id} - ${messageData.args.status}`
            );
        }
    }

    public static async send_logs(
        cw: ContainerWorkspaces,
        req: IncomingMessage,
        messageData: MessageDataResponse,
        socket: WebSocket
    ): Promise<void> {
        const task: Task = await cw.getTask(messageData.taskid);
        if (!task) return;
        if (
            messageData.args?.status === 'error' &&
            messageData.args?.errorReport
        ) {
            cw.errorTask(task.id, <Error>messageData.args.errorReport);
            cw.wsLogger.error(
                `Error in agent with id ${task.containerID} in task ${task.id} - ${messageData.args.errorReport.message}`
            );
        } else {
            cw.loglines.set(task.id, messageData.args.lines);
            // cw.updateTask(messageData);
            cw.wsLogger.info(
                `Succeded agent with id ${task.containerID} in task ${task.id} - ${messageData.args.status}`
            );
        }
    }
}

type MessageRouter = (
    cw: ContainerWorkspaces,
    req: IncomingMessage,
    messageData: MessageData,
    socket: WebSocket
) => Promise<void>;
