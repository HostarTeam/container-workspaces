import { ChildProcess, execFile } from 'child_process';
import { delay } from '../utils';

export type ServiceStatus = 'running' | 'stopped';

export default abstract class Service<T = unknown, U = string> {
    private process: ChildProcess;
    protected args: T;

    constructor(public name: string, private execFile: string) {
        this.args = null;
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

    public abstract getAuth(): U;

    public abstract argsToShellArgs(): string[];
}
