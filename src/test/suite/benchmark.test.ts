import * as assert from 'assert';
import * as vscode from 'vscode';
import { IndentSpectra } from '../../IndentSpectra';

suite('Performance Benchmark Suite', () => {
    let indentSpectra: IndentSpectra;
    const token = new vscode.CancellationTokenSource().token;

    suiteSetup(() => {
        indentSpectra = new IndentSpectra();
        console.log('--- STARTING BENCHMARKS ---');
    });

    suiteTeardown(() => {
        indentSpectra.dispose();
        console.log('--- FINISHED BENCHMARKS ---');
    });

    test('Benchmark: Deep Indentation (Stress Test)', async () => {
        const lineCount = 5000;
        const depth = 20;
        const indentString = '\t'.repeat(depth);
        const lines = new Array(lineCount).fill(`${indentString}const value = "test";`);
        const content = lines.join('\n');

        const doc = await vscode.workspace.openTextDocument({
            content: content,
            language: 'typescript',
        });
        await vscode.window.showTextDocument(doc);

        const start = performance.now();

        // Await the async update
        await (indentSpectra as any).updateAll(token);

        const end = performance.now();
        const duration = end - start;

        console.log(
            `[Benchmark Result] Deep Indentation Analysis (${lineCount} lines, depth ${depth}): ${duration.toFixed(2)}ms`,
        );
        assert.ok(duration < 500, `Performance regression: Analysis took ${duration.toFixed(2)}ms`);
    });

    test('Benchmark: Ignore Patterns (Regex Reuse)', async () => {
        const lineCount = 2000;
        const content = new Array(lineCount)
            .fill('/* Block comment start \n   indented inside \n end block */')
            .join('\n');

        const doc = await vscode.workspace.openTextDocument({
            content: content,
            language: 'typescript',
        });
        await vscode.window.showTextDocument(doc);

        const start = performance.now();
        await (indentSpectra as any).updateAll(token);
        const end = performance.now();
        const duration = end - start;

        console.log(
            `[Benchmark Result] Ignore Pattern Analysis (${lineCount} blocks): ${duration.toFixed(2)}ms`,
        );
        assert.ok(duration < 300, `Ignore analysis too slow: ${duration.toFixed(2)}ms`);
    });

    test('Benchmark: Massive File (50,000 Lines)', async () => {
        const lineCount = 50000;
        const depth = 5;
        const lines = new Array(lineCount).fill('\t'.repeat(depth) + 'const x = 1;');
        const content = lines.join('\n');

        const doc = await vscode.workspace.openTextDocument({
            content: content,
            language: 'typescript',
        });
        await vscode.window.showTextDocument(doc);

        const start = performance.now();
        await (indentSpectra as any).updateAll(token);
        const end = performance.now();
        const duration = end - start;

        console.log(
            `[Benchmark Result] Massive File Analysis (${lineCount} lines): ${duration.toFixed(2)}ms`,
        );
        assert.ok(duration < 2000, `Massive file analysis too slow: ${duration.toFixed(2)}ms`);
    });

    test('Benchmark: Allocation Stability (Jitter Test)', async () => {
        const lineCount = 2000;
        const iterations = 50; // Reduced iterations because of await overhead
        const lines = new Array(lineCount).fill('\t\t\t\tconst value = "test";');
        const content = lines.join('\n');

        const doc = await vscode.workspace.openTextDocument({
            content: content,
            language: 'typescript',
        });
        await vscode.window.showTextDocument(doc);

        const durations: number[] = [];

        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            await (indentSpectra as any).updateAll(token);
            durations.push(performance.now() - start);
        }

        const avg = durations.reduce((a, b) => a + b) / iterations;
        const max = Math.max(...durations);
        const jitter = max - avg;

        console.log(
            `[Benchmark Result] Jitter Test over ${iterations} iterations: Avg: ${avg.toFixed(2)}ms, Max: ${max.toFixed(2)}ms, Jitter: ${jitter.toFixed(2)}ms`,
        );
        assert.ok(jitter < 100, `High allocation jitter detected: ${jitter.toFixed(2)}ms`);
    });
});
