import { readConfFile } from './lib/utils';
import { Configuration } from './lib/typing/types';
import ContainerWorkspaces from './ContainerWorkspaces';

// Main function of the application, runs the daemon
async function main() {
    const config: Configuration = await readConfFile();
    const currentServer: ContainerWorkspaces = new ContainerWorkspaces(config);
}

main();
