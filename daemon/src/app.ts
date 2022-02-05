import {
    printError,
    printSuccess,
    printWarning,
    readConfFile,
} from './lib/utils';
import { Configuration } from './lib/typing/types';
import ContainerWorkspaces from './ContainerWorkspaces';
import { config } from 'dotenv';
config();

// Main function of the application, runs the daemon
async function main() {
    const config: Configuration = await readConfFile();
    const currentServer: ContainerWorkspaces = new ContainerWorkspaces(config);
    printSuccess('suc');
    printWarning('warn');
    printError('err');
}

main();
