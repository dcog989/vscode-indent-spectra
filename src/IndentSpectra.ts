import * as vscode from 'vscode';
import type { IndentSpectraConfig } from './ConfigurationManager';
import { ConfigurationManager } from './ConfigurationManager';
import { DecorationManager } from './DecorationManager';
import { IndentationEngine, type LineAnalysis } from './IndentationEngine';
import { LRUCache } from './LRUCache';
import { ConfigUtils } from './ConfigUtils';

const YIELD_EVERY_LINES = 200;
const VISIBLE_LINE_BUFFER = 50;
const MASSIVE_FILE_THRESHOLD = 50000;
const MAX_CACHED_DOCUMENTS = 50;
const YIELD_TIMEOUT_MS = 5;

interface IndentationAnalysisResult {
    spectra: vscode.Range[][];
    activeLevelSpectra: vscode.Range[][];
    errors: vscode.Range[];
    mixed: vscode.Range[];
    processedLines: Set<number>;
}

export class IndentSpectra implements vscode.Disposable {
    private decorationManager: DecorationManager;
    private configManager: ConfigurationManager;
    private timeout: NodeJS.Timeout | null = null;
    private isDisposed = false;
    private decoratorCacheKey: string | null = null;
    private lineCache = new LRUCache<string, (LineAnalysis | undefined)[]>(MAX_CACHED_DOCUMENTS);
    private ignoredLinesCache = new LRUCache<string, Set<number>>(MAX_CACHED_DOCUMENTS);
    private lastTabSize = new LRUCache<string, number>(MAX_CACHED_DOCUMENTS);
    private lastAppliedState = new LRUCache<string, string>(MAX_CACHED_DOCUMENTS);
    private dirtyDocuments = new Set<string>();
    private cancellationSource?: vscode.CancellationTokenSource;
    private eventSequence = 0;
    private pendingEvents = new Map<
        string,
        { sequence: number; event: vscode.TextDocumentChangeEvent }
    >();

    public checkAndUpdateDirtyDocument(uri: vscode.Uri): void {
        const uriString = uri.toString();
        if (this.dirtyDocuments.has(uriString)) {
            // Clear stale data for this document
            this.lineCache.delete(uriString);
            this.lastAppliedState.delete(uriString);
            this.dirtyDocuments.delete(uriString);

            // Trigger update for this document if it's visible
            const isVisible = vscode.window.visibleTextEditors.some(
                (editor) => editor.document.uri.toString() === uriString,
            );
            if (isVisible) {
                this.triggerUpdate(undefined, true);
            }
        }
    }

    constructor() {
        this.configManager = new ConfigurationManager();
        this.configManager.onDidChangeConfig(() => this.handleConfigChange());
        this.decorationManager = new DecorationManager(vscode.window.activeColorTheme.kind);
        this.decoratorCacheKey = this.computeDecoratorCacheKey(this.configManager.current);
    }

