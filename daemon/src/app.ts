import { readConfFile } from './lib/util/utils';
import { Configuration } from './lib/typing/types';
import ContainerWorkspaces from './ContainerWorkspaces';
import Config from './lib/util/config';
import yargs from 'yargs';

// Main function of the application, runs the daemon
async function main() {
    const argv = await yargs
        .option('configpath', {
            description: 'The path of the configuration file',
            alias: ['config', 'conf', 'c'],
            default: '/etc/container-workspaces/conf.json',
            type: 'string',
        })
        .parse();
    const rawConfig: Configuration = await readConfFile(argv.configpath);
    const config = new Config(rawConfig);

    new ContainerWorkspaces(config);
}

main();
