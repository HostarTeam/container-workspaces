export class MessageData {
    public taskid: string;
    public action: string;
    public method?: string;
    public args?: {
        [key: string]: any;
    };

    constructor({ taskid, action, method, args }: MessageData) {
        if (taskid) this.taskid = taskid;
        else
            throw new Error(
                "Property 'taskid' is required and is missing from message"
            );
        if (action) this.action = action;
        else
            throw new InvalidMessageError(
                "Property:'action' is missing from message"
            );
        if (method) this.method = method;
        else this.method = '';
        if (args) this.args = args;
        else this.args = {};
    }
}

export class InvalidMessageError extends Error {
    constructor(public message: string) {
        super();
        this.name = 'InvalidMessageError';
    }
}
