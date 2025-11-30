import * as assert from 'assert';
import * as vscode from 'vscode';
import { IndentSpectra } from '../../IndentSpectra';

suite('Performance Benchmark Suite', () => {
    let indentSpectra: IndentSpectra;

    suiteSetup(() => {
        indentSpectra = new IndentSpectra();
        console.log('--- STARTING BENCHMARKS ---');
    });

    suiteTeardown(() => {
        indentSpectra.dispose();
        console.log('--- FINISHED BENCHMARKS ---');
    });

    test('Benchmark: Deep Indentation (Stress Test)', async () => {
        // 1. Setup: Generate a "Torture File"
        // 5,000 lines, each with 20 levels of indentation.
        // Total indentation blocks: 100,000.
        // Legacy Algorithm: ~100,000 doc.positionAt() calls (Slow).
        // New Algorithm: 0 doc.positionAt() calls inside loop (Fast).
        const lineCount = 5000;
        const depth = 20;
        const indentString = '\t'.repeat(depth);
        let content = '';

        // Build large string in memory
        const lines = new Array(lineCount).fill(`${indentString}const value = "test";`);
        content = lines.join('\n');

        const doc = await vscode.workspace.openTextDocument({
            content: content,
            language: 'typescript'
        });
        await vscode.window.showTextDocument(doc);

        // 2. Measure Execution Time
        const start = performance.now();

        // Force synchronous update (bypassing debounce)
        // Cast to any to access private 'updateAll' method for raw benchmarking
        (indentSpectra as any).updateAll();

        const end = performance.now();
        const duration = end - start;

        console.log(`[Benchmark Result] Deep Indentation Analysis (${lineCount} lines, depth ${depth}): ${duration.toFixed(2)}ms`);

        // 3. Assertions
        // Expect < 200ms on modern hardware. Unoptimized version usually takes > 600ms.
        assert.ok(duration < 300, `Performance regression: Analysis took ${duration.toFixed(2)}ms (expected < 300ms)`);
    });

    test('Benchmark: Ignore Patterns (Regex Reuse)', async () => {
        // Setup: File with many potential matches for ignore patterns (comments)
        const lineCount = 2000;
        const content = new Array(lineCount)
            .fill('/* Block comment start \n   indented inside \n end block */')
            .join('\n');

        const doc = await vscode.workspace.openTextDocument({
            content: content,
            language: 'typescript'
        });
        await vscode.window.showTextDocument(doc);

        const start = performance.now();
        (indentSpectra as any).updateAll();
        const end = performance.now();
        const duration = end - start;

        console.log(`[Benchmark Result] Ignore Pattern Analysis (${lineCount} blocks): ${duration.toFixed(2)}ms`);

        assert.ok(duration < 200, `Ignore analysis too slow: ${duration.toFixed(2)}ms`);
    });
});
