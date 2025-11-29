/**
 * Unified MCP stdio harness for Go, TS, and Python servers.
 * Usage: node run-mcp-e2e-all.js [go|ts|python|all]
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdtempSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import sqlite3 from 'sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const group = (process.argv[2] || 'go').toLowerCase();

// Shared temp MCP home for all runs
const TEMP_ROOT = mkdtempSync(join(tmpdir(), 'mcp-e2e-all-'));
const paths = {
  tasks: join(TEMP_ROOT, 'tasks'),
  cache: join(TEMP_ROOT, 'cache'),
  skills: join(TEMP_ROOT, 'skills'),
  agents: join(TEMP_ROOT, 'agents'),
};
mkdirSync(paths.tasks, { recursive: true });
mkdirSync(join(paths.cache, 'search'), { recursive: true });
mkdirSync(paths.skills, { recursive: true });
mkdirSync(paths.agents, { recursive: true });

// Seed task DB with expected schema/defaults
const taskDbPath = join(paths.tasks, 'tasks.db');
async function seedTaskDb() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(taskDbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
      if (err) return reject(err);
      db.serialize(() => {
        db.run('PRAGMA busy_timeout=2000;');
        db.run(`CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          priority INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          completed_at DATETIME,
          dependencies TEXT DEFAULT '[]',
          git_commits TEXT DEFAULT '[]',
          tags TEXT DEFAULT '[]',
          metadata TEXT DEFAULT '{}',
          execution_environment TEXT,
          code_language TEXT,
          test_results TEXT,
          quality_score INTEGER NOT NULL DEFAULT 0,
          execution_logs TEXT
        );`);
        db.run(`CREATE TABLE IF NOT EXISTS code_executions (
          id TEXT PRIMARY KEY,
          task_id INTEGER,
          language TEXT NOT NULL,
          code TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'queued',
          output TEXT DEFAULT '',
          error TEXT DEFAULT '',
          execution_time_ms INTEGER DEFAULT 0,
          memory_usage_bytes INTEGER DEFAULT 0,
          start_time DATETIME,
          end_time DATETIME,
          environment TEXT DEFAULT 'default',
          dependencies TEXT DEFAULT '[]',
          security_level TEXT DEFAULT 'medium',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );`);
        db.run(`CREATE TABLE IF NOT EXISTS code_analysis (
          id TEXT PRIMARY KEY,
          task_id INTEGER,
          analysis_type TEXT NOT NULL,
          target_path TEXT NOT NULL,
          results TEXT DEFAULT '{}',
          quality_score INTEGER DEFAULT 0,
          suggestions TEXT DEFAULT '[]',
          issues TEXT DEFAULT '[]',
          scan_duration_ms INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );`);
      });
      db.close((closeErr) => {
        if (closeErr) return reject(closeErr);
        resolve();
      });
    });
  });
}

// Seed search cache with a canned result for offline operation
const searchCachePath = join(paths.cache, 'search', 'cache.db');
async function seedSearchCache() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(searchCachePath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
      if (err) return reject(err);
      db.serialize(() => {
        db.run('PRAGMA busy_timeout=2000;');
        db.run(`CREATE TABLE IF NOT EXISTS search_cache (
          query TEXT PRIMARY KEY,
          results TEXT NOT NULL,
          provider TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );`);
        const sampleResults = JSON.stringify([{
          title: 'Sample Result',
          url: 'https://example.com',
          snippet: 'This is a cached result.',
          provider: 'cache',
          timestamp: new Date().toISOString()
        }]);
        db.run(`INSERT OR REPLACE INTO search_cache (query, results, provider, timestamp) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
          ['sample', sampleResults, 'cache']);
      });
      db.close((closeErr) => {
        if (closeErr) return reject(closeErr);
        resolve();
      });
    });
  });
}

const SERVERS = {
  go: [
    {
      name: 'task-orchestrator-go',
      command: '/Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/MCP_structure_design/mcp-servers-go/dist/task-orchestrator',
      args: ['-db', taskDbPath],
      env: { MCP_LOG_LEVEL: 'info' },
      flow: 'task',
    },
    {
      name: 'search-aggregator-go',
      command: '/Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/MCP_structure_design/mcp-servers-go/dist/search-aggregator',
      args: ['-cache', searchCachePath],
      env: { MCP_LOG_LEVEL: 'info' },
    },
    {
      name: 'skills-manager-go',
      command: '/Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/MCP_structure_design/mcp-servers-go/dist/skills-manager',
      args: ['-db', join(paths.skills, 'skills.db')],
      env: { MCP_LOG_LEVEL: 'info' },
    },
  ],
  ts: [
    {
      name: 'task-orchestrator-ts',
      command: 'node',
      args: ['/Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/src/mcp-servers/task-orchestrator/dist/index.js'],
      env: { MCP_HOME: TEMP_ROOT },
      flow: 'task',
    },
    {
      name: 'search-aggregator-ts',
      command: 'node',
      args: ['/Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/src/mcp-servers/search-aggregator/dist/index.js'],
      env: { MCP_HOME: TEMP_ROOT },
    },
    {
      name: 'agent-swarm-ts',
      command: 'node',
      args: ['/Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/src/mcp-servers/agent-swarm/dist/index.js'],
      env: { MCP_HOME: TEMP_ROOT, AGENT_STORAGE: join(paths.agents, 'agent-swarm.db') },
    },
    {
      name: 'chart-generator-ts',
      command: 'node',
      args: ['/Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/src/mcp-servers/chart-generator/dist/index.js'],
      env: { MCP_HOME: TEMP_ROOT },
    },
    {
      name: 'code-intelligence-ts',
      command: 'node',
      args: ['/Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/src/mcp-servers/code-intelligence/dist/index.js'],
      env: { MCP_HOME: TEMP_ROOT },
    },
  ],
  python: [
    {
      name: 'context-persistence-py',
      command: '/Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/src/mcp-servers/context-persistence/venv3.12/bin/python3',
      args: ['-m', 'context_persistence.server'],
      env: {
        PYTHONPATH: '/Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/src/mcp-servers/context-persistence/src',
        CONTEXT_DB: join(TEMP_ROOT, 'context', 'db', 'conversation.db'),
        QDRANT_PATH: join(TEMP_ROOT, 'context', 'qdrant'),
        MCP_HOME: TEMP_ROOT,
      },
    },
  ],
};

const SAMPLE_VALUES = {
  string: 'sample',
  number: 1,
  integer: 1,
  boolean: true,
};

function generateValue(schema) {
  if (!schema) return null;
  const { type, enum: en, items, properties, default: def } = schema;
  if (def !== undefined) return def;
  if (en && en.length) return en[0];
  if (type === 'string' || type === 'number' || type === 'integer' || type === 'boolean') {
    return SAMPLE_VALUES[type] ?? null;
  }
  if (type === 'array') {
    return [generateValue(items || { type: 'string' })];
  }
  if (type === 'object') {
    const obj = {};
    if (properties) {
      for (const [key, propSchema] of Object.entries(properties)) {
        obj[key] = generateValue(propSchema);
      }
    }
    return obj;
  }
  return null;
}

async function runServer(server) {
  const client = new Client({ name: 'mcp-e2e-client', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: server.command,
    args: server.args,
    env: { ...process.env, ...server.env },
    stderr: 'inherit',
  });
  const results = { server: server.name, tools: [] };

  try {
    await client.connect(transport);
    const list = await client.listTools();
    for (const tool of list.tools) {
      const args = generateValue(tool.inputSchema);
      try {
        await client.callTool({ name: tool.name, arguments: args || {} });
        results.tools.push({ name: tool.name, status: 'ok' });
      } catch (err) {
        results.tools.push({ name: tool.name, status: 'error', error: String(err) });
      }
    }
  } finally {
    await client.close().catch(() => {});
    await transport.close().catch(() => {});
  }
  return results;
}

async function runTaskFlow(server) {
  const client = new Client({ name: 'mcp-e2e-client', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: server.command,
    args: server.args,
    env: { ...process.env, ...server.env },
    stderr: 'inherit',
  });
  const results = { server: server.name, tools: [] };
  try {
    await client.connect(transport);
    const createRes = await client.callTool({
      name: 'create_task',
      arguments: { title: 'e2e task', description: 'integration test', priority: 1, dependencies: [], tags: [] },
    });
    results.tools.push({ name: 'create_task', status: 'ok' });
    const created = JSON.parse(createRes.content?.[0]?.text || '{}');
    const taskId = created.task?.id || 1;
    await client.callTool({ name: 'update_task_status', arguments: { task_id: taskId, status: 'in_progress' } });
    results.tools.push({ name: 'update_task_status', status: 'ok' });
    await client.callTool({ name: 'list_tasks', arguments: {} });
    results.tools.push({ name: 'list_tasks', status: 'ok' });
    await client.callTool({ name: 'get_task', arguments: { task_id: taskId, include_executions: false } });
    results.tools.push({ name: 'get_task', status: 'ok' });
    await client.callTool({ name: 'execute_code', arguments: { task_id: taskId, language: 'python', code: 'print(2+2)' } });
    results.tools.push({ name: 'execute_code', status: 'ok' });
  } catch (err) {
    results.tools.push({ name: 'task-flow', status: 'error', error: String(err) });
  } finally {
    await client.close().catch(() => {});
    await transport.close().catch(() => {});
  }
  return results;
}

async function main() {
  await seedTaskDb();
  await seedSearchCache();

  const selected =
    group === 'all'
      ? [...(SERVERS.go || []), ...(SERVERS.ts || []), ...(SERVERS.python || [])]
      : SERVERS[group] || [];

  if (selected.length === 0) {
    console.error(`No servers for group: ${group}`);
    process.exit(1);
  }

  const summary = [];
  for (const server of selected) {
    console.log(`\n=== Running MCP e2e for ${server.name} ===`);
    let res;
    if (server.flow === 'task') {
      res = await runTaskFlow(server);
    } else {
      res = await runServer(server);
    }
    summary.push(res);
    for (const tool of res.tools) {
      const status = tool.status === 'ok' ? '✓' : '✗';
      console.log(`${status} ${tool.name}${tool.error ? ` -> ${tool.error}` : ''}`);
    }
  }

  console.log('\n=== Summary ===');
  for (const s of summary) {
    const ok = s.tools.filter(t => t.status === 'ok').length;
    const total = s.tools.length;
    console.log(`${s.server}: ${ok}/${total} tools succeeded`);
  }
}

main().catch(err => {
  console.error('E2E harness failed:', err);
  process.exit(1);
});
