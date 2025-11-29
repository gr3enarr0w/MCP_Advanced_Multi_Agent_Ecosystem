# MCP Server Implementation Plan

## Quick Start Implementation Order

Based on your request to implement all components in parallel, here's the practical implementation sequence:

> NOTE: Go implementations in `MCP_structure_design/mcp-servers-go/dist` are now the primary artifacts for task-orchestrator, search-aggregator, and skills-manager. Legacy TypeScript paths mentioned below remain for historical reference and migration notes only.

### Phase 1: Foundation Setup (Day 1-2)
1. **Project Structure** - Create all directories and configuration files
2. **Environment Setup** - Configure environment variables and databases
3. **Base Infrastructure** - Shared utilities and database models

### Phase 2: Core Servers (Day 3-7)
Implement these in parallel (can be done by different developers or AI sessions):

#### Server 1: Context Persistence MCP
- **Priority**: HIGH (solves context loss immediately)
- **Language**: Python
- **Dependencies**: `mcp`, `sqlalchemy`, `tiktoken`, `anthropic`
- **Files to Create**:
  - `mcp-servers/context-persistence/pyproject.toml`
  - `mcp-servers/context-persistence/src/context_persistence/__init__.py`
  - `mcp-servers/context-persistence/src/context_persistence/server.py`
  - `mcp-servers/context-persistence/src/context_persistence/storage.py`
  - `mcp-servers/context-persistence/src/context_persistence/summarization.py`

#### Server 2: Task Orchestrator MCP
- **Priority**: HIGH (task tracking foundation)
- **Language**: TypeScript
- **Dependencies**: `@modelcontextprotocol/sdk`, `simple-git`, `graphology`, `sqlite3`
- **Files to Create**:
  - `mcp-servers/task-orchestrator/package.json`
  - `mcp-servers/task-orchestrator/tsconfig.json`
  - `mcp-servers/task-orchestrator/src/index.ts`
  - `mcp-servers/task-orchestrator/src/task-manager.ts`
  - `mcp-servers/task-orchestrator/src/dependency-graph.ts`

#### Server 3: Code Intelligence MCP
- **Priority**: HIGH (Serena replacement)
- **Language**: Python
- **Dependencies**: `mcp`, `tree-sitter`, `radon`, `bandit`, `pylint`
- **Files to Create**:
  - `mcp-servers/code-intelligence/pyproject.toml`
  - `mcp-servers/code-intelligence/src/code_intelligence/server.py`
  - `mcp-servers/code-intelligence/src/code_intelligence/analyzer.py`
  - `mcp-servers/code-intelligence/src/code_intelligence/metrics.py`

#### Server 4: Python Sandbox MCP
- **Priority**: MEDIUM
- **Language**: Python
- **Dependencies**: `mcp`, `psutil`, `coverage`
- **Files to Create**:
  - `mcp-servers/python-sandbox/pyproject.toml`
  - `mcp-servers/python-sandbox/src/python_sandbox/server.py`
  - `mcp-servers/python-sandbox/src/python_sandbox/sandbox.py`
  - `mcp-servers/python-sandbox/src/python_sandbox/venv_manager.py`

#### Server 5: Research Hub MCP
- **Priority**: MEDIUM (fix Perplexity issues)
- **Language**: TypeScript
- **Dependencies**: `@modelcontextprotocol/sdk`, `axios`, `node-cache`
- **Files to Create**:
  - `mcp-servers/research-hub/package.json`
  - `mcp-servers/research-hub/src/index.ts`
  - `mcp-servers/research-hub/src/providers/perplexity.ts`
  - `mcp-servers/research-hub/src/providers/brave.ts`

#### Server 6: Agent Swarm MCP
- **Priority**: MEDIUM (advanced orchestration)
- **Language**: Python
- **Dependencies**: `mcp`, `asyncio`
- **Files to Create**:
  - `mcp-servers/agent-swarm/pyproject.toml`
  - `mcp-servers/agent-swarm/src/agent_swarm/server.py`
  - `mcp-servers/agent-swarm/src/agent_swarm/orchestrator.py`
  - `mcp-servers/agent-swarm/src/agent_swarm/agents/base.py`

### Phase 3: Integration & Testing (Day 8-10)
1. **Configuration Generation** - Create all config files for each tool
2. **Integration Testing** - Test servers with Roo, Cursor, Codex, Claude Code
3. **Performance Tuning** - Optimize caching, database queries
4. **Documentation** - Usage guides for each server

## Detailed Implementation Steps

### Step 1: Create Project Root Structure

```bash
cd /Users/ceverson
mkdir -p mcp-servers/{context-persistence,task-orchestrator,code-intelligence,python-sandbox,research-hub,agent-swarm,config}
mkdir -p .mcp/{logs,cache/research,cache/code-analysis}
```

### Step 2: Initialize Python Servers

For each Python server (context-persistence, code-intelligence, python-sandbox, agent-swarm):

