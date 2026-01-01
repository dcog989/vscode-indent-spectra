import * as vscode from 'vscode';
import { ConfigurationManager, IndentSpectraConfig } from './ConfigurationManager';

const CHUNK_SIZE_LINES = 1000;
const VISIBLE_LINE_BUFFER = 50;

interface IndentationAnalysisResult {
    spectra: vscode.Range[][];
    errors: vscode.Range[];
    mixed: vscode.Range[];
}

interface LineAnalysis {
    blocks: number[];
    visualWidth: number;
    isMixed: boolean;
    isError: boolean;
    isIgnored: boolean;
}

export class IndentSpectra implements vscode.Disposable {
    private decorators: vscode.TextEditorDecorationType[] = [];
    private errorDecorator?: vscode.TextEditorDecorationType;
    private mixDecorator?: vscode.TextEditorDecorationType;

    private configManager: ConfigurationManager;
    private timeout: NodeJS.Timeout | null = null;
    private isDisposed = false;
    private decoratorCacheKey: string | null = null;
    private lineCache = new Map<string, (LineAnalysis | undefined)[]>();
    private ignoredLinesCache = new Map<string, Set<number>>();
    private cancellationSource?: vscode.CancellationTokenSource;

    constructor() {
        this.configManager = new ConfigurationManager();
        this.configManager.onDidChangeConfig(() => this.handleConfigChange());
        this.initializeDecorators();
    }

    private handleConfigChange(): void {
        if (this.isDisposed) return;

        const config = this.configManager.current;
        const newCacheKey = this.computeDecoratorCacheKey(config);

        if (newCacheKey !== this.decoratorCacheKey) {
            this.disposeDecorators();
            this.initializeDecorators();
            this.decoratorCacheKey = newCacheKey;
        }

        this.lineCache.clear();
        this.ignoredLinesCache.clear();
        this.triggerUpdate();
    }

    private computeDecoratorCacheKey(config: IndentSpectraConfig): string {
        return JSON.stringify({
            colors: config.colors,
            errorColor: config.errorColor,
            mixColor: config.mixColor,
            style: config.indicatorStyle,
            width: config.lightIndicatorWidth
        });
    }

    private initializeDecorators(): void {
        if (this.isDisposed) return;
        const config = this.configManager.current;

        const options = (color: string): vscode.DecorationRenderOptions =>
            config.indicatorStyle === 'light'
                ? { borderWidth: `0 0 0 ${config.lightIndicatorWidth}px`, borderStyle: 'solid', borderColor: color }
                : { backgroundColor: color };

        this.decorators = config.colors.map(color => vscode.window.createTextEditorDecorationType(options(color)));

        if (config.errorColor) {
            this.errorDecorator = vscode.window.createTextEditorDecorationType({ backgroundColor: config.errorColor });
        }
        if (config.mixColor) {
            this.mixDecorator = vscode.window.createTextEditorDecorationType({ backgroundColor: config.mixColor });
        }
    }

    public reloadConfig(): void {
        this.configManager.load();
    }

    public dispose(): void {
        this.isDisposed = true;
        this.disposeDecorators();
        this.cancelCurrentWork();
        this.configManager.dispose();
        if (this.timeout) clearTimeout(this.timeout);
        this.lineCache.clear();
        this.ignoredLinesCache.clear();
    }

    private cancelCurrentWork(): void {
        if (this.cancellationSource) {
            this.cancellationSource.cancel();
            this.cancellationSource.dispose();
            this.cancellationSource = undefined;
        }
    }

    private disposeDecorators(): void {
        this.decorators.forEach(d => d.dispose());
        this.decorators = [];
        this.errorDecorator?.dispose();
        this.errorDecorator = undefined;
        this.mixDecorator?.dispose();
        this.mixDecorator = undefined;
    }

