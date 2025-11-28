# Agent Rules - Debug Mode

- All runtime data persists in `~/.mcp/` directory - check context/db, tasks/db, caches, logs
- Database files are SQLite but with custom schema - use provided query tools only
- GitHub OAuth server runs on port 4000 by default - conflicts with common dev servers
- OAuth tokens stored in ~/.mcp/github/ - manual token refresh often required
- Each MCP server has unique log format in ~/.mcp/logs/[server-name]/
- Agent-swarm logs use structured JSON while others use plain text
- Silent failures common - check logs even when commands appear successful
- Server startup order matters - context-persistence must start before task-orchestrator
- Port conflicts between agents resolved dynamically - check ~/.mcp/ports.json
- External server restarts require full MCP stack restart due to dependency caching