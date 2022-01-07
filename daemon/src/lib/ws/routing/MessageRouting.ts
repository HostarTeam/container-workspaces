import { IncomingMessage } from 'http';
import WebSocket from 'ws';
import ContainerWorkspaces from '../../../ContainerWorkspaces';
import { MessageData } from '../../typing/MessageData';

export default class MessageRouting {
    [key: string]: (
        cw: ContainerWorkspaces,
        req: IncomingMessage,
        messageData: MessageData,
        socket: WebSocket
    ) => Promise<void>;
    public static async command_success(
        cw: ContainerWorkspaces,
        req: IncomingMessage,
        messageData: MessageData,
        socket: WebSocket
    ): Promise<void> {
        console.log(1);
    }
}
