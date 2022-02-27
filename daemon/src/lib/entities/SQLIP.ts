import { QueryRow } from '@hostarteam/mysqlclient';
import Entity from './orm/Entity';

export interface SQLIPObject {
    id?: SQLIP['id'];
    ipv4: SQLIP['ipv4'];
    gateway: SQLIP['gateway'];
    netmask: SQLIP['netmask'];
    used: number | 0 | 1;
}

export type SQLIPOptions = Omit<SQLIPObject, 'used'> & {
    used: boolean;
};

class SQLIP extends Entity {
    id: number;
    ipv4: string;
    gateway: string;
    netmask: string;
    used: boolean;

    constructor({ id, ipv4, gateway, netmask, used }: SQLIPOptions) {
        super();
        this.addOptionalProp('id', id, null, (value: number) =>
            Number.isInteger(value)
        );
        this.addRequiredProp(
            'ipv4',
            ipv4,
            (value: string) => typeof value === 'string' && value.length > 0
        );
        this.addRequiredProp(
            'gateway',
            gateway,
            (value: string) => typeof value === 'string' && value.length > 0
        );
        this.addRequiredProp(
            'netmask',
            netmask,
            (value: string) => typeof value === 'string' && value.length > 0
        );
        this.addOptionalProp(
            'used',
            used,
            false,
            (value: boolean) => typeof value === 'boolean'
        );
    }

    public toObject(): QueryRow {
        return {
            id: this.id,
            ipv4: this.ipv4,
            gateway: this.gateway,
            netmask: this.netmask,
            used: Number(this.used),
        };
    }

    public static fromObject(object: QueryRow | SQLIPObject) {
        const sqlip = new SQLIP({
            id: Number(object.id),
            ipv4: String(object.ipv4),
            gateway: String(object.gateway),
            netmask: String(object.netmask),
            used: Boolean(Number(object.used)),
        });
        return sqlip;
    }

    public static fromObjects(objects: QueryRow[]) {
        return objects.map((object) => SQLIP.fromObject(object));
    }
}

export default SQLIP;
