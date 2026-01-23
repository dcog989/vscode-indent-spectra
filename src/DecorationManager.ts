import type * as vscode from 'vscode';
import { ColorUtils } from './ColorUtils';
import { DecorationFactory } from './DecorationFactory';
import type { IndentSpectraConfig } from './ConfigurationManager';

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
        return (
            config.colors.join(',') +
            '|' +
            config.errorColor +
            '|' +
            config.mixColor +
            '|' +
            config.indicatorStyle +
            '|' +
            config.lightIndicatorWidth +
            '|' +
            config.activeIndentBrightness
        );
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

    private hashRanges(ranges: vscode.Range[]): number {
        if (ranges.length === 0) return 0;

        let hash = 5381;
        for (const range of ranges) {
            hash = (hash << 5) + hash + range.start.line;
            hash = (hash << 5) + hash + range.start.character;
            hash = (hash << 5) + hash + range.end.line;
            hash = (hash << 5) + hash + range.end.character;
        }
        return hash >>> 0; // Convert to unsigned 32-bit
    }

    public apply(
        editor: vscode.TextEditor,
        spectra: vscode.Range[][],
        activeLevelSpectra: vscode.Range[][],
        errors: vscode.Range[],
        mixed: vscode.Range[],
        forceUpdate: boolean = false,
    ): void {
        const editorKey = editor.document.uri.toString();
        const lastState = this.lastState.get(editorKey);
        const currentVersion = editor.document.version;

        const newState: DecorationState = {
            spectraHashes: spectra.map(this.hashRanges.bind(this)),
            activeLevelSpectraHashes: activeLevelSpectra.map(this.hashRanges.bind(this)),
            errorsHash: this.hashRanges(errors),
            mixedHash: this.hashRanges(mixed),
            documentVersion: currentVersion,
            isDirty: forceUpdate || lastState?.documentVersion !== currentVersion,
        };

        // Only reapply decorations if state is dirty or hashes have changed
        const shouldUpdateAll = newState.isDirty || !lastState;

        if (shouldUpdateAll) {
            // Update all decorations
            for (let i = 0; i < this.decorators.length; i++) {
                editor.setDecorations(this.decorators[i], spectra[i]);
            }
            for (let i = 0; i < this.activeLevelDecorators.length; i++) {
                editor.setDecorations(this.activeLevelDecorators[i], activeLevelSpectra[i]);
            }
            if (this.errorDecorator) {
                editor.setDecorations(this.errorDecorator, errors);
            }
            if (this.mixDecorator) {
                editor.setDecorations(this.mixDecorator, mixed);
            }
        } else {
            // Only update decorations whose hashes have changed
            for (let i = 0; i < this.decorators.length; i++) {
                if (lastState.spectraHashes[i] !== newState.spectraHashes[i]) {
                    editor.setDecorations(this.decorators[i], spectra[i]);
                }
            }
            for (let i = 0; i < this.activeLevelDecorators.length; i++) {
                if (
                    lastState.activeLevelSpectraHashes[i] !== newState.activeLevelSpectraHashes[i]
                ) {
                    editor.setDecorations(this.activeLevelDecorators[i], activeLevelSpectra[i]);
                }
            }
            if (this.errorDecorator && lastState.errorsHash !== newState.errorsHash) {
                editor.setDecorations(this.errorDecorator, errors);
            }
            if (this.mixDecorator && lastState.mixedHash !== newState.mixedHash) {
                editor.setDecorations(this.mixDecorator, mixed);
            }
        }

        // Clear dirty flag after applying
        newState.isDirty = false;
        this.lastState.set(editorKey, newState);
    }

    public clearState(uri: vscode.Uri): void {
        this.lastState.delete(uri.toString());
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
        ColorUtils.clearBrightnessCache();
    }
}
