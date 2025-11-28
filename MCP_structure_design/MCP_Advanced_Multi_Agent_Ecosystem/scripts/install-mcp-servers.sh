#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." &>/dev/null && pwd)"
cd "$ROOT_DIR"

echo "=== MCP Advanced Multi-Agent Ecosystem :: Install MCP Servers ==="

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js (v20+) is required."
  exit 1
fi

# Use workspace install (already defined in package.json)
echo "[1/3] Ensuring workspace dependencies are installed..."
npm install

echo "[2/3] Building TypeScript-based MCP servers (if build scripts exist)..."
npm run build:servers || echo "No global build or some packages missing build script; continuing."

echo "[3/3] Summary of MCP servers:"
echo " - src/mcp-servers/advanced-multi-agent-framework"
echo " - src/mcp-servers/agent-swarm"
echo " - src/mcp-servers/task-orchestrator"
echo " - src/mcp-servers/search-aggregator"
echo " - src/mcp-servers/skills-manager"
echo " - src/mcp-servers/context-persistence (Python)"
echo " - src/mcp-servers/github-oauth"

cat << 'NOTE'

Notes:
- Each MCP server maintains its own start command:
  - Check each server's README.md and package.json/pyproject.toml.
- Python servers (e.g. context-persistence) require Python 3.10+ and their dependencies.
  - Use the server's own pyproject.toml or requirements to install.
- This script is idempotent and safe to re-run.

Next:
  - Configure environment variables (.env from .env.example where available).
  - Use ./scripts/configure-tools.sh to sync MCP client configs.
NOTE