import * as vscode from 'vscode';
import { CSS_NAMED_COLORS, PaletteKey, PALETTES } from './colors';

const DEFAULT_TAB_SIZE = 4;
const MAX_IGNORED_LINE_SPAN = 2000;
const HEX_COLOR_REGEX = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGBA_COLOR_REGEX = /^rgba?\(\s*\d{1,3}%?\s*,\s*\d{1,3}%?\s*,\s*\d{1,3}%?\s*(?:,\s*(?:0|1|0?\.\d+|\d{1,3}%?)\s*)?\)$/i;

interface IndentSpectraConfig {
    updateDelay: number;
    colorPreset: PaletteKey | 'custom';
    colors: string[];
    errorColor: string;
    mixColor: string;
    ignorePatterns: string[];
    ignoredLanguages: Set<string>;
    ignoreErrorLanguages: Set<string>;
    indicatorStyle: 'classic' | 'light';
    lightIndicatorWidth: number;
}

interface IndentationAnalysisResult {
    spectra: vscode.Range[][];
    errors: vscode.Range[];
    mixed: vscode.Range[];
}

interface LineAnalysis {
    blocks: number[]; // End character indices of each indent block
    visualWidth: number;
    isMixed: boolean;
    isError: boolean;
    isIgnored: boolean;
}

function isValidColor(color: string): boolean {
    if (!color || typeof color !== 'string') return false;
    const trimmed = color.trim();
    return HEX_COLOR_REGEX.test(trimmed) || RGBA_COLOR_REGEX.test(trimmed) || CSS_NAMED_COLORS.has(trimmed.toLowerCase());
}

function loadConfigurationFromVSCode(): IndentSpectraConfig {
    const config = vscode.workspace.getConfiguration('indentSpectra');
    return {
        updateDelay: Math.max(10, config.get<number>('updateDelay', 100)),
        colorPreset: config.get<PaletteKey | 'custom'>('colorPreset', 'universal'),
        colors: config.get<string[]>('colors', []),
        errorColor: config.get<string>('errorColor', ''),
        mixColor: config.get<string>('mixColor', ''),
        ignorePatterns: config.get<string[]>('ignorePatterns', []),
        ignoredLanguages: new Set(config.get<string[]>('ignoredLanguages', [])),
        ignoreErrorLanguages: new Set(config.get<string[]>('ignoreErrorLanguages', [])),
        indicatorStyle: config.get<'classic' | 'light'>('indicatorStyle', 'classic'),
        lightIndicatorWidth: Math.max(1, config.get<number>('lightIndicatorWidth', 1))
    };
}

export class IndentSpectra implements vscode.Disposable {
    private decorators: vscode.TextEditorDecorationType[] = [];
    private errorDecorator?: vscode.TextEditorDecorationType;
    private mixDecorator?: vscode.TextEditorDecorationType;
    private config: IndentSpectraConfig;
    private compiledIgnorePatterns: RegExp[] = [];
    private timeout: NodeJS.Timeout | null = null;
    private isDisposed = false;
    private decoratorCacheKey: string | null = null;

    private lineCache = new Map<string, (LineAnalysis | undefined)[]>();

    constructor() {
        this.config = loadConfigurationFromVSCode();
        this.reloadConfig();
    }

    public reloadConfig(): void {
        if (this.isDisposed) return;
        this.config = loadConfigurationFromVSCode();
        this.compileIgnorePatterns(this.config.ignorePatterns);

        const newCacheKey = this.computeDecoratorCacheKey(this.config);
        if (newCacheKey !== this.decoratorCacheKey) {
            this.disposeDecorators();
            this.initializeDecorators(this.config);
            this.decoratorCacheKey = newCacheKey;
        }

        this.lineCache.clear();
        this.triggerUpdate();
    }

    private computeDecoratorCacheKey(config: IndentSpectraConfig): string {
        const colors = this.resolveColorPalette(config);
        return JSON.stringify({
            preset: config.colorPreset,
            colors,
            errorColor: config.errorColor,
            mixColor: config.mixColor,
            style: config.indicatorStyle,
            width: config.lightIndicatorWidth
        });
    }

    private compileIgnorePatterns(patternStrings: string[]): void {
        this.compiledIgnorePatterns = patternStrings
            .map(pattern => {
                try {
                    let source = pattern;
                    let existingFlags = '';
                    const match = pattern.match(/^\/(.+)\/([a-z]*)$/i);
                    if (match) {
                        source = match[1];
                        existingFlags = match[2];
                    }
                    const flags = new Set(existingFlags.toLowerCase().split(''));
                    flags.add('g');
                    flags.add('m');
                    return new RegExp(source, Array.from(flags).join(''));
                } catch (e) {
                    console.warn(`[IndentSpectra] Invalid pattern: ${pattern}`, e);
                    return null;
                }
            })
            .filter((r): r is RegExp => r !== null);
    }

