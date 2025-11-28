#!/usr/bin/env bash
set -euo pipefail

MACHINE="${MACHINE:-podman-machine-default}"
COMPOSE_FILE="podman-compose.yaml"
CONNECTION="${CONNECTION:-podman-machine-default-root}"

info() { printf "\033[1;34m[start-podman]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[start-podman]\033[0m %s\n" "$*"; }
fail() { printf "\033[1;31m[start-podman]\033[0m %s\n" "$*"; exit 1; }

if ! command -v podman >/dev/null 2>&1; then
  fail "podman is not installed; install it before running this script."
fi

info "Ensuring Podman machine $MACHINE is running"
if ! podman machine start "$MACHINE"; then
  warn "Podman machine $MACHINE is already running or could not be started; continuing"
fi

info "Using podman connection $CONNECTION to bring up $COMPOSE_FILE"
podman --connection "$CONNECTION" compose -f "$COMPOSE_FILE" up --build -d

info "Podman MCP stack is up ($MACHINE). Use podman ps to check containers."
