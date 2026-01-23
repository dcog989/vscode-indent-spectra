import * as vscode from 'vscode';
import { ColorUtils } from './ColorUtils';
import { ColorThemeKind } from './colors';
import type { IndentSpectraConfig } from './ConfigurationManager';

export interface DecorationOptions {
    color: string;
    isActive: boolean;
    indicatorStyle: 'classic' | 'light';
    lightIndicatorWidth: number;
    isLightTheme: boolean;
}

export interface DecorationResult {
    decorationType: vscode.TextEditorDecorationType;
    hash: number;
}

export class DecorationFactory {
    public static createDecorationType(
        options: DecorationOptions,
    ): vscode.TextEditorDecorationType {
        const renderOptions = this.createRenderOptions(options);
        return vscode.window.createTextEditorDecorationType(renderOptions);
    }

    public static createRenderOptions(options: DecorationOptions): vscode.DecorationRenderOptions {
        if (options.indicatorStyle === 'light') {
            const width =
                options.isActive && options.color
                    ? options.lightIndicatorWidth + 1
                    : options.lightIndicatorWidth;
            return {
                borderWidth: `0 0 0 ${width}px`,
                borderStyle: 'solid',
                borderColor: options.color,
            };
        }
        return { backgroundColor: options.color };
    }

    public static hashDecorationOptions(options: DecorationOptions): number {
        let hash = 5381;
        hash = (hash << 5) + hash + options.color.length;
        for (let i = 0; i < options.color.length; i++) {
            hash = (hash << 5) + hash + options.color.charCodeAt(i);
        }
        hash = (hash << 5) + hash + (options.isActive ? 1 : 0);
        hash = (hash << 5) + hash + options.lightIndicatorWidth;
        hash = (hash << 5) + hash + (options.indicatorStyle === 'light' ? 1 : 0);
        hash = (hash << 5) + hash + (options.isLightTheme ? 1 : 0);
        return hash >>> 0;
    }

    public static createSpectrumDecorations(
        config: IndentSpectraConfig,
        themeKind: vscode.ColorThemeKind,
    ): vscode.TextEditorDecorationType[] {
        const isLightTheme = themeKind === vscode.ColorThemeKind.Light;

        return config.colors.map((color) => {
            const options: DecorationOptions = {
                color,
                isActive: false,
                indicatorStyle: config.indicatorStyle,
                lightIndicatorWidth: config.lightIndicatorWidth,
                isLightTheme,
            };
            return this.createDecorationType(options);
        });
    }

    public static createActiveSpectrumDecorations(
        config: IndentSpectraConfig,
        themeKind: vscode.ColorThemeKind,
    ): vscode.TextEditorDecorationType[] {
        if (config.activeIndentBrightness <= 0) {
            return [];
        }

        const isLightTheme = themeKind === vscode.ColorThemeKind.Light;

        return config.colors.map((color) => {
            const brightenedColor = ColorUtils.brightenColor(
                color,
                config.activeIndentBrightness,
                isLightTheme,
            );
            const options: DecorationOptions = {
                color: brightenedColor,
                isActive: true,
                indicatorStyle: config.indicatorStyle,
                lightIndicatorWidth: config.lightIndicatorWidth,
                isLightTheme,
            };
            return this.createDecorationType(options);
        });
    }

    public static createErrorDecoration(
        config: IndentSpectraConfig,
    ): vscode.TextEditorDecorationType | null {
        if (!config.errorColor) {
            return null;
        }
        return vscode.window.createTextEditorDecorationType({
            backgroundColor: config.errorColor,
        });
    }

    public static createMixDecoration(
        config: IndentSpectraConfig,
    ): vscode.TextEditorDecorationType | null {
        if (!config.mixColor) {
            return null;
        }
        return vscode.window.createTextEditorDecorationType({
            backgroundColor: config.mixColor,
        });
    }
}
