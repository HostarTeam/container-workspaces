import fetch, { Response } from 'node-fetch';
import ProxmoxConnection from './ProxmoxConnection';
import { getNodesName, printError } from '../utils';
import { Node } from '../typing/types';

export function call(
    this: ProxmoxConnection,
    path: string,
    method: string,
    body: string = null
): Promise<any> {
    let promise = new Promise(async (resolve, reject) => {
        let options = {
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Authorization: `PVEAuthCookie=${this.authCookie}`,
            },
            method: method,
        };
        if (['POST', 'PUT', 'DELETE'].includes(method.toUpperCase()))
            options.headers['CSRFPreventionToken'] = this.csrfPreventionToken;
        if (body) (options as any).body = JSON.stringify(body);
        try {
            let res = await fetch(`${this.basicURL}/${path}/`, options);
            if (res.status == 401) {
                await this.getAuthKeys();
                return await this.call(path, method, body);
            }
            res = await res.json();
            resolve(res);
        } catch (err) {
            reject(err);
        }
    });
    return promise;
}

export async function getNodes(this: ProxmoxConnection): Promise<Node[]> {
    let res = await this.call('nodes', 'GET');
    return res.data;
}

export async function getAuthKeys(this: ProxmoxConnection): Promise<void> {
    try {
        let username = `${this.username}@pam`,
            password = this.password;
        let res: Response = await fetch(
            `${this.basicURL}/access/ticket?username=${username}&password=${password}`,
            {
                method: 'POST',
            }
        );
        (res as any) = await res.json();
        const data = (res as any).data;
        this.authCookie = data.ticket;
        this.csrfPreventionToken = data.CSRFPreventionToken;
    } catch (error) {
        printError(error);
        throw Error("Can't connect to server");
    }
}