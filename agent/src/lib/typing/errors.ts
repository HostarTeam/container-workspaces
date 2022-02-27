import { ExecException } from 'child_process';
export class ExecReportError extends Error {
    constructor(public execException: ActualExecException) {
        super();
        this.name = 'ExecReportError';
        Object.setPrototypeOf(this, ExecReportError.prototype);
    }
}

// This type is created because the type 'ExecException' does not have the members 'stdout' and 'stderr'
// Even though they exist in the runtime.
export type ActualExecException = ExecException & {
    stdout: string;
    stderr: string;
};
