import { httpProtocol } from '../typing/types';
import { getNodesName, printSuccess } from '../utils';
import {
    call,
    createCTContainer,
    createCTContainerInProxmox,
    getAuthKeys,
    getNodeByLocation,
    getNodeIP,
    getNodes,
    getFirstFineNode,
    checkIfNodeIsFine,
} from './apiTools';
import { Node } from '../typing/types';
import { Logger } from 'log4js';
import ContainerWorkspaces from '../../ContainerWorkspaces';
import { SQLNode } from '../typing/types';

export default class ProxmoxConnection {
    protected hostname: string;
    protected protocol: httpProtocol;
    protected username: string;
    protected password: string;
    protected port: number;
    protected basicURL: string;
    protected pveLogger: Logger;
    protected mysqlConnection: any;

    protected authCookie: string = '';
    protected csrfPreventionToken: string = '';
    protected getAuthKeys: () => Promise<void> = getAuthKeys;
    protected call: (path: string, method: string, body?: any) => Promise<any> =
        call;
    public getNodes: () => Promise<Node[]> = getNodes;
    public getNodesName: () => Promise<string[]> = getNodesName;
    public createCTContainer: () => Promise<void> = createCTContainer;
    public getNodeIP: (node: string) => Promise<string> = getNodeIP;
    public getNodeByLocation: (Location: string) => Promise<string> =
        getNodeByLocation;
    protected createCTContainerInProxmox: (options: any) => Promise<void> =
        createCTContainerInProxmox;
    protected getFirstFineNode: (nodes: SQLNode[]) => Promise<string> =
        getFirstFineNode;
    protected checkIfNodeIsFine: (nodename: string) => Promise<boolean> =
        checkIfNodeIsFine;

    constructor({
        hostname,
        protocol,
        username,
        password,
        port = 8006,
        pveLogger,
        mysqlConnection,
    }) {
        this.hostname = hostname;
        this.protocol = protocol;
        this.username = username;
        this.password = password;
        this.port = port;
        this.pveLogger = pveLogger;
        this.mysqlConnection = mysqlConnection;
        this.intialize();
        this.connect().then(async () => {});
    }

    private intialize() {
        if (this.port != 80)
            this.basicURL = `${this.protocol}://${this.hostname}:${this.port}/api2/json`;
        else this.basicURL = `${this.protocol}://${this.hostname}/api2/json`;
    }

    private async connect() {
        await this.getAuthKeys();
        this.pveLogger.info(
            `Connected successfully to ${this.protocol}://${this.hostname}:${this.port}/`
        );
        printSuccess('Connect successfully!');
    }
}
