<div align="center">
<img src="image.png" width="128" />

# Antigravity Interface (AGI)

**English** · [简体中文](README.zh-CN.md)

[![Version](https://img.shields.io/visual-studio-marketplace/v/wang-muhan.antigravity-interface)](https://marketplace.visualstudio.com/items?itemName=wang-muhan.antigravity-interface)
[![GitHub stars](https://img.shields.io/github/stars/wang-muhan/antigravity-interface)](https://github.com/wang-muhan/antigravity-interface)
[![GitHub issues](https://img.shields.io/github/issues/wang-muhan/antigravity-interface)](https://github.com/wang-muhan/antigravity-interface/issues)
[![License](https://img.shields.io/github/license/wang-muhan/antigravity-interface)](https://github.com/wang-muhan/antigravity-interface/blob/main/LICENSE)

</div>

Easily fix connectivity issues for the Antigravity remote server. This extension ensures your remote coding tools can bypass server firewalls by securely routing Antigravity's traffic through your local computer or a designated server gateway.

> **Note:** This version only supports **Linux remote servers**.

---

## Features

- **Automated Proxy Setup**: Deploys `mgraftcp` and configures proxies automatically.
- **SSH Reverse Tunnel**: Routes traffic through your local proxy via SSH port forwarding.
- **Process Redirection**: Automatically intercepts and redirects language server processes.

## Quick Start

1. Install the **Antigravity Interface** extension on your local Antigravity.
2. Connect to your remote Linux server using Antigravity Remote - SSH.
3. Install the extension again **on the remote server** (found in the Extensions view under the SSH section).
4. Execute the **Developer: Reload Window** command (or restart Antigravity) to ensure all services are properly initialized.
5. Configure your `localProxyPort` in settings (e.g., 7890) to match your local proxy service.

## Extension Settings

| Setting | Description |
|---------|-------------|
| `enableLocalForwarding` | Enable SSH reverse tunnel forwarding. |
| `localProxyPort` | Local proxy port on your computer. |
| `remoteProxyHost` | Proxy host address on the remote server. |
| `remoteProxyPort` | Proxy port on the remote server. |

## Requirements

- SSH access to the remote server.
- Linux remote server (x86_64 or arm64).
- A local proxy running on your computer (e.g., Clash, V2Ray).
