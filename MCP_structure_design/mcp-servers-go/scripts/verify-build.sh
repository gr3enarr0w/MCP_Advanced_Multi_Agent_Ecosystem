#!/bin/bash

# Build Verification Script for MCP Advanced Multi-Agent Ecosystem
# This script verifies that all MCP servers compile successfully

set -e

echo "🔍 MCP Advanced Multi-Agent Ecosystem - Build Verification"
echo "=========================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track results
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
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "go.mod" ]; then
    print_failure "go.mod not found. Please run this script from the mcp-servers-go directory."
    exit 1
fi

print_info "Found go.mod, starting build verification..."

# Create dist directory if it doesn't exist
mkdir -p dist

# List of servers to build
SERVERS=(
    "task-orchestrator:Task Orchestrator"
    "search-aggregator:Search Aggregator"
    "skills-manager:Skills Manager"
)

echo ""
echo "Building MCP servers..."
echo "----------------------"

for server_info in "${SERVERS[@]}"; do
    IFS=':' read -r server_name display_name <<< "$server_info"
    
    echo ""
    echo "Building $display_name..."
    
    if go build -ldflags="-s -w" -o "dist/$server_name" "./cmd/$server_name" 2>/dev/null; then
        print_success "$display_name built successfully"
        
        # Check binary size
        binary_size=$(du -h "dist/$server_name" | cut -f1)
        print_info "  Binary size: $binary_size"
        
        # Check if binary is static (no dynamic dependencies)
        if ! ldd "dist/$server_name" 2>/dev/null | grep -q "not a dynamic executable"; then
            print_info "  Binary type: Dynamic (has dependencies)"
        else
            print_info "  Binary type: Static (no dependencies)"
        fi
    else
        print_failure "$display_name failed to build"
        echo "  Error details:"
        go build -o "dist/$server_name" "./cmd/$server_name" 2>&1 | sed 's/^/    /'
    fi
done

echo ""
echo "Checking for build artifacts..."
echo "------------------------------"

# Check if all binaries were created
for server_info in "${SERVERS[@]}"; do
    IFS=':' read -r server_name display_name <<< "$server_info"
    
    if [ -f "dist/$server_name" ]; then
        print_success "$display_name binary exists"
    else
        print_failure "$display_name binary missing"
    fi
done

echo ""
echo "Running basic tests..."
echo "---------------------"

# Run go vet
if go vet ./... 2>/dev/null; then
    print_success "go vet passed"
else
    print_failure "go vet failed"
    go vet ./...
fi

# Run go fmt check
if [ -z "$(gofmt -l .)" ]; then
    print_success "Code formatting check passed"
else
    print_failure "Code formatting issues found"
    print_info "Run 'gofmt -w .' to fix formatting"
fi

echo ""
echo "Build verification summary"
echo "========================="

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All builds successful!${NC}"
    echo "✓ $PASSED checks passed"
    echo "✗ $FAILED checks failed"
    echo ""
    echo "All MCP servers are ready for deployment."
    exit 0
else
    echo -e "${RED}Build verification failed!${NC}"
    echo "✓ $PASSED checks passed"
    echo "✗ $FAILED checks failed"
    echo ""
    echo "Please fix the failures above before proceeding."
    exit 1
fi