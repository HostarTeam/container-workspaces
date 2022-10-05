import type MessageRouting from '../../ws/MessageRouting';
import type Service from '../services/baseService';
import type VSCode from '../services/vscode';
import type WebShell from '../services/webshell';

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

export interface WebShellConfiguration {
    token: string;
    port: number;
    host: string;
}

export interface Services extends Record<string, Service> {
    vscode: VSCode;
    webshell: WebShell;
}
