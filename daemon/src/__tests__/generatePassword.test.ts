import { generatePassword } from '../lib/util/utils';

describe('generate password', () => {
    it('should be of type string', () => {
        const password = generatePassword(32);
        expect(typeof password).toBe('string');
    });
});
