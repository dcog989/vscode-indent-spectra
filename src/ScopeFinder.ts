import type * as vscode from 'vscode';
import type { LineAnalysis } from './IndentationEngine';

export interface ScopeResult {
    highlightLevel: number;
    blockStart: number;
    blockEnd: number;
}

export type LineAnalysisProvider = (line: number) => LineAnalysis;

export class ScopeFinder {
    public static findScope(
        doc: vscode.TextDocument,
        activeLineNum: number,
        lineCount: number,
        ignoredLines: Set<number>,
        analyzeLine: LineAnalysisProvider,
    ): ScopeResult {
        if (activeLineNum === -1) {
            return { highlightLevel: -1, blockStart: -1, blockEnd: -1 };
        }

        // 1. Analyze Current Line
        const currentDepth = this.getDepth(doc, activeLineNum, ignoredLines, analyzeLine);

        // 2. Look Back (Previous Non-Empty Line)
        let prevDepth = currentDepth;
        for (let i = activeLineNum - 1; i >= 0; i--) {
            if (!this.isEmptyOrIgnored(doc.lineAt(i).text, ignoredLines.has(i))) {
                prevDepth = this.getDepth(doc, i, ignoredLines, analyzeLine);
                break;
            }
        }

        // 3. Look Forward (Next Non-Empty Line)
        let nextDepth = currentDepth;
        for (let i = activeLineNum + 1; i < lineCount; i++) {
            if (!this.isEmptyOrIgnored(doc.lineAt(i).text, ignoredLines.has(i))) {
                nextDepth = this.getDepth(doc, i, ignoredLines, analyzeLine);
                break;
            }
        }

        // 4. Determine Highlight Level based on Context
        let highlightLevel = -1;

        if (nextDepth > currentDepth) {
            // Opening Logic: If we are opening a block, highlight the inner scope
            highlightLevel = currentDepth;
        } else if (prevDepth > currentDepth) {
            // Closing Logic: If we are closing a block, highlight the inner scope
            highlightLevel = currentDepth;
        } else {
            // Standard Logic: Highlight parent scope
            highlightLevel = currentDepth > 0 ? currentDepth - 1 : -1;
        }

        if (highlightLevel === -1) {
            return { highlightLevel: -1, blockStart: -1, blockEnd: -1 };
        }

        // 5. Find Scope Boundaries
        // We scan up/down to find the visual extents of this guide
        // The guide exists at 'highlightLevel' (0-indexed).
        // This corresponds to a block depth of 'highlightLevel + 1'.

        const targetBlockCount = highlightLevel + 1;
        let blockStart = activeLineNum;
        let blockEnd = activeLineNum;

        // Scan Upwards
        for (let i = activeLineNum - 1; i >= 0; i--) {
            const isIgnored = ignoredLines.has(i);
            const text = doc.lineAt(i).text;

            if (this.isEmptyOrIgnored(text, isIgnored)) {
                if (i === 0) blockStart = 0;
                continue;
            }

            const depth = this.getDepth(doc, i, ignoredLines, analyzeLine);
            if (depth < targetBlockCount) {
                blockStart = i; // Guide connects to this parent line
                break;
            }
            blockStart = i;
        }

        // Scan Downwards
        for (let i = activeLineNum + 1; i < lineCount; i++) {
            const isIgnored = ignoredLines.has(i);
            const text = doc.lineAt(i).text;

            if (this.isEmptyOrIgnored(text, isIgnored)) {
                if (i === lineCount - 1) blockEnd = lineCount - 1;
                continue;
            }

            const depth = this.getDepth(doc, i, ignoredLines, analyzeLine);
            if (depth < targetBlockCount) {
                blockEnd = i; // Guide connects to this closing line
                break;
            }
            blockEnd = i;
        }

        return { highlightLevel, blockStart, blockEnd };
    }

    private static getDepth(
        doc: vscode.TextDocument,
        line: number,
        ignoredLines: Set<number>,
        analyzeLine: LineAnalysisProvider,
    ): number {
        if (this.isEmptyOrIgnored(doc.lineAt(line).text, ignoredLines.has(line))) {
            return 0;
        }
        return analyzeLine(line).blocks.length;
    }

    private static isEmptyOrIgnored(text: string, isIgnored: boolean): boolean {
        return isIgnored || text.trim().length === 0;
    }
}
