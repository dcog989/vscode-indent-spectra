import * as vscode from 'vscode';
import type { IndentSpectraConfig } from './ConfigurationManager';
import { ConfigurationManager } from './ConfigurationManager';

const CHUNK_SIZE_LINES = 1000;
const VISIBLE_LINE_BUFFER = 50;
const MASSIVE_FILE_THRESHOLD = 50000;

interface IndentationAnalysisResult {
    spectra: vscode.Range[][];
    activeLevelSpectra: vscode.Range[][];
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
    private activeLevelDecorators: vscode.TextEditorDecorationType[] = [];
    private errorDecorator?: vscode.TextEditorDecorationType;
    private mixDecorator?: vscode.TextEditorDecorationType;

    private configManager: ConfigurationManager;
    private timeout: NodeJS.Timeout | null = null;
    private isDisposed = false;
    private decoratorCacheKey: string | null = null;
    private lineCache = new Map<string, (LineAnalysis | undefined)[]>();
    private ignoredLinesCache = new Map<string, Set<number>>();
    private lastTabSize = new Map<string, number>();
    private lastAppliedState = new Map<string, string>();
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
        this.lastAppliedState.clear();
        this.triggerUpdate(undefined, true);
    }

    private computeDecoratorCacheKey(config: IndentSpectraConfig): string {
        return JSON.stringify({
            colors: config.colors,
            errorColor: config.errorColor,
            mixColor: config.mixColor,
            style: config.indicatorStyle,
            width: config.lightIndicatorWidth,
            activeIndentBrightness: config.activeIndentBrightness,
        });
    }

    private brightenColor(color: string, brightness: number): string {
        if (brightness === 0) return color;

        let r = 0,
            g = 0,
            b = 0,
            a = 1;
        let matched = false;

        const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);
        if (rgbaMatch) {
            r = parseInt(rgbaMatch[1], 10);
            g = parseInt(rgbaMatch[2], 10);
            b = parseInt(rgbaMatch[3], 10);
            a = rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1;
            matched = true;
        } else if (color.startsWith('#')) {
            let hex = color.slice(1);
            if (hex.length === 3 || hex.length === 4) {
                hex = hex
                    .split('')
                    .map((c) => c + c)
                    .join('');
            }
            if (hex.length === 6 || hex.length === 8) {
                r = parseInt(hex.slice(0, 2), 16);
                g = parseInt(hex.slice(2, 4), 16);
                b = parseInt(hex.slice(4, 6), 16);
                a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
                matched = true;
            }
        }

        if (!matched) return color;

        const isLightTheme = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Light;
        const factor = brightness / 10;

        if (isLightTheme) {
            r = Math.round(Math.max(0, r - (r * factor * 0.4)));
            g = Math.round(Math.max(0, g - (g * factor * 0.4)));
            b = Math.round(Math.max(0, b - (b * factor * 0.4)));
        } else {
            r = Math.round(Math.min(255, r + ((255 - r) * factor * 0.4)));
            g = Math.round(Math.min(255, g + ((255 - g) * factor * 0.4)));
            b = Math.round(Math.min(255, b + ((255 - b) * factor * 0.4)));
        }

        a = Math.min(1, a + factor * 0.3);

        return `rgba(${r}, ${g}, ${b}, ${a})`;
    }

    private initializeDecorators(): void {
        if (this.isDisposed) return;
        const config = this.configManager.current;

        const options = (color: string, isActive: boolean): vscode.DecorationRenderOptions => {
            if (config.indicatorStyle === 'light') {
                const width =
                    isActive && config.activeIndentBrightness > 0
                        ? config.lightIndicatorWidth + 1
                        : config.lightIndicatorWidth;
                return {
                    borderWidth: `0 0 0 ${width}px`,
                    borderStyle: 'solid',
                    borderColor: color,
                };
            }
            return { backgroundColor: color };
        };

        this.decorators = config.colors.map((color) =>
            vscode.window.createTextEditorDecorationType(options(color, false)),
        );

        if (config.activeIndentBrightness > 0) {
            this.activeLevelDecorators = config.colors.map((color) => {
                const brightColor = this.brightenColor(color, config.activeIndentBrightness);
                return vscode.window.createTextEditorDecorationType(options(brightColor, true));
            });
        }

        if (config.errorColor) {
            this.errorDecorator = vscode.window.createTextEditorDecorationType({
                backgroundColor: config.errorColor,
            });
        }
        if (config.mixColor) {
            this.mixDecorator = vscode.window.createTextEditorDecorationType({
                backgroundColor: config.mixColor,
            });
        }
    }

    public reloadConfig(): void {
        this.configManager.load();
    }

    public clearCache(uri: vscode.Uri): void {
        const uriString = uri.toString();
        this.lineCache.delete(uriString);
        this.ignoredLinesCache.delete(uriString);
        this.lastTabSize.delete(uriString);
        this.lastAppliedState.delete(uriString);
    }

    public clearAppliedState(uri: vscode.Uri): void {
        this.lastAppliedState.delete(uri.toString());
    }

    public dispose(): void {
        this.isDisposed = true;
        this.disposeDecorators();
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

    private disposeDecorators(): void {
        this.decorators.forEach((d) => d.dispose());
        this.decorators = [];
        this.activeLevelDecorators.forEach((d) => d.dispose());
        this.activeLevelDecorators = [];
        this.errorDecorator?.dispose();
        this.errorDecorator = undefined;
        this.mixDecorator?.dispose();
        this.mixDecorator = undefined;
    }

    public triggerUpdate(event?: vscode.TextDocumentChangeEvent, immediate = false): void {
        if (this.isDisposed) return;
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }

        if (event) {
            this.applyIncrementalChangeToCache(event);
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

    private applyIncrementalChangeToCache(event: vscode.TextDocumentChangeEvent): void {
        const uri = event.document.uri.toString();
        this.ignoredLinesCache.delete(uri);
        this.lastAppliedState.delete(uri);

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
        const tabSize = this.resolveTabSize(editor);
        const ranges = editor.visibleRanges.length > 0 ? editor.visibleRanges : [];

        const activeLine = config.activeIndentBrightness > 0 ? editor.selection.active.line : -1;
        const activeChar =
            config.activeIndentBrightness > 0 ? editor.selection.active.character : -1;

        const stateKey = `${doc.version}-${tabSize}-${activeLine}-${activeChar}-${JSON.stringify(ranges)}`;
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
                for (let i = 0; i < activeLineData.blocks.length; i++) {
                    if (cursorChar <= activeLineData.blocks[i]) {
                        highlightLevel = i;
                        break;
                    }
                }

                if (highlightLevel === -1) {
                    highlightLevel = activeLineData.blocks.length - 1;
                }
            }

            if (highlightLevel !== -1) {
                const minIndentLevel = highlightLevel + 1;
                blockStart = activeLineNum;
                blockEnd = activeLineNum;

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

                    if (!isEmpty && data.blocks.length < minIndentLevel) break;
                    blockStart = i;
                }

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

                    if (!isEmpty && data.blocks.length < minIndentLevel) break;
                    blockEnd = i;
                }
            }
        }

        const spectra: vscode.Range[][] = Array.from({ length: this.decorators.length }, () => []);
        const activeLevelSpectra: vscode.Range[][] = Array.from(
            { length: this.decorators.length },
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
            if (idx % CHUNK_SIZE_LINES === 0 && performance.now() - lastYieldTime > 10) {
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
                const decoratorIndex = j % this.decorators.length;

                if (inActiveBlock && j === highlightLevel && j < lineData.blocks.length) {
                    activeLevelSpectra[decoratorIndex].push(range);
                } else {
                    spectra[decoratorIndex].push(range);
                }
            }

            if (lineData.isError && this.errorDecorator)
                errors.push(
                    new vscode.Range(i, 0, i, lineData.blocks[lineData.blocks.length - 1] ?? 0),
                );
            if (lineData.isMixed && this.mixDecorator)
                mixed.push(
                    new vscode.Range(i, 0, i, lineData.blocks[lineData.blocks.length - 1] ?? 0),
                );
        }

        return { spectra, activeLevelSpectra, errors, mixed };
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
            : this.analyzeLine(doc.lineAt(line).text, tabSize, skipErrors, isIgnored);

        if (cache) cache[line] = data;
        return data;
    }

    private isEmptyOrIgnored(text: string, isIgnored: boolean): boolean {
        return isIgnored || text.trim().length === 0;
    }

    private analyzeLine(
        text: string,
        tabSize: number,
        skipErrors: boolean,
        isIgnored: boolean,
    ): LineAnalysis {
        const blocks: number[] = [];
        let visualWidth = 0,
            isMixed = false,
            isError = false;
        const indentMatch = text.match(/^[\t ]+/);
        if (indentMatch) {
            const matchText = indentMatch[0];
            isMixed = matchText.includes('\t') && matchText.includes(' ');
            for (let i = 0; i < matchText.length; i++) {
                visualWidth += matchText[i] === '\t' ? tabSize - (visualWidth % tabSize) : 1;
                if (visualWidth % tabSize === 0) blocks.push(i + 1);
            }
            if (visualWidth % tabSize !== 0) {
                blocks.push(matchText.length);
                isError = !skipErrors;
            }
        }
        return { blocks, visualWidth, isMixed, isError, isIgnored };
    }

    private applyDecorations(editor: vscode.TextEditor, result: IndentationAnalysisResult): void {
        if (this.isDisposed) return;
        this.decorators.forEach((dec, i) => editor.setDecorations(dec, result.spectra[i]));
        if (this.configManager.current.activeIndentBrightness > 0) {
            this.activeLevelDecorators.forEach((dec, i) =>
                editor.setDecorations(dec, result.activeLevelSpectra[i]),
            );
        }
        if (this.errorDecorator) editor.setDecorations(this.errorDecorator, result.errors);
        if (this.mixDecorator) editor.setDecorations(this.mixDecorator, result.mixed);
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
        const lineStarts: number[] = [0];
        for (let i = 0; i < text.length; i++) {
            if (text[i] === '\n') lineStarts.push(i + 1);
        }

        const getLineIndex = (offset: number): number => {
            let low = 0,
                high = lineStarts.length - 1;
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
                if (++matchCount % 100 === 0 && performance.now() - lastYieldTime > 10) {
                    await new Promise((resolve) => setTimeout(resolve, 0));
                    if (token.isCancellationRequested) return ignoredLines;
                    lastYieldTime = performance.now();
                }
                const startLine = getLineIndex(match.index);
                const endLine = getLineIndex(match.index + (match[0]?.length ?? 0));
                for (let i = startLine; i <= endLine; i++) ignoredLines.add(i);
                if (match[0]?.length === 0) regex.lastIndex++;
            }
        }
        return ignoredLines;
    }
}
