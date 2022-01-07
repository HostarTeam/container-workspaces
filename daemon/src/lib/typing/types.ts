import MessageRouting from '../ws/routing/MessageRouting';

export interface Configuration {
    apiKey: string;
    address: string;
    port: number;
    dockerNetworkInterface: string;
}

export type httpProtocol = 'http' | 'https';

export interface Node {
    node: string;
    status: 'unknown' | 'online' | 'offline';
    cpu: number;
    level: string;
    maxcpu: number;
    maxmem: number;
    mem: number;
    ssl_fingerprint: string;
    uptime: number;
}

export interface CommandError {
    command: string;
    stderr: string;
    stdout: string;
    exitCode: number;
    stack: string;
    message: string;
}

export type CommandType = 'realtime' | 'init';

export type MessageRoutingHandler = MessageRouting[keyof MessageRouting];
