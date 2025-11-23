import * as vscode from 'vscode';

// --- Palette Definitions ---

const PALETTE_UNIVERSAL = [
    "rgba(255, 215, 0, 0.08)",
    "rgba(65, 105, 225, 0.08)",
    "rgba(255, 105, 180, 0.08)",
    "rgba(0, 255, 255, 0.08)"
];

const PALETTE_PROTAN_DEUTERAN = [
    "rgba(240, 228, 66, 0.2)",
    "rgba(86, 180, 233, 0.2)",
    "rgba(230, 159, 0, 0.2)",
    "rgba(0, 114, 178, 0.2)"
];

const PALETTE_TRITAN = [
    "rgba(204, 121, 167, 0.2)",
    "rgba(0, 158, 115, 0.2)",
    "rgba(213, 94, 0, 0.2)",
    "rgba(240, 240, 240, 0.2)"
];

const PALETTE_COOL = [
    "rgba(64, 224, 208, 0.1)",
    "rgba(100, 149, 237, 0.1)",
    "rgba(123, 104, 238, 0.1)",
    "rgba(176, 196, 222, 0.1)"
];

const PALETTE_WARM = [
    "rgba(255, 160, 122, 0.1)",
    "rgba(255, 215, 0, 0.1)",
    "rgba(255, 127, 80, 0.1)",
    "rgba(240, 230, 140, 0.1)"
];

// --- Color Validation Helper ---
/**
 * Validates that a color string is a valid CSS color format.
 * Supports rgba(), rgb(), hex, and named colors.
 * Uses regex-based validation since this runs in Node.js context.
 */
