# MCP Advanced Multi-Agent Ecosystem - Local Mac Setup Guide

## 🎯 Overview

This guide will help you set up the complete MCP Advanced Multi-Agent Ecosystem on your local Mac. Everything runs locally with no Docker, no cloud dependencies, and no external hosting required.

## ✅ What You'll Get

- **3 MCP Servers** running locally on your Mac:
  - **Task Orchestrator**: Task management with git integration
  - **Search Aggregator**: Multi-provider search with caching
  - **Skills Manager**: Skill tracking and learning goals
- **Local data storage** in `~/.mcp/` (SQLite databases)
- **Integration** with Roo Code (VSCode) or Cursor
- **SPARC workflow** support for multi-agent orchestration

## 📋 Prerequisites

- **macOS** (tested on macOS)
- **Go 1.21+** installed
- **VSCode** with Roo Code extension **OR** **Cursor** IDE
- **Git** (for task orchestrator integration)

## 🚀 Quick Start (Automated)

Run the automated setup script:

```bash
cd mcp-servers-go
./scripts/setup-local.sh
```

This will:
1. Build all MCP servers
2. Create data directories
3. Set up environment configuration
4. Validate server startup
5. Configure your MCP client
6. Run integration tests

## 🔧 Manual Setup (If Automated Script Fails)

### Step 1: Build the Servers

```bash
cd mcp-servers-go
make build
```

This creates three binaries in `dist/`:
- `task-orchestrator` (~6MB)
- `search-aggregator` (~14MB)
- `skills-manager` (~14MB)

### Step 2: Create Data Directories

```bash
mkdir -p ~/.mcp/{tasks,cache/search,skills,logs}
```

### Step 3: Set Up Environment

Create `~/.mcp/mcp.env`:

```bash
cat > ~/.mcp/mcp.env << 'EOF'
# MCP Server Configuration
export MCP_DATABASE_DIR="$HOME/.mcp"
export MCP_LOG_LEVEL="info"

# Optional: Add API keys for search providers
# export PERPLEXITY_API_KEY="your-key-here"
# export BRAVE_API_KEY="your-key-here"
EOF
```

### Step 4: Validate Servers

```bash
./scripts/validate-servers.sh
```

You should see output showing each server starting and registering tools.

### Step 5: Configure Your MCP Client

#### For **Cursor**:

Create `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "task-orchestrator": {
      "command": "/Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/MCP_structure_design/mcp-servers-go/dist/task-orchestrator",
      "args": [],
      "env": {
        "MCP_DATABASE_DIR": "/Users/ceverson/.mcp/tasks",
        "MCP_LOG_LEVEL": "info"
      }
    },
    "search-aggregator": {
      "command": "/Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/MCP_structure_design/mcp-servers-go/dist/search-aggregator",
      "args": [],
      "env": {
        "MCP_DATABASE_DIR": "/Users/ceverson/.mcp/cache",
        "MCP_LOG_LEVEL": "info"
      }
    },
    "skills-manager": {
      "command": "/Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/MCP_structure_design/mcp-servers-go/dist/skills-manager",
      "args": [],
      "env": {
        "MCP_DATABASE_DIR": "/Users/ceverson/.mcp/skills",
        "MCP_LOG_LEVEL": "info"
      }
    }
  }
}
```

#### For **Roo Code** (VSCode):

Add to your VSCode `settings.json`:

```json
{
  "roo-code.mcpServers": {
    "task-orchestrator": {
      "command": "/Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/MCP_structure_design/mcp-servers-go/dist/task-orchestrator",
      "args": [],
      "env": {
        "MCP_DATABASE_DIR": "/Users/ceverson/.mcp/tasks",
        "MCP_LOG_LEVEL": "info"
      }
    },
    "search-aggregator": {
      "command": "/Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/MCP_structure_design/mcp-servers-go/dist/search-aggregator",
      "args": [],
      "env": {
        "MCP_DATABASE_DIR": "/Users/ceverson/.mcp/cache",
        "MCP_LOG_LEVEL": "info"
      }
    },
    "skills-manager": {
      "command": "/Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/MCP_structure_design/mcp-servers-go/dist/skills-manager",
      "args": [],
      "env": {
        "MCP_DATABASE_DIR": "/Users/ceverson/.mcp/skills",
        "MCP_LOG_LEVEL": "info"
      }
    }
  }
}
```

## 🧪 Testing Your Setup

### Test 1: Validate Servers

```bash
./scripts/validate-servers.sh
```

