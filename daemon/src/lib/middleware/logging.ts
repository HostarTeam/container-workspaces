import { Handler, NextFunction, Request, Response } from 'express';
import { Logger } from 'log4js';
import ContainerWorkspaces from '../../ContainerWorkspaces';

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
