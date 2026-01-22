import * as vscode from 'vscode';
import { IndentSpectra } from './IndentSpectra';

let indentSpectra: IndentSpectra | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    indentSpectra = new IndentSpectra();

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(
            (editor) => {
                if (editor) {
                    indentSpectra?.clearAppliedState(editor.document.uri);
                }
                indentSpectra?.triggerUpdate(undefined, true);
            }
        ),

        vscode.window.onDidChangeTextEditorOptions(
            (event) => {
                if (vscode.window.visibleTextEditors.some(editor => editor === event.textEditor)) {
                    indentSpectra?.triggerUpdate();
                }
            }
        ),

        vscode.window.onDidChangeTextEditorVisibleRanges(
            (event) => {
                if (vscode.window.visibleTextEditors.some(editor => editor === event.textEditor)) {
                    indentSpectra?.triggerUpdate();
                }
            }
        ),

        vscode.window.onDidChangeTextEditorSelection(
            (event) => {
                if (vscode.window.visibleTextEditors.some(editor => editor === event.textEditor)) {
                    indentSpectra?.triggerUpdate();
                }
            }
        ),

        vscode.workspace.onDidChangeTextDocument(
            (event) => {
                const isVisible = vscode.window.visibleTextEditors.some(e => e.document === event.document);
                if (isVisible) {
                    indentSpectra?.triggerUpdate(event);
                } else {
                    indentSpectra?.clearCache(event.document.uri);
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

        vscode.workspace.onDidCloseTextDocument(
            (doc) => {
                indentSpectra?.clearCache(doc.uri);
            }
        ),

        vscode.workspace.onDidChangeConfiguration(
            (event) => {
                if (event.affectsConfiguration('indentSpectra')) {
                    indentSpectra?.reloadConfig();
                }
            }
        ),

        vscode.window.onDidChangeActiveColorTheme(
            () => {
                indentSpectra?.handleThemeChange();
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
