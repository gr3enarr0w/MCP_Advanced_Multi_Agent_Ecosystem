# Enhancement Quick Reference

## At a Glance

| Category | Source | Action | New Tools |
|----------|--------|--------|-----------|
| Atlassian | `sooperset/mcp-atlassian` | Add as submodule | 51 (existing) |
| FastMCP | `jlowin/fastmcp` | Add as submodule | Framework |
| Chart Generator | Custom | Build new server | 6 |
| Agent-Swarm | Claude-Flow patterns | Enhance existing | 7 |
| Context-Persistence | Graphiti patterns | Enhance existing | 5 |
| Task-Orchestrator | Task-Master patterns | Enhance existing | 5 |
| Search-Aggregator | GPT-Researcher patterns | Enhance existing | 5 |
| Code Intelligence | Serena patterns | Enhance existing | 5 |
| NanoGPT Proxy | Custom | Build new service | 3 |

**Total New Tools:** ~37 (plus 51 from Atlassian)

---

## New Tools by Server

### Agent-Swarm (7 new tools)

| Tool | Purpose |
|------|---------|
| `swarm_session_create` | Create persistent multi-session orchestration |
| `swarm_session_resume` | Resume paused session from checkpoint |
| `swarm_session_checkpoint` | Save session state snapshot |
| `spawn_worker_agents` | Spawn parallel worker agents |
| `coordinate_parallel_tasks` | Coordinate tasks across workers |
| `memory_store_tiered` | Store in working/episodic/persistent memory |
| `memory_search_tiered` | Search across memory tiers |

### Context-Persistence (5 new tools)

| Tool | Purpose |
|------|---------|
| `extract_entities` | Extract people, projects, tools from conversation |
| `create_relationship` | Create knowledge graph relationship |
| `query_knowledge_graph` | Traverse entity relationships |
| `search_hybrid` | Semantic + keyword + graph search |
| `get_point_in_time_context` | Get entity state at specific time |

### Task-Orchestrator (5 new tools)

| Tool | Purpose |
|------|---------|
| `parse_prd` | Parse PRD document into tasks |
| `analyze_complexity` | Score task complexity (1-10) |
| `expand_task` | Auto-generate subtasks |
| `get_next_task` | AI-recommended next task |
| `get_project_complexity_report` | Project-wide complexity analysis |

### Search-Aggregator (5 new tools)

| Tool | Purpose |
|------|---------|
| `deep_research` | Multi-phase research with report |
| `generate_research_plan` | Generate research sub-questions |
| `search_local_documents` | Search PDF/MD/TXT files |
| `generate_report` | Generate formatted research report |
| `validate_sources` | Score source reliability |

### Code Intelligence (5 new tools)

| Tool | Purpose |
|------|---------|
| `find_symbol` | Find function/class definitions |
| `find_references` | Find all usages of symbol |
| `get_code_outline` | Get file symbol tree |
| `analyze_semantic_structure` | AST analysis summary |
| `insert_after_symbol` | Insert code at symbol location |

### Chart Generator (6 new tools)

| Tool | Purpose |
|------|---------|
| `create_bar_chart` | PNG bar chart |
| `create_line_chart` | PNG line chart |
| `create_pie_chart` | PNG pie/donut chart |
| `create_scatter_chart` | PNG scatter plot |
| `create_gantt_chart` | PNG Gantt timeline |
| `create_heatmap` | PNG heatmap |

### NanoGPT Proxy (3 new tools)

| Tool | Purpose |
|------|---------|
| `nanogpt_list_models` | List models with quota status |
| `nanogpt_get_usage` | Get usage statistics |
| `nanogpt_set_budget` | Set monthly budget limit |

---

## Key Features Summary

### From Claude-Flow
- **Session Management**: Persistent sessions with checkpoints
- **Swarm Topologies**: Hierarchical, mesh, star patterns
- **Tiered Memory**: Working (fast) → Episodic → Persistent
- **Worker Spawning**: Parallel agent execution

### From Graphiti
- **Bi-Temporal Model**: Track when things happened AND when stored
- **Entity Extraction**: Auto-detect people, projects, tools
- **Knowledge Graph**: Entity → Relationship → Entity triplets
- **Hybrid Search**: Semantic + BM25 keyword + Graph traversal

### From Task-Master
- **PRD Parsing**: Markdown/text → Task trees
- **Complexity Analysis**: 1-10 scoring with effort estimates
- **Task Expansion**: Auto-break into subtasks
- **Smart Scheduling**: AI-recommended next task

### From GPT-Researcher
- **Deep Research**: Multi-phase with sub-questions
- **Parallel Execution**: Concurrent searches
- **Source Aggregation**: 20+ sources per topic
- **Report Generation**: Structured markdown with citations

### From Serena (No Browser)
- **Tree-Sitter AST**: Python, TypeScript, Go, Rust
- **Symbol Navigation**: Find definitions, references
- **Semantic Editing**: Insert at symbol locations
- **Code Outline**: File structure tree

---

## Routing Keywords

```
Atlassian:   jira, confluence, ticket, issue, sprint, board, backlog
Charts:      chart, graph, plot, visualization, gantt, heatmap
Research:    research, deep research, investigate, analyze topic
Code Intel:  find symbol, references, outline, semantic
```

---

## Quick Commands

```bash
# Deep research with report
delegate "Deep research on Kubernetes security best practices" --depth 4

# Parse PRD
delegate "Parse PRD from ./docs/requirements.md and create tasks"

# Get next task
get_next_task --project myproject --max-complexity 6

# Create chart
create_gantt_chart --title "Sprint 1" --tasks '[...]' --theme presentation

# Check LLM budget
nanogpt_get_usage

# Search code semantically
find_symbol "processPayment" --language typescript

# Knowledge graph query
query_knowledge_graph --entity "user-auth-service" --depth 2
```

---

## Environment Variables

```bash
# Atlassian (required for Atlassian MCP)
ATLASSIAN_EMAIL=your-email@company.com
ATLASSIAN_API_TOKEN=your-token
ATLASSIAN_DOMAIN=your-domain.atlassian.net

# NanoGPT (required for proxy)
NANOGPT_API_KEY=your-nanogpt-key
NANOGPT_PROXY_PORT=8090
NANOGPT_MONTHLY_BUDGET=50.00
```

---

## Phase Priority

| Priority | Phase | Why |
|----------|-------|-----|
| 1 | Third-Party Additions | Quick wins, immediate value |
| 2 | Context-Persistence | Foundation for memory/knowledge |
| 3 | Task-Orchestrator | Core workflow improvement |
| 4 | Agent-Swarm | Builds on context layer |
| 5 | Search-Aggregator | Enhanced research capabilities |
| 6 | Code Intelligence | Developer productivity |
| 7 | NanoGPT Proxy | Cost optimization |
| 8 | Chart Generator | Nice-to-have visualizations |

---

## Files Created

```
docs/
├── ENHANCEMENT_PLAN.md          # Full implementation specs
├── IMPLEMENTATION_ROADMAP.md    # Phased timeline with dependencies
└── ENHANCEMENT_QUICK_REFERENCE.md  # This file

Future:
src/mcp-servers/
├── external/
│   ├── atlassian-mcp/          # Git submodule
│   └── fastmcp/                # Git submodule
├── chart-generator/            # New TypeScript server
└── [existing servers enhanced]

src/services/
└── nanogpt-proxy/              # New Go service
```
