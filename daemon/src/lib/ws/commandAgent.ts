import { Task } from '@prisma/client';
import ContainerWorkspaces from '../../ContainerWorkspaces';

/**
 * Send a task to an agent
 */
export async function sendTaskToAgent(
    this: ContainerWorkspaces,
    task: Task,
    ipaddr: string
): Promise<void> {
    const selectedClient = this.getConnectedClient(ipaddr);

    if (!selectedClient)
        throw new ClientNotFoundError(
            `Could not find a client with address ${ipaddr}`
        );

    selectedClient.send(JSON.stringify(task));
}

export class ClientNotFoundError extends Error {
    constructor(public message: string) {
        super();
        this.name = 'ClientNotFoundError';
    }
}
