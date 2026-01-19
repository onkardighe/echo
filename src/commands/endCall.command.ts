import * as vscode from 'vscode';
import { AudioCallPanel } from '../webview/AudioCallPanel';

export async function endCallCommand(_context: vscode.ExtensionContext) {
    if (AudioCallPanel.currentPanel) {
        AudioCallPanel.currentPanel.dispose();
    } else {
        vscode.window.showInformationMessage('No active call to end.');
    }
}
