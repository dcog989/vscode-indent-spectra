import * as vscode from 'vscode';

// Magic Constants
const DEFAULT_OPACITY_LIGHT = 0.08;
const DEFAULT_OPACITY_COLORBLIND = 0.2;
const DEFAULT_OPACITY_AESTHETIC = 0.1;
const TAB_SIZE_CACHE_TTL = 5000; // 5 seconds
const DEFAULT_TAB_SIZE = 4;

// Palette Definitions
const PALETTE_UNIVERSAL = [
    `rgba(255, 215, 0, ${DEFAULT_OPACITY_LIGHT})`,
    `rgba(65, 105, 225, ${DEFAULT_OPACITY_LIGHT})`,
    `rgba(255, 105, 180, ${DEFAULT_OPACITY_LIGHT})`,
    `rgba(0, 255, 255, ${DEFAULT_OPACITY_LIGHT})`
];

const PALETTE_PROTAN_DEUTERAN = [
    `rgba(240, 228, 66, ${DEFAULT_OPACITY_COLORBLIND})`,
    `rgba(86, 180, 233, ${DEFAULT_OPACITY_COLORBLIND})`,
    `rgba(230, 159, 0, ${DEFAULT_OPACITY_COLORBLIND})`,
    `rgba(0, 114, 178, ${DEFAULT_OPACITY_COLORBLIND})`
];

const PALETTE_TRITAN = [
    `rgba(204, 121, 167, ${DEFAULT_OPACITY_COLORBLIND})`,
    `rgba(0, 158, 115, ${DEFAULT_OPACITY_COLORBLIND})`,
    `rgba(213, 94, 0, ${DEFAULT_OPACITY_COLORBLIND})`,
    `rgba(240, 240, 240, ${DEFAULT_OPACITY_COLORBLIND})`
];

const PALETTE_COOL = [
    `rgba(64, 224, 208, ${DEFAULT_OPACITY_AESTHETIC})`,
    `rgba(100, 149, 237, ${DEFAULT_OPACITY_AESTHETIC})`,
    `rgba(123, 104, 238, ${DEFAULT_OPACITY_AESTHETIC})`,
    `rgba(176, 196, 222, ${DEFAULT_OPACITY_AESTHETIC})`
];

const PALETTE_WARM = [
    `rgba(255, 160, 122, ${DEFAULT_OPACITY_AESTHETIC})`,
    `rgba(255, 215, 0, ${DEFAULT_OPACITY_AESTHETIC})`,
    `rgba(255, 127, 80, ${DEFAULT_OPACITY_AESTHETIC})`,
    `rgba(240, 230, 140, ${DEFAULT_OPACITY_AESTHETIC})`
];

// Palette management
type PaletteKey = 'universal' | 'protan-deuteran' | 'tritan' | 'cool' | 'warm';
const PALETTES: Record<PaletteKey, string[]> = {
    'universal': PALETTE_UNIVERSAL,
    'protan-deuteran': PALETTE_PROTAN_DEUTERAN,
    'tritan': PALETTE_TRITAN,
    'cool': PALETTE_COOL,
    'warm': PALETTE_WARM
};

// Type-Safe Configuration
interface IndentSpectraConfig {
    updateDelay: number;
    colorPreset: 'universal' | 'protan-deuteran' | 'tritan' | 'cool' | 'warm' | 'custom';
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

    color = color.trim();

    // Check for rgba format: rgba(r, g, b, a)
    if (/^rgba\(\s*(\d{1,3}|100%)\s*,\s*(\d{1,3}|100%)\s*,\s*(\d{1,3}|100%)\s*,\s*(0(\.\d+)?|1(\.0+)?)\s*\)$/.test(color)) {
        return true;
    }

    // Check for rgb format: rgb(r, g, b)
    if (/^rgb\(\s*(\d{1,3}|100%)\s*,\s*(\d{1,3}|100%)\s*,\s*(\d{1,3}|100%)\s*\)$/.test(color)) {
        return true;
    }

