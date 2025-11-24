#!/usr/bin/env bash
set -euo pipefail
export PIP_INDEX_URL="${PIP_INDEX_URL:-https://pypi.org/simple}"
export PIP_TRUSTED_HOST="${PIP_TRUSTED_HOST:-pypi.org}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MCP_HOME="$HOME/.mcp"

info() {
  printf "\033[1;34m[setup]\033[0m %s\n" "$*"
}

error() {
  printf "\033[1;31m[setup]\033[0m %s\n" "$*"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    error "command not found: $1"
    exit 1
  fi
}

require_command python3.12
require_command node
require_command npm
require_command git

info "Ensuring local storage layout ($MCP_HOME)"
for subdir in context/db context/qdrant tasks cache/search cache/code logs skills agents; do
  mkdir -p "$MCP_HOME/$subdir"
done

info "Initializing git submodules (external MCPs)..."
cd "$ROOT"
git submodule update --init --recursive || {
  error "Warning: Submodule initialization had issues. Some external MCPs may not be available."
}

info "Installing MCP servers and dependencies"
"$ROOT/scripts/install-mcp-servers.sh"

info "Configuring MCP clients (Roo/Cursor)"
"$ROOT/scripts/configure-tools.sh"

info "Setup complete. Run ./scripts/test-installation.sh to verify the installation."
