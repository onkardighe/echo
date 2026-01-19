import * as vscode from 'vscode';
import { AudioCallPanel } from '../webview/AudioCallPanel';

export async function startCallCommand(context: vscode.ExtensionContext) {
    AudioCallPanel.createOrShow(context.extensionUri);
    // Optionally send a message to UI to trigger 'start' automatically?
    // User might just want to open the panel.
    // Spec says: "Create an offer and show local connection data"
    // So we should probably tell the webview "Auto Start".
    // But for now, opening the panel is the first step.
}
