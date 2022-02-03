import { RawData } from 'ws';
import Agent from '../Agent';
import { InvalidMessageError, MessageData } from '../lib/typing/MessageData';
import { Task } from '../lib/typing/Task';

export function handleMessage(this: Agent, message: RawData): void {
    try {
        const commandJSON = JSON.parse(message.toString());
        const commandData = new Task(commandJSON);
        const data: MessageData = new MessageData(commandData.data);
        this.logger.info(
            `${commandData.id} - ${data.action}${
                data.method && ` - ${data.method}`
            }`
        );
        this.wsCommand(commandData);
    } catch (err: unknown) {
        if (err instanceof SyntaxError) {
            this.logger.error(
                `Could not parse command content from daemon. Content: ${message.toString()} `
            );
        } else if (err instanceof InvalidMessageError) {
            this.logger.error(`Invalid command data from daemon - ${err}`);
        } else {
            this.logger.error(err);
        }
    }
}
