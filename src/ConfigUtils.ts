import type { IndentSpectraConfig } from './ConfigurationManager';
import type * as vscode from 'vscode';

export class ConfigUtils {
    public static computeConfigKey(config: IndentSpectraConfig): string {
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

    public static hashRanges(ranges: readonly vscode.Range[]): number {
        if (ranges.length === 0) return 0;

        // Simple hash: combine line numbers and positions
        let hash = ranges.length * 31;
        for (const range of ranges) {
            hash = (hash << 5) - hash + range.start.line;
            hash = (hash << 5) - hash + range.start.character;
            hash = (hash << 5) - hash + range.end.line;
            hash = (hash << 5) - hash + range.end.character;
        }
        return hash >>> 0; // Convert to unsigned 32-bit
    }
}
