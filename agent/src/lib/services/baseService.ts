import { ChildProcess, execFile } from 'child_process';
import { delay } from '../utils';

export type ServiceStatus = 'running' | 'stopped';

export default abstract class Service<T = unknown> {
    protected process: ChildProcess;

    constructor(
        public name: string,
        public execFile: string,
        public args: T = null
    ) {
        this.name = name;
        this.execFile = execFile;
        this.args = args;
    }

    public start(): void {
        if (!this.args) {
            throw new Error(
                `Service ${this.name} has not initialized args, cannot start it`
            );
        }

        this.process = execFile(this.execFile, this.argsToShellArgs());
    }
    public terminate(): void {
        this.process.kill('SIGTERM');
    }
    public kill(): void {
        this.process.kill('SIGKILL');
    }
    public async restart(timeout = 5000): Promise<void> {
        this.terminate();
        if (!this.isRunning) {
            await delay(timeout);
            if (!this.isRunning) {
                this.kill();
            }
        }
        this.start();
    }
    public getStatus(): ServiceStatus {
        return this.isRunning ? 'running' : 'stopped';
    }

    private get isRunning(): boolean {
        return !this.process.killed && this.process.exitCode === null;
    }

    public setArgs(newArgs: typeof this.args): void {
        this.args = newArgs;
    }

    public abstract argsToShellArgs(): string[];
}
