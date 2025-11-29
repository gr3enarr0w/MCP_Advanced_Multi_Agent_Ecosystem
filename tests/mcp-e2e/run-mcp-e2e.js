import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdtempSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import sqlite3 from 'sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TEMP_ROOT = mkdtempSync(join(tmpdir(), 'mcp-e2e-'));
const paths = {
  tasks: join(TEMP_ROOT, 'tasks'),
  cache: join(TEMP_ROOT, 'cache'),
  skills: join(TEMP_ROOT, 'skills'),
};
mkdirSync(paths.tasks, { recursive: true });
mkdirSync(join(paths.cache, 'search'), { recursive: true });
mkdirSync(paths.skills, { recursive: true });

// Precreate task DB with schema defaults to avoid NULL scan errors
const taskDbPath = join(paths.tasks, 'tasks.db');
const taskDb = new sqlite3.Database(taskDbPath);
taskDb.serialize(() => {
  taskDb.run(`CREATE TABLE IF NOT EXISTS tasks (
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
  taskDb.run(`CREATE TABLE IF NOT EXISTS code_executions (
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
  taskDb.run(`CREATE TABLE IF NOT EXISTS code_analysis (
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
taskDb.close();

// Pre-seed search cache with a canned result for query "sample" to avoid network
const searchCachePath = join(paths.cache, 'search', 'cache.db');
{
  const db = new sqlite3.Database(searchCachePath);
  db.serialize(() => {
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
  db.close();
}

const SERVERS = [
  {
    name: 'task-orchestrator-go',
    command: '/Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/MCP_structure_design/mcp-servers-go/dist/task-orchestrator',
    args: ['-db', taskDbPath],
    env: {
      MCP_LOG_LEVEL: 'info',
    },
  },
  {
    name: 'search-aggregator-go',
    command: '/Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/MCP_structure_design/mcp-servers-go/dist/search-aggregator',
    args: ['-cache', join(paths.cache, 'search', 'cache.db')],
    env: {
      MCP_LOG_LEVEL: 'info',
    },
  },
  {
    name: 'skills-manager-go',
    command: '/Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/MCP_structure_design/mcp-servers-go/dist/skills-manager',
    args: ['-db', join(paths.skills, 'skills.db')],
    env: {
      MCP_LOG_LEVEL: 'info',
    },
  },
];

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
  const client = new Client({
    name: 'mcp-e2e-client',
    version: '1.0.0',
  });

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

async function main() {
  const summary = [];

  // Task orchestrator flow with real task ID
  const taskServer = SERVERS.find(s => s.name === 'task-orchestrator-go');
  if (taskServer) {
    console.log(`\n=== Running MCP e2e for ${taskServer.name} ===`);
    const client = new Client({ name: 'mcp-e2e-client', version: '1.0.0' });
    const transport = new StdioClientTransport({
      command: taskServer.command,
      args: taskServer.args,
      env: { ...process.env, ...taskServer.env },
      stderr: 'inherit',
    });
    const results = { server: taskServer.name, tools: [] };
    try {
      await client.connect(transport);
      const createRes = await client.callTool({
        name: 'create_task',
        arguments: {
          title: 'e2e task',
          description: 'integration test',
          priority: 1,
          dependencies: [],
          tags: [],
        },
      });
      results.tools.push({ name: 'create_task', status: 'ok' });
      const created = JSON.parse(createRes.content?.[0]?.text || '{}');
      const taskId = created.task?.id || 1;
      await client.callTool({
        name: 'update_task_status',
        arguments: { task_id: taskId, status: 'in_progress' },
      });
      results.tools.push({ name: 'update_task_status', status: 'ok' });
      await client.callTool({ name: 'list_tasks', arguments: {} });
      results.tools.push({ name: 'list_tasks', status: 'ok' });
      await client.callTool({ name: 'get_task', arguments: { task_id: taskId, include_executions: false } });
      results.tools.push({ name: 'get_task', status: 'ok' });
      await client.callTool({ name: 'execute_code', arguments: { task_id: taskId, language: 'python', code: 'print(2+2)' } });
      results.tools.push({ name: 'execute_code', status: 'ok' });
    } catch (err) {
      results.tools.push({ name: 'task-orchestrator-flow', status: 'error', error: String(err) });
    } finally {
      await client.close().catch(() => {});
      await transport.close().catch(() => {});
    }
    summary.push(results);
    results.tools.forEach(t => console.log(`${t.status === 'ok' ? '✓' : '✗'} ${t.name}${t.error ? ` -> ${t.error}` : ''}`));
  }

  // Generic run for the remaining servers
  for (const server of SERVERS.filter(s => s.name !== 'task-orchestrator-go')) {
    console.log(`\n=== Running MCP e2e for ${server.name} ===`);
    const res = await runServer(server);
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
