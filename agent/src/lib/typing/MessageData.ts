export class MessageData {
    public action: string;
    public method?: string;
    public args?: {
        [key: string]: any;
    };

    constructor({ action, method, args }: MessageDataResponse) {
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

export class MessageDataResponse extends MessageData {
    public taskid: string;

    constructor(props: MessageDataResponse) {
        super(props);
        if (props.taskid) this.taskid = props.taskid;
        else
            throw new InvalidMessageError(
                "Proroperty 'taskid' is missing from message"
            );
    }
}

export class InvalidMessageError extends Error {
    constructor(public message: string) {
        super();
        this.name = 'InvalidMessageError';
    }
}