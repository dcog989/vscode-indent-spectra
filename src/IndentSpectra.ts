import * as vscode from 'vscode';
import { CSS_NAMED_COLORS, PaletteKey, PALETTES } from './colors';

// Constants
const DEFAULT_TAB_SIZE = 4;
const MAX_IGNORED_LINE_SPAN = 2000;

// Pre-compiled Regex Constants for Performance
const HEX_COLOR_REGEX = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGBA_COLOR_REGEX = /^rgba?\(\s*\d{1,3}%?\s*,\s*\d{1,3}%?\s*,\s*\d{1,3}%?\s*(?:,\s*(?:0|1|0?\.\d+|\d{1,3}%?)\s*)?\)$/i;

// Type-Safe Configuration
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

// Analysis Result Type
interface IndentationAnalysisResult {
    spectra: vscode.Range[][];
    errors: vscode.Range[];
    mixed: vscode.Range[];
}

// Color Validation Helper
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

    // Configuration State
    private config: IndentSpectraConfig;

    // Cache for ignore patterns (compiled once)
    private compiledIgnorePatterns: RegExp[] = [];

    private timeout: NodeJS.Timeout | null = null;
    private isDisposed = false;

    // Cache keys to detect when decorators need recreation
    private decoratorCacheKey: string | null = null;

    constructor() {
        this.config = loadConfigurationFromVSCode();
        this.reloadConfig();
    }

    public reloadConfig(): void {
        if (this.isDisposed) return;

        const newConfig = loadConfigurationFromVSCode();
        this.config = newConfig;

        // Recompile patterns if they changed
        this.compileIgnorePatterns(newConfig.ignorePatterns);

        // Only recreate decorators if visual settings changed
        const newCacheKey = this.computeDecoratorCacheKey(newConfig);
        if (newCacheKey !== this.decoratorCacheKey) {
            this.disposeDecorators();
            this.initializeDecorators(newConfig);
            this.decoratorCacheKey = newCacheKey;
        }

        this.triggerUpdate();
    }

    private computeDecoratorCacheKey(config: IndentSpectraConfig): string {
        // Create a unique key based on appearance settings
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
        this.compiledIgnorePatterns = [];

        if (patternStrings.length === 0) {
            return;
        }

        this.compiledIgnorePatterns = patternStrings
            .map(pattern => {
                try {
                    let source = pattern;
                    let flags = 'g'; // Default to global for loop reuse

                    // Try to parse as /pattern/flags format
                    const match = pattern.match(/^\/(.+)\/([gimsuy]*)$/);
                    if (match) {
                        source = match[1];
                        flags = match[2];
                        if (!flags.includes('g')) {
                            flags += 'g';
                        }
                        // Ensure multiline flag is present if start anchor is used
                        // This prevents ^ from matching only start of string in single-line mode
                        if (source.includes('^') && !flags.includes('m')) {
                            flags += 'm';
                        }
                    }

                    return new RegExp(source, flags);
                } catch (e) {
                    console.warn(`[IndentSpectra] Invalid regex pattern: ${pattern}`, e);
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

        // Process all visible editors (handles split view)
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

        // Performance Optimization: Iterate lines directly instead of Regex on full text
        const lineCount = doc.lineCount;

        for (let i = 0; i < lineCount; i++) {
            if (ignoredLines.has(i)) continue;

            const line = doc.lineAt(i);
            const lineText = line.text;

            // Fast path for empty/short lines
            if (lineText.length === 0) continue;

            // Check if line starts with whitespace
            const firstChar = lineText.charCodeAt(0);
            if (firstChar !== 32 /* space */ && firstChar !== 9 /* tab */) {
                continue;
            }

            const indentMatch = lineText.match(/^[\t ]+/);
            if (!indentMatch) continue;

            const matchText = indentMatch[0];

            // Check for mixed indentation
            const hasTabs = matchText.includes('\t');
            const hasSpaces = matchText.includes(' ');

            if (hasTabs && hasSpaces && this.mixDecorator) {
                mixed.push(new vscode.Range(i, 0, i, matchText.length));
            }

            const { visualWidth, blockRanges } = this.calculateSpectraBlocks(
                matchText,
                i, // Line number known from loop
                tabSize
            );

            // Distribute blocks across decorators
            for (let j = 0; j < blockRanges.length; j++) {
                const colorIndex = j % this.decorators.length;
                spectra[colorIndex].push(blockRanges[j]);
            }

            // Mark indentation errors
            if (!skipErrors && visualWidth % tabSize !== 0 && this.errorDecorator) {
                errors.push(new vscode.Range(i, 0, i, matchText.length));
            }
        }

        return { spectra, errors, mixed };
    }

    private applyDecorations(
        editor: vscode.TextEditor,
        result: IndentationAnalysisResult
    ): void {
        if (this.isDisposed) return;

        // Apply decorations
        this.decorators.forEach((dec, i) => editor.setDecorations(dec, result.spectra[i]));

        // Apply error and mixed decorations if they exist
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

        // We still scan full text for multi-line block comments which are hard to detect line-by-line
        const text = doc.getText();

        for (const regex of this.compiledIgnorePatterns) {
            regex.lastIndex = 0;
            let match: RegExpExecArray | null;

            while ((match = regex.exec(text)) !== null) {
                const startLine = doc.positionAt(match.index).line;
                const endLine = doc.positionAt(match.index + match[0].length).line;

                if (endLine - startLine > MAX_IGNORED_LINE_SPAN) {
                    continue;
                }

                for (let i = startLine; i <= endLine; i++) {
                    ignoredLines.add(i);
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

            // Calculate visual width for this character
            const charVisualWidth = isTab
                ? tabSize - (visualWidth % tabSize)
                : 1;

            visualWidth += charVisualWidth;

            // Complete a block when we reach a multiple of tabSize
            if (visualWidth % tabSize === 0) {
                const blockEndCharIndex = i + 1;

                blockRanges.push(new vscode.Range(
                    line,
                    currentBlockStartCharIndex, // Start relative to line start (0)
                    line,
                    blockEndCharIndex
                ));
                currentBlockStartCharIndex = blockEndCharIndex;
            }
        }

        // Handle incomplete final block (remainder)
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
