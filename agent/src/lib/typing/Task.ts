import { MessageData } from '../typing/MessageData';

export class Task {
    public id: string;
    public ipaddr: string;
    public start_time: Date;
    public end_time?: Date | null;
    public data: MessageData | null;
    public status?: 'OK' | 'error' | null; // Defaults to null
    public error?: string | null;

    constructor({
        id,
        ipaddr,
        start_time,
        end_time = null,
        data,
        status = null,
        error = null,
    }: TaskOptions) {
        this.id = id;
        this.ipaddr = ipaddr;

        if (typeof start_time === 'number') start_time = new Date(start_time);
        this.start_time = start_time;

        if (typeof end_time === 'number') end_time = new Date(end_time);
        this.end_time = end_time;

        if (typeof data === 'string') data = new MessageData(JSON.parse(data));
        this.data = data;

        this.status = status;
        this.error = error;
    }
}

interface TaskOptions {
    id?: string;
    ipaddr: string;
    start_time?: Date | number;
    end_time?: Date | number;
    data: any | string;
    status?: Task['status'];
    error?: Task['error'];
}
