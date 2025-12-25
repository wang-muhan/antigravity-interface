import * as vscode from 'vscode';
import * as net from 'net';
import { TunnelManager, TunnelRequest } from './sshTunnel';
import { generateSetupScript, generateRollbackScript } from './remoteSetup';

let tunnelManager: TunnelManager | null = null;
let debugChannel: vscode.OutputChannel;

function debug(message: string): void {
	const timestamp = new Date().toISOString();
	const location = isRunningLocally() ? '[LOCAL/UI]' : '[REMOTE/Workspace]';
	debugChannel?.appendLine(`${timestamp} ${location} ${message}`);
	console.log(`Antigravity Debug: ${location} ${message}`);
}

function isRunningLocally(): boolean {
	return !vscode.env.remoteName;
}

function getSSHHostFromWorkspace(): string | undefined {
	if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
		const folder = vscode.workspace.workspaceFolders[0];
		debug(`Workspace folder URI: ${folder.uri.toString()}`);
		debug(`Workspace folder authority: ${folder.uri.authority}`);
		debug(`Workspace folder scheme: ${folder.uri.scheme}`);

		if (folder.uri.scheme === 'vscode-remote') {
			const authority = folder.uri.authority;
			if (authority && authority.startsWith('ssh-remote+')) {
				return authority.replace('ssh-remote+', '');
			}
		}
	}
	return undefined;
}

async function checkPortAvailable(host: string, port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = new net.Socket();
		socket.setTimeout(1000);
		socket.on('connect', () => {
			socket.destroy();
			resolve(true);
		});
		socket.on('timeout', () => {
			socket.destroy();
			resolve(false);
		});
		socket.on('error', () => {
			socket.destroy();
			resolve(false);
		});
		socket.connect(port, host);
	});
}

export function activate(context: vscode.ExtensionContext) {
	debugChannel = vscode.window.createOutputChannel('Antigravity Debug');
	context.subscriptions.push(debugChannel);
	debugChannel.show(true);

	debug(`Extension activating...`);
	debug(`vscode.env.remoteName = ${vscode.env.remoteName}`);
	debug(`vscode.env.uiKind = ${vscode.env.uiKind}`);
	debug(`vscode.env.appHost = ${vscode.env.appHost}`);
	debug(`isRunningLocally() = ${isRunningLocally()}`);

	if (isRunningLocally()) {
		debug('Activating LOCAL mode (UI side)');
		activateLocal(context);
	} else {
		debug('Activating REMOTE mode (Workspace side)');
		activateRemote(context);
	}
}

