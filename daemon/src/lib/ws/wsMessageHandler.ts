import { IncomingMessage } from 'http';
import WebSocket, { RawData } from 'ws';
import ContainerWorkspaces from '../../ContainerWorkspaces';
import { InvalidMessageError, MessageData } from '../typing/MessageData';
import { printError } from '../utils';
import { wsCommand } from './routing/wsCommand';

export function handleMessage(
    this: ContainerWorkspaces,
    message: RawData,
    req: IncomingMessage,
    socket: WebSocket
): void {
    try {
        const messageJSON = JSON.parse(message.toString());
        const messageData = new MessageData(messageJSON);
        this.wsLogger.info(
            `${req.socket.remoteAddress} - ${messageData.action} - ${messageData.method}`
        );
        this.wsCommand(req, messageData, socket);
    } catch (err: unknown) {
        if (err instanceof SyntaxError) {
            printError(
                `Could not parse message content from ${
                    req.socket.remoteAddress
                }. Message content: ${message.toString()} `
            );
        } else if (err instanceof InvalidMessageError) {
            printError(err.message);
        } else {
            printError('Unknown error');
        }
    }
}
