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
        activeChar: number,
        lineCount: number,
        ignoredLines: Set<number>,
        analyzeLine: LineAnalysisProvider,
    ): ScopeResult {
        if (activeLineNum === -1) {
            return { highlightLevel: -1, blockStart: -1, blockEnd: -1 };
        }

        // 1. Analyze Current Line (Look-back if empty/ignored)
        let currentDepth = 0;
        const lineText = doc.lineAt(activeLineNum).text;
        const isCurrentEmpty = this.isEmptyOrIgnored(lineText, ignoredLines.has(activeLineNum));

        if (isCurrentEmpty) {
            // If current line is empty, infer context from previous non-empty line
            for (let i = activeLineNum - 1; i >= 0; i--) {
                if (!this.isEmptyOrIgnored(doc.lineAt(i).text, ignoredLines.has(i))) {
                    currentDepth = analyzeLine(i).blocks.length;
                    break;
                }
            }
        } else {
            currentDepth = analyzeLine(activeLineNum).blocks.length;
        }

        // 2. Look Forward (Next Non-Empty Line)
        let nextDepth = currentDepth;
        for (let i = activeLineNum + 1; i < lineCount; i++) {
            if (!this.isEmptyOrIgnored(doc.lineAt(i).text, ignoredLines.has(i))) {
                nextDepth = analyzeLine(i).blocks.length;
                break;
            }
        }

        // 3. Determine Highlight Level
        let highlightLevel = -1;

        if (nextDepth > currentDepth) {
            // Opening Logic: We are opening a new block.
            // Decision depends on cursor position.
            // If cursor is at the end of the line (after content), we anticipate the new block -> Inner Scope.
            // If cursor is in the middle (editing the header), we stay in context -> Parent Scope.

            // Check if cursor is after the last non-whitespace character
            const contentEndIndex = lineText.trimEnd().length;
            const isAtEnd = activeChar >= contentEndIndex;

            if (isAtEnd) {
                highlightLevel = currentDepth; // Inner Scope
            } else {
                highlightLevel = currentDepth > 0 ? currentDepth - 1 : -1; // Parent Scope
            }
        } else {
            // Standard / Closing Logic: Highlight parent scope (Current - 1)
            highlightLevel = currentDepth > 0 ? currentDepth - 1 : -1;
        }

        if (highlightLevel === -1) {
            return { highlightLevel: -1, blockStart: -1, blockEnd: -1 };
        }

        // 4. Find Scope Boundaries
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

            const depth = analyzeLine(i).blocks.length;
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

            const depth = analyzeLine(i).blocks.length;
            if (depth < targetBlockCount) {
                blockEnd = i; // Guide connects to this closing line
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
