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

export interface DocumentIndentData {
    blockData: number[];
    lineOffsets: Int32Array;
    metadata: Uint8Array;
}

const TAB_CHAR_CODE = 9;
const SPACE_CHAR_CODE = 32;

class LineMetadata {
    private static readonly MIXED_FLAG = 1;
    private static readonly ERROR_FLAG = 2;
    private static readonly IGNORED_FLAG = 4;

    public static encode(isMixed: boolean, isError: boolean, isIgnored: boolean): number {
        let flags = 0;
        if (isMixed) flags |= this.MIXED_FLAG;
        if (isError) flags |= this.ERROR_FLAG;
        if (isIgnored) flags |= this.IGNORED_FLAG;
        return flags;
    }

    public static setMixed(flags: number): number {
        return flags | this.MIXED_FLAG;
    }

    public static setError(flags: number): number {
        return flags | this.ERROR_FLAG;
    }

    public static setIgnored(flags: number): number {
        return flags | this.IGNORED_FLAG;
    }

    public static isMixed(flags: number): boolean {
        return (flags & this.MIXED_FLAG) !== 0;
    }

    public static isError(flags: number): boolean {
        return (flags & this.ERROR_FLAG) !== 0;
    }

    public static isIgnored(flags: number): boolean {
        return (flags & this.IGNORED_FLAG) !== 0;
    }
}

export class IndentationEngine {
    public static analyzeLine(
        text: string,
        tabSize: number,
        skipErrors: boolean,
        isIgnored: boolean,
    ): LineAnalysis {
        const blocks: number[] = [];
        let visualWidth = 0;
        let hasTab = false;
        let hasSpace = false;
        let i = 0;

        // Ensure tabSize is valid to avoid division by zero
        const safeTabSize = Math.max(1, tabSize);

        for (; i < text.length; i++) {
            const charCode = text.charCodeAt(i);

            if (charCode === TAB_CHAR_CODE) {
                hasTab = true;
                visualWidth += safeTabSize - (visualWidth % safeTabSize);
                // Create blocks at tab boundaries
                if (visualWidth % safeTabSize === 0) blocks.push(i + 1);
            } else if (charCode === SPACE_CHAR_CODE) {
                hasSpace = true;
                visualWidth++;
                // Create blocks at tabSize intervals (e.g., every 4 spaces if tabSize is 4)
                if (visualWidth % safeTabSize === 0) blocks.push(i + 1);
            } else {
                break;
            }
        }

        const isMixed = hasTab && hasSpace;
        // Only flag as error if tabs are used and indentation doesn't align to tab size
        // Pure space indentation should never be flagged as an error
        const isError = hasTab && visualWidth > 0 && visualWidth % safeTabSize !== 0 && !skipErrors;

        if (isError && visualWidth > 0) {
            blocks.push(i);
        }

        return { blocks, visualWidth, isMixed, isError, isIgnored };
    }

    public static createDocumentData(lineCount: number): DocumentIndentData {
        return {
            blockData: [],
            lineOffsets: new Int32Array(lineCount + 1),
            metadata: new Uint8Array(lineCount),
        };
    }

    public static updateDocumentLineCount(data: DocumentIndentData, newLineCount: number): void {
        if (data.lineOffsets.length !== newLineCount + 1) {
            const newLineOffsets = new Int32Array(newLineCount + 1);
            const copyLength = Math.min(data.lineOffsets.length, newLineCount + 1);
            newLineOffsets.set(data.lineOffsets.slice(0, copyLength));
            data.lineOffsets = newLineOffsets;

            const newMetadata = new Uint8Array(newLineCount);
            const metadataCopyLength = Math.min(data.metadata.length, newLineCount);
            newMetadata.set(data.metadata.slice(0, metadataCopyLength));
            data.metadata = newMetadata;
        }
    }

    public static setLineData(
        data: DocumentIndentData,
        lineIndex: number,
        analysis: LineAnalysis,
    ): void {
        if (lineIndex < 0 || lineIndex >= data.metadata.length) {
            throw new Error(
                `Line index ${lineIndex} is out of bounds for document with ${data.metadata.length} lines`,
            );
        }

        if (lineIndex + 1 >= data.lineOffsets.length) {
            throw new Error(
                `Line offset index ${lineIndex + 1} is out of bounds for document with ${data.lineOffsets.length} line offsets`,
            );
        }

        const offsetStart = data.lineOffsets[lineIndex];
        const blocks = analysis.blocks;

        for (let i = 0; i < blocks.length; i++) {
            data.blockData.push(blocks[i]);
        }

        data.lineOffsets[lineIndex + 1] = offsetStart + blocks.length;
        data.metadata[lineIndex] = LineMetadata.encode(
            analysis.isMixed,
            analysis.isError,
            analysis.isIgnored,
        );
    }

    public static getLineData(data: DocumentIndentData, lineIndex: number): LineAnalysis {
        if (lineIndex < 0 || lineIndex >= data.metadata.length) {
            throw new Error(
                `Line index ${lineIndex} is out of bounds for document with ${data.metadata.length} lines`,
            );
        }

        if (lineIndex + 1 >= data.lineOffsets.length) {
            throw new Error(
                `Line offset index ${lineIndex + 1} is out of bounds for document with ${data.lineOffsets.length} line offsets`,
            );
        }

        const offsetStart = data.lineOffsets[lineIndex];
        const offsetEnd = data.lineOffsets[lineIndex + 1];
        const blockCount = offsetEnd - offsetStart;

        const blocks: number[] = [];
        for (let i = 0; i < blockCount; i++) {
            blocks.push(data.blockData[offsetStart + i]);
        }

        const flags = data.metadata[lineIndex];
        return {
            blocks,
            visualWidth: blockCount > 0 ? blocks[blocks.length - 1] : 0,
            isMixed: LineMetadata.isMixed(flags),
            isError: LineMetadata.isError(flags),
            isIgnored: LineMetadata.isIgnored(flags),
        };
    }

    public static hasLineData(data: DocumentIndentData, lineIndex: number): boolean {
        return data.lineOffsets[lineIndex + 1] !== 0;
    }
}
