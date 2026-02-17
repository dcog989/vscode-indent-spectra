import { runTests } from '@vscode/test-electron';
import * as path from 'path';

async function main() {
    try {
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');
        const extensionTestsPath = path.resolve(__dirname, './suite/index');

        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            // Match the "engines > vscode" version in your package.json
            version: '1.109.4',
            launchArgs: [
                extensionDevelopmentPath, // open project root as workspace so ConfigurationTarget.Workspace is available
                '--disable-workspace-trust',
                '--disable-gpu',
                '--skip-welcome',
                '--skip-release-notes',
            ],
        });
    } catch (err) {
        console.error('Failed to run tests', err);
        process.exit(1);
    }
}

main();
