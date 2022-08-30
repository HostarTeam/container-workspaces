import { VSCodeConfiguration } from '../typing/types';
import Service from './baseService';

export default class VSCode extends Service<VSCodeConfiguration> {
    constructor() {
        super('vscode', 'openvscode-server');
    }

    argsToShellArgs(): string[] {
        return [
            '--connection-token',
            this.args.token,
            '--port',
            String(this.args.port),
            '--host',
            this.args.host,
        ];
    }
}
