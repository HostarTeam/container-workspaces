import { execSync, execFileSync } from 'child_process';
import type { ExecSyncOptions, ExecFileOptions } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

export default class TempDir {
    private path: string;
    constructor(prefix = 'cw-') {
        const tmpDir = mkdtempSync(join(tmpdir(), prefix), {
            encoding: 'utf-8',
        });
        this.path = tmpDir;
    }

    public execSync(command: string, options: ExecSyncOptions = {}) {
        return execSync(command, {
            ...options,
            cwd: this.path,
            stdio: 'ignore',
        });
    }

    public execFileSync(
        file: string,
        args: ReadonlyArray<string> = [],
        options: ExecFileOptions = {}
    ) {
        return execFileSync(file, args, {
            ...options,
            cwd: this.path,
            stdio: 'ignore',
        });
    }

    public close(): void {
        rmSync(this.path, { recursive: true, force: true });
    }
}
