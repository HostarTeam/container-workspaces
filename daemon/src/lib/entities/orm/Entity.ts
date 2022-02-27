import { QueryRow } from '@hostarteam/mysqlclient';

/**
 * Base class for ORM entity.
 * @class
 * @classdesc All entity classes inherit from this class.
 */
class Entity {
    public toObject(): QueryRow {
        throw new Error('This method has to be overriden and implemented');
    }

    public static fromObject(object: QueryRow) {
        throw new Error(
            'This method has to be overriden and implemented' + object
        );
    }

    public addRequiredProp<Prop extends keyof this, Value extends this[Prop]>(
        propName: Prop,
        value: Value,
        validateProp: (value: Value) => boolean = () => true
    ): void {
        if (!value) throw new Error(`Property: ${propName} is required`);

        const isValid = validateProp(value);
        if (!isValid)
            throw new Error(`Property: ${propName} has an invalid value`);
        this[propName] = value;
    }

    public addOptionalProp<Prop extends keyof this, Value extends this[Prop]>(
        propName: Prop,
        value: Value,
        defaultValue: Value,
        validateProp: (value: Value) => boolean = () => true
    ): void {
        if (!value) {
            this[propName] = defaultValue;
            return;
        }
        const isValid = validateProp(value);
        if (!isValid)
            throw new Error(`Property: ${propName} has an invalid value`);
        this[propName] = value;
    }
}

export default Entity;
