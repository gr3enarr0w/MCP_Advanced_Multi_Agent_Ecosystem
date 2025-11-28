# Agent Rules - Architect Mode

- Context-persistence (Python 3.12) must start first - all other servers depend on it
- Boomerang pattern sends tasks back to previous agents - creates circular dependencies
- context7 is external but treated as core architecture component
- External servers have independent versioning - creates compatibility matrix complexity
- Roo modes and Cursor extensions share same MCP servers but different config formats
- Client-specific features must be abstracted at server level to maintain compatibility
- SQLite chosen over PostgreSQL for portability but creates scaling limitations
- File-based locking mechanisms prevent concurrent access across clients
- Data migration between versions is manual - architectural upgrade path not automated