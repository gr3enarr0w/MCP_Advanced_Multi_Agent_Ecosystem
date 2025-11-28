# MCP Advanced Multi-Agent Ecosystem

A production-grade, multi-agent MCP (Model Context Protocol) ecosystem bundling:

- 6+ MCP servers (TypeScript/Node.js and Python)
- 55+ tools across search, skills, orchestration, and persistence
- Advanced multi-agent orchestration layer (Agent Swarm + Task Orchestrator)
- Skills management via OpenSkills + SkillsMP
- GitHub OAuth2 authentication integration
- Local-first architecture with secure config and storage
- Turnkey configuration for Cursor, Claude Code, Roo, Codex, and related MCP-compatible clients

This repository is structured as a cohesive, extensible platform so you can:

- Develop and run all MCP servers locally or in containers
- Wire them into your preferred AI environments
- Evolve your own tools and agents with clean boundaries and best practices

---

## Repository Structure

```text
.
├── README.md
├── LICENSE
├── .gitignore
├── CHANGELOG.md
├── CONTRIBUTING.md
├── package.json
├── pyproject.toml
├── docs/
├── src/
│   └── mcp-servers/
├── configs/
├── scripts/
├── examples/
└── tests/
```

Key directories:

- `src/mcp-servers/`:
  - `advanced-multi-agent-framework/` – multi-agent runtime, modes, and orchestration glue
  - `agent-swarm/` – TypeScript-based agent orchestration and workflows
  - `task-orchestrator/` – task routing, dependency handling, and workflow coordination
  - `search-aggregator/` – federated search across engines and internal indexes
  - `skills-manager/` – skills registry + integrations with OpenSkills/SkillsMP
  - `context-persistence/` – Python-based long-term memory and context storage
  - `github-oauth/` – GitHub OAuth2-backed identity/permissions server
- `docs/` – architecture, installation, usage, API, and development references
- `configs/` – MCP client integration configs, tool definitions, and environment templates
- `scripts/` – setup, install, configuration, and validation helpers
- `examples/` – sample workflows and client configurations
- `tests/` – integration and E2E test harnesses (to be extended)

---

## Installation

Prerequisites:

- Node.js (LTS, e.g. 20.x)
- npm or pnpm
- Python 3.10+ (for Python-based servers)
- Git
- Recommended: Docker (for optional containerized deployment)

Steps:

1. Clone or copy this repository:
   ```bash
   git clone <your-repo-url> MCP_Advanced_Multi_Agent_Ecosystem
   cd MCP_Advanced_Multi_Agent_Ecosystem
   ```

2. Run the unified setup:
   ```bash
   ./scripts/setup.sh
   ```

   This will:
   - Install Node dependencies for all Node-based MCP servers
   - (Optionally) create Python virtualenvs and install Python dependencies
   - Prepare local `.mcp` storage directories (no secrets committed)
   - Build TypeScript servers where applicable

3. Configure environments:
   - Copy provided example environment files from each server (e.g. `.env.example`) into `.env`
   - Fill in required secrets using your secret manager or local environment injection
   - Never commit real secrets to git

4. Register MCP servers with your tools:
   - Use `configs/` JSON files as templates for:
     - Cursor
     - Claude Code
     - Roo
     - Codex
   - Point each client to the appropriate local MCP server endpoints or commands.

---

## Usage

Common operations (after running `scripts/setup.sh`):

- Start all Node-based MCP servers:
  ```bash
  ./scripts/install-mcp-servers.sh
  ```

- Configure tools/clients (idempotent where supported):
  ```bash
  ./scripts/configure-tools.sh
  ```

- Validate installation:
  ```bash
  ./scripts/test-installation.sh
  ```

Each MCP server directory under `src/mcp-servers/` includes its own:

- `README.md` with server-specific usage
- `package.json` or `pyproject.toml`
- Local run command (e.g. `npm start`, `node index.js`, or `python -m ...`)

---

## Architecture Overview

High-level components:

- Advanced Multi-Agent Framework:
  - Central coordination of specialist agents (architect, code, debug, research, etc.)
  - Uses MCP servers as first-class tools
- Agent Swarm:
  - Orchestrates multiple concurrent agents and workflows
  - Supports complex, multi-step task execution
- Task Orchestrator:
  - Ensures deterministic routing and dependency ordering
  - Provides boomerang/loop workflows and rollback awareness
- Search Aggregator:
  - Normalizes queries across multiple external and local search providers
  - Feeds results into agents for reasoning and planning
- Skills Manager:
  - Manages skills metadata, discovery, and scoring
  - Integrates with OpenSkills/SkillsMP APIs (configured via environment)
- Context Persistence:
  - Long-term storage for conversations, artifacts, and embeddings
  - Local-first design; storage path configurable per environment
- GitHub OAuth:
  - Optional authentication / authorization layer
  - Allows controlled access to tools and repositories for agents

Design principles:

- Local-first; all core services runnable on a single workstation
- Modular; each MCP server is independently deployable (bare metal, Docker, serverless)
- Secure by default:
  - No secrets in source
  - `.env` and secret JSON ignored by git
  - Config templates separated from runtime values
- Git-friendly:
  - Clear boundaries between code, configs, docs, and examples

See `docs/architecture/system-overview.md` for a detailed diagram and lifecycle.

---

## Development

- Install dev dependencies via `scripts/setup.sh`
- Per-server development:
  - TypeScript servers: standard `npm run build` / `npm test`
  - Python servers: use the defined environments and `pytest`/`uvicorn` as applicable
- Run tests:
  - Reserved for project-level harnesses under `tests/`
  - Connects to running MCP servers for integration/E2E validation

Follow additional guidelines in:

- `docs/development/contributing.md`
- `docs/development/architecture-decisions.md`
- `docs/development/testing-strategy.md`

---

## Licensing and Contributions

- Default license: MIT (see `LICENSE`)
- Contributions:
  - Use feature branches
  - Follow conventional commits
  - Include tests/docs for new MCP servers or tools

---

## Git Workflow

To initialize your own repository on top of this structure:

```bash
cd MCP_Advanced_Multi_Agent_Ecosystem

git init
git add .

git commit -m "feat: Complete MCP Advanced Multi-Agent Ecosystem

- 6 MCP servers with 55+ tools
- Advanced Multi-Agent AI Framework integration
- Skills management with OpenSkills + SkillsMP
- GitHub OAuth2 authentication
- Local-first architecture
- Cross-tool integration (Roo, Cursor, Claude Code, Codex)"
```

Then create and push to your remote:

```bash
git remote add origin <your-git-url>
git push -u origin main
```

This repository is now a complete, production-ready baseline for your MCP server ecosystem.