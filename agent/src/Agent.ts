import { AgentConfiguration } from './lib/typing/types';
import { RawData, WebSocket } from 'ws';
import { printSuccess } from './lib/utils';
import log4js, { Logger } from 'log4js';
import { handleMessage } from './ws/handleMessage';
import { wsCommand } from './ws/wsCommand';
import { Task } from './lib/typing/Task';
import passwd from 'passwd-linux';
import { MessageDataResponse } from './lib/typing/MessageData';
import WebShell from './WebShell/WebShell';
import Ticket from './lib/typing/Ticket';

export default class Agent {
    public ws: WebSocket;
    public logger: Logger;
    public logFilePath: string;
    public tickets: Map<string, Ticket> = new Map();
    private reconnectInterval: NodeJS.Timeout;
    private webShell: WebShell;
    protected handleMessage: (message: RawData) => void = handleMessage;
    protected wsCommand: (commandData: Task) => void = wsCommand;

    constructor(public config: AgentConfiguration) {
        this.configureLogger();
        this.initWebSocket();
        this.startWebShell();
    }

    private initWebSocket(isReconnection = false): void {
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
            this.reconnectToWS();
        });

        this.ws.on('error', (err) => {
            if (err.message.includes('connect ECONNREFUSED')) {
                this.logger.error(err.message);
                this.reconnectToWS();
            }
        });
    }

    private reconnectToWS(): void {
        clearTimeout(this.reconnectInterval);
        this.ws.close();
        this.reconnectInterval = setTimeout(
            () => this.initWebSocket(true),
            10000
        ); // Wait 10 seconds before reconnecting
    }

    public sendData(data: MessageDataResponse): void {
        this.ws.send(JSON.stringify(data));
    }

    private configureLogger(location = '/var/log/cw/agent.log'): void {
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
        this.logFilePath = location;
    }

    private startWebShell(): void {
        this.webShell = new WebShell(
            {
                config: this.config,
                logger: this.logger,
            },
            this.tickets
        );
    }

    public changePassword(newPassword: string): void {
        passwd.changePassword(
            'root',
            newPassword,
            (err: unknown, response): void => {
                if (err) {
                    this.logger.error(`Error changing password: ${<Error>err}`);
                    throw err;
                } else if (response) this.logger.info('Password changed');
                else this.logger.error('Could not change password');
            }
        );
    }
}
