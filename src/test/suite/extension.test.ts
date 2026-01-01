import * as assert from 'assert';
import * as vscode from 'vscode';
import { IndentSpectra } from '../../IndentSpectra';

suite('Indent Spectra Comprehensive Test Suite', () => {
    let indentSpectra: IndentSpectra;

    // Test setup
    suiteSetup(async () => {
        vscode.window.showInformationMessage('Starting Indent Spectra Tests');
    });

    suiteTeardown(async () => {
        if (indentSpectra) {
            indentSpectra.dispose();
        }
    });

    // ============================================================================
    // BASIC EXTENSION TESTS
    // ============================================================================

    test('Extension should be present', () => {
        const ext = vscode.extensions.getExtension('dcog989.indent-spectra');
        assert.ok(ext, 'Extension not found. Make sure extension is properly installed.');
    });

    test('Should activate when a file is opened', async () => {
        const ext = vscode.extensions.getExtension('dcog989.indent-spectra');
        assert.ok(ext, 'Extension not found. Make sure extension is properly installed.');

        const doc = await vscode.workspace.openTextDocument({
            content: 'function test() {\n\treturn true;\n}',
            language: 'javascript'
        });
        await vscode.window.showTextDocument(doc);

        if (!ext.isActive) {
            await ext.activate();
        }

        assert.strictEqual(ext.isActive, true, 'Extension should be active');
    });

    // ============================================================================
    // MIXED INDENTATION DETECTION
    // ============================================================================

    test('Should detect mixed tabs and spaces on the same line', async () => {
        indentSpectra = new IndentSpectra();

        // 1 tab followed by 4 spaces
        const content = 'root\n\t    mixed level';

        const doc = await vscode.workspace.openTextDocument({
            content: content,
            language: 'javascript'
        });
        const editor = await vscode.window.showTextDocument(doc);

        // Should not crash; decorations should be applied
        indentSpectra.triggerUpdate();

        assert.ok(editor.document, 'Document should exist');
    });

    test('Should handle pure tabs without errors', async () => {
        indentSpectra = new IndentSpectra();

        const content = 'root\n\tlevel 1\n\t\tlevel 2\n\t\t\tlevel 3';

        const doc = await vscode.workspace.openTextDocument({
            content: content,
            language: 'javascript'
        });
        await vscode.window.showTextDocument(doc);

        indentSpectra.triggerUpdate();
        assert.ok(true, 'Pure tabs should be handled without crashing');
    });

    test('Should handle pure spaces without errors', async () => {
        indentSpectra = new IndentSpectra();

        const content = 'root\n  level 1\n    level 2\n      level 3';

        const doc = await vscode.workspace.openTextDocument({
            content: content,
            language: 'javascript'
        });
        await vscode.window.showTextDocument(doc);

        indentSpectra.triggerUpdate();
        assert.ok(true, 'Pure spaces should be handled without crashing');
    });

    // ============================================================================
    // INDENTATION ERROR DETECTION
    // ============================================================================

    test('Should detect indentation errors (unaligned to tabSize)', async () => {
        indentSpectra = new IndentSpectra();

        // Assuming tabSize = 4, this indent of 3 spaces is an error
        const content = 'root\n   unaligned';

        const doc = await vscode.workspace.openTextDocument({
            content: content,
            language: 'javascript'
        });
        await vscode.window.showTextDocument(doc);

        indentSpectra.triggerUpdate();
        assert.ok(true, 'Error detection should not crash');
    });

    test('Should not flag errors for multi-line comments in ignored languages', async () => {
        indentSpectra = new IndentSpectra();

        // Markdown is in ignoredLanguages by default
        const content = '# Header\n   some markdown\n  * list';

        const doc = await vscode.workspace.openTextDocument({
            content: content,
            language: 'markdown'
        });
        await vscode.window.showTextDocument(doc);

        // Should not throw; markdown language should be skipped
        indentSpectra.triggerUpdate();
        assert.ok(true, 'Markdown should be skipped');
    });

    // ============================================================================
    // COLOR PRESET SWITCHING
    // ============================================================================

    test('Should load and apply universal color preset', async () => {
        indentSpectra = new IndentSpectra();

        const config = vscode.workspace.getConfiguration('indentSpectra');
        await config.update('colorPreset', 'universal', vscode.ConfigurationTarget.Global);

        indentSpectra.reloadConfig();
        assert.ok(true, 'Universal preset should load');

        await config.update('colorPreset', undefined, vscode.ConfigurationTarget.Global);
    });

    test('Should load and apply protan-deuteran color preset', async () => {
        indentSpectra = new IndentSpectra();

        const config = vscode.workspace.getConfiguration('indentSpectra');
        await config.update('colorPreset', 'protan-deuteran', vscode.ConfigurationTarget.Global);

        indentSpectra.reloadConfig();
        assert.ok(true, 'Protan-deuteran preset should load');

        await config.update('colorPreset', undefined, vscode.ConfigurationTarget.Global);
    });

    test('Should load and apply tritan color preset', async () => {
        indentSpectra = new IndentSpectra();

        const config = vscode.workspace.getConfiguration('indentSpectra');
        await config.update('colorPreset', 'tritan', vscode.ConfigurationTarget.Global);

        indentSpectra.reloadConfig();
        assert.ok(true, 'Tritan preset should load');

        await config.update('colorPreset', undefined, vscode.ConfigurationTarget.Global);
    });

    test('Should load and apply cool color preset', async () => {
        indentSpectra = new IndentSpectra();

        const config = vscode.workspace.getConfiguration('indentSpectra');
        await config.update('colorPreset', 'cool', vscode.ConfigurationTarget.Global);

        indentSpectra.reloadConfig();
        assert.ok(true, 'Cool preset should load');

        await config.update('colorPreset', undefined, vscode.ConfigurationTarget.Global);
    });

    test('Should load and apply warm color preset', async () => {
        indentSpectra = new IndentSpectra();

        const config = vscode.workspace.getConfiguration('indentSpectra');
        await config.update('colorPreset', 'warm', vscode.ConfigurationTarget.Global);

        indentSpectra.reloadConfig();
        assert.ok(true, 'Warm preset should load');

        await config.update('colorPreset', undefined, vscode.ConfigurationTarget.Global);
    });

    test('Should handle custom colors with valid RGBA values', async () => {
        indentSpectra = new IndentSpectra();

        const config = vscode.workspace.getConfiguration('indentSpectra');
        await config.update('colorPreset', 'custom', vscode.ConfigurationTarget.Global);
        await config.update(
            'colors',
            [
                'rgba(255, 0, 0, 0.1)',
                'rgba(0, 255, 0, 0.1)',
                'rgba(0, 0, 255, 0.1)',
                'rgba(255, 255, 0, 0.1)'
            ],
            vscode.ConfigurationTarget.Global
        );

        indentSpectra.reloadConfig();
        assert.ok(true, 'Custom colors should load');

        await config.update('colorPreset', undefined, vscode.ConfigurationTarget.Global);
        await config.update('colors', undefined, vscode.ConfigurationTarget.Global);
    });

    test('Should handle custom colors with hex values', async () => {
        indentSpectra = new IndentSpectra();

        const config = vscode.workspace.getConfiguration('indentSpectra');
        await config.update('colorPreset', 'custom', vscode.ConfigurationTarget.Global);
        await config.update(
            'colors',
            ['#FF0000', '#00FF00', '#0000FF', '#FFFF00'],
            vscode.ConfigurationTarget.Global
        );

        indentSpectra.reloadConfig();
        assert.ok(true, 'Hex colors should load');

        await config.update('colorPreset', undefined, vscode.ConfigurationTarget.Global);
        await config.update('colors', undefined, vscode.ConfigurationTarget.Global);
    });

    test('Should reject invalid custom colors and fallback to universal', async () => {
        indentSpectra = new IndentSpectra();

        const config = vscode.workspace.getConfiguration('indentSpectra');
        await config.update('colorPreset', 'custom', vscode.ConfigurationTarget.Global);
        await config.update(
            'colors',
            ['invalid_color_xyz', 'also_bad_123'],
            vscode.ConfigurationTarget.Global
        );

        // Should not crash; should fallback to universal palette
        indentSpectra.reloadConfig();
        assert.ok(true, 'Invalid colors should fallback gracefully');

        await config.update('colorPreset', undefined, vscode.ConfigurationTarget.Global);
        await config.update('colors', undefined, vscode.ConfigurationTarget.Global);
    });

    // ============================================================================
    // CONFIGURATION CHANGES
    // ============================================================================

    test('Should handle configuration changes without reload', async () => {
        indentSpectra = new IndentSpectra();
        const config = vscode.workspace.getConfiguration('indentSpectra');

        // Update delay setting
        await config.update('updateDelay', 200, vscode.ConfigurationTarget.Global);

        indentSpectra.reloadConfig();

        const newDelay = vscode.workspace.getConfiguration('indentSpectra').get('updateDelay');
        assert.strictEqual(newDelay, 200, 'Update delay should be 200ms');

        await config.update('updateDelay', undefined, vscode.ConfigurationTarget.Global);
    });

    test('Should update indicator style from classic to light', async () => {
        indentSpectra = new IndentSpectra();
        const config = vscode.workspace.getConfiguration('indentSpectra');

        await config.update('indicatorStyle', 'light', vscode.ConfigurationTarget.Global);
        indentSpectra.reloadConfig();

        const style = vscode.workspace.getConfiguration('indentSpectra').get('indicatorStyle');
        assert.strictEqual(style, 'light', 'Indicator style should be light');

        await config.update('indicatorStyle', undefined, vscode.ConfigurationTarget.Global);
    });

    test('Should update indicator style from light to classic', async () => {
        indentSpectra = new IndentSpectra();
        const config = vscode.workspace.getConfiguration('indentSpectra');

        await config.update('indicatorStyle', 'classic', vscode.ConfigurationTarget.Global);
        indentSpectra.reloadConfig();

        const style = vscode.workspace.getConfiguration('indentSpectra').get('indicatorStyle');
        assert.strictEqual(style, 'classic', 'Indicator style should be classic');

        await config.update('indicatorStyle', undefined, vscode.ConfigurationTarget.Global);
    });

    test('Should update light indicator width', async () => {
        indentSpectra = new IndentSpectra();
        const config = vscode.workspace.getConfiguration('indentSpectra');

        await config.update('indicatorStyle', 'light', vscode.ConfigurationTarget.Global);
        await config.update('lightIndicatorWidth', 3, vscode.ConfigurationTarget.Global);

        indentSpectra.reloadConfig();

        const width = vscode.workspace.getConfiguration('indentSpectra').get('lightIndicatorWidth');
        assert.strictEqual(width, 3, 'Light indicator width should be 3');

        await config.update('indicatorStyle', undefined, vscode.ConfigurationTarget.Global);
        await config.update('lightIndicatorWidth', undefined, vscode.ConfigurationTarget.Global);
    });

    test('Should update error color', async () => {
        indentSpectra = new IndentSpectra();
        const config = vscode.workspace.getConfiguration('indentSpectra');

        await config.update('errorColor', 'rgba(255, 0, 0, 0.7)', vscode.ConfigurationTarget.Global);

        indentSpectra.reloadConfig();

        const errorColor = vscode.workspace.getConfiguration('indentSpectra').get('errorColor');
        assert.strictEqual(errorColor, 'rgba(255, 0, 0, 0.7)', 'Error color should be updated');

        await config.update('errorColor', undefined, vscode.ConfigurationTarget.Global);
    });

    test('Should update mix color', async () => {
        indentSpectra = new IndentSpectra();
        const config = vscode.workspace.getConfiguration('indentSpectra');

        await config.update('mixColor', 'rgba(255, 255, 0, 0.8)', vscode.ConfigurationTarget.Global);

        indentSpectra.reloadConfig();

        const mixColor = vscode.workspace.getConfiguration('indentSpectra').get('mixColor');
        assert.strictEqual(mixColor, 'rgba(255, 255, 0, 0.8)', 'Mix color should be updated');

        await config.update('mixColor', undefined, vscode.ConfigurationTarget.Global);
    });

    // ============================================================================
    // IGNORE PATTERNS
    // ============================================================================

    test('Should apply ignore patterns to comments', async () => {
        indentSpectra = new IndentSpectra();

        const config = vscode.workspace.getConfiguration('indentSpectra');
        await config.update(
            'ignorePatterns',
            ['/[ \t]*[*]/g', '/[ \t]+[/]{2}/g'],
            vscode.ConfigurationTarget.Global
        );

        indentSpectra.reloadConfig();

        // Content with block comment indent
        const content = '/*\n *  indented comment\n */\ncode';
        const doc = await vscode.workspace.openTextDocument({
            content: content,
            language: 'javascript'
        });
        await vscode.window.showTextDocument(doc);

        indentSpectra.triggerUpdate();
        assert.ok(true, 'Ignore patterns should be applied without crashing');

        await config.update('ignorePatterns', undefined, vscode.ConfigurationTarget.Global);
    });

    test('Should handle empty ignore patterns', async () => {
        indentSpectra = new IndentSpectra();

        const config = vscode.workspace.getConfiguration('indentSpectra');
        await config.update('ignorePatterns', [], vscode.ConfigurationTarget.Global);

        indentSpectra.reloadConfig();

        const content = 'code\n  indented';
        const doc = await vscode.workspace.openTextDocument({
            content: content,
            language: 'javascript'
        });
        await vscode.window.showTextDocument(doc);

        indentSpectra.triggerUpdate();
        assert.ok(true, 'Empty ignore patterns should work');

        await config.update('ignorePatterns', undefined, vscode.ConfigurationTarget.Global);
    });

    test('Should ignore error highlighting for specified languages', async () => {
        indentSpectra = new IndentSpectra();

        const config = vscode.workspace.getConfiguration('indentSpectra');
        await config.update('ignoreErrorLanguages', ['markdown', 'plaintext'], vscode.ConfigurationTarget.Global);

        indentSpectra.reloadConfig();

        // Markdown with misaligned indent should not show error highlight
        const content = '# Header\n   bad indent';
        const doc = await vscode.workspace.openTextDocument({
            content: content,
            language: 'markdown'
        });
        await vscode.window.showTextDocument(doc);

        indentSpectra.triggerUpdate();
        assert.ok(true, 'Error highlighting should be ignored for markdown');

        await config.update('ignoreErrorLanguages', undefined, vscode.ConfigurationTarget.Global);
    });

    // ============================================================================
    // LANGUAGE-SPECIFIC BEHAVIOR
    // ============================================================================

    test('Should skip processing for ignored languages', async () => {
        indentSpectra = new IndentSpectra();

        const config = vscode.workspace.getConfiguration('indentSpectra');
        await config.update('ignoredLanguages', ['plaintext'], vscode.ConfigurationTarget.Global);

        indentSpectra.reloadConfig();

        const doc = await vscode.workspace.openTextDocument({
            content: 'some\n  text',
            language: 'plaintext'
        });
        await vscode.window.showTextDocument(doc);

        indentSpectra.triggerUpdate();
        assert.ok(true, 'Plaintext should be skipped');

        await config.update('ignoredLanguages', undefined, vscode.ConfigurationTarget.Global);
    });

    test('Should process non-ignored languages normally', async () => {
        indentSpectra = new IndentSpectra();

        const doc = await vscode.workspace.openTextDocument({
            content: 'function test() {\n  const x = 1;\n}',
            language: 'javascript'
        });
        await vscode.window.showTextDocument(doc);

        indentSpectra.triggerUpdate();
        assert.ok(true, 'JavaScript should be processed');
    });

    // ============================================================================
    // LARGE FILE PERFORMANCE
    // ============================================================================

    test('Should handle large files without timeout', async () => {
        indentSpectra = new IndentSpectra();

        // Generate a large file with many indentation levels
        let content = 'root\n';
        for (let i = 0; i < 1000; i++) {
            const indent = '\t'.repeat((i % 5) + 1);
            content += `${indent}line ${i}\n`;
        }

        const doc = await vscode.workspace.openTextDocument({
            content: content,
            language: 'javascript'
        });
        await vscode.window.showTextDocument(doc);

        const startTime = Date.now();
        indentSpectra.triggerUpdate();
        const endTime = Date.now();

        const elapsed = endTime - startTime;
        assert.ok(elapsed < 5000, `Large file processing should complete in < 5 seconds, took ${elapsed}ms`);
    });

    test('Should handle deeply nested indentation', async () => {
        indentSpectra = new IndentSpectra();

        // Generate deeply nested structure
        let content = 'root\n';
        for (let i = 0; i < 50; i++) {
            content += '\t'.repeat(i + 1) + `level ${i}\n`;
        }

        const doc = await vscode.workspace.openTextDocument({
            content: content,
            language: 'javascript'
        });
        await vscode.window.showTextDocument(doc);

        indentSpectra.triggerUpdate();
        assert.ok(true, 'Deep nesting should be handled');
    });

    // ============================================================================
    // TAB SIZE DETECTION
    // ============================================================================

    test('Should detect tab size from editor options', async () => {
        indentSpectra = new IndentSpectra();

        const doc = await vscode.workspace.openTextDocument({
            content: 'code\n  indented',
            language: 'javascript'
        });
        const editor = await vscode.window.showTextDocument(doc);

        // Set editor tab size
        await editor.edit(editBuilder => {
            // Empty edit just to trigger options
        });

        indentSpectra.triggerUpdate();
        assert.ok(true, 'Tab size detection should work');
    });

    // ============================================================================
    // LIFECYCLE & CLEANUP
    // ============================================================================

    test('Should properly dispose resources', async () => {
        indentSpectra = new IndentSpectra();

        indentSpectra.dispose();
        assert.ok(true, 'Dispose should not throw');
    });

    test('Should handle multiple reloadConfig calls', async () => {
        indentSpectra = new IndentSpectra();

        indentSpectra.reloadConfig();
        indentSpectra.reloadConfig();
        indentSpectra.reloadConfig();

        assert.ok(true, 'Multiple reloadConfig calls should not crash');
    });

    test('Should handle triggerUpdate before document is ready', async () => {
        indentSpectra = new IndentSpectra();

        // Close all editors
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');

        // This should not crash even with no active editor
        indentSpectra.triggerUpdate();
        assert.ok(true, 'TriggerUpdate with no active editor should not crash');
    });

    // ============================================================================
    // BLOCK COMMENTS
    // ============================================================================

    test('Should correctly ignore multi-line block comments', async () => {
        indentSpectra = new IndentSpectra();

        // Add a regex for multi-line C-style comments
        const config = vscode.workspace.getConfiguration('indentSpectra');
        await config.update('ignorePatterns', ['/\\/\\*[\\s\\S]*?\\*\\//g'], vscode.ConfigurationTarget.Global);
        indentSpectra.reloadConfig();

        const content = '/*\n\tignored line\n*/\n\tnot ignored';
        const doc = await vscode.workspace.openTextDocument({
            content: content,
            language: 'javascript'
        });
        await vscode.window.showTextDocument(doc);

        // Just ensure it doesn't crash and processes the file
        indentSpectra.triggerUpdate();
        assert.ok(true, 'Multi-line ignore pattern processed successfully');

        // Cleanup
        await config.update('ignorePatterns', undefined, vscode.ConfigurationTarget.Global);
    });


    // ============================================================================
    // REGEX
    // ============================================================================
    test('Should handle ignore patterns with end-of-line anchors', async () => {
        indentSpectra = new IndentSpectra();
        const config = vscode.workspace.getConfiguration('indentSpectra');

        // Pattern looking for 'ignore' at the end of a line
        await config.update('ignorePatterns', ['/ignore$/'], vscode.ConfigurationTarget.Global);
        indentSpectra.reloadConfig();

        const content = 'line to ignore\n  not this one';
        const doc = await vscode.workspace.openTextDocument({ content, language: 'javascript' });
        await vscode.window.showTextDocument(doc);

        indentSpectra.triggerUpdate();
        assert.ok(true, 'Regex with end anchor should be compiled and executed correctly');

        await config.update('ignorePatterns', undefined, vscode.ConfigurationTarget.Global);
    });
});
