import { AgentConfiguration, Services } from './lib/typing/types';
import { RawData, WebSocket } from 'ws';
import { generatePassword, printSuccess } from './lib/utils';
import log4js, { Logger } from 'log4js';
import { handleMessage } from './ws/handleMessage';
import { wsCommand } from './ws/wsCommand';
import { Task } from './lib/typing/Task';
import passwd from 'passwd-linux';
import { MessageDataResponse } from './lib/typing/MessageData';

export default class Agent {
    public ws: WebSocket;
    public logger: Logger;
    public logFilePath: string;
    private reconnectInterval: NodeJS.Timeout;
    protected handleMessage: (message: RawData) => void = handleMessage;
    protected wsCommand: (commandData: Task) => void = wsCommand;

    constructor(public config: AgentConfiguration, public services: Services) {
        this.configureLogger();
        this.initWebSocket();
        this.runServices();
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
            } else if (
                err.message === 'unable to verify the first certificate'
            ) {
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

    private runServices(): void {
        this.services.vscode.setArgs({
            token: generatePassword(64),
            port: 8443,
            host: '0.0.0.0',
        });
        this.services.vscode.start();

        this.services.webshell.setArgs({
            token: generatePassword(64),
            port: 8444,
            host: '0.0.0.0',
        });
        this.services.webshell.start();
    }
}
