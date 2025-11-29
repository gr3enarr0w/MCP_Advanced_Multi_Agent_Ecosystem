# Multi-Tool MCP Configuration Guide

## Overview

This guide configures enhanced MCP server architecture to work with:
- **Roo (Roo-Cline)** - VSCode extension
- **Cursor** - Standalone editor
- **Codex** - Code editor
- **Claude Code** - CLI tool

All tools will share the same MCP servers for consistent functionality.

## Architecture Benefits

### Shared Infrastructure
- **Single Installation**: MCP servers installed once, used by all tools
- **Consistent Data**: Shared context database, task tracking, and research cache
- **Unified Configuration**: Central configuration with tool-specific profiles

### Tool-Specific Optimizations
- **Roo**: Optimized for in-editor coding workflows
- **Cursor**: Enhanced with multi-agent orchestration
- **Codex**: Focused on code analysis and refactoring
- **Claude Code**: Full suite with CLI-specific features

## Installation Directory Structure

```
/Users/ceverson/
├── .mcp/                          # Shared MCP data directory
│   ├── context.db                 # Conversation history (all tools)
│   ├── tasks.db                   # Task tracking (all tools)
│   ├── config.yaml                # Central configuration
│   ├── env                        # Environment variables
│   ├── logs/                      # Centralized logs
│   └── cache/                     # Research & analysis cache
│       ├── research/
│       └── code-analysis/
│
├── mcp-servers/                   # MCP server implementations
│   ├── context-persistence/       # Python server
│   ├── task-orchestrator/         # TypeScript server
│   ├── code-intelligence/         # Python server
│   ├── python-sandbox/            # Python server
│   ├── research-hub/              # TypeScript server
│   ├── agent-swarm/               # Python server
│   └── config/                    # Configuration templates
│
├── .cursor/
│   └── mcp.json                   # Cursor-specific config
│
├── .codex/
│   └── mcp.json                   # Codex-specific config
│
├── .claude/
│   └── mcp.json                   # Claude Code config
│
└── Library/Application Support/Cursor/User/globalStorage/
    └── rooveterinaryinc.roo-cline/settings/
        └── mcp_settings.json      # Roo-specific config
```

## Configuration Files

### 1. Central Environment Variables (`~/.mcp/env`)

```bash
#!/bin/bash
# Central MCP Environment Configuration
# Source this file in your shell profile (.zshrc, .bashrc)

# API Keys
export PERPLEXITY_API_KEY="pplx-your-key-here"
export BRAVE_API_KEY="your-brave-key-here"
export GITHUB_PERSONAL_ACCESS_TOKEN="github_pat_your-token-here"

# MCP Server Paths
export MCP_SERVER_PATH="/Users/ceverson/mcp-servers"
export MCP_DATA_PATH="/Users/ceverson/.mcp"
export MCP_CACHE_PATH="/Users/ceverson/.mcp/cache"

# Database Paths
export MCP_CONTEXT_DB="${MCP_DATA_PATH}/context.db"
export MCP_TASKS_DB="${MCP_DATA_PATH}/tasks.db"

# Configuration
export MCP_LOG_LEVEL="info"
export MCP_MAX_HISTORY=10000
export MCP_CONTEXT_WINDOW=200000

# Python Configuration
export MCP_PYTHON_SANDBOX_DIR="/Users/ceverson/Documents/code"
export MCP_ALLOWED_PYTHON_VERSIONS="3.10,3.11,3.12"

# Code Analysis Configuration
export MCP_ANALYSIS_DEPTH="full"
export MCP_COMPLEXITY_THRESHOLD=10
export MCP_MAINTAINABILITY_THRESHOLD=65

# Research Configuration
export MCP_RESEARCH_CACHE_TTL=86400  # 24 hours
export MCP_RESEARCH_PROVIDERS="perplexity,brave,duckduckgo"

# Agent Swarm Configuration
export MCP_MAX_CONCURRENT_AGENTS=3
export MCP_AGENT_TIMEOUT=300
```

### 2. Central Configuration (`~/.mcp/config.yaml`)

