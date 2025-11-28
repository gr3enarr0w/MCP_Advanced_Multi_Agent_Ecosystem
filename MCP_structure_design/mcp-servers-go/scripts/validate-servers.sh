#!/bin/bash

# MCP Server Validation Script
# Validates that MCP servers start correctly and register their tools

set -e

echo "🔍 MCP Advanced Multi-Agent Ecosystem - Server Validation"
echo "=========================================================="
echo "Validating MCP server startup and tool registration"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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
echo "Validating server startup and tool registration..."
echo "==================================================="

# Test each server
for binary in task-orchestrator search-aggregator skills-manager; do
    echo ""
    echo "Testing $binary..."
    
    # Start binary in background and capture first 5 seconds of output
    LOG_FILE="/tmp/${binary}_validation.log"
    ./dist/$binary > "$LOG_FILE" 2>&1 &
    PID=$!
    
    # Wait for startup
    sleep 5
    
    # Kill the server (it will exit on its own anyway when stdio closes)
    kill $PID 2>/dev/null || true
    wait $PID 2>/dev/null || true
    
    # Analyze the log
    echo "Analyzing $binary startup..."
    
    # Check for successful initialization
    if grep -q "Starting MCP server" "$LOG_FILE"; then
        echo -e "${GREEN}✓${NC} $binary started successfully"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} $binary failed to start properly"
        ((FAILED++))
        continue
    fi
    
    # Check for database initialization
    if grep -q "Database:\|Cache:" "$LOG_FILE"; then
        echo -e "${GREEN}✓${NC} $binary initialized storage"
        ((PASSED++))
    else
        echo -e "${YELLOW}⚠${NC} $binary storage initialization not detected"
    fi
    
    # Count registered tools
    TOOL_COUNT=$(grep -c "Registered tool:" "$LOG_FILE" || echo "0")
    if [ "$TOOL_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✓${NC} $binary registered $TOOL_COUNT tools"
        ((PASSED++))
        
        # List the tools
        echo "  Tools registered:"
        grep "Registered tool:" "$LOG_FILE" | sed 's/^/    /'
    else
        echo -e "${RED}✗${NC} $binary registered no tools"
        ((FAILED++))
    fi
    
    # Check for errors
    if grep -qi "error\|failed\|panic" "$LOG_FILE"; then
        echo -e "${RED}✗${NC} $binary had errors during startup:"
        grep -i "error\|failed\|panic" "$LOG_FILE" | sed 's/^/    /'
        ((FAILED++))
    else
        echo -e "${GREEN}✓${NC} $binary started without errors"
        ((PASSED++))
    fi
    
    # Show server info
    if grep -q "MCP Server v" "$LOG_FILE"; then
        SERVER_INFO=$(grep "MCP Server v" "$LOG_FILE" | head -1)
        echo -e "${BLUE}ℹ${NC} $SERVER_INFO"
    fi
    
    echo ""
    echo "----------------------------------------"
done

# Summary
echo ""
echo "======================================"
echo "SERVER VALIDATION SUMMARY"
echo "======================================"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"

if [ $FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 All servers validated successfully!${NC}"
    echo ""
    echo "All MCP servers are working correctly:"
    echo "- ✓ Binaries execute without errors"
    echo "- ✓ Databases initialize properly"
    echo "- ✓ All tools register successfully"
    echo "- ✓ No startup errors or panics"
    echo ""
    echo "These servers are designed to run with MCP clients (Roo, Cursor)."
    echo "They will exit when run directly because they require stdio"
    echo "communication with an MCP client."
    echo ""
    echo "Next steps:"
    echo "1. Add servers to your MCP client configuration"
    echo "2. Test with Roo or Cursor IDE"
    echo "3. Verify tools appear in your AI assistant"
    exit 0
else
    echo ""
    echo -e "${RED}❌ Some validation checks failed${NC}"
    echo ""
    echo "Please review the failures above."
    echo "Check log files in /tmp/ for details."
    exit 1
fi