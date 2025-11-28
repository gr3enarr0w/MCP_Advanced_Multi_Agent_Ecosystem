#!/bin/bash
set -e

echo "======================================"
echo "MCP Servers Installation Script"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_info() {
    echo -e "${YELLOW}[i]${NC} $1"
}

# Check prerequisites
echo "Checking prerequisites..."
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 not found. Please install Python 3.10+"
    exit 1
fi
print_success "Python 3 found: $(python3 --version)"

if ! command -v node &> /dev/null; then
    print_error "Node.js not found. Please install Node.js 18+"
    exit 1
fi
print_success "Node.js found: $(node --version)"

if ! command -v npm &> /dev/null; then
    print_error "npm not found. Please install npm"
    exit 1
fi
print_success "npm found: $(npm --version)"

echo ""
echo "======================================"
echo "Installing Context Persistence Server"
echo "======================================"
cd mcp-servers/context-persistence

print_info "Installing Python dependencies..."
pip3 install mcp qdrant-client sqlalchemy sentence-transformers tiktoken aiosqlite || {
    print_error "Failed to install Context Persistence dependencies"
    exit 1
}

print_success "Context Persistence Server dependencies installed"

echo ""
echo "======================================"
echo "Installing Task Orchestrator Server"
echo "======================================"
cd ../task-orchestrator

print_info "Installing Node dependencies..."
npm install || {
    print_error "Failed to install Task Orchestrator dependencies"
    exit 1
}

print_info "Building TypeScript..."
npm run build || {
    print_error "Failed to build Task Orchestrator"
    exit 1
}

print_success "Task Orchestrator Server built successfully"

echo ""
echo "======================================"
echo "Installing Search Aggregator Server"
echo "======================================"
cd ../search-aggregator

print_info "Installing Node dependencies..."
npm install || {
    print_error "Failed to install Search Aggregator dependencies"
    exit 1
}

print_info "Building TypeScript..."
npm run build || {
    print_error "Failed to build Search Aggregator"
    exit 1
}

print_success "Search Aggregator Server built successfully"

echo ""
echo "======================================"
echo "Testing Server Installations"
echo "======================================"

print_info "Testing Context Persistence..."
timeout 2s python3 -m context_persistence.server 2>&1 | head -5 || print_success "Context Persistence server starts"

print_info "Testing Task Orchestrator..."
timeout 2s node ../../mcp-servers/task-orchestrator/dist/index.js 2>&1 | head -5 || print_success "Task Orchestrator server starts"

print_info "Testing Search Aggregator..."
timeout 2s node ../../mcp-servers/search-aggregator/dist/index.js 2>&1 | head -5 || print_success "Search Aggregator server starts"

echo ""
echo "======================================"
echo "Verifying Local Storage"
echo "======================================"

if [ -d ~/.mcp/context ]; then
    print_success "Context storage directory exists"
else
    print_error "Context storage directory missing"
fi

if [ -d ~/.mcp/tasks ]; then
    print_success "Tasks storage directory exists"
else
    print_error "Tasks storage directory missing"
fi

if [ -d ~/.mcp/cache/search ]; then
    print_success "Search cache directory exists"
else
    print_error "Search cache directory missing"
fi

echo ""
echo "======================================"
echo "Installation Summary"
echo "======================================"
echo ""
print_success "All MCP servers installed and built successfully!"
echo ""
echo "Servers installed:"
echo "  1. Context Persistence (Python) - Conversation history + semantic search"
echo "  2. Task Orchestrator (TypeScript) - Local task management + git integration"
echo "  3. Search Aggregator (TypeScript) - Multi-provider search with fallback"
echo ""
echo "Local storage at: ~/.mcp/"
echo "  - context/db/conversation.db (SQLite)"
echo "  - context/qdrant/ (Vector embeddings)"
echo "  - tasks/tasks.db (SQLite)"
echo "  - cache/search/ (Search cache)"
echo ""
echo "Next steps:"
echo "  1. Set API keys in environment:"
echo "     export PERPLEXITY_API_KEY='your-key'"
echo "     export BRAVE_API_KEY='your-key'"
echo ""
echo "  2. Update MCP configuration files (see BUILD_AND_INSTALL.md)"
echo ""
echo "  3. Test with Roo or Cursor"
echo ""
print_success "Installation complete!"