```yaml
version: "1.0"

global:
  log_level: ${MCP_LOG_LEVEL}
  data_dir: ${MCP_DATA_PATH}
  cache_dir: ${MCP_CACHE_PATH}
  
  # Shared across all tools
  shared_databases:
    context: ${MCP_CONTEXT_DB}
    tasks: ${MCP_TASKS_DB}
  
# Server definitions
servers:
  context-persistence:
    enabled: true
    command: python3
    module: mcp_servers.context_persistence
    config:
      db_path: ${MCP_CONTEXT_DB}
      max_history: ${MCP_MAX_HISTORY}
      compression:
        enabled: true
        threshold: 100000
      summarization:
        model: claude-3-haiku-20240307
        max_summary_tokens: 4000
    
  task-orchestrator:
    enabled: true
    command: node
    script: ${MCP_SERVER_PATH}/task-orchestrator/dist/index.js
    config:
      db_path: ${MCP_TASKS_DB}
      git_integration: true
      auto_update: true
      dependency_tracking: true
    
  code-intelligence:
    enabled: true
    command: python3
    module: mcp_servers.code_intelligence
    config:
      analysis_depth: ${MCP_ANALYSIS_DEPTH}
      cache_dir: ${MCP_CACHE_PATH}/code-analysis
      metrics:
        - complexity
        - maintainability
        - security
        - duplication
      thresholds:
        complexity: ${MCP_COMPLEXITY_THRESHOLD}
        maintainability: ${MCP_MAINTAINABILITY_THRESHOLD}
      security:
        enabled: true
        severity_threshold: medium
    
  python-sandbox:
    enabled: true
    command: python3
    module: mcp_servers.python_sandbox
    config:
      sandbox_dir: ${MCP_PYTHON_SANDBOX_DIR}
      allowed_versions: ${MCP_ALLOWED_PYTHON_VERSIONS}
      resource_limits:
        cpu_time: 30
        memory: 512M
        processes: 10
      security:
        network_isolation: true
        filesystem_restriction: true
    
  research-hub:
    enabled: true
    command: node
    script: ${MCP_SERVER_PATH}/research-hub/dist/index.js
    config:
      cache_dir: ${MCP_CACHE_PATH}/research
      cache_ttl: ${MCP_RESEARCH_CACHE_TTL}
      providers:
        - name: perplexity
          priority: 1
          api_key: ${PERPLEXITY_API_KEY}
          enabled: true
        - name: brave
          priority: 2
          api_key: ${BRAVE_API_KEY}
          enabled: true
        - name: duckduckgo
          priority: 3
          enabled: true
      specialized_sources:
        - devdocs
        - github_code_search
        - stackoverflow
    
  agent-swarm:
    enabled: true
    command: python3
    module: mcp_servers.agent_swarm
    config:
      agents:
        - research
        - architect
        - implementation
        - testing
        - review
        - documentation
        - debugger
      orchestration:
        max_concurrent: ${MCP_MAX_CONCURRENT_AGENTS}
        timeout: ${MCP_AGENT_TIMEOUT}
        coordination_mode: collaborative

# Tool-specific profiles
profiles:
  roo:
    description: "Roo-Cline VSCode extension"
    servers:
      - context-persistence
      - task-orchestrator
      - code-intelligence
      - research-hub
    features:
      inline_suggestions: true
      auto_context_save: true
      
  cursor:
    description: "Cursor editor"
    servers:
      - context-persistence
      - task-orchestrator
      - code-intelligence
      - python-sandbox
      - research-hub
      - agent-swarm
    features:
      multi_agent: true
      advanced_refactoring: true
      
  codex:
    description: "Codex editor"
    servers:
      - code-intelligence
      - task-orchestrator
      - research-hub
    features:
      code_analysis_focus: true
      
  claude-code:
    description: "Claude Code CLI"
    servers:
      - context-persistence
      - task-orchestrator
      - code-intelligence
      - python-sandbox
      - research-hub
      - agent-swarm
    features:
      full_suite: true
      cli_optimized: true
```

### 3. Roo Configuration

**File**: `~/Library/Application Support/Cursor/User/globalStorage/rooveterinaryinc.roo-cline/settings/mcp_settings.json`

