import * as vscode from 'vscode';
import type { IndentSpectraConfig } from './ConfigurationManager';
import { ConfigurationManager } from './ConfigurationManager';
import { ConfigUtils } from './ConfigUtils';
import { DecorationGenerator, type DecorationResult } from './DecorationGenerator';
import { DecorationManager } from './DecorationManager';
import { IgnoredLineDetector } from './IgnoredLineDetector';
import { IndentationEngine, type LineAnalysis } from './IndentationEngine';
import { LRUCache } from './LRUCache';
import { ScopeFinder } from './ScopeFinder';

const MAX_CACHED_DOCUMENTS = 50;

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
    ): Promise<DecorationResult | null> {
        const doc = editor.document;
        const config = this.configManager.current;
        const uri = doc.uri.toString();
        const lineCount = doc.lineCount;
        let cache = this.lineCache.get(uri);

        if (cache?.length !== lineCount) {
            cache = new Array(lineCount).fill(undefined);
            this.lineCache.set(uri, cache);
        }

        // 1. Identify Ignored Lines
        let ignoredLines = this.ignoredLinesCache.get(uri);
        if (!ignoredLines) {
            ignoredLines = await IgnoredLineDetector.identifyIgnoredLines(
                doc,
                config.compiledPatterns,
                token,
            );
            if (token.isCancellationRequested) return null;
            this.ignoredLinesCache.set(uri, ignoredLines);
        }

        // 2. Define Line Analysis Provider (Closure for cache access)
        const analyzeLine = (line: number): LineAnalysis => {
            return this.getOrAnalyzeLine(doc, line, tabSize, skipErrors, ignoredLines!.has(line));
        };

        // 3. Determine Active Scope
        const activeLineNum = config.activeIndentBrightness > 0 ? editor.selection.active.line : -1;
        const activeChar =
            config.activeIndentBrightness > 0 ? editor.selection.active.character : 0;

        const scope = ScopeFinder.findScope(
            doc,
            activeLineNum,
            activeChar,
            lineCount,
            ignoredLines,
            analyzeLine,
        );

        // 4. Generate Decorations
        const decorationSuite = this.decorationManager.getOrCreateSuite(
            config,
            vscode.window.activeColorTheme.kind,
        );
        const decoratorCount = decorationSuite?.getDecoratorCount() ?? 0;

        return DecorationGenerator.generate(
            doc,
            visibleRanges,
            decoratorCount,
            scope,
            analyzeLine,
            token,
        );
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

    private applyDecorations(editor: vscode.TextEditor, result: DecorationResult): void {
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
}
