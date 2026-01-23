import * as vscode from 'vscode';
import { brightenColor, ColorThemeKind } from './colors';
import type { IndentSpectraConfig } from './ConfigurationManager';

export class DecorationSuite implements vscode.Disposable {
    private decorators: vscode.TextEditorDecorationType[] = [];
    private activeLevelDecorators: vscode.TextEditorDecorationType[] = [];
    private errorDecorator?: vscode.TextEditorDecorationType;
    private mixDecorator?: vscode.TextEditorDecorationType;

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
                const brightColor = brightenColor(
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

    public apply(
        editor: vscode.TextEditor,
        spectra: vscode.Range[][],
        activeLevelSpectra: vscode.Range[][],
        errors: vscode.Range[],
        mixed: vscode.Range[],
    ): void {
        this.decorators.forEach((dec, i) => editor.setDecorations(dec, spectra[i]));

        if (this.activeLevelDecorators.length > 0) {
            this.activeLevelDecorators.forEach((dec, i) =>
                editor.setDecorations(dec, activeLevelSpectra[i]),
            );
        }

        if (this.errorDecorator) {
            editor.setDecorations(this.errorDecorator, errors);
        }

        if (this.mixDecorator) {
            editor.setDecorations(this.mixDecorator, mixed);
        }
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
    }
}
