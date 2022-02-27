import ContainerWorkspaces from '../../ContainerWorkspaces';
import Task from '../entities/Task';

/**
 * Send a task to an agent
 * @async
 * @param  {Task} task
 * @param  {string} ipaddr
 * @returns {Promise<void>}
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

    await this.addTask(task);
    selectedClient.send(JSON.stringify(task));
}

export class ClientNotFoundError extends Error {
    constructor(public message: string) {
        super();
        this.name = 'ClientNotFoundError';
    }
}
