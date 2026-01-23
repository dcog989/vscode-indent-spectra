export interface LineAnalysis {
    blocks: number[];
    visualWidth: number;
    isMixed: boolean;
    isError: boolean;
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

    public static decode(flags: number): { isMixed: boolean; isError: boolean; isIgnored: boolean } {
        return {
            isMixed: (flags & this.MIXED_FLAG) !== 0,
            isError: (flags & this.ERROR_FLAG) !== 0,
            isIgnored: (flags & this.IGNORED_FLAG) !== 0,
        };
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

        for (; i < text.length; i++) {
            const charCode = text.charCodeAt(i);
            
            if (charCode === TAB_CHAR_CODE) {
                hasTab = true;
                visualWidth += tabSize - (visualWidth % tabSize);
                if (visualWidth % tabSize === 0) blocks.push(i + 1);
            } else if (charCode === SPACE_CHAR_CODE) {
                hasSpace = true;
                visualWidth++;
                if (visualWidth % tabSize === 0) blocks.push(i + 1);
            } else {
                break;
            }
        }

        const isMixed = hasTab && hasSpace;
        const isError = visualWidth > 0 && visualWidth % tabSize !== 0 && !skipErrors;

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

    public static setLineData(
        data: DocumentIndentData,
        lineIndex: number,
        analysis: LineAnalysis,
    ): void {
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
        const offsetStart = data.lineOffsets[lineIndex];
        const offsetEnd = data.lineOffsets[lineIndex + 1];
        const blockCount = offsetEnd - offsetStart;

        const blocks: number[] = [];
        for (let i = 0; i < blockCount; i++) {
            blocks.push(data.blockData[offsetStart + i]);
        }

        const decoded = LineMetadata.decode(data.metadata[lineIndex]);
        return {
            blocks,
            visualWidth: blockCount > 0 ? blocks[blocks.length - 1] : 0,
            isMixed: decoded.isMixed,
            isError: decoded.isError,
            isIgnored: decoded.isIgnored,
        };
    }

    public static hasLineData(data: DocumentIndentData, lineIndex: number): boolean {
        return data.lineOffsets[lineIndex + 1] !== 0;
    }
}
