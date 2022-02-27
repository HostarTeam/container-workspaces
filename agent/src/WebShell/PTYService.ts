import { WebSocket } from 'ws';
import { IPty, spawn } from 'node-pty';
import { platform } from 'os';

export default class PTYService {
    private shell: string = platform() === 'win32' ? 'powershell.exe' : 'bash';
    private ptyProcess: IPty = null;

    constructor(private socket: WebSocket) {
        this.startPtyProcess();
    }

    private startPtyProcess(): void {
        this.ptyProcess = spawn(this.shell, [], {
            name: 'xterm-color',
            cwd: process.env.HOME,
            env: process.env,
        });

        this.addListeners();
    }

    private addListeners(): void {
        this.ptyProcess.onData((data) => {
            this.sendToClient(data);
        });

        this.ptyProcess.onExit((data) => {
            const output = { action: 'end', data: data };
            this.socket.send(JSON.stringify(output));
        });
    }

    private sendToClient(data: string): void {
        const output = { action: 'output', data: data };
        this.socket.send(JSON.stringify(output));
    }

    public write(data: string): void {
        this.ptyProcess.write(data);
    }

    public resizePty(cols: number, rows: number): void {
        this.ptyProcess.resize(cols, rows);
    }

    public killPty(): void {
        this.ptyProcess.kill();
    }
}
