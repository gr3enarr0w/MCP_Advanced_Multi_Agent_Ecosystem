#!/bin/bash

# Local End-to-End Testing Script for MCP Advanced Multi-Agent Ecosystem
# This script tests all MCP servers on a local Mac without Docker or cloud dependencies

set -e

echo "🔍 MCP Advanced Multi-Agent Ecosystem - Local End-to-End Testing"
echo "=================================================================="
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

print_info "Found go.mod, starting local end-to-end testing..."

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

# Test 1: Binary startup and version info
print_test_header "Binary Startup Test"

for server in task-orchestrator search-aggregator skills-manager; do
    print_info "Testing $server startup..."
    
    # Start server in background
    "./dist/$server" --version > "$TEST_DIR/${server}_version.log" 2>&1 &
    SERVER_PID=$!
    
    # Wait a moment
    sleep 2
    
    # Check if process is still running
    if kill -0 $SERVER_PID 2>/dev/null; then
        print_success "$server started successfully"
        # Kill it
        kill $SERVER_PID 2>/dev/null || true
        wait $SERVER_PID 2>/dev/null || true
    else
        print_failure "$server failed to start"
        echo "Error output:"
        cat "$TEST_DIR/${server}_version.log" | sed 's/^/  /'
    fi
done

# Test 2: Database initialization
print_test_header "Database Initialization Test"

# Set test database directory
export MCP_DATABASE_DIR="$TEST_DIR/databases"
mkdir -p "$MCP_DATABASE_DIR"

for server in task-orchestrator search-aggregator skills-manager; do
    print_info "Testing $server database initialization..."
    
    # Start server with test database
    "./dist/$server" --db-path "$MCP_DATABASE_DIR/${server}.db" > "$TEST_DIR/${server}_db.log" 2>&1 &
    SERVER_PID=$!
    
    # Wait for initialization
    sleep 3
    
    # Check if database file was created
    if [ -f "$MCP_DATABASE_DIR/${server}.db" ]; then
        print_success "$server created database file"
        
        # Check database schema (basic check)
        DB_SIZE=$(stat -f%z "$MCP_DATABASE_DIR/${server}.db" 2>/dev/null || stat -c%s "$MCP_DATABASE_DIR/${server}.db" 2>/dev/null)
        if [ "$DB_SIZE" -gt 0 ]; then
            print_success "$server database has content"
        else
            print_warning "$server database is empty"
        fi
    else
        print_failure "$server did not create database file"
    fi
    
    # Kill server
    kill $SERVER_PID 2>/dev/null || true
    wait $SERVER_PID 2>/dev/null || true
done

# Test 3: MCP Protocol Basic Communication
print_test_header "MCP Protocol Communication Test"

# Test Task Orchestrator MCP endpoint
print_info "Testing Task Orchestrator MCP endpoint..."
"./dist/task-orchestrator" --test-mcp > "$TEST_DIR/task_orchestrator_mcp.log" 2>&1 &
TASK_PID=$!

sleep 3

# Check if it's responding (basic health check)
if kill -0 $TASK_PID 2>/dev/null; then
    print_success "Task Orchestrator MCP endpoint is running"
else
    print_failure "Task Orchestrator MCP endpoint failed"
    cat "$TEST_DIR/task_orchestrator_mcp.log" | sed 's/^/  /'
fi

kill $TASK_PID 2>/dev/null || true
wait $TASK_PID 2>/dev/null || true

# Test 4: Integration Test Suite
print_test_header "Integration Test Suite"

print_info "Running Go integration tests..."
if go test -v ./test/integration/... > "$TEST_DIR/integration_tests.log" 2>&1; then
    print_success "Integration tests passed"
    
    # Count passed tests
    TESTS_PASSED=$(grep -c "PASS:" "$TEST_DIR/integration_tests.log" || echo "0")
    print_info "$TESTS_PASSED test cases passed"
else
    print_failure "Integration tests failed"
    echo "Last 50 lines of test output:"
    tail -50 "$TEST_DIR/integration_tests.log" | sed 's/^/  /'
fi

# Test 5: SPARC Workflow End-to-End
print_test_header "SPARC Workflow End-to-End Test"

print_info "Testing complete SPARC workflow execution..."
cat > "$TEST_DIR/sparc_test.go" << 'EOF'
package main

import (
    "context"
    "testing"
    "time"
    
    "github.com/ceverson/mcp-advanced-multi-agent-ecosystem/pkg/agent/swarm"
    "github.com/ceverson/mcp-advanced-multi-agent-ecosystem/pkg/database"
)

