# 🔧 MCP Advanced Multi-Agent Ecosystem - Complete Tool Reference

## 📋 All Available MCP Tools

### Total: **21+ Tools** Across **5 Servers**

---

## 🎯 Go Rewrite Servers (Primary - Production)

### 1. Task Orchestrator (5 Tools)

**Server**: `mcp-servers-go/dist/task-orchestrator` (Go)

| Tool | Description | Parameters | Returns |
|------|-------------|------------|---------|
| **`create_task`** | Create a new task with optional dependencies | `title`, `description`, `status`, `priority`, `dependencies[]`, `metadata` | Task object with ID |
| **`update_task_status`** | Update task status and progress | `task_id`, `status`, `progress`, `notes` | Updated task object |
| **`get_task`** | Get detailed information about a task | `task_id` | Complete task object with dependencies |
| **`list_tasks`** | List all tasks with optional filtering | `status`, `priority`, `agent_type`, `limit` | Array of task objects |
| **`execute_code`** | Execute code in sandbox (Python, JS, Bash, SQL) | `code`, `language`, `timeout`, `env_vars` | Execution result (output, errors, metrics) |

**Use Cases**:
- Project management and task tracking
- Dependency graph management
- Code execution and testing
- Git integration for commit tracking

---

### 2. Search Aggregator (3 Tools)

**Server**: `mcp-servers-go/dist/search-aggregator` (Go)

| Tool | Description | Parameters | Returns |
|------|-------------|------------|---------|
| **`search`** | Search with automatic provider fallback | `query`, `providers[]`, `limit`, `cache_ttl` | Aggregated search results |
| **`get_available_providers`** | List configured search providers | None | Array of provider configs |
| **`clear_search_cache`** | Clear old search cache entries | `max_age_days` | Number of entries cleared |

**Supported Providers**:
- Perplexity AI
- Brave Search
- Google Custom Search
- DuckDuckGo

**Use Cases**:
- Multi-provider search with fallback
- Cached search results
- Provider health monitoring

---

### 3. Skills Manager (4 Tools)

**Server**: `mcp-servers-go/dist/skills-manager` (Go)

| Tool | Description | Parameters | Returns |
|------|-------------|------------|---------|
| **`add_skill`** | Add a skill to your inventory | `skill_name`, `current_level`, `proficiency_score`, `notes` | Skill object with ID |
| **`list_skills`** | List your skills with filtering | `level`, `category`, `min_proficiency` | Array of skill objects |
| **`create_learning_goal`** | Create a new learning goal | `skill_name`, `target_level`, `priority`, `target_date` | Goal object with ID |
| **`analyze_skill_gaps`** | Analyze gaps for career/project goals | `target_role`, `required_skills[]` | Gap analysis report |

**Use Cases**:
- Skill inventory management
- Learning path planning
- Career development tracking
- Skill gap analysis

---

## 🐍 Python Server (ML Requirements - Production)

### 4. Context Persistence (5 Tools)

**Server**: `mcp-servers/context-persistence/` (Python)

| Tool | Description | Parameters | Returns |
|------|-------------|------------|---------|
| **`save_conversation`** | Save conversation with embeddings | `messages[]`, `metadata`, `compress` | Conversation ID |
| **`search_similar_conversations`** | Semantic search across history | `query`, `limit`, `threshold` | Similar conversations |
| **`load_conversation_history`** | Retrieve past conversations | `conversation_id`, `limit` | Conversation history |
| **`save_decision`** | Log important decisions | `decision`, `context`, `rationale` | Decision ID |
| **`get_conversation_stats`** | Get database statistics | None | Stats object |

**Features**:
- Qdrant vector database for semantic search
- Sentence-transformers for embeddings
- Automatic conversation compression
- Token counting and context management

**Use Cases**:
- Conversation history management
- Semantic search across conversations
- Decision logging and tracking
- Context retrieval for AI assistants

---

## 💾 Prompt Cache Server (4 Tools)

**Server**: `mcp-servers/prompt-cache-mcp/` (TypeScript)

**Status**: ✅ **WORKING** - Prompt caching and optimization

