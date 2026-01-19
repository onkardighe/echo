import * as vscode from 'vscode';

export class Logger {
    private static outputChannel: vscode.OutputChannel;

    public static initialize(name: string) {
        this.outputChannel = vscode.window.createOutputChannel(name);
    }

    public static info(message: string) {
        this.log('INFO', message);
    }

    public static error(message: string, error?: any) {
        this.log('ERROR', `${message} ${error ? error.toString() : ''}`);
    }

    private static log(level: string, message: string) {
        if (!this.outputChannel) {
            console.log(`[${level}] ${message}`); // Fallback
            return;
        }
        const timestamp = new Date().toLocaleTimeString();
        this.outputChannel.appendLine(`[${timestamp}] [${level}] ${message}`);
    }

    public static dispose() {
        this.outputChannel?.dispose();
    }
}
