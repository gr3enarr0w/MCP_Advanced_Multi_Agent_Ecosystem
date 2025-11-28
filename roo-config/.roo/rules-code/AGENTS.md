# Agent Rules - Code Mode

- All TypeScript services MUST use strict `@/*` path aliases - relative imports will break the build
- Agent-swarm uses relaxed TypeScript settings vs strict settings elsewhere (causes import conflicts)
- Context-persistence server requires exact Python 3.12 with complex pyproject.toml virtual environment
- Standard Python venv setup fails - must use project-specific configuration
- All test suites require 30-second timeout minimum (standard 5s will timeout)
- Custom validation scripts run after build - failures often mistaken for build errors
- Build order cannot be bypassed: setup.sh → install-mcp-servers.sh → test-installation.sh
- External MCP server paths must be set before any TypeScript compilation
- Missing env vars cause silent failures in agent-swarm delegation