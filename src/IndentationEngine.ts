export interface LineAnalysis {
    /**
     * Character positions (0-indexed) where indent boundaries occur.
     * Each value represents the position after which a new indent level starts.
     * For example: [4, 8] means indent boundaries after characters 4 and 8.
     * Used to create Range objects for decoration rendering.
     */
    blocks: number[];
    /** Total visual width of indentation accounting for tab expansion */
    visualWidth: number;
    /** Whether the line contains mixed tabs and spaces in indentation */
    isMixed: boolean;
    /** Whether the indentation is malformed (not aligned to tab size) */
    isError: boolean;
    /** Whether the line should be ignored based on ignore patterns */
    isIgnored: boolean;
}

const TAB_CHAR_CODE = 9;
const SPACE_CHAR_CODE = 32;

export class IndentationEngine {
    public static analyzeLine(
        text: string,
        tabSize: number,
        skipErrors: boolean,
        isIgnored: boolean,
    ): LineAnalysis {
        if (isIgnored) {
            return {
                blocks: [],
                visualWidth: 0,
                isMixed: false,
                isError: false,
                isIgnored: true,
            };
        }

        const len = text.length;
        if (len === 0) {
            return {
                blocks: [],
                visualWidth: 0,
                isMixed: false,
                isError: false,
                isIgnored: false,
            };
        }

        // Fast check for non-indented lines to avoid array allocation
        const firstChar = text.charCodeAt(0);
        if (firstChar !== SPACE_CHAR_CODE && firstChar !== TAB_CHAR_CODE) {
            return {
                blocks: [],
                visualWidth: 0,
                isMixed: false,
                isError: false,
                isIgnored: false,
            };
        }

        const blocks: number[] = [];
        let visualWidth = 0;
        let hasTab = false;
        let hasSpace = false;
        let i = 0;

        let nextTabBoundary = tabSize;

        for (; i < len; i++) {
            const charCode = text.charCodeAt(i);

            if (charCode === SPACE_CHAR_CODE) {
                hasSpace = true;
                visualWidth++;
                if (visualWidth === nextTabBoundary) {
                    blocks.push(i + 1);
                    nextTabBoundary += tabSize;
                }
            } else if (charCode === TAB_CHAR_CODE) {
                hasTab = true;
                visualWidth = nextTabBoundary;
                blocks.push(i + 1);
                nextTabBoundary += tabSize;
            } else {
                break;
            }
        }

        const isMixed = hasTab && hasSpace;

        // Check alignment
        const isAligned = visualWidth === nextTabBoundary - tabSize;
        const isError = hasTab && visualWidth > 0 && !isAligned && !skipErrors;

        if (isError) {
            blocks.push(i);
        }

        return {
            blocks,
            visualWidth,
            isMixed,
            isError,
            isIgnored: false,
        };
    }
}
