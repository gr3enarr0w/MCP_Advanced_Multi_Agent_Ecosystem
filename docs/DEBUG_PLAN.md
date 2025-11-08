# MCP Servers Debug Plan

## Systematic Debugging Approach

### Phase 1: Environment Validation
1. ✅ Check Python installation and dependencies
2. ✅ Check Node.js installation and dependencies
3. ✅ Verify local storage directories exist
4. ✅ Check file permissions

### Phase 2: Individual Server Testing
Each server will be tested in isolation with detailed logging.

#### A. Context Persistence Server (Python)
**Potential Issues:**
1. Import errors (mcp, qdrant, sqlalchemy, sentence-transformers)
2. Qdrant initialization failing
3. SQLite database creation issues
4. Embedding model download issues
5. Async/await problems

**Debug Steps:**
1. Test imports individually
2. Test SQLite connection
3. Test Qdrant local initialization
4. Test embedding model loading
5. Test tool registration

#### B. Task Orchestrator Server (TypeScript)
**Potential Issues:**
1. sql.js initialization (async)
2. Top-level await not supported in module
3. Graph library issues
4. Git integration errors
5. MCP SDK import issues

**Debug Steps:**
1. Test sql.js initialization
2. Test database schema creation
3. Test MCP server startup
4. Test tool registration
5. Test git integration

#### C. Search Aggregator Server (TypeScript)
**Potential Issues:**
1. Axios import issues
2. API key environment variables not set
3. Cache database initialization
4. Provider class initialization
5. MCP SDK issues

**Debug Steps:**
1. Test provider initialization
2. Test cache database
3. Test fallback logic
4. Test MCP server startup

### Phase 3: Integration Testing
1. Test MCP protocol communication
2. Test stdio transport
3. Test tool invocation
4. Test error handling

## Identified Issues

### Issue 1: Task Orchestrator - Top-level await
**Problem:** Using `await taskDb.init()` at module level
**Fix:** Move initialization into async function or use IIFE

### Issue 2: Better-sqlite3 compilation
**Status:** ✅ Already fixed by switching to sql.js

### Issue 3: Missing dependencies
**Status:** Need to install Node modules

## Debug Logs to Add

### Context Persistence
- [ ] Log: Database initialization
- [ ] Log: Qdrant collection creation
- [ ] Log: Embedding model loading
- [ ] Log: Tool registration
- [ ] Log: Server startup

### Task Orchestrator  
- [ ] Log: sql.js initialization
- [ ] Log: Database file load/create
- [ ] Log: Schema creation
- [ ] Log: Server startup

### Search Aggregator
- [ ] Log: Provider initialization
- [ ] Log: Cache database initialization
- [ ] Log: Available providers
- [ ] Log: Server startup

## Testing Commands

### Test Context Persistence
```bash
cd /Users/ceverson/MCP_structure_design
python3 -c "
import sys
sys.path.insert(0, 'mcp-servers/context-persistence/src')
try:
    from context_persistence import server
    print('✓ Module imports successfully')
except Exception as e:
    print(f'✗ Import failed: {e}')
"
```

### Test Task Orchestrator
```bash
cd mcp-servers/task-orchestrator
npm install
npm run build
node dist/index.js
```

### Test Search Aggregator
```bash
cd mcp-servers/search-aggregator
npm install
npm run build
node dist/index.js
```

## Expected Output

Each server should:
1. Print initialization logs
2. Print "Server running on stdio"
3. Wait for stdin input
4. Not exit immediately
5. Not throw errors

## Common Fixes

### Fix 1: Module not found
- Solution: Install dependencies
- Command: `pip3 install <package>` or `npm install`

### Fix 2: Database errors
- Solution: Create directory, check permissions
- Command: `mkdir -p ~/.mcp/context ~/.mcp/tasks ~/.mcp/cache/search`

### Fix 3: Top-level await
- Solution: Wrap in async IIFE or move to function

### Fix 4: Encoding errors
- Solution: Ensure UTF-8 encoding for all files

## Next Steps

1. Run environment validation
2. Fix any identified issues
3. Add debug logging to each server
4. Test each server individually
5. Fix issues one at a time
6. Integration test when all pass