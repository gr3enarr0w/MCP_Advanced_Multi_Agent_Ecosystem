#!/bin/bash

# Role and Profile Routing Test Script
# This script tests different user roles and profiles to validate routing behavior

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting Role and Profile Routing Tests"
echo "=========================================="
echo ""

# Check if proxy binary exists
if [ ! -f "./nanogpt-proxy" ]; then
    echo "❌ Error: nanogpt-proxy binary not found"
    echo "Please build proxy first with: go build -o nanogpt-proxy ."
    exit 1
fi

# Test configuration
PROXY_PORT="8092"
SUBSCRIPTION_PORT="60091"
LOG_FILE="test-results/role-profile-routing-$(date +%Y%m%d-%H%M%S).log"

# Create test results directory
mkdir -p test-results

echo "📋 Test Configuration:"
echo "  Proxy Port: $PROXY_PORT"
echo "  Subscription API Port: $SUBSCRIPTION_PORT"  
echo "  Log File: $LOG_FILE"
echo ""

# Function to start mock subscription server
start_mock_subscription() {
    echo "🔧 Starting mock subscription server on port $SUBSCRIPTION_PORT..."
    
    # Create a simple mock subscription server
    cat > mock_subscription_server.py << 'EOF'
import http.server
import json
import socket
from urllib.parse import urlparse, parse_qs
import threading
import time

class MockSubscriptionHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/subscription/v1/models':
            # Mock subscription models based on role
            models = [
                {
                    "id": "qwen-2.5-72b",
                    "name": "Qwen 2.5 72B",
                    "status": "available",
                    "roles": ["architect", "code_review", "research", "testing", "general"],
                    "created_at": time.time()
                },
                {
                    "id": "qwen-2.5-coder-32b", 
                    "name": "Qwen 2.5 Coder 32B",
                    "status": "available",
                    "roles": ["implementation"],
                    "created_at": time.time()
                },
                {
                    "id": "deepseek-chat",
                    "name": "DeepSeek Chat",
                    "status": "available", 
                    "roles": ["debugging"],
                    "created_at": time.time()
                },
                {
                    "id": "gemini-2.0-flash",
                    "name": "Gemini 2.0 Flash",
                    "status": "available",
                    "roles": ["documentation", "general"],
                    "created_at": time.time()
                }
            ]
            
            response = {
                "models": models,
                "updated_at": time.time()
            }
            
            self.send_response(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Profile, X-Subscription-Tier, X-User-Role, X-Session-Token'
            }, json.dumps(response))
        else:
            self.send_response(404, {}, 'Not Found')
    
    def do_OPTIONS(self):
        self.send_response(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Profile, X-Subscription-Tier, X-User-Role, X-Session-Token'
        }, '')
    
    def send_response(self, status, headers, body):
        self.send_response(status, headers, body)
    
    def log_message(self, format, *args):
        timestamp = time.strftime('%Y-%m-%d %H:%M:%S')
        print(f"[{timestamp}] {format % args}")

def run_server():
    # Find available port
    port = $SUBSCRIPTION_PORT
    server_address = ('', port)
    httpd = http.server.HTTPServer(server_address, MockSubscriptionHandler)
    
    print(f"[MOCK] Mock subscription server starting on port {port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print(f"[MOCK] Mock subscription server stopped")
        httpd.server_close()

if __name__ == '__main__':
    run_server()
EOF

    # Start mock server in background
    python3 mock_subscription_server.py > test-results/mock-subscription-server.log 2>&1 &
    MOCK_PID=$!
    echo "✅ Mock subscription server started (PID: $MOCK_PID)"
    
    # Wait for server to be ready
    sleep 2
}

# Function to stop mock subscription server
stop_mock_subscription() {
    if [ ! -z "$MOCK_PID" ]; then
        echo "🛑 Stopping mock subscription server (PID: $MOCK_PID)..."
        kill $MOCK_PID 2>/dev/null || true
        wait $MOCK_PID 2>/dev/null || true
        echo "✅ Mock subscription server stopped"
    fi
}

# Function to start proxy server
start_proxy_server() {
    echo "🔧 Starting NanoGPT proxy server..."
    
    # Set environment variables for proxy
    export NANOGPT_API_KEY="test-key-12345"
    export NANOGPT_BASE_URL="https://nano-gpt.com/api/v1"
    export ACTIVE_PROFILE="personal"
    export PORT="$PROXY_PORT"
    export SUBSCRIPTION_API_BASE_URL="http://localhost:$SUBSCRIPTION_PORT"
    export SUBSCRIPTION_API_TTL_SECONDS="5"
    
    # Start proxy server in background
    ./nanogpt-proxy > test-results/proxy-server.log 2>&1 &
    PROXY_PID=$!
    echo "✅ Proxy server started (PID: $PROXY_PID)"
    
    # Wait for server to be ready
    for i in {1..30}; do
        if curl -s "http://localhost:$PROXY_PORT/health" > /dev/null 2>&1; then
            echo "✅ Proxy server ready on port $PROXY_PORT"
            return 0
        fi
        sleep 0.1
    done
    
    echo "❌ Proxy server failed to start within 3 seconds"
    stop_proxy_server
    return 1
}

