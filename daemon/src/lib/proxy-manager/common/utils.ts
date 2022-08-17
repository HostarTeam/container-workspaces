import { ProxyInfo } from './types';

export function getProxyInfo(hostname: string): ProxyInfo | null {
    const dataSection = hostname.split('.')[0];
    if (dataSection.split('-').length < 2) return null;

    const [service, containerIDString] = dataSection.split('-');
    const containerID = Number(containerIDString);
    if (isNaN(containerID)) return null;

    return { service, containerID };
}
