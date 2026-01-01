import * as vscode from 'vscode';
import { CSS_NAMED_COLORS, PaletteKey, PALETTES } from './colors';

const DEFAULT_TAB_SIZE = 4;
const MAX_IGNORED_LINE_SPAN = 2000;

// Pre-compiled Regex Constants for Performance
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

    constructor() {
        this.config = loadConfigurationFromVSCode();
        this.reloadConfig();
    }

    public reloadConfig(): void {
        if (this.isDisposed) return;

        const newConfig = loadConfigurationFromVSCode();
        this.config = newConfig;

        this.compileIgnorePatterns(newConfig.ignorePatterns);

        const newCacheKey = this.computeDecoratorCacheKey(newConfig);
        if (newCacheKey !== this.decoratorCacheKey) {
            this.disposeDecorators();
            this.initializeDecorators(newConfig);
            this.decoratorCacheKey = newCacheKey;
        }

        this.triggerUpdate();
    }

    private computeDecoratorCacheKey(config: IndentSpectraConfig): string {
        const colors = this.resolveColorPalette(config);
        return JSON.stringify({
            preset: config.colorPreset,
            colors: colors,
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

    private createDecoratorOptions(
        color: string,
        style: 'classic' | 'light',
        width: number
    ): vscode.DecorationRenderOptions {
        if (style === 'light') {
            return {
                borderWidth: `0 0 0 ${width}px`,
                borderStyle: 'solid',
                borderColor: color
            };
        }
        return {
            backgroundColor: color
        };
    }

    private initializeDecorators(config: IndentSpectraConfig): void {
        if (this.isDisposed) return;

        const colors = this.resolveColorPalette(config);

        this.decorators = colors.map(color =>
            vscode.window.createTextEditorDecorationType(
                this.createDecoratorOptions(color, config.indicatorStyle, config.lightIndicatorWidth)
            )
        );

        if (config.errorColor && isValidColor(config.errorColor)) {
            this.errorDecorator = vscode.window.createTextEditorDecorationType({
                backgroundColor: config.errorColor
            });
        }

        if (config.mixColor && isValidColor(config.mixColor)) {
            this.mixDecorator = vscode.window.createTextEditorDecorationType({
                backgroundColor: config.mixColor
            });
        }
    }

    private resolveColorPalette(config: IndentSpectraConfig): string[] {
        if (config.colorPreset === 'custom') {
            const validColors = config.colors.filter(color => {
                const isValid = isValidColor(color);
                if (!isValid) {
                    console.warn(`[IndentSpectra] Invalid color format: ${color}`);
                }
                return isValid;
            });
            return validColors.length > 0 ? validColors : PALETTES.universal;
        }

        return PALETTES[config.colorPreset] || PALETTES.universal;
    }

    public dispose(): void {
        this.isDisposed = true;
        this.disposeDecorators();
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
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

    public triggerUpdate(): void {
        if (this.isDisposed) return;

        if (this.timeout) {
            clearTimeout(this.timeout);
        }
        this.timeout = setTimeout(() => this.updateAll(), this.config.updateDelay);
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

        const tabSize = this.getTabSize(editor);
        const skipErrors = this.config.ignoreErrorLanguages.has(doc.languageId);

        const analysisResult = this.analyzeIndentation(doc, tabSize, skipErrors);
        this.applyDecorations(editor, analysisResult);
    }

    private analyzeIndentation(
        doc: vscode.TextDocument,
        tabSize: number,
        skipErrors: boolean
    ): IndentationAnalysisResult {
        const spectra: vscode.Range[][] = Array.from(
            { length: this.decorators.length },
            () => []
        );
        const errors: vscode.Range[] = [];
        const mixed: vscode.Range[] = [];

        const ignoredLines = this.identifyIgnoredLines(doc);
        const lineCount = doc.lineCount;

        for (let i = 0; i < lineCount; i++) {
            if (ignoredLines.has(i)) continue;

            const line = doc.lineAt(i);
            const lineText = line.text;

            if (lineText.length === 0) continue;

            const firstCharCode = lineText.charCodeAt(0);
            if (firstCharCode !== 32 && firstCharCode !== 9) {
                continue;
            }

            const indentMatch = lineText.match(/^[\t ]+/);
            if (!indentMatch) continue;

            const matchText = indentMatch[0];

            if (this.mixDecorator && matchText.includes('\t') && matchText.includes(' ')) {
                mixed.push(new vscode.Range(i, 0, i, matchText.length));
            }

            const visualWidth = this.processLineIndentation(
                matchText,
                i,
                tabSize,
                spectra
            );

            if (!skipErrors && visualWidth % tabSize !== 0 && this.errorDecorator) {
                errors.push(new vscode.Range(i, 0, i, matchText.length));
            }
        }

        return { spectra, errors, mixed };
    }

    private processLineIndentation(
        text: string,
        line: number,
        tabSize: number,
        spectra: vscode.Range[][]
    ): number {
        let visualWidth = 0;
        let currentBlockStart = 0;
        let blockIndex = 0;
        const numDecorators = spectra.length;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const charVisualWidth = char === '\t'
                ? tabSize - (visualWidth % tabSize)
                : 1;

            visualWidth += charVisualWidth;

            if (visualWidth % tabSize === 0) {
                const blockEnd = i + 1;
                spectra[blockIndex % numDecorators].push(
                    new vscode.Range(line, currentBlockStart, line, blockEnd)
                );
                blockIndex++;
                currentBlockStart = blockEnd;
            }
        }

        if (currentBlockStart < text.length) {
            spectra[blockIndex % numDecorators].push(
                new vscode.Range(line, currentBlockStart, line, text.length)
            );
        }

        return visualWidth;
    }

    private applyDecorations(
        editor: vscode.TextEditor,
        result: IndentationAnalysisResult
    ): void {
        if (this.isDisposed) return;

        this.decorators.forEach((dec, i) => editor.setDecorations(dec, result.spectra[i]));

        if (this.errorDecorator) {
            editor.setDecorations(this.errorDecorator, result.errors);
        }
        if (this.mixDecorator) {
            editor.setDecorations(this.mixDecorator, result.mixed);
        }
    }

    private getTabSize(editor: vscode.TextEditor): number {
        return this.resolveTabSize(editor);
    }

    private resolveTabSize(editor: vscode.TextEditor): number {
        const tabSizeOption = editor.options.tabSize;

        if (typeof tabSizeOption === 'number' && tabSizeOption > 0) {
            return tabSizeOption;
        }

        if (typeof tabSizeOption === 'string') {
            const parsed = parseInt(tabSizeOption, 10);
            if (!isNaN(parsed) && parsed > 0) {
                return parsed;
            }
        }

        const globalTabSize = vscode.workspace.getConfiguration('editor').get<number>('tabSize');
        if (typeof globalTabSize === 'number' && globalTabSize > 0) {
            return globalTabSize;
        }

        return DEFAULT_TAB_SIZE;
    }

    private identifyIgnoredLines(doc: vscode.TextDocument): Set<number> {
        const ignoredLines = new Set<number>();

        if (this.compiledIgnorePatterns.length === 0) {
            return ignoredLines;
        }

        const text = doc.getText();
        const lineStarts: number[] = [0];

        for (let i = 0; i < text.length; i++) {
            if (text[i] === '\n') {
                lineStarts.push(i + 1);
            }
        }

        const getLineIndex = (offset: number): number => {
            let low = 0;
            let high = lineStarts.length - 1;
            while (low <= high) {
                const mid = (low + high) >> 1;
                if (lineStarts[mid] <= offset) {
                    low = mid + 1;
                } else {
                    high = mid - 1;
                }
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
                    for (let i = startLine; i <= endLine; i++) {
                        ignoredLines.add(i);
                    }
                }

                if (match[0].length === 0) {
                    regex.lastIndex++;
                }
            }
        }

        return ignoredLines;
    }

    private calculateSpectraBlocks(
        text: string,
        line: number,
        tabSize: number
    ): { visualWidth: number; blockRanges: vscode.Range[] } {
        const blockRanges: vscode.Range[] = [];
        let visualWidth = 0;
        let currentBlockStartCharIndex = 0;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const isTab = char === '\t';

            const charVisualWidth = isTab
                ? tabSize - (visualWidth % tabSize)
                : 1;

            visualWidth += charVisualWidth;

            if (visualWidth % tabSize === 0) {
                const blockEndCharIndex = i + 1;

                blockRanges.push(new vscode.Range(
                    line,
                    currentBlockStartCharIndex,
                    line,
                    blockEndCharIndex
                ));
                currentBlockStartCharIndex = blockEndCharIndex;
            }
        }

        if (currentBlockStartCharIndex < text.length) {
            blockRanges.push(new vscode.Range(
                line,
                currentBlockStartCharIndex,
                line,
                text.length
            ));
        }

        return { visualWidth, blockRanges };
    }
}