Expected output:
```
✓ task-orchestrator started successfully
✓ task-orchestrator initialized storage
✓ task-orchestrator registered 5 tools
✓ task-orchestrator started without errors
ℹ Task Orchestrator MCP Server v1.0.0 starting...
```

### Test 2: Run Integration Tests

```bash
make test
```

This runs the SPARC workflow integration tests.

### Test 3: Manual Server Test

Start a server and check it runs:

```bash
./dist/task-orchestrator &
sleep 3
ps aux | grep task-orchestrator
kill %1
```

You should see the server process running.

## 🎯 Using the MCP Servers

Once configured and your IDE is restarted, you can use these tools in your AI assistant:

### Task Orchestrator Tools:
- `create_task` - Create a new task with dependencies
- `update_task_status` - Update task status (pending, in_progress, completed, etc.)
- `get_task` - Get task details
- `list_tasks` - List all tasks with filters
- `execute_code` - Execute code in sandbox (Python, JavaScript, Bash, SQL)

### Search Aggregator Tools:
- `search` - Search with automatic provider fallback
- `get_available_providers` - List configured search providers
- `clear_search_cache` - Clear old search results

### Skills Manager Tools:
- `add_skill` - Add a skill to your inventory
- `list_skills` - List your skills with filtering
- `create_learning_goal` - Create a learning goal
- `analyze_skill_gaps` - Analyze gaps for career goals

## 💡 Example Usage

### Example 1: Create a Task
```
"Create a task to build a REST API in Go with dependencies on design and testing phases"
```

### Example 2: Search
```
"Search for best practices in Go error handling"
```

### Example 3: Track Skills
```
"Add Go programming to my skills at intermediate level"
```

### Example 4: SPARC Workflow
```
"Use SPARC workflow to design a caching system"
```

## 📁 Data Storage

All data is stored locally in `~/.mcp/`:

```
~/.mcp/
├── tasks/
│   └── tasks.db          # Task Orchestrator database
├── cache/
│   └── search/
│       └── cache.db      # Search Aggregator cache
├── skills/
│   └── skills.db         # Skills Manager database
├── logs/                 # Server logs (if enabled)
└── mcp.env              # Environment configuration
```

## 🔍 Troubleshooting

### Problem: Servers won't start
**Solution**: Check permissions and run validation:
```bash
chmod +x dist/*
./scripts/validate-servers.sh
```

### Problem: Tools don't appear in AI assistant
**Solution**: 
1. Restart your IDE
2. Check MCP configuration is correct
3. Verify servers start: `./dist/task-orchestrator` (should show startup logs)

### Problem: Database errors
**Solution**: 
```bash
# Check database files
ls -la ~/.mcp/*/*.db

# Remove and recreate if corrupted
rm ~/.mcp/tasks/tasks.db
./dist/task-orchestrator  # Will recreate database
```

### Problem: Integration tests fail
**Solution**: 
```bash
# Run tests with verbose output
make test-verbose

# Check test logs
cat /tmp/test.log
```

## 📊 Performance

On a typical Mac:
- **Startup time**: ~100ms per server
- **Memory usage**: ~20MB per server
- **Database size**: ~1-10MB (grows with usage)
- **Binary sizes**: 6-14MB each

## 🔒 Security

- **No network exposure**: Servers only communicate via stdio with MCP client
- **Local data only**: All databases are local SQLite files
- **Sandboxed execution**: Code execution is isolated with resource limits
- **No cloud dependencies**: Works completely offline (except search queries)

## 🔄 Updating

To update to a new version:

```bash
cd mcp-servers-go
git pull origin main
make clean
make build
./scripts/validate-servers.sh
```

## 📚 Additional Resources

- [GO_REWRITE_COMPLETION_SUMMARY.md](GO_REWRITE_COMPLETION_SUMMARY.md) - Full implementation details
- [BUILD_AND_INSTALL.md](BUILD_AND_INSTALL.md) - Build instructions
- [MCP_Enhancement_Architecture.md](MCP_Enhancement_Architecture.md) - Architecture overview

## 🤝 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Run validation scripts: `./scripts/validate-servers.sh`
3. Check logs in `/tmp/` or `~/.mcp/logs/`
4. Review the configuration files

## 🎉 Success!

Once setup is complete, you should be able to:
- See MCP tools in your AI assistant
- Create and manage tasks
- Search with multiple providers
- Track your skills and learning goals
- Use SPARC workflow for complex projects

All running locally on your Mac with no external dependencies!