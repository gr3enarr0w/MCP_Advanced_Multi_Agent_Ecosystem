# Master Implementation Plan - Complete System

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [All Components List](#all-components-list)
3. [Implementation Phases](#implementation-phases)
4. [Detailed Specifications](#detailed-specifications)

---

## Architecture Overview

### The Complete System

```
User
  ↓
Roo Code (VS Code/PyCharm)
  • Role orchestrator
  • Workflow coordinator
  • Configured to use: http://localhost:8090/v1
  ↓
┌─────────────────────────────────────────────────────────┐
│  Go Proxy (Smart Gateway)                               │
│  Port 8090                                              │
│                                                         │
│  Components:                                            │
│  1. Prompt Engineer (Qwen3-30B/Gemini 3)               │
│  2. Model Router (monthly research)                    │
│  3. Context Manager (MCP client)                       │
│  4. Backend Router (NanoGPT/Vertex)                    │
└────────────┬────────────────────────────┬───────────────┘
             │                            │
             ▼                            ▼
    NanoGPT API              Vertex AI API
    (personal, 60k/mo)       (work, enterprise)
             │                            │
             └──────────┬─────────────────┘
                        │
                        ▼ Calls MCP tools as needed
┌─────────────────────────────────────────────────────────┐
│  MCP Server Ecosystem (Enhanced)                        │
│                                                         │
│  • agent-swarm (orchestration + routing)                │
│  • task-orchestrator (PRD, complexity, code exec)       │
│  • context-persistence (entities, knowledge graph)      │
│  • search-aggregator (deep research, reports)           │
│  • chart-generator (PNG charts)                         │
│  • skills-manager (existing)                            │
│  • atlassian-mcp (Jira/Confluence)                      │
│  • code-intelligence (tree-sitter, symbol nav)          │
└─────────────────────────────────────────────────────────┘
```

---

## All Components List

### New Components (Build from Scratch)

| # | Component | Type | Purpose | Priority |
|---|-----------|------|---------|----------|
| 1 | **NanoGPT/Vertex Proxy** | Go Service | OpenAI-compatible gateway with smart routing | Critical |
| 2 | **Prompt Engineer** | Go Module | Role-based prompt optimization | Critical |
| 3 | **Model Router** | Go Module | Select best model per role | Critical |
| 4 | **Monthly Research System** | Go Module | Auto-update benchmarks & strategies | High |
| 5 | **Chart Generator** | TypeScript MCP | PNG chart generation | Medium |
| 6 | **Code Intelligence** | TypeScript Module | Tree-sitter symbol navigation | Medium |

### Enhanced Components (Modify Existing)

| # | Component | Changes | Priority |
|---|-----------|---------|----------|
| 7 | **agent-swarm** | Add sessions, topologies, tiered memory | High |
| 8 | **context-persistence** | Add entities, knowledge graph, hybrid search | High |
| 9 | **task-orchestrator** | Add PRD parsing, complexity analysis, task expansion | High |
| 10 | **search-aggregator** | Add deep research, parallel execution, reports | Medium |

### Third-Party Components (Add as Submodules)

| # | Component | Source | Priority |
|---|-----------|--------|----------|
| 11 | **Atlassian MCP** | github.com/sooperset/mcp-atlassian | Low |
| 12 | **FastMCP** | github.com/jlowin/fastmcp | Low |

---

## Implementation Phases

### Phase 0: Foundation (Week 1)
**Goal:** Set up third-party components and project structure

- [ ] Add Atlassian MCP as git submodule
- [ ] Add FastMCP as git submodule
- [ ] Update agent-swarm routing for Atlassian
- [ ] Create Go proxy project structure

**Deliverables:**
- `src/mcp-servers/external/atlassian-mcp/`
- `src/mcp-servers/external/fastmcp/`
- `src/services/nanogpt-proxy/` (skeleton)

---

### Phase 1: Core Proxy Infrastructure (Week 2-3)
**Goal:** Basic OpenAI-compatible proxy with backend routing

**Components:**
1. Go HTTP server
2. OpenAI-compatible endpoints
3. Backend interface (NanoGPT, Vertex)
4. Basic model selection
5. Usage tracking (SQLite)

**Implementation:**

```
src/services/nanogpt-proxy/
├── main.go
├── go.mod
├── config/
│   └── config.go
├── handlers/
│   ├── chat.go
│   ├── models.go
│   └── embeddings.go
├── backends/
│   ├── backend.go          # Interface
│   ├── nanogpt.go          # NanoGPT implementation
│   └── vertex.go           # Vertex AI implementation
├── middleware/
│   ├── auth.go
│   └── profile_selector.go
└── storage/
    └── usage.go            # SQLite tracking
```

**Key Files:**

`backends/backend.go`:
```go
type Backend interface {
    ChatCompletion(ctx context.Context, req OpenAIChatRequest) (OpenAIChatResponse, error)
    ListModels(ctx context.Context) ([]Model, error)
    Name() string
    Tier() string
}
```

`handlers/chat.go`:
```go
func (h *ChatHandler) HandleChatCompletion(w http.ResponseWriter, r *http.Request) {
    var req OpenAIChatRequest
    json.NewDecoder(r.Body).Decode(&req)

    // Select backend (personal/work)
    backend := h.selectBackend(r)

    // Forward request
    resp, err := backend.ChatCompletion(r.Context(), req)

    // Track usage
    h.storage.RecordUsage(...)

    json.NewEncoder(w).Encode(resp)
}
```

**Deliverables:**
- Working proxy on port 8090
- NanoGPT backend (with quota tracking)
- Vertex AI backend
- Basic usage tracking
- Roo Code can connect

**Testing:**
```bash
# Test proxy
curl http://localhost:8090/v1/chat/completions \
  -H "Authorization: Bearer test-key" \
  -d '{"model":"auto","messages":[{"role":"user","content":"Hello"}]}'

# Should return OpenAI-compatible response
```

---

### Phase 2: Prompt Engineer (Week 4)
**Goal:** Add intelligent prompt rewriting per role

**Components:**
1. Prompt engineer module
2. Role-based strategies (YAML config)
3. Fast local model integration (Qwen3-30B or Gemini 3 Flash)
4. Prompt optimization pipeline

**Implementation:**

```
src/services/nanogpt-proxy/
├── promptengineer/
│   ├── engineer.go
│   ├── strategies.go
│   └── examples.go
└── config/
    └── prompt_strategies.yaml
```

`promptengineer/engineer.go`:
```go
type PromptEngineer struct {
    model      Backend  // Fast local model
    strategies *StrategyDB
}

func (pe *PromptEngineer) Optimize(userPrompt, role string) (OptimizedPrompt, error) {
    strategy := pe.strategies.GetStrategy(role)

    engineeringPrompt := pe.buildOptimizationPrompt(userPrompt, role, strategy)

    // Call fast model (< 1 second)
    response := pe.model.ChatCompletion(...)

    return OptimizedPrompt{
        Original:  userPrompt,
        Optimized: response.Content,
        Role:      role,
    }
}
```

`config/prompt_strategies.yaml`:
```yaml
strategies:
  architect:
    system_prompt: "You are a senior software architect..."
    techniques: ["step-by-step-reasoning", "pros-and-cons"]
    constraints:
      - "Consider scalability"
      - "Provide rationale"

  implementation:
    system_prompt: "You are an expert software engineer..."
    techniques: ["code-with-comments", "include-tests"]
    constraints:
      - "Write clean code"
      - "Include error handling"

  # ... all 7 roles
```

**API Changes:**

Request now includes role:
```json
{
  "messages": [...],
  "role": "architect",
  "conversation_id": "conv-123"
}
```

Response includes metadata:
```json
{
  "choices": [...],
  "x_proxy_metadata": {
    "original_prompt_length": 45,
    "optimized_prompt_length": 245,
    "prompt_engineer_time_ms": 850,
    "strategy_used": "architect-v1"
  }
}
```

**Deliverables:**
- Prompt engineer module
- 7 role strategies configured
- Integration with chat handler
- <1 second prompt optimization

---

### Phase 3: Model Router (Week 5)
**Goal:** Automatically select best model for each role

**Components:**
1. Model routing database
2. Role-to-model mapping
3. Cost optimization logic
4. Fallback handling

**Implementation:**

```
src/services/nanogpt-proxy/
├── routing/
│   ├── router.go
│   ├── rankings.go
│   └── cost_optimizer.go
└── data/
    └── model_routing.json
```

`routing/router.go`:
```go
type ModelRouter struct {
    rankings *ModelRankings
    backends map[string]Backend
}

func (mr *ModelRouter) SelectForRole(role, profile string) (Model, string) {
    // Get role preferences
    rolePrefs := mr.rankings.GetRole(role)

    // Check if primary model available in backend
    backend := mr.backends[profile]
    if backend.HasModel(rolePrefs.Primary.Model) {
        return rolePrefs.Primary, rolePrefs.Primary.Reason
    }

    // Try fallbacks
    for _, fallback := range rolePrefs.Fallback {
        if backend.HasModel(fallback) {
            return Model{ID: fallback}, "fallback"
        }
    }

    // Use subscription alternative
    return Model{ID: rolePrefs.SubscriptionAlternative}, "subscription"
}
```

`data/model_routing.json`:
```json
{
  "updated": "2025-01-01T00:00:00Z",
  "roles": {
    "architect": {
      "primary": {
        "model": "claude-3.5-sonnet",
        "reason": "Top reasoning (91.9% GPQA)",
        "benchmarks": {"reasoning": 91.9}
      },
      "fallback": ["gemini-2.5-pro", "gpt-4o"],
      "subscription_alternative": "qwen-2.5-72b"
    }
    // ... all 7 roles
  }
}
```

**Deliverables:**
- Model routing logic
- Initial model rankings (from research)
- Integration with chat handler
- Transparent fallback

---

### Phase 4: Context Manager (Week 6)
**Goal:** Add conversation history and state to every request

**Components:**
1. MCP client bridge
2. Context enrichment logic
3. Conversation state management
4. Similar conversation search

**Implementation:**

```
src/services/nanogpt-proxy/
├── context/
│   ├── manager.go
│   └── mcp_client.go
└── mcp/
    └── bridge.go
```

`context/manager.go`:
```go
type ContextManager struct {
    mcpClient *MCPClient
}

func (cm *ContextManager) EnrichRequest(
    optimizedPrompt string,
    role string,
    conversationID string,
) ([]ChatMessage, error) {
    messages := []ChatMessage{}

    // Load conversation history
    history := cm.mcpClient.CallTool("context-persistence", "load_conversation_history", map[string]interface{}{
        "conversation_id": conversationID,
        "limit": 10,
    })

    // Add history
    for _, msg := range history {
        messages = append(messages, msg)
    }

    // Search for similar conversations
    similar := cm.mcpClient.CallTool("context-persistence", "search_similar_conversations", map[string]interface{}{
        "query": optimizedPrompt,
        "limit": 3,
    })

    // Add similar as context
    if len(similar) > 0 {
        messages = append(messages, ChatMessage{
            Role: "system",
            Content: fmt.Sprintf("Similar past interactions: %v", similar),
        })
    }

    // Add optimized prompt
    messages = append(messages, ChatMessage{
        Role: "user",
        Content: optimizedPrompt,
    })

    return messages, nil
}
```

**MCP Client Implementation:**

The proxy needs to act as an MCP CLIENT to connect to existing MCP servers:

```go
// mcp/bridge.go

type MCPClient struct {
    serverName string
    transport  Transport  // stdio or SSE
    process    *exec.Cmd
}

func (mc *MCPClient) Connect(serverPath string) error {
    // Start MCP server process
    mc.process = exec.Command(serverPath)

    // Set up stdio communication
    stdin, _ := mc.process.StdinPipe()
    stdout, _ := mc.process.StdoutPipe()

    mc.process.Start()

    // MCP handshake
    // ...

    return nil
}

func (mc *MCPClient) CallTool(toolName string, params map[string]interface{}) (interface{}, error) {
    // Send MCP tool request
    request := MCPRequest{
        Method: "tools/call",
        Params: MCPToolCallParams{
            Name: toolName,
            Arguments: params,
        },
    }

    // ... MCP protocol communication

    return response, nil
}
```

**Deliverables:**
- MCP client library (Go)
- Context manager integrated
- Connection to context-persistence MCP
- History injection working

---

### Phase 5: Monthly Research System (Week 7)
**Goal:** Automated benchmark updates and strategy refresh

**Components:**
1. Benchmark scraper
2. Model evaluator
3. Strategy updater
4. Scheduled job

**Implementation:**

```
src/services/nanogpt-proxy/
├── research/
│   ├── researcher.go
│   ├── scraper.go
│   ├── evaluator.go
│   └── scheduler.go
└── config/
    └── research_schedule.yaml
```

`research/researcher.go`:
```go
type ResearchSystem struct {
    scraper   *BenchmarkScraper
    evaluator *ModelEvaluator
    storage   *ResearchDB
}

func (rs *ResearchSystem) RunMonthlyResearch() error {
    // 1. Scrape latest benchmarks
    benchmarks := rs.scraper.FetchFromSources([]string{
        "https://www.vellum.ai/llm-leaderboard",
        "https://huggingface.co/spaces/open-llm-leaderboard",
    })

    // 2. Evaluate models per role
    rankings := map[string][]ModelRanking{}
    for _, role := range []string{"architect", "implementation", /*...*/} {
        rankings[role] = rs.evaluator.EvaluateForRole(benchmarks, role)
    }

    // 3. Update routing database
    rs.storage.UpdateModelRoutingTable(rankings)

    // 4. Update prompt strategies (scrape latest research)
    strategies := rs.scraper.FetchPromptStrategies()
    rs.storage.UpdatePromptStrategies(strategies)

    log.Println("✓ Monthly research complete")
    return nil
}
```

`research/scheduler.go`:
```go
func (rs *ResearchSystem) StartScheduler() {
    // Run on 1st of each month at 2 AM
    c := cron.New()
    c.AddFunc("0 2 1 * *", func() {
        rs.RunMonthlyResearch()
    })
    c.Start()
}
```

**Deliverables:**
- Automated benchmark scraping
- Model evaluation per role
- Scheduled monthly updates
- Manual trigger API: `POST /admin/trigger-research`

---

### Phase 6: Context-Persistence Enhancements (Week 8-9)
**Goal:** Add entities, knowledge graph, hybrid search

See `ENHANCEMENT_PLAN.md` Part 4 for full details.

**Key Additions:**
- Bi-temporal schema (event_time, ingestion_time)
- Entity extraction from conversations
- Knowledge graph (entity → relationship → entity)
- Hybrid search (semantic + keyword + graph)

**New Tables:**
```sql
CREATE TABLE entities (
    id TEXT PRIMARY KEY,
    name TEXT,
    type TEXT,  -- person, project, tool, concept
    event_time DATETIME,
    valid_from DATETIME,
    valid_until DATETIME
);

CREATE TABLE relationships (
    id TEXT PRIMARY KEY,
    source_entity_id TEXT,
    target_entity_id TEXT,
    relationship_type TEXT,  -- works_on, uses, knows
    valid_from DATETIME,
    valid_until DATETIME
);
```

**New Tools:**
- `extract_entities(conversation_id)`
- `create_relationship(source, type, target)`
- `query_knowledge_graph(entity, depth)`
- `search_hybrid(query, mode)`

---

### Phase 7: Task-Orchestrator Enhancements (Week 10)
**Goal:** PRD parsing, complexity analysis, task expansion

See `ENHANCEMENT_PLAN.md` Part 5 for full details.

**Key Additions:**
- PRD parser (markdown → task tree)
- Complexity analyzer (1-10 scoring)
- Task expander (auto-generate subtasks)
- Smart next task selector

**New Tools:**
- `parse_prd(content, project_id)`
- `analyze_complexity(task_id)`
- `expand_task(task_id, depth)`
- `get_next_task(project_id, max_complexity)`

---

### Phase 8: Search-Aggregator Enhancements (Week 11)
**Goal:** Deep multi-phase research with reports

See `ENHANCEMENT_PLAN.md` Part 6 for full details.

**Key Additions:**
- Research planner (generate sub-questions)
- Parallel executor (concurrent searches)
- Local document search (PDF, Markdown)
- Report synthesizer (markdown generation)

**New Tools:**
- `deep_research(topic, depth, breadth)`
- `generate_research_plan(topic)`
- `search_local_documents(query, paths)`
- `generate_report(research_id, format)`

---

### Phase 9: Agent-Swarm Enhancements (Week 12)
**Goal:** Sessions, topologies, tiered memory

See `ENHANCEMENT_PLAN.md` Part 3 for full details.

**Key Additions:**
- Session management (create, resume, checkpoint)
- Swarm topologies (hierarchical, mesh, star)
- Tiered memory (working → episodic → persistent)
- Worker spawning

**New Tools:**
- `swarm_session_create(project_id, topology)`
- `swarm_session_resume(session_id)`
- `spawn_worker_agents(count, type)`
- `memory_store_tiered(key, value, tier)`

---

### Phase 10: Code Intelligence (Week 13)
**Goal:** Tree-sitter symbol navigation

See `ENHANCEMENT_PLAN.md` Part 7 for full details.

**Key Additions:**
- Tree-sitter AST parsing
- Symbol finder (Python, TypeScript, Go, Rust)
- Reference finder
- Semantic code outline

**New Tools:**
- `find_symbol(name, language, scope)`
- `find_references(symbol_path)`
- `get_code_outline(file_path)`
- `analyze_semantic_structure(file_path)`

---

### Phase 11: Chart Generator (Week 14)
**Goal:** PNG chart generation for presentations

See `ENHANCEMENT_PLAN.md` Part 2 for full details.

**Key Additions:**
- New TypeScript MCP server
- Chart.js + node-canvas renderer
- PNG output
- Themes (light, dark, presentation)

**New Tools:**
- `create_bar_chart(...)`
- `create_line_chart(...)`
- `create_pie_chart(...)`
- `create_gantt_chart(...)`

---

## Critical Path (Must-Have for Launch)

### Minimum Viable System (4 weeks)

1. **Week 1**: Go Proxy + NanoGPT/Vertex backends
2. **Week 2**: Prompt Engineer (role-based)
3. **Week 3**: Model Router (role → model mapping)
4. **Week 4**: Context Manager (MCP client)

**At this point:** Roo Code can use the smart proxy for intelligent LLM routing.

### Phase 2 (8 more weeks)

- Context-Persistence enhancements
- Task-Orchestrator enhancements
- Search-Aggregator enhancements
- Agent-Swarm enhancements

### Phase 3 (2 more weeks)

- Code Intelligence
- Chart Generator

---

## File Structure (Complete)

```
MCP_Advanced_Multi_Agent_Ecosystem/
├── src/
│   ├── services/
│   │   └── nanogpt-proxy/              # NEW Go Service
│   │       ├── main.go
│   │       ├── go.mod
│   │       ├── config/
│   │       │   ├── config.go
│   │       │   ├── models.yaml
│   │       │   └── prompt_strategies.yaml
│   │       ├── handlers/
│   │       │   ├── chat.go
│   │       │   ├── models.go
│   │       │   └── embeddings.go
│   │       ├── backends/
│   │       │   ├── backend.go
│   │       │   ├── nanogpt.go
│   │       │   └── vertex.go
│   │       ├── promptengineer/
│   │       │   ├── engineer.go
│   │       │   └── strategies.go
│   │       ├── routing/
│   │       │   ├── router.go
│   │       │   └── rankings.go
│   │       ├── context/
│   │       │   ├── manager.go
│   │       │   └── mcp_client.go
│   │       ├── research/
│   │       │   ├── researcher.go
│   │       │   ├── scraper.go
│   │       │   └── scheduler.go
│   │       ├── mcp/
│   │       │   └── bridge.go
│   │       ├── storage/
│   │       │   └── usage.go
│   │       └── data/
│   │           └── model_routing.json
│   │
│   └── mcp-servers/
│       ├── agent-swarm/                # ENHANCED
│       ├── task-orchestrator/          # ENHANCED
│       ├── context-persistence/        # ENHANCED
│       ├── search-aggregator/          # ENHANCED
│       ├── skills-manager/             # UNCHANGED
│       ├── chart-generator/            # NEW TypeScript MCP
│       └── external/
│           ├── atlassian-mcp/          # NEW submodule
│           └── fastmcp/                # NEW submodule
│
├── configs/
│   └── nanogpt/
│       ├── models.yaml
│       └── prompt_strategies.yaml
│
└── docs/
    ├── MASTER_IMPLEMENTATION_PLAN.md   # This file
    ├── ENHANCEMENT_PLAN.md             # Detailed specs
    ├── IMPLEMENTATION_ROADMAP.md       # Timeline
    ├── FINAL_HYBRID_ARCHITECTURE.md    # Architecture
    └── NANOGPT_DYNAMIC_CONFIG.md       # Model discovery
```

---

## Dependencies

### Go Packages
```bash
go get github.com/gorilla/mux
go get github.com/mattn/go-sqlite3
go get gopkg.in/yaml.v3
go get github.com/robfig/cron/v3
```

### NPM Packages (for MCP servers)
```bash
npm install tree-sitter tree-sitter-python tree-sitter-typescript
npm install chart.js chartjs-node-canvas canvas
```

### Python Packages (for context-persistence)
```bash
pip install rank-bm25
```

---

## Testing Checklist

### Phase 1: Core Proxy
- [ ] Proxy starts on port 8090
- [ ] NanoGPT backend works
- [ ] Vertex backend works
- [ ] Usage tracking records requests
- [ ] Roo Code can connect

### Phase 2: Prompt Engineer
- [ ] Prompt optimization < 1 second
- [ ] All 7 roles have strategies
- [ ] Optimized prompts are better than originals
- [ ] Metadata returned in response

### Phase 3: Model Router
- [ ] Correct model selected per role
- [ ] Fallback works when primary unavailable
- [ ] Cost optimization considered
- [ ] Subscription alternatives work

### Phase 4: Context Manager
- [ ] MCP client connects to context-persistence
- [ ] Conversation history added
- [ ] Similar conversations found
- [ ] Context injection works

### Phase 5: Monthly Research
- [ ] Benchmarks scraped successfully
- [ ] Model rankings updated
- [ ] Scheduled job runs
- [ ] Manual trigger works

### Phases 6-11: MCP Enhancements
- [ ] All new tools accessible
- [ ] Integration tests pass
- [ ] Performance acceptable
- [ ] Documentation complete

---

## Success Metrics

### Phase 1 (Core Proxy)
- Response time < 5s for simple requests
- 99% uptime
- Usage tracking accurate

### Phase 2 (Prompt Engineer)
- Optimization time < 1s
- Improved response quality (subjective)

### Phase 3 (Model Router)
- Correct model selection 95%+ of time
- Cost reduction vs. always-paid

### Phase 4 (Context Manager)
- Context relevance improves responses
- History injection working

### Overall System
- Roo Code workflow unchanged (transparent)
- Better responses per role
- Cost optimized (free tier prioritized)
- Automated improvements (monthly research)

---

## Quick Start (After Implementation)

### Start the System

```bash
# 1. Start MCP servers
cd src/mcp-servers/agent-swarm && npm start
cd src/mcp-servers/task-orchestrator && npm start
# ... etc

# 2. Start Go proxy
cd src/services/nanogpt-proxy
export NANOGPT_API_KEY=7ed377e9-3d0c-4beb-8d38-96c98c93ee89
export ACTIVE_PROFILE=personal
go run main.go

# 3. Configure Roo Code
# In Roo Code settings:
# API Base URL: http://localhost:8090/v1
# API Key: your-proxy-key
# Model: auto
```

### Test the Flow

```bash
# In Roo Code, ask:
"Design an authentication system for my SaaS app"

# Behind the scenes:
# 1. Roo decides: role = "architect"
# 2. Sends to proxy with role
# 3. Proxy:
#    - Prompt engineer rewrites (Qwen3-30B, 850ms)
#    - Model router selects claude-3.5-sonnet
#    - Context manager adds history
#    - Calls NanoGPT → claude-3.5-sonnet
#    - Returns response
# 4. Roo receives optimized response
# 5. User sees result
```

---

## Summary

This plan includes **EVERYTHING**:
- ✅ Go Proxy (smart gateway)
- ✅ Prompt Engineer (role-based optimization)
- ✅ Model Router (auto-select best model)
- ✅ Context Manager (conversation history)
- ✅ Monthly Research (automated updates)
- ✅ All MCP server enhancements
- ✅ Third-party MCPs
- ✅ Chart Generator
- ✅ Code Intelligence

**Nothing will be missed.**
