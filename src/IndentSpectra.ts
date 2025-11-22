import * as vscode from 'vscode';

// --- Palette Definitions ---

// 1. Universal (High Contrast Interleaved)
// Gold -> Royal Blue -> Hot Pink -> Cyan
const PALETTE_UNIVERSAL = [
    "rgba(255, 215, 0, 0.08)",   // Gold (Warm)
    "rgba(65, 105, 225, 0.08)",  // Royal Blue (Cool, Dark)
    "rgba(255, 105, 180, 0.08)", // Hot Pink (Warm, Distinct)
    "rgba(0, 255, 255, 0.08)"    // Cyan (Cool, Light)
];

// 2. Protanopia & Deuteranopia Safe (Red/Green Blindness)
// Relies on Blue vs Yellow. Avoids Red/Green.
const PALETTE_PROTAN_DEUTERAN = [
    "rgba(240, 228, 66, 0.2)",   // Yellow
    "rgba(86, 180, 233, 0.2)",   // Sky Blue
    "rgba(230, 159, 0, 0.2)",    // Orange
    "rgba(0, 114, 178, 0.2)"     // Dark Blue
];

// 3. Tritanopia Safe (Blue Blindness)
// Relies on Red/Pink vs Teal/Cyan.
const PALETTE_TRITAN = [
    "rgba(204, 121, 167, 0.2)",  // Reddish Purple
    "rgba(0, 158, 115, 0.2)",    // Bluish Green
    "rgba(213, 94, 0, 0.2)",     // Vermilion
    "rgba(240, 240, 240, 0.2)"   // Light Grey (Neutral anchor)
];

// 4. Cool (Calm)
const PALETTE_COOL = [
    "rgba(64, 224, 208, 0.1)",  // Turquoise
    "rgba(100, 149, 237, 0.1)", // Cornflower Blue
    "rgba(123, 104, 238, 0.1)", // Medium Slate Blue
    "rgba(176, 196, 222, 0.1)"  // Light Steel Blue
];

// 5. Warm (Energetic)
const PALETTE_WARM = [
    "rgba(255, 160, 122, 0.1)", // Light Salmon
    "rgba(255, 215, 0, 0.1)",   // Gold
    "rgba(255, 127, 80, 0.1)",  // Coral
    "rgba(240, 230, 140, 0.1)"  // Khaki
];


export class IndentSpectra implements vscode.Disposable {
    // Decorators
    private decorators: vscode.TextEditorDecorationType[] = [];
    private errorDecorator?: vscode.TextEditorDecorationType;
    private mixDecorator?: vscode.TextEditorDecorationType;

    // Configuration State
    private updateDelay = 100;
    private ignorePatterns: RegExp[] = [];
    private ignoredLanguages = new Set<string>();
    private ignoreErrorLanguages = new Set<string>();
    private indicatorStyle: 'classic' | 'light' = 'classic';
    private lightIndicatorWidth = 1;

    // Runtime State
    private timeout: ReturnType<typeof setTimeout> | null = null;

    // Reusable RegEx for performance (stateful)
    private readonly indentRegex = /^[\t ]+/gm;

    constructor() {
        this.reloadConfig();
    }

    /**
     * Reloads configuration and refreshes decorators efficiently.
     */
    public reloadConfig(): void {
        this.disposeDecorators();

        const config = vscode.workspace.getConfiguration('indentSpectra');

        // Primitives
        this.updateDelay = Math.max(10, config.get<number>('updateDelay', 100));
        this.indicatorStyle = config.get<'classic' | 'light'>('indicatorStyle', 'classic');
        this.lightIndicatorWidth = config.get<number>('lightIndicatorWidth', 1);

        // Color Selection Logic
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

        // Fallback if custom array is empty
        if (colors.length === 0) {
            colors = PALETTE_UNIVERSAL;
        }

        const errorColor = config.get<string>('errorColor', '');
        const mixColor = config.get<string>('mixColor', '');

        // Lists / Patterns
        const ignoreStrs = config.get<string[]>('ignorePatterns', []);
        const ignoredLangs = config.get<string[]>('ignoredLanguages', []);
        const ignoreErrLangs = config.get<string[]>('ignoreErrorLanguages', []);

        // Compile Regex patterns once
        this.ignorePatterns = ignoreStrs
            .map(pattern => {
                try {
                    // Handle JS-style regex strings "/.../g"
                    const parts = pattern.match(/^\/(.*?)\/([gimsvy]*)$/);
                    return parts ? new RegExp(parts[1], parts[2]) : new RegExp(pattern);
                } catch (e) {
                    console.warn(`[IndentSpectra] Invalid Regex: ${pattern}`, e);
                    return null;
                }
            })
            .filter((r): r is RegExp => r !== null);

        // Sets for O(1) lookup
        this.ignoredLanguages = new Set(ignoredLangs);
        this.ignoreErrorLanguages = new Set(ignoreErrLangs);

        // Initialize Rainbow Decorators based on Style
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

        // Initialize Error/Mix Decorators
        if (errorColor) {
            this.errorDecorator = vscode.window.createTextEditorDecorationType({ backgroundColor: errorColor });
        }

        if (mixColor) {
            this.mixDecorator = vscode.window.createTextEditorDecorationType({ backgroundColor: mixColor });
        }

        this.triggerUpdate();
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
        // Debounce update using Node.js timeout
        this.timeout = setTimeout(() => this.update(), this.updateDelay);
    }

