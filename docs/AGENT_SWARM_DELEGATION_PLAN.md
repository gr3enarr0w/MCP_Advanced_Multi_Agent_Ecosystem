# Agent Swarm Delegation & External MCP Integration Plan

This note captures new delegation behavior in `agent-swarm` and roadmap to wire in Context7 for always-fresh documentation.

## Current State (post-fixes)
- `agent-swarm` exposes `route_plan` (shows which MCP it will use) and `delegate` (routes execution). Routing is simple: search-like goals → `search-aggregator.search`; everything else → `task-orchestrator.create_task`.
- Delegation uses an MCP stdio client wrapper (`src/mcp-servers/agent-swarm/src/integration/mcp-client.ts`) and existing built `dist` artifacts for downstream servers.
- Context-persistence now accepts generated UUID embeddings, so `save_conversation` no longer fails Qdrant UUID validation.
- Search-aggregator defaults to OpenRouter Perplexity with proper headers and returns a graceful offline fallback instead of failing when providers are unavailable.

### Operational expectations
- Roo (or any MCP client) calls only `agent-swarm.delegate`/`route_plan`; swarm decides which MCP to invoke and returns the downstream result transparently.
- Routing keywords:
  - `doc/manual/spec/reference/latest` → `context7.search_docs`
  - `search/web/find/lookup` → `search-aggregator.search`
  - everything else → `task-orchestrator.create_task`
- Config paths are overrideable via env (`*_MCP_CMD`, `*_MCP_ARGS`). Secrets stay in `~/.mcp/roo-mcp.env` and are sourced by Roo via bash.
- On failure, search returns a local fallback instead of an error; other routes bubble errors from the downstream MCP.

### Immediate Next Steps
1) In Roo, prefer calling `agent-swarm.delegate` with a goal; Roo will see a single tool and the swarm will route to search/task automatically. Use `route_plan` to preview the route.
2) Restart Roo after pulling these changes so it loads the new `dist` builds.

## Integration Plan: Context7 (Upstash)
Goal: always read latest docs/context from Context7 as a resource MCP.
- Clone/setup `https://github.com/upstash/context7` and expose its MCP server (per upstream instructions) locally, e.g.:
  ```
  "context7": {
    "command": "node",
    "args": ["/Users/ceverson/context7/dist/index.js"],
    "env": {
      "CONTEXT7_API_KEY": "your-upstash-api-key-here",
      "CONTEXT7_PROJECT": "your-project-id-here"
    }
  }
  ```
- Extend `ROUTES` in `agent-swarm` to include `context7` and add a routing rule (e.g., goals containing "doc/manual/spec/reference/latest" route to `context7.search_docs`), then call its MCP tool (e.g., `resolve-library-id`). Keep the agent-facing tool as `delegate` so Roo always talks to the swarm.
- Already wired: agent-swarm routes "doc/manual/spec/reference/latest" to `context7` and calls `resolve-library-id`. Override paths with env: `CONTEXT7_MCP_CMD`, `CONTEXT7_MCP_ARGS`.