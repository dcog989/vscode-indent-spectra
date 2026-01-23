import * as assert from 'assert';
import * as vscode from 'vscode';
import { IndentSpectra } from '../../IndentSpectra';

class MemoryEfficientContentGenerator {
    private static generateLine(indent: string, content: string): string {
        return `${indent}${content}`;
    }

    static generateIndentedContent(
        lineCount: number,
        depth: number,
        content: string = 'const value = "test";',
    ): string {
        const indent = '\t'.repeat(depth);
        const lines: string[] = [];

        // Generate in chunks to avoid holding entire array in memory
        const chunkSize = 1000;
        for (let i = 0; i < lineCount; i += chunkSize) {
            const currentChunkSize = Math.min(chunkSize, lineCount - i);
            const chunk: string[] = [];
            for (let j = 0; j < currentChunkSize; j++) {
                chunk.push(this.generateLine(indent, content));
            }
            lines.push(...chunk);
        }

        return lines.join('\n');
    }

    static generateBlockCommentContent(lineCount: number): string {
        const commentBlock = '/* Block comment start \n   indented inside \n end block */';
        const lines: string[] = [];

        const chunkSize = 500;
        for (let i = 0; i < lineCount; i += chunkSize) {
            const currentChunkSize = Math.min(chunkSize, lineCount - i);
            const chunk: string[] = [];
            for (let j = 0; j < currentChunkSize; j++) {
                chunk.push(commentBlock);
            }
            lines.push(...chunk);
        }

        return lines.join('\n');
    }
}

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
        const content = MemoryEfficientContentGenerator.generateIndentedContent(lineCount, depth);

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
        const content = MemoryEfficientContentGenerator.generateBlockCommentContent(lineCount);

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
        const content = MemoryEfficientContentGenerator.generateIndentedContent(
            lineCount,
            depth,
            'const x = 1;',
        );

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
        const content = MemoryEfficientContentGenerator.generateIndentedContent(lineCount, 4);

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
