import WebSocket from 'ws';
import ContainerWorkspaces from '../../ContainerWorkspaces';
import { Task } from '../typing/Task';

export function sendCommandToAgent(
    this: ContainerWorkspaces,
    task: Task
): void {
    const clientList: WebSocket[] = Array.from(this.wss.clients);

    const selectedClient: WebSocket = clientList.find(
        (client: any) => client._socket.remoteAddress === task.ipaddr
    );

    if (!selectedClient)
        throw new ClientNotFoundError(
            `Could not find a client with address ${task.ipaddr}`
        );

    selectedClient.send(JSON.stringify(task));

    this.addTask(task);
}

export class ClientNotFoundError extends Error {
    constructor(public message: string) {
        super();
        this.name = 'ClientNotFoundError';
    }
}
