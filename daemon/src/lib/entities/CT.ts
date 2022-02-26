import { QueryRow } from '@hostarteam/mysqlclient';
import Entity from './orm/Entity';

export interface CTObject {
    id: CT['id'];
    ipv4: CT['ipv4'];
    ready: number | 0 | 1;
}

export type CTOptions = Omit<CTObject, 'ready'> & {
    ready: boolean;
};

class CT extends Entity {
    public id: number;
    public ipv4: string;
    public ready: boolean;

    constructor({ id, ipv4, ready }: CTOptions) {
        super();
        this.addRequiredProp('id', id, (value: number) =>
            Number.isInteger(value)
        );
        this.addRequiredProp(
            'ipv4',
            ipv4,
            (value: string) => typeof value === 'string' && value.length > 0
        );
        this.addOptionalProp(
            'ready',
            ready,
            false,
            (value: boolean) => typeof value === 'boolean'
        );
    }

    public toObject(): QueryRow {
        return {
            id: this.id,
            ipv4: this.ipv4,
            ready: Number(this.ready),
        };
    }

    public static fromObject(object: QueryRow): CT {
        const ct = new CT({
            id: Number(object.id),
            ipv4: String(object.ipv4),
            ready: Boolean(object.ready),
        });
        return ct;
    }

    public static fromObjects(objects: QueryRow[]): CT[] {
        return objects.map((object) => CT.fromObject(object));
    }
}

export default CT;
