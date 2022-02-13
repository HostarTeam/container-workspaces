import Agent from './Agent';
import InitAgent from './InitAgent';
import { AgentConfiguration } from './lib/typing/types';
import {
    checkIfInitHadRan,
    printError,
    printFatal,
    readConfFile,
} from './lib/utils';
import { config } from 'dotenv';
config();

async function main(): Promise<void> {
    const initHadRan: boolean = await checkIfInitHadRan();

    if (!initHadRan) {
        try {
            const initAgent = new InitAgent();
            await initAgent.runInit();
        } catch (err: unknown) {
            printError(String(err));
            printFatal('Could not finish executing init agent');
        }
    }

    const config: AgentConfiguration = await readConfFile();
    new Agent(config);
}

main();
