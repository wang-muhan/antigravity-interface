import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';

export interface TunnelRequest {
    host: string;
    localPort: number;
    remotePort: number;
}

export class TunnelManager {
    private tunnels: Map<string, ChildProcess> = new Map();
    private outputChannel: vscode.OutputChannel;
    private statusBarItem: vscode.StatusBarItem;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Antigravity Tunnel');
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.updateStatusBar();
    }

    private updateStatusBar(): void {
        const count = this.tunnels.size;
        if (count > 0) {
            this.statusBarItem.text = `$(plug) Tunnels: ${count}`;
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            this.statusBarItem.tooltip = `Active tunnels: ${Array.from(this.tunnels.keys()).join(', ')}`;
        } else {
            this.statusBarItem.text = '$(debug-disconnect) No tunnels';
            this.statusBarItem.backgroundColor = undefined;
            this.statusBarItem.tooltip = 'No active SSH tunnels';
        }
        this.statusBarItem.show();
    }

    async startTunnel(request: TunnelRequest): Promise<boolean> {
        this.outputChannel.appendLine(`=== Starting tunnel request ===`);
        this.outputChannel.appendLine(`Host: ${request.host}`);
        this.outputChannel.appendLine(`Local port: ${request.localPort}`);
        this.outputChannel.appendLine(`Remote port: ${request.remotePort}`);

        if (this.tunnels.has(request.host)) {
            this.outputChannel.appendLine(`Tunnel already exists for ${request.host}`);
            return true;
        }

        const args = [
            '-v',
            '-N',
            '-o', 'ExitOnForwardFailure=yes',
            '-o', 'ServerAliveInterval=60',
            '-o', 'ServerAliveCountMax=3',
            '-R', `${request.remotePort}:127.0.0.1:${request.localPort}`,
            request.host
        ];

        const sshCommand = `ssh ${args.join(' ')}`;
        this.outputChannel.appendLine(`Executing: ${sshCommand}`);
        this.outputChannel.show();

        return new Promise((resolve) => {
            let resolved = false;

            this.outputChannel.appendLine(`Spawning SSH process...`);
            const proc = spawn('ssh', args, { shell: true, windowsHide: true });
            this.outputChannel.appendLine(`SSH process spawned with PID: ${proc.pid}`);

            proc.stdout?.on('data', (data: Buffer) => {
                const output = data.toString();
                this.outputChannel.appendLine(`[stdout] ${output}`);
            });

            proc.stderr?.on('data', (data: Buffer) => {
                const output = data.toString();
                this.outputChannel.appendLine(`[stderr] ${output}`);

                if (output.includes('Allocated port') ||
                    output.includes('remote forward success') ||
                    output.includes('forwarding')) {
                    if (!resolved) {
                        resolved = true;
                        this.tunnels.set(request.host, proc);
                        this.updateStatusBar();
                        this.outputChannel.appendLine(`=== Tunnel established successfully ===`);
                        resolve(true);
                    }
                }
            });

            proc.on('error', (err: Error) => {
                this.outputChannel.appendLine(`[error] Process error: ${err.message}`);
                this.outputChannel.appendLine(`[error] Error stack: ${err.stack}`);
                if (!resolved) {
                    resolved = true;
                    resolve(false);
                }
            });

            proc.on('close', (code: number | null) => {
                this.outputChannel.appendLine(`[close] SSH process exited with code: ${code}`);
                this.tunnels.delete(request.host);
                this.updateStatusBar();
                if (!resolved) {
                    resolved = true;
                    this.outputChannel.appendLine(`=== Tunnel failed (process closed before success) ===`);
                    resolve(false);
                }
            });

            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    this.tunnels.set(request.host, proc);
                    this.updateStatusBar();
                    this.outputChannel.appendLine(`=== Tunnel assumed connected (timeout reached, no explicit success message) ===`);
                    resolve(true);
                }
            }, 8000);
        });
    }


    stopTunnel(host: string): void {
        const proc = this.tunnels.get(host);
        if (proc) {
            this.outputChannel.appendLine(`Stopping tunnel to ${host}`);
            proc.kill('SIGTERM');
            setTimeout(() => {
                if (this.tunnels.has(host)) {
                    proc.kill('SIGKILL');
                }
            }, 3000);
            this.tunnels.delete(host);
            this.updateStatusBar();
        }
    }

    stopAllTunnels(): void {
        for (const host of Array.from(this.tunnels.keys())) {
            this.stopTunnel(host);
        }
    }

    hasTunnel(host: string): boolean {
        return this.tunnels.has(host);
    }

    getTunnelCount(): number {
        return this.tunnels.size;
    }

    getActiveHosts(): string[] {
        return Array.from(this.tunnels.keys());
    }

    dispose(): void {
        this.stopAllTunnels();
        this.outputChannel.dispose();
        this.statusBarItem.dispose();
    }
}

export function getRemoteHost(): string | undefined {
    // Try to get authority from the workspace first
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        const authority = vscode.workspace.workspaceFolders[0].uri.authority;
        if (authority && authority.startsWith('ssh-remote+')) {
            return authority.replace('ssh-remote+', '');
        }
    }

    // Fallback to vscode.env.remoteAuthority
    const remoteAuthority = (vscode.env as any).remoteAuthority;
    if (remoteAuthority && remoteAuthority.startsWith('ssh-remote+')) {
        return remoteAuthority.replace('ssh-remote+', '');
    }

    return undefined;
}
