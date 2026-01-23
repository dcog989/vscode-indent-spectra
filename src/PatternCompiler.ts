export interface CompiledPattern {
    source: string;
    flags: string;
}

export class PatternCompiler {
    private static regexCache = new Map<string, RegExp>();

    public static compile(patterns: string[], addGlobal: boolean = false): CompiledPattern[] {
        return patterns
            .map((pattern) => this.compilePattern(pattern, addGlobal))
            .filter((result): result is CompiledPattern => result !== null);
    }

    private static compilePattern(
        pattern: string,
        addGlobal: boolean = false,
    ): CompiledPattern | null {
        try {
            let source = pattern;
            let flags = '';

            const match = pattern.match(/^\/(.+)\/([a-z]*)$/i);
            if (match) {
                source = match[1];
                flags = match[2];
            }

            // Validate flags against standard set (gimuybs)
            const validFlags = new Set(['g', 'i', 'm', 'u', 'y', 'b', 's']);
            const providedFlags = flags.toLowerCase().split('');

            for (const flag of providedFlags) {
                if (!validFlags.has(flag)) {
                    return null; // Invalid flag found
                }
            }

            const flagSet = new Set(providedFlags);
            if (addGlobal) {
                flagSet.add('g');
            }
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
        const cacheKey = `${pattern.source}|${pattern.flags}`;

        // Check cache first
        const cached = this.regexCache.get(cacheKey);
        if (cached !== undefined) return cached;

        // Create and cache new regex
        const regex = new RegExp(pattern.source, pattern.flags);
        this.regexCache.set(cacheKey, regex);
        return regex;
    }

    public static clearCache(): void {
        this.regexCache.clear();
    }
}
