#!/bin/bash
set -e

echo "=== MCP Server Deployment Script ==="
echo "Starting deployment at $(date)"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}→${NC} $1"
}

# Change to project root
cd /Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/MCP_structure_design

# Step 1: Build Go servers (task-orchestrator, search-aggregator, skills-manager)
print_info "Building Go MCP servers..."
cd mcp-servers-go
make build
if [ $? -eq 0 ]; then
    print_success "Go MCP servers built successfully"
else
    print_error "Failed to build Go MCP servers"
    exit 1
fi

# Step 2: (Legacy) Search Aggregator TypeScript build skipped in favor of Go binaries
print_info "Skipping legacy TypeScript Search Aggregator build (Go binaries are primary)"
cd ..

# Step 5: Install Python dependencies
print_info "Installing Python dependencies for Context Persistence..."
cd mcp-servers/context-persistence
pip3 install mcp qdrant-client sqlalchemy sentence-transformers tiktoken aiosqlite 2>&1 | tail -10
if [ $? -eq 0 ]; then
    print_success "Python dependencies installed"
else
    print_error "Failed to install Python dependencies"
    exit 1
fi

# Step 6: Verify installations
echo ""
echo "=== Verifying Installations ==="
cd /Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/MCP_structure_design

# Check TypeScript builds
if [ -f "/Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/MCP_structure_design/mcp-servers-go/dist/task-orchestrator" ]; then
    print_success "Task Orchestrator build verified"
else
    print_error "Task Orchestrator build missing"
fi

if [ -f "/Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/MCP_structure_design/mcp-servers-go/dist/search-aggregator" ]; then
    print_success "Search Aggregator build verified"
else
    print_error "Search Aggregator build missing"
fi

# Check Python module
python3 -c "import context_persistence" 2>&1
if [ $? -eq 0 ]; then
    print_success "Context Persistence module verified"
else
    print_error "Context Persistence module not found"
fi

# Step 7: Create summary
echo ""
echo "=== Deployment Summary ==="
echo ""
echo "Deployed servers:"
echo "  1. Context Persistence (Python)"
echo "     Location: mcp-servers/context-persistence/"
echo "     Test: python3 -m context_persistence.server"
echo ""
echo "  2. Task Orchestrator (Go binary)"
echo "     Location: /Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/MCP_structure_design/mcp-servers-go/dist/task-orchestrator"
echo "     Test: /Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/MCP_structure_design/mcp-servers-go/dist/task-orchestrator"
echo ""
echo "  3. Search Aggregator (Go binary)"
echo "     Location: /Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/MCP_structure_design/mcp-servers-go/dist/search-aggregator"
echo "     Test: /Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/MCP_structure_design/mcp-servers-go/dist/search-aggregator"
echo ""
echo "Storage locations:"
echo "  ~/.mcp/context/      - Conversation history & vectors"
echo "  ~/.mcp/tasks/        - Task database"
echo "  ~/.mcp/cache/search/ - Search cache"
echo ""
echo "Next steps:"
echo "  1. Configure MCP settings in Roo/Cursor"
echo "  2. Set API keys (PERPLEXITY_API_KEY, BRAVE_API_KEY)"
echo "  3. Test each server independently"
echo "  4. Integration test with Roo/Cursor"
echo ""
print_success "Deployment complete at $(date)"
