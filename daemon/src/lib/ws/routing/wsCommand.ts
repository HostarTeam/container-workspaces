import { IncomingMessage } from 'http';
import WebSocket from 'ws';
import ContainerWorkspaces from '../../../ContainerWorkspaces';
import { MessageData } from '../../typing/MessageData';
import MessageRouting from './MessageRouting';
import { MessageRoutingHandler } from '../../typing/types';

export async function wsCommand(
    this: ContainerWorkspaces,
    req: IncomingMessage,
    messageData: MessageData,
    socket: WebSocket
): Promise<void> {
    const handle: MessageRoutingHandler | undefined =
        MessageRouting[messageData.action];

    if (handle) handle(this, req, messageData, socket);
    else console.log(`Unknown action ${messageData.action}`);
}
