import type * as vscode from 'vscode';
import { ColorUtils } from './ColorUtils';
import { DecorationFactory } from './DecorationFactory';
import type { IndentSpectraConfig } from './ConfigurationManager';
import { ConfigUtils } from './ConfigUtils';

interface DecorationState {
    spectraHashes: number[];
    activeLevelSpectraHashes: number[];
    errorsHash: number;
    mixedHash: number;
    documentVersion: number;
    isDirty: boolean;
}

export class DecorationManager implements vscode.Disposable {
    private decorationSuites = new Map<string, DecorationSuite>();
    private currentSuite?: DecorationSuite;
    private currentConfigKey: string = '';
    private currentThemeKind: vscode.ColorThemeKind;

    constructor(themeKind: vscode.ColorThemeKind) {
        this.currentThemeKind = themeKind;
    }

    public getOrCreateSuite(
        config: IndentSpectraConfig,
        themeKind: vscode.ColorThemeKind,
    ): DecorationSuite {
        const configKey = this.computeConfigKey(config);

        // If theme or config changed, clear existing suites
        if (configKey !== this.currentConfigKey || themeKind !== this.currentThemeKind) {
            this.currentSuite = undefined;
            this.disposeAllSuites();
            this.currentConfigKey = configKey;
            this.currentThemeKind = themeKind;
        }

        if (!this.currentSuite) {
            this.currentSuite = new DecorationSuite(config, themeKind);
            const suiteKey = `${configKey}|${themeKind}`;
            this.decorationSuites.set(suiteKey, this.currentSuite);
        }

        return this.currentSuite;
    }

    public getCurrentSuite(): DecorationSuite | undefined {
        return this.currentSuite;
    }

    public disposeSuitesForConfig(config: IndentSpectraConfig): void {
        const configKey = this.computeConfigKey(config);
        const keysToDispose: string[] = [];

        for (const [key] of this.decorationSuites) {
            if (key.startsWith(configKey)) {
                keysToDispose.push(key);
            }
        }

        for (const key of keysToDispose) {
            const suite = this.decorationSuites.get(key);
            if (suite) {
                suite.dispose();
                this.decorationSuites.delete(key);
            }
        }

        if (keysToDispose.length > 0) {
            this.currentSuite = undefined;
        }
    }

    public disposeAllSuites(): void {
        for (const suite of this.decorationSuites.values()) {
            suite.dispose();
        }
        this.decorationSuites.clear();
        this.currentSuite = undefined;
    }

    private computeConfigKey(config: IndentSpectraConfig): string {
        return ConfigUtils.computeConfigKey(config);
    }

    public dispose(): void {
        this.disposeAllSuites();
    }
}

export class DecorationSuite implements vscode.Disposable {
    private decorators: vscode.TextEditorDecorationType[] = [];
    private activeLevelDecorators: vscode.TextEditorDecorationType[] = [];
    private errorDecorator?: vscode.TextEditorDecorationType;
    private mixDecorator?: vscode.TextEditorDecorationType;
    private lastState = new Map<string, DecorationState>();

    // Persistent decoration state for entire document
    private documentDecorations = new Map<
        string,
        {
            spectra: vscode.Range[][];
            activeLevelSpectra: vscode.Range[][];
            errors: vscode.Range[];
            mixed: vscode.Range[];
        }
    >();

    constructor(config: IndentSpectraConfig, themeKind: vscode.ColorThemeKind) {
        this.initialize(config, themeKind);
    }

    private initialize(config: IndentSpectraConfig, themeKind: vscode.ColorThemeKind): void {
        this.decorators = DecorationFactory.createSpectrumDecorations(config, themeKind);
        this.activeLevelDecorators = DecorationFactory.createActiveSpectrumDecorations(
            config,
            themeKind,
        );
        this.errorDecorator = DecorationFactory.createErrorDecoration(config) ?? undefined;
        this.mixDecorator = DecorationFactory.createMixDecoration(config) ?? undefined;
    }

    private rangeHashCache = new WeakMap<vscode.Range[], number>();

    private hashRanges(ranges: vscode.Range[]): number {
        if (ranges.length === 0) return 0;

        // Check cache first
        const cached = this.rangeHashCache.get(ranges);
        if (cached !== undefined) return cached;

        // Simple hash: combine line numbers and positions
        let hash = ranges.length * 31;
        for (const range of ranges) {
            hash = (hash << 5) - hash + range.start.line;
            hash = (hash << 5) - hash + range.start.character;
            hash = (hash << 5) - hash + range.end.line;
            hash = (hash << 5) - hash + range.end.character;
        }
        const result = hash >>> 0; // Convert to unsigned 32-bit

        // Cache the result
        this.rangeHashCache.set(ranges, result);
        return result;
    }

