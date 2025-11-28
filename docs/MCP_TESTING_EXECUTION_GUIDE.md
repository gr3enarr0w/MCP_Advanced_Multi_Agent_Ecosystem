# MCP Testing Execution Guide

## Overview

This guide provides step-by-step procedures for executing comprehensive tests across the MCP servers ecosystem, following the infrastructure requirements and security constraints documented in the companion guides.

## Prerequisites

### Environment Setup
1. **Complete build order execution**:
   ```bash
   ./scripts/setup.sh
   ./scripts/install-mcp-servers.sh
   ./scripts/test-installation.sh
   ```

2. **Environment variables configured**:
   ```bash
   # Required for all servers
   MCP_SERVER_PATHS="./src/mcp-servers"
   
   # Required for search-aggregator
   SEARCH_PROVIDER_KEYS="your_api_keys_here"
   
   # Required for GitHub operations
   GITHUB_TOKEN="your_github_token"
   GITHUB_USER_REPOS="ceverson/MCP_Advanced_Multi_Agent_Ecosystem"
   
   # Required for agent-swarm
   AGENT_SWARM_CONFIG="./configs/agent-swarm.json"
   ```

3. **Python 3.12 environment** (context-persistence):
   ```bash
   python3.12 --version
   cd src/mcp-servers/context-persistence
   python3.12 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

## Testing Phases

### Phase 1: Infrastructure Validation

#### 1.1 Validate Jest Configurations
```bash
# Check each TypeScript server for Jest configuration
servers=("task-orchestrator" "search-aggregator" "skills-manager" "agent-swarm")

for server in "${servers[@]}"; do
  echo "🔍 Checking Jest config for $server..."
  cd "src/mcp-servers/$server"
  
  if [ -f "jest.config.js" ]; then
    echo "✅ Jest config found"
    npx jest --showConfig | grep "testTimeout"
  else
    echo "❌ Jest config missing - CRITICAL ISSUE"
  fi
  
  cd ../../..
done
```

#### 1.2 Validate TypeScript Path Aliases
```bash
# Check TypeScript configurations for @/* path aliases
servers=("task-orchestrator" "search-aggregator" "skills-manager" "agent-swarm")

for server in "${servers[@]}"; do
  echo "🔍 Checking TypeScript aliases for $server..."
  cd "src/mcp-servers/$server"
  
  if [ -f "tsconfig.json" ]; then
    if grep -q '"@/\*"' tsconfig.json; then
      echo "✅ Path aliases found"
    else
      echo "❌ Path aliases missing - CRITICAL ISSUE"
    fi
  else
    echo "❌ TypeScript config missing"
  fi
  
  cd ../../..
done
```

#### 1.3 Validate Test Scripts
```bash
# Check package.json for comprehensive test scripts
servers=("task-orchestrator" "search-aggregator" "skills-manager" "agent-swarm")

for server in "${servers[@]}"; do
  echo "🔍 Checking test scripts for $server..."
  cd "src/mcp-servers/$server"
  
  required_scripts=("test" "test:watch" "test:coverage" "test:unit" "test:integration" "test:performance" "test:security")
  
  for script in "${required_scripts[@]}"; do
    if jq -e ".scripts[\"$script\"]" package.json > /dev/null; then
      echo "✅ $script script found"
    else
      echo "❌ $script script missing"
    fi
  done
  
  cd ../../..
done
```

### Phase 2: Individual Server Testing

#### 2.1 Agent-Swarm Server (Reference Standard)
```bash
cd src/mcp-servers/agent-swarm

echo "🧪 Running Agent-Swarm tests..."
npm run test:unit
npm run test:integration
npm run test:performance
npm run test:security
npm run test:coverage

echo "📊 Coverage Report:"
cat coverage/lcov-report/index.html | grep -o "Lines[^%]*%" | head -1
```

#### 2.2 Task-Orchestrator Server
```bash
cd src/mcp-servers/task-orchestrator

echo "🧪 Running Task-Orchestrator tests..."

# First, fix missing infrastructure if needed
if [ ! -f "jest.config.js" ]; then
  echo "⚠️ Creating missing Jest config..."
  # Copy from agent-swarm reference
  cp ../agent-swarm/jest.config.js .
fi

# Run tests
npm run test:unit
npm run test:integration
npm run test:performance
npm run test:security
npm run test:coverage
```

#### 2.3 Search-Aggregator Server
```bash
cd src/mcp-servers/search-aggregator

echo "🧪 Running Search-Aggregator tests..."

# Fix missing infrastructure if needed
if [ ! -f "jest.config.js" ]; then
  echo "⚠️ Creating missing Jest config..."
  cp ../agent-swarm/jest.config.js .
