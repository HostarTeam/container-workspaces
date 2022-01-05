import { readConfFile } from './lib/utils';
import { Configuration } from './lib/types';
import ContainerWorkspaces from './ContainerWorkspaces';
import { config } from 'dotenv';
config();

async function main() {
    const config: Configuration = await readConfFile();
    const currentServer: ContainerWorkspaces = new ContainerWorkspaces(config);
}

main();