| Tool | Description | Parameters | Returns |
|------|-------------|------------|---------|
| **`lookup_prompt`** | Lookup cached prompt/response by fingerprint | `request_fingerprint`, `max_age`, `scope`, `model_hint`, `require_deterministic` | Cache hit/miss with entry |
| **`store_prompt_result`** | Store prompt result in cache | `request_fingerprint`, `model`, `result_payload`, `tools_used`, `scope`, `tags`, `ttl`, `deterministic` | Stored cache entry |
| **`invalidate_cache`** | Invalidate cached entries by selector | `selector` (all, by_model, by_tag, by_prefix, by_scope) | Success confirmation |
| **`stats_cache`** | Get prompt cache statistics | None | Cache stats and config |

**Features**:
- Fingerprint-based caching
- Multiple cache scopes (global, project, session, user)
- TTL support with automatic expiration
- Deterministic vs non-deterministic responses
- Tag-based invalidation
- Size and hit rate tracking

**Storage**: `~/.mcp/prompt-cache/cache.json`

**Use Cases**:
- Prompt/response caching for performance
- Avoid redundant LLM calls
- Cache management and invalidation
- Performance optimization

---

## 🐙 GitHub Integration (Optional)

### 5. GitHub OAuth (8+ Tools)

**Server**: `mcp-servers/github-oauth/` (TypeScript)

| Tool | Description | Parameters | Returns |
|------|-------------|------------|---------|
| **`create_issue`** | Create a new GitHub issue | `owner`, `repo`, `title`, `body`, `labels[]` | Issue object |
| **`add_issue_comment`** | Add comment to existing issue | `owner`, `repo`, `issue_number`, `body` | Comment object |
| **`list_issues`** | List repository issues | `owner`, `repo`, `state`, `labels[]`, `sort` | Array of issues |
| **`update_issue`** | Update issue properties | `owner`, `repo`, `issue_number`, `state`, `labels[]` | Updated issue |
| **`create_pull_request`** | Create new pull request | `owner`, `repo`, `title`, `head`, `base`, `body` | PR object |
| **`get_pull_request`** | Get PR details | `owner`, `repo`, `pull_number` | PR object with reviews |
| **`list_pull_requests`** | List repository PRs | `owner`, `repo`, `state`, `sort` | Array of PRs |
| **`merge_pull_request`** | Merge a pull request | `owner`, `repo`, `pull_number`, `merge_method` | Merge result |

**Setup Required**:
```bash
cd mcp-servers/github-oauth
# Add GITHUB_TOKEN to .env file
```

**Use Cases**:
- Automated issue creation
- PR management
- Project tracking
- Code review automation

---

## 📊 Complete Tool Inventory

### Summary by Server

| Server | Language | Tools | Status | Category |
|--------|----------|-------|--------|----------|
| **Task Orchestrator** | Go | 5 | ✅ Production | Project Management |
| **Search Aggregator** | Go | 3 | ✅ Production | Research |
| **Skills Manager** | Go | 4 | ✅ Production | Learning & Development |
| **Context Persistence** | Python | 5 | ✅ Production | Memory & Context |
| **Prompt Cache** | TypeScript | 4 | ✅ Production | Performance & Caching |
| **GitHub OAuth** | TypeScript | 8+ | ✅ Production | GitHub Integration |
| **TOTAL** | **Mixed** | **21+** | **✅ All Working** | **Complete Stack** |

---

## 🎯 Quick Reference

### Most Used Tools

**Task Management**:
- `create_task`, `update_task_status`, `list_tasks`

**Search & Research**:
- `search`, `get_available_providers`

**Skills & Learning**:
- `add_skill`, `create_learning_goal`, `analyze_skill_gaps`

**Context & Memory**:
- `save_conversation`, `search_similar_conversations`

**Performance**:
- `lookup_prompt`, `store_prompt_result`, `stats_cache`

**GitHub**:
- `create_issue`, `add_issue_comment`, `list_issues`

---

## ✅ All Tools: Implemented, Tested, Production-Ready

**Status**: **COMPLETE & OPERATIONAL**

All 21+ tools are fully functional and ready for use with your MCP client (Roo/Cursor).

**Note**: The Prompt Cache server was part of the original implementation and is fully functional. It provides prompt/response caching to optimize performance and reduce redundant LLM calls.