# Agent Rules Standard

## Critical Architecture Requirements
- **7 interconnected MCP servers**: context-persistence (Python 3.12), task-orchestrator, search-aggregator, agent-swarm, skills-manager, git, and external MCP integrations
- **Agent delegation routing**: Keyword-based task routing system with boomerang pattern for refinement loops
- **TypeScript path aliases**: Strict `@/*` patterns required across all TypeScript services
- **Build order**: `setup.sh` → `install-mcp-servers.sh` → `test-installation.sh` (cannot be bypassed)

## Environment-Specific Requirements
- **Python 3.12 mandatory**: Context persistence requires complex virtual environment handling with `pyproject.toml`
- **Critical env vars**: External MCP server paths, search provider keys, and agent swarm configuration must be set
- **Multi-client sync**: MCP configuration files must sync across Roo/Cursor integration templates
- **Testing framework**: 30-second Jest timeouts with specific configs for unit/integration/performance/security suites

## External Dependencies
- External MCP servers integrated as internal dependencies (context7)
- Agent swarm with SPARC workflow execution (Specification → Pseudocode → Architecture → Refinement → Completion)