import { readConfFile } from '../lib/utils';
import mockfs from 'mock-fs';

describe('read config file', () => {
    const CONF_FILE_PATH = 'conf-file.json';
    beforeAll(() => {
        const conf = {
            apiServer: 'https://test:8080',
            socketServer: 'wss://test:8081',
        };
        mockfs({
            [CONF_FILE_PATH]: JSON.stringify(conf),
        });
    });

    afterAll(() => {
        mockfs.restore();
    });

    it('should ready from a specified location without exiting', () => {
        const mockExit = jest
            .spyOn(process, 'exit')
            .mockImplementation(() => undefined as unknown as never);
        const config = readConfFile(CONF_FILE_PATH);
        expect(mockExit).not.toBeCalled();
        expect(config).toBeDefined();
    });

    it('should parse config and have all required properties', () => {
        const config = readConfFile(CONF_FILE_PATH);
        expect(typeof config.apiServer).toBe('string');
        expect(typeof config.socketServer).toBe('string');
    });
});
