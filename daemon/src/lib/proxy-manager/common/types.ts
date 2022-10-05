import serviceToPort from './serviceToPort';

export interface ProxyInfo {
    service: keyof typeof serviceToPort;
    containerID: number;
}

export interface AccessTokenInfo {
    proxyInfo: ProxyInfo;
    expires: number;
}