async function activateLocal(context: vscode.ExtensionContext) {
	debug('Creating TunnelManager...');
	tunnelManager = new TunnelManager();
	context.subscriptions.push({ dispose: () => tunnelManager?.dispose() });

	debug('Checking for remote workspace...');
	const host = getSSHHostFromWorkspace();
	debug(`Detected SSH host from workspace: ${host}`);

	if (host) {
		debug('Remote workspace detected! Will attempt to start reverse tunnel...');
		await startReverseTunnelForHost(host);
	} else {
		debug('No remote workspace detected. Will monitor for workspace changes...');
	}

	const workspaceFolderListener = vscode.workspace.onDidChangeWorkspaceFolders(async (event) => {
		debug(`Workspace folders changed! Added: ${event.added.length}, Removed: ${event.removed.length}`);

		for (const folder of event.added) {
			debug(`New folder: ${folder.uri.toString()}`);
			if (folder.uri.scheme === 'vscode-remote' && folder.uri.authority.startsWith('ssh-remote+')) {
				const newHost = folder.uri.authority.replace('ssh-remote+', '');
				debug(`New SSH remote detected: ${newHost}`);
				await startReverseTunnelForHost(newHost);
			}
		}

		for (const folder of event.removed) {
			if (folder.uri.scheme === 'vscode-remote' && folder.uri.authority.startsWith('ssh-remote+')) {
				const removedHost = folder.uri.authority.replace('ssh-remote+', '');
				debug(`SSH remote removed: ${removedHost}`);
				if (tunnelManager) {
					tunnelManager.stopTunnel(removedHost);
				}
			}
		}
	});

	context.subscriptions.push(workspaceFolderListener);

	const manualTunnelCommand = vscode.commands.registerCommand(
		'antigravity-proxy.startTunnel',
		async () => {
			const host = await vscode.window.showInputBox({
				prompt: 'Enter SSH host name (as configured in ~/.ssh/config)',
				placeHolder: 'e.g., myserver'
			});
			if (host) {
				await startReverseTunnelForHost(host);
			}
		}
	);

	const stopTunnelCommand = vscode.commands.registerCommand(
		'antigravity-proxy.stopTunnel',
		async () => {
			if (!tunnelManager || tunnelManager.getTunnelCount() === 0) {
				vscode.window.showInformationMessage('No active tunnels to stop.');
				return;
			}
			const hosts = tunnelManager.getActiveHosts();
			const host = await vscode.window.showQuickPick(hosts, {
				placeHolder: 'Select tunnel to stop'
			});
			if (host) {
				tunnelManager.stopTunnel(host);
				vscode.window.showInformationMessage(`Stopped tunnel to ${host}`);
			}
		}
	);

	const statusCommand = vscode.commands.registerCommand(
		'antigravity-proxy.tunnelStatus',
		() => {
			const count = tunnelManager ? tunnelManager.getTunnelCount() : 0;
			const hosts = tunnelManager ? tunnelManager.getActiveHosts() : [];
			debug(`Tunnel status check: count=${count}, hosts=${hosts.join(', ')}`);
			if (count === 0) {
				vscode.window.showInformationMessage('No active tunnels.');
			} else {
				vscode.window.showInformationMessage(`Active tunnels (${count}): ${hosts.join(', ')}`);
			}
		}
	);

	debug('Local commands registered: startTunnel, stopTunnel, tunnelStatus');
	context.subscriptions.push(manualTunnelCommand, stopTunnelCommand, statusCommand);
}

async function startReverseTunnelForHost(host: string): Promise<boolean> {
	if (!tunnelManager) {
		debug('ERROR: tunnelManager is null!');
		return false;
	}

	const config = vscode.workspace.getConfiguration('antigravity-proxy');
	const enableLocalForwarding = config.get<boolean>('enableLocalForwarding', true);
	const localPort = config.get<number>('localProxyPort', 7890);
	const remotePort = config.get<number>('remoteProxyPort', 7890);

	debug(`Config: enableLocalForwarding=${enableLocalForwarding}, localPort=${localPort}, remotePort=${remotePort}`);

	if (!enableLocalForwarding) {
		debug('Local forwarding is disabled in settings, skipping tunnel creation');
		return false;
	}

	debug(`Checking if local proxy is available at 127.0.0.1:${localPort}...`);
	const localProxyAvailable = await checkPortAvailable('127.0.0.1', localPort);
	debug(`Local proxy available: ${localProxyAvailable}`);

	if (!localProxyAvailable) {
		debug(`WARNING: Local proxy at 127.0.0.1:${localPort} is not reachable!`);
		vscode.window.showWarningMessage(`Local proxy at 127.0.0.1:${localPort} is not running. Tunnel may not work properly.`);
	}

	if (tunnelManager.hasTunnel(host)) {
		debug(`Tunnel to ${host} already exists, skipping`);
		return true;
	}

	const request: TunnelRequest = { host, localPort, remotePort };
	debug(`Starting reverse tunnel: ${JSON.stringify(request)}`);

	const success = await tunnelManager.startTunnel(request);
	debug(`Tunnel start result: ${success}`);

	if (success) {
		vscode.window.showInformationMessage(`Reverse tunnel to ${host} established (remote:${remotePort} -> local:${localPort})`);
	} else {
		vscode.window.showErrorMessage(`Failed to establish tunnel to ${host}. Check "Antigravity Tunnel" output for details.`);
	}

	return success;
}

