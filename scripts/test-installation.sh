#!/usr/bin/env bash
set -euo pipefail
export PIP_INDEX_URL="${PIP_INDEX_URL:-https://pypi.org/simple}"
export PIP_TRUSTED_HOST="${PIP_TRUSTED_HOST:-pypi.org}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PYTHON="${PYTHON:-python3.12}"
export PYTHONPATH="$ROOT/src/mcp-servers/context-persistence/src:${PYTHONPATH:-}"

info() {
  printf "\033[1;34m[test]\033[0m %s\n" "$*"
}

error() {
  printf "\033[1;31m[test]\033[0m %s\n" "$*"
}

info "Checking required executables"
command -v "$PYTHON" >/dev/null || { error "python not found: $PYTHON"; exit 1; }
command -v node >/dev/null || { error "node not found"; exit 1; }

info "Python version: $("$PYTHON" --version 2>&1)"
info "Node version: $(node --version 2>&1)"

info "Importing context persistence module"
"$PYTHON" - <<'PY'
import importlib, sys
importlib.import_module("context_persistence.server")
print("Context persistence import succeeded")
PY

artifacts=(
  "task-orchestrator:$ROOT/MCP_structure_design/mcp-servers-go/dist/task-orchestrator"
  "search-aggregator:$ROOT/MCP_structure_design/mcp-servers-go/dist/search-aggregator"
  "skills-manager:$ROOT/MCP_structure_design/mcp-servers-go/dist/skills-manager"
  "agent-swarm:$ROOT/src/mcp-servers/agent-swarm/dist/index.js"
)

for entry in "${artifacts[@]}"; do
  IFS=":" read -r service dist <<< "$entry"
  if [[ -f "$dist" ]]; then
    info "Dist file found for $service ($dist)"
  else
    error "Missing build artifact for $service ($dist)"
    exit 1
  fi
done

if [[ ! -f "$ROOT/src/mcp-servers/github-oauth/index.js" ]]; then
  error "github-oauth entrypoint missing"
  exit 1
else
  info "github-oauth server entrypoint present"
fi

info "Test installation completed successfully."
