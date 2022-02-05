import { httpProtocol } from '../typing/types';
import { getNodesName, printSuccess } from '../utils';
import {
    call,
    createContainer,
    createContainerInProxmox,
    getAuthKeys,
    getNodeByLocation,
    getNodeIP,
    getNodes,
    getFirstFineNode,
    checkIfNodeIsFine,
    getContainerIP,
    getNodeOfContainer,
    getContainerInfo,
    getContainerStatus,
    changeContainerStatus,
    deleteContainer,
    getFreeIP,
    updateIPUsedStatus,
    addCotainerToDatabase,
    getIP,
    deleteContainerFromDB,
} from './apiTools';
import { Logger } from 'log4js';

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
    protected getAuthKeys = getAuthKeys;
    protected call: (path: string, method: string, body?: any) => Promise<any> =
        call;
    public getNodes = getNodes;
    public getNodesName = getNodesName;
    public createContainer = createContainer;
    public getNodeIP = getNodeIP;
    public getNodeByLocation = getNodeByLocation;
    protected createContainerInProxmox = createContainerInProxmox;
    protected getFirstFineNode = getFirstFineNode;
    protected checkIfNodeIsFine = checkIfNodeIsFine;
    protected getFreeIP = getFreeIP;
    protected updateIPUsedStatus = updateIPUsedStatus;
    protected addCotainerToDatabase = addCotainerToDatabase;
    protected getIP = getIP;
    protected deleteContainerFromDB = deleteContainerFromDB;
    public getContainerIP = getContainerIP;
    public getNodeOfContainer = getNodeOfContainer;
    public getContainerInfo = getContainerInfo;
    public getContainerStatus = getContainerStatus;
    public changeContainerStatus = changeContainerStatus;
    public deleteContainer = deleteContainer;

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
        this.connect().then(() => {
            printSuccess('Connected to the PVE api');
        });
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
    }
}
