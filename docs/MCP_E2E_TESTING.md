# MCP End-to-End Testing Guide

## Overview
This repo includes a stdio-based harness to exercise all MCP servers (Go, TypeScript, Python) in a single run. The harness:
- Spins up each server over stdio in a temp MCP_HOME
- Seeds temporary databases/caches to avoid host pollution and write-permission issues
- Runs representative tool calls (task flows for task-orchestrator; cache-backed search for search-aggregator; all tools for skills-manager, agent-swarm, chart-generator, code-intelligence, context-persistence)
- Works offline for search via a pre-seeded cache entry for `sample`

## Harness Location
- `tests/mcp-e2e/run-mcp-e2e-all.js` (unified runner)
- `tests/mcp-e2e/run-mcp-e2e.js` (Go-only runner)

## Prerequisites
- Node 18+ (uses `@modelcontextprotocol/sdk` stdio client)
- Local builds present:
  - Go binaries: `MCP_structure_design/mcp-servers-go/dist/{task-orchestrator,search-aggregator,skills-manager}`
  - TS builds: `src/mcp-servers/*/dist/index.js` for task-orchestrator, search-aggregator, agent-swarm, chart-generator, code-intelligence
  - Python: context-persistence venv at `src/mcp-servers/context-persistence/venv3.12`
- Dependencies installed under `tests/mcp-e2e`: `npm install` (pulls `@modelcontextprotocol/sdk` and `sqlite3`)

## Running
- Go only: `node tests/mcp-e2e/run-mcp-e2e-all.js go`
- TS only: `node tests/mcp-e2e/run-mcp-e2e-all.js ts`
- Python only: `node tests/mcp-e2e/run-mcp-e2e-all.js python`
- Everything: `node tests/mcp-e2e/run-mcp-e2e-all.js all`

## Behavior & Isolation
- Uses a temp MCP_HOME (mkdtemp) for all runs
- Seeds task DB schema/defaults to match Go/TS expectations
- Seeds search cache with a canned result for `sample` so search passes without network
- Passes `-db`/`-cache` flags where supported; sets `MCP_HOME` for TS/Python servers
- Task-orchestrator runs a full flow: create → update status → list → get → execute_code

## Current Coverage (last run)
- task-orchestrator-go: 5/5 tools
- search-aggregator-go: 3/3 tools (cache-seeded search)
- skills-manager-go: 4/4 tools
- task-orchestrator-ts: 5/5 tools
- search-aggregator-ts: 4/4 tools
- agent-swarm-ts: 24/24 tools
- chart-generator-ts: 3/3 tools
- code-intelligence-ts: 7/7 tools
- context-persistence-py: 10/10 tools

## Switching to live DuckDuckGo
Search currently uses a pre-seeded cache. If you prefer live search:
- Remove/disable cache seeding in `run-mcp-e2e-all.js` and ensure outbound DNS/HTTP is allowed, or
- Add a `ddgs` prefetch step to seed cache with live results before the stdio run.

## Extending
- Add new servers to the `SERVERS` map in `run-mcp-e2e-all.js` with command/args/env.
- Add tool-specific flows (like the task flow) if schemas require non-trivial inputs.

## TS/Python MCP_HOME
- TS task-orchestrator/search-aggregator now honor `MCP_HOME` (patched dist) to avoid writing to `~/.mcp`.
- Context-persistence uses temp paths for `CONTEXT_DB` and `QDRANT_PATH` via env in the harness.
