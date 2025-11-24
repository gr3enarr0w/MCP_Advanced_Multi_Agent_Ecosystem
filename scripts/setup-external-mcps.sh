#!/bin/bash
#
# Setup External MCP Servers (Git Submodules)
#
# External MCPs are configured as git submodules:
#   - context7 (documentation/context lookup from Upstash)
#   - mcp-code-checker (code quality: pylint, pytest, mypy)
#
# These are installed as INTERNAL dependencies of agent-swarm.
# Roo Code only talks to agent-swarm, which delegates to these internally.
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
EXTERNAL_MCPS_DIR="$PROJECT_ROOT/src/mcp-servers/external"

echo "=========================================="
echo "Setting up External MCP Servers"
echo "=========================================="
echo ""
echo "These servers are git submodules internal to agent-swarm:"
echo "  - context7 (documentation/context lookup)"
echo "  - mcp-code-checker (code quality: pylint, pytest, mypy)"
echo ""
echo "Roo Code will NOT see these directly."
echo "agent-swarm routes to them via the 'delegate' tool."
echo ""

#############################################
# Initialize Git Submodules
#############################################
echo "----------------------------------------"
echo "1. Initializing git submodules..."
echo "----------------------------------------"

cd "$PROJECT_ROOT"

# Initialize and update submodules
git submodule update --init --recursive || {
  echo "Warning: Submodule initialization had issues."
  echo "You may need to run: git submodule add <url> <path>"
}

echo "Submodules initialized."
echo ""

#############################################
# Context7 Setup (TypeScript)
#############################################
echo "----------------------------------------"
echo "2. Setting up Context7..."
echo "----------------------------------------"

CONTEXT7_DIR="$EXTERNAL_MCPS_DIR/context7"

if [ -d "$CONTEXT7_DIR" ] && [ -f "$CONTEXT7_DIR/package.json" ]; then
  echo "Installing Context7 dependencies..."
  cd "$CONTEXT7_DIR"
  npm install 2>/dev/null || echo "npm install skipped"

  if [ -f "tsconfig.json" ]; then
    echo "Building Context7..."
    npm run build 2>/dev/null || echo "Build skipped (check tsconfig)"
  fi
  echo "Context7 setup complete."
else
  echo "Warning: Context7 not found. Add submodule with:"
  echo "  git submodule add https://github.com/upstash/context7.git src/mcp-servers/external/context7"
fi
echo ""

#############################################
# MCP Code Checker Setup (Python)
#############################################
echo "----------------------------------------"
echo "3. Setting up MCP Code Checker..."
echo "----------------------------------------"

CODE_CHECKER_DIR="$EXTERNAL_MCPS_DIR/mcp-code-checker"

if [ -d "$CODE_CHECKER_DIR" ] && [ -f "$CODE_CHECKER_DIR/pyproject.toml" ]; then
  echo "Installing MCP Code Checker..."
  cd "$CODE_CHECKER_DIR"
  pip install -e . 2>/dev/null || {
    echo "pip install failed. Trying with pip3..."
    pip3 install -e . 2>/dev/null || echo "Installation failed - check Python environment"
  }
  echo "MCP Code Checker setup complete."
else
  echo "Warning: MCP Code Checker not found. Add submodule with:"
  echo "  git submodule add https://github.com/MarcusJellinghaus/mcp-code-checker.git src/mcp-servers/external/mcp-code-checker"
fi
echo ""

#############################################
# Generate env config
#############################################
echo "----------------------------------------"
echo "4. Generating environment configuration..."
echo "----------------------------------------"

ENV_FILE="$PROJECT_ROOT/.env.external-mcps"

cat > "$ENV_FILE" << EOF
# External MCP Server Configuration
# These paths are used by agent-swarm internally
# Source this file or add to ~/.mcp/roo-mcp.env

# Context7 Configuration (TypeScript/Node)
CONTEXT7_MCP_CMD=node
CONTEXT7_MCP_ARGS=$CONTEXT7_DIR/dist/index.js
# CONTEXT7_API_KEY=your-upstash-api-key-here
# CONTEXT7_PROJECT=your-project-id-here

# MCP Code Checker Configuration (Python)
# Installed via pip, available as 'mcp-code-checker' command
MCP_CODE_CHECKER_CMD=mcp-code-checker
MCP_CODE_CHECKER_PROJECT_DIR=\${PWD}
# Optionally specify Python executable
# MCP_CODE_CHECKER_PYTHON=/path/to/python3

EOF

echo "Environment config written to: $ENV_FILE"
echo ""

#############################################
# Verify installations
#############################################
echo "----------------------------------------"
echo "5. Verifying installations..."
echo "----------------------------------------"

echo ""
echo "Context7:"
if [ -f "$CONTEXT7_DIR/dist/index.js" ]; then
  echo "  [OK] Built successfully: $CONTEXT7_DIR/dist/index.js"
elif [ -f "$CONTEXT7_DIR/src/index.ts" ]; then
  echo "  [WARN] Source exists but not built. Run: cd $CONTEXT7_DIR && npm run build"
else
  echo "  [MISSING] Not found - add submodule first"
fi

echo ""
echo "MCP Code Checker:"
if command -v mcp-code-checker &> /dev/null; then
  echo "  [OK] Installed and available in PATH"
  mcp-code-checker --help 2>&1 | head -2 || true
elif [ -f "$CODE_CHECKER_DIR/pyproject.toml" ]; then
  echo "  [WARN] Source exists but not installed. Run: cd $CODE_CHECKER_DIR && pip install -e ."
else
  echo "  [MISSING] Not found - add submodule first"
fi

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Review and update: $ENV_FILE"
echo "2. Add any required API keys"
echo "3. Rebuild agent-swarm: cd $PROJECT_ROOT/src/mcp-servers/agent-swarm && npm run build"
echo "4. The 'delegate' tool in agent-swarm will now route to these servers"
echo ""
echo "Routing keywords:"
echo "  - 'doc/manual/spec/reference' -> context7"
echo "  - 'lint/pylint/pytest/mypy/code quality' -> mcp-code-checker"
echo "  - 'search/web/lookup/find' -> search-aggregator"
echo "  - Default -> task-orchestrator"
echo ""
