import { AgentConfiguration } from './lib/types';
import { WebSocket } from 'ws';
import { printSuccess } from './lib/utils';

export default class Agent {
    protected ws: WebSocket;

    constructor(protected config: AgentConfiguration) {
        this.initWebSocket();
    }

    private initWebSocket(): void {
        this.ws = new WebSocket(this.config.socketServer);

        this.ws.on('open', () => {
            printSuccess(`Connected to ${this.config.socketServer}`);
        });

        this.ws.on('message', (message) => {
            console.log(message.toString());
        });
    }
}
