import { IncomingMessage } from 'http';
import WebSocket from 'ws';
import ContainerWorkspaces from '../../../ContainerWorkspaces';
import { MessageDataResponse } from '../../typing/MessageData';

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
        const task = await cw.getTask(messageData.taskid);
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
        const task = await cw.getTask(messageData.taskid);
        if (!task) return;
        if (
            messageData.args?.status === 'error' &&
            messageData.args?.errorReport
        ) {
            cw.wsEventEmitter.emit(String(task.id));
            cw.errorTask(
                task.id,
                <Error>(<unknown>messageData.args.errorReport)
            );
            cw.wsLogger.error(
                `Error in agent with id ${task.containerID} in task ${task.id} - ${messageData.args.errorReport.message}`
            );
        } else {
            cw.wsEventEmitter.emit(String(task.id), messageData.args.lines);
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
        const task = await cw.getTask(messageData.taskid);
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

    public static async get_service_auth_token(
        cw: ContainerWorkspaces,
        req: IncomingMessage,
        messageData: MessageDataResponse
    ): Promise<void> {
        const task = await cw.getTask(messageData.taskid);
        if (!task) return;
        if (
            messageData.args?.status === 'error' &&
            messageData.args?.errorReport
        ) {
            cw.wsEventEmitter.emit(String(task.id));
            cw.errorTask(
                task.id,
                <Error>(<unknown>messageData.args.errorReport)
            );
            cw.wsLogger.error(
                `Error in agent with id ${task.containerID} in task ${task.id} - ${messageData.args.errorReport.message}`
            );
        } else {
            cw.wsEventEmitter.emit(String(task.id), messageData.args.auth);
            cw.wsLogger.info(
                `Succeded agent with id ${task.containerID} in task ${task.id} - ${messageData.args.status}`
            );
            cw.finishTask(task.id);
        }
    }

    public static async shell_exec_sync(
        cw: ContainerWorkspaces,
        req: IncomingMessage,
        messageData: MessageDataResponse
    ): Promise<void> {
        const task = await cw.getTask(messageData.taskid);
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
            return;
        }

        const socketID = cw.taskToSocketId.get(task.id);

        if (messageData.args?.status === 'running') {
            cw.io.to(socketID).emit('shell_exec_started', process.pid);
            return;
        }

        if (messageData.args?.exitCode !== undefined) {
            cw.io
                .to(socketID)
                .emit(
                    'shelll_exec_finished',
                    messageData.args?.status,
                    messageData.args?.exitCode
                );
            return;
        }

        cw.io
            .to(socketID)
            .emit(
                'shell_exec_output',
                messageData.args.output,
                messageData.args.outputType
            );
    }
}
