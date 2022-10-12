import { IncomingMessage } from 'http';
import WebSocket from 'ws';
import ContainerWorkspaces from '../../../ContainerWorkspaces';
import { MessageDataResponse } from '../../typing/MessageData';
import MessageRouting from './MessageRouting';
import { MessageRoutingHandler } from '../../typing/types';

/**
 * Handle a ws command
 */
export async function wsCommand(
    this: ContainerWorkspaces,
    req: IncomingMessage,
    messageData: MessageDataResponse,
    socket: WebSocket
): Promise<void> {
    const handle: MessageRoutingHandler | undefined =
        MessageRouting[messageData.action];

    const task = await this.getTask(messageData.taskid);
    if (!task) return;

    const reqIp = req.socket.remoteAddress;
    const specifiedContainerIp = await this.proxmoxClient.getContainerIP(
        task.containerID
    );

    if (reqIp !== specifiedContainerIp) return;

    if (handle) handle(this, req, messageData, socket);
}
