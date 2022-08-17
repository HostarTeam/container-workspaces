import MessageRouting from '../../ws/MessageRouting';

export interface AgentConfiguration {
    apiServer: string;
    socketServer: string;
}

export interface ErrorReport {
    message: string;
    stack: string;
}

export interface CommandErrorReport extends ErrorReport {
    command: string;
    stderr: string;
    stdout: string;
    exitCode: number;
}

export type MessageRoutingHandler = MessageRouting[keyof MessageRouting];

export interface VSCodeConfiguration {
    token: string;
    port: number;
    host: string;
}