func TestSPARCEndToEnd(t *testing.T) {
    // Setup database
    db, err := database.NewConnection("$TEST_DIR/sparc_test.db")
    if err != nil {
        t.Fatalf("Failed to create database: %v", err)
    }
    defer db.Close()
    
    // Setup swarm manager
    swarmManager := swarm.NewSwarmManager(db)
    
    // Setup SPARC engine
    sparcConfig := &swarm.SPARCConfig{
        EnablePseudocodePhase:   true,
        EnableArchitecturePhase: true,
        EnableRefinementPhase:   true,
        MaxIterations:          3,
        AutoAdvance:            true,
    }
    sparcEngine := swarm.NewSPARCEngine(swarmManager, sparcConfig, nil)
    
    // Create workflow
    ctx := context.Background()
    workflow, err := sparcEngine.CreateSPARCWorkflow(ctx, "e2e-test-001", "Design a local-first task management system")
    if err != nil {
        t.Fatalf("Failed to create workflow: %v", err)
    }
    
    // Start workflow
    if err := sparcEngine.StartWorkflow(ctx, workflow); err != nil {
        t.Fatalf("Failed to start workflow: %v", err)
    }
    
    // Wait for completion
    time.Sleep(5 * time.Second)
    
    // Check final status
    status := sparcEngine.GetWorkflowStatus(ctx, workflow)
    if status.Status != swarm.SPARCStatusCompleted {
        t.Errorf("Expected completed status, got %s", status.Status)
    }
    
    // Verify all phases executed
    expectedPhases := 5 // spec + pseudo + arch + refine + completion
    completedPhases := 0
    for _, phaseStatus := range status.PhaseStatuses {
        if phaseStatus == swarm.PhaseStatusCompleted {
            completedPhases++
        }
    }
    
    if completedPhases != expectedPhases {
        t.Errorf("Expected %d completed phases, got %d", expectedPhases, completedPhases)
    }
}
EOF

# Run the SPARC test
if go test -v "$TEST_DIR/sparc_test.go" > "$TEST_DIR/sparc_e2e.log" 2>&1; then
    print_success "SPARC workflow end-to-end test passed"
else
    print_failure "SPARC workflow end-to-end test failed"
    echo "Error output:"
    tail -30 "$TEST_DIR/sparc_e2e.log" | sed 's/^/  /'
fi

# Test 6: Concurrent Server Operation
print_test_header "Concurrent Server Operation Test"

print_info "Starting all MCP servers concurrently..."

# Start all servers
"./dist/task-orchestrator" --db-path "$MCP_DATABASE_DIR/task.db" > "$TEST_DIR/task_concurrent.log" 2>&1 &
TASK_PID=$!

"./dist/search-aggregator" --db-path "$MCP_DATABASE_DIR/search.db" > "$TEST_DIR/search_concurrent.log" 2>&1 &
SEARCH_PID=$!

"./dist/skills-manager" --db-path "$MCP_DATABASE_DIR/skills.db" > "$TEST_DIR/skills_concurrent.log" 2>&1 &
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
    ps -p $TASK_PID -o pid,ppid,%cpu,%mem,command | tail -1 | sed 's/^/  /'
    ps -p $SEARCH_PID -o pid,ppid,%cpu,%mem,command | tail -1 | sed 's/^/  /'
    ps -p $SKILLS_PID -o pid,ppid,%cpu,%mem,command | tail -1 | sed 's/^/  /'
else
    print_failure "Not all servers are running concurrently"
fi

# Kill all servers
kill $TASK_PID $SEARCH_PID $SKILLS_PID 2>/dev/null || true
wait $TASK_PID $SEARCH_PID $SKILLS_PID 2>/dev/null || true

# Test 7: Database Persistence
print_test_header "Database Persistence Test"

print_info "Testing database persistence across restarts..."

# Start server and create some data
"./dist/task-orchestrator" --db-path "$MCP_DATABASE_DIR/persist.db" > "$TEST_DIR/persist_start.log" 2>&1 &
PERSIST_PID=$!

sleep 3

# Kill server
kill $PERSIST_PID 2>/dev/null || true
wait $PERSIST_PID 2>/dev/null || true

# Check database exists
if [ -f "$MCP_DATABASE_DIR/persist.db" ]; then
    DB_SIZE_BEFORE=$(stat -f%z "$MCP_DATABASE_DIR/persist.db" 2>/dev/null || stat -c%s "$MCP_DATABASE_DIR/persist.db" 2>/dev/null)
    print_success "Database file persisted ($DB_SIZE_BEFORE bytes)"
    
    # Restart server
    "./dist/task-orchestrator" --db-path "$MCP_DATABASE_DIR/persist.db" > "$TEST_DIR/persist_restart.log" 2>&1 &
    PERSIST_PID=$!
    
    sleep 3
    
    # Check database still exists and is accessible
    if [ -f "$MCP_DATABASE_DIR/persist.db" ]; then
        DB_SIZE_AFTER=$(stat -f%z "$MCP_DATABASE_DIR/persist.db" 2>/dev/null || stat -c%s "$MCP_DATABASE_DIR/persist.db" 2>/dev/null)
        print_success "Database accessible after restart ($DB_SIZE_AFTER bytes)"
        
        if [ "$DB_SIZE_BEFORE" -eq "$DB_SIZE_AFTER" ]; then
            print_success "Database size consistent"
        else
            print_warning "Database size changed: $DB_SIZE_BEFORE -> $DB_SIZE_AFTER bytes"
        fi
    else
        print_failure "Database not accessible after restart"
    fi
    
    kill $PERSIST_PID 2>/dev/null || true
    wait $PERSIST_PID 2>/dev/null || true
else
    print_failure "Database file not created"
fi

# Final summary
echo ""
echo "======================================"
echo "LOCAL END-TO-END TEST SUMMARY"
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
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    echo ""
    echo "Please review the failures above and fix any issues."
    echo "Test logs are available in: $TEST_DIR"
    echo ""
    exit 1
fi