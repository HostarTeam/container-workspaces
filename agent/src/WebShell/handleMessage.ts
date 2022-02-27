import WebShell from './WebShell';
import MessageRouting from './MessageRouting';
import { WebSocket, RawData } from 'ws';

export function handleMessage(
    this: WebShell,
    socket: WebSocket,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    message: RawData
): void {
    try {
        const data = JSON.parse(message.toString());
        const dataMessage = data.data;

        const handle = MessageRouting[data.action];

        if (handle) handle(this, socket, dataMessage);
    } catch (err: unknown) {
        if (err instanceof SyntaxError) {
            this.logger.error(
                `Could not parse command content from user in webshell. Content: ${message.toString()} `
            );
        }
    }
}
