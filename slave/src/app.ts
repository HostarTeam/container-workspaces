import { readConfFile } from './lib/utils';
import { Configuration } from './lib/types';
import Slave from './Slave';

async function main() {
    const config: Configuration = await readConfFile();
    const currentServer: Slave = new Slave(config);
}

main();
