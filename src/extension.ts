import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {

	console.log('Congratulations, your extension "antigravity-proxy" is now active!');

	const disposable = vscode.commands.registerCommand('antigravity-proxy.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from Antigravity Proxy!');
	});

	context.subscriptions.push(disposable);
}

export function deactivate() { }