# Function to stop proxy server
stop_proxy_server() {
    if [ ! -z "$PROXY_PID" ]; then
        echo "🛑 Stopping proxy server (PID: $PROXY_PID)..."
        kill $PROXY_PID 2>/dev/null || true
        wait $PROXY_PID 2>/dev/null || true
        echo "✅ Proxy server stopped"
    fi
}

# Function to make chat request
make_chat_request() {
    local role="$1"
    local profile="$2" 
    local auth_header="$3"
    local subscription_tier="$4"
    local user_role="$5"
    local session_token="$6"
    local model="$7"
    
    echo "🧪 Testing: Role=$role, Profile=$profile, Model=$model"
    
    # Build request headers
    headers=(
        "-H" "Content-Type: application/json"
    )
    
    if [ -n "$profile" ]; then
        headers+=("-H" "X-Profile: $profile")
    fi
    
    if [ -n "$auth_header" ]; then
        headers+=("-H" "Authorization: Bearer $auth_header")
    fi
    
    if [ -n "$subscription_tier" ]; then
        headers+=("-H" "X-Subscription-Tier: $subscription_tier")
    fi
    
    if [ -n "$user_role" ]; then
        headers+=("-H" "X-User-Role: $user_role")
    fi
    
    if [ -n "$session_token" ]; then
        headers+=("-H" "X-Session-Token: $session_token")
    fi
    
    # Build request body
    body=$(cat <<EOF
{
    "model": "$model",
    "messages": [
        {"role": "user", "content": "Test request for role: $role"}
    ],
    "role": "$role"
}
EOF
)
    
    # Make request and capture response
    response=$(curl -s -w "\nHTTP_STATUS:%{http_code}\nHTTP_TIME:%{time_total}" \
        -X POST \
        "${headers[@]}" \
        -d "$body" \
        "http://localhost:$PROXY_PORT/v1/chat/completions" 2>/dev/null || echo "HTTP_STATUS:000\nHTTP_TIME:0")
    
    echo "$response"
}