    // Check for hex format: #RGB, #RRGGBB, #RRGGBBAA
    if (/^#([0-9A-Fa-f]{3}){1,2}$/.test(color) || /^#([0-9A-Fa-f]{8})$/.test(color)) {
        return true;
    }

    // CSS named colors
    const namedColors = new Set([
        'transparent', 'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure',
        'beige', 'bisque', 'black', 'blanchedalmond', 'blue', 'blueviolet', 'brown',
        'burlywood', 'cadetblue', 'chartreuse', 'chocolate', 'coral', 'cornflowerblue',
        'cornsilk', 'crimson', 'cyan', 'darkblue', 'darkcyan', 'darkgoldenrod',
        'darkgray', 'darkgrey', 'darkgreen', 'darkkhaki', 'darkmagenta', 'darkolivegreen',
        'darkorange', 'darkorchid', 'darkred', 'darksalmon', 'darkseagreen', 'darkslateblue',
        'darkslategray', 'darkslategrey', 'darkturquoise', 'darkviolet', 'deeppink',
        'deepskyblue', 'dimgray', 'dimgrey', 'dodgerblue', 'firebrick', 'floralwhite',
        'forestgreen', 'fuchsia', 'gainsboro', 'ghostwhite', 'gold', 'goldenrod', 'gray',
        'grey', 'green', 'greenyellow', 'honeydew', 'hotpink', 'indianred', 'indigo',
        'ivory', 'khaki', 'lavender', 'lavenderblush', 'lawngreen', 'lemonchiffon',
        'lightblue', 'lightcoral', 'lightcyan', 'lightgoldenrodyellow', 'lightgray',
        'lightgrey', 'lightgreen', 'lightpink', 'lightsalmon', 'lightseagreen',
        'lightskyblue', 'lightslategray', 'lightslategrey', 'lightsteelblue', 'lightyellow',
        'lime', 'limegreen', 'linen', 'magenta', 'maroon', 'mediumaquamarine',
        'mediumblue', 'mediumorchid', 'mediumpurple', 'mediumseagreen', 'mediumslateblue',
        'mediumspringgreen', 'mediumturquoise', 'mediumvioletred', 'midnightblue', 'mintcream',
        'mistyrose', 'moccasin', 'navajowhite', 'navy', 'oldlace', 'olive', 'olivedrab',
        'orange', 'orangered', 'orchid', 'palegoldenrod', 'palegreen', 'paleturquoise',
        'palevioletred', 'papayawhip', 'peachpuff', 'peru', 'pink', 'plum', 'powderblue',
        'purple', 'rebeccapurple', 'red', 'rosybrown', 'royalblue', 'saddlebrown', 'salmon',
        'sandybrown', 'seagreen', 'seashell', 'sienna', 'silver', 'skyblue', 'slateblue',
        'slategray', 'slategrey', 'snow', 'springgreen', 'steelblue', 'tan', 'teal',
        'thistle', 'tomato', 'turquoise', 'violet', 'wheat', 'white', 'whitesmoke',
        'yellow', 'yellowgreen'
    ]);

    return namedColors.has(color.toLowerCase());
}

function loadConfigurationFromVSCode(): Omit<IndentSpectraConfig, 'ignoredLanguages' | 'ignoreErrorLanguages'> & {
    ignoredLanguagesArray: string[];
    ignoreErrorLanguagesArray: string[];
} {
    const config = vscode.workspace.getConfiguration('indentSpectra');

    return {
        updateDelay: Math.max(10, config.get<number>('updateDelay', 100)),
        colorPreset: config.get<'universal' | 'protan-deuteran' | 'tritan' | 'cool' | 'warm' | 'custom'>('colorPreset', 'universal'),
        colors: config.get<string[]>('colors', []),
        errorColor: config.get<string>('errorColor', ''),
        mixColor: config.get<string>('mixColor', ''),
        ignorePatterns: config.get<string[]>('ignorePatterns', []),
        ignoredLanguagesArray: config.get<string[]>('ignoredLanguages', []),
        ignoreErrorLanguagesArray: config.get<string[]>('ignoreErrorLanguages', []),
        indicatorStyle: config.get<'classic' | 'light'>('indicatorStyle', 'classic'),
        lightIndicatorWidth: config.get<number>('lightIndicatorWidth', 1)
    };
}

