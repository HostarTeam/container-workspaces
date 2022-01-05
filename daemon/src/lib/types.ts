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
