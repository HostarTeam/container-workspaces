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
    const config: AgentConfiguration = await readConfFile();
    const initHadRan: boolean = await checkIfInitHadRan();
    const isDevelopment: boolean = process.env.DEVELOPMENT === '1';

    if (!initHadRan) {
        try {
            const initAgent = new InitAgent(config, isDevelopment);
            await initAgent.runInit();
        } catch (err: unknown) {
            printError(<String>err);
            printFatal('Could not finish executing init agent');
        }
    }

    const agent = new Agent(config);
}

main();
