#!/bin/bash

# Phase 1 End-to-End Test Script
# Validates LLM providers, search providers, and environment configuration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
PASSED=0
FAILED=0
TOTAL=0

# Test categories
LLM_TESTS=0
SEARCH_TESTS=0
ENV_TESTS=0

# Print header
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}Phase 1 E2E Test Suite${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

# Print test result
print_result() {
    local test_name=$1
    local status=$2
    local message=$3
    
    TOTAL=$((TOTAL + 1))
    
    if [ "$status" -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $test_name"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗${NC} $test_name"
        if [ -n "$message" ]; then
            echo -e "${RED}  Error: $message${NC}"
        fi
        FAILED=$((FAILED + 1))
    fi
}

# Print section header
print_section() {
    echo ""
    echo -e "${YELLOW}▶ $1${NC}"
    echo "----------------------------------------"
}

# Validate environment variables
validate_env() {
    print_section "Environment Configuration Tests"
    
    # Check if .env file exists
    if [ -f ".env" ]; then
        print_result "Environment file exists" 0
        ENV_TESTS=$((ENV_TESTS + 1))
    else
        print_result "Environment file exists" 1 "No .env file found"
        ENV_TESTS=$((ENV_TESTS + 1))
    fi
    
    # Check critical environment variables
    local critical_vars=(
        "TAVILY_API_KEY"
        "PERPLEXITY_API_KEY" 
        "BRAVE_API_KEY"
        "OLLAMA_BASE_URL"
        "NANOGPT_PROXY_URL"
    )
    
    for var in "${critical_vars[@]}"; do
        if [ -n "${!var}" ]; then
            print_result "Environment variable $var is set" 0
        else
            print_result "Environment variable $var is set" 1 "Variable not set or empty"
        fi
        ENV_TESTS=$((ENV_TESTS + 1))
    done
    
    # Check Node.js version
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_result "Node.js is installed ($NODE_VERSION)" 0
    else
        print_result "Node.js is installed" 1 "Node.js not found"
    fi
    ENV_TESTS=$((ENV_TESTS + 1))
    
    # Check npm version
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        print_result "npm is installed ($NPM_VERSION)" 0
    else
        print_result "npm is installed" 1 "npm not found"
    fi
    ENV_TESTS=$((ENV_TESTS + 1))
}

# Test LLM providers
test_llm_providers() {
    print_section "LLM Provider Tests"
    
    cd src/mcp-servers/agent-swarm
    
    # Check if dependencies are installed
    if [ -d "node_modules" ]; then
        print_result "LLM provider dependencies installed" 0
    else
        print_result "LLM provider dependencies installed" 1 "Run npm install"
        cd ../..
        return
    fi
    
    # Run LLM integration tests
    echo "Running LLM integration tests..."
    if npm test -- __tests__/llm-integration.test.ts --silent; then
        print_result "LLM integration tests passed" 0
        LLM_TESTS=$((LLM_TESTS + 1))
    else
        print_result "LLM integration tests passed" 1 "Tests failed"
        LLM_TESTS=$((LLM_TESTS + 1))
    fi
    
    # Run router integration tests
    echo "Running router integration tests..."
    if npm test -- __tests__/router-integration.test.ts --silent; then
        print_result "Router integration tests passed" 0
        LLM_TESTS=$((LLM_TESTS + 1))
    else
        print_result "Router integration tests passed" 1 "Tests failed"
        LLM_TESTS=$((LLM_TESTS + 1))
    fi
    
    # Test Ollama connectivity (if available)
    if [ -n "$OLLAMA_BASE_URL" ]; then
        echo "Testing Ollama connectivity..."
        if curl -s "$OLLAMA_BASE_URL/api/tags" > /dev/null 2>&1; then
            print_result "Ollama service is accessible" 0
        else
            print_result "Ollama service is accessible" 1 "Cannot connect to Ollama"
        fi
        LLM_TESTS=$((LLM_TESTS + 1))
    else
        print_result "Ollama service is accessible" 1 "OLLAMA_BASE_URL not set"
        LLM_TESTS=$((LLM_TESTS + 1))
    fi
    
    # Test nanogpt-proxy connectivity (if configured)
    if [ -n "$NANOGPT_PROXY_URL" ]; then
        echo "Testing nanogpt-proxy connectivity..."
        if curl -s "$NANOGPT_PROXY_URL/health" > /dev/null 2>&1; then
            print_result "nanogpt-proxy service is accessible" 0
        else
            print_result "nanogpt-proxy service is accessible" 1 "Cannot connect to nanogpt-proxy"
        fi
        LLM_TESTS=$((LLM_TESTS + 1))
    else
        print_result "nanogpt-proxy service is accessible" 1 "NANOGPT_PROXY_URL not set"
        LLM_TESTS=$((LLM_TESTS + 1))
    fi
    
    cd ../..
}

# Test search providers
test_search_providers() {
    print_section "Search Provider Tests"
    
    cd src/mcp-servers/search-aggregator
    
    # Check if dependencies are installed
    if [ -d "node_modules" ]; then
        print_result "Search provider dependencies installed" 0
    else
        print_result "Search provider dependencies installed" 1 "Run npm install"
        cd ../..
        return
    fi
    
    # Run search integration tests
    echo "Running search integration tests..."
    if npm test -- __tests__/search-integration.test.ts --silent; then
        print_result "Search integration tests passed" 0
        SEARCH_TESTS=$((SEARCH_TESTS + 1))
    else
        print_result "Search integration tests passed" 1 "Tests failed"
        SEARCH_TESTS=$((SEARCH_TESTS + 1))
    fi
    
    # Test Tavily API (if key is available)
    if [ -n "$TAVILY_API_KEY" ]; then
        echo "Testing Tavily API..."
        if curl -s -X POST "https://api.tavily.com/search" \
            -H "Content-Type: application/json" \
            -d "{\"api_key\":\"$TAVILY_API_KEY\",\"query\":\"test\",\"max_results\":1}" > /dev/null 2>&1; then
            print_result "Tavily API is accessible" 0
        else
            print_result "Tavily API is accessible" 1 "Cannot connect to Tavily API"
        fi
        SEARCH_TESTS=$((SEARCH_TESTS + 1))
    else
        print_result "Tavily API is accessible" 1 "TAVILY_API_KEY not set"
        SEARCH_TESTS=$((SEARCH_TESTS + 1))
    fi
    
    # Test Perplexity API (if key is available)
    if [ -n "$PERPLEXITY_API_KEY" ]; then
        echo "Testing Perplexity API..."
        if curl -s -X POST "https://api.perplexity.ai/chat/completions" \
            -H "Authorization: Bearer $PERPLEXITY_API_KEY" \
            -H "Content-Type: application/json" \
            -d "{\"model\":\"sonar-pro\",\"messages\":[{\"role\":\"user\",\"content\":\"test\"}],\"max_tokens\":10}" > /dev/null 2>&1; then
            print_result "Perplexity API is accessible" 0
        else
            print_result "Perplexity API is accessible" 1 "Cannot connect to Perplexity API"
        fi
        SEARCH_TESTS=$((SEARCH_TESTS + 1))
    else
        print_result "Perplexity API is accessible" 1 "PERPLEXITY_API_KEY not set"
        SEARCH_TESTS=$((SEARCH_TESTS + 1))
    fi
    
    # Test Brave API (if key is available)
    if [ -n "$BRAVE_API_KEY" ]; then
        echo "Testing Brave API..."
        if curl -s -H "X-Subscription-Token: $BRAVE_API_KEY" \
            "https://api.search.brave.com/res/v1/web/search?q=test&count=1" > /dev/null 2>&1; then
            print_result "Brave API is accessible" 0
        else
            print_result "Brave API is accessible" 1 "Cannot connect to Brave API"
        fi
        SEARCH_TESTS=$((SEARCH_TESTS + 1))
    else
        print_result "Brave API is accessible" 1 "BRAVE_API_KEY not set"
        SEARCH_TESTS=$((SEARCH_TESTS + 1))
    fi
    
    cd ../..
}

# Test MCP server builds
test_builds() {
    print_section "Build Tests"
    
    # Test agent-swarm build
    cd src/mcp-servers/agent-swarm
    echo "Building agent-swarm..."
    if npm run build > /dev/null 2>&1; then
        print_result "agent-swarm builds successfully" 0
    else
        print_result "agent-swarm builds successfully" 1 "Build failed"
    fi
    
    # Check if dist files exist
    if [ -f "dist/index.js" ]; then
        print_result "agent-swarm dist files generated" 0
    else
        print_result "agent-swarm dist files generated" 1 "dist/index.js not found"
    fi
    cd ../..
    
    # Test search-aggregator build
    cd src/mcp-servers/search-aggregator
    echo "Building search-aggregator..."
    if npm run build > /dev/null 2>&1; then
        print_result "search-aggregator builds successfully" 0
    else
        print_result "search-aggregator builds successfully" 1 "Build failed"
    fi
    
    # Check if dist files exist
    if [ -f "dist/index.js" ]; then
        print_result "search-aggregator dist files generated" 0
    else
        print_result "search-aggregator dist files generated" 1 "dist/index.js not found"
    fi
    cd ../..
}

# Test basic functionality
test_basic_functionality() {
    print_section "Basic Functionality Tests"
    
    # Test search aggregator basic search
    cd src/mcp-servers/search-aggregator
    echo "Testing search aggregator basic functionality..."
    
    # Create a simple test script
    cat > test-basic.js << 'EOF'
const { SearchAggregator } = require('./dist/index.js');

async function test() {
    const aggregator = new SearchAggregator();
    await aggregator.initialize();
    
    // Test with DuckDuckGo (no API key required)
    const results = await aggregator.search('test query', {
        providers: ['duckduckgo'],
        limit: 2
    });
    
    console.log('Search results:', JSON.stringify(results, null, 2));
    console.log('Test passed: Got', results.length, 'results');
}

test().catch(console.error);
EOF

    if node test-basic.js > /dev/null 2>&1; then
        print_result "Search aggregator basic search works" 0
    else
        print_result "Search aggregator basic search works" 1 "Basic search failed"
    fi
    
    rm -f test-basic.js
    cd ../..
}

# Print summary
print_summary() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}Test Summary${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    echo "Total Tests: $TOTAL"
    echo -e "${GREEN}Passed: $PASSED${NC}"
    echo -e "${RED}Failed: $FAILED${NC}"
    echo ""
    echo "Environment Tests: $ENV_TESTS"
    echo "LLM Tests: $LLM_TESTS"
    echo "Search Tests: $SEARCH_TESTS"
    echo ""
    
    if [ $FAILED -eq 0 ]; then
        echo -e "${GREEN}✓ All tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}✗ Some tests failed${NC}"
        exit 1
    fi
}

# Main execution
main() {
    print_header
    
    # Load environment variables
    if [ -f ".env" ]; then
        export $(cat .env | xargs)
    fi
    
    # Run all test suites
    validate_env
    test_llm_providers
    test_search_providers
    test_builds
    test_basic_functionality
    
    # Print summary
    print_summary
}

# Run main function
main "$@"