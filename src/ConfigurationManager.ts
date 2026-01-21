import * as vscode from 'vscode';
import { CSS_NAMED_COLORS, PALETTES, type PaletteKey } from './colors';

const HEX_COLOR_REGEX = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGBA_COLOR_REGEX =
    /^rgba?\(\s*\d{1,3}%?\s*,\s*\d{1,3}%?\s*,\s*\d{1,3}%?\s*(?:,\s*(?:0|1|0?\.\d+|\d{1,3}%?)\s*)?\)$/i;

export interface IndentSpectraConfig {
    updateDelay: number;
    colorPreset: PaletteKey | 'custom';
    colors: string[];
    errorColor: string;
    mixColor: string;
    ignorePatterns: string[];
    compiledPatterns: RegExp[];
    ignoredLanguages: Set<string>;
    ignoreErrorLanguages: Set<string>;
    indicatorStyle: 'classic' | 'light';
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

        let indicatorStyle = config.get<string>('indicatorStyle', 'classic');
        if (indicatorStyle !== 'classic' && indicatorStyle !== 'light') {
            indicatorStyle = 'classic';
        }

        this.config = {
            updateDelay: Math.max(10, config.get<number>('updateDelay', 100)),
            colorPreset: rawPreset,
            colors: sanitizedColors,
            errorColor: this.sanitizeColor(config.get<string>('errorColor', '')),
            mixColor: this.sanitizeColor(config.get<string>('mixColor', '')),
            ignorePatterns: config.get<string[]>('ignorePatterns', []),
            compiledPatterns: this.compilePatterns(config.get<string[]>('ignorePatterns', [])),
            ignoredLanguages: new Set(config.get<string[]>('ignoredLanguages', [])),
            ignoreErrorLanguages: new Set(config.get<string[]>('ignoreErrorLanguages', [])),
            indicatorStyle: indicatorStyle as 'classic' | 'light',
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
            const valid = customColors.filter((c) => this.isValidColor(c));
            return valid.length > 0 ? valid : PALETTES.universal;
        }
        return PALETTES[preset] ?? PALETTES.universal;
    }

    private sanitizeColor(color: string): string {
        return this.isValidColor(color) ? color : '';
    }

    private isValidColor(color: string): boolean {
        if (!color || typeof color !== 'string') return false;
        const trimmed = color.trim();
        return (
            HEX_COLOR_REGEX.test(trimmed) ||
            RGBA_COLOR_REGEX.test(trimmed) ||
            CSS_NAMED_COLORS.has(trimmed.toLowerCase())
        );
    }

    private compilePatterns(patterns: string[]): RegExp[] {
        return patterns
            .map((p) => {
                try {
                    let source = p;
                    let flags = '';
                    const match = p.match(/^\/(.+)\/([a-z]*)$/i);
                    if (match) {
                        source = match[1];
                        flags = match[2];
                    }
                    const flagSet = new Set(flags.toLowerCase().split(''));
                    flagSet.add('g');
                    flagSet.add('m');
                    return new RegExp(source, Array.from(flagSet).join(''));
                } catch {
                    return null;
                }
            })
            .filter((r): r is RegExp => r !== null);
    }

    public dispose(): void {
        this._onDidChangeConfig.dispose();
    }
}
