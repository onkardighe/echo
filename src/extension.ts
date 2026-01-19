import * as vscode from 'vscode';
import { startCallCommand } from './commands/startCall.command';
import { joinCallCommand } from './commands/joinCall.command';
import { endCallCommand } from './commands/endCall.command';
import { Logger } from './utils/Logger';

export function activate(context: vscode.ExtensionContext) {
    Logger.initialize('Echo Audio');
    Logger.info('Echo extension is now active!');

    context.subscriptions.push(
        vscode.commands.registerCommand('echo.startCall', () => startCallCommand(context)),
        vscode.commands.registerCommand('echo.joinCall', () => joinCallCommand(context)),
        vscode.commands.registerCommand('echo.endCall', () => endCallCommand(context))
    );
}

export function deactivate() {
    Logger.dispose();
}
