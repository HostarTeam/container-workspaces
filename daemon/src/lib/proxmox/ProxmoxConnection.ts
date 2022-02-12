import { Logger } from 'log4js';
import { httpProtocol } from '../typing/types';
import MySQLClient from '../database/MySQLClient';
import { getNodesName, printSuccess } from '../util/utils';
import {
    addCotainerToDatabase,
    addIPToDatabase,
    addNodeToDatabase,
    call,
    changeContainerStatus,
    changeCTHostname,
    checkIfNodeIsFine,
    createContainer,
    createContainerInProxmox,
    deleteContainer,
    deleteContainerFromDB,
    getAuthKeys,
    getAvailableLocations,
    getContainerInfo,
    getContainerIP,
    getContainers,
    getContainerStatus,
    getContainerStatuses,
    getFirstFineNode,
    getFreeIP,
    getIP,
    getIPs,
    getLocations,
    getNodeByLocation,
    getNodeIP,
    getNodeOfContainer,
    getNodes,
    getPVENode,
    getSQLNode,
    getSQLNodes,
    removeIPFromDatabase,
    removeNodeFromDatabase,
    setCTAsReady,
    updateIPUsedStatus,
} from './apiTools';

export default class ProxmoxConnection {
    protected hostname: string;
    protected protocol: httpProtocol;
    protected username: string;
    protected password: string;
    protected port: number;
    protected basicURL: string;
    protected pveLogger: Logger;
    protected mySQLClient: MySQLClient;

    protected authCookie = '';
    protected csrfPreventionToken = '';
    protected getAuthKeys = getAuthKeys;
    protected call = call;
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
    protected deleteContainerFromDB = deleteContainerFromDB;
    public getContainerIP = getContainerIP;
    public getNodeOfContainer = getNodeOfContainer;
    public getContainerInfo = getContainerInfo;
    public getContainerStatus = getContainerStatus;
    public changeContainerStatus = changeContainerStatus;
    public deleteContainer = deleteContainer;
    public getPVENode = getPVENode;
    public getSQLNodes = getSQLNodes;
    public addNodeToDatabase = addNodeToDatabase;
    public removeNodeFromDatabase = removeNodeFromDatabase;
    public getLocations = getLocations;
    public getAvailableLocations = getAvailableLocations;
    public getSQLNode = getSQLNode;
    public getIP = getIP;
    public getIPs = getIPs;
    public addIPToDatabase = addIPToDatabase;
    public removeIPFromDatabase = removeIPFromDatabase;
    public changeCTHostname = changeCTHostname;
    public setCTAsReady = setCTAsReady;
    public getContainers = getContainers;
    public getContainerStatuses = getContainerStatuses;

    constructor({
        hostname,
        protocol,
        username,
        password,
        port = 8006,
        pveLogger,
        mySQLClient,
    }: {
        hostname: string;
        protocol: httpProtocol;
        username: string;
        password: string;
        port?: number;
        pveLogger: Logger;
        mySQLClient: MySQLClient;
    }) {
        this.hostname = hostname;
        this.protocol = protocol;
        this.username = username;
        this.password = password;
        this.port = port;
        this.pveLogger = pveLogger;
        this.mySQLClient = mySQLClient;
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
