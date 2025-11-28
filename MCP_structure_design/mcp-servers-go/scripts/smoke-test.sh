#!/bin/bash

# Minimal Smoke Test for MCP Advanced Multi-Agent Ecosystem
# Tests that binaries can start and run without crashing

set -e

echo "🔍 MCP Advanced Multi-Agent Ecosystem - Smoke Test"
echo "==================================================="
echo "Testing binary execution on local Mac"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

FAILED=0
PASSED=0

# Check directory
if [ ! -f "go.mod" ]; then
    echo -e "${RED}✗${NC} go.mod not found. Run from mcp-servers-go directory."
    exit 1
fi

# Check binaries
echo "Checking binaries..."
if [ ! -d "dist" ]; then
    echo -e "${RED}✗${NC} dist/ directory not found. Run 'make build' first."
    exit 1
fi

for binary in task-orchestrator search-aggregator skills-manager; do
    if [ -f "dist/$binary" ]; then
        echo -e "${GREEN}✓${NC} $binary exists"
    else
        echo -e "${RED}✗${NC} $binary not found"
        exit 1
    fi
done

echo ""
echo "Testing binary execution..."

# Test each binary
for binary in task-orchestrator search-aggregator skills-manager; do
    echo ""
    echo "Testing $binary..."
    
    # Start binary in background
    ./dist/$binary > /tmp/${binary}_test.log 2>&1 &
    PID=$!
    
    # Wait 3 seconds
    sleep 3
    
    # Check if still running
    if kill -0 $PID 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $binary started and is running (PID: $PID)"
        
        # Kill it
        kill $PID 2>/dev/null || true
        wait $PID 2>/dev/null || true
        
        echo -e "${GREEN}✓${NC} $binary stopped cleanly"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} $binary failed to start or crashed"
        echo "Last 20 lines of output:"
        tail -20 /tmp/${binary}_test.log 2>/dev/null | sed 's/^/  /' || echo "  No output captured"
        ((FAILED++))
    fi
done

echo ""
echo "======================================"
echo "SMOKE TEST SUMMARY"
echo "======================================"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"

if [ $FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 All binaries passed smoke test!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Run integration tests: make test"
    echo "2. Test with MCP client (Roo/Cursor)"
    echo "3. Set up local service management"
    exit 0
else
    echo ""
    echo -e "${RED}❌ Some binaries failed${NC}"
    exit 1
fi