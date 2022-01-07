import { httpProtocol } from '../typing/types';
import { getNodesName, printSuccess } from '../utils';
import { call, getAuthKeys, getNodes } from './apiTools';
import { Node } from '../typing/types';
import { Logger } from 'log4js';

export default class ProxmoxConnection {
    protected hostname: string;
    protected protocol: httpProtocol;
    protected username: string;
    protected password: string;
    protected port: number;
    protected basicURL: string;
    protected pveLogger: Logger;

    public authCookie: string = '';
    protected csrfPreventionToken: string = '';
    protected getAuthKeys: () => Promise<void> = getAuthKeys;
    protected call: (
        path: string,
        method: string,
        body?: string
    ) => Promise<any> = call;
    public getNodes: () => Promise<Node[]> = getNodes;
    public getNodesName: () => Promise<string[]> = getNodesName;

    constructor({
        hostname,
        protocol,
        username,
        password,
        port = 8006,
        pveLogger,
    }) {
        this.hostname = hostname;
        this.protocol = protocol;
        this.username = username;
        this.password = password;
        this.port = port;
        this.pveLogger = pveLogger;
        this.intialize();
        this.connect().then(() => {});
    }

    private intialize() {
        if (this.port != 80)
            this.basicURL = `${this.protocol}://${this.hostname}:${this.port}/api2/json`;
        else this.basicURL = `${this.protocol}://${this.hostname}/api2/json`;
    }

    private async connect() {
        await this.getAuthKeys();
        printSuccess('Connect successfully!');
    }
}
