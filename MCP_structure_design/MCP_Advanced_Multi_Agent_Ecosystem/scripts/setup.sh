#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." &>/dev/null && pwd)"
cd "$ROOT_DIR"

echo "=== MCP Advanced Multi-Agent Ecosystem :: Setup ==="

# 1. Ensure Node.js and Python exist
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js is required (v20+). Install it and re-run."
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "WARNING: python3 not found. Python-based MCP servers will be skipped."
fi

# 2. Install Node dependencies for all MCP servers via npm workspaces
echo "Installing Node.js dependencies for MCP servers..."
npm install

# 3. Python: optional shared venv for tooling (servers may also have their own)
if command -v python3 >/dev/null 2>&1; then
  if [ ! -d ".venv" ]; then
    echo "Creating shared Python virtual environment..."
    python3 -m venv .venv
  fi
  # shellcheck disable=SC1091
  source .venv/bin/activate
  python -m pip install --upgrade pip >/dev/null
  echo "Shared Python environment ready."
fi

# 4. Create local MCP data directories (local-first, not committed)
echo "Preparing local MCP data directories..."
mkdir -p \
  "$HOME/.mcp/context/db" \
  "$HOME/.mcp/context/qdrant" \
  "$HOME/.mcp/tasks" \
  "$HOME/.mcp/cache/search" \
  "$HOME/.mcp/cache/code" \
  "$HOME/.mcp/logs"

echo "Setup complete."
echo "Next steps:"
echo "  - Configure per-server .env files from their .env.example templates."
echo "  - Run: ./scripts/install-mcp-servers.sh"