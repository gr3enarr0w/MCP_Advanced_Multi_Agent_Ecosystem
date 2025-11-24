# External MCP Servers Guide

This document explains how external MCP servers are managed in the MCP Advanced Multi-Agent Ecosystem.

## Overview

External MCP servers are third-party MCP implementations that extend the capabilities of the agent-swarm. They are:

1. **Managed as Git Submodules** - Not cloned directly, preventing nested repository issues
2. **Internal to agent-swarm** - Roo/Claude Code only sees agent-swarm; external MCPs are routed internally
3. **Optional** - The system works without them, but with reduced capabilities

## Available External MCPs

| Server | Language | Purpose | Source Repository |
|--------|----------|---------|-------------------|
| **context7** | TypeScript | Documentation lookup for libraries/frameworks | [upstash/context7](https://github.com/upstash/context7) |
| **mcp-code-checker** | Python | Code quality checks (pylint, pytest, mypy) | [MarcusJellinghaus/mcp-code-checker](https://github.com/MarcusJellinghaus/mcp-code-checker) |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Roo / Claude Code                        │
│                    (Only sees agent-swarm)                       │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        agent-swarm                               │
│                                                                  │
│  delegate tool → pickRoute() → routes to appropriate server     │
│                                                                  │
│  Routing Keywords:                                               │
│  • doc/manual/spec/reference     → context7                     │
│  • lint/pylint/pytest/mypy       → mcp-code-checker             │
│  • search/web/lookup/find        → search-aggregator            │
│  • default                       → task-orchestrator            │
└─────────────────────────────────────────────────────────────────┘
          │              │                │               │
          ▼              ▼                ▼               ▼
    ┌──────────┐  ┌─────────────┐  ┌────────────┐  ┌──────────────┐
    │ context7 │  │mcp-code-    │  │  search-   │  │    task-     │
    │(external)│  │checker      │  │ aggregator │  │ orchestrator │
    │          │  │(external)   │  │ (internal) │  │  (internal)  │
    └──────────┘  └─────────────┘  └────────────┘  └──────────────┘
```

## Why Git Submodules?

### The Problem with Git Clone

When external repos are cloned directly into the project:

```
MCP_Advanced_Multi_Agent_Ecosystem/
├── .git/                          # Main repository
└── src/mcp-servers/external/
    └── context7/
        └── .git/                  # NESTED repository - PROBLEM!
```

This causes:
- **Claude Code checkpoint failures** - "Checkpoints disabled due to nested git repository"
- **Git command confusion** - Commands may affect wrong repository
- **CI/CD issues** - Automated systems may not handle nested repos correctly

### The Solution: Git Submodules

Submodules register external repos properly:

```
MCP_Advanced_Multi_Agent_Ecosystem/
├── .git/
│   └── modules/
│       └── src/mcp-servers/external/
│           ├── context7/          # Submodule git data stored here
│           └── mcp-code-checker/
├── .gitmodules                    # Submodule registration
└── src/mcp-servers/external/
    ├── context7/                  # Working directory (no .git inside)
    └── mcp-code-checker/          # Working directory (no .git inside)
```

Benefits:
- **No nested .git directories** in the working tree
- **Proper version tracking** - Specific commits are pinned
- **Standard git workflow** - `git submodule update` handles everything

## Installation

### First-Time Setup

The main setup script handles submodules automatically:

```bash
./scripts/setup.sh
```

This runs:
1. `git submodule update --init --recursive` - Initialize submodules
2. `./scripts/install-mcp-servers.sh` - Build all servers
3. `./scripts/configure-tools.sh` - Configure MCP clients

### Cloning the Repository

When cloning fresh, use `--recursive`:

```bash
git clone --recursive https://github.com/gr3enarr0w/MCP_Advanced_Multi_Agent_Ecosystem.git
```

Or if already cloned without submodules:

```bash
git submodule update --init --recursive
```

### Manual External MCP Setup

If you only want to set up external MCPs:

```bash
./scripts/setup-external-mcps.sh
```

This script:
1. Initializes git submodules
2. Installs context7 (npm install && npm run build)
3. Installs mcp-code-checker (pip install -e .)
4. Generates `.env.external-mcps` configuration

## Configuration

### Environment Variables

External MCPs are configured via environment variables (generated in `.env.external-mcps`):

```bash
# Context7 (TypeScript/Node)
CONTEXT7_MCP_CMD=node
CONTEXT7_MCP_ARGS=/path/to/context7/dist/index.js

# MCP Code Checker (Python)
MCP_CODE_CHECKER_CMD=mcp-code-checker
MCP_CODE_CHECKER_PROJECT_DIR=${PWD}
```

### Verifying Installation

Check submodule status:

```bash
git submodule status
```

Expected output:
```
 45ed235... src/mcp-servers/external/context7 (v1.0.29-10-g45ed235)
 3ef6a37... src/mcp-servers/external/mcp-code-checker (0.1.1)
```

Check external MCP availability (agent-swarm logs on startup):
```
External MCP availability: {"context7":true,"mcp-code-checker":true}
```

## Using External MCPs

### Via the `delegate` Tool

The `delegate` tool in agent-swarm automatically routes based on keywords:

```javascript
// Documentation lookup → context7
await delegate({ goal: "Get React documentation" });

// Code quality check → mcp-code-checker
await delegate({ goal: "Run pylint on my code" });

// Web search → search-aggregator
await delegate({ goal: "Search for TypeScript best practices" });
```

### Via the `route_plan` Tool

Preview routing decisions without execution:

```javascript
await route_plan({ goal: "Check mypy types" });
// Returns: { route: "mcp-code-checker", tool: "run_all_checks", available: true }
```

## External MCP Details

### context7 (Upstash)

**Purpose**: Provides up-to-date documentation for libraries and frameworks.

**Tools**:
- `resolve-library-id` - Resolve a library name to its context7 ID
- `get-library-docs` - Get documentation for a specific library

**Routing keywords**: `doc`, `manual`, `spec`, `documentation`, `reference`

**Example**:
```javascript
// Via delegate
await delegate({ goal: "Get Next.js documentation" });

// Direct call (if using context7 directly)
await resolve_library_id({ libraryName: "next.js" });
await get_library_docs({ libraryId: "nextjs", topic: "routing" });
```

### mcp-code-checker (MarcusJellinghaus)

**Purpose**: Run code quality checks on Python projects.

**Tools**:
- `run_pylint_check` - Run pylint static analysis
- `run_pytest_check` - Run pytest test suite
- `run_mypy_check` - Run mypy type checking
- `run_all_checks` - Run all checks combined

**Routing keywords**: `lint`, `pylint`, `pytest`, `mypy`, `type check`, `code quality`, `run tests`, `check code`, `analyze code`

**Example**:
```javascript
// Via delegate
await delegate({ goal: "Run pylint on my Python code" });
await delegate({ goal: "Check mypy types" });
await delegate({ goal: "Run all code quality checks" });

// Direct call parameters
await run_pylint_check({
  categories: ['error', 'fatal', 'warning'],
  target_directories: ['src', 'tests']
});

await run_pytest_check({
  verbosity: 2,
  markers: ['unit']
});

await run_mypy_check({
  strict: true,
  target_directories: ['src']
});
```

## Troubleshooting

### Checkpoints Still Disabled

If you still see "Checkpoints disabled due to nested git repository":

1. **Verify submodules are properly configured**:
   ```bash
   cat .gitmodules
   ```
   Should show entries for context7 and mcp-code-checker.

2. **Check for orphaned .git directories**:
   ```bash
   find src/mcp-servers/external -name ".git" -type d
   ```
   Should return empty (submodule .git is stored in main `.git/modules/`).

3. **Reinitialize if needed**:
   ```bash
   # Remove and re-add submodules
   rm -rf src/mcp-servers/external/context7
   rm -rf src/mcp-servers/external/mcp-code-checker
   git submodule update --init --recursive
   ```

### context7 Not Working

1. **Check if built**:
   ```bash
   ls src/mcp-servers/external/context7/dist/index.js
   ```

2. **Rebuild**:
   ```bash
   cd src/mcp-servers/external/context7
   npm install
   npm run build
   ```

3. **Test standalone**:
   ```bash
   node src/mcp-servers/external/context7/dist/index.js
   ```

### mcp-code-checker Not Working

1. **Check if installed**:
   ```bash
   which mcp-code-checker
   mcp-code-checker --help
   ```

2. **Reinstall**:
   ```bash
   cd src/mcp-servers/external/mcp-code-checker
   pip install -e .
   ```

3. **Test standalone**:
   ```bash
   mcp-code-checker --project-dir /path/to/python/project --help
   ```

### agent-swarm Routing Failures

1. **Check external MCP status on startup**:
   Look for log line: `External MCP availability: {...}`

2. **Use route_plan to debug**:
   ```javascript
   await route_plan({ goal: "your query here" });
   ```

3. **Rebuild agent-swarm**:
   ```bash
   cd src/mcp-servers/agent-swarm
   npm run build
   ```

## Updating External MCPs

### Update to Latest Version

```bash
cd src/mcp-servers/external/context7
git fetch origin
git checkout origin/master  # or main
cd ../..
git add src/mcp-servers/external/context7
git commit -m "chore: Update context7 submodule"
```

### Pin to Specific Version

```bash
cd src/mcp-servers/external/context7
git checkout v1.0.30  # specific tag
cd ../..
git add src/mcp-servers/external/context7
git commit -m "chore: Pin context7 to v1.0.30"
```

## Adding New External MCPs

1. **Add as submodule**:
   ```bash
   git submodule add https://github.com/owner/new-mcp.git src/mcp-servers/external/new-mcp
   ```

2. **Update agent-swarm routing** in `src/mcp-servers/agent-swarm/src/index.ts`:
   - Add to `RouteTarget` type
   - Add case in `getRouteConfig()`
   - Add routing keywords in `pickRoute()`
   - Add handling in `delegate` case

3. **Update setup script** in `scripts/setup-external-mcps.sh`

4. **Rebuild and test**:
   ```bash
   cd src/mcp-servers/agent-swarm
   npm run build
   ```

## File Reference

| File | Purpose |
|------|---------|
| `.gitmodules` | Git submodule configuration |
| `scripts/setup-external-mcps.sh` | External MCP setup script |
| `scripts/setup.sh` | Main setup (includes submodule init) |
| `.env.external-mcps` | Generated environment config |
| `src/mcp-servers/agent-swarm/src/index.ts` | Routing logic and MCP integration |
| `src/mcp-servers/external/context7/` | Context7 submodule |
| `src/mcp-servers/external/mcp-code-checker/` | MCP Code Checker submodule |
