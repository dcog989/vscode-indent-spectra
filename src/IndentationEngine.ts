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

const METADATA_MIXED = 1;
const METADATA_ERROR = 2;
const METADATA_IGNORED = 4;

export class IndentationEngine {
    public static analyzeLine(
        text: string,
        tabSize: number,
        skipErrors: boolean,
        isIgnored: boolean,
    ): LineAnalysis {
        const blocks: number[] = [];
        let visualWidth = 0;
        let isMixed = false;
        let isError = false;

        const indentMatch = text.match(/^[\t ]+/);
        if (indentMatch) {
            const matchText = indentMatch[0];
            isMixed = matchText.includes('\t') && matchText.includes(' ');

            for (let i = 0; i < matchText.length; i++) {
                visualWidth += matchText[i] === '\t' ? tabSize - (visualWidth % tabSize) : 1;
                if (visualWidth % tabSize === 0) blocks.push(i + 1);
            }

            if (visualWidth % tabSize !== 0) {
                blocks.push(matchText.length);
                isError = !skipErrors;
            }
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

        let flags = 0;
        if (analysis.isMixed) flags |= METADATA_MIXED;
        if (analysis.isError) flags |= METADATA_ERROR;
        if (analysis.isIgnored) flags |= METADATA_IGNORED;
        data.metadata[lineIndex] = flags;
    }

    public static getLineData(data: DocumentIndentData, lineIndex: number): LineAnalysis {
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
            isMixed: (flags & METADATA_MIXED) !== 0,
            isError: (flags & METADATA_ERROR) !== 0,
            isIgnored: (flags & METADATA_IGNORED) !== 0,
        };
    }

    public static hasLineData(data: DocumentIndentData, lineIndex: number): boolean {
        return data.lineOffsets[lineIndex + 1] !== 0;
    }
}
