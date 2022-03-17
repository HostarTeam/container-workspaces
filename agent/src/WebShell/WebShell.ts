import { WebSocket, WebSocketServer, RawData } from 'ws';
import { Logger } from 'log4js';
import { AgentConfiguration } from '../lib/typing/types';
import PTYService from './PTYService';
import { getSocketID, checkIfSocketClosed } from '../lib/utils';
import { handleMessage } from './handleMessage';
import Agent from '../Agent';
import Ticket from '../lib/typing/Ticket';
import { IncomingMessage } from 'http';

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

    constructor(
        private webSHellOptions: WebShellOptions,
        private tickets: Agent['tickets']
    ) {
        this.logger = this.webSHellOptions.logger;
        this.startWSS();
    }

    private startWSS(): void {
        this.wss = new WebSocketServer({ port: 49150 });

        this.wss.on('connection', (socket, request) => {
            this.authenticateSocket(socket, request);
            if (checkIfSocketClosed(socket)) return;

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

    private authenticateSocket(
        socket: WebSocket,
        request: IncomingMessage
    ): void {
        const params = new URL(request.url, `http://${request.headers.host}`)
            .searchParams;
        if (!params) return socket.close(1011, 'Invalid params');
        const ticketID: string = params.get('ticket');
        if (!ticketID) return socket.close(1011, 'No ticket');
        if (!this.tickets.has(ticketID))
            return socket.close(1011, 'Invalid ticket');
        const ticket: Ticket = this.tickets.get(ticketID);
        if (ticket.isExpired) {
            this.tickets.delete(ticketID);
            return socket.close(1011, 'Ticket expired');
        }
    }

    private setSocketEvents(socket: WebSocket): void {
        socket.on('message', (data) => {
            this.handleMessage(socket, data);
        });
    }
}
