#!/bin/bash

# NanoGPT Proxy Subscription-First Routing End-to-End Test Script
# This script validates the complete subscription routing flow

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting NanoGPT Proxy Subscription-First Routing Tests"
echo "=================================================="
echo ""

# Check if proxy binary exists
if [ ! -f "./nanogpt-proxy" ]; then
    echo "❌ Error: nanogpt-proxy binary not found"
    echo "Please build the proxy first with: go build -o nanogpt-proxy ."
    exit 1
fi

# Check if Go is installed
if ! command -v go &> /dev/null; then
    echo "❌ Error: Go is not installed or not in PATH"
    exit 1
fi

# Build test binary
echo "📦 Building test binary..."
go build -o test-subscription-routing test_subscription_routing_standalone.go

if [ ! -f "./test-subscription-routing" ]; then
    echo "❌ Error: Failed to build test binary"
    exit 1
fi

echo "✅ Test binary built successfully"
echo ""

# Run the tests
echo "🧪 Running end-to-end tests..."
echo ""

# Create test results directory
mkdir -p test-results
TEST_LOG="test-results/subscription-test-$(date +%Y%m%d-%H%M%S).log"

# Run tests and capture output
./test-subscription-routing 2>&1 | tee "$TEST_LOG"
TEST_EXIT_CODE=${PIPESTATUS[0]}

echo ""
echo "📊 Test Results Summary"
echo "===================="

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ All tests passed!"
    echo ""
    echo "🎉 Subscription-first routing is working correctly"
else
    echo "❌ Some tests failed"
    echo ""
    echo "🔍 Check the test output above for details"
    echo "📝 Full log saved to: $TEST_LOG"
fi

echo ""
echo "📋 Key Findings:"
echo "================"

# Analyze the log for key patterns
if grep -q "Subscription API was not called" "$TEST_LOG"; then
    echo "⚠️  CRITICAL: Subscription API integration missing"
fi

if grep -q "integration gap" "$TEST_LOG"; then
    echo "⚠️  CRITICAL: ModelRouter not integrated with ChatHandler"
fi

if grep -q "requires ModelRouter integration" "$TEST_LOG"; then
    echo "⚠️  WARNING: Features require ModelRouter integration"
fi

echo ""
echo "📁 Test artifacts saved to: test-results/"
echo "📝 Full log: $TEST_LOG"

# Cleanup
rm -f ./test-subscription-routing

exit $TEST_EXIT_CODE