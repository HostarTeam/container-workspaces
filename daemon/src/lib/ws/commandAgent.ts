import WebSocket from 'ws';
import ContainerWorkspaces from '../../ContainerWorkspaces';
import { Task } from '../typing/Task';

export async function sendTaskToAgent(
    this: ContainerWorkspaces,
    task: Task,
    ipaddr: string
): Promise<void> {
    const clientList: WebSocket[] = Array.from(this.wss.clients);

    const selectedClient: WebSocket = clientList.find(
        (client: any) => client._socket.remoteAddress === ipaddr
    );

    if (!selectedClient)
        throw new ClientNotFoundError(
            `Could not find a client with address ${ipaddr}`
        );

    await this.addTask(task);
    selectedClient.send(JSON.stringify(task));
}

export class ClientNotFoundError extends Error {
    constructor(public message: string) {
        super();
        this.name = 'ClientNotFoundError';
    }
}
