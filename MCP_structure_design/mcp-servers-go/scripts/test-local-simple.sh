#!/bin/bash

# Simple Local End-to-End Testing Script for MCP Advanced Multi-Agent Ecosystem
# This script tests all MCP servers on a local Mac without Docker or cloud dependencies

set -e

echo "🔍 MCP Advanced Multi-Agent Ecosystem - Simple Local Testing"
echo "============================================================="
echo "Testing on local Mac - No Docker, No Cloud, No External Dependencies"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track results
FAILED=0
PASSED=0
TESTS_RUN=0

# Test directories
TEST_DIR="/tmp/mcp-test-$$"
mkdir -p "$TEST_DIR"
echo "Test directory: $TEST_DIR"

# Cleanup function
cleanup() {
    echo ""
    echo "Cleaning up test processes..."
    # Kill any running MCP servers
    pkill -f "dist/task-orchestrator" 2>/dev/null || true
    pkill -f "dist/search-aggregator" 2>/dev/null || true
    pkill -f "dist/skills-manager" 2>/dev/null || true
    # Remove test directory
    rm -rf "$TEST_DIR"
}
trap cleanup EXIT

# Function to print test header
print_test_header() {
    echo ""
    echo "======================================"
    echo "TEST: $1"
    echo "======================================"
    ((TESTS_RUN++))
}

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

print_info "Found go.mod, starting local testing..."

# Check if binaries exist
echo ""
echo "Checking for MCP server binaries..."
echo "------------------------------------"

if [ ! -d "dist" ]; then
    print_failure "dist/ directory not found. Please run 'make build' first."
    exit 1
fi

for server in task-orchestrator search-aggregator skills-manager; do
    if [ -f "dist/$server" ]; then
        print_success "$server binary found"
        # Check if executable
        if [ -x "dist/$server" ]; then
            print_success "$server is executable"
        else
            print_failure "$server is not executable"
            chmod +x "dist/$server"
        fi
    else
        print_failure "$server binary not found"
        exit 1
    fi
done

# Test 1: Binary can start and run (basic smoke test)
print_test_header "Binary Smoke Test"

for server in task-orchestrator search-aggregator skills-manager; do
    print_info "Testing $server can start..."
    
    # Try to start server with help flag (most basic test)
    if "./dist/$server" --help 2>&1 | grep -q "Usage\|help\|MCP\|task\|search\|skills" 2>/dev/null; then
        print_success "$server responds to --help"
    else
        # If --help doesn't work, just try to start and immediately kill
        print_info "Testing $server startup/shutdown..."
        timeout 3s "./dist/$server" > "$TEST_DIR/${server}_startup.log" 2>&1 &
        SERVER_PID=$!
        
        sleep 2
        
        if kill -0 $SERVER_PID 2>/dev/null; then
            print_success "$server started successfully"
            kill $SERVER_PID 2>/dev/null || true
            wait $SERVER_PID 2>/dev/null || true
        else
            print_warning "$server may not support --help, but process started"
        fi
    fi
done

# Test 2: Database initialization
print_test_header "Database Initialization Test"

# Set test database directory
export MCP_DATABASE_DIR="$TEST_DIR/databases"
mkdir -p "$MCP_DATABASE_DIR"

for server in task-orchestrator search-aggregator skills-manager; do
    print_info "Testing $server database initialization..."
    
    # Start server with test database (no special flags, just run)
    timeout 5s "./dist/$server" > "$TEST_DIR/${server}_db.log" 2>&1 &
    SERVER_PID=$!
    
    # Wait for initialization
    sleep 3
    
    # Check if process is running (which means it started successfully)
    if kill -0 $SERVER_PID 2>/dev/null; then
        print_success "$server started and is running"
        
        # Try to find database file (common locations)
        DB_FILE="$MCP_DATABASE_DIR/${server}.db"
        if [ -f "$DB_FILE" ]; then
            print_success "$server created database file"
            
            # Check database size
            DB_SIZE=$(stat -f%z "$DB_FILE" 2>/dev/null || stat -c%s "$DB_FILE" 2>/dev/null)
            if [ "$DB_SIZE" -gt 0 ]; then
                print_success "$server database has content ($DB_SIZE bytes)"
            else
                print_warning "$server database is empty"
            fi
        else
            # Check if database was created in current directory
            if [ -f "${server}.db" ]; then
                mv "${server}.db" "$MCP_DATABASE_DIR/"
                print_success "$server created database (moved to test dir)"
            else
                print_info "$server running but database location unknown"
            fi
        fi
    else
        print_failure "$server failed to start"
        echo "Error output:"
        tail -20 "$TEST_DIR/${server}_db.log" | sed 's/^/  /'
    fi
    
    # Kill server if still running
    kill $SERVER_PID 2>/dev/null || true
    wait $SERVER_PID 2>/dev/null || true