    private initializeDecorators(config: IndentSpectraConfig): void {
        if (this.isDisposed) return;
        const colors = this.resolveColorPalette(config);
        const options = (color: string): vscode.DecorationRenderOptions =>
            config.indicatorStyle === 'light'
                ? { borderWidth: `0 0 0 ${config.lightIndicatorWidth}px`, borderStyle: 'solid', borderColor: color }
                : { backgroundColor: color };

        this.decorators = colors.map(color => vscode.window.createTextEditorDecorationType(options(color)));

        if (config.errorColor && isValidColor(config.errorColor)) {
            this.errorDecorator = vscode.window.createTextEditorDecorationType({ backgroundColor: config.errorColor });
        }
        if (config.mixColor && isValidColor(config.mixColor)) {
            this.mixDecorator = vscode.window.createTextEditorDecorationType({ backgroundColor: config.mixColor });
        }
    }

    private resolveColorPalette(config: IndentSpectraConfig): string[] {
        if (config.colorPreset === 'custom') {
            const validColors = config.colors.filter(isValidColor);
            return validColors.length > 0 ? validColors : PALETTES.universal;
        }
        return PALETTES[config.colorPreset] || PALETTES.universal;
    }

    public dispose(): void {
        this.isDisposed = true;
        this.disposeDecorators();
        if (this.timeout) clearTimeout(this.timeout);
        this.lineCache.clear();
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

        this.timeout = setTimeout(() => this.updateAll(), this.config.updateDelay);
    }

    private applyIncrementalChangeToCache(event: vscode.TextDocumentChangeEvent): void {
        const uri = event.document.uri.toString();
        const cache = this.lineCache.get(uri);
        if (!cache) return;

        for (const change of event.contentChanges) {
            const startLine = change.range.start.line;
            const endLine = change.range.end.line;
            const linesAdded = (change.text.match(/\n/g) || []).length;
            const linesRemoved = endLine - startLine;

            cache.splice(startLine, linesRemoved + 1, ...new Array(linesAdded + 1).fill(undefined));
        }
    }

    private updateAll(): void {
        if (this.isDisposed) return;
        for (const editor of vscode.window.visibleTextEditors) {
            this.processEditor(editor);
        }
    }

    private processEditor(editor: vscode.TextEditor): void {
        const doc = editor.document;
        if (this.config.ignoredLanguages.has(doc.languageId)) return;

        const tabSize = this.resolveTabSize(editor);
        const skipErrors = this.config.ignoreErrorLanguages.has(doc.languageId);

        const analysisResult = this.analyzeIndentation(doc, tabSize, skipErrors);
        this.applyDecorations(editor, analysisResult);
    }

    private analyzeIndentation(
        doc: vscode.TextDocument,
        tabSize: number,
        skipErrors: boolean
    ): IndentationAnalysisResult {
        const uri = doc.uri.toString();
        let cache = this.lineCache.get(uri);
        const lineCount = doc.lineCount;

        if (!cache || cache.length !== lineCount) {
            cache = new Array(lineCount).fill(undefined);
            this.lineCache.set(uri, cache);
        }

        const spectra: vscode.Range[][] = Array.from({ length: this.decorators.length }, () => []);
        const errors: vscode.Range[] = [];
        const mixed: vscode.Range[] = [];

        const ignoredLines = this.identifyIgnoredLines(doc);

        for (let i = 0; i < lineCount; i++) {
            const isIgnored = ignoredLines.has(i);
            let lineData = cache[i];

            if (!lineData || lineData.isIgnored !== isIgnored) {
                if (isIgnored) {
                    lineData = { blocks: [], visualWidth: 0, isMixed: false, isError: false, isIgnored: true };
                } else {
                    const lineText = doc.lineAt(i).text;
                    lineData = this.analyzeLine(lineText, tabSize, skipErrors, isIgnored);
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
        let visualWidth = 0;
        let isMixed = false;
        let isError = false;

        const indentMatch = text.match(/^[\t ]+/);
        if (indentMatch) {
            const matchText = indentMatch[0];
            isMixed = matchText.includes('\t') && matchText.includes(' ');

            let currentBlockStart = 0;
            for (let i = 0; i < matchText.length; i++) {
                const char = matchText[i];
                visualWidth += (char === '\t' ? tabSize - (visualWidth % tabSize) : 1);

                if (visualWidth % tabSize === 0) {
                    blocks.push(i + 1);
                    currentBlockStart = i + 1;
                }
            }
            if (currentBlockStart < matchText.length) {
                blocks.push(matchText.length);
            }
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
        if (typeof size === 'string') return parseInt(size, 10) || DEFAULT_TAB_SIZE;
        return vscode.workspace.getConfiguration('editor').get<number>('tabSize') || DEFAULT_TAB_SIZE;
    }

    private identifyIgnoredLines(doc: vscode.TextDocument): Set<number> {
        const ignoredLines = new Set<number>();
        if (this.compiledIgnorePatterns.length === 0) return ignoredLines;

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

        for (const regex of this.compiledIgnorePatterns) {
            regex.lastIndex = 0;
            let match: RegExpExecArray | null;
            while ((match = regex.exec(text)) !== null) {
                const startLine = getLineIndex(match.index);
                const endLine = getLineIndex(match.index + match[0].length);
                if (endLine - startLine <= MAX_IGNORED_LINE_SPAN) {
                    for (let i = startLine; i <= endLine; i++) ignoredLines.add(i);
                }
                if (match[0].length === 0) regex.lastIndex++;
            }
        }
        return ignoredLines;
    }
}
