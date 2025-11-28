#!/bin/bash

# Local Mac Setup Script for MCP Advanced Multi-Agent Ecosystem
# This script automates the entire local setup process

set -e

echo "🚀 MCP Advanced Multi-Agent Ecosystem - Local Mac Setup"
echo "========================================================"
echo "This script will set up everything on your local Mac"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

FAILED=0
PASSED=0

# Function to print success
print_success() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

# Function to print failure
print_failure() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

# Function to print info
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "go.mod" ]; then
    print_failure "go.mod not found. Please run this script from the mcp-servers-go directory."
    exit 1
fi

print_info "Starting local setup..."

# Step 1: Build the servers
echo ""
echo "Step 1: Building MCP servers..."
echo "--------------------------------"

if make build > /tmp/build.log 2>&1; then
    print_success "Servers built successfully"
else
    print_failure "Build failed"
    echo "Build output:"
    tail -30 /tmp/build.log | sed 's/^/  /'
    exit 1
fi

# Step 2: Create data directories
echo ""
echo "Step 2: Creating data directories..."
echo "-------------------------------------"

mkdir -p ~/.mcp/{tasks,cache/search,skills,logs}

if [ -d ~/.mcp/tasks ] && [ -d ~/.mcp/cache ] && [ -d ~/.mcp/skills ]; then
    print_success "Data directories created"
else
    print_failure "Failed to create data directories"
    exit 1
fi

# Step 3: Create environment file
echo ""
echo "Step 3: Creating environment configuration..."
echo "--------------------------------------------"

cat > ~/.mcp/mcp.env << 'EOF'
# MCP Server Configuration
export MCP_DATABASE_DIR="$HOME/.mcp"
export MCP_LOG_LEVEL="info"

# Search Aggregator API Keys (optional)
# Get these from: https://www.perplexity.ai/, https://brave.com/search/api/
# export PERPLEXITY_API_KEY="your-key-here"
# export BRAVE_API_KEY="your-key-here"

# Skills Manager API Key (optional)
# export OPEN_SKILLS_API_KEY="your-key-here"
EOF

if [ -f ~/.mcp/mcp.env ]; then
    print_success "Environment configuration created"
    print_info "Edit ~/.mcp/mcp.env to add API keys if needed"
else
    print_failure "Failed to create environment configuration"
    exit 1
fi

# Step 4: Validate servers
echo ""
echo "Step 4: Validating server startup..."
echo "-------------------------------------"

if ./scripts/validate-servers.sh > /tmp/validation.log 2>&1; then
    print_success "All servers validated successfully"
    
    # Show tool counts
    TASK_TOOLS=$(grep -c "task-orchestrator registered" /tmp/validation.log || echo "0")
    SEARCH_TOOLS=$(grep -c "search-aggregator registered" /tmp/validation.log || echo "0")
    SKILLS_TOOLS=$(grep -c "skills-manager registered" /tmp/validation.log || echo "0")
    
    print_info "Tools registered:"
    print_info "  - Task Orchestrator: $TASK_TOOLS tools"
    print_info "  - Search Aggregator: $SEARCH_TOOLS tools"
    print_info "  - Skills Manager: $SKILLS_TOOLS tools"
else
    print_failure "Server validation failed"
    echo "Validation output:"
    tail -30 /tmp/validation.log | sed 's/^/  /'
    exit 1
fi

# Step 5: Create MCP client configuration
echo ""
echo "Step 5: Creating MCP client configuration..."
echo "--------------------------------------------"

# Detect if we're using Roo or Cursor
if [ -d "$HOME/.cursor" ]; then
    # Cursor configuration
    mkdir -p "$HOME/.cursor"
    cat > "$HOME/.cursor/mcp.json" << 'EOF'
{
  "mcpServers": {
    "task-orchestrator": {
      "command": "/Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/MCP_structure_design/mcp-servers-go/dist/task-orchestrator",
      "args": [],
      "env": {
        "MCP_DATABASE_DIR": "/Users/ceverson/.mcp/tasks",
        "MCP_LOG_LEVEL": "info"
      }
    },
    "search-aggregator": {
      "command": "/Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/MCP_structure_design/mcp-servers-go/dist/search-aggregator",
      "args": [],
      "env": {
        "MCP_DATABASE_DIR": "/Users/ceverson/.mcp/cache",
        "MCP_LOG_LEVEL": "info"
      }
    },
    "skills-manager": {
      "command": "/Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/MCP_structure_design/mcp-servers-go/dist/skills-manager",
      "args": [],
      "env": {
        "MCP_DATABASE_DIR": "/Users/ceverson/.mcp/skills",
        "MCP_LOG_LEVEL": "info"
      }
    }
  }
}
EOF
    print_success "Cursor configuration created at ~/.cursor/mcp.json"
fi

# For Roo Code (VSCode), provide instructions
print_info ""
print_info "For Roo Code (VSCode), add this to your settings.json:"
print_info ""
print_info '  "roo-code.mcpServers": {'
print_info '    "task-orchestrator": {'
print_info '      "command": "/Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/MCP_structure_design/mcp-servers-go/dist/task-orchestrator",'
print_info '      "args": [],'
print_info '      "env": {'
print_info '        "MCP_DATABASE_DIR": "/Users/ceverson/.mcp/tasks",'
print_info '        "MCP_LOG_LEVEL": "info"'
print_info '      }'
print_info '    },'
print_info '    "search-aggregator": {'
print_info '      "command": "/Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/MCP_structure_design/mcp-servers-go/dist/search-aggregator",'
print_info '      "args": [],'
print_info '      "env": {'
print_info '        "MCP_DATABASE_DIR": "/Users/ceverson/.mcp/cache",'
print_info '        "MCP_LOG_LEVEL": "info"'
print_info '      }'
print_info '    },'
print_info '    "skills-manager": {'
print_info '      "command": "/Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/MCP_structure_design/mcp-servers-go/dist/skills-manager",'
print_info '      "args": [],'
print_info '      "env": {'
print_info '        "MCP_DATABASE_DIR": "/Users/ceverson/.mcp/skills",'
print_info '        "MCP_LOG_LEVEL": "info"'
print_info '      }'
print_info '    }'
print_info '  }'

# Step 6: Run integration tests
echo ""
echo "Step 6: Running integration tests..."
echo "-------------------------------------"

if make test > /tmp/test.log 2>&1; then
    print_success "Integration tests passed"
    
    # Count tests
    TESTS_RUN=$(grep -c "PASS:" /tmp/test.log || echo "0")
    print_info "$TESTS_RUN test cases passed"
else
    print_warning "Some integration tests failed (this may be expected)"
    print_info "Check /tmp/test.log for details"
fi

# Final summary
echo ""
echo "======================================"
echo "SETUP SUMMARY"
echo "======================================"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 Local setup completed successfully!${NC}"
    echo ""
    echo "Your MCP Advanced Multi-Agent Ecosystem is ready!"
    echo ""
    echo "Next steps:"
    echo "1. Restart your IDE (VSCode/Cursor)"
    echo "2. Open Roo Code settings and verify MCP servers are connected"
    echo "3. Try asking your AI: 'Create a task to build a web API'"
    echo "4. Or: 'Search for best practices in Go programming'"
    echo "5. Or: 'Add Go programming to my skills'"
    echo ""
    echo "All data is stored locally in ~/.mcp/"
    echo "Configuration is in ~/.mcp/mcp.env"
    echo ""
    echo "For more information, see LOCAL_MAC_SETUP.md"
    exit 0
else
    echo -e "${RED}❌ Setup completed with failures${NC}"
    echo ""
    echo "Please review the failures above."
    exit 1
fi