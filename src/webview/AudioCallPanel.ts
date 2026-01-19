import * as vscode from 'vscode';
import { Logger } from '../utils/Logger';
import { DisposableManager } from '../utils/DisposableManager';
import { WebviewToExtensionMessage } from '../messaging/WebviewMessage';

export class AudioCallPanel {
    public static currentPanel: AudioCallPanel | undefined;
    private static readonly viewType = 'mininetEcho.audioCall';
    private readonly panel: vscode.WebviewPanel;
    private readonly extensionUri: vscode.Uri;
    private disposables: DisposableManager;

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this.panel = panel;
        this.extensionUri = extensionUri;
        this.disposables = new DisposableManager();

        this.update();

        // Register the panel's disposal to our manager
        this.disposables.register(
            this.panel.onDidDispose(() => this.dispose())
        );

        // Register the message listener to our manager
        this.disposables.register(
            this.panel.webview.onDidReceiveMessage(
                async (message: WebviewToExtensionMessage) => {
                    switch (message.type) {
                        case 'START_CALL':
                            Logger.info('Webview requested START_CALL');
                            break;
                        case 'JOIN_CALL':
                            Logger.info('Webview requested JOIN_CALL');
                            break;
                        case 'END_CALL':
                            Logger.info('Webview requested END_CALL');
                            break;
                        case 'COPY_TO_CLIPBOARD':
                            try {
                                await vscode.env.clipboard.writeText(message.text);
                                vscode.window.showInformationMessage('Copied to clipboard!');
                            } catch (err: any) {
                                Logger.error('Failed to copy', err);
                                vscode.window.showErrorMessage('Failed to copy to clipboard.');
                            }
                            break;
                        case 'ERROR':
                            vscode.window.showErrorMessage(`Echo Error: ${message.message}`);
                            break;
                    }
                }
            )
        );
    }

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (AudioCallPanel.currentPanel) {
            AudioCallPanel.currentPanel.panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            AudioCallPanel.viewType,
            'Echo Audio Call',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'out', 'webview'),
                    vscode.Uri.joinPath(extensionUri, 'src', 'webview')
                ]
            }
        );

        AudioCallPanel.currentPanel = new AudioCallPanel(panel, extensionUri);
    }

    public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        AudioCallPanel.currentPanel = new AudioCallPanel(panel, extensionUri);
    }

    public dispose() {
        AudioCallPanel.currentPanel = undefined;
        this.panel.dispose();
        this.disposables.dispose();
    }

    private update() {
        this.panel.webview.html = this.getHtmlForWebview();
    }

    private getHtmlForWebview(): string {
        const webview = this.panel.webview;

        const scriptPathOnDisk = vscode.Uri.joinPath(this.extensionUri, 'out', 'webview', 'audioCall.js');
        const scriptUri = webview.asWebviewUri(scriptPathOnDisk);

        const stylePathOnDisk = vscode.Uri.joinPath(this.extensionUri, 'out', 'webview', 'audioCall.css');
        const styleUri = webview.asWebviewUri(stylePathOnDisk);

        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; media-src ${webview.cspSource};">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Echo Audio Call</title>
                <link href="${styleUri}" rel="stylesheet">
            </head>
            <body>
                <div class="container">
                    <h1>Echo P2P Audio</h1>
                    
                    <div id="status" class="status-badge">Idle</div>

                    <div class="actions">
                        <div id="start-section">
                            <button id="btn-start" class="primary-btn">Start Call</button>
                             <button id="btn-join-mode" class="primary-btn" onclick="document.getElementById('join-section').classList.remove('hidden'); this.classList.add('hidden');">Join Existing Call</button>
                        </div>

                        <div id="join-section" class="hidden">
                             <p>Paste the Offer you received:</p>
                            <textarea id="remote-sdp-input" placeholder="Paste Remote SDP here..."></textarea>
                            <button id="btn-join" class="primary-btn">Join Call</button>
                        </div>

                        <div id="active-call-section" class="hidden">
                            <p>Call in progress...</p>
                            <button id="btn-end" class="danger-btn">End Call</button>
                        </div>
                    </div>

                    <div id="sdp-display-section" class="hidden">
                        <h3>Your Connection Data (Copy & Send)</h3>
                        <div class="sdp-container">
                            <textarea id="local-sdp-output" readonly></textarea>
                            <button id="btn-copy">Copy to Clipboard</button>
                        </div>
                    </div>

                    <div id="error-message" class="error-message hidden"></div>
                </div>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
