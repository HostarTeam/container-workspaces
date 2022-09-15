import { QueryRow } from '@hostarteam/mysqlclient';
import Entity from './orm/Entity';

export interface LocationObject {
    id?: Location['id'];
    location: Location['location'];
}

class Location extends Entity {
    public id: number;
    public location: string;

    constructor({ id, location }: LocationObject) {
        super();
        this.addOptionalProp('id', id, null, (value: number) =>
            Number.isInteger(value)
        );
        this.addRequiredProp(
            'location',
            location,
            (value: string) => typeof value === 'string' && value.length > 0
        );
    }

    public toObject(): QueryRow {
        return {
            id: this.id,
            location: this.location,
        };
    }

    public static fromObject(object: QueryRow | LocationObject) {
        const location = new Location({
            id: Number(object.id),
            location: String(object.location),
        });
        return location;
    }

    public static fromObjects(objects: QueryRow[]) {
        return objects.map((object) => Location.fromObject(object));
    }
}

export default Location;
