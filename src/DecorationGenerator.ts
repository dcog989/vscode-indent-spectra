import * as vscode from 'vscode';
import type { LineAnalysis } from './IndentationEngine';

const YIELD_EVERY_LINES = 200;
const YIELD_TIMEOUT_MS = 5;
const VISIBLE_LINE_BUFFER = 50;

export interface DecorationResult {
    spectra: vscode.Range[][];
    activeLevelSpectra: vscode.Range[][];
    errors: vscode.Range[];
    mixed: vscode.Range[];
    processedLines: Set<number>;
}

export type LineAnalysisProvider = (line: number) => LineAnalysis;

export class DecorationGenerator {
    public static async generate(
        doc: vscode.TextDocument,
        visibleRanges: readonly vscode.Range[],
        decoratorCount: number,
        scope: { highlightLevel: number; blockStart: number; blockEnd: number },
        analyzeLine: LineAnalysisProvider,
        token: vscode.CancellationToken,
    ): Promise<DecorationResult | null> {
        const lineCount = doc.lineCount;

        // Initialize collections
        const spectra: vscode.Range[][] = Array.from({ length: decoratorCount }, () => []);
        const activeLevelSpectra: vscode.Range[][] = Array.from(
            { length: decoratorCount },
            () => [],
        );
        const errors: vscode.Range[] = [];
        const mixed: vscode.Range[] = [];
        const linesToProcess = new Set<number>();

        // Calculate lines to process
        if (visibleRanges.length === 0 || (visibleRanges[0]?.isEmpty ?? true)) {
            const end = Math.min(lineCount - 1, 100);
            for (let i = 0; i <= end; i++) linesToProcess.add(i);
        } else {
            for (const range of visibleRanges) {
                const start = Math.max(0, range.start.line - VISIBLE_LINE_BUFFER);
                const end = Math.min(lineCount - 1, range.end.line + VISIBLE_LINE_BUFFER);
                for (let i = start; i <= end; i++) linesToProcess.add(i);
            }
        }

        const sortedLines = Array.from(linesToProcess).sort((a, b) => a - b);
        let lastYieldTime = performance.now();

        const { highlightLevel, blockStart, blockEnd } = scope;

        for (let idx = 0; idx < sortedLines.length; idx++) {
            const i = sortedLines[idx];

            // Yield to event loop to prevent blocking UI
            if (
                idx % YIELD_EVERY_LINES === 0 &&
                performance.now() - lastYieldTime > YIELD_TIMEOUT_MS
            ) {
                await new Promise((resolve) => setTimeout(resolve, 0));
                if (token.isCancellationRequested) return null;
                lastYieldTime = performance.now();
            }

            // 'isIgnored' check is handled internally by the analyzeLine closure
            const lineData = analyzeLine(i);

            if (lineData.isIgnored) continue;

            const inActiveBlock = i >= blockStart && i <= blockEnd;

            // Generate spectrum decorations (indent guides)
            for (let j = 0; j < lineData.blocks.length; j++) {
                const start = j === 0 ? 0 : lineData.blocks[j - 1];
                const range = new vscode.Range(i, start, i, lineData.blocks[j]);
                const decoratorIndex = j % (decoratorCount || 1);

                if (inActiveBlock && j === highlightLevel) {
                    activeLevelSpectra[decoratorIndex].push(range);
                } else {
                    spectra[decoratorIndex].push(range);
                }
            }

            if (lineData.isError) {
                errors.push(
                    new vscode.Range(i, 0, i, lineData.blocks[lineData.blocks.length - 1] ?? 0),
                );
            }
            if (lineData.isMixed) {
                mixed.push(
                    new vscode.Range(i, 0, i, lineData.blocks[lineData.blocks.length - 1] ?? 0),
                );
            }
        }

        return { spectra, activeLevelSpectra, errors, mixed, processedLines: linesToProcess };
    }
}
