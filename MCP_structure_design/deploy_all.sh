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

# Step 1: Install Task Orchestrator dependencies
print_info "Installing Task Orchestrator dependencies..."
cd mcp-servers/task-orchestrator
npm install
if [ $? -eq 0 ]; then
    print_success "Task Orchestrator dependencies installed"
else
    print_error "Failed to install Task Orchestrator dependencies"
    exit 1
fi

# Step 2: Build Task Orchestrator
print_info "Building Task Orchestrator..."
npm run build
if [ $? -eq 0 ]; then
    print_success "Task Orchestrator built successfully"
else
    print_error "Failed to build Task Orchestrator"
    exit 1
fi

# Step 3: Install Search Aggregator dependencies
print_info "Installing Search Aggregator dependencies..."
cd ../search-aggregator
npm install
if [ $? -eq 0 ]; then
    print_success "Search Aggregator dependencies installed"
else
    print_error "Failed to install Search Aggregator dependencies"
    exit 1
fi

# Step 4: Build Search Aggregator
print_info "Building Search Aggregator..."
npm run build
if [ $? -eq 0 ]; then
    print_success "Search Aggregator built successfully"
else
    print_error "Failed to build Search Aggregator"
    exit 1
fi

# Step 5: Install Python dependencies
print_info "Installing Python dependencies for Context Persistence..."
cd ../context-persistence
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
if [ -f "mcp-servers/task-orchestrator/dist/index.js" ]; then
    print_success "Task Orchestrator build verified"
else
    print_error "Task Orchestrator build missing"
fi

if [ -f "mcp-servers/search-aggregator/dist/index.js" ]; then
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
echo "  2. Task Orchestrator (TypeScript)"
echo "     Location: mcp-servers/task-orchestrator/dist/index.js"
echo "     Test: node mcp-servers/task-orchestrator/dist/index.js"
echo ""
echo "  3. Search Aggregator (TypeScript)"
echo "     Location: mcp-servers/search-aggregator/dist/index.js"
echo "     Test: node mcp-servers/search-aggregator/dist/index.js"
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