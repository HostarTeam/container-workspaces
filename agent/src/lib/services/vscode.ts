import { chmodSync, writeFileSync } from 'fs';
import TempDir from '../../utilities/tempdir';
import { VSCodeConfiguration } from '../typing/types';
import Service from './baseService';

export default class VSCode extends Service<
    VSCodeConfiguration,
    VSCodeConfiguration['token']
> {
    constructor() {
        super('vscode', 'openvscode-server');
    }

    argsToShellArgs() {
        return [
            '--connection-token',
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
            'https://github.com/gitpod-io/openvscode-server/releases/download/openvscode-server-v1.71.2/openvscode-server-v1.71.2-linux-x64.tar.gz';
        const name = 'openvscode-server';
        const outFile = `${name}.tar.gz`;
        const outDir = `/usr/lib/${name}`;
        tempDir.execFileSync('wget', [downloadURL, '-O', outFile]);
        tempDir.execFileSync('mkdir', [outDir]);
        tempDir.execFileSync('tar', [
            'zxf',
            outFile,
            '-C',
            outDir,
            '--strip-components=1',
        ]);

        const executableContent =
            '/usr/lib/openvscode-server/node /usr/lib/openvscode-server/out/server-main.js "$@"';
        writeFileSync(`/usr/bin/${name}`, executableContent);
        chmodSync(`/usr/bin/${name}`, 0o744);
        tempDir.close();
    }
}
