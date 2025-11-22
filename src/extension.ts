import * as vscode from 'vscode';
import { IndentSpectra } from './IndentSpectra';

let indentSpectra: IndentSpectra | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // Lazy instantiation
    indentSpectra = new IndentSpectra();

    // Subscribe to events using modern async patterns where applicable
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(
            (editor) => editor && indentSpectra?.triggerUpdate()
        ),
        vscode.workspace.onDidChangeTextDocument(
            (event) => {
                if (event.document === vscode.window.activeTextEditor?.document) {
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

    // Initial render
    indentSpectra.triggerUpdate();
}

export function deactivate(): void {
    indentSpectra?.dispose();
    indentSpectra = undefined;
}