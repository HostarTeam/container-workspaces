import {
    anyNull,
    fatalApp,
    handleFatalCatch,
    promptForSQLInfo,
    runSQLSetup,
    printSuccess,
} from './lib/utils';
import { connectToDatabase } from './lib/connectToDatabase';
import setupQueries from './setup.sql';

async function main() {
    const { host, port, user, password } = await promptForSQLInfo();

    if (anyNull(host, port, user, password)) {
        fatalApp('Not enough information to connect to database');
    }

    const databaseConnection = await connectToDatabase({
        host,
        port,
        user,
        password,
    }).catch(handleFatalCatch('connection to database'));

    await runSQLSetup(databaseConnection, setupQueries).catch(
        handleFatalCatch('SQL setup query execution')
    );
    databaseConnection.destroy();
    printSuccess('Setup complete');
}

main();