```json
{
  "mcpServers": {
    "context-persistence": {
      "command": "python3",
      "args": ["-m", "mcp_servers.context_persistence"],
      "env": {
        "MCP_CONTEXT_DB": "${MCP_CONTEXT_DB}",
        "MCP_LOG_LEVEL": "${MCP_LOG_LEVEL}"
      }
    },
    "task-orchestrator": {
      "command": "/Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/MCP_structure_design/mcp-servers-go/dist/task-orchestrator",
      "args": [],
      "env": {
        "MCP_TASKS_DB": "${MCP_TASKS_DB}"
      }
    },
    "code-intelligence": {
      "command": "python3",
      "args": ["-m", "mcp_servers.code_intelligence"],
      "env": {
        "MCP_ANALYSIS_DEPTH": "${MCP_ANALYSIS_DEPTH}",
        "MCP_CACHE_PATH": "${MCP_CACHE_PATH}"
      }
    },
    "research-hub": {
      "command": "node",
      "args": ["/Users/ceverson/mcp-servers/research-hub/dist/index.js"],
      "env": {
        "PERPLEXITY_API_KEY": "${PERPLEXITY_API_KEY}",
        "BRAVE_API_KEY": "${BRAVE_API_KEY}",
        "MCP_CACHE_PATH": "${MCP_CACHE_PATH}"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "~/Development"]
    },
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    }
  }
}
```

### 4. Cursor Configuration

**File**: `~/.cursor/mcp.json`

```json
{
  "mcpServers": {
    "context-persistence": {
      "command": "python3",
      "args": ["-m", "mcp_servers.context_persistence"],
      "env": {
        "MCP_CONTEXT_DB": "${MCP_CONTEXT_DB}"
      }
    },
    "task-orchestrator": {
      "command": "/Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/MCP_structure_design/mcp-servers-go/dist/task-orchestrator",
      "args": []
    },
    "code-intelligence": {
      "command": "python3",
      "args": ["-m", "mcp_servers.code_intelligence"]
    },
    "python-sandbox": {
      "command": "python3",
      "args": ["-m", "mcp_servers.python_sandbox"],
      "env": {
        "SANDBOX_DIR": "${MCP_PYTHON_SANDBOX_DIR}",
        "ALLOWED_PYTHONS": "${MCP_ALLOWED_PYTHON_VERSIONS}"
      }
    },
    "research-hub": {
      "command": "node",
      "args": ["/Users/ceverson/mcp-servers/research-hub/dist/index.js"]
    },
    "agent-swarm": {
      "command": "python3",
      "args": ["-m", "mcp_servers.agent_swarm"]
    },
    "github-official": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_PERSONAL_ACCESS_TOKEN}"
      }
    },
    "playwright-official": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-puppeteer"]
    }
  }
}
```

### 5. Codex Configuration

**File**: `~/.codex/mcp.json`

```json
{
  "mcpServers": {
    "code-intelligence": {
      "command": "python3",
      "args": ["-m", "mcp_servers.code_intelligence"],
      "env": {
        "MCP_ANALYSIS_DEPTH": "full"
      }
    },
    "task-orchestrator": {
      "command": "/Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/MCP_structure_design/mcp-servers-go/dist/task-orchestrator",
      "args": []
    },
    "research-hub": {
      "command": "node",
      "args": ["/Users/ceverson/mcp-servers/research-hub/dist/index.js"]
    }
  }
}
```

### 6. Claude Code Configuration

**File**: `~/.claude/mcp.json`

```json
{
  "mcpServers": {
    "context-persistence": {
      "command": "python3",
      "args": ["-m", "mcp_servers.context_persistence"]
    },
    "task-orchestrator": {
      "command": "/Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/MCP_structure_design/mcp-servers-go/dist/task-orchestrator",
      "args": []
    },
    "code-intelligence": {
      "command": "python3",
      "args": ["-m", "mcp_servers.code_intelligence"]
    },
    "python-sandbox": {
      "command": "python3",
      "args": ["-m", "mcp_servers.python_sandbox"]
    },
    "research-hub": {
      "command": "node",
      "args": ["/Users/ceverson/mcp-servers/research-hub/dist/index.js"]
    },
    "agent-swarm": {
      "command": "python3",
      "args": ["-m", "mcp_servers.agent_swarm"]
    }
  }
}
```

## Setup Script

Create `~/mcp-servers/setup.sh`:

```bash
#!/bin/bash
set -e

echo "=== MCP Multi-Tool Setup ==="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v python3 &> /dev/null; then
    print_error "Python 3 not found. Please install Python 3.10+"
    exit 1
fi
print_status "Python 3 found: $(python3 --version)"

if ! command -v node &> /dev/null; then
    print_error "Node.js not found. Please install Node.js 18+"
    exit 1
fi
print_status "Node.js found: $(node --version)"

if ! command -v npm &> /dev/null; then
    print_error "npm not found. Please install npm"
    exit 1
fi
print_status "npm found: $(npm --version)"

# Create directory structure
echo ""
echo "Creating directory structure..."

mkdir -p ~/.mcp/{logs,cache/research,cache/code-analysis}
print_status "Created ~/.mcp directories"

mkdir -p ~/mcp-servers/{context-persistence,task-orchestrator,code-intelligence,python-sandbox,research-hub,agent-swarm}/{src,tests}
mkdir -p ~/mcp-servers/config
print_status "Created ~/mcp-servers directories"

# Install Python dependencies
echo ""
echo "Installing Python dependencies..."

cd ~/mcp-servers

# Create virtual environment for Python servers
if [ ! -d "venv" ]; then
    python3 -m venv venv
    print_status "Created Python virtual environment"
fi

source venv/bin/activate

# Install base MCP SDK and dependencies
pip install --upgrade pip
pip install mcp sqlalchemy tiktoken anthropic tree-sitter radon bandit pylint

print_status "Installed Python dependencies"

# Install Node.js dependencies
echo ""
echo "Installing Node.js dependencies..."

cd ~/MCP_Advanced_Multi_Agent_Ecosystem/MCP_structure_design/mcp-servers-go  # Go servers (preferred)
if [ ! -f "package.json" ]; then
    npm init -y
    npm install @modelcontextprotocol/sdk simple-git graphology sqlite3
    print_status "Installed task-orchestrator dependencies"
fi

cd ~/mcp-servers/research-hub
if [ ! -f "package.json" ]; then
    npm init -y
    npm install @modelcontextprotocol/sdk axios node-cache
    print_status "Installed research-hub dependencies"
fi

# Create environment file
echo ""
echo "Creating environment configuration..."

if [ ! -f ~/.mcp/env ]; then
    cat > ~/.mcp/env << 'EOF'
#!/bin/bash
# MCP Environment Configuration

# API Keys (EDIT THESE)
export PERPLEXITY_API_KEY="pplx-your-key-here"
export BRAVE_API_KEY="your-brave-key-here"
export GITHUB_PERSONAL_ACCESS_TOKEN="github_pat_your-token-here"

# MCP Server Paths
export MCP_SERVER_PATH="/Users/ceverson/mcp-servers"
export MCP_DATA_PATH="/Users/ceverson/.mcp"
export MCP_CACHE_PATH="/Users/ceverson/.mcp/cache"

# Database Paths
export MCP_CONTEXT_DB="${MCP_DATA_PATH}/context.db"
export MCP_TASKS_DB="${MCP_DATA_PATH}/tasks.db"

# Configuration
export MCP_LOG_LEVEL="info"
export MCP_MAX_HISTORY=10000
export MCP_CONTEXT_WINDOW=200000

# Python Configuration
export MCP_PYTHON_SANDBOX_DIR="/Users/ceverson/Documents/code"
export MCP_ALLOWED_PYTHON_VERSIONS="3.10,3.11,3.12"

# Code Analysis
export MCP_ANALYSIS_DEPTH="full"
export MCP_COMPLEXITY_THRESHOLD=10
export MCP_MAINTAINABILITY_THRESHOLD=65

# Research
export MCP_RESEARCH_CACHE_TTL=86400
export MCP_RESEARCH_PROVIDERS="perplexity,brave,duckduckgo"

# Agent Swarm
export MCP_MAX_CONCURRENT_AGENTS=3
export MCP_AGENT_TIMEOUT=300
EOF
    print_status "Created ~/.mcp/env"
    print_warning "IMPORTANT: Edit ~/.mcp/env to add your API keys!"
else
    print_warning "~/.mcp/env already exists, skipping"
fi

# Add to shell profile
echo ""
echo "Adding to shell profile..."

SHELL_PROFILE=""
if [ -f ~/.zshrc ]; then
    SHELL_PROFILE=~/.zshrc
elif [ -f ~/.bashrc ]; then
    SHELL_PROFILE=~/.bashrc
fi

if [ -n "$SHELL_PROFILE" ]; then
    if ! grep -q "source ~/.mcp/env" "$SHELL_PROFILE"; then
        echo "" >> "$SHELL_PROFILE"
        echo "# MCP Environment" >> "$SHELL_PROFILE"
        echo "source ~/.mcp/env" >> "$SHELL_PROFILE"
        print_status "Added MCP env to $SHELL_PROFILE"
    else
        print_warning "MCP env already in $SHELL_PROFILE"
    fi
fi

# Create databases
echo ""
echo "Initializing databases..."

python3 << 'PYTHON'
import sqlite3
from pathlib import Path

db_path = Path.home() / '.mcp'

# Context database
context_db = db_path / 'context.db'
conn = sqlite3.connect(context_db)
cursor = conn.cursor()

cursor.execute('''
    CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        project_path TEXT,
        mode TEXT
    )
''')

cursor.execute('''
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        role TEXT,
        content TEXT,
        tokens INTEGER,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    )
''')

cursor.execute('''
    CREATE TABLE IF NOT EXISTS decisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        decision_type TEXT,
        context TEXT,
        outcome TEXT,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    )
''')

conn.commit()
conn.close()

# Tasks database
tasks_db = db_path / 'tasks.db'
conn = sqlite3.connect(tasks_db)
cursor = conn.cursor()

cursor.execute('''
    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status TEXT CHECK(status IN ('pending', 'in_progress', 'blocked', 'completed')),
        description TEXT,
        dependencies TEXT,
        priority INTEGER DEFAULT 0
    )
''')

conn.commit()
conn.close()

print("Databases initialized successfully")
PYTHON

print_status "Initialized SQLite databases"

# Summary
echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Edit ~/.mcp/env to add your API keys"
echo "2. Restart your terminal or run: source ~/.mcp/env"
echo "3. Verify setup: ~/mcp-servers/verify.sh"
echo ""
echo "The following tools are configured:"
echo "  - Roo (Roo-Cline)"
echo "  - Cursor"
echo "  - Codex"
echo "  - Claude Code"
echo ""
print_status "All MCP servers ready to use!"
```

