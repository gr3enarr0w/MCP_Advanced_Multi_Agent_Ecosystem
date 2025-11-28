#!/bin/bash

# Quick test of server startup
cd "$(dirname "$0")"

export NANOGPT_API_KEY="7ed377e9-3d0c-4beb-8d38-96c98c93ee89"
export ACTIVE_PROFILE="personal"
export PORT="8090"

echo "Testing NanoGPT Proxy startup..."
echo ""

# Run for 3 seconds then kill
timeout 3 ./nanogpt-proxy 2>&1 &
PID=$!

sleep 3

# Test health endpoint
echo ""
echo "Testing health endpoint..."
curl -s http://localhost:8090/health 2>/dev/null && echo " ✓" || echo " (server not responding)"

# Kill server
kill $PID 2>/dev/null || true

echo ""
echo "Test complete"
