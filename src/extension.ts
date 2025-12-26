import * as vscode from 'vscode';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { generateSetupScript, generateRollbackScript } from './remoteSetup';

const execAsync = promisify(exec);

let debugChannel: vscode.OutputChannel;

function debug(message: string): void {
	const timestamp = new Date().toISOString();
	const location = isRunningLocally() ? '[LOCAL]' : '[REMOTE]';
	debugChannel?.appendLine(`${timestamp} ${location} ${message}`);
}

function isRunningLocally(): boolean {
	return !vscode.env.remoteName;
}

async function checkPortAvailable(host: string, port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = new net.Socket();
		socket.setTimeout(1000);
		socket.on('connect', () => { socket.destroy(); resolve(true); });
		socket.on('timeout', () => { socket.destroy(); resolve(false); });
		socket.on('error', () => { socket.destroy(); resolve(false); });
		socket.connect(port, host);
	});
}

const ANTIGRAVITY_FILENAME = 'config.antigravity';
const INCLUDE_LINE = `Include ${ANTIGRAVITY_FILENAME}`;

/**
 * Get path to SSH config directory based on platform
 */
function getSSHDir(): string {
	return path.join(os.homedir(), '.ssh');
}

/**
 * Get path to the main SSH config file
 */
function getSSHConfigPath(): string {
	return path.join(getSSHDir(), 'config');
}

/**
 * Get path to our custom SSH config file
 */
function getAntigravityConfigPath(): string {
	return path.join(getSSHDir(), ANTIGRAVITY_FILENAME);
}

/**
 * Update the SSH config files using the Include approach
 */
async function updateSSHConfigFile(remotePort: number, localPort: number, enable: boolean): Promise<void> {
	const mainConfigPath = getSSHConfigPath();
	const antiConfigPath = getAntigravityConfigPath();

	try {
		// Ensure .ssh directory exists
		await fs.mkdir(getSSHDir(), { recursive: true });

		if (enable) {
			// 1. Create/Update the config.antigravity file
			const antiContent = [
				'# Antigravity Proxy Configuration',
				`# Generated at: ${new Date().toISOString()}`,
				'Match all',
				`    RemoteForward ${remotePort} 127.0.0.1:${localPort}`,
				'    ExitOnForwardFailure no',
				'    VisualHostKey no',
				'',
			].join('\n');
			await fs.writeFile(antiConfigPath, antiContent, 'utf-8');
			debug(`Updated ${antiConfigPath}`);

			// 2. Ensure Include line exists in main config
			let mainContent = '';
			try {
				mainContent = await fs.readFile(mainConfigPath, 'utf-8');
			} catch (e) { /* ignore if doesn't exist */ }

			if (!mainContent.includes(INCLUDE_LINE)) {
				// Prepend to the top for maximum compatibility
				mainContent = `${INCLUDE_LINE}\n${mainContent}`;
				await fs.writeFile(mainConfigPath, mainContent, 'utf-8');
				debug(`Added Include line to ${mainConfigPath}`);
			}
		} else {
			// 1. Remove Include line from main config
			try {
				let mainContent = await fs.readFile(mainConfigPath, 'utf-8');
				if (mainContent.includes(INCLUDE_LINE)) {
					// Simply remove the Include line (we're the only one who writes it)
					mainContent = mainContent.replace(`${INCLUDE_LINE}\n`, '');
					mainContent = mainContent.replace(INCLUDE_LINE, ''); // fallback if no trailing newline
					await fs.writeFile(mainConfigPath, mainContent, 'utf-8');
					debug(`Removed Include line from ${mainConfigPath}`);
				}
			} catch (e) { /* ignore */ }

			// 2. Delete the config.antigravity file
			try {
				await fs.unlink(antiConfigPath);
				debug(`Deleted ${antiConfigPath}`);
			} catch (e) { /* ignore if already gone */ }
		}

		debug(`SSH config updated (enable=${enable})`);
	} catch (error) {
		debug(`SSH config update error: ${error}`);
		throw error;
	}
}

