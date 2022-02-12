import {
    Connection,
    ConnectionOptions,
    createConnection,
    OkPacket,
    ResultSetHeader,
    RowDataPacket,
} from 'mysql2';

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

    public getQueryResult(
        sql: string,
        values: any[] | any = []
    ): Promise<any[]> {
        return new Promise((resolve, reject) => {
            this.connection.query(sql, values, (err, results) => {
                if (err) return reject(err);
                else return resolve(<any[]>results);
            });
        });
    }

    public async getFirstQueryResult(
        sql: string,
        values: any[] | any = []
    ): Promise<any> {
        const rows = await this.getQueryResult(sql, values);
        return rows[0] || null;
    }

    public async executeQuery(
        sql: string,
        values: any[] | any = []
    ): Promise<void> {
        await this.getQueryResult(sql, values);
    }
}

export default MySQLClient;
