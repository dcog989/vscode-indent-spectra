export interface CompiledPattern {
    source: string;
    flags: string;
}

export class PatternCompiler {
    public static compile(patterns: string[]): CompiledPattern[] {
        return patterns
            .map((pattern) => this.compilePattern(pattern))
            .filter((result): result is CompiledPattern => result !== null);
    }

    private static compilePattern(pattern: string): CompiledPattern | null {
        try {
            let source = pattern;
            let flags = '';

            const match = pattern.match(/^\/(.+)\/([a-z]*)$/i);
            if (match) {
                source = match[1];
                flags = match[2];
            }

            const flagSet = new Set(flags.toLowerCase().split(''));
            flagSet.add('g');
            flagSet.add('m');

            return {
                source,
                flags: Array.from(flagSet).join(''),
            };
        } catch {
            return null;
        }
    }

    public static createRegExp(pattern: CompiledPattern): RegExp {
        return new RegExp(pattern.source, pattern.flags);
    }
}