fi

# Run tests
npm run test:unit
npm run test:integration
npm run test:performance
npm run test:security
npm run test:coverage
```

#### 2.4 Skills-Manager Server
```bash
cd src/mcp-servers/skills-manager

echo "🧪 Running Skills-Manager tests..."

# Fix missing infrastructure if needed
if [ ! -f "jest.config.js" ]; then
  echo "⚠️ Creating missing Jest config..."
  cp ../agent-swarm/jest.config.js .
fi

# Run tests
npm run test:unit
npm run test:integration
npm run test:performance
npm run test:security
npm run test:coverage
```

#### 2.5 Context-Persistence Server (Python)
```bash
cd src/mcp-servers/context-persistence

echo "🧪 Running Context-Persistence tests..."

# Activate Python environment
source venv/bin/activate

# Run pytest with coverage
pytest tests/ \
  --cov=context_persistence \
  --cov-report=html \
  --cov-report=term-missing \
  --timeout=30 \
  -v \
  --tb=short

# Run specific test categories
pytest tests/unit/ -m unit --timeout=30
pytest tests/integration/ -m integration --timeout=30
pytest tests/performance/ -m performance --timeout=30
pytest tests/security/ -m security --timeout=30
```

#### 2.6 GitHub OAuth Server (JavaScript)
```bash
cd src/mcp-servers/github-oauth

echo "🧪 Running GitHub OAuth tests..."

# Create Jest config if missing
if [ ! -f "jest.config.js" ]; then
  echo "⚠️ Creating Jest config for JavaScript..."
  cat > jest.config.js << 'EOF'
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  collectCoverageFrom: [
    '*.js',
    '!**/node_modules/**',
    '!coverage/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 30000
};
EOF
fi

# Add test scripts if missing
if ! jq -e '.scripts["test:unit"]' package.json > /dev/null; then
  echo "⚠️ Adding test scripts to package.json..."
  jq '.scripts += {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:unit": "jest --testPathPattern=unit",
    "test:integration": "jest --testPathPattern=integration",
    "test:performance": "jest --testPathPattern=performance",
    "test:security": "jest --testPathPattern=security"
  }' package.json > package.json.tmp && mv package.json.tmp package.json
fi

# Install Jest dependencies
npm install --save-dev jest

# Run tests
npm run test:unit
npm run test:integration
npm run test:performance
npm run test:security
npm run test:coverage
```

### Phase 3: GitHub Security Constraint Testing

#### 3.1 Write Operation Validation
```bash
cd src/mcp-servers/github-oauth

echo "🔒 Testing GitHub write operation constraints..."

# Test write operation on user repository (should succeed)
echo "Testing write operation on user repository..."
node -e "
const { create_or_update_file } = require('./src/github-client');
create_or_update_file({
  owner: 'ceverson',
  repo: 'MCP_Advanced_Multi_Agent_Ecosystem',
  path: 'test-files/constraint-test.md',
  content: '# Constraint Test\nThis tests write operation constraints.',
  message: 'Test write operation constraints'
}).then(result => {
  console.log('✅ Write operation on user repo succeeded:', result.status);
}).catch(err => {
  console.log('❌ Write operation on user repo failed:', err.message);
});
"

# Test write operation on public repository (should fail)
echo "Testing write operation on public repository..."
node -e "
const { create_or_update_file } = require('./src/github-client');
create_or_update_file({
  owner: 'microsoft',
  repo: 'vscode',
  path: 'test-file.md',
  content: 'This should fail',
  message: 'This should not be allowed'
}).then(result => {
  console.log('❌ SECURITY VIOLATION: Write operation on public repo succeeded');
}).catch(err => {
  console.log('✅ Write operation on public repo correctly blocked:', err.message);
});
"
```

#### 3.2 Read Operation Validation
```bash
echo "📖 Testing GitHub read operation permissions..."

# Test read operation on public repository (should succeed)
node -e "
const { get_file_contents } = require('./src/github-client');
get_file_contents({
  owner: 'microsoft',
  repo: 'vscode',
  path: 'README.md'
}).then(result => {
  console.log('✅ Read operation on public repo succeeded:', result.status);
}).catch(err => {
  console.log('❌ Read operation on public repo failed:', err.message);
});
"

# Test read operation on user repository (should succeed)
node -e "
const { get_file_contents } = require('./src/github-client');
get_file_contents({
  owner: 'ceverson',
  repo: 'MCP_Advanced_Multi_Agent_Ecosystem',
  path: 'README.md'
}).then(result => {
  console.log('✅ Read operation on user repo succeeded:', result.status);
}).catch(err => {
  console.log('❌ Read operation on user repo failed:', err.message);
});
"
```

### Phase 4: Cross-Server Integration Testing

#### 4.1 MCP Protocol Compliance
```bash
echo "🔗 Testing MCP protocol compliance across servers..."

