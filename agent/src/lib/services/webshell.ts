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
}
