import isValidHostname from 'is-valid-hostname';
import { Configuration, ProxyConfiguration } from '../typing/types';
import { printError } from './utils';

function validateString(value: unknown) {
    return typeof value === 'string';
}

function validatePort(value: unknown) {
    return Number.isInteger(value) && value > 0 && value < 65536;
}

function validateHostname(value: unknown) {
    return typeof value === 'string' && isValidHostname(value);
}

function validateProtocol(value: unknown) {
    return value === 'https' || value === 'http';
}

export function getPropertyValue(
    obj: Record<string, unknown> | unknown,
    property: string
): unknown {
    if (!property) return obj;

    const propArr: string[] = property.split('.');

    const firstProp: string = propArr.shift();

    if (typeof obj !== 'object') return obj;

    return getPropertyValue(obj[firstProp], propArr.join('.'));
}

export default class Config implements Configuration {
    listenAddress: string;
    listenPort: number;
    listenWssPort: number;
    remoteAddress: string;
    remotePort: number;
    remoteWssPort: number;
    sslOptions?: { cert: string; key: string };
    protocol: 'https' | 'http';
    proxy: ProxyConfiguration;
    database: {
        host: string;
        port: number;
        user: string;
        password: string;
        database: string;
    };
    pve: {
        hostname: string;
        protocol: 'https' | 'http';
        username: string;
        password: string;
    };

    constructor(rawConfig: Partial<Configuration>) {
        this.validateConfig(rawConfig);
        Object.assign(this, rawConfig);
    }

    private validateConfig(rawConfig: Partial<Configuration>) {
        for (const key in this.validationConf) {
            const validator = this.validationConf[key];
            const existingValue = getPropertyValue(rawConfig, key);

            if (existingValue === undefined) {
                printError(`Key ${key} is missing from configuration file`);
                process.exit(1);
            }

            if (typeof validator === 'function') {
                if (!validator(existingValue)) {
                    printError(`Key ${key} in configuration file is not valid`);
                    process.exit(1);
                }
            } else if (typeof validator === 'object') {
                for (const subKey in validator) {
                    const subValidator = getPropertyValue(
                        rawConfig,
                        `${key}.${subKey}`
                    );
                    if (subValidator === undefined) {
                        printError(
                            `Key ${key}.${subKey} is missing from configuration file`
                        );
                        process.exit(1);
                    }

                    if (typeof validator === 'function') {
                        if (!validator(existingValue)) {
                            printError(
                                `Key ${key}.${subKey} in configuration file is not valid`
                            );
                            process.exit(1);
                        }
                    }
                }
            }
        }
        return true;
    }

    private readonly validationConf = {
        listenAddress: validateHostname,
        listenPort: validatePort,
        listenWssPort: validatePort,
        remoteAddress: validateHostname,
        remotePort: validatePort,
        remoteWssPort: validatePort,
        protocol: validateProtocol,
        proxy: {
            listenAddress: validateHostname,
            listenPort: validatePort,
            remoteAddress: validateHostname,
            wildcardBaseAddress: validateHostname,
            remotePort: validatePort,
            protocol: validateProtocol,
            sslOptions: {
                cert: validateString,
                key: validateString,
            },
        },
        sslOptions: {
            cert: validateString,
            key: validateString,
        },
        database: {
            host: validateHostname,
            port: validatePort,
            user: validateString,
            database: validateString,
            password: validateString,
        },
        pve: {
            hostname: validateHostname,
            protocol: validateProtocol,
            username: validateString,
            password: validateString,
        },
    };
}