function isValidColor(color: string): boolean {
    if (!color || typeof color !== 'string') return false;

    // Trim whitespace
    color = color.trim();

    // Check for rgba format: rgba(r, g, b, a) where r,g,b are 0-255 or percentages, a is 0-1
    if (/^rgba\(\s*(\d{1,3}|100%)\s*,\s*(\d{1,3}|100%)\s*,\s*(\d{1,3}|100%)\s*,\s*(0(\.\d+)?|1(\.0+)?)\s*\)$/.test(color)) {
        return true;
    }

    // Check for rgb format: rgb(r, g, b)
    if (/^rgb\(\s*(\d{1,3}|100%)\s*,\s*(\d{1,3}|100%)\s*,\s*(\d{1,3}|100%)\s*\)$/.test(color)) {
        return true;
    }

    // Check for hex format: #RGB or #RRGGBB
    if (/^#([0-9A-Fa-f]{3}){1,2}$/.test(color)) {
        return true;
    }

    // Check for hex format with alpha: #RRGGBBAA
    if (/^#([0-9A-Fa-f]{8})$/.test(color)) {
        return true;
    }

    // Known CSS named colors (common subset)
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
    private decorators: vscode.TextEditorDecorationType[] = [];
    private errorDecorator?: vscode.TextEditorDecorationType;
    private mixDecorator?: vscode.TextEditorDecorationType;

    private updateDelay = 100;
    private ignorePatterns: RegExp[] = [];
    private ignoredLanguages = new Set<string>();
    private ignoreErrorLanguages = new Set<string>();
    private indicatorStyle: 'classic' | 'light' = 'classic';
    private lightIndicatorWidth = 1;

    private timeout: ReturnType<typeof setTimeout> | null = null;

    // Cache for ignored lines to avoid recomputation
    private lastIgnoredLinesCache: Set<number> | null = null;
    private lastDocumentVersion: number | null = null;

    private readonly indentRegex = /^[\t ]+/gm;

    constructor() {
        this.reloadConfig();
    }

    /**
     * BUG FIX #3: Check if active editor exists before triggering update
     */
    public reloadConfig(): void {
        this.disposeDecorators();
        this.lastIgnoredLinesCache = null; // Invalidate cache on config change

        const config = vscode.workspace.getConfiguration('indentSpectra');

        this.updateDelay = Math.max(10, config.get<number>('updateDelay', 100));
        this.indicatorStyle = config.get<'classic' | 'light'>('indicatorStyle', 'classic');
        this.lightIndicatorWidth = config.get<number>('lightIndicatorWidth', 1);

        const preset = config.get<string>('colorPreset', 'universal');
        let colors: string[] = [];

        switch (preset) {
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
                colors = config.get<string[]>('colors', []);
                break;
            case 'universal':
            default:
                colors = PALETTE_UNIVERSAL;
                break;
        }

        if (colors.length === 0) {
            colors = PALETTE_UNIVERSAL;
        }

        // BUG FIX #4: Validate custom colors before using them
        colors = colors.filter(color => {
            if (!isValidColor(color)) {
                console.warn(`[IndentSpectra] Invalid color format: ${color}`);
                return false;
            }
            return true;
        });

        // If all colors were invalid, fall back to universal palette
        if (colors.length === 0) {
            colors = PALETTE_UNIVERSAL;
        }

        const errorColor = config.get<string>('errorColor', '');
        const mixColor = config.get<string>('mixColor', '');

        // Validate error and mix colors
        const validatedErrorColor = errorColor && isValidColor(errorColor) ? errorColor : '';
        const validatedMixColor = mixColor && isValidColor(mixColor) ? mixColor : '';

        const ignoreStrs = config.get<string[]>('ignorePatterns', []);
        const ignoredLangs = config.get<string[]>('ignoredLanguages', []);
        const ignoreErrLangs = config.get<string[]>('ignoreErrorLanguages', []);

        this.ignorePatterns = ignoreStrs
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

        this.ignoredLanguages = new Set(ignoredLangs);
        this.ignoreErrorLanguages = new Set(ignoreErrLangs);

        this.decorators = colors.map(color => {
            const options: vscode.DecorationRenderOptions = {};
            if (this.indicatorStyle === 'light') {
                options.borderWidth = `0 0 0 ${this.lightIndicatorWidth}px`;
                options.borderStyle = 'solid';
                options.borderColor = color;
            } else {
                options.backgroundColor = color;
            }
            return vscode.window.createTextEditorDecorationType(options);
        });

        if (validatedErrorColor) {
            this.errorDecorator = vscode.window.createTextEditorDecorationType({
                backgroundColor: validatedErrorColor
            });
        }

        if (validatedMixColor) {
            this.mixDecorator = vscode.window.createTextEditorDecorationType({
                backgroundColor: validatedMixColor
            });
        }

        // BUG FIX #3: Only trigger update if there's an active editor
        if (vscode.window.activeTextEditor) {
            this.triggerUpdate();
        }
    }

    public dispose(): void {
        this.disposeDecorators();
        if (this.timeout) {
            clearTimeout(this.timeout);
        }
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
        this.timeout = setTimeout(() => this.update(), this.updateDelay);
    }

    private update(): void {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const doc = editor.document;
        if (this.ignoredLanguages.has(doc.languageId)) return;

        const text = doc.getText();
        const tabSize = this.getTabSize(editor);
        const skipErrors = this.ignoreErrorLanguages.has(doc.languageId);

        // BUG FIX #1: Improve ignored lines detection with combined regex
        const ignoredLines = this.findIgnoredLines(text, doc);

        const ranges: vscode.Range[][] = Array.from({ length: this.decorators.length }, () => []);
        const errorRanges: vscode.Range[] = [];
        const mixRanges: vscode.Range[] = [];

        this.indentRegex.lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = this.indentRegex.exec(text)) !== null) {
            const matchText = match[0];
            if (matchText.length === 0) continue;

            const matchIndex = match.index;
            const startPos = doc.positionAt(matchIndex);

            if (ignoredLines.has(startPos.line)) continue;

            const hasTabs = matchText.includes('\t');
            const hasSpaces = matchText.includes(' ');

            if (hasTabs && hasSpaces && this.mixDecorator) {
                const endPos = doc.positionAt(matchIndex + matchText.length);
                mixRanges.push(new vscode.Range(startPos, endPos));
            }

            // BUG FIX #2: Improved block calculation to handle final incomplete blocks
            const { visualWidth, blockRanges } = this.calculateRainbowBlocks(
                matchText,
                matchIndex,
                tabSize,
                doc
            );

            for (let i = 0; i < blockRanges.length; i++) {
                const colorIndex = i % this.decorators.length;
                ranges[colorIndex].push(blockRanges[i]);
            }

            if (!skipErrors && visualWidth % tabSize !== 0 && this.errorDecorator) {
                const endPos = doc.positionAt(matchIndex + matchText.length);
                errorRanges.push(new vscode.Range(startPos, endPos));
            }
        }

        this.decorators.forEach((dec, i) => editor.setDecorations(dec, ranges[i]));
        if (this.errorDecorator) editor.setDecorations(this.errorDecorator, errorRanges);
        if (this.mixDecorator) editor.setDecorations(this.mixDecorator, mixRanges);
    }

    private getTabSize(editor: vscode.TextEditor): number {
        const tabSizeRaw = editor.options.tabSize;
        if (typeof tabSizeRaw === 'number') {
            return tabSizeRaw > 0 ? tabSizeRaw : 4;
        }
        if (typeof tabSizeRaw === 'string') {
            const parsed = parseInt(tabSizeRaw, 10);
            if (!isNaN(parsed)) return parsed > 0 ? parsed : 4;
        }

        const globalTabSize = vscode.workspace.getConfiguration('editor').get<number>('tabSize');
        if (globalTabSize && globalTabSize > 0) {
            return globalTabSize;
        }

        return 4;
    }

    /**
     * BUG FIX #1: Optimized ignored lines detection with combined pattern approach
     */
    private findIgnoredLines(text: string, doc: vscode.TextDocument): Set<number> {
        const ignoredLines = new Set<number>();
        if (this.ignorePatterns.length === 0) return ignoredLines;

        // Combine all patterns into a single alternation regex to avoid multiple passes
        try {
            const combinedPattern = new RegExp(
                this.ignorePatterns.map(p => `(${p.source})`).join('|'),
                'gm'
            );

            let match: RegExpExecArray | null;
            while ((match = combinedPattern.exec(text)) !== null) {
                const startLine = doc.positionAt(match.index).line;
                const endLine = doc.positionAt(match.index + match[0].length).line;
                for (let i = startLine; i <= endLine; i++) {
                    ignoredLines.add(i);
                }
            }
        } catch (e) {
            // Fallback: iterate through patterns individually if combination fails
            console.warn('[IndentSpectra] Error combining patterns, falling back to sequential matching', e);
            for (const pattern of this.ignorePatterns) {
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
     * BUG FIX #2: Improved to handle final incomplete blocks at end of indent string
     */
    private calculateRainbowBlocks(
        text: string,
        startIndex: number,
        tabSize: number,
        doc: vscode.TextDocument
    ): { visualWidth: number, blockRanges: vscode.Range[] } {

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

        // BUG FIX #2: Handle incomplete final block (partial indent at end)
        if (currentBlockStartCharIndex < text.length) {
            const startPos = doc.positionAt(startIndex + currentBlockStartCharIndex);
            const endPos = doc.positionAt(startIndex + text.length);
            blockRanges.push(new vscode.Range(startPos, endPos));
        }

        return { visualWidth, blockRanges };
    }
}