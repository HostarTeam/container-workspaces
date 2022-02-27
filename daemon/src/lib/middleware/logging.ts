import { Handler, NextFunction, Request, Response } from 'express';
import ContainerWorkspaces from '../../ContainerWorkspaces';

/**
 * Logging middleware for http server.
 */
function httpLoggerMiddleware(this: ContainerWorkspaces): Handler {
    return (req: Request, res: Response, next: NextFunction) => {
        res.on('finish', () => {
            this.httpLogger.info(
                `${req.baseUrl}${req.path} - ${req.method} - ${res.statusCode} - ${req.ip}`
            );
        });
        next();
    };
}

export default httpLoggerMiddleware;
