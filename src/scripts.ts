/**
 * Shell scripts embedded as TypeScript strings.
 * This completely avoids CRLF issues - JS template literals always use \n internally.
 */

export function getSetupScript(): string {
    // Note: This script uses environment variables PROXY_HOST and PROXY_PORT
    // Build the heredoc content separately to handle ${BASH_SOURCE[0]} properly
    const wrapperScript = [
        '#!/bin/bash',
        'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
        'SCRIPT_NAME="$(basename "${BASH_SOURCE[0]}")"',
        'MGRAFTCP_PATH="__MGRAFTCP_PLACEHOLDER__"',
        'exec "$MGRAFTCP_PATH" --socks5 "__PROXY_ADDR_PLACEHOLDER__" "$SCRIPT_DIR/$SCRIPT_NAME.bak" "$@"'
    ].join('\n');

    return `#!/bin/bash
set -e

# Use environment variables with defaults
PROXY_HOST="\${PROXY_HOST:-127.0.0.1}"
PROXY_PORT="\${PROXY_PORT:-7890}"
PROXY_ADDR="\${PROXY_HOST}:\${PROXY_PORT}"

# Find extension bin dir
EXTENSION_BIN_DIR=""
for dir in "$HOME/.antigravity-server/extensions/"*antigravity-interface*; do
    [ -d "$dir/resources/bin" ] && EXTENSION_BIN_DIR="$dir/resources/bin" && break
done

if [ -z "$EXTENSION_BIN_DIR" ]; then
    echo "ERROR: antigravity-interface extension not found"
    exit 1
fi

# Select mgraftcp binary based on arch
ARCH=$(uname -m)
case "$ARCH" in
    x86_64|amd64) MGRAFTCP="$EXTENSION_BIN_DIR/mgraftcp-linux-amd64" ;;
    aarch64|arm64) MGRAFTCP="$EXTENSION_BIN_DIR/mgraftcp-linux-arm64" ;;
    *) echo "ERROR: Unsupported arch: $ARCH"; exit 1 ;;
esac

[ ! -f "$MGRAFTCP" ] && echo "ERROR: mgraftcp not found" && exit 1
chmod +x "$MGRAFTCP"

# Find language server
TARGET=$(find "$HOME/.antigravity-server/bin" -path "*/extensions/antigravity/bin/language_server_linux_*" -type f 2>/dev/null | grep -v ".bak$" | head -1)
[ -z "$TARGET" ] && echo "ERROR: language server not found" && exit 1

echo "Found: $TARGET"
BAK="\${TARGET}.bak"

# Check if already configured
if head -1 "$TARGET" 2>/dev/null | grep -q "^#!/bin/bash"; then
    if grep -q "$PROXY_ADDR" "$TARGET" 2>/dev/null; then
        echo "Already configured with $PROXY_ADDR"
        exit 0
    fi
fi

# Create backup if needed
if [ ! -f "$BAK" ]; then
    if head -1 "$TARGET" 2>/dev/null | grep -q "^#!/bin/bash"; then
        echo "ERROR: target is script but no backup exists"
        exit 1
    fi
    mv "$TARGET" "$BAK"
    echo "Backup created"
fi

# Create wrapper script using quoted heredoc (no expansion) + sed for substitution
cat > "$TARGET" << 'WRAPPER_SCRIPT'
${wrapperScript}
WRAPPER_SCRIPT

# Replace placeholders with actual values
sed -i "s|__MGRAFTCP_PLACEHOLDER__|$MGRAFTCP|g" "$TARGET"
sed -i "s|__PROXY_ADDR_PLACEHOLDER__|$PROXY_ADDR|g" "$TARGET"

chmod +x "$TARGET"
echo "Setup complete with proxy $PROXY_ADDR"
`;
}

export function getRollbackScript(): string {
    return `#!/bin/bash
set -e
BAK=$(find "$HOME/.antigravity-server" -path "*/extensions/antigravity/bin/*" -name "language_server_linux_*.bak" -type f 2>/dev/null | head -1)
[ -z "$BAK" ] && echo "Nothing to rollback" && exit 0
TARGET="\${BAK%.bak}"
[ -f "$TARGET" ] && rm -f "$TARGET"
mv "$BAK" "$TARGET"
echo "Rollback complete"
`;
}
