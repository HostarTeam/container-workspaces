import mysql, { Connection } from 'mysql2';
import { ConnectionOptions } from 'mysql2/typings/mysql';
import { Connection as PromiseConnection } from 'mysql2/promise';
import { printSuccess } from './utils';

// Database connection
export function connectToDatabase(
    connectionOptions: ConnectionOptions
): Promise<PromiseConnection> {
    return new Promise((resolve, reject) => {
        const connection: Connection = mysql.createConnection({
            ...connectionOptions,
            multipleStatements: true,
        });
        connection.connect((err) => {
            if (err)
                return reject(`Could not connect to database: ${err.message}`);
            printSuccess(
                `Connection successfull to database at ${
                    connectionOptions.host
                }:${connectionOptions.port || 3306}`
            );
            resolve(connection.promise());
        });
    });
}