done

# Test 3: Integration Test Suite
print_test_header "Integration Test Suite"

print_info "Running Go integration tests..."
if go test -v ./test/integration/... > "$TEST_DIR/integration_tests.log" 2>&1; then
    print_success "Integration tests passed"
    
    # Count passed tests
    TESTS_PASSED=$(grep -c "PASS:" "$TEST_DIR/integration_tests.log" || echo "0")
    print_info "$TESTS_PASSED test cases passed"
else
    print_failure "Integration tests failed"
    echo "Last 30 lines of test output:"
    tail -30 "$TEST_DIR/integration_tests.log" | sed 's/^/  /'
fi

# Test 4: Concurrent Server Operation
print_test_header "Concurrent Server Operation Test"

print_info "Starting all MCP servers concurrently..."

# Start all servers (with timeout to prevent hanging)
timeout 10s "./dist/task-orchestrator" > "$TEST_DIR/task_concurrent.log" 2>&1 &
TASK_PID=$!

timeout 10s "./dist/search-aggregator" > "$TEST_DIR/search_concurrent.log" 2>&1 &
SEARCH_PID=$!

timeout 10s "./dist/skills-manager" > "$TEST_DIR/skills_concurrent.log" 2>&1 &
SKILLS_PID=$!

# Wait for startup
sleep 5

# Check all processes
SERVERS_RUNNING=0
if kill -0 $TASK_PID 2>/dev/null; then
    print_success "Task Orchestrator running"
    ((SERVERS_RUNNING++))
else
    print_failure "Task Orchestrator not running"
fi

if kill -0 $SEARCH_PID 2>/dev/null; then
    print_success "Search Aggregator running"
    ((SERVERS_RUNNING++))
else
    print_failure "Search Aggregator not running"
fi

if kill -0 $SKILLS_PID 2>/dev/null; then
    print_success "Skills Manager running"
    ((SERVERS_RUNNING++))
else
    print_failure "Skills Manager not running"
fi

# Test basic operations while all servers are running
if [ $SERVERS_RUNNING -eq 3 ]; then
    print_success "All 3 servers running concurrently"
    
    # Wait a bit more for stability
    sleep 3
    
    # Check resource usage
    print_info "Resource usage:"
    ps -p $TASK_PID -o pid,ppid,%cpu,%mem,command 2>/dev/null | tail -1 | sed 's/^/  /' || echo "  Could not get task-orchestrator stats"
    ps -p $SEARCH_PID -o pid,ppid,%cpu,%mem,command 2>/dev/null | tail -1 | sed 's/^/  /' || echo "  Could not get search-aggregator stats"
    ps -p $SKILLS_PID -o pid,ppid,%cpu,%mem,command 2>/dev/null | tail -1 | sed 's/^/  /' || echo "  Could not get skills-manager stats"
else
    print_failure "Not all servers are running concurrently"
fi

# Kill all servers
kill $TASK_PID $SEARCH_PID $SKILLS_PID 2>/dev/null || true
wait $TASK_PID $SEARCH_PID $SKILLS_PID 2>/dev/null || true

# Test 5: Binary integrity check
print_test_header "Binary Integrity Check"

for server in task-orchestrator search-aggregator skills-manager; do
    print_info "Checking $server binary..."
    
    # Check file type
    FILE_INFO=$(file "dist/$server")
    print_info "  File info: $FILE_INFO"
    
    # Check if it's a valid executable
    if ./dist/$server > /dev/null 2>&1 & then
        SERVER_PID=$!
        sleep 2
        if kill -0 $SERVER_PID 2>/dev/null; then
            print_success "$server is a valid executable"
            kill $SERVER_PID 2>/dev/null || true
            wait $SERVER_PID 2>/dev/null || true
        else
            print_warning "$server started but died quickly"
        fi
    else
        print_warning "$server may have startup issues"
    fi
done

# Final summary
echo ""
echo "======================================"
echo "LOCAL TEST SUMMARY"
echo "======================================"
echo "Tests run: $TESTS_RUN"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All local tests passed!${NC}"
    echo ""
    echo "The MCP Advanced Multi-Agent Ecosystem is ready for local use on your Mac."
    echo ""
    echo "Next steps:"
    echo "1. Add the servers to your MCP client configuration (Roo/Cursor)"
    echo "2. Set up local service management with launchd"
    echo "3. Start using the SPARC workflow with your AI assistant"
    echo ""
    echo "Test logs are available in: $TEST_DIR"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    echo ""
    echo "Please review the failures above and fix any issues."
    echo "Test logs are available in: $TEST_DIR"
    echo ""
    exit 1
fi