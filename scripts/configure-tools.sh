#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MCP_HOME="$HOME/.mcp"
GO_DIST="/Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/MCP_structure_design/mcp-servers-go/dist"

ROO_DIR="$HOME/Library/Application Support/Cursor/User/globalStorage/rooveterinaryinc.roo-cline/settings"
ROO_CONFIG="$ROO_DIR/mcp_settings.json"
ROO_ALT_CONFIG="$HOME/.roo/mcp.json"
CURSOR_CONFIG="$HOME/.cursor/mcp.json"

info() {
  printf "\033[1;34m[config]\033[0m %s\n" "$*"
}

write_json() {
  cat <<EOF > "$1"
{
  "mcpServers": {
    "context-persistence": {
      "command": "python3",
      "args": [
        "-m",
        "context_persistence.server"
      ],
      "env": {
        "PYTHONPATH": "$ROOT/src/mcp-servers/context-persistence/src",
        "CONTEXT_DB": "$MCP_HOME/context/db/conversation.db",
        "QDRANT_PATH": "$MCP_HOME/context/qdrant"
      }
    },
    "task-orchestrator": {
      "command": "$GO_DIST/task-orchestrator",
      "args": [],
      "env": {
        "MCP_DATABASE_DIR": "$MCP_HOME/tasks",
        "MCP_LOG_LEVEL": "info"
      }
    },
    "search-aggregator": {
      "command": "$GO_DIST/search-aggregator",
      "args": [],
      "env": {
        "MCP_DATABASE_DIR": "$MCP_HOME/cache",
        "MCP_LOG_LEVEL": "info",
        "PERPLEXITY_API_KEY": "",
        "BRAVE_API_KEY": "",
        "GOOGLE_API_KEY": "",
        "GOOGLE_CSE_ID": ""
      }
    },
    "agent-swarm": {
      "command": "node",
      "args": [
        "$ROOT/src/mcp-servers/agent-swarm/dist/index.js"
      ],
      "env": {
        "AGENT_STORAGE": "$MCP_HOME/agents/agent-swarm.db"
      }
    },
    "skills-manager": {
      "command": "$GO_DIST/skills-manager",
      "args": [],
      "env": {
        "MCP_DATABASE_DIR": "$MCP_HOME/skills",
        "MCP_LOG_LEVEL": "info"
      }
    },
    "github-oauth": {
      "command": "node",
      "args": [
        "$ROOT/src/mcp-servers/github-oauth/index.js"
      ],
      "env": {
        "PORT": "4000"
      }
    }
  }
}
EOF
}

info "Updating Roo configuration ($ROO_CONFIG)"
mkdir -p "$ROO_DIR"
write_json "$ROO_CONFIG"

info "Updating Roo legacy config ($ROO_ALT_CONFIG)"
mkdir -p "$(dirname "$ROO_ALT_CONFIG")"
write_json "$ROO_ALT_CONFIG"

info "Updating Cursor configuration ($CURSOR_CONFIG)"
mkdir -p "$(dirname "$CURSOR_CONFIG")"
write_json "$CURSOR_CONFIG"

info "Configuration files written. Seed empty API keys or secrets in your env files before launching Roo/agents."
