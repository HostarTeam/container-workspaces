import { IncomingMessage } from 'http';
import WebSocket from 'ws';
import MessageRouting from './MessageRouting';
import { DaemonToClientCommand } from '../lib/typing/DaemonToClientCommand';
import Agent from '../Agent';
import { MessageRoutingHandler } from '../lib/typing/types';

export async function wsCommand(
    this: Agent,
    commandData: DaemonToClientCommand
): Promise<void> {
    const handle: MessageRoutingHandler | undefined =
        MessageRouting[commandData.action];

    if (handle) handle(this, commandData);
}
