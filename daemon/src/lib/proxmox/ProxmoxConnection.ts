import { MySQLClient } from '@hostarteam/mysqlclient';
import { Agent } from 'https';
import { Logger } from 'log4js';
import ContainerWorkspaces from '../../ContainerWorkspaces';
import { httpProtocol } from '../typing/types';
import { getNodesName, printSuccess } from '../util/utils';
import {
    addCotainerToDatabase,
    addIPToDatabase,
    addNodeToDatabase,
    call,
    changeContainerStatus,
    changeCTHostname,
    createBackup,
    createContainer,
    createContainerInProxmox,
    deleteBackup,
    deleteContainer,
    deleteContainerFromDB,
    deleteSnapshot,
    getAuthKeys,
    getAvailableLocations,
    getBackups,
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
    getResources,
    getSnapshotLXC,
    getSnapshots,
    getSQLNode,
    getSQLNodes,
    getStorageNames,
    getStorageNamesAndAvailSize,
    getStorageOfBackup,
    getStorages,
    removeIPFromDatabase,
    removeNodeFromDatabase,
    restoreBackup,
    returnNodeIfFine,
    scoreNode,
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
    protected cw: ContainerWorkspaces;
    protected httpsAgent: Agent | undefined;
    protected verifyCertificate: boolean;

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
    protected returnIfNodeIsFine = returnNodeIfFine;
    protected getFreeIP = getFreeIP;
    protected updateIPUsedStatus = updateIPUsedStatus;
    protected addCotainerToDatabase = addCotainerToDatabase;
    protected deleteContainerFromDB = deleteContainerFromDB;
    protected getStorages = getStorages;
    protected getStorageNamesAndAvailSize = getStorageNamesAndAvailSize;
    protected getStorageNames = getStorageNames;
    protected getStorageOfBackup = getStorageOfBackup;
    protected getResources = getResources;
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
    public scoreNode = scoreNode;
    public createBackup = createBackup;
    public deleteBackup = deleteBackup;
    public restoreBackup = restoreBackup;
    public getBackups = getBackups;
    public getSnapshots = getSnapshots;
    public getSnapshotLXC = getSnapshotLXC;
    public deleteSnapshot = deleteSnapshot;

    constructor({
        hostname,
        protocol,
        username,
        password,
        port = 8006,
        pveLogger,
        mySQLClient,
        cw,
        verifyCertificate = true,
    }: {
        hostname: string;
        protocol: httpProtocol;
        username: string;
        password: string;
        port?: number;
        pveLogger: Logger;
        mySQLClient: MySQLClient;
        cw: ContainerWorkspaces;
        verifyCertificate: boolean;
    }) {
        this.cw = cw;
        this.hostname = hostname;
        this.protocol = protocol;
        this.username = username;
        this.password = password;
        this.port = port;
        this.pveLogger = pveLogger;
        this.mySQLClient = mySQLClient;
        this.verifyCertificate = verifyCertificate;

        this.intialize();
        this.connect().then(() => {
            printSuccess('Connected to the PVE api');
        });
    }

    /**
     * Initialize the proxmox api server.
     * @private
     * @method
     * @returns {void}
     */
    private intialize(): void {
        if (this.port != 80)
            this.basicURL = `${this.protocol}://${this.hostname}:${this.port}/api2/extjs`;
        else this.basicURL = `${this.protocol}://${this.hostname}/api2/extjs`;

        if (this.protocol === 'https' && !this.verifyCertificate) {
            this.httpsAgent = new Agent({ rejectUnauthorized: false });
        }
    }

    /**
     * Connect to the proxmox api server and get the API keys.
     * @private
     * @method
     * @async
     * @returns {Promise<void>}
     */
    private async connect(): Promise<void> {
        await this.getAuthKeys();
        this.pveLogger.info(
            `Connected successfully to ${this.protocol}://${this.hostname}:${this.port}/`
        );
    }
}
