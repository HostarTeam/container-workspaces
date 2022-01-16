export class DaemonToClientCommand {
    public id: string;
    public agentAddress: string;
    public action: string;
    public method?: string;
    public args?: {
        [key: string]: any;
    };

    constructor({
        id,
        agentAddress,
        action,
        method,
        args,
    }: DaemonToClientCommand) {
        if (id) this.id = id;
        else throw new InvalidCommandError("Property 'id' is missing");
        if (agentAddress) this.agentAddress = agentAddress;
        else
            throw new InvalidCommandError(
                "Parameter 'agentAddress' is missing"
            );
        if (action) this.action = action;
        else throw new InvalidCommandError("Property 'action' is missing");
        if (method) this.method = method;
        else this.method = '';
        if (args) this.args = args;
        else this.args = {};
    }
}

export class InvalidCommandError extends Error {
    constructor(public message: string) {
        super();
        this.name = 'InvalidCommandError';
    }
}
