import { IncomingMessage } from 'http';
import WebSocket, { RawData } from 'ws';
import Agent from '../Agent';
import {
    InvalidCommandError,
    DaemonToClientCommand,
} from '../lib/typing/DaemonToClientCommand';

export function handleMessage(this: Agent, message: RawData): void {
    try {
        const commandJSON = JSON.parse(message.toString());
        const commandData = new DaemonToClientCommand(commandJSON);
        this.logger.info(`${commandData.action} - ${commandData.method}`);
        this.wsCommand(commandData);
    } catch (err: unknown) {
        if (err instanceof SyntaxError) {
            this.logger.error(
                `Could not parse command content from daemon. Content: ${message.toString()} `
            );
        } else if (err instanceof InvalidCommandError) {
            this.logger.error(`Invalid command data from daemon - ${err}`);
        } else {
            this.logger.error(err);
        }
    }
}