## Verification Script

Create `~/mcp-servers/verify.sh`:

```bash
#!/bin/bash

echo "=== MCP Setup Verification ==="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

check_pass() {
    echo -e "${GREEN}[✓]${NC} $1"
}

check_fail() {
    echo -e "${RED}[✗]${NC} $1"
}

check_warn() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Check directories
echo "Checking directories..."
[ -d ~/.mcp ] && check_pass "~/.mcp exists" || check_fail "~/.mcp missing"
[ -d ~/.mcp/logs ] && check_pass "~/.mcp/logs exists" || check_fail "~/.mcp/logs missing"
[ -d ~/.mcp/cache ] && check_pass "~/.mcp/cache exists" || check_fail "~/.mcp/cache missing"
[ -d ~/mcp-servers ] && check_pass "~/mcp-servers exists" || check_fail "~/mcp-servers missing"

echo ""
echo "Checking databases..."
[ -f ~/.mcp/context.db ] && check_pass "context.db exists" || check_fail "context.db missing"
[ -f ~/.mcp/tasks.db ] && check_pass "tasks.db exists" || check_fail "tasks.db missing"

echo ""
echo "Checking environment..."
[ -f ~/.mcp/env ] && check_pass "env file exists" || check_fail "env file missing"

source ~/.mcp/env 2>/dev/null

[ -n "$MCP_SERVER_PATH" ] && check_pass "MCP_SERVER_PATH set" || check_fail "MCP_SERVER_PATH not set"
[ -n "$PERPLEXITY_API_KEY" ] && [ "$PERPLEXITY_API_KEY" != "pplx-your-key-here" ] && check_pass "Perplexity API key configured" || check_warn "Perplexity API key not configured"
[ -n "$BRAVE_API_KEY" ] && [ "$BRAVE_API_KEY" != "your-brave-key-here" ] && check_pass "Brave API key configured" || check_warn "Brave API key not configured"
[ -n "$GITHUB_PERSONAL_ACCESS_TOKEN" ] && [ "$GITHUB_PERSONAL_ACCESS_TOKEN" != "github_pat_your-token-here" ] && check_pass "GitHub token configured" || check_warn "GitHub token not configured"

echo ""
echo "Checking Python environment..."
if [ -f ~/mcp-servers/venv/bin/python ]; then
    check_pass "Python venv exists"
    source ~/mcp-servers/venv/bin/activate
    python -c "import mcp" 2>/dev/null && check_pass "MCP SDK installed" || check_fail "MCP SDK not installed"
    python -c "import sqlalchemy" 2>/dev/null && check_pass "SQLAlchemy installed" || check_fail "SQLAlchemy not installed"
else
    check_fail "Python venv missing"
fi

echo ""
echo "Checking Node.js dependencies..."
cd ~/MCP_Advanced_Multi_Agent_Ecosystem/MCP_structure_design/mcp-servers-go  # Go servers (preferred)
if [ -f "package.json" ]; then
    check_pass "task-orchestrator package.json exists"
    [ -d "node_modules" ] && check_pass "task-orchestrator dependencies installed" || check_warn "task-orchestrator dependencies not installed"
else
    check_warn "task-orchestrator not initialized"
fi

echo ""
echo "Checking configuration files..."
[ -f ~/.cursor/mcp.json ] && check_pass "Cursor config exists" || check_warn "Cursor config missing"
[ -f ~/Library/Application\ Support/Cursor/User/globalStorage/rooveterinaryinc.roo-cline/settings/mcp_settings.json ] && check_pass "Roo config exists" || check_warn "Roo config missing"
[ -f ~/.codex/mcp.json ] && check_pass "Codex config exists" || check_warn "Codex config missing"
[ -f ~/.claude/mcp.json ] && check_pass "Claude Code config exists" || check_warn "Claude Code config missing"

echo ""
echo "=== Verification Complete ==="
```

