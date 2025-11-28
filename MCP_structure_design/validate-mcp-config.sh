#!/bin/bash
# MCP Configuration Validation Script

set -e

echo "🔍 Validating MCP Configuration Files..."

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "config/roo_mcp_config.json" ]; then
    print_error "Please run this script from the MCP Advanced Multi-Agent Ecosystem root directory"
    exit 1
fi

# Validate JSON files
echo ""
echo "📋 Validating JSON configuration files..."

# Check roo_mcp_config.json
if command -v python3 >/dev/null 2>&1; then
    if python3 -m json.tool config/roo_mcp_config.json >/dev/null 2>&1; then
        print_success "config/roo_mcp_config.json is valid JSON"
    else
        print_error "config/roo_mcp_config.json is invalid JSON"
        exit 1
    fi
else
    print_warning "python3 not available, skipping JSON validation"
fi

# Check if all referenced files exist
echo ""
echo "📂 Checking referenced files..."

# Check Context Persistence
CONTEXT_SERVER_PATH="mcp-servers/context-persistence/src/context_persistence/server.py"
if [ -f "$CONTEXT_SERVER_PATH" ]; then
    print_success "Context Persistence server file exists"
else
    print_error "Context Persistence server file not found: $CONTEXT_SERVER_PATH"
fi

# Check Task Orchestrator
TASK_SERVER_PATH="mcp-servers/task-orchestrator/dist/index.js"
if [ -f "$TASK_SERVER_PATH" ]; then
    print_success "Task Orchestrator server file exists"
else
    print_warning "Task Orchestrator server file not found: $TASK_SERVER_PATH (run npm run build)"
fi

# Check Search Aggregator
SEARCH_SERVER_PATH="mcp-servers/search-aggregator/dist/index.js"
if [ -f "$SEARCH_SERVER_PATH" ]; then
    print_success "Search Aggregator server file exists"
else
    print_warning "Search Aggregator server file not found: $SEARCH_SERVER_PATH (run npm run build)"
fi

# Check Skills Manager
SKILLS_SERVER_PATH="mcp-servers/skills-manager/dist/index.js"
if [ -f "$SKILLS_SERVER_PATH" ]; then
    print_success "Skills Manager server file exists"
else
    print_warning "Skills Manager server file not found: $SKILLS_SERVER_PATH (run npm run build)"
fi

# Check Agent Swarm
AGENT_SWARM_PATH="mcp-servers/agent-swarm/dist/index.js"
if [ -f "$AGENT_SWARM_PATH" ]; then
    print_success "Agent Swarm server file exists"
else
    print_warning "Agent Swarm server file not found: $AGENT_SWARM_PATH (run npm run build)"
fi

# Validate environment variables
echo ""
echo "🔧 Validating environment configuration..."

# Check for .env.local
if [ -f ".env.local" ]; then
    print_success ".env.local configuration file exists"
    
    # Check for required variables
    if grep -q "PYTHONPATH" .env.local; then
        print_success "PYTHONPATH configured"
    else
        print_warning "PYTHONPATH not found in .env.local"
    fi
    
    if grep -q "NODE_ENV" .env.local; then
        print_success "NODE_ENV configured"
    else
        print_warning "NODE_ENV not found in .env.local"
    fi
else
    print_warning ".env.local not found (run ./setup-local-development.sh)"
fi

# Check for API keys
echo ""
echo "🔑 Checking API keys..."

if [ -n "$PERPLEXITY_API_KEY" ]; then
    print_success "PERPLEXITY_API_KEY is set"
else
    print_warning "PERPLEXITY_API_KEY not set (optional)"
fi

if [ -n "$BRAVE_API_KEY" ]; then
    print_success "BRAVE_API_KEY is set"
else
    print_warning "BRAVE_API_KEY not set (optional)"
fi

if [ -n "$GOOGLE_API_KEY" ]; then
    print_success "GOOGLE_API_KEY is set"
else
    print_warning "GOOGLE_API_KEY not set (optional)"
fi

# Check directory structure
echo ""
echo "📁 Validating directory structure..."

DIRS=(
    "mcp-servers/context-persistence"
    "mcp-servers/task-orchestrator"
    "mcp-servers/search-aggregator"
    "mcp-servers/skills-manager"
    "mcp-servers/agent-swarm"
    "config"
)

for dir in "${DIRS[@]}"; do
    if [ -d "$dir" ]; then
        print_success "Directory exists: $dir"
    else
        print_error "Directory missing: $dir"
    fi
done

# Check for required files
echo ""
echo "📄 Checking required files..."

REQUIRED_FILES=(
    "mcp-servers/context-persistence/pyproject.toml"
    "mcp-servers/task-orchestrator/package.json"
    "mcp-servers/search-aggregator/package.json"
    "mcp-servers/skills-manager/package.json"
    "mcp-servers/agent-swarm/package.json"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        print_success "Required file exists: $file"
    else
        print_error "Required file missing: $file"
    fi
done

# Check Node.js dependencies
echo ""
echo "📦 Checking Node.js dependencies..."

if command -v npm >/dev/null 2>&1; then
    print_success "npm is available"
    
    # Check if node_modules exist in key servers
    if [ -d "mcp-servers/agent-swarm/node_modules" ]; then
        print_success "Agent Swarm dependencies installed"
    else
        print_warning "Agent Swarm dependencies not installed (run npm install)"
    fi
    
    if [ -d "mcp-servers/task-orchestrator/node_modules" ]; then
        print_success "Task Orchestrator dependencies installed"
    else
        print_warning "Task Orchestrator dependencies not installed (run npm install)"
    fi
else
    print_error "npm not found - Node.js dependencies cannot be checked"
fi

# Check Python dependencies
echo ""
echo "🐍 Checking Python dependencies..."

if command -v python3 >/dev/null 2>&1; then
    print_success "python3 is available"
    
    # Check if virtual environment exists
    if [ -d "mcp-servers/context-persistence/.venv" ]; then
        print_success "Python virtual environment exists"
    else
        print_warning "Python virtual environment not found (run ./setup-local-development.sh)"
    fi
else
    print_error "python3 not found - Python dependencies cannot be checked"
fi

# Summary
echo ""
echo "📊 Validation Summary"
echo "====================="

# Count results
SUCCESS_COUNT=$(echo "$OUTPUT" | grep -c "✅" || true)
WARNING_COUNT=$(echo "$OUTPUT" | grep -c "⚠️" || true)
ERROR_COUNT=$(echo "$OUTPUT" | grep -c "❌" || true)

echo "Successes: $SUCCESS_COUNT"
echo "Warnings: $WARNING_COUNT"
echo "Errors: $ERROR_COUNT"

if [ $ERROR_COUNT -eq 0 ]; then
    print_success "Configuration validation passed!"
    echo ""
    echo "🚀 Next steps:"
    echo "   1. Run ./setup-local-development.sh to complete setup"
    echo "   2. Run ./test-mcp-servers.sh to test all servers"
    echo "   3. Run ./start-mcp-servers.sh to start the ecosystem"
    echo "   4. Configure your MCP client (Roo, Cursor, etc.) with config/roo_mcp_config.json"
    exit 0
else
    print_error "Configuration validation failed with $ERROR_COUNT errors"
    echo ""
    echo "🔧 Please fix the errors above before proceeding"
    exit 1
fi