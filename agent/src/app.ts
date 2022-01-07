import Agent from './Agent';
import { initMain } from './initAgent';
import { AgentConfiguration } from './lib/types';
import { checkIfInitHadRan, readConfFile } from './lib/utils';

async function main(): Promise<void> {
    const config: AgentConfiguration = await readConfFile();
    const initHadRan: boolean = await checkIfInitHadRan();
    if (!initHadRan) {
        console.log('Running initialization agent');
        await initMain(config);
    }

    const agent = new Agent(config);
}

main();