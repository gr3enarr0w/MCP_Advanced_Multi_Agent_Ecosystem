#!/bin/bash

# Final End-to-End Test for Complete MCP Ecosystem
# Tests everything and reports results

set -e

echo "🔍 FINAL END-TO-END TEST - Complete MCP Ecosystem"
echo "=================================================="
echo "Testing all servers and generating report..."
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

FAILED=0
PASSED=0
TOTAL_TESTS=0

log_test() {
    echo "$1" >> /tmp/mcp-final-test.log
}

print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} $2"
        ((FAILED++))
    fi
    ((TOTAL_TESTS++))
    log_test "$2: $([ $1 -eq 0 ] && echo "PASS" || echo "FAIL")"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Start logging
echo "MCP Ecosystem Final Test - $(date)" > /tmp/mcp-final-test.log

# ===================================================================
# Go Rewrite Servers (PRIMARY - USE THESE)
# ===================================================================

echo ""
echo "Testing Go Rewrite Servers (PRIMARY - USE THESE)..."
echo "----------------------------------------------------"

# Check binaries
for server in task-orchestrator search-aggregator skills-manager; do
    if [ -f "dist/$server" ]; then
        print_result 0 "Go $server binary exists (PRODUCTION)"
        
        # Test execution
        if ./dist/$server > /dev/null 2>&1 & then
            PID=$!
            sleep 2
            if kill -0 $PID 2>/dev/null; then
                print_result 0 "Go $server executes without errors"
                kill $PID 2>/dev/null || true
                wait $PID 2>/dev/null || true
            else
                print_result 1 "Go $server failed during execution"
            fi
        fi
    else
        print_result 1 "Go $server binary not found"
    fi
done

# ===================================================================
# Legacy TypeScript Servers (DEPRECATED - DO NOT USE)
# ===================================================================

echo ""
echo "Checking Legacy TypeScript Servers (DEPRECATED - DO NOT USE)..."
echo "----------------------------------------------------------------"

cd ../mcp-servers

for server in agent-swarm task-orchestrator search-aggregator skills-manager; do
    if [ -d "$server" ]; then
        print_warning "LEGACY TypeScript $server directory exists (DEPRECATED)"
        
        if [ -f "$server/dist/index.js" ]; then
            print_warning "LEGACY TypeScript $server is built (DO NOT USE - Use Go version)"
        else
            print_info "LEGACY TypeScript $server not built (correct - use Go version)"
        fi
    else
        print_info "LEGACY TypeScript $server not found (good - use Go version)"
    fi
done

cd ../mcp-servers-go

# ===================================================================
# Python Servers (Intentionally Kept)
# ===================================================================

echo ""
echo "Checking Python Servers (Intentionally Kept)..."
echo "------------------------------------------------"

if [ -d "../mcp-servers/context-persistence" ]; then
    print_result 0 "Context Persistence server exists (Python - ML requirements)"
    
    if [ -f "../mcp-servers/context-persistence/src/context_persistence/server.py" ]; then
        print_result 0 "Context Persistence Python code exists"
    fi
    
    # Check Python environment
    if python3 -c "import mcp" 2>/dev/null; then
        print_result 0 "Python MCP SDK available"
    else
        print_result 1 "Python MCP SDK not installed"
    fi
    
    if python3 -c "import qdrant_client" 2>/dev/null; then
        print_result 0 "Qdrant client available"
    else
        print_result 1 "Qdrant client not installed"
    fi
else
    print_result 1 "Context Persistence server not found"
fi

# ===================================================================
# GitHub Integration
# ===================================================================

echo ""
echo "Checking GitHub Integration..."
echo "-------------------------------"

if [ -d "../mcp-servers/github-oauth" ]; then
    print_result 0 "GitHub OAuth server exists"
    
    if [ -f "../mcp-servers/github-oauth/index.js" ]; then
        print_result 0 "GitHub OAuth index.js exists"
    fi
    
    if [ -f "../mcp-servers/github-oauth/.env" ]; then
        print_result 0 "GitHub OAuth .env exists"
        if grep -q "GITHUB_TOKEN" "../mcp-servers/github-oauth/.env"; then
            print_result 0 "GitHub token configured"
        else
            print_result 1 "GitHub token not configured"
        fi
    else
        print_result 1 "GitHub OAuth .env not found"
    fi
else
    print_result 1 "GitHub OAuth server not found"
fi

# ===================================================================
# Integration Tests
# ===================================================================

echo ""
echo "Running Integration Tests..."
echo "-----------------------------"

if go test -v ./test/integration/... > /tmp/integration.log 2>&1; then
    TEST_COUNT=$(grep -c "PASS:" /tmp/integration.log || echo "0")
    print_result 0 "Integration tests passed ($TEST_COUNT tests)"
else
    print_result 1 "Integration tests failed"
fi

# ===================================================================
# Configuration
# ===================================================================

echo ""
echo "Checking Configuration..."
echo "-------------------------"

if [ -f "config/mcp-servers.json" ]; then
    print_result 0 "MCP servers configuration exists"
else
    print_result 1 "MCP servers configuration missing"
fi

if [ -f "LOCAL_MAC_SETUP.md" ]; then
    print_result 0 "Setup documentation exists"
else
    print_result 1 "Setup documentation missing"
fi

if [ -f "DEPRECATION_NOTICE.md" ]; then
    print_result 0 "Deprecation notice exists"
else
    print_result 1 "Deprecation notice missing"
fi

if [ -f "FINAL_STATUS.md" ]; then
    print_result 0 "Final status documentation exists"
else
    print_result 1 "Final status documentation missing"
fi

# ===================================================================
# FINAL REPORT
# ===================================================================

echo ""
echo "======================================"
echo "FINAL TEST REPORT"
echo "======================================"
echo "Total tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

echo "IMPORTANT: Legacy TypeScript servers are DEPRECATED"
echo "Use ONLY the Go implementations in mcp-servers-go/dist/"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
    echo ""
    echo "MCP Ecosystem Status:"
    echo "✓ Go Servers: task-orchestrator, search-aggregator, skills-manager"
    echo "✓ Python Server: context-persistence (intentionally kept)"
    echo "⚠ Legacy TS: DEPRECATED - Do not use"
    echo "✓ GitHub Integration: Ready"
    echo "✓ Integration Tests: Passing"
    echo "✓ Documentation: Complete"
    echo ""
    echo "Ready for production use!"
    exit 0
else
    echo -e "${YELLOW}⚠ SOME TESTS FAILED${NC}"
    echo ""
    echo "Review the failures above."
    echo "Check /tmp/mcp-final-test.log for details"
    exit 1
fi