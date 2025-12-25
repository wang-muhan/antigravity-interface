#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$PROJECT_DIR/resources/bin"
GRAFTCP_REPO="https://github.com/hmgle/graftcp.git"
GO_VERSION="1.23.4"

if ! command -v go &>/dev/null; then
    echo "Installing Go $GO_VERSION..."
    GO_TAR="go${GO_VERSION}.linux-amd64.tar.gz"
    wget -q "https://go.dev/dl/${GO_TAR}" -O "/tmp/${GO_TAR}"
    sudo rm -rf /usr/local/go && sudo tar -C /usr/local -xzf "/tmp/${GO_TAR}"
    rm "/tmp/${GO_TAR}"
fi
export PATH="/usr/local/go/bin:$PATH"

if ! command -v aarch64-linux-gnu-gcc &>/dev/null; then
    echo "Installing arm64 cross-compiler..."
    sudo apt-get update -qq && sudo apt-get install -y -qq gcc-aarch64-linux-gnu
fi

mkdir -p "$OUTPUT_DIR"

build_for_arch() {
    local arch=$1
    local cross_prefix=$2
    local workdir="/tmp/graftcp-build-$arch"
    
    echo "Building for linux-$arch..."
    rm -rf "$workdir"
    git clone --depth 1 "$GRAFTCP_REPO" "$workdir"
    cd "$workdir"
    
    if [ -n "$cross_prefix" ]; then
        make CROSS_COMPILE="$cross_prefix"
    else
        make
    fi
    
    cp local/mgraftcp "$OUTPUT_DIR/mgraftcp-linux-$arch"
    cd "$SCRIPT_DIR"
    rm -rf "$workdir"
    echo "Built: $OUTPUT_DIR/mgraftcp-linux-$arch"
}

build_for_arch "amd64" ""
build_for_arch "arm64" "aarch64-linux-gnu-"

echo "Build complete!"
ls -la "$OUTPUT_DIR"
