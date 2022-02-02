import MessageRouting from './MessageRouting';
import Agent from '../Agent';
import { MessageRoutingHandler } from '../lib/typing/types';
import { Task } from '../lib/typing/Task';

export async function wsCommand(this: Agent, commandData: Task): Promise<void> {
    const handle: MessageRoutingHandler | undefined =
        MessageRouting[commandData.data.action];

    if (handle) handle(this, commandData);
}
