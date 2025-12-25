import * as path from 'path';

export function generateSetupScript(proxyHost: string, proxyPort: number, _extensionPath: string): string {
    // Note: _extensionPath is the local path which won't work on remote
    // The script will auto-detect the extension path on the remote Linux server

    return `#!/bin/bash
set -e

PROXY_HOST="${proxyHost}"
PROXY_PORT="${proxyPort}"

# Auto-detect our extension path on remote server
EXTENSION_BIN_DIR=""
BASE_DIR="$HOME/.antigravity-server/extensions"
if [ -d "$BASE_DIR" ]; then
    FOUND_DIR=$(find "$BASE_DIR" -maxdepth 1 -type d -name "*antigravity-proxy*" 2>/dev/null | sort -V | tail -1)
    if [ -n "$FOUND_DIR" ]; then
        EXTENSION_BIN_DIR="$FOUND_DIR/resources/bin"
    fi
fi

if [ -z "$EXTENSION_BIN_DIR" ] || [ ! -d "$EXTENSION_BIN_DIR" ]; then
    echo "ERROR: Could not find antigravity-proxy extension bin directory"
    echo "Searched in: ~/.antigravity-server/extensions"
    ls -la "$HOME/.antigravity-server/extensions" 2>/dev/null || echo "Directory does not exist"
    exit 1
fi

GREEN='\\033[0;32m'
RED='\\033[0;31m'
YELLOW='\\033[0;33m'
NC='\\033[0m'

log_info() { echo -e "\${GREEN}[INFO]\${NC} $1"; }
log_error() { echo -e "\${RED}[ERROR]\${NC} $1"; }
log_debug() { echo -e "\${YELLOW}[DEBUG]\${NC} $1"; }

log_debug "=== Debug Info ==="
log_debug "PROXY_HOST: $PROXY_HOST"
log_debug "PROXY_PORT: $PROXY_PORT"
log_debug "EXTENSION_BIN_DIR: $EXTENSION_BIN_DIR"

ARCH=$(uname -m)
log_debug "Detected architecture: $ARCH"

case "$ARCH" in
    x86_64|amd64) MGRAFTCP_SOURCE="$EXTENSION_BIN_DIR/mgraftcp-linux-amd64" ;;
    aarch64|arm64) MGRAFTCP_SOURCE="$EXTENSION_BIN_DIR/mgraftcp-linux-arm64" ;;
    *) log_error "Unsupported architecture: $ARCH"; exit 1 ;;
esac

log_debug "MGRAFTCP_SOURCE: $MGRAFTCP_SOURCE"

if [ -f "$MGRAFTCP_SOURCE" ]; then
    log_debug "mgraftcp binary exists"
else
    log_error "mgraftcp binary NOT found at: $MGRAFTCP_SOURCE"
    log_debug "Listing extension bin dir:"
    ls -la "$EXTENSION_BIN_DIR" 2>&1 || echo "Directory not accessible"
    exit 1
fi

chmod +x "$MGRAFTCP_SOURCE"

PROXY_ADDR="\${PROXY_HOST}:\${PROXY_PORT}"
log_debug "PROXY_ADDR: $PROXY_ADDR"

log_debug "Searching for language server in: $HOME/.antigravity-server/bin/*/extensions/antigravity/bin/"

# List all potential paths first
log_debug "All matching files found:"
find "$HOME/.antigravity-server/bin" -path "*/extensions/antigravity/bin/language_server_linux_*" -type f 2>/dev/null || echo "(none found)"

TARGET_PATH=$(find "$HOME/.antigravity-server/bin" -path "*/extensions/antigravity/bin/language_server_linux_*" -type f 2>/dev/null | grep -v ".bak$" | head -1)

if [ -z "$TARGET_PATH" ]; then
    log_error "Antigravity language server not found"
    log_debug "Listing ~/.antigravity-server/bin structure:"
    find "$HOME/.antigravity-server/bin" -type d -name "antigravity" 2>/dev/null | head -10 || echo "Directory not found"
    exit 1
fi

log_info "Found: $TARGET_PATH"
log_debug "File type: $(file "$TARGET_PATH" 2>&1)"
log_debug "File size: $(ls -la "$TARGET_PATH" 2>&1)"

# Check if already a wrapper script
if head -1 "$TARGET_PATH" 2>/dev/null | grep -q "^#!/bin/bash"; then
    log_debug "WARNING: Target appears to already be a bash script (wrapper?)"
    log_debug "First 5 lines of target:"
    head -5 "$TARGET_PATH"
fi

BAK_PATH="\${TARGET_PATH}.bak"
log_debug "BAK_PATH: $BAK_PATH"

if [ -f "$BAK_PATH" ]; then
    log_debug "Backup already exists, skipping backup step"
else
    log_debug "Creating backup..."
    mv "$TARGET_PATH" "$BAK_PATH"
    log_debug "Backup created at: $BAK_PATH"
fi

log_debug "Creating wrapper script..."
cat <<EOF > "$TARGET_PATH"
#!/bin/bash
MGRAFTCP_PATH="$MGRAFTCP_SOURCE"
REAL_BINARY="\\\$(dirname "\\\${BASH_SOURCE[0]}")/\\\$(basename "\\\${BASH_SOURCE[0]}").bak"
exec "\\\$MGRAFTCP_PATH" --socks5 "$PROXY_ADDR" "\\\$REAL_BINARY" "\\\$@"
EOF

chmod +x "$TARGET_PATH"

log_debug "=== Verification ==="
log_debug "Wrapper script content:"
cat "$TARGET_PATH"
log_debug "---"
log_debug "Wrapper script permissions: $(ls -la "$TARGET_PATH")"
log_debug "Backup file exists: $([ -f "$BAK_PATH" ] && echo 'YES' || echo 'NO')"
log_debug "Backup file type: $(file "$BAK_PATH" 2>&1)"

log_info "Setup complete with proxy $PROXY_ADDR"
log_info "Please reload the VS Code window to apply changes."
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
