import mysql, { Connection } from 'mysql2';
import { ConnectionOptions } from 'mysql2/typings/mysql';
import { Connection as PromiseConnection } from 'mysql2/promise';
import { printSuccess } from './utils';

// Database connection
export function connectToDatabase(
    connectionOptions: ConnectionOptions
): PromiseConnection {
    const connection: Connection = mysql.createConnection(connectionOptions);
    connection.connect((err) => {
        if (err) throw err;
        printSuccess(
            `Connected to database at ${connectionOptions.host}:${
                connectionOptions.port || 3306
            }`
        );
    });

    return connection.promise();
}
