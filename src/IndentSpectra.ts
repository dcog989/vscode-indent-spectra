import * as vscode from 'vscode';

// --- Magic Constants ---
const DEFAULT_OPACITY_LIGHT = 0.08;
const DEFAULT_OPACITY_COLORBLIND = 0.2;
const DEFAULT_OPACITY_AESTHETIC = 0.1;

// --- Palette Definitions ---

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

// --- Type-Safe Configuration ---
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

// --- Color Validation Helper ---
/**
 * Validates that a color string is a valid CSS color format.
 * Uses regex-based validation since this runs in Node.js context.
 */
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

    // Known CSS named colors
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

export class IndentSpectra implements vscode.Disposable {
    // Decorators
    private decorators: vscode.TextEditorDecorationType[] = [];
    private errorDecorator?: vscode.TextEditorDecorationType;
    private mixDecorator?: vscode.TextEditorDecorationType;

    // Configuration State - Type Safe
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
    private readonly TAB_SIZE_CACHE_TTL = 5000; // 5 seconds

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

    /**
     * PERF FIX #3: Only reload decorators if style/color settings actually changed
     */
    public reloadConfig(): void {
        const config = vscode.workspace.getConfiguration('indentSpectra');

        // Extract config values with type safety
        const newConfig: IndentSpectraConfig = {
            updateDelay: Math.max(10, config.get<number>('updateDelay', 100)),
            colorPreset: config.get<'universal' | 'protan-deuteran' | 'tritan' | 'cool' | 'warm' | 'custom'>('colorPreset', 'universal'),
            colors: config.get<string[]>('colors', []),
            errorColor: config.get<string>('errorColor', ''),
            mixColor: config.get<string>('mixColor', ''),
            ignorePatterns: config.get<string[]>('ignorePatterns', []),
            ignoredLanguages: new Set(config.get<string[]>('ignoredLanguages', [])),
            ignoreErrorLanguages: new Set(config.get<string[]>('ignoreErrorLanguages', [])),
            indicatorStyle: config.get<'classic' | 'light'>('indicatorStyle', 'classic'),
            lightIndicatorWidth: config.get<number>('lightIndicatorWidth', 1)
        };

        this.config = newConfig;
        this.tabSizeCache.clear();

        // PERF FIX #1: Only recompile patterns if they changed
        const patternString = newConfig.ignorePatterns.join('|');
        this.compileIgnorePatterns(newConfig.ignorePatterns);

        // PERF FIX #3: Only dispose and recreate decorators if appearance settings changed
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

    /**
     * PERF FIX #1: Compile ignore patterns once and create combined pattern
     */
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

    /**
     * Initialize decorators only once per color/style configuration
     */
    private initializeDecorators(config: IndentSpectraConfig): void {
        let colors: string[] = [];

        switch (config.colorPreset) {
            case 'protan-deuteran':
                colors = PALETTE_PROTAN_DEUTERAN;
                break;
            case 'tritan':
                colors = PALETTE_TRITAN;
                break;
            case 'cool':
                colors = PALETTE_COOL;
                break;
            case 'warm':
                colors = PALETTE_WARM;
                break;
            case 'custom':
                colors = config.colors.filter(color => {
                    if (!isValidColor(color)) {
                        console.warn(`[IndentSpectra] Invalid color format: ${color}`);
                        return false;
                    }
                    return true;
                });
                break;
            case 'universal':
            default:
                colors = PALETTE_UNIVERSAL;
                break;
        }

        if (colors.length === 0) {
            colors = PALETTE_UNIVERSAL;
        }

        // Create decorators
        this.decorators = colors.map(color => {
            const options: vscode.DecorationRenderOptions = {};
            if (config.indicatorStyle === 'light') {
                options.borderWidth = `0 0 0 ${config.lightIndicatorWidth}px`;
                options.borderStyle = 'solid';
                options.borderColor = color;
            } else {
                options.backgroundColor = color;
            }
            return vscode.window.createTextEditorDecorationType(options);
        });

        // Create error decorator
        const errorColor = config.errorColor;
        if (errorColor && isValidColor(errorColor)) {
            this.errorDecorator = vscode.window.createTextEditorDecorationType({
                backgroundColor: errorColor
            });
        }

        // Create mix decorator
        const mixColor = config.mixColor;
        if (mixColor && isValidColor(mixColor)) {
            this.mixDecorator = vscode.window.createTextEditorDecorationType({
                backgroundColor: mixColor
            });
        }
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

    /**
     * PERF FIX #2: Separated concerns for better testability and caching
     */
    private update(): void {
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

    /**
     * Analyze indentation and return categorized ranges
     */
    private analyzeIndentation(
        text: string,
        doc: vscode.TextDocument,
        tabSize: number,
        skipErrors: boolean
    ): {
        rainbow: vscode.Range[][];
        errors: vscode.Range[];
        mixed: vscode.Range[];
    } {
        const rainbow: vscode.Range[][] = Array.from(
            { length: this.decorators.length },
            () => []
        );
        const errors: vscode.Range[] = [];
        const mixed: vscode.Range[] = [];

        // PERF FIX #1: Use combined pattern for single pass
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

    /**
     * Apply all decorations to the editor
     */
    private applyDecorations(
        editor: vscode.TextEditor,
        result: {
            rainbow: vscode.Range[][];
            errors: vscode.Range[];
            mixed: vscode.Range[];
        }
    ): void {
        // Batch apply all decorators at once
        this.decorators.forEach((dec, i) => editor.setDecorations(dec, result.rainbow[i]));
        if (this.errorDecorator) editor.setDecorations(this.errorDecorator, result.errors);
        if (this.mixDecorator) editor.setDecorations(this.mixDecorator, result.mixed);
    }

    /**
     * PERF FIX #2: Cache tab size per editor/document
     */
    private getTabSize(editor: vscode.TextEditor): number {
        const docUri = editor.document.uri.toString();
        const cached = this.tabSizeCache.get(docUri);

        // Return cached value if still fresh
        if (cached && Date.now() - cached.timestamp < this.TAB_SIZE_CACHE_TTL) {
            return cached.value;
        }

        let tabSize = 4; // default

        // 1. Try editor-specific tab size
        const tabSizeRaw = editor.options.tabSize;
        if (typeof tabSizeRaw === 'number' && tabSizeRaw > 0) {
            tabSize = tabSizeRaw;
        } else if (typeof tabSizeRaw === 'string') {
            const parsed = parseInt(tabSizeRaw, 10);
            if (!isNaN(parsed) && parsed > 0) {
                tabSize = parsed;
            }
        } else {
            // 2. Try global configuration
            const globalTabSize = vscode.workspace.getConfiguration('editor').get<number>('tabSize');
            if (globalTabSize && globalTabSize > 0) {
                tabSize = globalTabSize;
            }
        }

        // Cache the result
        this.tabSizeCache.set(docUri, { value: tabSize, timestamp: Date.now() });
        return tabSize;
    }

    /**
     * PERF FIX #1: Optimized ignored lines detection with combined pattern
     */
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

    /**
     * Calculate rainbow blocks with optimized visual width calculation
     */
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