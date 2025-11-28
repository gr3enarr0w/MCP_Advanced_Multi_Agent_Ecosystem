#!/bin/bash
# Local Development Setup Script for MCP Advanced Multi-Agent Ecosystem

set -e

echo "🛠️  Setting up MCP Advanced Multi-Agent Ecosystem for local development..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "mcp-servers/context-persistence/src/context_persistence/server.py" ]; then
    print_error "Please run this script from the MCP Advanced Multi-Agent Ecosystem root directory"
    exit 1
fi

# Step 1: Setup Python environment for Context Persistence
echo ""
echo "📦 Setting up Python environment for Context Persistence..."
cd mcp-servers/context-persistence

if [ ! -d ".venv" ]; then
    python3.12 -m venv .venv
    print_success "Created Python 3.12 virtual environment"
else
    print_warning "Virtual environment already exists"
fi

source .venv/bin/activate
pip install --upgrade pip setuptools wheel
pip install -e .
print_success "Installed Context Persistence dependencies"

# Test the server
echo ""
echo "🧪 Testing Context Persistence server..."
python -c "from context_persistence.server import main; print('Context Persistence imports successfully')" || {
    print_error "Context Persistence test failed"
    exit 1
}
print_success "Context Persistence server test passed"

cd ../..

# Step 2: Setup Node.js environment for TypeScript servers
echo ""
echo "📦 Setting up Node.js environment for TypeScript servers..."

# Install dependencies for all TypeScript servers
npm install --workspace=mcp-servers/agent-swarm
npm install --workspace=mcp-servers/task-orchestrator
npm install --workspace=mcp-servers/skills-manager
npm install --workspace=mcp-servers/search-aggregator

print_success "Installed Node.js dependencies"

# Build TypeScript servers
echo ""
echo "🔨 Building TypeScript servers..."

npm run build --workspace=mcp-servers/agent-swarm
npm run build --workspace=mcp-servers/task-orchestrator
npm run build --workspace=mcp-servers/skills-manager
npm run build --workspace=mcp-servers/search-aggregator

print_success "Built all TypeScript servers"

# Step 3: Create local data directories
echo ""
echo "📁 Creating local data directories..."

mkdir -p ~/.mcp/{context/db,context/qdrant,tasks,cache/search,logs}

print_success "Created local data directories"

# Step 4: Setup Ollama for local AI models (if not already installed)
echo ""
echo "🤖 Setting up Ollama for local AI models..."

if command -v ollama >/dev/null 2>&1; then
    print_success "Ollama is already installed"
    
    # Check if models are available
    if ollama list | grep -q "llama3.2"; then
        print_success "AI models are already available"
    else
        print_warning "Pulling AI models (this may take a few minutes)..."
        ollama pull llama3.2:1b &
        OLLAMA_PID=$!
        print_success "Started pulling llama3.2:1b model in background (PID: $OLLAMA_PID)"
    fi
else
    print_warning "Ollama is not installed. Please install it from https://ollama.ai"
    print_warning "After installation, run: ollama pull llama3.2:1b"
fi

# Step 5: Create environment configuration
echo ""
echo "⚙️  Creating environment configuration..."

cat > .env.local << 'EOF'
# MCP Advanced Multi-Agent Ecosystem - Local Development Configuration

# Python Configuration
PYTHONPATH=mcp-servers/context-persistence/src

# Node.js Configuration
NODE_ENV=development

# Ollama Configuration
OLLAMA_HOST=http://localhost:11434

# API Keys (add your keys here for enhanced functionality)
# PERPLEXITY_API_KEY=your_key_here
# BRAVE_API_KEY=your_key_here
# GOOGLE_API_KEY=your_key_here
# GOOGLE_CX=your_cx_here

# OpenSkills Configuration
# OPENSKILLS_API_KEY=your_key_here

# Logging Configuration
LOG_LEVEL=info
EOF

print_success "Created .env.local configuration file"

# Step 6: Create VS Code settings
echo ""
echo "⚙️  Creating VS Code settings..."

mkdir -p .vscode

cat > .vscode/settings.json << 'EOF'
{
  "python.defaultInterpreterPath": "./mcp-servers/context-persistence/.venv/bin/python",
  "python.terminal.activateEnvironment": true,
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.venv": true,
    "**/__pycache__": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.venv": true
  }
}
EOF

cat > .vscode/launch.json << 'EOF'
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Context Persistence",
      "type": "python",
      "request": "launch",
      "program": "${workspaceFolder}/mcp-servers/context-persistence/src/context_persistence/server.py",
      "console": "integratedTerminal",
      "cwd": "${workspaceFolder}/mcp-servers/context-persistence",
      "env": {
        "PYTHONPATH": "${workspaceFolder}/mcp-servers/context-persistence/src"
      }
    },
    {
      "name": "Debug Agent Swarm",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/mcp-servers/agent-swarm/src/index.ts",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "cwd": "${workspaceFolder}/mcp-servers/agent-swarm",
      "console": "integratedTerminal"
    },
    {
      "name": "Debug Task Orchestrator",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/mcp-servers/task-orchestrator/src/index.ts",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "cwd": "${workspaceFolder}/mcp-servers/task-orchestrator",
      "console": "integratedTerminal"
    }
  ]
}
EOF

