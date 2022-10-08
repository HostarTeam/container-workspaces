import { readConfFile } from './lib/util/utils';
import { Configuration } from './lib/typing/types';
import ContainerWorkspaces from './ContainerWorkspaces';
import Config from './lib/util/config';

// Main function of the application, runs the daemon
async function main() {
    const rawConfig: Configuration = await readConfFile();
    const config = new Config(rawConfig);

    new ContainerWorkspaces(config);
}

main();