## Usage Instructions

### Initial Setup

```bash
# 1. Make scripts executable
chmod +x ~/mcp-servers/setup.sh
chmod +x ~/mcp-servers/verify.sh

# 2. Run setup
~/mcp-servers/setup.sh

# 3. Edit environment file with your API keys
nano ~/.mcp/env

# 4. Restart terminal or source env
source ~/.mcp/env

# 5. Verify setup
~/mcp-servers/verify.sh
```

### Using with Different Tools

#### Roo (in VSCode/Cursor)
1. Open VSCode/Cursor
2. Roo will automatically load MCP servers from config
3. All shared servers are available

#### Cursor
1. Restart Cursor after setup
2. MCP servers loaded automatically from `~/.cursor/mcp.json`
3. Full multi-agent capabilities available

#### Codex
1. Restart Codex
2. Code analysis focused servers loaded
3. Research and task tracking available

#### Claude Code (CLI)
```bash
# Full suite available in CLI
claude --mcp

# Check server status
claude /mcp
```

## Shared Data Benefits

### Context Persistence
- **All tools** share the same conversation history
- Switch between tools without losing context
- Full history searchable from any tool

### Task Tracking
- Tasks created in Roo visible in Cursor
- Git integration works across all tools
- Unified progress tracking

### Research Cache
- Research results cached once, used by all tools
- No duplicate API calls
- Faster research across tools

### Code Analysis
- Analysis cached per file
- All tools see same code quality metrics
- Consistent refactoring suggestions

## Troubleshooting

### Servers Not Loading

```bash
# Check logs
tail -f ~/.mcp/logs/mcp.log

# Verify environment
source ~/.mcp/env
echo $MCP_SERVER_PATH

# Test database connections
sqlite3 ~/.mcp/context.db "SELECT COUNT(*) FROM conversations;"
```

### API Keys Not Working

```bash
# Verify keys are set
echo $PERPLEXITY_API_KEY
echo $BRAVE_API_KEY

# Re-source environment
source ~/.mcp/env
```

### Python Module Not Found

```bash
# Activate venv
source ~/mcp-servers/venv/bin/activate

# Install dependencies
pip install mcp sqlalchemy tiktoken anthropic
```

## Next Steps

After setup:
1. Implement each MCP server (next phase)
2. Test integration with each tool
3. Verify shared data working correctly
4. Optimize performance
5. Add monitoring and alerts
