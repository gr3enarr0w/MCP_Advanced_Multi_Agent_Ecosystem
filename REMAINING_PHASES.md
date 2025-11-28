# Remaining Phases (6-11) - What's Left to Implement

**Current Status**: Phases 1-5 ✅ Complete | Phases 6-11 ⏳ Not Started

---

## Phase 6: Context-Persistence Enhancements

**Location**: `src/mcp-servers/context-persistence/`
**Status**: 🟡 Partially started (models created)

### What's Left:

#### ✅ Already Created:
- `models_enhanced.py` - Bi-temporal schema models (Entity, Relationship, EntityMention, TopicCluster, SearchIndex)

#### ⏳ To Implement:

1. **Entity Extractor** (`entity_extractor.py`)
   - Extract entities from conversations using NLP
   - Named Entity Recognition (people, projects, tools, code)
   - Confidence scoring
   - Link entities to messages

2. **Knowledge Graph** (`knowledge_graph.py`)
   - Graph traversal algorithms
   - Path finding between entities
   - Entity context retrieval
   - Graph visualization (Mermaid format)

3. **Hybrid Search** (`hybrid_search.py`)
   - Semantic search (Qdrant vectors)
   - Keyword search (SQLite FTS)
   - Graph search (entity relationships)
   - Result ranking and fusion

4. **New MCP Tools**:
   - `extract_entities(conversation_id)`
   - `create_relationship(source, target, type)`
   - `query_knowledge_graph(entity_id, depth)`
   - `search_hybrid(query, mode, filters)`
   - `get_entity_history(entity_id)`

**Dependencies**: `spacy`, `en_core_web_sm`

---

## Phase 7: Task-Orchestrator Enhancements

**Location**: `src/mcp-servers/task-orchestrator/src/`
**Status**: ⏳ Not started

### What's Left:

1. **PRD Parser** (`prd-parser.ts`)
   - Parse markdown PRDs into task trees
   - Extract features, requirements, acceptance criteria
   - Auto-create hierarchical tasks
   - Detect dependencies from text

2. **Complexity Analyzer** (`complexity-analyzer.ts`)
   - Score tasks 1-10 based on:
     - Code volume estimates
     - File dependencies
     - Technical risk
     - Historical data
   - Effort estimation in hours

3. **Task Expander** (`task-expander.ts`)
   - Auto-generate subtasks using LLM
   - Suggest implementation steps
   - Create test task automatically

4. **Smart Task Selector** (`task-selector.ts`)
   - Find next optimal task based on:
     - Dependencies (unblocked)
     - Complexity constraints
     - Priority
     - Flow optimization

5. **New MCP Tools**:
   - `parse_prd(content, project_id)`
   - `analyze_complexity(task_id)`
   - `expand_task(task_id, depth)`
   - `get_next_task(project_id, max_complexity)`
   - `estimate_effort(task_id)`

---

## Phase 8: Search-Aggregator Enhancements

**Location**: `src/mcp-servers/search-aggregator/src/`
**Status**: ⏳ Not started

### What's Left:

1. **Research Planner** (`research-planner.ts`)
   - Decompose topics into sub-questions
   - Plan search strategies
   - Estimate breadth/depth

2. **Parallel Executor** (`parallel-executor.ts`)
   - Execute concurrent searches
   - Rate limiting per provider
   - Retry logic
   - Result deduplication

3. **Local Document Search** (`local-search.ts`)
   - Index PDF files
   - Index Markdown files
   - Index code files
   - Full-text search

4. **Report Synthesizer** (`report-synthesizer.ts`)
   - Generate markdown reports
   - Executive summary
   - Source citations
   - Comparison tables

5. **New MCP Tools**:
   - `deep_research(topic, depth, breadth)`
   - `generate_research_plan(topic)`
   - `search_local_documents(query, paths)`
   - `generate_report(research_id, format)`
   - `create_comparison(topic, items)`

**Dependencies**: `pdf-parse`, `mammoth`

---

## Phase 9: Agent-Swarm Enhancements

**Location**: `src/mcp-servers/agent-swarm/src/`
**Status**: ⏳ Not started

