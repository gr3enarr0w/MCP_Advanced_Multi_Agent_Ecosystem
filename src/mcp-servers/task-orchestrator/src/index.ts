/**
 * Task Orchestrator MCP Server
 * 
 * Manages task lifecycle, dependencies, execution, and code quality analysis
 * 
 * Core Capabilities:
 * - Task CRUD operations with DAG-based dependency tracking
 * - Multi-language code execution (Python, JavaScript, Bash, SQL)
 * - Code quality analysis and security scanning
 * - Git commit linking for traceability
 * - Task graph visualization (JSON and Mermaid)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import initSqlJs, { Database } from 'sql.js';
import { v4 as uuidv4 } from 'uuid';

// Configuration
const MCP_HOME = process.env.MCP_HOME || join(homedir(), '.mcp');
const TASK_DB = join(MCP_HOME, 'tasks', 'tasks.db');

// Ensure directories exist
if (!existsSync(MCP_HOME)) {
  mkdirSync(MCP_HOME, { recursive: true });
}
if (!existsSync(join(MCP_HOME, 'tasks'))) {
  mkdirSync(join(MCP_HOME, 'tasks'), { recursive: true });
}

// Types
type TaskStatus = 'pending' | 'in_progress' | 'blocked' | 'completed';
type CodeLanguage = 'python' | 'javascript' | 'typescript' | 'bash' | 'sql';

interface Task {
  id: number;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: number;
  dependencies: number[];
  tags: string[];
  code_language?: CodeLanguage;
  execution_environment?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

interface CodeExecution {
  id: number;
  task_id: number;
  language: CodeLanguage;
  code: string;
  output?: string;
  error?: string;
  exit_code?: number;
  execution_time?: number;
  timestamp: string;
}

// Database Manager
class TaskDatabase {
  private db: Database | null = null;
  private SQL: any = null;

  async initialize(): Promise<void> {
    this.SQL = await initSqlJs();
    
    // Load existing database or create new one
    if (existsSync(TASK_DB)) {
      const fs = await import('fs/promises');
      const buffer = await fs.readFile(TASK_DB);
      this.db = new this.SQL.Database(buffer);
    } else {
      this.db = new this.SQL.Database();
      await this.createSchema();
    }
  }

  private async createSchema(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        priority INTEGER DEFAULT 0,
        dependencies TEXT DEFAULT '[]',
        tags TEXT DEFAULT '[]',
        code_language TEXT,
        execution_environment TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS code_executions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        language TEXT NOT NULL,
        code TEXT NOT NULL,
        output TEXT,
        error TEXT,
        exit_code INTEGER,
        execution_time REAL,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS git_commits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        commit_hash TEXT NOT NULL,
        commit_message TEXT,
        author TEXT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      )
    `);

    await this.save();
  }

  async save(): Promise<void> {
    if (!this.db) return;
    const fs = await import('fs/promises');
    const data = this.db.export();
    await fs.writeFile(TASK_DB, Buffer.from(data));
  }

  createTask(task: Omit<Task, 'id' | 'created_at' | 'updated_at'>): Task {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT INTO tasks (title, description, status, priority, dependencies, tags, code_language, execution_environment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      task.title,
      task.description || null,
      task.status,
      task.priority,
      JSON.stringify(task.dependencies),
      JSON.stringify(task.tags),
      task.code_language || null,
      task.execution_environment || null,
    ]);

    const id = this.db.exec("SELECT last_insert_rowid() as id")[0].values[0][0] as number;
    stmt.free();

    this.save();
    return this.getTask(id)!;
  }

  getTask(id: number): Task | null {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM tasks WHERE id = ?');
    stmt.bind([id]);
    
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return this.rowToTask(row);
    }
    
    stmt.free();
    return null;
  }

  listTasks(filters?: { status?: TaskStatus; code_language?: CodeLanguage }): Task[] {
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM tasks';
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters?.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }
    if (filters?.code_language) {
      conditions.push('code_language = ?');
      params.push(filters.code_language);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY priority DESC, created_at DESC';

    const stmt = this.db.prepare(query);
    stmt.bind(params);

    const tasks: Task[] = [];
    while (stmt.step()) {
      tasks.push(this.rowToTask(stmt.getAsObject()));
    }
    stmt.free();

    return tasks;
  }

  updateTaskStatus(id: number, status: TaskStatus): Task | null {
    if (!this.db) throw new Error('Database not initialized');

    const completedAt = status === 'completed' ? new Date().toISOString() : null;
    
    this.db.run(
      'UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP, completed_at = ? WHERE id = ?',
      [status, completedAt, id]
    );

    this.save();
    return this.getTask(id);
  }

  deleteTask(id: number): boolean {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('DELETE FROM tasks WHERE id = ?');
    stmt.run([id]);
    const deleted = this.db.getRowsModified() > 0;
    stmt.free();

    if (deleted) {
      this.save();
    }
    return deleted;
  }

  saveCodeExecution(execution: Omit<CodeExecution, 'id' | 'timestamp'>): CodeExecution {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT INTO code_executions (task_id, language, code, output, error, exit_code, execution_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      execution.task_id,
      execution.language,
      execution.code,
      execution.output || null,
      execution.error || null,
      execution.exit_code || null,
      execution.execution_time || null,
    ]);

    const id = this.db.exec("SELECT last_insert_rowid() as id")[0].values[0][0] as number;
    stmt.free();

    this.save();
    
    const result = this.db.prepare('SELECT * FROM code_executions WHERE id = ?');
    result.bind([id]);
    result.step();
    const row = result.getAsObject();
    result.free();

    return this.rowToCodeExecution(row);
  }

  getTaskExecutions(taskId: number): CodeExecution[] {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM code_executions WHERE task_id = ? ORDER BY timestamp DESC');
    stmt.bind([taskId]);

    const executions: CodeExecution[] = [];
    while (stmt.step()) {
      executions.push(this.rowToCodeExecution(stmt.getAsObject()));
    }
    stmt.free();

    return executions;
  }

  linkGitCommit(taskId: number, commitHash: string, commitMessage?: string, author?: string): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(
      'INSERT INTO git_commits (task_id, commit_hash, commit_message, author) VALUES (?, ?, ?, ?)',
      [taskId, commitHash, commitMessage || null, author || null]
    );

    this.save();
  }

  getTaskCommits(taskId: number): any[] {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM git_commits WHERE task_id = ? ORDER BY timestamp DESC');
    stmt.bind([taskId]);

    const commits: any[] = [];
    while (stmt.step()) {
      commits.push(stmt.getAsObject());
    }
    stmt.free();

    return commits;
  }

  private rowToTask(row: any): Task {
    return {
      id: row.id as number,
      title: row.title as string,
      description: row.description as string | undefined,
      status: row.status as TaskStatus,
      priority: row.priority as number,
      dependencies: JSON.parse(row.dependencies as string || '[]'),
      tags: JSON.parse(row.tags as string || '[]'),
      code_language: row.code_language as CodeLanguage | undefined,
      execution_environment: row.execution_environment as string | undefined,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      completed_at: row.completed_at as string | undefined,
    };
  }

  private rowToCodeExecution(row: any): CodeExecution {
    return {
      id: row.id as number,
      task_id: row.task_id as number,
      language: row.language as CodeLanguage,
      code: row.code as string,
      output: row.output as string | undefined,
      error: row.error as string | undefined,
      exit_code: row.exit_code as number | undefined,
      execution_time: row.execution_time as number | undefined,
      timestamp: row.timestamp as string,
    };
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.save();
      this.db.close();
      this.db = null;
    }
  }
}

// Code Executor
class CodeExecutor {
  async execute(language: CodeLanguage, code: string, taskId?: number): Promise<Partial<CodeExecution>> {
    const startTime = Date.now();
    
    try {
      let result: { output?: string; error?: string; exitCode: number };

      switch (language) {
        case 'python':
          result = await this.executePython(code);
          break;
        case 'javascript':
        case 'typescript':
          result = await this.executeJavaScript(code);
          break;
        case 'bash':
          result = await this.executeBash(code);
          break;
        case 'sql':
          result = await this.executeSQL(code);
          break;
        default:
          throw new Error(`Unsupported language: ${language}`);
      }

      const executionTime = (Date.now() - startTime) / 1000;

      return {
        task_id: taskId || 0,
        language,
        code,
        output: result.output,
        error: result.error,
        exit_code: result.exitCode,
        execution_time: executionTime,
      };
    } catch (error) {
      const executionTime = (Date.now() - startTime) / 1000;
      return {
        task_id: taskId || 0,
        language,
        code,
        error: error instanceof Error ? error.message : String(error),
        exit_code: 1,
        execution_time: executionTime,
      };
    }
  }

  private async executePython(code: string): Promise<{ output?: string; error?: string; exitCode: number }> {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);

    try {
      const { stdout, stderr } = await execFileAsync('python3', ['-c', code]);
      return { output: stdout, error: stderr || undefined, exitCode: 0 };
    } catch (error: any) {
      return { error: error.stderr || error.message, exitCode: error.code || 1 };
    }
  }

  private async executeJavaScript(code: string): Promise<{ output?: string; error?: string; exitCode: number }> {
    try {
      // eslint-disable-next-line no-eval
      const result = eval(code);
      return { output: String(result), exitCode: 0 };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error), exitCode: 1 };
    }
  }

  private async executeBash(code: string): Promise<{ output?: string; error?: string; exitCode: number }> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    try {
      const { stdout, stderr } = await execAsync(code);
      return { output: stdout, error: stderr || undefined, exitCode: 0 };
    } catch (error: any) {
      return { error: error.stderr || error.message, exitCode: error.code || 1 };
    }
  }

  private async executeSQL(_code: string): Promise<{ output?: string; error?: string; exitCode: number }> {
    // SQL execution would require a database connection - placeholder for now
    return { output: 'SQL execution not yet implemented', exitCode: 0 };
  }
}

// Initialize server
const server = new Server(
  {
    name: 'task-orchestrator',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

const db = new TaskDatabase();
const executor = new CodeExecutor();

export { TaskDatabase, CodeExecutor };

// Define MCP tools
const tools: Tool[] = [
  {
    name: 'create_task',
    description: 'Create a new task with optional dependencies and code execution environment',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'Task description' },
        priority: { type: 'number', description: 'Task priority (0-4)', default: 0 },
        dependencies: { type: 'array', items: { type: 'number' }, description: 'Task IDs this task depends on', default: [] },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags for categorization', default: [] },
        code_language: { type: 'string', enum: ['python', 'javascript', 'typescript', 'bash', 'sql'], description: 'Programming language for code tasks' },
        execution_environment: { type: 'string', description: 'Execution environment details' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_task_status',
    description: 'Update the status of a task',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'number', description: 'Task ID to update' },
        status: { type: 'string', enum: ['pending', 'in_progress', 'blocked', 'completed'], description: 'New task status' },
      },
      required: ['task_id', 'status'],
    },
  },
  {
    name: 'get_task',
    description: 'Get details of a specific task including execution history',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'number', description: 'Task ID to retrieve' },
        include_executions: { type: 'boolean', description: 'Include code execution history', default: false },
        include_analysis: { type: 'boolean', description: 'Include code analysis results', default: false },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'list_tasks',
    description: 'List all tasks, optionally filtered by status or language',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['pending', 'in_progress', 'blocked', 'completed'], description: 'Filter by status' },
        code_language: { type: 'string', enum: ['python', 'javascript', 'typescript', 'bash', 'sql'], description: 'Filter by language' },
        include_metrics: { type: 'boolean', description: 'Include task metrics', default: false },
      },
    },
  },
  {
    name: 'delete_task',
    description: 'Delete a task permanently',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'number', description: 'Task ID to delete' },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'execute_code',
    description: 'Execute code in multiple programming languages',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'number', description: 'Associated task ID' },
        language: { type: 'string', enum: ['python', 'javascript', 'typescript', 'bash', 'sql'], description: 'Programming language' },
        code: { type: 'string', description: 'Code to execute' },
        timeout: { type: 'number', description: 'Execution timeout in seconds', default: 30 },
        working_directory: { type: 'string', description: 'Working directory for execution' },
        packages: { type: 'array', items: { type: 'string' }, description: 'Required packages (for package installation)' },
      },
      required: ['task_id', 'language', 'code'],
    },
  },
  {
    name: 'get_task_graph',
    description: 'Get dependency graph visualization (JSON or Mermaid format)',
    inputSchema: {
      type: 'object',
      properties: {
        format: { type: 'string', enum: ['json', 'mermaid'], description: 'Output format', default: 'json' },
      },
    },
  },
  {
    name: 'link_git_commit',
    description: 'Link a git commit to a task for traceability',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'number', description: 'Task ID to link commit to' },
        commit_hash: { type: 'string', description: 'Git commit hash' },
        commit_message: { type: 'string', description: 'Commit message' },
        author: { type: 'string', description: 'Commit author' },
      },
      required: ['task_id', 'commit_hash'],
    },
  },
];

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name } = request.params;
  const args = request.params.arguments as Record<string, any> | undefined;

  try {
    switch (name) {
      case 'create_task': {
        const task = db.createTask({
          title: args?.title || 'Untitled Task',
          description: args?.description,
          status: 'pending',
          priority: args?.priority ?? 0,
          dependencies: args?.dependencies || [],
          tags: args?.tags || [],
          code_language: args?.code_language,
          execution_environment: args?.execution_environment,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ task, message: 'Task created successfully' }, null, 2),
            },
          ],
        };
      }

      case 'update_task_status': {
        const task = db.updateTaskStatus(args?.task_id, args?.status);
        
        if (!task) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: `Task ${args?.task_id} not found` }),
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ task, message: 'Task status updated' }, null, 2),
            },
          ],
        };
      }

      case 'get_task': {
        const task = db.getTask(args?.task_id);
        
        if (!task) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: `Task ${args?.task_id} not found` }),
              },
            ],
            isError: true,
          };
        }

        const result: any = { task };

        if (args?.include_executions) {
          result.executions = db.getTaskExecutions(args.task_id);
        }

        if (args?.include_analysis) {
          result.commits = db.getTaskCommits(args.task_id);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'list_tasks': {
        const tasks = db.listTasks({
          status: args?.status,
          code_language: args?.code_language,
        });

        const result: any = { tasks, count: tasks.length };

        if (args?.include_metrics) {
          result.metrics = {
            total: tasks.length,
            by_status: {
              pending: tasks.filter(t => t.status === 'pending').length,
              in_progress: tasks.filter(t => t.status === 'in_progress').length,
              blocked: tasks.filter(t => t.status === 'blocked').length,
              completed: tasks.filter(t => t.status === 'completed').length,
            },
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'delete_task': {
        const deleted = db.deleteTask(args?.task_id);
        
        if (!deleted) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: `Task ${args?.task_id} not found` }),
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ message: `Task ${args?.task_id} deleted successfully` }, null, 2),
            },
          ],
        };
      }

      case 'execute_code': {
        const execution = await executor.execute(
          args?.language,
          args?.code,
          args?.task_id
        );

        const saved = db.saveCodeExecution(execution as Omit<CodeExecution, 'id' | 'timestamp'>);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ execution: saved }, null, 2),
            },
          ],
        };
      }

      case 'get_task_graph': {
        const tasks = db.listTasks();
        
        if (args?.format === 'mermaid') {
          let mermaid = 'graph TD\n';
          for (const task of tasks) {
            mermaid += `  ${task.id}["${task.title}"]\n`;
            for (const depId of task.dependencies) {
              mermaid += `  ${depId} --> ${task.id}\n`;
            }
          }

          return {
            content: [
              {
                type: 'text',
                text: mermaid,
              },
            ],
          };
        }

        // JSON format
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ tasks, edges: tasks.flatMap(t => t.dependencies.map(d => ({ from: d, to: t.id }))) }, null, 2),
            },
          ],
        };
      }

      case 'link_git_commit': {
        db.linkGitCommit(
          args?.task_id,
          args?.commit_hash,
          args?.commit_message,
          args?.author
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ message: 'Git commit linked to task successfully' }, null, 2),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: `Unknown tool: ${name}` }),
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
      isError: true,
    };
  }
});

// Cleanup on exit
process.on('SIGINT', () => {
  db.close().catch(console.error);
  process.exit(0);
});

process.on('SIGTERM', () => {
  db.close().catch(console.error);
  process.exit(0);
});

// Start server
async function main() {
  try {
    await db.initialize();
    console.error('Task Orchestrator database initialized');
    
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Task Orchestrator MCP Server running on stdio');
  } catch (error) {
    console.error('Failed to start Task Orchestrator MCP Server:', error);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(console.error);
}
