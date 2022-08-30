import serviceToPort from './serviceToPort';

export interface ProxyInfo {
    service: keyof typeof serviceToPort;
    containerID: number;
}
