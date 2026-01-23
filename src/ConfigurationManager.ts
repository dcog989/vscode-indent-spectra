import * as vscode from 'vscode';
import { PALETTES, type PaletteKey } from './colors';
import { ColorUtils } from './ColorUtils';
import { PatternCompiler, type CompiledPattern } from './PatternCompiler';

export enum IndicatorStyle {
    Classic = 'classic',
    Light = 'light',
}

export interface IndentSpectraConfig {
    updateDelay: number;
    colorPreset: PaletteKey | 'custom';
    colors: string[];
    errorColor: string;
    mixColor: string;
    ignorePatterns: string[];
    compiledPatterns: CompiledPattern[];
    ignoredLanguages: Set<string>;
    ignoreErrorLanguages: Set<string>;
    indicatorStyle: IndicatorStyle;
    lightIndicatorWidth: number;
    activeIndentBrightness: number;
}

export class ConfigurationManager {
    private config!: IndentSpectraConfig;
    private _onDidChangeConfig = new vscode.EventEmitter<IndentSpectraConfig>();
    public readonly onDidChangeConfig = this._onDidChangeConfig.event;

    constructor() {
        this.load();
    }

    public get current(): IndentSpectraConfig {
        return this.config;
    }

    public load(): void {
        const config = vscode.workspace.getConfiguration('indentSpectra');
        const rawPreset = config.get<PaletteKey | 'custom'>('colorPreset', 'universal');
        const rawColors = config.get<string[]>('colors', []);
        const sanitizedColors = this.resolveColors(rawPreset, rawColors);

        const rawIndicatorStyle = config.get<string>('indicatorStyle', 'classic');
        const indicatorStyle =
            rawIndicatorStyle === 'light' ? IndicatorStyle.Light : IndicatorStyle.Classic;

        this.config = {
            updateDelay: Math.max(10, config.get<number>('updateDelay', 100)),
            colorPreset: rawPreset,
            colors: sanitizedColors,
            errorColor: this.sanitizeColor(config.get<string>('errorColor', '')),
            mixColor: this.sanitizeColor(config.get<string>('mixColor', '')),
            ignorePatterns: config.get<string[]>('ignorePatterns', []),
            compiledPatterns: PatternCompiler.compile(config.get<string[]>('ignorePatterns', [])),
            ignoredLanguages: new Set(config.get<string[]>('ignoredLanguages', [])),
            ignoreErrorLanguages: new Set(config.get<string[]>('ignoreErrorLanguages', [])),
            indicatorStyle,
            lightIndicatorWidth: Math.max(1, config.get<number>('lightIndicatorWidth', 1)),
            activeIndentBrightness: Math.max(
                0,
                Math.min(9, config.get<number>('activeIndentBrightness', 2)),
            ),
        };

        this._onDidChangeConfig.fire(this.config);
    }

    private resolveColors(preset: PaletteKey | 'custom', customColors: string[]): string[] {
        if (preset === 'custom') {
            const valid = customColors.filter((c) => ColorUtils.isValidColor(c));
            return valid.length > 0 ? valid : PALETTES.universal;
        }
        return PALETTES[preset] ?? PALETTES.universal;
    }

    private sanitizeColor(color: string): string {
        return ColorUtils.sanitizeColor(color);
    }

    public createRegExp(pattern: CompiledPattern): RegExp {
        return PatternCompiler.createRegExp(pattern);
    }

    public dispose(): void {
        this._onDidChangeConfig.dispose();
    }
}