export class IndentSpectra implements vscode.Disposable {
    private decorators: vscode.TextEditorDecorationType[] = [];
    private errorDecorator?: vscode.TextEditorDecorationType;
    private mixDecorator?: vscode.TextEditorDecorationType;

    // Configuration State
    private config: IndentSpectraConfig = {
        updateDelay: 100,
        colorPreset: 'universal',
        colors: [],
        errorColor: '',
        mixColor: '',
        ignorePatterns: [],
        ignoredLanguages: new Set(),
        ignoreErrorLanguages: new Set(),
        indicatorStyle: 'classic',
        lightIndicatorWidth: 1
    };

    // Cache for ignore patterns (compiled once)
    private compiledIgnorePatterns: RegExp[] = [];
    private combinedIgnorePattern: RegExp | null = null;

    // Cache for tab size per document
    private tabSizeCache = new Map<string, { value: number; timestamp: number }>();

    // Runtime State
    private timeout: ReturnType<typeof setTimeout> | null = null;

    // Regex pattern with lookahead optimization
    private readonly indentRegex = /^[\t ]+(?=\S)/gm;

    // Cache for decorator options to avoid recreating
    private lastColorPreset: string | null = null;
    private lastIndicatorStyle: 'classic' | 'light' | null = null;
    private lastLightIndicatorWidth: number | null = null;

    constructor() {
        this.reloadConfig();
    }

    // Extract error highlighting logic into separate method
    private shouldSkipErrorHighlighting(languageId: string): boolean {
        return this.config.ignoreErrorLanguages.has(languageId);
    }

    public reloadConfig(): void {
        const rawConfig = loadConfigurationFromVSCode();

        // Extract config values with type safety
        const newConfig: IndentSpectraConfig = {
            updateDelay: rawConfig.updateDelay,
            colorPreset: rawConfig.colorPreset,
            colors: rawConfig.colors,
            errorColor: rawConfig.errorColor,
            mixColor: rawConfig.mixColor,
            ignorePatterns: rawConfig.ignorePatterns,
            ignoredLanguages: new Set(rawConfig.ignoredLanguagesArray),
            ignoreErrorLanguages: new Set(rawConfig.ignoreErrorLanguagesArray),
            indicatorStyle: rawConfig.indicatorStyle,
            lightIndicatorWidth: rawConfig.lightIndicatorWidth
        };

        this.config = newConfig;
        this.tabSizeCache.clear();

        // Recompile patterns if they changed
        this.compileIgnorePatterns(newConfig.ignorePatterns);

        // Only dispose and recreate decorators if appearance settings changed
        const styleChanged =
            newConfig.colorPreset !== this.lastColorPreset ||
            newConfig.indicatorStyle !== this.lastIndicatorStyle ||
            newConfig.lightIndicatorWidth !== this.lastLightIndicatorWidth;

        if (styleChanged) {
            this.disposeDecorators();
            this.initializeDecorators(newConfig);
            this.lastColorPreset = newConfig.colorPreset;
            this.lastIndicatorStyle = newConfig.indicatorStyle;
            this.lastLightIndicatorWidth = newConfig.lightIndicatorWidth;
        }

        if (vscode.window.activeTextEditor) {
            this.triggerUpdate();
        }
    }