# Function to parse response
parse_response() {
    local response="$1"
    local test_name="$2"
    
    local http_status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
    local http_time=$(echo "$response" | grep "HTTP_TIME:" | cut -d: -f2)
    local response_body=$(echo "$response" | sed '/^HTTP_STATUS:/d' | sed '/^HTTP_TIME:/d')
    
    echo "📊 $test_name Results:"
    echo "  Status: $http_status"
    echo "  Time: ${http_time}s"
    
    if [ "$http_status" = "200" ]; then
        echo "  ✅ SUCCESS"
        
        # Extract model from response if possible
        model_used=$(echo "$response_body" | grep -o '"model":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
        backend_used=$(echo "$response_body" | grep -o '"backend":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
        
        echo "  Model Used: $model_used"
        echo "  Backend Used: $backend_used"
    else
        echo "  ❌ FAILED"
        echo "  Error: $response_body"
    fi
    echo ""
}

# Cleanup function
cleanup() {
    echo ""
    echo "🧹 Cleaning up..."
    stop_proxy_server
    stop_mock_subscription
    echo "✅ Cleanup completed"
}

# Set up signal handlers
trap cleanup EXIT INT TERM

# Start servers
echo "🔧 Setting up test environment..."
start_mock_subscription
start_proxy_server

echo ""
echo "🧪 Running Role and Profile Tests..."
echo "=================================="

# Test 1: Standard User Role Testing
echo "📋 Test 1: Standard User Role Testing"
echo "------------------------------------"

# Test 1a: General role with personal profile
response=$(make_chat_request "general" "personal" "" "" "" "" "auto")
parse_response "$response" "1a - General + Personal"

# Test 1b: General role with work profile  
response=$(make_chat_request "general" "work" "" "" "" "" "auto")
parse_response "$response" "1b - General + Work"

# Test 1c: Implementation role with personal profile
response=$(make_chat_request "implementation" "personal" "" "" "" "" "auto")
parse_response "$response" "1c - Implementation + Personal"

# Test 1d: Implementation role with work profile
response=$(make_chat_request "implementation" "work" "" "" "" "" "auto")
parse_response "$response" "1d - Implementation + Work"

# Test 2: Premium User Role Testing
echo "📋 Test 2: Premium User Role Testing"
echo "--------------------------------------"

# Test 2a: Premium subscription tier
response=$(make_chat_request "architect" "personal" "valid-key-12345" "premium" "" "" "auto")
parse_response "$response" "2a - Premium Tier"

# Test 2b: Enterprise subscription tier
response=$(make_chat_request "code_review" "work" "enterprise-key-67890" "enterprise" "" "" "auto")
parse_response "$response" "2b - Enterprise Tier"

# Test 2c: User role header
response=$(make_chat_request "debugging" "personal" "premium-key-11111" "premium" "debugging" "" "auto")
parse_response "$response" "2c - User Role Header"

# Test 3: Authentication Testing
echo "📋 Test 3: Authentication Testing" 
echo "---------------------------------"

# Test 3a: Valid API key
response=$(make_chat_request "general" "personal" "valid-api-key-12345" "" "" "" "auto")
parse_response "$response" "3a - Valid API Key"

# Test 3b: Invalid API key
response=$(make_chat_request "general" "personal" "invalid-key" "" "" "" "auto")
parse_response "$response" "3b - Invalid API Key"

# Test 3c: Missing authentication
response=$(make_chat_request "general" "personal" "" "" "" "" "auto")
parse_response "$response" "3c - No Auth"

# Test 3d: Session token
response=$(make_chat_request "testing" "work" "" "" "" "session-token-abc-123" "auto")
parse_response "$response" "3d - Session Token"

# Test 4: Profile Override Testing
echo "📋 Test 4: Profile Override Testing"
echo "------------------------------------"

# Test 4a: Override personal with work
response=$(make_chat_request "general" "work" "" "" "" "" "auto")
parse_response "$response" "4a - Personal->Work Override"

# Test 4b: Override work with personal
response=$(make_chat_request "general" "personal" "" "" "" "" "auto")
parse_response "$response" "4b - Work->Personal Override"

# Test 4c: Invalid profile (should fallback)
response=$(make_chat_request "general" "invalid" "" "" "" "" "auto")
parse_response "$response" "4c - Invalid Profile"

# Test 4d: No profile header (use env default)
response=$(make_chat_request "general" "" "" "" "" "" "auto")
parse_response "$response" "4d - No Profile Header"

# Test 5: Model Availability Testing
echo "📋 Test 5: Model Availability Testing"
echo "--------------------------------------"

# Test 5a: Request specific model
response=$(make_chat_request "architect" "personal" "" "" "" "" "claude-3.5-sonnet")
parse_response "$response" "5a - Claude Model"

# Test 5b: Request different specific model
response=$(make_chat_request "implementation" "work" "" "" "" "" "gpt-4o")
parse_response "$response" "5b - GPT-4 Model"

# Test 5c: Auto model selection
response=$(make_chat_request "debugging" "personal" "" "" "" "" "auto")
parse_response "$response" "5c - Auto Model"

# Test 5d: Invalid model (should fallback)
response=$(make_chat_request "testing" "work" "" "" "" "" "invalid-model-name")
parse_response "$response" "5d - Invalid Model"

echo ""
echo "📊 Test Summary"
echo "=================="

# Analyze logs for routing patterns
echo "🔍 Analyzing routing behavior..."

# Check for ModelRouter usage
if grep -q "\[ROUTING\] ModelRouter unavailable" test-results/proxy-server.log; then
    echo "✅ CONFIRMED: ModelRouter is not being used (as expected)"
else
    echo "❌ UNEXPECTED: ModelRouter appears to be used"
fi

# Check for subscription API calls
if grep -q "GET /api/subscription/v1/models" test-results/mock-subscription-server.log; then
    subscription_calls=$(grep -c "GET /api/subscription/v1/models" test-results/mock-subscription-server.log)
    echo "📈 Subscription API calls made: $subscription_calls"
else
    echo "❌ No subscription API calls detected"
fi

# Check for authentication logging
if grep -q "\[AUTH\]" test-results/proxy-server.log; then
    echo "✅ Authentication logging is working"
else
    echo "❌ Authentication logging not found"
fi

# Check for profile override logging
if grep -q "\[PROFILE\]" test-results/proxy-server.log; then
    echo "✅ Profile override logging is working"
else
    echo "❌ Profile override logging not found"
fi

# Check for fallback logging
if grep -q "\[FALLBACK\]" test-results/proxy-server.log; then
    echo "✅ Fallback logging is working"
else
    echo "❌ Fallback logging not found"
fi

echo ""
echo "📁 Test artifacts saved to:"
echo "  - Proxy logs: test-results/proxy-server.log"
echo "  - Subscription logs: test-results/mock-subscription-server.log"
echo "  - Combined log: $LOG_FILE"

# Combine logs for analysis
cat test-results/proxy-server.log > "$LOG_FILE"
echo "" >> "$LOG_FILE"
echo "=== MOCK SUBSCRIPTION SERVER LOG ===" >> "$LOG_FILE"
cat test-results/mock-subscription-server.log >> "$LOG_FILE"

echo ""
echo "✅ Role and Profile Routing Tests Completed!"
echo "📝 Check logs for detailed routing analysis"