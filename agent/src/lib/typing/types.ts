import MessageRouting from '../../ws/MessageRouting';

export interface AgentConfiguration {
    apiServer: string;
    socketServer: string;
}

export interface CommandErrorReport {
    command: string;
    stderr: string;
    stdout: string;
    exitCode: number;
    stack: string;
    message: string;
}

export type MessageRoutingHandler = MessageRouting[keyof MessageRouting];
