import Agent from './Agent';
import InitAgent from './InitAgent';
import { AgentConfiguration, Services } from './lib/typing/types';
import {
    checkIfInitHadRan,
    printError,
    printFatal,
    readConfFile,
} from './lib/utils';
import { config } from 'dotenv';
import VSCode from './lib/services/vscode';
import WebShell from './lib/services/webshell';
config();

async function main(): Promise<void> {
    const services: Services = {
        vscode: new VSCode(),
        webshell: new WebShell(),
    };
    const initHadRan: boolean = await checkIfInitHadRan();

    if (!initHadRan) {
        try {
            const initAgent = new InitAgent(services);
            await initAgent.runInit();
        } catch (err: unknown) {
            printError(String(err));
            printFatal('Could not finish executing init agent');
        }
    }

    const config: AgentConfiguration = await readConfFile();
    new Agent(config, services);
}

main();