/**
 * Check if the forwarding is enabled by looking at the Include line and the sub-config
 */
async function getSSHConfigStatus(): Promise<{ enabled: boolean; port?: number }> {
	try {
		const mainContent = await fs.readFile(getSSHConfigPath(), 'utf-8');
		if (mainContent.includes(INCLUDE_LINE)) {
			const antiContent = await fs.readFile(getAntigravityConfigPath(), 'utf-8');
			const match = antiContent.match(/RemoteForward\s+(\d+)\s+(?:localhost|127\.0\.0\.1):/);
			if (match) {
				return { enabled: true, port: parseInt(match[1]) };
			}
		}
	} catch {
		// Files don't exist
	}
	return { enabled: false };
}

export function activate(context: vscode.ExtensionContext) {
	debugChannel = vscode.window.createOutputChannel('Antigravity Debug');
	context.subscriptions.push(debugChannel);

	debug(`Activating... isLocal=${isRunningLocally()}`);

	if (isRunningLocally()) {
		activateLocal(context).catch(err => debug(`activateLocal error: ${err}`));
	} else {
		activateRemote(context).catch(err => debug(`activateRemote error: ${err}`));
	}
}

async function activateLocal(context: vscode.ExtensionContext) {
	const config = vscode.workspace.getConfiguration('antigravity-proxy');
	const enable = config.get<boolean>('enableLocalForwarding', true);
	const localPort = config.get<number>('localProxyPort', 7890);
	const remotePort = config.get<number>('remoteProxyPort', 7890);

	debug(`Config: enable=${enable}, localPort=${localPort}, remotePort=${remotePort}`);

	// Auto-setup on activation
	if (enable) {
		await updateSSHConfigFile(remotePort, localPort, true);
		if (!await checkPortAvailable('127.0.0.1', localPort)) {
			vscode.window.showWarningMessage(
				`Local proxy at 127.0.0.1:${localPort} is not running. ` +
				`Also check if port ${remotePort} is occupied on the remote server before reconnecting.`
			);
		}
	}

	// Watch config changes
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(async (e: vscode.ConfigurationChangeEvent) => {
			if (e.affectsConfiguration('antigravity-proxy')) {
				const cfg = vscode.workspace.getConfiguration('antigravity-proxy');
				const lp = cfg.get<number>('localProxyPort', 7890);
				const rp = cfg.get<number>('remoteProxyPort', 7890);
				const enabled = cfg.get<boolean>('enableLocalForwarding', true);
				await updateSSHConfigFile(rp, lp, enabled);
			}
		})
	);

	// Commands
	context.subscriptions.push(
		vscode.commands.registerCommand('antigravity-proxy.enableForwarding', async () => {
			const cfg = vscode.workspace.getConfiguration('antigravity-proxy');
			const lp = cfg.get<number>('localProxyPort', 7890);
			const rp = cfg.get<number>('remoteProxyPort', 7890);
			await updateSSHConfigFile(rp, lp, true);
			vscode.window.showInformationMessage('SSH port forwarding enabled');
		}),

		vscode.commands.registerCommand('antigravity-proxy.disableForwarding', async () => {
			await updateSSHConfigFile(0, 0, false);
			vscode.window.showInformationMessage('SSH port forwarding disabled');
		}),

		vscode.commands.registerCommand('antigravity-proxy.tunnelStatus', async () => {
			const status = await getSSHConfigStatus();
			vscode.window.showInformationMessage(
				status.enabled
					? `Forwarding configured on port: ${status.port}`
					: 'SSH port forwarding is not configured'
			);
		})
	);
}

