import { IncomingMessage } from 'http';
import WebSocket from 'ws';
import ContainerWorkspaces from '../../../ContainerWorkspaces';
import { MessageDataResponse } from '../../typing/MessageData';
import MessageRouting from './MessageRouting';
import { MessageRoutingHandler } from '../../typing/types';

/**
 * Handle a ws command
 * @async
 * @param  {IncomingMessage} req
 * @param  {MessageDataResponse} messageData
 * @param  {WebSocket} socket
 * @returns {Promise<void>}
 */
export async function wsCommand(
    this: ContainerWorkspaces,
    req: IncomingMessage,
    messageData: MessageDataResponse,
    socket: WebSocket
): Promise<void> {
    const handle: MessageRoutingHandler | undefined =
        MessageRouting[messageData.action];

    if (handle) handle(this, req, messageData, socket);
}