### What's Left:

1. **Session Management** (`sessions/session-manager.ts`)
   - Create swarm sessions
   - Resume from checkpoints
   - Save/restore state
   - Session lifecycle

2. **Swarm Topologies** (`topologies/`)
   - Hierarchical: architect → leads → workers
   - Mesh: peer-to-peer
   - Star: central coordinator
   - Dynamic topology switching

3. **Tiered Memory** (`memory/tiered-memory.ts`)
   - Working memory (current context)
   - Episodic memory (recent history)
   - Persistent memory (long-term storage)
   - Auto-promotion/demotion

4. **Worker Spawning** (`workers/worker-spawner.ts`)
   - Spawn parallel agents
   - Load balancing
   - Worker pooling
   - Task distribution

5. **New MCP Tools**:
   - `swarm_session_create(project_id, topology)`
   - `swarm_session_resume(session_id)`
   - `swarm_checkpoint(session_id)`
   - `spawn_worker_agents(count, type)`
   - `memory_store_tiered(key, value, tier)`
   - `memory_retrieve(key)`

---

## Phase 10: Code Intelligence

**Location**: `src/mcp-servers/code-intelligence/` (NEW SERVER)
**Status**: ⏳ Not started

### What's Left:

1. **Create MCP Server Structure**
   ```
   src/mcp-servers/code-intelligence/
   ├── package.json
   ├── tsconfig.json
   ├── src/
   │   ├── index.ts
   │   ├── parser.ts
   │   ├── symbol-finder.ts
   │   ├── reference-finder.ts
   │   └── outline-generator.ts
   ```

2. **Tree-Sitter Parser** (`parser.ts`)
   - Initialize parsers for Python, TypeScript, Go, Rust
   - Parse files to AST
   - Language detection

3. **Symbol Finder** (`symbol-finder.ts`)
   - Find function/class/variable definitions
   - Search across files
   - Return locations with context

4. **Reference Finder** (`reference-finder.ts`)
   - Find all references to symbol
   - Build call hierarchy
   - Track usage

5. **Outline Generator** (`outline-generator.ts`)
   - Generate code structure outline
   - Extract classes, functions, imports
   - Complexity metrics

6. **New MCP Tools**:
   - `find_symbol(name, language, scope)`
   - `find_definition(symbol, file, line)`
   - `find_references(symbol_path)`
   - `get_code_outline(file_path)`
   - `analyze_semantic_structure(file_path)`
   - `get_call_hierarchy(function_name)`

**Dependencies**:
```json
{
  "tree-sitter": "^0.20.0",
  "tree-sitter-python": "^0.20.0",
  "tree-sitter-typescript": "^0.20.0",
  "tree-sitter-go": "^0.19.0",
  "tree-sitter-rust": "^0.20.0"
}
```

---

## Phase 11: Chart Generator + Comprehensive Tests

**Location**: `src/mcp-servers/chart-generator/` (NEW SERVER)
**Status**: ⏳ Not started

### What's Left:

#### Part A: Chart Generator

1. **Create MCP Server Structure**
   ```
   src/mcp-servers/chart-generator/
   ├── package.json
   ├── tsconfig.json
   ├── src/
   │   ├── index.ts
   │   ├── chart-renderer.ts
   │   ├── chart-types.ts
   │   └── themes.ts
   ```

2. **Chart Renderer** (`chart-renderer.ts`)
   - Chart.js integration
   - Canvas rendering
   - PNG export
   - Theme support (light, dark, presentation)

3. **Chart Types**:
   - Bar charts
   - Line charts
   - Pie charts
   - Gantt charts
   - Custom charts

4. **New MCP Tools**:
   - `create_bar_chart(data, options)`
   - `create_line_chart(data, options)`
   - `create_pie_chart(data, options)`
   - `create_gantt_chart(tasks, timeline)`
   - `apply_theme(chart_id, theme_name)`

**Dependencies**:
```json
{
  "chart.js": "^4.4.0",
  "chartjs-node-canvas": "^4.1.6",
  "canvas": "^2.11.2"
}
```

#### Part B: Comprehensive Testing Suite

