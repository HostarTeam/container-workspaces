import { CommandError, Ticket } from './types';

/**
 * This class exists to validate the data of a task
 * @class
 * @classdesc This class is used to define the data field in a task
 */
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

/**
 * This class exists to validate the data of a task received from an agent
 * @extends {MessageData}
 * @class
 * @classdesc This class is used to define the data field in a task received from an agent
 */
export class MessageDataResponse extends MessageData {
    public taskid: number;

    constructor(props: MessageDataResponse) {
        super(props);
        if (props.taskid) this.taskid = props.taskid;
        else
            throw new InvalidMessageError(
                "Proroperty 'taskid' is missing from message"
            );
    }
}

/**
 * This interface represents every possible field of args in the MessageData class
 * @interface
 */
interface possibleArgs {
    commands?: string[];
    linesCount?: number;
    password?: string;
    auth?: unknown;
    errorReport?: CommandError;
    lines?: string | null;
    status?: 'success' | 'error' | 'running';
    ticket?: Ticket;
    script?: string;
    output?: string;
    outputType?: 'stdout' | 'stderr';
    exitCode?: number;
    service?: string;
}

/**
 * This Error class exists to be thrown when the data of a task received from an agent is invalid
 * @class
 * @classdesc This class represents an error thrown when the MessageData class receivs invalid data
 * @extends {Error}
 */
export class InvalidMessageError extends Error {
    constructor(public message: string) {
        super();
        this.name = 'InvalidMessageError';
    }
}
