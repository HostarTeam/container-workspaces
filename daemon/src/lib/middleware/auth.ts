import { Handler, NextFunction, Request, Response } from 'express';
import ContainerWorkspaces from '../../ContainerWorkspaces';
import { getEncodedBasicToken } from '../util/utils';

/**
 * Authentication middleware for http server.
 * @returns {Handler}
 */
function authMiddleware(this: ContainerWorkspaces): Handler {
    return async (req: Request, res: Response, next: NextFunction) => {
        const encodedBasicToken: string = getEncodedBasicToken(req);
        if (!encodedBasicToken) {
            res.status(401).send({
                status: 'unauthorized',
                message: 'Missing Authorization header',
            });
        } else {
            const authValid: boolean = await this.checkAuthToken(
                encodedBasicToken
            );
            if (authValid) {
                next();
            } else {
                res.status(401).send({ status: 'unauthorized' });
            }
        }
    };
}

export default authMiddleware;
