import type * as vscode from 'vscode';
import type { IndentSpectraConfig } from './ConfigurationManager';

const HASH_MULTIPLIER = 31;

export class ConfigUtils {
    public static computeConfigKey(config: IndentSpectraConfig): string {
        return JSON.stringify({
            colors: config.colors,
            errorColor: config.errorColor,
            mixColor: config.mixColor,
            indicatorStyle: config.indicatorStyle,
            lightIndicatorWidth: config.lightIndicatorWidth,
            activeIndentBrightness: config.activeIndentBrightness,
        });
    }

    public static hashRanges(ranges: readonly vscode.Range[]): number {
        if (ranges.length === 0) return 0;

        let hash = ranges.length * HASH_MULTIPLIER;
        for (const range of ranges) {
            hash = (hash << 5) - hash + range.start.line;
            hash = (hash << 5) - hash + range.start.character;
            hash = (hash << 5) - hash + range.end.line;
            hash = (hash << 5) - hash + range.end.character;
        }
        return hash >>> 0;
    }
}
