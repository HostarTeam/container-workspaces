import { CommandErrorReport, ErrorReport } from './types';

export class MessageData {
    public action: string;
    public method?: string;
    // eslint-disable-next-line @typescript-eslint/ban-types
    public args?: possibleArgs;

    constructor({ action, method, args }: MessageDataResponse) {
        if (action) this.action = action;
        else
            throw new InvalidMessageError(
                "Property:'action' is missing from message"
            );
        if (method) this.method = method;
        else this.method = '';
        if (args) this.args = args;
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

interface possibleArgs {
    commands?: string[];
    linesCount?: number;
    password?: string;
    errorReport?: CommandErrorReport | ErrorReport;
    lines?: string | null;
    status?: 'success' | 'error';
}

export class InvalidMessageError extends Error {
    constructor(public message: string) {
        super();
        this.name = 'InvalidMessageError';
    }
}
