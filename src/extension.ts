import * as vscode from 'vscode';
import { IndentSpectra } from './IndentSpectra';

let indentSpectra: IndentSpectra | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // Initialize extension
    indentSpectra = new IndentSpectra();

    context.subscriptions.push(
        // 1. When switching tabs
        vscode.window.onDidChangeActiveTextEditor(
            (editor) => {
                if (editor) {
                    indentSpectra?.triggerUpdate();
                }
            }
        ),

        // 2. When typing/pasting content
        vscode.workspace.onDidChangeTextDocument(
            (event) => {
                const activeEditor = vscode.window.activeTextEditor;
                if (activeEditor && event.document === activeEditor.document) {
                    indentSpectra?.triggerUpdate();
                }
            }
        ),

        // 3. When the language changes (e.g. auto-detect after paste)
        vscode.workspace.onDidOpenTextDocument(
            (doc) => {
                const activeEditor = vscode.window.activeTextEditor;
                if (activeEditor && doc === activeEditor.document) {
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

    // Initial render for currently active editor
    if (vscode.window.activeTextEditor) {
        indentSpectra.triggerUpdate();
    }
}

export function deactivate(): void {
    indentSpectra?.dispose();
    indentSpectra = undefined;
}
