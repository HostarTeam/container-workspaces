import { IncomingMessage } from 'http';
import WebSocket from 'ws';
import ContainerWorkspaces from '../../../ContainerWorkspaces';
import { MessageData } from '../../typing/MessageData';
import { Task } from '../../typing/Task';

export default class MessageRouting {
    [key: string]: MessageRouter;

    public static async shell_exec(
        cw: ContainerWorkspaces,
        req: IncomingMessage,
        messageData: MessageData,
        socket: WebSocket
    ): Promise<void> {
        [cw, req, messageData, socket];
        if (
            messageData.args?.status === 'error' &&
            messageData.args?.errorReport
        ) {
            const task: Task = await cw.getTask(messageData.args.taskid);
            console.log('d');
            if (!task) return;

            cw.wsLogger.error(
                `Error in agent with address ${task.ipaddr} in task ${task.id} - ${messageData.args.errorReport.message}`
            );
            console.log('e');
        } else {
        }
    }
}

type MessageRouter = (
    cw: ContainerWorkspaces,
    req: IncomingMessage,
    messageData: MessageData,
    socket: WebSocket
) => Promise<void>;