    private handleConfigChange(): void {
        if (this.isDisposed) return;
        const config = this.configManager.current;
        const newCacheKey = this.computeDecoratorCacheKey(config);

        if (newCacheKey !== this.decoratorCacheKey) {
            this.decorationManager.disposeSuitesForConfig(config);
            this.decoratorCacheKey = newCacheKey;
        }

        // Mark all cached documents as dirty instead of clearing them immediately
        for (const uri of this.lineCache.keys()) {
            this.dirtyDocuments.add(uri);
        }

        // Clear caches that are no longer valid after config change
        this.ignoredLinesCache.clear();
        this.lastAppliedState.clear();

        // Only update active editor immediately, others will be updated when focused
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            this.triggerUpdate(undefined, true);
        }
    }

    private computeDecoratorCacheKey(config: IndentSpectraConfig): string {
        return ConfigUtils.computeConfigKey(config);
    }

    public reloadConfig(): void {
        this.configManager.load();
    }

    public handleThemeChange(): void {
        if (this.isDisposed) return;
        const config = this.configManager.current;

        if (config.activeIndentBrightness > 0) {
            this.decorationManager.disposeAllSuites();
            this.lastAppliedState.clear();
            this.triggerUpdate(undefined, true);
        }
    }

    public clearCache(uri: vscode.Uri): void {
        const uriString = uri.toString();
        this.lineCache.delete(uriString);
        this.ignoredLinesCache.delete(uriString);
        this.lastTabSize.delete(uriString);
        this.lastAppliedState.delete(uriString);
        this.decorationManager.getCurrentSuite()?.clearState(uri);
    }

    public clearAppliedState(uri: vscode.Uri): void {
        this.lastAppliedState.delete(uri.toString());
        this.decorationManager.getCurrentSuite()?.clearState(uri);
    }

    public dispose(): void {
        this.isDisposed = true;
        this.decorationManager.dispose();
        this.cancelCurrentWork();
        this.configManager.dispose();
        if (this.timeout) clearTimeout(this.timeout);
        this.lineCache.clear();
        this.ignoredLinesCache.clear();
        this.lastAppliedState.clear();
        this.lastTabSize.clear();
    }

    private cancelCurrentWork(): void {
        if (this.cancellationSource) {
            this.cancellationSource.cancel();
            this.cancellationSource.dispose();
            this.cancellationSource = undefined;
        }
    }

    public triggerUpdate(event?: vscode.TextDocumentChangeEvent, immediate = false): void {
        if (this.isDisposed) return;
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }

        if (event) {
            this.applyIncrementalChangeToCache(event, ++this.eventSequence);
        }

        const run = async (): Promise<void> => {
            this.cancelCurrentWork();
            this.cancellationSource = new vscode.CancellationTokenSource();
            await this.updateAll(this.cancellationSource.token);
        };

        if (immediate) {
            run();
        } else {
            this.timeout = setTimeout(run, this.configManager.current.updateDelay);
        }
    }

    private applyIncrementalChangeToCache(
        event: vscode.TextDocumentChangeEvent,
        sequence: number,
    ): void {
        const uri = event.document.uri.toString();

        // Store event with sequence number to ensure proper ordering
        this.pendingEvents.set(uri, { sequence, event });

        // Process events in order, skipping outdated ones
        const pending = this.pendingEvents.get(uri);
        if (!pending?.sequence || pending.sequence !== sequence) return;

        this.ignoredLinesCache.delete(uri);
        this.lastAppliedState.delete(uri);
        this.pendingEvents.delete(uri);

        const cache = this.lineCache.get(uri);
        if (!cache) return;

        const sortedChanges = [...event.contentChanges].sort(
            (a, b) => b.range.start.line - a.range.start.line,
        );

        for (const change of sortedChanges) {
            const startLine = change.range.start.line;
            const endLine = change.range.end.line;
            const linesAdded = (change.text.match(/\n/g) ?? []).length;
            const linesRemoved = endLine - startLine;
            cache.splice(startLine, linesRemoved + 1, ...new Array(linesAdded + 1).fill(undefined));
        }
    }

    private async updateAll(token: vscode.CancellationToken): Promise<void> {
        if (this.isDisposed) return;
        for (const editor of vscode.window.visibleTextEditors) {
            if (token.isCancellationRequested) return;
            await this.processEditor(editor, token);
        }
    }

    private async processEditor(
        editor: vscode.TextEditor,
        token: vscode.CancellationToken,
    ): Promise<void> {
        const doc = editor.document;
        const config = this.configManager.current;
        if (config.ignoredLanguages.has(doc.languageId)) return;

        const uri = doc.uri.toString();

        // Check and clear dirty status ONCE per document, not per line
        if (this.dirtyDocuments.has(uri)) {
            this.lineCache.delete(uri);
            this.lastAppliedState.delete(uri);
            this.dirtyDocuments.delete(uri);
        }

        const tabSize = this.resolveTabSize(editor);
        const ranges = editor.visibleRanges.length > 0 ? editor.visibleRanges : [];

        const activeLine = config.activeIndentBrightness > 0 ? editor.selection.active.line : -1;
        const activeChar =
            config.activeIndentBrightness > 0 ? editor.selection.active.character : -1;

        const rangesHash = ConfigUtils.hashRanges(ranges);
        const stateKey = `${doc.version}-${tabSize}-${activeLine}-${activeChar}-${rangesHash}`;
        if (this.lastAppliedState.get(uri) === stateKey) return;

        if (this.lastTabSize.get(uri) !== tabSize) {
            this.lineCache.delete(uri);
            this.lastTabSize.set(uri, tabSize);
        }

        const result = await this.analyzeIndentation(
            editor,
            tabSize,
            config.ignoreErrorLanguages.has(doc.languageId),
            ranges,
            token,
        );
        if (result && !token.isCancellationRequested) {
            this.applyDecorations(editor, result);
            this.lastAppliedState.set(uri, stateKey);
        }
    }

    private async analyzeIndentation(
        editor: vscode.TextEditor,
        tabSize: number,
        skipErrors: boolean,
        visibleRanges: readonly vscode.Range[],
        token: vscode.CancellationToken,
    ): Promise<IndentationAnalysisResult | null> {
        const doc = editor.document;
        const config = this.configManager.current;
        const uri = doc.uri.toString();
        const lineCount = doc.lineCount;
        let cache = this.lineCache.get(uri);

        if (cache?.length !== lineCount) {
            cache = new Array(lineCount).fill(undefined);
            this.lineCache.set(uri, cache);
        }

        let ignoredLines = this.ignoredLinesCache.get(uri);
        if (!ignoredLines) {
            ignoredLines = await this.identifyIgnoredLines(doc, token);
            if (token.isCancellationRequested) return null;
            this.ignoredLinesCache.set(uri, ignoredLines);
        }

        const activeLineNum = config.activeIndentBrightness > 0 ? editor.selection.active.line : -1;
        let highlightLevel = -1;
        let blockStart = -1;
        let blockEnd = -1;

        if (activeLineNum !== -1) {
            const cursorChar = editor.selection.active.character;
            const activeLineData = this.getOrAnalyzeLine(
                doc,
                activeLineNum,
                tabSize,
                skipErrors,
                ignoredLines.has(activeLineNum),
            );

            if (activeLineData.blocks.length === 0) {
                highlightLevel = -1;
            } else {
                highlightLevel = this.calculateHighlightLevel(
                    doc,
                    activeLineNum,
                    cursorChar,
                    activeLineData,
                    tabSize,
                    skipErrors,
                    ignoredLines,
                );
            }

            if (highlightLevel !== -1) {
                const minIndentLevel = highlightLevel + 1;
                blockStart = activeLineNum;
                blockEnd = activeLineNum;

                let lastNonEmptyIndent = activeLineData.blocks.length;
                for (let i = activeLineNum - 1; i >= 0; i--) {
                    const data = this.getOrAnalyzeLine(
                        doc,
                        i,
                        tabSize,
                        skipErrors,
                        ignoredLines.has(i),
                    );
                    const text = doc.lineAt(i).text;
                    const isEmpty = this.isEmptyOrIgnored(text, ignoredLines.has(i));

                    if (!isEmpty) {
                        if (data.blocks.length < minIndentLevel) break;
                        lastNonEmptyIndent = data.blocks.length;
                    } else if (lastNonEmptyIndent < minIndentLevel) {
                        break;
                    }
                    blockStart = i;
                }

                lastNonEmptyIndent = activeLineData.blocks.length;
                for (let i = activeLineNum + 1; i < lineCount; i++) {
                    const data = this.getOrAnalyzeLine(
                        doc,
                        i,
                        tabSize,
                        skipErrors,
                        ignoredLines.has(i),
                    );
                    const text = doc.lineAt(i).text;
                    const isEmpty = this.isEmptyOrIgnored(text, ignoredLines.has(i));

                    if (!isEmpty) {
                        if (data.blocks.length < minIndentLevel) break;
                        lastNonEmptyIndent = data.blocks.length;
                    } else if (lastNonEmptyIndent < minIndentLevel) {
                        break;
                    }
                    blockEnd = i;
                }
            }
        }

        const decorationSuite = this.decorationManager.getOrCreateSuite(
            config,
            vscode.window.activeColorTheme.kind,
        );
        const decoratorCount = decorationSuite?.getDecoratorCount() ?? 0;

        const spectra: vscode.Range[][] = Array.from({ length: decoratorCount }, () => []);
        const activeLevelSpectra: vscode.Range[][] = Array.from(
            { length: decoratorCount },
            () => [],
        );
        const errors: vscode.Range[] = [];
        const mixed: vscode.Range[] = [];
        const linesToProcess = new Set<number>();

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

        for (let idx = 0; idx < sortedLines.length; idx++) {
            const i = sortedLines[idx];
            if (
                idx % YIELD_EVERY_LINES === 0 &&
                performance.now() - lastYieldTime > YIELD_TIMEOUT_MS
            ) {
                await new Promise((resolve) => setTimeout(resolve, 0));
                if (token.isCancellationRequested) return null;
                lastYieldTime = performance.now();
            }

            const isIgnored = ignoredLines.has(i);
            const lineData = this.getOrAnalyzeLine(doc, i, tabSize, skipErrors, isIgnored);
            if (lineData.isIgnored) continue;

            const inActiveBlock = i >= blockStart && i <= blockEnd;

            for (let j = 0; j < lineData.blocks.length; j++) {
                const start = j === 0 ? 0 : lineData.blocks[j - 1];
                const range = new vscode.Range(i, start, i, lineData.blocks[j]);
                const decoratorIndex = j % (decorationSuite?.getDecoratorCount() ?? 1);

                if (inActiveBlock && j === highlightLevel && j < lineData.blocks.length) {
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

    private getOrAnalyzeLine(
        doc: vscode.TextDocument,
        line: number,
        tabSize: number,
        skipErrors: boolean,
        isIgnored: boolean,
    ): LineAnalysis {
        const uri = doc.uri.toString();
        const cache = this.lineCache.get(uri);
        if (cache?.[line] && cache[line]?.isIgnored === isIgnored) return cache[line]!;

        const data = isIgnored
            ? { blocks: [], visualWidth: 0, isMixed: false, isError: false, isIgnored: true }
            : IndentationEngine.analyzeLine(doc.lineAt(line).text, tabSize, skipErrors, isIgnored);

        if (cache) cache[line] = data;
        return data;
    }

    private calculateHighlightLevel(
        doc: vscode.TextDocument,
        lineNum: number,
        cursorChar: number,
        lineData: LineAnalysis,
        _tabSize: number,
        _skipErrors: boolean,
        _ignoredLines: Set<number>,
    ): number {
        const lineText = doc.lineAt(lineNum).text;
        const firstNonWhitespace = lineText.search(/\S/);

        // Special case: if cursor is before content and line has opening brace
        if (cursorChar < firstNonWhitespace && lineText.includes('{')) {
            // Highlight the deepest level this line has
            return lineData.blocks.length - 1;
        }

        // Special case: if cursor is after or at content position and line has opening brace
        if (cursorChar >= firstNonWhitespace && lineText.includes('{')) {
            // Highlight the level this brace introduces
            return lineData.blocks.length;
        }

        // Default: use cursor position relative to indent blocks
        for (let i = 0; i < lineData.blocks.length; i++) {
            if (cursorChar <= lineData.blocks[i]) {
                return i;
            }
        }

        // Cursor is past all blocks, return the last level
        return lineData.blocks.length - 1;
    }

    private isEmptyOrIgnored(text: string, isIgnored: boolean): boolean {
        return isIgnored || text.trim().length === 0;
    }

    private applyDecorations(editor: vscode.TextEditor, result: IndentationAnalysisResult): void {
        if (this.isDisposed) return;
        const decorationSuite = this.decorationManager.getCurrentSuite();
        if (!decorationSuite) return;

        decorationSuite.apply(
            editor,
            result.spectra,
            result.activeLevelSpectra,
            result.errors,
            result.mixed,
            result.processedLines,
        );
    }

    private resolveTabSize(editor: vscode.TextEditor): number {
        const size = editor.options.tabSize;
        if (typeof size === 'number') return size;
        if (typeof size === 'string') return parseInt(size, 10) || 4;
        return vscode.workspace.getConfiguration('editor').get<number>('tabSize') ?? 4;
    }

    private async identifyIgnoredLines(
        doc: vscode.TextDocument,
        token: vscode.CancellationToken,
    ): Promise<Set<number>> {
        const ignoredLines = new Set<number>();
        const patterns = this.configManager.current.compiledPatterns;
        if (
            patterns.length === 0 ||
            (doc.lineCount > MASSIVE_FILE_THRESHOLD && doc.languageId === 'plaintext')
        )
            return ignoredLines;

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
            const regex = this.configManager.createRegExp(globalPattern);
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
                for (let i = startLine; i <= endLine; i++) ignoredLines.add(i);

                // Handle zero-length matches to prevent infinite loops
                if (match[0]?.length === 0) {
                    regex.lastIndex++;
                }
            }
        }
        return ignoredLines;
    }
}
