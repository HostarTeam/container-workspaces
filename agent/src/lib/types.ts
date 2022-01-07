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
