import { QueryRow } from '@hostarteam/mysqlclient';
import Entity from './orm/Entity';

export interface SQLNodeObject {
    id?: SQLNode['id'];
    nodename: SQLNode['nodename'];
    is_main: number | 0 | 1;
    ip: SQLNode['ip'];
    location: SQLNode['location'];
}

export type SQLNodeOptions = Omit<SQLNodeObject, 'is_main'> & {
    is_main: boolean;
};

class SQLNode extends Entity {
    public id: number;
    public nodename: string;
    public is_main: boolean;
    public ip: string;
    public location: number;

    constructor({ id, nodename, is_main, ip, location }: SQLNodeOptions) {
        super();
        this.addOptionalProp('id', id, null, (value: number) =>
            Number.isInteger(value)
        );
        this.addRequiredProp(
            'nodename',
            nodename,
            (value: string) => typeof value === 'string' && value.length > 0
        );
        this.addOptionalProp(
            'is_main',
            is_main,
            false,
            (value: boolean) => typeof value === 'boolean'
        );
        this.addRequiredProp(
            'ip',
            ip,
            (value: string) => typeof value === 'string' && value.length > 0
        );
        this.addRequiredProp(
            'location',
            location,
            (value: number) =>
                typeof value === 'number' && Number.isInteger(value)
        );
    }

    public toObject(): QueryRow {
        return {
            id: this.id,
            nodename: this.nodename,
            is_main: Number(this.is_main),
            ip: this.ip,
            location: this.location,
        };
    }

    public static fromObject(object: QueryRow | SQLNodeObject) {
        const sqlNode = new SQLNode({
            id: Number(object.id),
            nodename: String(object.nodename),
            is_main: Boolean(object.is_main),
            ip: String(object.ip),
            location: Number(object.location),
        });
        return sqlNode;
    }

    public static fromObjects(objects: QueryRow[]) {
        return objects.map((object) => SQLNode.fromObject(object));
    }
}

export default SQLNode;
