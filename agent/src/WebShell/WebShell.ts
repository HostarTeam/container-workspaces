import { WebSocket, WebSocketServer, RawData } from 'ws';
import { Logger } from 'log4js';
import { AgentConfiguration } from '../lib/typing/types';
import PTYService from './PTYService';
import { getSocketID } from '../lib/utils';
import { handleMessage } from './handleMessage';

export interface WebShellOptions {
    config: AgentConfiguration;
    logger: Logger;
}

export default class WebShell {
    protected wss: WebSocketServer;
    public ptys: Map<string, PTYService> = new Map();
    protected logger: Logger;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private handleMessage: (socket: WebSocket, message: RawData) => void =
        handleMessage;

    constructor(private webSHellOptions: WebShellOptions) {
        this.logger = this.webSHellOptions.logger;
        this.startWSS();
    }

    private startWSS(): void {
        this.wss = new WebSocketServer({ port: 49150 });

        this.wss.on('connection', (socket) => {
            const socketID = getSocketID(socket);
            const ptyService = new PTYService(socket);
            this.ptys.set(socketID, ptyService);
            this.setSocketEvents(socket);
            socket.onclose = () => {
                this.ptys.get(socketID).killPty();
                this.ptys.delete(socketID);
            };
        });
    }

    private setSocketEvents(socket: WebSocket): void {
        socket.on('message', (data) => {
            this.handleMessage(socket, data);
        });
    }
}