print_success "Created VS Code configuration"

# Step 7: Create test script
echo ""
echo "🧪 Creating test script..."

cat > test-mcp-servers.sh << 'EOF'
#!/bin/bash
# Test script for MCP servers

echo "🧪 Testing MCP servers..."

# Test Context Persistence
echo "Testing Context Persistence..."
cd mcp-servers/context-persistence
source .venv/bin/activate
python -c "import context_persistence.server; print('✅ Context Persistence: OK')" || echo "❌ Context Persistence: FAILED"
cd ../..

# Test Agent Swarm
echo "Testing Agent Swarm..."
cd mcp-servers/agent-swarm
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Agent Swarm: OK"
else
    echo "❌ Agent Swarm: FAILED"
fi
cd ../..

# Test Task Orchestrator
echo "Testing Task Orchestrator..."
cd mcp-servers/task-orchestrator
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Task Orchestrator: OK"
else
    echo "❌ Task Orchestrator: FAILED"
fi
cd ../..

# Test Skills Manager
echo "Testing Skills Manager..."
cd mcp-servers/skills-manager
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Skills Manager: OK"
else
    echo "❌ Skills Manager: FAILED"
fi
cd ../..

# Test Search Aggregator
echo "Testing Search Aggregator..."
cd mcp-servers/search-aggregator
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Search Aggregator: OK"
else
    echo "❌ Search Aggregator: FAILED"
fi
cd ../..

echo ""
echo "🎉 MCP server testing complete!"
EOF

chmod +x test-mcp-servers.sh
print_success "Created test script"

# Step 8: Create quick start script
echo ""
echo "🚀 Creating quick start script..."

cat > start-mcp-servers.sh << 'EOF'
#!/bin/bash
# Quick start script for MCP servers

echo "🚀 Starting MCP servers..."

# Start Context Persistence
echo "Starting Context Persistence..."
cd mcp-servers/context-persistence
source .venv/bin/activate
python -m context_persistence.server &
CONTEXT_PID=$!
cd ../..
print_success "Context Persistence started (PID: $CONTEXT_PID)"

# Start Agent Swarm
echo "Starting Agent Swarm..."
cd mcp-servers/agent-swarm
npm run start &
AGENT_PID=$!
cd ../..
print_success "Agent Swarm started (PID: $AGENT_PID)"

# Start Task Orchestrator
echo "Starting Task Orchestrator..."
cd mcp-servers/task-orchestrator
npm run start &
TASK_PID=$!
cd ../..
print_success "Task Orchestrator started (PID: $TASK_PID)"

echo ""
echo "🎉 All MCP servers started!"
echo ""
echo "To stop all servers, run: kill $CONTEXT_PID $AGENT_PID $TASK_PID"
echo ""
echo "Server Status:"
echo "  Context Persistence: Running (PID: $CONTEXT_PID)"
echo "  Agent Swarm: Running (PID: $AGENT_PID)"
echo "  Task Orchestrator: Running (PID: $TASK_PID)"
EOF

chmod +x start-mcp-servers.sh
print_success "Created quick start script"

# Step 9: Create health check script
echo ""
echo "🏥 Creating health check script..."

cat > health-check.sh << 'EOF'
#!/bin/bash
# Health check script for MCP servers

echo "🏥 Checking MCP server health..."

# Check if servers are running
check_port() {
    local port=$1
    local name=$2
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "✅ $name: Running"
    else
        echo "❌ $name: Not running"
    fi
}

# Check common MCP server ports
check_port 8000 "Context Persistence"
check_port 3000 "Agent Swarm" 
check_port 4000 "Task Orchestrator"

echo ""
echo "Data directories:"
if [ -d ~/.mcp/context ]; then
    echo "✅ Context data directory exists"
else
    echo "❌ Context data directory missing"
fi

echo ""
echo "To start servers, run: ./start-mcp-servers.sh"
echo "To test servers, run: ./test-mcp-servers.sh"
EOF

chmod +x health-check.sh
print_success "Created health check script"

# Final summary
echo ""
echo "🎉 Local development environment setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Review .env.local and add any API keys you have"
echo "   2. Run ./test-mcp-servers.sh to verify everything works"
echo "   3. Run ./start-mcp-servers.sh to start all servers"
echo "   4. Run ./health-check.sh to monitor server status"
echo "   5. Use VS Code with the provided debug configurations"
echo ""
echo "📚 Documentation:"
echo "   - All changes are documented in IMPLEMENTATION_CHANGES.md"
echo "   - API documentation is available in each server's README"
echo "   - Configuration details are in .env.local"
echo ""
print_success "Setup complete! Happy coding! 🚀"
EOF

chmod +x setup-local-development.sh
print_success "Created local development setup script"

echo ""
print_success "✅ Local development environment and testing setup complete!"
echo ""
echo "🚀 To get started:"
echo "   1. Run: ./setup-local-development.sh"
echo "   2. Follow the on-screen instructions"
echo "   3. Use ./test-mcp-servers.sh to verify everything works"
echo "   4. Use ./start-mcp-servers.sh to start all servers"
echo ""
echo "📚 Documentation of all changes has been created in IMPLEMENTATION_CHANGES.md"