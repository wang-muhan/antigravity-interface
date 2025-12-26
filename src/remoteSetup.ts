import * as fs from 'fs';
import * as path from 'path';

export function generateSetupScript(proxyHost: string, proxyPort: number, extensionPath: string): string {
    const scriptPath = path.join(extensionPath, 'scripts', 'setup-proxy.sh');
    let script = fs.readFileSync(scriptPath, 'utf-8');

    // Normalize line endings to LF
    script = script.replace(/\r\n/g, '\n');

    // Replace placeholders
    script = script.replace(/__PROXY_HOST__/g, proxyHost);
    script = script.replace(/__PROXY_PORT__/g, String(proxyPort));

    return script;
}

export function generateRollbackScript(): string {
    const script = `#!/bin/bash
set -e
BAK=$(find "$HOME/.antigravity-server" -path "*/extensions/antigravity/bin/*" -name "language_server_linux_*.bak" -type f 2>/dev/null | head -1)
[ -z "$BAK" ] && echo "Nothing to rollback" && exit 0
TARGET="\${BAK%.bak}"
[ -f "$TARGET" ] && rm -f "$TARGET"
mv "$BAK" "$TARGET"
echo "Rollback complete"
`;
    return script.replace(/\r\n/g, '\n');
}