servers=("task-orchestrator" "search-aggregator" "skills-manager" "agent-swarm")

for server in "${servers[@]}"; do
  echo "Testing MCP protocol for $server..."
  cd "src/mcp-servers/$server"
  
  # Start server in background
  npm run start &
  SERVER_PID=$!
  
  # Wait for server to start
  sleep 5
  
  # Test MCP protocol
  node -e "
  const { Client } = require('@modelcontextprotocol/sdk/client');
  const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio');
  
  async function testMCP() {
    const transport = new StdioClientTransport({
      command: 'node',
      args: ['dist/index.js']
    });
    
    const client = new Client({
      name: 'test-client',
      version: '1.0.0'
    });
    
    try {
      await client.connect(transport);
      console.log('✅ MCP connection successful for $server');
      
      // Test list tools
      const tools = await client.listTools();
      console.log('✅ Tools listed:', tools.tools.length);
      
      await client.close();
    } catch (error) {
      console.log('❌ MCP connection failed for $server:', error.message);
    }
  }
  
  testMCP();
  "
  
  # Stop server
  kill $SERVER_PID
  
  cd ../../..
done
```

#### 4.2 Agent Delegation Testing
```bash
echo "🤖 Testing agent delegation and boomerang patterns..."

cd src/mcp-servers/agent-swarm

# Test agent delegation
npm run test:integration -- --testNamePattern="delegation"

# Test boomerang pattern
npm run test:integration -- --testNamePattern="boomerang"

# Test SPARC workflow
npm run test:integration -- --testNamePattern="sparc"
```

### Phase 5: Performance and Load Testing

#### 5.1 Performance Benchmarks
```bash
echo "⚡ Running performance benchmarks..."

servers=("task-orchestrator" "search-aggregator" "skills-manager" "agent-swarm")

for server in "${servers[@]}"; do
  echo "Benchmarking $server..."
  cd "src/mcp-servers/$server"
  
  # Run performance tests
  npm run test:performance
  
  # Generate performance report
  node -e "
  const performance = require('./tests/performance/benchmark.js');
  performance.runBenchmark().then(results => {
    console.log('Performance results for $server:', results);
    
    // Check against thresholds
    if (results.averageResponseTime < 5000) {
      console.log('✅ Performance meets requirements');
    } else {
      console.log('❌ Performance below threshold');
    }
  });
  "
  
  cd ../../..
done
```

#### 5.2 Load Testing
```bash
echo "🔄 Running load tests..."

# Concurrent request testing
node -e "
const http = require('http');

