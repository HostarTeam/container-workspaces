import Agent from '../../Agent';

export interface TicketOptions {
    id: string;
    expires: number;
}

export default class Ticket {
    public id: string;
    public expires: number;
    constructor({ id, expires }: TicketOptions) {
        this.id = id;
        this.expires = expires;
    }

    public toObject(): TicketOptions {
        return {
            id: this.id,
            expires: this.expires,
        };
    }

    public get isExpired(): boolean {
        return Date.now() > this.expires;
    }

    public isValid(tickets: Agent['tickets']): boolean {
        return tickets.has(this.id);
    }
}
