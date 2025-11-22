import * as vscode from 'vscode';
import { IndentSpectra } from './IndentSpectra';

let indentSpectra: IndentSpectra | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // Lazy instantiation
    indentSpectra = new IndentSpectra();

    context.subscriptions.push(
        // 1. When switching tabs
        vscode.window.onDidChangeActiveTextEditor(
            (editor) => editor && indentSpectra?.triggerUpdate()
        ),

        // 2. When typing/pasting content
        vscode.workspace.onDidChangeTextDocument(
            (event) => {
                if (event.document === vscode.window.activeTextEditor?.document) {
                    indentSpectra?.triggerUpdate();
                }
            }
        ),

        // 3. When the language changes (e.g. auto-detect after paste)
        // VS Code fires onDidOpenTextDocument when languageId updates
        vscode.workspace.onDidOpenTextDocument(
            (doc) => {
                if (doc === vscode.window.activeTextEditor?.document) {
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

    // Initial render
    indentSpectra.triggerUpdate();
}

export function deactivate(): void {
    indentSpectra?.dispose();
    indentSpectra = undefined;
}