async function loadTest(serverUrl, concurrentRequests = 100) {
  const promises = [];
  
  for (let i = 0; i < concurrentRequests; i++) {
    promises.push(
      fetch(serverUrl + '/health')
        .then(res => res.json())
        .then(data => ({ status: 'success', data }))
        .catch(err => ({ status: 'error', error: err.message }))
    );
  }
  
  const results = await Promise.all(promises);
  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  
  console.log(\`Load test results: \${successCount} success, \${errorCount} errors\`);
  
  if (errorCount === 0) {
    console.log('✅ Load test passed');
  } else {
    console.log('❌ Load test failed');
  }
}

// Test each server
const servers = [
  'http://localhost:3001', // task-orchestrator
  'http://localhost:3002', // search-aggregator  
  'http://localhost:3003', // skills-manager
  'http://localhost:3004'  // agent-swarm
];

servers.forEach(url => loadTest(url));
"
```

### Phase 6: Security Testing

#### 6.1 Security Vulnerability Scanning
```bash
echo "🛡️ Running security vulnerability scans..."

servers=("task-orchestrator" "search-aggregator" "skills-manager" "agent-swarm")

for server in "${servers[@]}"; do
  echo "Scanning $server for vulnerabilities..."
  cd "src/mcp-servers/$server"
  
  # Run npm audit
  npm audit --audit-level=moderate
  
  # Run security tests
  npm run test:security
  
  # Check for secrets in code
  if command -v git-secrets > /dev/null; then
    git-secrets --scan
  fi
  
  cd ../../..
done
```

#### 6.2 Input Validation Testing
```bash
echo "🔍 Testing input validation..."

# Test for SQL injection
node -e "
const testCases = [
  \"'; DROP TABLE users; --\",
  \"' OR '1'='1\",
  \"<script>alert('xss')</script>\",
  \"../../../etc/passwd\"
];

testCases.forEach(testCase => {
  console.log('Testing input:', testCase);
  // Test against each server's input validation
});
"
```

## Test Result Analysis

### Coverage Requirements
```bash
echo "📊 Analyzing test coverage..."

servers=("task-orchestrator" "search-aggregator" "skills-manager" "agent-swarm")

for server in "${servers[@]}"; do
  cd "src/mcp-servers/$server"
  
  if [ -f "coverage/coverage-summary.json" ]; then
    lines=$(jq '.total.lines.pct' coverage/coverage-summary.json)
    functions=$(jq '.total.functions.pct' coverage/coverage-summary.json)
    branches=$(jq '.total.branches.pct' coverage/coverage-summary.json)
    statements=$(jq '.total.statements.pct' coverage/coverage-summary.json)
    
    echo "Coverage for $server:"
    echo "  Lines: $lines%"
    echo "  Functions: $functions%"
    echo "  Branches: $branches%"
    echo "  Statements: $statements%"
    
    if (( $(echo "$lines >= 80" | bc -l) )); then
      echo "✅ Coverage meets requirements"
    else
      echo "❌ Coverage below 80% threshold"
    fi
  fi
  
  cd ../../..
done
```

### Performance Analysis
```bash
echo "⚡ Analyzing performance metrics..."

# Check response times
for server in "${servers[@]}"; do
  echo "Performance metrics for $server:"
  
  # Parse performance test results
  if [ -f "tests/performance/results.json" ]; then
    avgTime=$(jq '.averageResponseTime' tests/performance/results.json)
    maxTime=$(jq '.maxResponseTime' tests/performance/results.json)
    
    echo "  Average response time: ${avgTime}ms"
    echo "  Maximum response time: ${maxTime}ms"
    
    if (( $(echo "$avgTime < 5000" | bc -l) )); then
      echo "✅ Performance meets requirements"
    else
      echo "❌ Performance below threshold"
    fi
  fi
done
```

## Continuous Integration

### Automated Test Pipeline
```yaml
# .github/workflows/mcp-testing.yml
name: MCP Servers Testing Pipeline

on:
  push:
    paths: ['src/mcp-servers/**']
  pull_request:
    paths: ['src/mcp-servers/**']

jobs:
  infrastructure-validation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Validate Jest configs
        run: ./scripts/validate-jest-configs.sh
      - name: Validate TypeScript aliases
        run: ./scripts/validate-ts-aliases.sh
      - name: Validate test scripts
        run: ./scripts/validate-test-scripts.sh

  server-testing:
    needs: infrastructure-validation
    runs-on: ubuntu-latest
    strategy:
      matrix:
        server: [task-orchestrator, search-aggregator, skills-manager, agent-swarm]
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Test server
        run: |
          cd src/mcp-servers/${{ matrix.server }}
          npm install
          npm run test:unit
          npm run test:integration
          npm run test:security
          npm run test:coverage

  github-security-testing:
    needs: infrastructure-validation
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Test GitHub constraints
        run: |
          cd src/mcp-servers/github-oauth
          npm install
          npm run test:security
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Troubleshooting

### Common Issues and Solutions

#### Jest Configuration Issues
```bash
# Error: Jest configuration not found
Solution: Copy jest.config.js from agent-swarm reference

# Error: TypeScript compilation failed
Solution: Check tsconfig.json path aliases and ensure @/* patterns exist

# Error: Test timeout exceeded
Solution: Ensure testTimeout is set to 30000 in jest.config.js
```

#### GitHub Testing Issues
```bash
# Error: Write operation on public repository
Solution: This is expected behavior - only user repos allowed for writes

# Error: Authentication failed
Solution: Check GITHUB_TOKEN environment variable

# Error: Rate limit exceeded
Solution: Implement rate limiting in tests
```

#### Performance Issues
```bash
# Error: Response time too slow
Solution: Check for inefficient database queries or API calls

# Error: Memory usage too high
Solution: Profile memory usage and optimize code

# Error: Concurrent request failures
Solution: Implement proper connection pooling
```

## Conclusion

This execution guide provides comprehensive procedures for testing all MCP servers while maintaining strict security constraints for GitHub operations. Follow the phases sequentially to ensure thorough validation of the ecosystem.

**Key Requirements:**
- ✅ All servers must have Jest configurations with 30-second timeouts
- ✅ All TypeScript servers must have @/* path aliases
- ✅ GitHub write operations must only target user repositories
- ✅ All test suites must achieve >80% code coverage
- ✅ Performance tests must meet response time requirements

Following this guide ensures the MCP servers ecosystem meets all architecture and security requirements before deployment.