import {
    Connection,
    ConnectionOptions,
    createConnection,
    RowDataPacket,
} from 'mysql2';
import { valueParam } from '../typing/types';
class MySQLClient {
    private connection: Connection;

    constructor(private config: ConnectionOptions) {
        this.config = config;
    }

    public connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            const connection: Connection = createConnection(this.config);
            connection.connect((err) => {
                if (err) return reject(err);

                this.connection = connection;
                return resolve();
            });
        });
    }
    /* eslint-disable */
    public getQueryResult(
        sql: string,
        values: valueParam = []
    ): Promise<any[]> {
        return new Promise((resolve, reject) => {
            this.connection.query(sql, values, (err, rows: RowDataPacket[]) => {
                if (err) return reject(err);
                else return resolve(rows);
            });
        });
    }

    public async getFirstQueryResult(
        sql: string,
        values: valueParam = []
    ): Promise<any> {
        const rows = await this.getQueryResult(sql, values);
        return rows[0] || null;
    }
    /* eslint-enable */

    public async executeQuery(
        sql: string,
        values: valueParam = []
    ): Promise<void> {
        await this.getQueryResult(sql, values);
    }
}

export default MySQLClient;
