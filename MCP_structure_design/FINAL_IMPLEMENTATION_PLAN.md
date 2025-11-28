# Final MCP Implementation Plan - Local-First Architecture

## Core Principle: Local-First, Privacy-Focused

All data storage must be on your local machine. No cloud services for core functionality.

## Component Decisions

### 1. Context Persistence ✅ BUILD CUSTOM
**Decision**: Build using Qdrant local + SQLite
**Why**: Need local conversation history with semantic search
**Storage**: `~/.mcp/context/`
- `conversation.db` - SQLite for structured data
- `qdrant/` - Local Qdrant instance for vector search

**Implementation**:
```python
# mcp-servers/context-persistence/src/server.py
from mcp.server.fastmcp import FastMCP
from qdrant_client import QdrantClient
import sqlalchemy

mcp = FastMCP("Context Persistence")

# Local Qdrant client (no server needed)
qdrant = QdrantClient(path="~/.mcp/context/qdrant")

@mcp.tool()
async def save_conversation(conversation_id: str, messages: list):
    """Save conversation with vector embeddings"""
    # Save to SQLite for structured queries
    # Save embeddings to local Qdrant for semantic search

@mcp.tool()
async def search_similar_conversations(query: str, limit: int = 5):
    """Semantic search across conversation history"""
    # Use Qdrant local instance
```

### 2. Task Orchestrator ✅ BUILD CUSTOM
**Decision**: Build local-first task system
**Why**: No existing MCP does local task tracking with git integration
**Storage**: `~/.mcp/tasks/`
- `tasks.db` - SQLite for task data
- Git hooks for auto-tracking

**Implementation**:
```typescript
// mcp-servers/task-orchestrator/src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import sqlite3 from 'sqlite3';
import simpleGit from 'simple-git';

// Local SQLite database
const db = new sqlite3.Database('~/.mcp/tasks/tasks.db');

// Git integration
const git = simpleGit();

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch(request.params.name) {
    case 'create_task':
      // Create task in local DB
      // Set up git hook if needed
      break;
    case 'update_task_from_commit':
      // Automatically update task status based on commit
      break;
    case 'get_task_graph':
      // Return DAG from local DB
      break;
  }
});
```

### 3. Search Aggregator ✅ USE EXISTING + WRAPPER
**Decision**: Use existing MCP servers with simple coordinator
**Available MCPs**:
- `@modelcontextprotocol/server-brave-search` ✅ Official
- Perplexity (already configured, needs API key fix)
- Google Search MCP (need to find/verify)
- DuckDuckGo MCP (need to find/verify)

**Implementation**:
```typescript
// mcp-servers/search-aggregator/src/index.ts
// Simple coordinator that calls existing MCPs
import { ClientSession } from '@modelcontextprotocol/sdk/client/index.js';

class SearchAggregator {
  private providers = [
    { name: 'perplexity', priority: 1 },
    { name: 'brave', priority: 2 },
    { name: 'google', priority: 3 },
    { name: 'duckduckgo', priority: 4 }
  ];

  async search(query: string) {
    for (const provider of this.providers) {
      try {
        // Call respective MCP server
        const result = await this.callProvider(provider.name, query);
        if (result) return result;
      } catch (error) {
        // Fall through to next provider
        continue;
      }
    }
  }
}
```

## Implementation Phases

### Phase 1: Foundation (Days 1-2)

#### 1.1 Set Up Local Storage Structure
```bash
mkdir -p ~/.mcp/{context/{qdrant,db},tasks,cache/{search,code}}
```

#### 1.2 Install Qdrant Local
```bash
pip install qdrant-client
# No server needed - uses local embedded mode
```

#### 1.3 Fix Existing MCP Configurations
```bash
# Add Perplexity API key
export PERPLEXITY_API_KEY="your-key-here"

# Install Brave Search MCP
npm install -g @modelcontextprotocol/server-brave-search

# Verify existing servers
ls -la ~/.mcp/
```

### Phase 2: Build Context Persistence (Days 3-4)

**File Structure**:
```
mcp-servers/context-persistence/
├── pyproject.toml
├── src/
│   └── context_persistence/
│       ├── __init__.py
│       ├── server.py           # FastMCP server
│       ├── storage.py          # SQLite operations
│       ├── vector.py           # Qdrant operations
│       └── compression.py      # Context compression
└── tests/
```

**Key Features**:
- [x] Save conversations to local SQLite
- [x] Generate embeddings and store in local Qdrant
- [x] Semantic search across conversations
- [x] Context compression for large histories
- [x] Export/import functionality

### Phase 3: Build Task Orchestrator (Days 5-6)

**File Structure**:
```
mcp-servers/task-orchestrator/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Main server
│   ├── database.ts           # SQLite operations
│   ├── git-hooks.ts          # Git integration
│   ├── dag.ts                # Dependency graph
│   └── types.ts              # TypeScript types
└── tests/
```

**Key Features**:
- [x] Create/update/delete tasks (local SQLite)
- [x] Track dependencies (DAG)
- [x] Git hooks for auto-status updates
- [x] Task search and filtering
- [x] Progress reporting
- [x] Export task graph visualizations

