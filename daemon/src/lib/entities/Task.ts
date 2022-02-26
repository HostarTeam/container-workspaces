import { generateID } from '../util/utils';
import { MessageData } from '../typing/MessageData';
import Entity from './orm/Entity';
import { QueryRow } from '@hostarteam/mysqlclient';

export interface TaskObject {
    id?: Task['id'];
    containerID: Task['containerID'];
    start_time?: Task['start_time'];
    end_time?: Task['end_time'];
    data: string;
    status?: Task['status'];
    error?: Task['error'];
}

export type TaskOptions = Omit<TaskObject, 'data'> & {
    data: MessageData;
};

class Task extends Entity {
    public id: string;
    public containerID: number;
    public start_time: number;
    public end_time?: number | null;
    public data: MessageData | null;
    public status?: 'OK' | 'error' | null; // Defaults to null
    public error?: string | null;

    constructor({
        id,
        containerID,
        start_time = Date.now(),
        end_time = null,
        data,
        status = null,
        error = null,
    }: TaskOptions) {
        super();
        this.addOptionalProp('id', id, generateID(), (value: string) => {
            return typeof value === 'string' && value.length > 0;
        });
        this.addRequiredProp('containerID', containerID, (value: number) =>
            Number.isInteger(value)
        );
        this.addOptionalProp(
            'start_time',
            start_time,
            Date.now(),
            (value: number) => Number.isInteger(value)
        );
        this.addOptionalProp(
            'end_time',
            end_time,
            null,
            (value: number) => Number.isInteger(value) || value === null
        );

        this.addOptionalProp('data', data, null);

        this.addOptionalProp('status', status, null, (value: string) => {
            return value === 'OK' || value === 'error' || value === null;
        });

        this.addOptionalProp('error', error, null, (value: string | null) => {
            return (
                (typeof value === 'string' && value.length > 0) ||
                value === null
            );
        });
    }

    public toObject(): QueryRow {
        return {
            id: this.id,
            containerID: this.containerID,
            start_time: this.start_time,
            end_time: this.end_time,
            data: JSON.stringify(this.data),
            status: this.status,
            error: this.error,
        };
    }

    public static fromObject(object: QueryRow | TaskObject): Task {
        const task = new Task({
            id: String(object.id),
            containerID: Number(object.containerID),
            start_time: Number(object.start_time),
            end_time: Number(object.end_time),
            data: JSON.parse(String(object.data)),
            status: object.status
                ? <Task['status']>String(object.status)
                : null,
            error: object.error ? String(object.error) : null,
        });
        return task;
    }

    public static fromObjects(objects: QueryRow[]): Task[] {
        return objects.map((object) => Task.fromObject(object));
    }
}

export default Task;
