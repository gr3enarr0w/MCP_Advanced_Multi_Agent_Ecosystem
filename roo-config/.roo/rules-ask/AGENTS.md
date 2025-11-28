# Agent Rules - Ask Mode

- Task routing uses keyword patterns, not semantic analysis - exact phrases required
- "search", "code", "task", "git" are primary routing keywords
- Boomerang pattern sends tasks back to previous agents for refinement
- 7 interconnected servers spread across src/mcp-servers/ with no clear separation
- External dependencies (context7) treated as internal servers
- Configuration files duplicated between configs/ and ~/.mcp/ for different clients
- External servers have separate build processes and update cycles
- Roo and Cursor require different MCP config templates but share same server instances
- SPARC workflow is implemented but not documented - recovery process is undocumented