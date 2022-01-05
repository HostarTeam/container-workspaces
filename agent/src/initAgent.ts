import {
    changePassword,
    generatePassword,
    getInitCommands,
    postCTDetails,
    runInitCommands,
} from './lib/utils';
import { AgentConfiguration } from './lib/types';

export async function initMain(config: AgentConfiguration): Promise<void> {
    const generatedPassword: string = generatePassword(32);
    console.log(`Generated password: ${generatedPassword}`);
    // changePassword(generatedPassword);
    await postCTDetails({
        password: generatedPassword,
        apiServer: config.apiServer,
    });

    const initCommands: string[] = await getInitCommands(config.apiServer);

    await runInitCommands(initCommands, config.apiServer);
}
