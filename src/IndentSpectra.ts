import * as vscode from 'vscode';
import { CSS_NAMED_COLORS, PaletteKey, PALETTES } from './colors';

// Constants
const DEFAULT_TAB_SIZE = 4;
const MAX_IGNORED_LINE_SPAN = 2000;

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
    rainbow: vscode.Range[][];
    errors: vscode.Range[];
    mixed: vscode.Range[];
}

// Color Validation Helper
function isValidColor(color: string): boolean {
    if (!color || typeof color !== 'string') return false;

    const trimmed = color.trim().toLowerCase();

    // Check for hex format: #RGB, #RRGGBB, #RRGGBBAA
    if (/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(trimmed)) {
        return true;
    }

    // Check for rgba/rgb format
    if (/^rgba?\(\s*\d{1,3}%?\s*,\s*\d{1,3}%?\s*,\s*\d{1,3}%?\s*(?:,\s*(?:0|1|0?\.\d+|\d{1,3}%?)\s*)?\)$/.test(trimmed)) {
        return true;
    }

    return CSS_NAMED_COLORS.has(trimmed);
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

    // Cache for tab size per document
    private tabSizeCache = new Map<string, { value: number; timestamp: number }>();

    // Runtime State
    private timeout: NodeJS.Timeout | null = null;
    private isDisposed = false;

    // Regex pattern - compiled once, reused
    private readonly indentRegex = /^[\t ]+/gm;

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

        if (vscode.window.activeTextEditor) {
            this.triggerUpdate();
        }
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
        this.timeout = setTimeout(() => this.update(), this.config.updateDelay);
    }

    private update(): void {
        if (this.isDisposed) return;

        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const doc = editor.document;
        if (this.config.ignoredLanguages.has(doc.languageId)) return;

        const text = doc.getText();
        const tabSize = this.getTabSize(editor);
        const skipErrors = this.config.ignoreErrorLanguages.has(doc.languageId);

        const analysisResult = this.analyzeIndentation(text, doc, tabSize, skipErrors);
        this.applyDecorations(editor, analysisResult);
    }

    private analyzeIndentation(
        text: string,
        doc: vscode.TextDocument,
        tabSize: number,
        skipErrors: boolean
    ): IndentationAnalysisResult {
        const rainbow: vscode.Range[][] = Array.from(
            { length: this.decorators.length },
            () => []
        );
        const errors: vscode.Range[] = [];
        const mixed: vscode.Range[] = [];

        const ignoredLines = this.identifyIgnoredLines(text, doc);

        // Reset regex before use
        this.indentRegex.lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = this.indentRegex.exec(text)) !== null) {
            const matchText = match[0];
            const matchIndex = match.index;
            const startPos = doc.positionAt(matchIndex);

            if (ignoredLines.has(startPos.line)) continue;

            // Check for mixed indentation
            const hasTabs = matchText.includes('\t');
            const hasSpaces = matchText.includes(' ');

            if (hasTabs && hasSpaces && this.mixDecorator) {
                // Optimization: Use coordinate arithmetic instead of positionAt
                mixed.push(new vscode.Range(
                    startPos.line,
                    startPos.character,
                    startPos.line,
                    startPos.character + matchText.length
                ));
            }

            const { visualWidth, blockRanges } = this.calculateRainbowBlocks(
                matchText,
                startPos.line,
                startPos.character,
                tabSize
            );

            // Distribute blocks across decorators
            for (let i = 0; i < blockRanges.length; i++) {
                const colorIndex = i % this.decorators.length;
                rainbow[colorIndex].push(blockRanges[i]);
            }

            // Mark indentation errors
            if (!skipErrors && visualWidth % tabSize !== 0 && this.errorDecorator) {
                // Optimization: Use coordinate arithmetic
                errors.push(new vscode.Range(
                    startPos.line,
                    startPos.character,
                    startPos.line,
                    startPos.character + matchText.length
                ));
            }
        }

        return { rainbow, errors, mixed };
    }

    private applyDecorations(
        editor: vscode.TextEditor,
        result: IndentationAnalysisResult
    ): void {
        if (this.isDisposed) return;

        // Apply rainbow decorations
        this.decorators.forEach((dec, i) => editor.setDecorations(dec, result.rainbow[i]));

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

        // Handle number type
        if (typeof tabSizeOption === 'number' && tabSizeOption > 0) {
            return tabSizeOption;
        }

        // Handle string type (parse to number)
        if (typeof tabSizeOption === 'string') {
            const parsed = parseInt(tabSizeOption, 10);
            if (!isNaN(parsed) && parsed > 0) {
                return parsed;
            }
        }

        // Fallback to global setting
        const globalTabSize = vscode.workspace.getConfiguration('editor').get<number>('tabSize');
        if (typeof globalTabSize === 'number' && globalTabSize > 0) {
            return globalTabSize;
        }

        return DEFAULT_TAB_SIZE;
    }

    private identifyIgnoredLines(text: string, doc: vscode.TextDocument): Set<number> {
        const ignoredLines = new Set<number>();

        if (this.compiledIgnorePatterns.length === 0) {
            return ignoredLines;
        }

        for (const regex of this.compiledIgnorePatterns) {
            regex.lastIndex = 0; // Reset state for reuse
            let match: RegExpExecArray | null;

            while ((match = regex.exec(text)) !== null) {
                const startLine = doc.positionAt(match.index).line;
                const endLine = doc.positionAt(match.index + match[0].length).line;

                // Safety: prevent freezing on massive matches
                if (endLine - startLine > MAX_IGNORED_LINE_SPAN) {
                    console.warn(`[IndentSpectra] Skipping large ignored block (${endLine - startLine} lines)`);
                    continue;
                }

                for (let i = startLine; i <= endLine; i++) {
                    ignoredLines.add(i);
                }

                // Prevent infinite loops on zero-width matches
                if (match[0].length === 0) {
                    regex.lastIndex++;
                }
            }
        }

        return ignoredLines;
    }

    private calculateRainbowBlocks(
        text: string,
        line: number,
        startChar: number,
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
                    startChar + currentBlockStartCharIndex,
                    line,
                    startChar + blockEndCharIndex
                ));
                currentBlockStartCharIndex = blockEndCharIndex;
            }
        }

        // Handle incomplete final block (remainder)
        if (currentBlockStartCharIndex < text.length) {
            blockRanges.push(new vscode.Range(
                line,
                startChar + currentBlockStartCharIndex,
                line,
                startChar + text.length
            ));
        }

        return { visualWidth, blockRanges };
    }
}
