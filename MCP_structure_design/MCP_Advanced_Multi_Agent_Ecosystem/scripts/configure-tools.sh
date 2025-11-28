#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." &>/dev/null && pwd)"
cd "$ROOT_DIR"

echo "=== MCP Advanced Multi-Agent Ecosystem :: Configure MCP Client Tools ==="

CONFIG_SRC_DIR="$ROOT_DIR/configs"
CLIENT_CONFIGS=(
  "$HOME/.cursor/mcp.json"
  "$HOME/.claude/mcp.json"
  "$HOME/.codex/mcp.json"
  "$HOME/.roo/mcp.json"
)

if [ ! -d "$CONFIG_SRC_DIR" ]; then
  echo "ERROR: configs/ directory not found at: $CONFIG_SRC_DIR"
  echo "Ensure configuration templates exist before running this script."
  exit 1
fi

TEMPLATE="$CONFIG_SRC_DIR/roo_mcp_config.json"
if [ ! -f "$TEMPLATE" ]; then
  echo "WARNING: Base MCP config template not found at $TEMPLATE"
  echo "This script will not overwrite any client configs."
  exit 0
fi

echo "Using template: $TEMPLATE"
echo
echo "This script:"
echo " - DOES NOT write secrets."
echo " - Copies/merges safe MCP server definitions into local client configs."
echo " - Is safe to re-run (idempotent behavior is recommended)."
echo

for TARGET in "${CLIENT_CONFIGS[@]}"; do
  TARGET_DIR="$(dirname "$TARGET")"
  mkdir -p "$TARGET_DIR"

  if [ -f "$TARGET" ]; then
    echo "Skipping existing config (manual review recommended): $TARGET"
  else
    echo "Seeding MCP config for client: $TARGET"
    cp "$TEMPLATE" "$TARGET"
  fi
done

cat << 'NOTE'

Next steps:
- Review each generated/updated MCP client configuration:
  - Ensure command paths and ports for MCP servers match your environment.
  - Inject any required secrets via environment variables or your secret manager.
- Do NOT commit any of the configs under $HOME to git.

Use ./scripts/test-installation.sh to validate connectivity once servers are running.
NOTE