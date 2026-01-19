import * as vscode from 'vscode';

export class DisposableManager implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];

    public register(disposable: vscode.Disposable) {
        this.disposables.push(disposable);
    }

    public dispose() {
        while (this.disposables.length) {
            const x = this.disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}