### Phase 4: Build Search Aggregator (Days 7-8)

**File Structure**:
```
mcp-servers/search-aggregator/
├── package.json
├── src/
│   ├── index.ts              # Main coordinator
│   ├── providers/
│   │   ├── perplexity.ts
│   │   ├── brave.ts
│   │   ├── google.ts
│   │   └── duckduckgo.ts
│   ├── cache.ts              # Local caching
│   └── types.ts
└── tests/
```

**Key Features**:
- [x] Multi-provider fallback
- [x] Local caching (~/.mcp/cache/search)
- [x] Rate limiting per provider
- [x] Result synthesis
- [x] Provider health monitoring

## Configuration Files

### Roo Configuration
**File**: `~/Library/Application Support/Cursor/User/globalStorage/rooveterinaryinc.roo-cline/settings/mcp_settings.json`

```json
{
  "mcpServers": {
    "context-persistence": {
      "command": "python3",
      "args": ["-m", "mcp_servers.context_persistence"],
      "env": {
        "CONTEXT_DB": "/Users/ceverson/.mcp/context/db/conversation.db",
        "QDRANT_PATH": "/Users/ceverson/.mcp/context/qdrant"
      }
    },
    "task-orchestrator": {
      "command": "node",
      "args": ["/Users/ceverson/MCP_structure_design/mcp-servers/task-orchestrator/dist/index.js"],
      "env": {
        "TASKS_DB": "/Users/ceverson/.mcp/tasks/tasks.db"
      }
    },
    "search-aggregator": {
      "command": "node",
      "args": ["/Users/ceverson/MCP_structure_design/mcp-servers/search-aggregator/dist/index.js"],
      "env": {
        "PERPLEXITY_API_KEY": "${PERPLEXITY_API_KEY}",
        "BRAVE_API_KEY": "${BRAVE_API_KEY}",
        "CACHE_DIR": "/Users/ceverson/.mcp/cache/search"
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

### Cursor Configuration
**File**: `~/.cursor/mcp.json`

```json
{
  "mcpServers": {
    "context-persistence": {
      "command": "python3",
      "args": ["-m", "mcp_servers.context_persistence"]
    },
    "task-orchestrator": {
      "command": "node",
      "args": ["/Users/ceverson/MCP_structure_design/mcp-servers/task-orchestrator/dist/index.js"]
    },
    "search-aggregator": {
      "command": "node",
      "args": ["/Users/ceverson/MCP_structure_design/mcp-servers/search-aggregator/dist/index.js"]
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "${BRAVE_API_KEY}"
      }
    }
  }
}
```

## Data Privacy & Storage

### All Data Locations (Local)
```
/Users/ceverson/.mcp/
├── context/
│   ├── db/conversation.db       # SQLite conversation history
│   └── qdrant/                  # Vector embeddings (local)
├── tasks/
│   └── tasks.db                 # SQLite task database
├── cache/
│   ├── search/                  # Search results cache
│   └── code/                    # Code analysis cache
└── logs/
    ├── context-persistence.log
    ├── task-orchestrator.log
    └── search-aggregator.log
```

**No data leaves your computer unless you explicitly query external APIs (search providers).**

## Development Commands

### Build All Servers
```bash
# Context Persistence (Python)
cd mcp-servers/context-persistence
pip install -e .

# Task Orchestrator (TypeScript)
cd mcp-servers/task-orchestrator
npm install
npm run build

# Search Aggregator (TypeScript)
cd mcp-servers/search-aggregator
npm install
npm run build
```

### Test Locally
```bash
# Test Context Persistence
python3 -m mcp_servers.context_persistence

# Test Task Orchestrator
node mcp-servers/task-orchestrator/dist/index.js

# Test Search Aggregator
node mcp-servers/search-aggregator/dist/index.js
```

## Success Criteria

### Context Persistence
- [x] Save and retrieve conversations from local SQLite
- [x] Semantic search using local Qdrant
- [x] Context compression for long conversations
- [x] Sub-second retrieval for recent conversations

### Task Orchestrator
- [x] Create tasks with dependencies (local DB)
- [x] Git commit messages auto-update task status
- [x] Visualize task DAG
- [x] Search and filter tasks locally

### Search Aggregator
- [x] Query Perplexity/Brave/Google/DuckDuckGo
- [x] Automatic fallback on provider failure
- [x] Cache results locally for 24 hours
- [x] Sub-second cached queries

## Timeline

- **Days 1-2**: Foundation setup, install dependencies
- **Days 3-4**: Build Context Persistence with Qdrant
- **Days 5-6**: Build Task Orchestrator with git hooks
- **Days 7-8**: Build Search Aggregator coordinator
- **Day 9**: Integration testing
- **Day 10**: Documentation and deployment

## Next Immediate Actions

1. **Create directory structure** for local storage
2. **Start with Context Persistence** (highest value, clearest requirements)
3. **Install Qdrant client** for local vector search
4. **Build FastMCP server** with SQLite + Qdrant integration
5. **Test locally** before moving to other servers

Ready to start building?