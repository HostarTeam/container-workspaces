import type { Config } from 'jest';

const config: Config = {
    preset: 'ts-jest',
    verbose: true,
    bail: true,
    collectCoverageFrom: ['src/**/*.ts'],
};

export default config;
