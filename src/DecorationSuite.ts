import * as vscode from 'vscode';
import { ColorBrightnessCache, ColorThemeKind } from './colors';
import type { IndentSpectraConfig } from './ConfigurationManager';

interface DecorationState {
    spectra: string[];
    activeLevelSpectra: string[];
    errors: string;
    mixed: string;
}

export class DecorationSuite implements vscode.Disposable {
    private decorators: vscode.TextEditorDecorationType[] = [];
    private activeLevelDecorators: vscode.TextEditorDecorationType[] = [];
    private errorDecorator?: vscode.TextEditorDecorationType;
    private mixDecorator?: vscode.TextEditorDecorationType;
    private lastState = new Map<string, DecorationState>();
    private colorCache = new ColorBrightnessCache();

    constructor(config: IndentSpectraConfig, themeKind: vscode.ColorThemeKind) {
        this.initialize(config, themeKind);
    }

    private initialize(config: IndentSpectraConfig, themeKind: vscode.ColorThemeKind): void {
        const colorThemeKind =
            themeKind === vscode.ColorThemeKind.Light ? ColorThemeKind.Light : ColorThemeKind.Dark;

        const createOptions = (
            color: string,
            isActive: boolean,
        ): vscode.DecorationRenderOptions => {
            if (config.indicatorStyle === 'light') {
                const width =
                    isActive && config.activeIndentBrightness > 0
                        ? config.lightIndicatorWidth + 1
                        : config.lightIndicatorWidth;
                return {
                    borderWidth: `0 0 0 ${width}px`,
                    borderStyle: 'solid',
                    borderColor: color,
                };
            }
            return { backgroundColor: color };
        };

        this.decorators = config.colors.map((color) =>
            vscode.window.createTextEditorDecorationType(createOptions(color, false)),
        );

        if (config.activeIndentBrightness > 0) {
            this.activeLevelDecorators = config.colors.map((color) => {
                const brightColor = this.colorCache.getBrightened(
                    color,
                    config.activeIndentBrightness,
                    colorThemeKind,
                );
                return vscode.window.createTextEditorDecorationType(
                    createOptions(brightColor, true),
                );
            });
        }

        if (config.errorColor) {
            this.errorDecorator = vscode.window.createTextEditorDecorationType({
                backgroundColor: config.errorColor,
            });
        }

        if (config.mixColor) {
            this.mixDecorator = vscode.window.createTextEditorDecorationType({
                backgroundColor: config.mixColor,
            });
        }
    }

    private serializeRanges(ranges: vscode.Range[]): string {
        if (ranges.length === 0) return '';
        return ranges.map(r => `${r.start.line},${r.start.character},${r.end.line},${r.end.character}`).join(';');
    }

    public apply(
        editor: vscode.TextEditor,
        spectra: vscode.Range[][],
        activeLevelSpectra: vscode.Range[][],
        errors: vscode.Range[],
        mixed: vscode.Range[],
    ): void {
        const editorKey = editor.document.uri.toString();
        const lastState = this.lastState.get(editorKey);

        const newState: DecorationState = {
            spectra: spectra.map(this.serializeRanges),
            activeLevelSpectra: activeLevelSpectra.map(this.serializeRanges),
            errors: this.serializeRanges(errors),
            mixed: this.serializeRanges(mixed),
        };

        for (let i = 0; i < this.decorators.length; i++) {
            if (!lastState || lastState.spectra[i] !== newState.spectra[i]) {
                editor.setDecorations(this.decorators[i], spectra[i]);
            }
        }

        for (let i = 0; i < this.activeLevelDecorators.length; i++) {
            if (!lastState || lastState.activeLevelSpectra[i] !== newState.activeLevelSpectra[i]) {
                editor.setDecorations(this.activeLevelDecorators[i], activeLevelSpectra[i]);
            }
        }

        if (this.errorDecorator && (!lastState || lastState.errors !== newState.errors)) {
            editor.setDecorations(this.errorDecorator, errors);
        }

        if (this.mixDecorator && (!lastState || lastState.mixed !== newState.mixed)) {
            editor.setDecorations(this.mixDecorator, mixed);
        }

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
        this.colorCache.clear();
    }
}
