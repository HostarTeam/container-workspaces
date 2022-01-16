import { AgentConfiguration } from './lib/typing/types';
import { RawData, WebSocket } from 'ws';
import { printSuccess } from './lib/utils';
import log4js, { Logger } from 'log4js';
import { handleMessage } from './ws/handleMessage';
import { DaemonToClientCommand } from './lib/typing/DaemonToClientCommand';
import { wsCommand } from './ws/wsCommand';

export default class Agent {
    public ws: WebSocket;
    public logger: Logger;
    protected handleMessage: (message: RawData) => void = handleMessage;
    protected wsCommand: (commandData: DaemonToClientCommand) => void =
        wsCommand;

    constructor(public config: AgentConfiguration) {
        this.configureLogger();
        this.initWebSocket();
    }

    private initWebSocket(isReconnection: boolean = false): void {
        this.ws = new WebSocket(this.config.socketServer);

        this.ws.on('open', () => {
            printSuccess(
                `${isReconnection ? 'Rec' : 'C'}onnected to ${
                    this.config.socketServer
                }`
            );
        });

        this.ws.on('message', (message) => {
            this.handleMessage(message);
        });

        this.ws.on('close', () => {
            this.logger.warn(
                `WebSocket was disconnected from ${this.config.socketServer}`
            );
            setTimeout(() => this.initWebSocket(true), 10000); // Wait 10 seconds before reconnecting
        });

        this.ws.on('error', (err) => {
            this.logger.error(err.message);
        });
    }

    private configureLogger(location: string = '/var/log/cw/agent.log'): void {
        this.logger = log4js
            .configure({
                appenders: {
                    agent: {
                        type: 'file',
                        filename: location,
                    },
                },
                categories: { default: { appenders: ['agent'], level: 'all' } },
            })
            .getLogger();
    }
}