    public triggerUpdate(event?: vscode.TextDocumentChangeEvent): void {
        if (this.isDisposed) return;
        if (this.timeout) clearTimeout(this.timeout);

        if (event) {
            this.applyIncrementalChangeToCache(event);
        }

        this.timeout = setTimeout(async () => {
            this.cancelCurrentWork();
            this.cancellationSource = new vscode.CancellationTokenSource();
            await this.updateAll(this.cancellationSource.token);
        }, this.configManager.current.updateDelay);
    }

    private applyIncrementalChangeToCache(event: vscode.TextDocumentChangeEvent): void {
        const uri = event.document.uri.toString();
        this.ignoredLinesCache.delete(uri);

        const cache = this.lineCache.get(uri);
        if (!cache) return;

        const sortedChanges = [...event.contentChanges].sort((a, b) =>
            b.range.start.line - a.range.start.line
        );

        for (const change of sortedChanges) {
            const startLine = change.range.start.line;
            const endLine = change.range.end.line;
            const linesAdded = (change.text.match(/\n/g) || []).length;
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

    private async processEditor(editor: vscode.TextEditor, token: vscode.CancellationToken): Promise<void> {
        const doc = editor.document;
        const config = this.configManager.current;
        if (config.ignoredLanguages.has(doc.languageId)) return;

        const tabSize = this.resolveTabSize(editor);
        const skipErrors = config.ignoreErrorLanguages.has(doc.languageId);

        const result = await this.analyzeIndentation(doc, tabSize, skipErrors, editor.visibleRanges, token);
        if (result && !token.isCancellationRequested) {
            this.applyDecorations(editor, result);
        }
    }

    private async analyzeIndentation(
        doc: vscode.TextDocument,
        tabSize: number,
        skipErrors: boolean,
        visibleRanges: readonly vscode.Range[],
        token: vscode.CancellationToken
    ): Promise<IndentationAnalysisResult | null> {
        const uri = doc.uri.toString();
        const lineCount = doc.lineCount;
        let cache = this.lineCache.get(uri);

        if (!cache || cache.length !== lineCount) {
            cache = new Array(lineCount).fill(undefined);
            this.lineCache.set(uri, cache);
        }

        let ignoredLines = this.ignoredLinesCache.get(uri);
        if (!ignoredLines) {
            ignoredLines = await this.identifyIgnoredLines(doc, token);
            if (token.isCancellationRequested) return null;
            this.ignoredLinesCache.set(uri, ignoredLines);
        }

        const spectra: vscode.Range[][] = Array.from({ length: this.decorators.length }, () => []);
        const errors: vscode.Range[] = [];
        const mixed: vscode.Range[] = [];

        const linesToProcess = new Set<number>();
        for (const range of visibleRanges) {
            const start = Math.max(0, range.start.line - VISIBLE_LINE_BUFFER);
            const end = Math.min(lineCount - 1, range.end.line + VISIBLE_LINE_BUFFER);
            for (let i = start; i <= end; i++) {
                linesToProcess.add(i);
            }
        }

        const sortedLines = Array.from(linesToProcess).sort((a, b) => a - b);
        let lastYieldTime = performance.now();

        for (let idx = 0; idx < sortedLines.length; idx++) {
            const i = sortedLines[idx];

            if (idx % CHUNK_SIZE_LINES === 0 && (performance.now() - lastYieldTime) > 10) {
                await new Promise(resolve => setTimeout(resolve, 0));
                if (token.isCancellationRequested) return null;
                lastYieldTime = performance.now();
            }

            const isIgnored = ignoredLines.has(i);
            let lineData = cache[i];

            if (!lineData || lineData.isIgnored !== isIgnored) {
                if (isIgnored) {
                    lineData = { blocks: [], visualWidth: 0, isMixed: false, isError: false, isIgnored: true };
                } else {
                    lineData = this.analyzeLine(doc.lineAt(i).text, tabSize, skipErrors, isIgnored);
                }
                cache[i] = lineData;
            }

            if (lineData.isIgnored) continue;

            for (let j = 0; j < lineData.blocks.length; j++) {
                const start = j === 0 ? 0 : lineData.blocks[j - 1];
                spectra[j % this.decorators.length].push(new vscode.Range(i, start, i, lineData.blocks[j]));
            }

            if (lineData.isError && this.errorDecorator) {
                errors.push(new vscode.Range(i, 0, i, lineData.blocks[lineData.blocks.length - 1] || 0));
            }
            if (lineData.isMixed && this.mixDecorator) {
                mixed.push(new vscode.Range(i, 0, i, lineData.blocks[lineData.blocks.length - 1] || 0));
            }
        }

        return { spectra, errors, mixed };
    }

    private analyzeLine(text: string, tabSize: number, skipErrors: boolean, isIgnored: boolean): LineAnalysis {
        const blocks: number[] = [];
        let visualWidth = 0, isMixed = false, isError = false;

        const indentMatch = text.match(/^[\t ]+/);
        if (indentMatch) {
            const matchText = indentMatch[0];
            isMixed = matchText.includes('\t') && matchText.includes(' ');
            let currentStart = 0;
            for (let i = 0; i < matchText.length; i++) {
                visualWidth += (matchText[i] === '\t' ? tabSize - (visualWidth % tabSize) : 1);
                if (visualWidth % tabSize === 0) {
                    blocks.push(i + 1);
                    currentStart = i + 1;
                }
            }
            if (currentStart < matchText.length) blocks.push(matchText.length);
            isError = !skipErrors && visualWidth % tabSize !== 0;
        }
        return { blocks, visualWidth, isMixed, isError, isIgnored };
    }

    private applyDecorations(editor: vscode.TextEditor, result: IndentationAnalysisResult): void {
        if (this.isDisposed) return;
        this.decorators.forEach((dec, i) => editor.setDecorations(dec, result.spectra[i]));
        if (this.errorDecorator) editor.setDecorations(this.errorDecorator, result.errors);
        if (this.mixDecorator) editor.setDecorations(this.mixDecorator, result.mixed);
    }

    private resolveTabSize(editor: vscode.TextEditor): number {
        const size = editor.options.tabSize;
        if (typeof size === 'number') return size;
        if (typeof size === 'string') return parseInt(size, 10) || 4;
        return vscode.workspace.getConfiguration('editor').get<number>('tabSize') || 4;
    }

    private async identifyIgnoredLines(doc: vscode.TextDocument, token: vscode.CancellationToken): Promise<Set<number>> {
        const ignoredLines = new Set<number>();
        const patterns = this.configManager.current.compiledPatterns;
        if (patterns.length === 0) return ignoredLines;

        const text = doc.getText();
        const lineStarts: number[] = [0];
        for (let i = 0; i < text.length; i++) {
            if (text[i] === '\n') lineStarts.push(i + 1);
        }

        const getLineIndex = (offset: number): number => {
            let low = 0, high = lineStarts.length - 1;
            while (low <= high) {
                const mid = (low + high) >> 1;
                if (lineStarts[mid] <= offset) low = mid + 1;
                else high = mid - 1;
            }
            return high;
        };

        let lastYieldTime = performance.now();

        for (const regex of patterns) {
            regex.lastIndex = 0;
            let match: RegExpExecArray | null;
            let matchCount = 0;

            while ((match = regex.exec(text)) !== null) {
                if (++matchCount % 100 === 0 && (performance.now() - lastYieldTime) > 10) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                    if (token.isCancellationRequested) return ignoredLines;
                    lastYieldTime = performance.now();
                }

                const startLine = getLineIndex(match.index);
                const endLine = getLineIndex(match.index + match[0].length);

                for (let i = startLine; i <= endLine; i++) {
                    ignoredLines.add(i);
                }

                if (match[0].length === 0) regex.lastIndex++;
            }
        }
        return ignoredLines;
    }
}
