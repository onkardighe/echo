import * as vscode from 'vscode';
import { AudioCallPanel } from '../webview/AudioCallPanel';

export async function joinCallCommand(context: vscode.ExtensionContext) {
    AudioCallPanel.createOrShow(context.extensionUri);
    // Could toggle the "Join" section visibility here if we had messaging setup for it.
}
