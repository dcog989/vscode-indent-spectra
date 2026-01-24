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

        // 1. Determine Reference Depth
        // If current line is empty/whitespace, look back for the context of the previous non-empty line
        let referenceLineData = analyzeLine(activeLineNum);

        if (
            this.isEmptyOrIgnored(doc.lineAt(activeLineNum).text, ignoredLines.has(activeLineNum))
        ) {
            for (let i = activeLineNum - 1; i >= 0; i--) {
                const isIgnored = ignoredLines.has(i);
                const text = doc.lineAt(i).text;
                if (!this.isEmptyOrIgnored(text, isIgnored)) {
                    referenceLineData = analyzeLine(i);
                    break;
                }
            }
        }

        const targetDepth = referenceLineData.blocks.length;

        // If still 0 depth (top level), no active highlight
        if (targetDepth === 0) {
            return { highlightLevel: -1, blockStart: -1, blockEnd: -1 };
        }

        // The active guide corresponds to the current scope's depth (0-indexed level is depth - 1)
        const highlightLevel = targetDepth - 1;
        let blockStart = activeLineNum;
        let blockEnd = activeLineNum;

        // 2. Scan Upwards (Find Scope Start) - Stop at parent scope (indent < current)
        for (let i = activeLineNum - 1; i >= 0; i--) {
            const isIgnored = ignoredLines.has(i);
            const text = doc.lineAt(i).text;

            // Skip empty lines during scan to maintain continuity (don't break scope on empty line)
            if (this.isEmptyOrIgnored(text, isIgnored)) {
                // If we hit top of file while skipping empty lines, start is 0
                if (i === 0) blockStart = 0;
                continue;
            }

            const data = analyzeLine(i);
            // Found a line with strictly less indentation -> Parent
            if (data.blocks.length < targetDepth) {
                blockStart = i;
                break;
            }
            // Otherwise, it's part of the block or a child block, extend start
            blockStart = i;
        }

        // 3. Scan Downwards (Find Scope End)
        for (let i = activeLineNum + 1; i < lineCount; i++) {
            const isIgnored = ignoredLines.has(i);
            const text = doc.lineAt(i).text;

            if (this.isEmptyOrIgnored(text, isIgnored)) {
                if (i === lineCount - 1) blockEnd = lineCount - 1;
                continue;
            }

            const data = analyzeLine(i);
            if (data.blocks.length < targetDepth) {
                // Found end of block (closing brace or next block at parent level)
                blockEnd = i;
                break;
            }
            blockEnd = i;
        }

        return { highlightLevel, blockStart, blockEnd };
    }

    private static isEmptyOrIgnored(text: string, isIgnored: boolean): boolean {
        return isIgnored || text.trim().length === 0;
    }
}
