import * as vscode from 'vscode';
import { IndentSpectra } from './IndentSpectra';

let indentSpectra: IndentSpectra | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    indentSpectra = new IndentSpectra();

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(
            () => {
                indentSpectra?.triggerUpdate();
            }
        ),

        vscode.window.onDidChangeTextEditorOptions(
            (event) => {
                if (vscode.window.visibleTextEditors.some(editor => editor === event.textEditor)) {
                    indentSpectra?.triggerUpdate();
                }
            }
        ),

        vscode.workspace.onDidChangeTextDocument(
            (event) => {
                if (vscode.window.visibleTextEditors.some(editor => editor.document === event.document)) {
                    indentSpectra?.triggerUpdate();
                }
            }
        ),

        vscode.workspace.onDidOpenTextDocument(
            (doc) => {
                if (vscode.window.visibleTextEditors.some(editor => editor.document === doc)) {
                    indentSpectra?.triggerUpdate();
                }
            }
        ),

        vscode.workspace.onDidChangeConfiguration(
            (event) => {
                if (event.affectsConfiguration('indentSpectra')) {
                    indentSpectra?.reloadConfig();
                }
            }
        ),

        indentSpectra
    );

    indentSpectra.triggerUpdate();
}

export function deactivate(): void {
    indentSpectra?.dispose();
    indentSpectra = undefined;
}
