#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PYTHON="${PYTHON:-python3.12}"
PIP_INDEX_URL="${PIP_INDEX_URL:-https://pypi.org/simple}"
PIP_TRUSTED_HOST="${PIP_TRUSTED_HOST:-pypi.org}"
SYSTEM_PYTHON="${SYSTEM_PYTHON:-python3.12}"
GLOBAL_USER_SITE="$("$SYSTEM_PYTHON" -c 'import site; print(site.USER_SITE)')"
GLOBAL_SITE_PACKAGES="$("$SYSTEM_PYTHON" -c 'import site; print("\n".join(site.getsitepackages()))')"
if [[ -n "${VIRTUAL_ENV:-}" ]]; then
  PIP_OPTS="${PIP_OPTS:---break-system-packages}"
else
  PIP_OPTS="${PIP_OPTS:---user --break-system-packages}"
fi

info() {
  printf "\033[1;34m[install]\033[0m %s\n" "$*"
}

error() {
  printf "\033[1;31m[install]\033[0m %s\n" "$*"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    error "command not found: $1"
    exit 1
  fi
}

require_command "$PYTHON"
require_command node
require_command npm

"$PYTHON" -m pip install $PIP_OPTS --upgrade pip setuptools wheel || {
  error "pip/setuptools/wheel upgrade failed; continuing with existing versions"
}
info "Installing Python dependencies for context persistence"
PY_DIR="$ROOT/src/mcp-servers/context-persistence"
  if [[ -n "${VIRTUAL_ENV:-}" ]]; then
    VENV_SITE="$VIRTUAL_ENV/lib/python$( "$PYTHON" -c 'import sys; print(".".join(map(str, sys.version_info[:2])))' )/site-packages"
    mkdir -p "$VENV_SITE"
    {
      printf "%s\n" "$GLOBAL_USER_SITE"
      while IFS= read -r line; do
        printf "%s\n" "$line"
      done <<< "$GLOBAL_SITE_PACKAGES"
      printf "%s\n" "$ROOT/src/mcp-servers/context-persistence/src"
    } > "$VENV_SITE/mcp_ext.pth"
    info "Virtualenv active; context persistence source linked via .pth"
  else
    "$PYTHON" -m pip install $PIP_OPTS -e "$PY_DIR"
  fi
"$PYTHON" -m pip install $PIP_OPTS greenlet

has_build_script() {
  node -e '
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const dir = process.argv[1];
try {
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  console.log(pkg.scripts && pkg.scripts.build ? "true" : "false");
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
' "$1"
}

install_node_server() {
  local pkg_dir="$1"
  local pkg_name has_build
  pkg_name="$(basename "$pkg_dir")"
  info "Installing Node dependencies for $pkg_name"
  npm install --prefix "$pkg_dir"

  has_build="$(has_build_script "$pkg_dir")"
  if [[ "$has_build" == "true" ]]; then
    info "Building $pkg_name"
    npm run build --prefix "$pkg_dir"
  else
    info "Skipping build (no build script) for $pkg_name"
  fi
}

for pkg_dir in "$ROOT/src/mcp-servers"/*/; do
  [ -f "${pkg_dir}package.json" ] || continue
  install_node_server "$pkg_dir"
done

info "All MCP servers installed"
