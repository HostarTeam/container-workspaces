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
}