    private update(): void {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const doc = editor.document;
        if (this.ignoredLanguages.has(doc.languageId)) return;

        const text = doc.getText();
        const tabSize = this.getTabSize(editor);

        // Check if errors should be ignored for this specific language
        const skipErrors = this.ignoreErrorLanguages.has(doc.languageId);

        // 1. Pre-calculate ignored lines (e.g., comments)
        const ignoredLines = this.findIgnoredLines(text, doc);

        // 2. Prepare buckets for ranges
        const ranges: vscode.Range[][] = Array.from({ length: this.decorators.length }, () => []);
        const errorRanges: vscode.Range[] = [];
        const mixRanges: vscode.Range[] = [];

        // 3. Main Parsing Loop
        this.indentRegex.lastIndex = 0; // Reset RegExp state
        let match: RegExpExecArray | null;

        while ((match = this.indentRegex.exec(text)) !== null) {
            const matchText = match[0];
            if (matchText.length === 0) continue;

            const matchIndex = match.index;
            const startPos = doc.positionAt(matchIndex);

            // Skip ignored lines (comments, etc.)
            if (ignoredLines.has(startPos.line)) continue;

            // Detect Mixed Indentation (Tabs + Spaces)
            const hasTabs = matchText.includes('\t');
            const hasSpaces = matchText.includes(' ');

            if (hasTabs && hasSpaces && this.mixDecorator) {
                const endPos = doc.positionAt(matchIndex + matchText.length);
                mixRanges.push(new vscode.Range(startPos, endPos));
            }

            // Calculate Visual Indentation
            const { visualWidth, blockRanges } = this.calculateRainbowBlocks(
                matchText,
                matchIndex,
                tabSize,
                doc
            );

            // Logic: Always distribute blocks to rainbow colors (Underlay)
            for (let i = 0; i < blockRanges.length; i++) {
                const colorIndex = i % this.decorators.length;
                ranges[colorIndex].push(blockRanges[i]);
            }

            // Detect Indentation Errors (Overlay)
            if (!skipErrors && visualWidth % tabSize !== 0 && this.errorDecorator) {
                const endPos = doc.positionAt(matchIndex + matchText.length);
                errorRanges.push(new vscode.Range(startPos, endPos));
            }
        }

        // 4. Batch Apply Decorators
        this.decorators.forEach((dec, i) => editor.setDecorations(dec, ranges[i]));
        if (this.errorDecorator) editor.setDecorations(this.errorDecorator, errorRanges);
        if (this.mixDecorator) editor.setDecorations(this.mixDecorator, mixRanges);
    }

    /**
     * Helpers
     */

    private getTabSize(editor: vscode.TextEditor): number {
        // 1. Try Editor specific tab size
        const tabSizeRaw = editor.options.tabSize;
        if (typeof tabSizeRaw === 'number') {
            return tabSizeRaw > 0 ? tabSizeRaw : 4;
        }
        if (typeof tabSizeRaw === 'string') {
            const parsed = parseInt(tabSizeRaw, 10);
            if (!isNaN(parsed)) return parsed > 0 ? parsed : 4;
        }

        // 2. Try Global User/Workspace configuration
        const globalTabSize = vscode.workspace.getConfiguration('editor').get<number>('tabSize');
        if (globalTabSize && globalTabSize > 0) {
            return globalTabSize;
        }

        // 3. Fallback
        return 4;
    }

    private findIgnoredLines(text: string, doc: vscode.TextDocument): Set<number> {
        const ignoredLines = new Set<number>();
        if (this.ignorePatterns.length === 0) return ignoredLines;

        for (const pattern of this.ignorePatterns) {
            pattern.lastIndex = 0; // Reset state
            let match: RegExpExecArray | null;
            while ((match = pattern.exec(text)) !== null) {
                const startLine = doc.positionAt(match.index).line;
                const endLine = doc.positionAt(match.index + match[0].length).line;
                for (let i = startLine; i <= endLine; i++) {
                    ignoredLines.add(i);
                }
            }
        }
        return ignoredLines;
    }

    /**
     * Core logic to map string characters to visual indentation blocks
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

            // Calculate how wide this character is visually
            // Tabs jump to the next multiple of tabSize
            const charVisualWidth = isTab
                ? tabSize - (visualWidth % tabSize)
                : 1;

            visualWidth += charVisualWidth;

            // Check if we have completed a "tabSize" block visually
            // A block is complete when visualWidth hits a multiple of tabSize
            if (visualWidth > 0 && visualWidth % tabSize === 0) {
                const blockEndCharIndex = i + 1; // The char at 'i' completed the block

                const startPos = doc.positionAt(startIndex + currentBlockStartCharIndex);
                const endPos = doc.positionAt(startIndex + blockEndCharIndex);

                blockRanges.push(new vscode.Range(startPos, endPos));

                // Reset for next block
                currentBlockStartCharIndex = blockEndCharIndex;
            }
        }

        return { visualWidth, blockRanges };
    }
}