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

        // Use incremental string building to avoid large intermediate allocations
        const chunkSize = 500; // Smaller chunks for better memory efficiency
        let output = '';

        for (let i = 0; i < lineCount; i += chunkSize) {
            const currentChunkSize = Math.min(chunkSize, lineCount - i);
            let chunkOutput = '';

            // Build chunk string incrementally
            for (let j = 0; j < currentChunkSize; j++) {
                chunkOutput += this.generateLine(indent, content);
                if (i + j < lineCount - 1) {
                    chunkOutput += '\n';
                }
            }

            output += chunkOutput;

            // Periodically trigger garbage collection hint in test environment
            if (i % 2000 === 0 && i > 0) {
                if (global.gc) {
                    global.gc();
                }
            }
        }

        return output;
    }

    static generateBlockCommentContent(lineCount: number): string {
        const commentBlock = '/* Block comment start \n   indented inside \n end block */';
        let output = '';

        const chunkSize = 250; // Smaller chunks for block comments
        for (let i = 0; i < lineCount; i += chunkSize) {
            const currentChunkSize = Math.min(chunkSize, lineCount - i);
            let chunkOutput = '';

            for (let j = 0; j < currentChunkSize; j++) {
                chunkOutput += commentBlock;
                if (i + j < lineCount - 1) {
                    chunkOutput += '\n';
                }
            }

            output += chunkOutput;

            // Periodically trigger garbage collection hint in test environment
            if (i % 1000 === 0 && i > 0) {
                if (global.gc) {
                    global.gc();
                }
            }
        }

        return output;
    }

    // Alternative method using streaming for very large files
    static async generateLargeContentStream(
        lineCount: number,
        depth: number,
        content: string = 'const value = "test";',
    ): Promise<string> {
        const indent = '\t'.repeat(depth);
        const chunks: string[] = [];

        const chunkSize = 1000;
        for (let i = 0; i < lineCount; i += chunkSize) {
            const currentChunkSize = Math.min(chunkSize, lineCount - i);
            const chunkLines: string[] = [];

            for (let j = 0; j < currentChunkSize; j++) {
                chunkLines.push(this.generateLine(indent, content));
            }

            chunks.push(chunkLines.join('\n'));

            // Yield control periodically to prevent blocking
            if (i % 5000 === 0 && i > 0) {
                await new Promise((resolve) => setTimeout(resolve, 0));
            }
        }

        return chunks.join('\n');
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

            // Force garbage collection between iterations to get more stable measurements
            if (global.gc) {
                global.gc();
            }
        }

        const avg = durations.reduce((a, b) => a + b) / iterations;
        const max = Math.max(...durations);
        const jitter = max - avg;

        console.log(
            `[Benchmark Result] Jitter Test over ${iterations} iterations: Avg: ${avg.toFixed(2)}ms, Max: ${max.toFixed(2)}ms, Jitter: ${jitter.toFixed(2)}ms`,
        );
        assert.ok(jitter < 100, `High allocation jitter detected: ${jitter.toFixed(2)}ms`);
    });

    test('Benchmark: Memory-Efficient Large File (100,000 Lines)', async () => {
        const lineCount = 100000;
        const depth = 3;

        // Use streaming method for very large files to reduce memory pressure
        const content = await MemoryEfficientContentGenerator.generateLargeContentStream(
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
            `[Benchmark Result] Memory-Efficient Large File Analysis (${lineCount} lines): ${duration.toFixed(2)}ms`,
        );
        assert.ok(
            duration < 3000,
            `Memory-efficient large file analysis too slow: ${duration.toFixed(2)}ms`,
        );
    });
});
