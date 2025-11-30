import * as vscode from 'vscode';
import { IndentSpectra } from './IndentSpectra';

let indentSpectra: IndentSpectra | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // Initialize extension
    indentSpectra = new IndentSpectra();

    context.subscriptions.push(
        // 1. When switching tabs or focus
        vscode.window.onDidChangeActiveTextEditor(
            () => {
                indentSpectra?.triggerUpdate();
            }
        ),

        // 2. When typing/pasting content
        vscode.workspace.onDidChangeTextDocument(
            (event) => {
                // Trigger update if the changed document is visible in any editor (supports split view)
                if (vscode.window.visibleTextEditors.some(editor => editor.document === event.document)) {
                    indentSpectra?.triggerUpdate();
                }
            }
        ),

        // 3. When the language changes (e.g. auto-detect after paste)
        vscode.workspace.onDidOpenTextDocument(
            (doc) => {
                if (vscode.window.visibleTextEditors.some(editor => editor.document === doc)) {
                    indentSpectra?.triggerUpdate();
                }
            }
        ),

        // 4. When settings change
        vscode.workspace.onDidChangeConfiguration(
            (event) => {
                if (event.affectsConfiguration('indentSpectra')) {
                    indentSpectra?.reloadConfig();
                }
            }
        ),

        indentSpectra
    );

    // Initial render for all visible editors
    indentSpectra.triggerUpdate();
}

export function deactivate(): void {
    indentSpectra?.dispose();
    indentSpectra = undefined;
}
