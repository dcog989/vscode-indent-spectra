import * as vscode from 'vscode';
import { IndentSpectra } from './IndentSpectra';

let indentSpectra: IndentSpectra | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    indentSpectra = new IndentSpectra();

    const triggerIfVisible = (textEditor: vscode.TextEditor): void => {
        if (vscode.window.visibleTextEditors.includes(textEditor)) {
            indentSpectra?.triggerUpdate();
        }
    };

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor) {
                indentSpectra?.clearAppliedState(editor.document.uri);
                indentSpectra?.checkAndUpdateDirtyDocument(editor.document.uri);
            }
            indentSpectra?.triggerUpdate(undefined, true);
        }),

        vscode.window.onDidChangeTextEditorOptions((event) => triggerIfVisible(event.textEditor)),

        vscode.window.onDidChangeTextEditorVisibleRanges((event) =>
            triggerIfVisible(event.textEditor),
        ),

        vscode.window.onDidChangeTextEditorSelection((event) => triggerIfVisible(event.textEditor)),

        vscode.workspace.onDidChangeTextDocument((event) => {
            const isVisible = vscode.window.visibleTextEditors.some(
                (e) => e.document === event.document,
            );
            if (isVisible) {
                indentSpectra?.triggerUpdate(event);
            } else {
                indentSpectra?.clearCache(event.document.uri);
            }
        }),

        vscode.workspace.onDidOpenTextDocument((doc) => {
            if (vscode.window.visibleTextEditors.some((editor) => editor.document === doc)) {
                indentSpectra?.triggerUpdate();
            }
        }),

        vscode.workspace.onDidCloseTextDocument((doc) => {
            indentSpectra?.clearCache(doc.uri);
        }),

        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('indentSpectra')) {
                indentSpectra?.reloadConfig();
            }
        }),

        vscode.window.onDidChangeActiveColorTheme(() => {
            indentSpectra?.handleThemeChange();
        }),

        indentSpectra,
    );

    indentSpectra.triggerUpdate();
}

export function deactivate(): void {
    indentSpectra?.dispose();
    indentSpectra = undefined;
}