```bash
# Example for context-persistence
cd ~/mcp-servers/context-persistence
mkdir -p src/context_persistence tests

# Create pyproject.toml
cat > pyproject.toml << 'EOF'
[project]
name = "context-persistence-mcp"
version = "0.1.0"
description = "MCP server for persistent context and conversation history"
requires-python = ">=3.10"
dependencies = [
    "mcp>=1.0.0",
    "sqlalchemy>=2.0.0",
    "tiktoken>=0.7.0",
    "anthropic>=0.25.0"
]

[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"

[project.scripts]
context-persistence = "context_persistence.server:main"
EOF

# Create package init
touch src/context_persistence/__init__.py
```

### Step 3: Initialize TypeScript Servers

For each TypeScript server (task-orchestrator, research-hub):

```bash
# Example for task-orchestrator
cd ~/mcp-servers/task-orchestrator
mkdir -p src tests

# Initialize npm
npm init -y

# Install dependencies
npm install @modelcontextprotocol/sdk simple-git graphology sqlite3
npm install --save-dev @types/node typescript

# Create tsconfig.json
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
EOF
```

### Step 4: Create Setup Scripts

I've already created `MULTI_TOOL_SETUP_GUIDE.md` with comprehensive setup and verification scripts. You can extract and run:

```bash
# Make scripts executable and run
chmod +x ~/mcp-servers/setup.sh ~/mcp-servers/verify.sh
~/mcp-servers/setup.sh
```

## Parallel Implementation Strategy

Since you want all servers implemented in parallel, here's how we can approach it:

### Option 1: Sequential Implementation (Recommended for Solo Work)
1. Start with Context Persistence (most critical)
2. Move to Task Orchestrator (build on context)
3. Implement Code Intelligence (Serena replacement)
4. Add Research Hub (fix Perplexity)
5. Build Python Sandbox
6. Complete with Agent Swarm

### Option 2: True Parallel (Multiple Sessions/Developers)
Use separate coding sessions or developers for each server:
- Session A: Context Persistence + Task Orchestrator (Python + TS)
- Session B: Code Intelligence + Python Sandbox (Python + Python)
- Session C: Research Hub + Agent Swarm (TS + Python)

### Option 3: Modular Implementation (My Recommendation)
Build each server as standalone modules that can be tested independently:

1. **Week 1**: Core infrastructure
   - Database schemas
   - Base MCP server templates
   - Shared utilities

2. **Week 2**: Individual servers (can work on all simultaneously)
   - Each server implements its own tools
   - Uses shared infrastructure
   - Independent testing

3. **Week 3**: Integration
   - Connect servers together
   - Cross-server communication
   - End-to-end testing

## File Creation Order

I'll create files in this order for review:

### Immediate (Next Steps):
1. ✅ `MCP_Enhancement_Architecture.md` - Done
2. ✅ `MULTI_TOOL_SETUP_GUIDE.md` - Done
3. ✅ `IMPLEMENTATION_PLAN.md` - This file

### Next Files to Create:
4. `setup.sh` - Automated setup script
5. `verify.sh` - Verification script
6. Context Persistence implementation files
7. Task Orchestrator implementation files
8. Code Intelligence implementation files
9. Research Hub implementation files
10. Python Sandbox implementation files
11. Agent Swarm implementation files

## Questions Before Implementation

1. **API Keys**: Do you have valid API keys for:
   - Perplexity API
   - Brave Search API
   - GitHub (you have this one already)

2. **Priority**: Which single server is MOST critical to implement first?
   - Context Persistence (fix context loss)
   - Code Intelligence (replace Serena)
   - Task Orchestrator (better task tracking)
   - Research Hub (fix Perplexity)

3. **Testing**: Do you want unit tests for each server, or just integration testing?

4. **Development Approach**: 
   - Should I create all server skeletons first (faster to see structure)?
   - Or fully implement each server one at a time (working code sooner)?

## Implementation Checklist

- [ ] Create project directory structure
- [ ] Initialize Python virtual environment
- [ ] Create pyproject.toml for each Python server
- [ ] Create package.json for each TypeScript server
- [ ] Implement Context Persistence core
- [ ] Implement Task Orchestrator core
- [ ] Implement Code Intelligence core
- [ ] Implement Python Sandbox core
- [ ] Implement Research Hub core
- [ ] Implement Agent Swarm core
- [ ] Create configuration files for Roo
- [ ] Create configuration files for Cursor
- [ ] Create configuration files for Codex
- [ ] Create configuration files for Claude Code
- [ ] Test each server independently
- [ ] Test Roo integration
- [ ] Test Cursor integration
- [ ] Test Codex integration
- [ ] Test Claude Code integration
- [ ] Create migration scripts
- [ ] Write user documentation

## Ready to Proceed

I'm ready to start creating the implementation files. Should I:

A) Create all setup scripts and project structure first?
B) Start implementing Context Persistence server (most critical)?
C) Create skeleton code for all servers simultaneously?
D) Create a specific server you prioritize?

Let me know your preference and I'll proceed accordingly!
