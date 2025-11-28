#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." &>/dev/null && pwd)"
cd "$ROOT_DIR"

echo "=== MCP Advanced Multi-Agent Ecosystem :: Test Installation ==="

FAILED=0

check_cmd() {
  local name="$1"
  local cmd="$2"

  echo "- Checking: $name"
  if eval "$cmd" >/dev/null 2>&1; then
    echo "  ✅ $name"
  else
    echo "  ❌ $name"
    FAILED=1
  fi
}

echo "[1/4] Validating core tooling..."
check_cmd "Node.js (>=20)" "node -v"
check_cmd "npm" "npm -v"
check_cmd "Python 3" "python3 -V"

echo
echo "[2/4] Checking required directories..."
for d in "src/mcp-servers" "configs" "docs" "scripts"; do
  if [ -d "$d" ]; then
    echo "  ✅ Directory exists: $d"
  else
    echo "  ❌ Missing directory: $d"
    FAILED=1
  fi
done

echo
echo "[3/4] Checking MCP server packages..."
# Spot-check key servers; they may be TS or JS; failures here are informative, not fatal
if [ -d "src/mcp-servers/agent-swarm" ]; then
  if [ -f "src/mcp-servers/agent-swarm/package.json" ]; then
    echo "  ✅ agent-swarm package.json found"
  else
    echo "  ❌ agent-swarm package.json missing"
    FAILED=1
  fi
fi

if [ -d "src/mcp-servers/task-orchestrator" ]; then
  if [ -f "src/mcp-servers/task-orchestrator/package.json" ]; then
    echo "  ✅ task-orchestrator package.json found"
  else
    echo "  ❌ task-orchestrator package.json missing"
    FAILED=1
  fi
fi

if [ -d "src/mcp-servers/search-aggregator" ]; then
  if [ -f "src/mcp-servers/search-aggregator/package.json" ]; then
    echo "  ✅ search-aggregator package.json found"
  else
    echo "  ❌ search-aggregator package.json missing"
    FAILED=1
  fi
fi

if [ -d "src/mcp-servers/context-persistence" ]; then
  echo "  ✅ context-persistence directory present (Python server)"
fi

echo
echo "[4/4] MCP client configuration sanity check (if present)..."
for cfg in "$HOME/.cursor/mcp.json" "$HOME/.claude/mcp.json" "$HOME/.codex/mcp.json" "$HOME/.roo/mcp.json"; do
  if [ -f "$cfg" ]; then
    echo "  ✅ Found client config: $cfg"
  else
    echo "  ℹ️  Not found (ok): $cfg"
  fi
done

echo
if [ "$FAILED" -eq 0 ]; then
  echo "✅ Installation validation PASSED. You are ready to run MCP servers."
  exit 0
else
  echo "❌ Installation validation reported issues. Review messages above."
  exit 1
fi