    // Compile ignore patterns once and create combined pattern
    private compileIgnorePatterns(patternStrings: string[]): void {
        this.compiledIgnorePatterns = [];
        this.combinedIgnorePattern = null;

        if (patternStrings.length === 0) {
            return;
        }

        // Compile individual patterns
        this.compiledIgnorePatterns = patternStrings
            .map(pattern => {
                try {
                    const parts = pattern.match(/^\/(.*?)\/([gimsvy]*)$/);
                    return parts ? new RegExp(parts[1], parts[2]) : new RegExp(pattern);
                } catch (e) {
                    console.warn(`[IndentSpectra] Invalid Regex: ${pattern}`, e);
                    return null;
                }
            })
            .filter((r): r is RegExp => r !== null);

        // Create combined pattern for single-pass matching
        if (this.compiledIgnorePatterns.length > 0) {
            try {
                const combinedSource = this.compiledIgnorePatterns
                    .map(p => `(${p.source})`)
                    .join('|');
                this.combinedIgnorePattern = new RegExp(combinedSource, 'gm');
            } catch (e) {
                console.warn('[IndentSpectra] Error creating combined pattern', e);
            }
        }
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
        const colors = this.resolveColorPalette(config);

        // Create decorators
        this.decorators = colors.map(color =>
            vscode.window.createTextEditorDecorationType(
                this.createDecoratorOptions(color, config.indicatorStyle, config.lightIndicatorWidth)
            )
        );

        // Create error decorator
        if (config.errorColor && isValidColor(config.errorColor)) {
            this.errorDecorator = vscode.window.createTextEditorDecorationType({
                backgroundColor: config.errorColor
            });
        }

        // Create mix decorator
        if (config.mixColor && isValidColor(config.mixColor)) {
            this.mixDecorator = vscode.window.createTextEditorDecorationType({
                backgroundColor: config.mixColor
            });
        }
    }

    private resolveColorPalette(config: IndentSpectraConfig): string[] {
        let colors: string[] = [];

        if (config.colorPreset === 'custom') {
            colors = config.colors.filter(color => {
                if (!isValidColor(color)) {
                    console.warn(`[IndentSpectra] Invalid color format: ${color}`);
                    return false;
                }
                return true;
            });
        } else if (config.colorPreset in PALETTES) {
            colors = PALETTES[config.colorPreset as PaletteKey];
        } else {
            colors = PALETTES.universal;
        }

        // Fallback if all colors were invalid or palette was empty
        return colors.length > 0 ? colors : PALETTES.universal;
    }

    public dispose(): void {
        this.disposeDecorators();
        if (this.timeout) {
            clearTimeout(this.timeout);
        }
        this.tabSizeCache.clear();
    }

    private disposeDecorators(): void {
        this.decorators.forEach(d => d.dispose());
        this.decorators = [];
        this.errorDecorator?.dispose();
        this.mixDecorator?.dispose();
    }

    public triggerUpdate(): void {
        if (this.timeout) {
            clearTimeout(this.timeout);
        }
        this.timeout = setTimeout(() => this.update(), this.config.updateDelay);
    }

    private update(): void {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const doc = editor.document;
        if (this.config.ignoredLanguages.has(doc.languageId)) return;

        const text = doc.getText();
        const tabSize = this.getTabSize(editor);
        const skipErrors = this.shouldSkipErrorHighlighting(doc.languageId);

        const analysisResult = this.analyzeIndentation(text, doc, tabSize, skipErrors);
        this.applyDecorations(editor, analysisResult);
    }

    // Analyze indentation and return categorized ranges
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