async function activateRemote(context: vscode.ExtensionContext) {
	const config = vscode.workspace.getConfiguration('antigravity-proxy');
	// Remote only cares about remoteProxyHost and remoteProxyPort
	const remoteHost = config.get<string>('remoteProxyHost', '127.0.0.1');
	const remotePort = config.get<number>('remoteProxyPort', 7890);

	if (process.platform !== 'linux') {
		debug(`Skipping setup: unsupported platform '${process.platform}' (only Linux is supported)`);
		return;
	}

	debug(`Remote Proxy: ${remoteHost}:${remotePort}`);

	// Auto-run setup script
	// Use extensionUri.fsPath for correct remote path resolution
	const extensionPath = context.extensionUri.fsPath;
	debug(`Extension path: ${extensionPath}`);
	debug('Auto-running setup script...');
	await runSetupScriptSilently(remoteHost, remotePort, extensionPath);

	// Watch config changes
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(async (e: vscode.ConfigurationChangeEvent) => {
			if (e.affectsConfiguration('antigravity-proxy.remoteProxyHost') ||
				e.affectsConfiguration('antigravity-proxy.remoteProxyPort')) {
				const cfg = vscode.workspace.getConfiguration('antigravity-proxy');
				const host = cfg.get<string>('remoteProxyHost', '127.0.0.1');
				const port = cfg.get<number>('remoteProxyPort', 7890);
				debug(`Config changed, re-running setup: ${host}:${port}`);
				await runSetupScriptSilently(host, port, extensionPath);
			}
		})
	);

	// Remote commands
	context.subscriptions.push(
		vscode.commands.registerCommand('antigravity-proxy.setup', () => {
			const terminal = vscode.window.createTerminal('Antigravity Setup');
			terminal.show();
			const script = generateSetupScript(remoteHost, remotePort, extensionPath);
			terminal.sendText(`cat > /tmp/ag_setup.sh << 'EOF'\n${script}\nEOF`);
			terminal.sendText('bash /tmp/ag_setup.sh');
		}),

		vscode.commands.registerCommand('antigravity-proxy.rollback', () => {
			const terminal = vscode.window.createTerminal('Antigravity Rollback');
			terminal.show();
			terminal.sendText(generateRollbackScript());
		}),

		vscode.commands.registerCommand('antigravity-proxy.checkProxy', async () => {
			const ok = await checkPortAvailable(remoteHost, remotePort);
			vscode.window.showInformationMessage(ok ? `Proxy OK` : `Proxy NOT reachable`);
		})
	);
}

/**
 * Run setup script silently in background (idempotent)
 */
async function runSetupScriptSilently(proxyHost: string, proxyPort: number, extensionPath: string): Promise<void> {
	const scriptPath = path.join(extensionPath, 'scripts', 'setup-proxy.sh');

	try {
		// Ensure script is executable
		await execAsync(`chmod +x "${scriptPath}"`);

		// Execute script directly with environment variables for proxy config
		const env = {
			...process.env,
			PROXY_HOST: proxyHost,
			PROXY_PORT: String(proxyPort)
		};

		const { stdout, stderr } = await execAsync(`bash "${scriptPath}" 2>&1`, { env });
		const output = stdout || stderr || '';

		debug(`Setup output: ${output}`);

		if (output.includes('Already configured')) {
			debug('Setup: Already configured');
		} else if (output.includes('Setup complete') || output.includes('configured')) {
			debug('Setup: Completed successfully');
			vscode.window.showInformationMessage(
				'Antigravity Remote Setup updated. Please reload window to apply changes to the language server.',
				'Reload Window'
			).then(selection => {
				if (selection === 'Reload Window') {
					vscode.commands.executeCommand('workbench.action.reloadWindow');
				}
			});
		}
	} catch (error: unknown) {
		const err = error as { message?: string; stdout?: string; stderr?: string };
		debug(`Setup error: ${err.message || error}`);
		if (err.stdout) { debug(`stdout: ${err.stdout}`); }
		if (err.stderr) { debug(`stderr: ${err.stderr}`); }
	}
}

export async function deactivate() {
	if (isRunningLocally()) {
		try {
			await updateSSHConfigFile(0, 0, false);
		} catch (e) {
			debug(`Cleanup during deactivation failed: ${e}`);
		}
	}
}

