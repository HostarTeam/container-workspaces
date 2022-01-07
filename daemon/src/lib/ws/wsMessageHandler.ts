import { IncomingMessage } from 'http';
import WebSocket, { RawData } from 'ws';
import ContainerWorkspaces from '../../ContainerWorkspaces';
import { InvalidMessageError, MessageData } from '../typing/MessageData';
import { printError } from '../utils';

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
            this.wsLogger.error(
                `Could not parse message content from ${
                    req.socket.remoteAddress
                }. Message content: ${message.toString()} `
            );
        } else if (err instanceof InvalidMessageError) {
            this.wsLogger.error(
                `Invalid message data from ${req.socket.remoteAddress} - ${err}`
            );
        } else {
            this.wsLogger.error(err);
        }
    }
}