    public apply(
        editor: vscode.TextEditor,
        spectra: vscode.Range[][],
        activeLevelSpectra: vscode.Range[][],
        errors: vscode.Range[],
        mixed: vscode.Range[],
        processedLines?: Set<number>,
        forceUpdate: boolean = false,
    ): void {
        const editorKey = editor.document.uri.toString();
        const lastState = this.lastState.get(editorKey);
        const currentVersion = editor.document.version;

        // Get or initialize persistent decoration state
        let docDecorations = this.documentDecorations.get(editorKey);
        if (!docDecorations || forceUpdate) {
            docDecorations = {
                spectra: Array.from({ length: this.decorators.length }, () => []),
                activeLevelSpectra: Array.from(
                    { length: this.activeLevelDecorators.length },
                    () => [],
                ),
                errors: [],
                mixed: [],
            };
            this.documentDecorations.set(editorKey, docDecorations);
        }

        // If we have processed lines, merge decorations intelligently
        if (processedLines && processedLines.size > 0) {
            // Remove decorations for processed lines from existing state
            for (let i = 0; i < docDecorations.spectra.length; i++) {
                docDecorations.spectra[i] = docDecorations.spectra[i].filter(
                    (range) => !processedLines.has(range.start.line),
                );
            }
            for (let i = 0; i < docDecorations.activeLevelSpectra.length; i++) {
                docDecorations.activeLevelSpectra[i] = docDecorations.activeLevelSpectra[i].filter(
                    (range) => !processedLines.has(range.start.line),
                );
            }
            docDecorations.errors = docDecorations.errors.filter(
                (range) => !processedLines.has(range.start.line),
            );
            docDecorations.mixed = docDecorations.mixed.filter(
                (range) => !processedLines.has(range.start.line),
            );

            // Add new decorations for processed lines
            for (let i = 0; i < spectra.length; i++) {
                docDecorations.spectra[i].push(...spectra[i]);
            }
            for (let i = 0; i < activeLevelSpectra.length; i++) {
                docDecorations.activeLevelSpectra[i].push(...activeLevelSpectra[i]);
            }
            docDecorations.errors.push(...errors);
            docDecorations.mixed.push(...mixed);
        } else {
            // Full replacement
            docDecorations.spectra = spectra;
            docDecorations.activeLevelSpectra = activeLevelSpectra;
            docDecorations.errors = errors;
            docDecorations.mixed = mixed;
        }

        const newState: DecorationState = {
            spectraHashes: docDecorations.spectra.map(this.hashRanges.bind(this)),
            activeLevelSpectraHashes: docDecorations.activeLevelSpectra.map(
                this.hashRanges.bind(this),
            ),
            errorsHash: this.hashRanges(docDecorations.errors),
            mixedHash: this.hashRanges(docDecorations.mixed),
            documentVersion: currentVersion,
            isDirty: forceUpdate || lastState?.documentVersion !== currentVersion,
        };

        // Only reapply decorations if state is dirty or hashes have changed
        const shouldUpdateAll = newState.isDirty || !lastState;

        if (shouldUpdateAll) {
            // Update all decorations with complete document state
            for (let i = 0; i < this.decorators.length; i++) {
                editor.setDecorations(this.decorators[i], docDecorations.spectra[i]);
            }
            for (let i = 0; i < this.activeLevelDecorators.length; i++) {
                editor.setDecorations(
                    this.activeLevelDecorators[i],
                    docDecorations.activeLevelSpectra[i],
                );
            }
            if (this.errorDecorator) {
                editor.setDecorations(this.errorDecorator, docDecorations.errors);
            }
            if (this.mixDecorator) {
                editor.setDecorations(this.mixDecorator, docDecorations.mixed);
            }
        } else {
            // Only update decorations whose hashes have changed
            for (let i = 0; i < this.decorators.length; i++) {
                if (lastState.spectraHashes[i] !== newState.spectraHashes[i]) {
                    editor.setDecorations(this.decorators[i], docDecorations.spectra[i]);
                }
            }
            for (let i = 0; i < this.activeLevelDecorators.length; i++) {
                if (
                    lastState.activeLevelSpectraHashes[i] !== newState.activeLevelSpectraHashes[i]
                ) {
                    editor.setDecorations(
                        this.activeLevelDecorators[i],
                        docDecorations.activeLevelSpectra[i],
                    );
                }
            }
            if (this.errorDecorator && lastState.errorsHash !== newState.errorsHash) {
                editor.setDecorations(this.errorDecorator, docDecorations.errors);
            }
            if (this.mixDecorator && lastState.mixedHash !== newState.mixedHash) {
                editor.setDecorations(this.mixDecorator, docDecorations.mixed);
            }
        }

        // Clear dirty flag after applying
        newState.isDirty = false;
        this.lastState.set(editorKey, newState);
    }

    public clearState(uri: vscode.Uri): void {
        const uriString = uri.toString();
        this.lastState.delete(uriString);
        this.documentDecorations.delete(uriString);
    }

    public getDecoratorCount(): number {
        return this.decorators.length;
    }

    public dispose(): void {
        this.decorators.forEach((d) => d.dispose());
        this.decorators = [];
        this.activeLevelDecorators.forEach((d) => d.dispose());
        this.activeLevelDecorators = [];
        this.errorDecorator?.dispose();
        this.errorDecorator = undefined;
        this.mixDecorator?.dispose();
        this.mixDecorator = undefined;
        this.lastState.clear();
        this.documentDecorations.clear();
        this.rangeHashCache = new WeakMap();
        ColorUtils.clearBrightnessCache();
    }
}