async function activateRemote(context: vscode.ExtensionContext) {
	debug('Reading configuration...');
	const config = vscode.workspace.getConfiguration('antigravity-proxy');
	const enableLocalForwarding = config.get<boolean>('enableLocalForwarding', true);
	const remoteHost = config.get<string>('remoteProxyHost', '127.0.0.1');
	const remotePort = config.get<number>('remoteProxyPort', 7890);

	debug(`Config: enableLocalForwarding=${enableLocalForwarding}, remoteHost=${remoteHost}, remotePort=${remotePort}`);

	let proxyHost: string;
	let proxyPort: number;

	if (enableLocalForwarding) {
		debug('Local forwarding is ENABLED');
		proxyHost = '127.0.0.1';
		proxyPort = remotePort;

		debug(`Will use proxy at ${proxyHost}:${proxyPort} (tunnel should be established by UI side)`);

		debug('Waiting 3 seconds for UI side to establish tunnel...');
		await new Promise(resolve => setTimeout(resolve, 3000));

		debug(`Checking if tunnel port ${proxyPort} is available...`);
		const tunnelAvailable = await checkPortAvailable(proxyHost, proxyPort);
		debug(`Tunnel port available: ${tunnelAvailable}`);

		if (!tunnelAvailable) {
			debug('WARNING: Tunnel port is not available! UI side may have failed to create tunnel.');
			vscode.window.showWarningMessage(
				`Proxy port ${proxyPort} is not available. The UI side may have failed to establish the reverse tunnel. ` +
				`Check "Antigravity Debug" and "Antigravity Tunnel" output channels on the local window.`
			);
		} else {
			debug('Tunnel port is available!');
			vscode.window.showInformationMessage(`Reverse tunnel is active. Proxy available at ${proxyHost}:${proxyPort}`);
		}
	} else {
		debug('Local forwarding is DISABLED, using direct remote proxy');
		proxyHost = remoteHost;
		proxyPort = remotePort;
	}

	debug(`Final proxy config: ${proxyHost}:${proxyPort}`);
	registerRemoteCommands(context, proxyHost, proxyPort);
}

function registerRemoteCommands(context: vscode.ExtensionContext, proxyHost: string, proxyPort: number) {
	const setupCommand = vscode.commands.registerCommand('antigravity-proxy.setup', async () => {
		const terminal = vscode.window.createTerminal('Antigravity Setup');
		terminal.show();

		const script = generateSetupScript(proxyHost, proxyPort, context.extensionPath);
		for (const line of script.split('\n')) {
			if (line.trim()) {
				terminal.sendText(line);
			}
		}

		vscode.window.showInformationMessage('Setup complete. Please reload window.');
	});

	const rollbackCommand = vscode.commands.registerCommand('antigravity-proxy.rollback', () => {
		const terminal = vscode.window.createTerminal('Antigravity Rollback');
		terminal.show();

		const script = generateRollbackScript();
		for (const line of script.split('\n')) {
			if (line.trim()) {
				terminal.sendText(line);
			}
		}

		vscode.window.showInformationMessage('Rollback complete. Please reload window.');
	});

	const checkProxyCommand = vscode.commands.registerCommand('antigravity-proxy.checkProxy', async () => {
		debug(`Checking proxy at ${proxyHost}:${proxyPort}...`);
		const available = await checkPortAvailable(proxyHost, proxyPort);
		debug(`Proxy check result: ${available}`);
		if (available) {
			vscode.window.showInformationMessage(`Proxy at ${proxyHost}:${proxyPort} is reachable.`);
		} else {
			vscode.window.showErrorMessage(`Proxy at ${proxyHost}:${proxyPort} is NOT reachable!`);
		}
	});

	context.subscriptions.push(setupCommand, rollbackCommand, checkProxyCommand);
}

export function deactivate() {
	if (tunnelManager) {
		tunnelManager.dispose();
		tunnelManager = null;
	}
}