1. **Unit Tests** (each phase)
   ```
   __tests__/
   ├── phase6/
   │   ├── entity-extraction.test.py
   │   ├── knowledge-graph.test.py
   │   └── hybrid-search.test.py
   ├── phase7/
   │   ├── prd-parser.test.ts
   │   ├── complexity-analyzer.test.ts
   │   └── task-expander.test.ts
   ├── phase8/
   │   ├── research-planner.test.ts
   │   └── report-synthesizer.test.ts
   ├── phase9/
   │   ├── session-manager.test.ts
   │   └── tiered-memory.test.ts
   ├── phase10/
   │   ├── symbol-finder.test.ts
   │   └── code-outline.test.ts
   └── phase11/
       └── chart-renderer.test.ts
   ```

2. **Integration Tests**
   - MCP communication tests
   - Proxy-to-MCP tests
   - Cross-phase workflows

3. **Performance Tests**
   - Search benchmarks
   - Graph traversal benchmarks
   - Parallel execution tests

4. **End-to-End Tests**
   - Complete research workflow
   - Project management workflow
   - Code analysis workflow

5. **Test Coverage Goals**
   - Unit: >90%
   - Integration: All MCP tools
   - E2E: Major user workflows

---

## Summary Statistics

### Total Remaining Work

| Phase | Files to Create | New MCP Tools | Estimated Time |
|-------|----------------|---------------|----------------|
| **Phase 6** | 3 Python files | 5 tools | 1-2 weeks |
| **Phase 7** | 4 TypeScript files | 5 tools | 1-2 weeks |
| **Phase 8** | 4 TypeScript files | 5 tools | 1-2 weeks |
| **Phase 9** | 4 TypeScript files | 6 tools | 2 weeks |
| **Phase 10** | 5 TypeScript files (NEW SERVER) | 6 tools | 1 week |
| **Phase 11** | 4 TypeScript files (NEW SERVER) + Tests | 5 tools | 2-3 weeks |
| **TOTAL** | **24 files + tests** | **32 tools** | **8-12 weeks** |

### By Language

- **Python files**: 3 (Phase 6 only)
- **TypeScript files**: 21 (Phases 7-11)
- **Test files**: ~30 test suites
- **New MCP servers**: 2 (code-intelligence, chart-generator)

### Dependencies to Install

**Python**:
- `spacy`
- `en_core_web_sm` (spaCy model)

**TypeScript/Node**:
- `tree-sitter` + language parsers (4 languages)
- `chart.js`, `chartjs-node-canvas`, `canvas`
- `pdf-parse`, `mammoth`

---

## Implementation Priority

### Recommended Order:

1. **Phase 10** (Code Intelligence) - Independent, immediately useful
2. **Phase 6** (Context-Persistence) - Foundation for others
3. **Phase 7** (Task-Orchestrator) - Builds on Phase 6
4. **Phase 8** (Search-Aggregator) - Builds on Phase 6
5. **Phase 9** (Agent-Swarm) - Integrates everything
6. **Phase 11** (Charts + Tests) - Final additions

### Can Be Done in Parallel:
- Phase 6 + Phase 10 (different languages/servers)
- Phase 7 + Phase 11 chart generator
- Tests alongside each phase

---

## Current Progress

✅ **Complete (Phases 1-5)**:
- NanoGPT Proxy (all 5 phases)
- OpenAI-compatible API
- Prompt Engineer
- Model Router
- Context Manager
- Monthly Research System

🟡 **Partially Complete (Phase 6)**:
- Bi-temporal schema models created
- Needs: extraction, graph, search implementations

⏳ **Not Started (Phases 7-11)**:
- All task-orchestrator enhancements
- All search-aggregator enhancements
- All agent-swarm enhancements
- Entire code-intelligence MCP server
- Entire chart-generator MCP server
- Comprehensive test suite

---

## Next Steps

**To complete all phases:**
1. Finish Phase 6 implementations (3 files)
2. Create code-intelligence MCP server
3. Implement Phases 7-9 enhancements
4. Create chart-generator MCP server
5. Write comprehensive test suite

**Estimated total effort**: 8-12 weeks full-time development
