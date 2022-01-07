import WebSocket from 'ws';
import ContainerWorkspaces from '../../ContainerWorkspaces';
import { MessageData } from '../typing/MessageData';

export function sendMessageToAgent(
    this: ContainerWorkspaces,
    agentAddress: string,
    messageData: MessageData
): void {
    const clientList: WebSocket[] = Array.from(this.wss.clients);

    const selectedClient: WebSocket = clientList.find(
        (client) => (client as any)._socket.remoteAddress
    );

    if (!selectedClient)
        throw new ClientNotFoundError(
            `Could not find a client with address ${agentAddress}`
        );

    selectedClient.send(JSON.stringify(messageData));
}

export class ClientNotFoundError extends Error {
    constructor(public message: string) {
        super();
        this.name = 'ClientNotFoundError';
    }
}
