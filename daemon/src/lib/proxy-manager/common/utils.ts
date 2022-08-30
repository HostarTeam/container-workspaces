import { ProxyInfo } from './types';

export function getProxyInfo(hostname: string): ProxyInfo | null {
    const dataSection = hostname.split('.')[0];
    if (dataSection.split('-').length < 2) return null;

    const [service, containerIDString] = dataSection.split('-');
    const containerID = Number(containerIDString);
    if (isNaN(containerID)) return null;

    return { service, containerID };
}

export function parseCookieString(cookie: string): unknown {
    return cookie
        .split(';')
        .map((v) => v.split('='))
        .reduce((acc, v) => {
            acc[decodeURIComponent(v[0].trim())] = decodeURIComponent(
                v[1].trim()
            );
            return acc;
        }, {});
}
