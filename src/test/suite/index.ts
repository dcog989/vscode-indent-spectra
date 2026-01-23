import { glob } from 'glob';
import Mocha from 'mocha';
import * as path from 'path';

export async function run(): Promise<void> {
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 10000,
    });

    const testsRoot = path.resolve(__dirname, '..');
    const files = await glob('**/**.test.js', { cwd: testsRoot });

    files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

    try {
        const failures = await new Promise<number>((resolve) => {
            mocha.run(resolve);
        });

        if (failures > 0) {
            throw new Error(`${failures} tests failed.`);
        }
    } catch (err) {
        console.error(err);
        throw err;
    }
}
