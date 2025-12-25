# Antigravity Proxy

Easily fix connectivity issues for the Antigravity remote server. This extension ensures your remote coding tools can bypass server firewalls by securely routing Antigravity's traffic through your local computer or a designated server gateway.

## Features

- **Automated Proxy Setup**: Deploy `graftcp` and configure proxies automatically.
- **Flexible Modes**: Choose between fixed server-side proxy or SSH reverse tunnel (local forwarding).
- **Process Redirection**: Automatically intercepts and redirects language server processes.

## Requirements

- SSH access to the remote server.
- `graftcp` compatible environment (Linux).

## Extension Settings

This extension contributes the following settings:

* `antigravity-proxy.proxyHost`: Proxy host address on the remote server (default: `127.0.0.1`).
* `antigravity-proxy.proxyPort`: Proxy port on the remote server (default: `7890`).
* `antigravity-proxy.enableLocalForwarding`: Enable SSH reverse tunnel forwarding (default: `true`).
* `antigravity-proxy.localProxyPort`: Local machine proxy port (default: `7890`).

## connect
More info to be added.
