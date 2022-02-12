import { generateID } from '../util/utils';
import { MessageData } from '../typing/MessageData';

export class Task {
    public id: string;
    public containerID: number;
    public start_time: number;
    public end_time?: number | null;
    public data: MessageData | string | null;
    public status?: 'OK' | 'error' | null; // Defaults to null
    public error?: string | null;

    constructor({
        id = generateID(),
        containerID,
        start_time = Date.now(),
        end_time = null,
        data,
        status = null,
        error = null,
    }: TaskOptions) {
        this.id = id;
        this.containerID = containerID;
        this.start_time = start_time;
        this.end_time = end_time;

        this.data = data;

        this.status = status;
        this.error = error;
    }
}

interface TaskOptions {
    id?: string;
    containerID: number;
    start_time?: number;
    end_time?: number;
    data: MessageData | string;
    status?: Task['status'];
    error?: Task['error'];
}
