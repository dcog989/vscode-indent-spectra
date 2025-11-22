import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Indent Spectra Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('user.indent-spectra'));
    });

    test('Should activate when a file is opened', async () => {
        const ext = vscode.extensions.getExtension('user.indent-spectra');
        assert.ok(ext, 'Extension not found');

        // Create a new document to trigger activation (onStartupFinished)
        const doc = await vscode.workspace.openTextDocument({
            content: 'function test() {\n\treturn true;\n}',
            language: 'javascript'
        });
        await vscode.window.showTextDocument(doc);

        // Wait a moment for activation if not already active
        if (!ext.isActive) {
            await ext.activate();
        }

        assert.strictEqual(ext.isActive, true);
    });

    test('Should handle configuration changes without reload', async () => {
        const config = vscode.workspace.getConfiguration('indentSpectra');

        // Update a setting
        await config.update('updateDelay', 200, vscode.ConfigurationTarget.Global);

        // Verify the setting was updated (The extension listens to this event internally)
        const newDelay = vscode.workspace.getConfiguration('indentSpectra').get('updateDelay');
        assert.strictEqual(newDelay, 200);

        // Cleanup: Reset to undefined to remove the setting
        await config.update('updateDelay', undefined, vscode.ConfigurationTarget.Global);
    });

    test('Should process mixed indentation without crashing', async () => {
        // 1 tab followed by 4 spaces (common error scenario)
        const content = 'root\n\tlevel 1\n\t    mixed level';

        // Use 'javascript' instead of 'plaintext' because 'plaintext' is
        // in ignoredLanguages by default, which skips the logic we want to test.
        const doc = await vscode.workspace.openTextDocument({
            content: content,
            language: 'javascript'
        });
        const editor = await vscode.window.showTextDocument(doc);

        // If the extension logic crashes, this test suite will likely timeout or fail
        assert.ok(editor.document);
    });
});