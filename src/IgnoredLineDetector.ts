import type * as vscode from 'vscode';
import { PatternCompiler, type CompiledPattern } from './PatternCompiler';

const YIELD_TIMEOUT_MS = 5;
const MASSIVE_FILE_THRESHOLD = 50000;

export class IgnoredLineDetector {
    public static async identifyIgnoredLines(
        doc: vscode.TextDocument,
        patterns: CompiledPattern[],
        token: vscode.CancellationToken,
    ): Promise<Set<number>> {
        const ignoredLines = new Set<number>();

        if (
            patterns.length === 0 ||
            (doc.lineCount > MASSIVE_FILE_THRESHOLD && doc.languageId === 'plaintext')
        ) {
            return ignoredLines;
        }

        const text = doc.getText();
        const lineStarts: number[] = [];
        for (let i = 0; i < doc.lineCount; i++) {
            lineStarts.push(doc.offsetAt(doc.lineAt(i).range.start));
        }

        const getLineIndex = (offset: number): number => {
            let low = 0;
            let high = lineStarts.length - 1;

            while (low < high) {
                const mid = Math.floor((low + high + 1) / 2);
                if (lineStarts[mid] <= offset) {
                    low = mid;
                } else {
                    high = mid - 1;
                }
            }
            return low;
        };

        let lastYieldTime = performance.now();

        for (const pattern of patterns) {
            // Get cached regex with global flag for finding all matches
            const flags = pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g';
            const globalPattern = { source: pattern.source, flags };

            // Use PatternCompiler directly to leverage its static cache
            const regex = PatternCompiler.createRegExp(globalPattern);

            let match: RegExpExecArray | null;
            let matchCount = 0;

            while ((match = regex.exec(text)) !== null) {
                if (
                    ++matchCount % 50 === 0 &&
                    performance.now() - lastYieldTime > YIELD_TIMEOUT_MS
                ) {
                    await new Promise((resolve) => setTimeout(resolve, 0));
                    if (token.isCancellationRequested) return ignoredLines;
                    lastYieldTime = performance.now();
                }

                const startLine = getLineIndex(match.index);
                const endLine = getLineIndex(match.index + (match[0]?.length ?? 0));

                for (let i = startLine; i <= endLine; i++) {
                    ignoredLines.add(i);
                }

                // Handle zero-length matches to prevent infinite loops
                if (match[0]?.length === 0) {
                    regex.lastIndex++;
                }
            }
        }

        return ignoredLines;
    }
}
