import { chmodSync } from 'fs';
import TempDir from '../../utilities/tempdir';
import { WebShellConfiguration } from '../typing/types';
import Service from './baseService';

export default class WebShell extends Service<
    WebShellConfiguration,
    WebShellConfiguration['token']
> {
    constructor() {
        super('webshell', 'cw-webshell');
    }

    argsToShellArgs() {
        return [
            '--token',
            this.args.token,
            '--port',
            String(this.args.port),
            '--host',
            this.args.host,
        ];
    }

    public getAuth() {
        return this.args.token;
    }

    public installService(): void {
        const tempDir = new TempDir();
        const downloadURL =
            'https://github.com/HostarTeam/cw-webshell/releases/download/1.0.0/cw-webshell-linux';
        const name = 'cw-webshell';
        const outPath = `/usr/bin/${name}`;
        tempDir.execFileSync('wget', [downloadURL, '-O', outPath]);
        chmodSync(outPath, 0o744);

        tempDir.close();
    }
}