        const ignoredLines = this.findIgnoredLinesOptimized(text, doc);

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
                const endPos = doc.positionAt(matchIndex + matchText.length);
                mixed.push(new vscode.Range(startPos, endPos));
            }

            // Calculate blocks efficiently
            const { visualWidth, blockRanges } = this.calculateRainbowBlocks(
                matchText,
                matchIndex,
                tabSize,
                doc
            );

            // Distribute blocks to colors
            for (let i = 0; i < blockRanges.length; i++) {
                const colorIndex = i % this.decorators.length;
                rainbow[colorIndex].push(blockRanges[i]);
            }

            // Check for errors
            if (!skipErrors && visualWidth % tabSize !== 0 && this.errorDecorator) {
                const endPos = doc.positionAt(matchIndex + matchText.length);
                errors.push(new vscode.Range(startPos, endPos));
            }
        }

        return { rainbow, errors, mixed };
    }

    private applyDecorations(
        editor: vscode.TextEditor,
        result: IndentationAnalysisResult
    ): void {
        // Batch apply all decorators at once
        this.decorators.forEach((dec, i) => editor.setDecorations(dec, result.rainbow[i]));
        if (this.errorDecorator) editor.setDecorations(this.errorDecorator, result.errors);
        if (this.mixDecorator) editor.setDecorations(this.mixDecorator, result.mixed);
    }

    // Cache tab size per editor/document with TTL
    private getTabSize(editor: vscode.TextEditor): number {
        const docUri = editor.document.uri.toString();
        const cached = this.tabSizeCache.get(docUri);

        // Return cached value if still fresh
        if (cached && Date.now() - cached.timestamp < TAB_SIZE_CACHE_TTL) {
            return cached.value;
        }

        const tabSize = this.resolveTabSize(editor);

        // Cache the result
        this.tabSizeCache.set(docUri, { value: tabSize, timestamp: Date.now() });
        return tabSize;
    }

    private resolveTabSize(editor: vscode.TextEditor): number {
        // 1. Try editor-specific tab size
        const tabSizeRaw = editor.options.tabSize;
        if (typeof tabSizeRaw === 'number' && tabSizeRaw > 0) {
            return tabSizeRaw;
        }
        if (typeof tabSizeRaw === 'string') {
            const parsed = parseInt(tabSizeRaw, 10);
            if (!isNaN(parsed) && parsed > 0) {
                return parsed;
            }
        }

        // 2. Try global configuration
        const globalTabSize = vscode.workspace.getConfiguration('editor').get<number>('tabSize');
        if (globalTabSize && globalTabSize > 0) {
            return globalTabSize;
        }

        // 3. Fallback
        return DEFAULT_TAB_SIZE;
    }

    // Optimized ignored lines detection with combined pattern
    private findIgnoredLinesOptimized(text: string, doc: vscode.TextDocument): Set<number> {
        const ignoredLines = new Set<number>();

        if (this.combinedIgnorePattern) {
            this.combinedIgnorePattern.lastIndex = 0;
            let match: RegExpExecArray | null;

            while ((match = this.combinedIgnorePattern.exec(text)) !== null) {
                const startLine = doc.positionAt(match.index).line;
                const endLine = doc.positionAt(match.index + match[0].length).line;
                for (let i = startLine; i <= endLine; i++) {
                    ignoredLines.add(i);
                }
            }
        } else if (this.compiledIgnorePatterns.length > 0) {
            // Fallback to sequential matching if combined pattern failed
            for (const pattern of this.compiledIgnorePatterns) {
                pattern.lastIndex = 0;
                let match: RegExpExecArray | null;
                while ((match = pattern.exec(text)) !== null) {
                    const startLine = doc.positionAt(match.index).line;
                    const endLine = doc.positionAt(match.index + match[0].length).line;
                    for (let i = startLine; i <= endLine; i++) {
                        ignoredLines.add(i);
                    }
                }
            }
        }

        return ignoredLines;
    }

    // Calculate rainbow blocks with optimized visual width calculation
    private calculateRainbowBlocks(
        text: string,
        startIndex: number,
        tabSize: number,
        doc: vscode.TextDocument
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

            if (visualWidth > 0 && visualWidth % tabSize === 0) {
                const blockEndCharIndex = i + 1;

                const startPos = doc.positionAt(startIndex + currentBlockStartCharIndex);
                const endPos = doc.positionAt(startIndex + blockEndCharIndex);

                blockRanges.push(new vscode.Range(startPos, endPos));
                currentBlockStartCharIndex = blockEndCharIndex;
            }
        }

        // Handle incomplete final block
        if (currentBlockStartCharIndex < text.length) {
            const startPos = doc.positionAt(startIndex + currentBlockStartCharIndex);
            const endPos = doc.positionAt(startIndex + text.length);
            blockRanges.push(new vscode.Range(startPos, endPos));
        }

        return { visualWidth, blockRanges };
    }
}