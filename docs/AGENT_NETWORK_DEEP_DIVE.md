# Agent Network Deep Dive

## Purpose & Scope
This repository bundles a local-first, multi-agent MCP ecosystem so Roo Code (and other MCP clients like Cursor, Claude Code, Codex) can drive complex workflows without cloud dependencies. The `MCP_structure_design/MCP_Advanced_Multi_Agent_Ecosystem/README.md` catalogues 6+ MCP servers, 55+ tools, and the advanced orchestration layers that keep specialists (architect, code, testing, research) coordinated while respecting clear module boundaries.

> NOTE: Operational servers for task-orchestrator, search-aggregator, and skills-manager now live in `MCP_structure_design/mcp-servers-go/dist`. Paths below pointing to `src/mcp-servers/*` describe the legacy TypeScript implementations kept for reference.

## Agent Network Components
- **Context Persistence Server** (`src/mcp-servers/context-persistence`): Python-based, stores conversations in SQLite, embeddings in Qdrant, and exposes helper tools (`save_conversation`, `search_similar_conversations`, etc.) trusted by every agent that needs memory.
- **Task Orchestrator Server** (`src/mcp-servers/task-orchestrator`): TypeScript/Node server with sql.js-backed SQLite, dependency graphs (graphology), Git commit linking, and tools such as `create_task` / `get_task_graph` that coordinate what each Roo action should run.
- **Search Aggregator Server** (`src/mcp-servers/search-aggregator`): Federates Perplexity, Brave, Google, DuckDuckGo, handles provider fallback, rate limiting, and caches results under `~/.mcp/cache/search/`.
- **Agent Swarm & Advanced Frameworks** (`src/mcp-servers/agent-swarm` and `advanced-multi-agent-framework`): Orchestrates specialized agent modes, skills management, and learning loops that Roo uses for deep horizon planning. The swarm now exposes `route_plan` and `delegate` tools that act as a front door: Roo calls `delegate` with a goal, and the swarm routes to `search-aggregator` (search), `task-orchestrator` (task creation) `context7` (latest docs) via the MCP stdio client. This keeps the swarm as the single entry point while delegating to the right downstream MCP.
- **Supporting Servers**: `skills-manager`, `github-oauth`, and other MCP nodes provide metadata, authentication, and Git tooling that Roo expects out of the box.

## Runtime Surface & Roo Hooks
All servers write to `~/.mcp/` (context/db, tasks/db, cache, logs) so Roo Code observes the same state across actions. Roo’s MCP config (`~/Library/Application Support/Cursor/User/globalStorage/rooveterinaryinc.roo-cline/settings/mcp_settings.json`) points at the Python entry (`python3 -m context_persistence.server`) and built `dist/index.js` artifacts for TypeScript services; env vars like `CONTEXT_DB`, `QDRANT_PATH`, and `TASKS_DB` keep data paths deterministic. The `MCP_structure_design/BUILD_AND_INSTALL.md` guide shows these commands and the local directory structure in detail.

## Automation & Diagnostics
Scripts such as `./scripts/setup.sh`, `./scripts/install-mcp-servers.sh`, `./scripts/configure-tools.sh`, and `./scripts/test-installation.sh` encapsulate tooling installation, Roo/Cursor configuration, and verification flows. Running the full installer ensures every Roo action can access the agent network automatically, and `docs/SYSTEM_READY_SUMMARY.md` documents the ready-to-test state (bug fixes, storage layout, next steps) developers should match before opening issues or PRs.
