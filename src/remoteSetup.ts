import * as path from 'path';

export function generateSetupScript(proxyHost: string, proxyPort: number, extensionPath: string): string {
    const binDir = path.join(extensionPath, 'resources', 'bin');

    return `#!/bin/bash
set -e

PROXY_HOST="${proxyHost}"
PROXY_PORT="${proxyPort}"
EXTENSION_BIN_DIR="${binDir}"

GREEN='\\033[0;32m'
RED='\\033[0;31m'
NC='\\033[0m'

log_info() { echo -e "\${GREEN}[INFO]\${NC} $1"; }
log_error() { echo -e "\${RED}[ERROR]\${NC} $1"; }

ARCH=$(uname -m)
case "$ARCH" in
    x86_64|amd64) MGRAFTCP_SOURCE="$EXTENSION_BIN_DIR/mgraftcp-linux-amd64" ;;
    aarch64|arm64) MGRAFTCP_SOURCE="$EXTENSION_BIN_DIR/mgraftcp-linux-arm64" ;;
    *) log_error "Unsupported architecture: $ARCH"; exit 1 ;;
esac

chmod +x "$MGRAFTCP_SOURCE"

PROXY_ADDR="\${PROXY_HOST}:\${PROXY_PORT}"

TARGET_PATH=$(find "$HOME/.antigravity-server" -path "*/extensions/antigravity/bin/*" -name "language_server_linux_*" -type f 2>/dev/null | head -1)

if [ -z "$TARGET_PATH" ]; then
    log_error "Antigravity language server not found"
    exit 1
fi

log_info "Found: $TARGET_PATH"

[ ! -f "\${TARGET_PATH}.bak" ] && mv "$TARGET_PATH" "\${TARGET_PATH}.bak"

cat <<EOF > "$TARGET_PATH"
#!/bin/bash
MGRAFTCP_PATH="$MGRAFTCP_SOURCE"
REAL_BINARY="\\\$(dirname "\\\${BASH_SOURCE[0]}")/\\\$(basename "\\\${BASH_SOURCE[0]}").bak"
exec "\\\$MGRAFTCP_PATH" --http_proxy "\${PROXY_ADDR}" "\\\$REAL_BINARY" "\\\$@"
EOF

chmod +x "$TARGET_PATH"
log_info "Setup complete with proxy \${PROXY_ADDR}. Please reload window."
`;
}

export function generateRollbackScript(): string {
    return `#!/bin/bash
set -e
BAK_PATH=$(find "$HOME/.antigravity-server" -path "*/extensions/antigravity/bin/*" -name "language_server_linux_*.bak" -type f 2>/dev/null | head -1)
[ -z "$BAK_PATH" ] && echo "Nothing to rollback." && exit 1
ORIGINAL="\${BAK_PATH%.bak}"
[ -f "$ORIGINAL" ] && rm -f "$ORIGINAL"
mv "$BAK_PATH" "$ORIGINAL"
echo "Rollback complete."
`;
}
