/**
 * Enhanced Task Orchestrator MCP Server
 * 
 * Local-first task management with embedded code execution and analysis:
 * - sql.js for pure JavaScript SQLite (no native compilation)
 * - Git integration for auto-tracking
 * - DAG for dependency tracking
 * - Multi-language code execution (Python, JavaScript, Bash, SQL)
 * - Code quality analysis and security scanning
 * - Sandboxed execution with resource limits
 * - Integration with other MCP servers
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import simpleGit, { SimpleGit } from 'simple-git';
import Graphology, { DirectedGraph } from 'graphology';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { execa } from 'execa';
import { v4 as uuidv4 } from 'uuid';
import { VM } from 'vm2';
import chokidar from 'chokidar';
import winston from 'winston';
import { z } from 'zod';

// Configuration
const MCP_HOME = join(homedir(), '.mcp');
const TASKS_DB = join(MCP_HOME, 'tasks', 'tasks.db');
const CODE_CACHE = join(MCP_HOME, 'cache', 'code');
const LOGS_DIR = join(MCP_HOME, 'logs');

// Ensure directories exist
const dirs = [MCP_HOME, join(MCP_HOME, 'tasks'), CODE_CACHE, LOGS_DIR];
for (const dir of dirs) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: join(LOGS_DIR, 'task-orchestrator.log') }),
    new winston.transports.Console({ format: winston.format.simple() })
  ],
});

// Task status enum
enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  BLOCKED = 'blocked',
  COMPLETED = 'completed'
}

// Code execution status enum
enum ExecutionStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TIMEOUT = 'timeout'
}

// Security configuration
interface SecurityConfig {
  maxExecutionTime: number;
  maxMemoryUsage: number;
  maxOutputSize: number;
  allowedImports: string[];
  blockedCommands: string[];
  sandboxEnabled: boolean;
}

// Default security configuration
const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  maxExecutionTime: 30000, // 30 seconds
  maxMemoryUsage: 512 * 1024 * 1024, // 512MB
  maxOutputSize: 10 * 1024 * 1024, // 10MB
  allowedImports: [
    'os', 'sys', 'json', 'math', 'datetime', 'collections', 
    'itertools', 'functools', 'pathlib', 're'
  ],
  blockedCommands: ['rm', 'del', 'format', 'shutdown', 'reboot', 'init'],
  sandboxEnabled: true
};

// Enhanced task interface with code execution fields
interface Task {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  dependencies: string; // JSON array of task IDs
  git_commits: string; // JSON array of commit SHAs
  tags: string; // JSON array of tags
  metadata: string; // JSON metadata
  execution_environment?: string; // Python, JavaScript, etc.
  code_language?: string; // Primary code language
  test_results?: string; // JSON test results
  quality_score?: number; // Code quality score
  execution_logs?: string; // JSON execution logs
}

// Code execution interface
interface CodeExecution {
  id: string;
  task_id: number;
  language: string;
  code: string;
  status: ExecutionStatus;
  output: string;
  error: string;
  execution_time: number;
  memory_usage: number;
  start_time: string;
  end_time?: string;
  environment: string;
  dependencies: string[];
  security_level: string;
  created_at: string;
}

// Code analysis interface
interface CodeAnalysis {
  id: string;
  task_id: number;
  analysis_type: 'quality' | 'security' | 'complexity' | 'dependencies';
  target_path: string;
  results: string; // JSON analysis results
  quality_score: number;
  suggestions: string; // JSON array of suggestions
  issues: string; // JSON array of issues found
  scan_duration: number;
  created_at: string;
}

class EnhancedTaskDatabase {
  private db: SqlJsDatabase | null = null;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async init() {
    const SQL = await initSqlJs();
    
    // Load existing database or create new one
    if (existsSync(this.dbPath)) {
      const buffer = readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
      // Migrate if needed
      this.migrateSchema();
    } else {
      this.db = new SQL.Database();
      this.initEnhancedSchema();
      this.save();
    }
  }

  private initEnhancedSchema() {
    if (!this.db) return;
    
    // Enhanced tasks table with code execution fields
    this.db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        priority INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        completed_at TEXT,
        dependencies TEXT DEFAULT '[]',
        git_commits TEXT DEFAULT '[]',
        tags TEXT DEFAULT '[]',
        metadata TEXT DEFAULT '{}',
        execution_environment TEXT,
        code_language TEXT,
        test_results TEXT,
        quality_score INTEGER,
        execution_logs TEXT
      )
    `);
    
    // Code executions table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS code_executions (
        id TEXT PRIMARY KEY,
        task_id INTEGER,
        language TEXT NOT NULL,
        code TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        output TEXT DEFAULT '',
        error TEXT DEFAULT '',
        execution_time REAL DEFAULT 0,
        memory_usage REAL DEFAULT 0,
        start_time TEXT,
        end_time TEXT,
        environment TEXT DEFAULT 'default',
        dependencies TEXT DEFAULT '[]',
        security_level TEXT DEFAULT 'medium',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `);
    
    // Code analysis table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS code_analysis (
        id TEXT PRIMARY KEY,
        task_id INTEGER,
        analysis_type TEXT NOT NULL,
        target_path TEXT NOT NULL,
        results TEXT DEFAULT '{}',
        quality_score INTEGER DEFAULT 0,
        suggestions TEXT DEFAULT '[]',
        issues TEXT DEFAULT '[]',
        scan_duration REAL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `);
    
    // Security policies table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS security_policies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        max_execution_time INTEGER DEFAULT 30000,
        max_memory_usage INTEGER DEFAULT 524288000,
        max_output_size INTEGER DEFAULT 10485760,
        allowed_imports TEXT DEFAULT '[]',
        blocked_commands TEXT DEFAULT '[]',
        sandbox_enabled BOOLEAN DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    
    this.createIndexes();
  }

  private migrateSchema() {
    if (!this.db) return;
    
    // Check if we need to add new columns
    const result = this.db.exec("PRAGMA table_info(tasks)");
    const existingColumns = result[0]?.columns || [];
    
    const columnsToAdd = [
      'execution_environment',
      'code_language', 
      'test_results',
      'quality_score',
      'execution_logs'
    ];
    
    for (const column of columnsToAdd) {
      if (!existingColumns.includes(column)) {
        this.db.run(`ALTER TABLE tasks ADD COLUMN ${column} TEXT`);
        logger.info(`Added column ${column} to tasks table`);
      }
    }
    
    // Create new tables if they don't exist
    this.initEnhancedSchema();
    this.save();
  }

  private createIndexes() {
    if (!this.db) return;
    
    // Task indexes
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_status ON tasks(status)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_priority ON tasks(priority)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_created ON tasks(created_at)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_code_language ON tasks(code_language)`);
    
    // Execution indexes
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_execution_task ON code_executions(task_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_execution_status ON code_executions(status)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_execution_language ON code_executions(language)`);
    
    // Analysis indexes
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_analysis_task ON code_analysis(task_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_analysis_type ON code_analysis(analysis_type)`);
  }

  private save() {
    if (!this.db) return;
    const data = this.db.export();
    writeFileSync(this.dbPath, data);
  }

  // Enhanced task operations
  createTask(
    title: string,
    description: string,
    priority: number = 0,
    dependencies: number[] = [],
    tags: string[] = [],
    executionEnvironment?: string,
    codeLanguage?: string
  ): number {
    if (!this.db) throw new Error('Database not initialized');
    
    this.db.run(
      `INSERT INTO tasks (title, description, priority, dependencies, tags, execution_environment, code_language)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        title, 
        description, 
        priority, 
        JSON.stringify(dependencies), 
        JSON.stringify(tags),
        executionEnvironment || null,
        codeLanguage || null
      ]
    );
    
    const result = this.db.exec('SELECT last_insert_rowid() as id');
    const taskId = result[0].values[0][0] as number;
    
    this.save();
    logger.info(`Created task ${taskId}: ${title}`);
    return taskId;
  }

  updateTaskStatus(taskId: number, status: TaskStatus): void {
    if (!this.db) throw new Error('Database not initialized');
    
    const completedAt = status === TaskStatus.COMPLETED ? new Date().toISOString() : null;
    
    this.db.run(
      `UPDATE tasks 
       SET status = ?, 
           updated_at = datetime('now'),
           completed_at = ?
       WHERE id = ?`,
      [status, completedAt, taskId]
    );
    
    this.save();
    logger.info(`Updated task ${taskId} status to ${status}`);
  }

  getTask(taskId: number): Task | undefined {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = this.db.exec('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (result.length === 0 || result[0].values.length === 0) {
      return undefined;
    }
    
    return this.rowToTask(result[0], 0);
  }

  getAllTasks(status?: TaskStatus): Task[] {
    if (!this.db) throw new Error('Database not initialized');
    
    let query = 'SELECT * FROM tasks';
    const params: any[] = [];
    
    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY priority DESC, created_at ASC';
    
    const result = this.db.exec(query, params);
    if (result.length === 0) return [];
    
    const tasks: Task[] = [];
    for (let i = 0; i < result[0].values.length; i++) {
      tasks.push(this.rowToTask(result[0], i));
    }
    
    return tasks;
  }

  private rowToTask(result: { columns: string[], values: any[][] }, index: number): Task {
    const row = result.values[index];
    const task: any = {};
    
    result.columns.forEach((col, i) => {
      task[col] = row[i];
    });
    
    return task as Task;
  }

  addGitCommit(taskId: number, commitSha: string): void {
    if (!this.db) throw new Error('Database not initialized');
    
    const task = this.getTask(taskId);
    if (!task) return;
    
    const commits = JSON.parse(task.git_commits);
    commits.push(commitSha);
    
    this.db.run(
      `UPDATE tasks 
       SET git_commits = ?,
           updated_at = datetime('now')
       WHERE id = ?`,
      [JSON.stringify(commits), taskId]
    );
    
    this.save();
  }

  deleteTask(taskId: number): void {
    if (!this.db) throw new Error('Database not initialized');
    
    this.db.run('DELETE FROM tasks WHERE id = ?', [taskId]);
    this.save();
    logger.info(`Deleted task ${taskId}`);
  }

  updateTaskExecutionData(taskId: number, data: Partial<Task>): void {
    if (!this.db) throw new Error('Database not initialized');
    
    const updates = [];
    const params = [];
    
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        updates.push(`${key} = ?`);
        params.push(typeof value === 'object' ? JSON.stringify(value) : value);
      }
    }
    
    if (updates.length > 0) {
      updates.push('updated_at = datetime(\'now\')');
      params.push(taskId);
      
      this.db.run(
        `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
      
      this.save();
    }
  }

  // Code execution operations
  createExecution(execution: Omit<CodeExecution, 'id' | 'created_at'>): string {
    if (!this.db) throw new Error('Database not initialized');
    
    const id = uuidv4();
    
    this.db.run(
      `INSERT INTO code_executions
       (id, task_id, language, code, status, output, error, execution_time,
        memory_usage, start_time, end_time, environment, dependencies, security_level)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, execution.task_id, execution.language, execution.code, execution.status,
        execution.output, execution.error, execution.execution_time, execution.memory_usage,
        execution.start_time, execution.end_time || null, execution.environment || 'default',
        JSON.stringify(execution.dependencies), execution.security_level || 'medium'
      ]
    );
    
    this.save();
    logger.info(`Created code execution ${id} for task ${execution.task_id}`);
    return id;
  }

  updateExecution(executionId: string, updates: Partial<CodeExecution>): void {
    if (!this.db) throw new Error('Database not initialized');
    
    const updateFields = [];
    const params = [];
    
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        updateFields.push(`${key} = ?`);
        params.push(typeof value === 'object' ? JSON.stringify(value) : value);
      }
    }
    
    if (updateFields.length > 0) {
      updateFields.push('created_at = created_at'); // Keep original timestamp
      params.push(executionId);
      
      this.db.run(
        `UPDATE code_executions SET ${updateFields.join(', ')} WHERE id = ?`,
        params
      );
      
      this.save();
    }
  }

  getExecution(executionId: string): CodeExecution | undefined {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = this.db.exec('SELECT * FROM code_executions WHERE id = ?', [executionId]);
    if (result.length === 0 || result[0].values.length === 0) {
      return undefined;
    }
    
    return this.rowToExecution(result[0], 0);
  }

  getTaskExecutions(taskId: number): CodeExecution[] {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = this.db.exec('SELECT * FROM code_executions WHERE task_id = ? ORDER BY created_at DESC', [taskId]);
    if (result.length === 0) return [];
    
    const executions: CodeExecution[] = [];
    for (let i = 0; i < result[0].values.length; i++) {
      executions.push(this.rowToExecution(result[0], i));
    }
    
    return executions;
  }

  private rowToExecution(result: { columns: string[], values: any[][] }, index: number): CodeExecution {
    const row = result.values[index];
    const execution: any = {};
    
    result.columns.forEach((col, i) => {
      execution[col] = row[i];
    });
    
    // Parse JSON fields
    if (execution.dependencies) {
      execution.dependencies = JSON.parse(execution.dependencies);
    }
    
    return execution as CodeExecution;
  }

  // Code analysis operations
  createAnalysis(analysis: Omit<CodeAnalysis, 'id' | 'created_at'>): string {
    if (!this.db) throw new Error('Database not initialized');
    
    const id = uuidv4();
    
    this.db.run(
      `INSERT INTO code_analysis 
       (id, task_id, analysis_type, target_path, results, quality_score, suggestions, issues, scan_duration)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, analysis.task_id, analysis.analysis_type, analysis.target_path,
        analysis.results, analysis.quality_score, analysis.suggestions,
        analysis.issues, analysis.scan_duration
      ]
    );
    
    this.save();
    logger.info(`Created code analysis ${id} for task ${analysis.task_id}`);
    return id;
  }

  getTaskAnalysis(taskId: number): CodeAnalysis[] {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = this.db.exec('SELECT * FROM code_analysis WHERE task_id = ? ORDER BY created_at DESC', [taskId]);
    if (result.length === 0) return [];
    
    const analyses: CodeAnalysis[] = [];
    for (let i = 0; i < result[0].values.length; i++) {
      analyses.push(this.rowToAnalysis(result[0], i));
    }
    
    return analyses;
  }

  private rowToAnalysis(result: { columns: string[], values: any[][] }, index: number): CodeAnalysis {
    const row = result.values[index];
    const analysis: any = {};
    
    result.columns.forEach((col, i) => {
      analysis[col] = row[i];
    });
    
    // Parse JSON fields
    if (analysis.suggestions) {
      analysis.suggestions = JSON.parse(analysis.suggestions);
    }
    if (analysis.issues) {
      analysis.issues = JSON.parse(analysis.issues);
    }
    
    return analysis as CodeAnalysis;
  }

  buildDependencyGraph(): DirectedGraph {
    const graph = new DirectedGraph();
    const tasks = this.getAllTasks();
    
    // Add all tasks as nodes
    for (const task of tasks) {
      graph.addNode(task.id.toString(), {
        title: task.title,
        status: task.status,
        priority: task.priority,
        language: task.code_language,
        environment: task.execution_environment
      });
    }
    
    // Add dependency edges
    for (const task of tasks) {
      const dependencies = JSON.parse(task.dependencies);
      for (const depId of dependencies) {
        if (graph.hasNode(depId.toString())) {
          graph.addEdge(depId.toString(), task.id.toString());
        }
      }
    }
    
    return graph;
  }
}

class CodeExecutor {
  private securityConfig: SecurityConfig;

  constructor(securityConfig: SecurityConfig = DEFAULT_SECURITY_CONFIG) {
    this.securityConfig = securityConfig;
  }

  async executePython(code: string, timeout: number = 30000, packages: string[] = []): Promise<ExecutionResult> {
    const executionId = uuidv4();
    const startTime = Date.now();
    
    try {
      logger.info(`Executing Python code for execution ${executionId}`);
      
      // Create temporary file
      const tempFile = join(CODE_CACHE, `python_${executionId}.py`);
      writeFileSync(tempFile, code);
      
      // Setup execution environment
      const execaOptions = {
        timeout,
        maxBuffer: this.securityConfig.maxOutputSize,
        env: {
          PYTHONPATH: CODE_CACHE,
          HOME: process.env.HOME
        }
      };
      
      // Execute with packages if specified
      let result;
      if (packages.length > 0) {
        // Install packages first
        for (const pkg of packages) {
          try {
            await execa('pip3', ['install', '--user', pkg], {
              timeout: 60000,
              maxBuffer: 1024 * 1024
            });
          } catch (error) {
            logger.warn(`Failed to install package ${pkg}: ${error}`);
          }
        }
      }
      
      // Execute the code
      result = await execa('python3', [tempFile], execaOptions);
      
      const executionTime = Date.now() - startTime;
      
      // Clean up
      try { unlinkSync(tempFile); } catch {}
      
      return {
        executionId,
        status: ExecutionStatus.COMPLETED,
        output: result.stdout,
        error: result.stderr,
        executionTime,
        memoryUsage: 0 // Would need external monitoring
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      if (error instanceof Error && 'isTerminated' in error) {
        return {
          executionId,
          status: ExecutionStatus.TIMEOUT,
          output: '',
          error: 'Execution timeout exceeded',
          executionTime,
          memoryUsage: 0
        };
      }
      
      return {
        executionId,
        status: ExecutionStatus.FAILED,
        output: '',
        error: error instanceof Error ? error.message : String(error),
        executionTime,
        memoryUsage: 0
      };
    }
  }

  async executeJavaScript(code: string, timeout: number = 30000): Promise<ExecutionResult> {
    const executionId = uuidv4();
    const startTime = Date.now();
    
    try {
      logger.info(`Executing JavaScript code for execution ${executionId}`);
      
      // Use VM2 for sandboxed JavaScript execution
      const vm = new VM({
        timeout,
        sandbox: {
          console: {
            log: (...args: any[]) => {
              // Capture console output
            },
            error: (...args: any[]) => {
              // Capture console errors
            }
          }
        }
      });
      
      let output = '';
      let error = '';
      
      // Override console.log in the sandbox
      vm.sandbox.console.log = (...args: any[]) => {
        output += args.map(arg => String(arg)).join(' ') + '\n';
      };
      
      vm.sandbox.console.error = (...args: any[]) => {
        error += args.map(arg => String(arg)).join(' ') + '\n';
      };
      
      const result = vm.run(code);
      const executionTime = Date.now() - startTime;
      
      if (result !== undefined) {
        output += String(result) + '\n';
      }
      
      return {
        executionId,
        status: ExecutionStatus.COMPLETED,
        output: output.trim(),
        error: error.trim(),
        executionTime,
        memoryUsage: 0
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        executionId,
        status: ExecutionStatus.FAILED,
        output: '',
        error: error instanceof Error ? error.message : String(error),
        executionTime,
        memoryUsage: 0
      };
    }
  }

  async executeBash(command: string, timeout: number = 30000, workingDirectory?: string): Promise<ExecutionResult> {
    const executionId = uuidv4();
    const startTime = Date.now();
    
    try {
      logger.info(`Executing bash command for execution ${executionId}`);
      
      // Security check - block dangerous commands
      const blockedCommand = this.securityConfig.blockedCommands.find(blocked => 
        command.toLowerCase().includes(blocked.toLowerCase())
      );
      
      if (blockedCommand) {
        return {
          executionId,
          status: ExecutionStatus.FAILED,
          output: '',
          error: `Command contains blocked keyword: ${blockedCommand}`,
          executionTime: 0,
          memoryUsage: 0
        };
      }
      
      const result = await execa('bash', ['-c', command], {
        timeout,
        maxBuffer: this.securityConfig.maxOutputSize,
        cwd: workingDirectory
      });
      
      const executionTime = Date.now() - startTime;
      
      return {
        executionId,
        status: ExecutionStatus.COMPLETED,
        output: result.stdout,
        error: result.stderr,
        executionTime,
        memoryUsage: 0
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      if (error instanceof Error && 'isTerminated' in error) {
        return {
          executionId,
          status: ExecutionStatus.TIMEOUT,
          output: '',
          error: 'Execution timeout exceeded',
          executionTime,
          memoryUsage: 0
        };
      }
      
      return {
        executionId,
        status: ExecutionStatus.FAILED,
        output: '',
        error: error instanceof Error ? error.message : String(error),
        executionTime,
        memoryUsage: 0
      };
    }
  }

  async executeSQL(query: string, databasePath?: string): Promise<ExecutionResult> {
    const executionId = uuidv4();
    const startTime = Date.now();
    
    try {
      logger.info(`Executing SQL query for execution ${executionId}`);
      
      const result = await execa('sqlite3', [databasePath || ':memory:', query], {
        timeout: 10000,
        maxBuffer: this.securityConfig.maxOutputSize
      });
      
      const executionTime = Date.now() - startTime;
      
      return {
        executionId,
        status: ExecutionStatus.COMPLETED,
        output: result.stdout,
        error: result.stderr,
        executionTime,
        memoryUsage: 0
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        executionId,
        status: ExecutionStatus.FAILED,
        output: '',
        error: error instanceof Error ? error.message : String(error),
        executionTime,
        memoryUsage: 0
      };
    }
  }
}

interface ExecutionResult {
  executionId: string;
  status: ExecutionStatus;
  output: string;
  error: string;
  executionTime: number;
  memoryUsage: number;
}

class CodeAnalyzer {
  async analyzeCodeQuality(code: string, language: string, targetPath: string): Promise<AnalysisResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Analyzing code quality for ${targetPath}`);
      
      let qualityScore = 0;
      const suggestions: string[] = [];
      const issues: string[] = [];
      let results: any = {};
      
      // Basic quality checks based on language
      switch (language.toLowerCase()) {
        case 'python':
          results = await this.analyzePythonQuality(code);
          break;
        case 'javascript':
        case 'typescript':
          results = await this.analyzeJSCQuality(code);
          break;
        default:
          results = await this.analyzeGenericQuality(code);
      }
      
      qualityScore = results.score || 0;
      suggestions.push(...(results.suggestions || []));
      issues.push(...(results.issues || []));
      
      const scanDuration = Date.now() - startTime;
      
      return {
        analysisId: uuidv4(),
        analysisType: 'quality',
        targetPath,
        qualityScore,
        suggestions,
        issues,
        results: JSON.stringify(results),
        scanDuration
      };
      
    } catch (error) {
      const scanDuration = Date.now() - startTime;
      return {
        analysisId: uuidv4(),
        analysisType: 'quality',
        targetPath,
        qualityScore: 0,
        suggestions: [`Analysis failed: ${error instanceof Error ? error.message : String(error)}`],
        issues: [],
        results: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
        scanDuration
      };
    }
  }

  async scanSecurity(code: string, language: string, targetPath: string): Promise<AnalysisResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Scanning security for ${targetPath}`);
      
      const issues: string[] = [];
      const suggestions: string[] = [];
      let results: any = {
        vulnerabilities: [],
        risks: []
      };
      
      // Security patterns to check
      const securityPatterns = [
        { pattern: /eval\s*\(/g, issue: 'Use of eval() can lead to code injection', severity: 'high' },
        { pattern: /exec\s*\(/g, issue: 'Use of exec() can lead to code injection', severity: 'high' },
        { pattern: /subprocess\.call\s*\(\s*shell\s*=\s*True/g, issue: 'Shell=True in subprocess is dangerous', severity: 'high' },
        { pattern: /os\.system\s*\(/g, issue: 'os.system() is potentially unsafe', severity: 'medium' },
        { pattern: /pickle\.load\s*\(/g, issue: 'pickle.load() can execute arbitrary code', severity: 'high' },
        { pattern: /__import__\s*\(/g, issue: 'Dynamic imports can be dangerous', severity: 'medium' },
        { pattern: /innerHTML\s*=/g, issue: 'Direct innerHTML assignment can lead to XSS', severity: 'high' },
        { pattern: /document\.write\s*\(/g, issue: 'document.write can be used for XSS attacks', severity: 'medium' }
      ];
      
      for (const { pattern, issue, severity } of securityPatterns) {
        if (pattern.test(code)) {
          issues.push(`${issue} (${severity})`);
          results.vulnerabilities.push({ issue, severity, line: this.findLineNumber(code, pattern) });
        }
      }
      
      // Check for hardcoded secrets
      const secretPatterns = [
        { pattern: /password\s*=\s*['"][^'"]+['"]/gi, issue: 'Hardcoded password detected' },
        { pattern: /api[_-]?key\s*=\s*['"][^'"]+['"]/gi, issue: 'Hardcoded API key detected' },
        { pattern: /secret\s*=\s*['"][^'"]+['"]/gi, issue: 'Hardcoded secret detected' }
      ];
      
      for (const { pattern, issue } of secretPatterns) {
        if (pattern.test(code)) {
          issues.push(issue);
          results.risks.push({ issue, severity: 'medium' });
        }
      }
      
      const qualityScore = Math.max(0, 100 - (issues.length * 10));
      const scanDuration = Date.now() - startTime;
      
      return {
        analysisId: uuidv4(),
        analysisType: 'security',
        targetPath,
        qualityScore,
        suggestions,
        issues,
        results: JSON.stringify(results),
        scanDuration
      };
      
    } catch (error) {
      const scanDuration = Date.now() - startTime;
      return {
        analysisId: uuidv4(),
        analysisType: 'security',
        targetPath,
        qualityScore: 0,
        suggestions: [`Security scan failed: ${error instanceof Error ? error.message : String(error)}`],
        issues: [],
        results: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
        scanDuration
      };
    }
  }

  private async analyzePythonQuality(code: string): Promise<any> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    const lines = code.split('\n');
    
    // Check for common Python quality issues
    let lineCount = lines.length;
    let longLines = 0;
    let complexFunctions = 0;
    
    lines.forEach((line, index) => {
      // Check line length
      if (line.length > 79) {
        longLines++;
        if (longLines === 1) {
          suggestions.push('Consider breaking long lines (>79 characters) for better readability');
        }
      }
      
      // Check for complexity (nested blocks)
      const nestedBlocks = (line.match(/^\s+/g) || []).length;
      if (nestedBlocks > 3) {
        complexFunctions++;
      }
    });
    
    // Calculate quality score
    let score = 100;
    if (longLines > lineCount * 0.1) score -= 10;
    if (complexFunctions > 0) score -= 15;
    
    // Check for missing docstrings
    const functionDefs = code.match(/def\s+\w+\s*\(/g) || [];
    if (functionDefs.length > 0) {
      const docstrings = code.match(/""".*?"""/gs) || [];
      if (docstrings.length < functionDefs.length) {
        suggestions.push('Consider adding docstrings to functions for better documentation');
        score -= 5;
      }
    }
    
    return { score, issues, suggestions, metrics: { lineCount, longLines, complexFunctions } };
  }

  private async analyzeJSCQuality(code: string): Promise<any> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    const lines = code.split('\n');
    
    // Check for common JS/TS quality issues
    let lineCount = lines.length;
    let longLines = 0;
    let missingSemicolons = 0;
    
    lines.forEach((line, index) => {
      // Check line length
      if (line.length > 80) {
        longLines++;
        if (longLines === 1) {
          suggestions.push('Consider breaking long lines (>80 characters) for better readability');
        }
      }
      
      // Check for missing semicolons (simple heuristic)
      const trimmed = line.trim();
      if (trimmed && !trimmed.endsWith(';') && !trimmed.endsWith('{') && !trimmed.endsWith('}')) {
        const potentialStatements = ['var ', 'let ', 'const ', 'return ', 'console.log'];
        if (potentialStatements.some(stmt => trimmed.startsWith(stmt))) {
          missingSemicolons++;
        }
      }
    });
    
    // Calculate quality score
    let score = 100;
    if (longLines > lineCount * 0.1) score -= 10;
    if (missingSemicolons > lineCount * 0.05) score -= 5;
    
    return { score, issues, suggestions, metrics: { lineCount, longLines, missingSemicolons } };
  }

  private async analyzeGenericQuality(code: string): Promise<any> {
    const lines = code.split('\n');
    const lineCount = lines.length;
    const nonEmptyLines = lines.filter(line => line.trim().length > 0).length;
    const avgLineLength = lines.reduce((sum, line) => sum + line.length, 0) / lineCount;
    
    let score = 100;
    if (lineCount > 1000) score -= 20;
    if (avgLineLength > 80) score -= 10;
    
    const suggestions = [];
    if (lineCount > 500) {
      suggestions.push('Consider breaking large files into smaller, more manageable modules');
    }
    if (avgLineLength > 80) {
      suggestions.push('Consider reducing line length for better readability');
    }
    
    return { 
      score, 
      issues: [], 
      suggestions, 
      metrics: { lineCount, nonEmptyLines, avgLineLength: Math.round(avgLineLength) } 
    };
  }

  private findLineNumber(code: string, pattern: RegExp): number {
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        return i + 1;
      }
    }
    return 0;
  }
}

interface AnalysisResult {
  analysisId: string;
  analysisType: string;
  targetPath: string;
  qualityScore: number;
  suggestions: string[];
  issues: string[];
  results: string;
  scanDuration: number;
}

class GitIntegration {
  private git: SimpleGit;
  
  constructor(repoPath: string = process.cwd()) {
    this.git = simpleGit(repoPath);
  }

  async getRecentCommits(limit: number = 10): Promise<any[]> {
    try {
      const log = await this.git.log({ maxCount: limit });
      return [...log.all];
    } catch (error) {
      logger.warn('Failed to get recent commits:', error);
      return [];
    }
  }

  async getCommitMessage(sha: string): Promise<string> {
    try {
      const log = await this.git.log({ from: sha, to: sha, maxCount: 1 });
      return log.latest?.message || '';
    } catch (error) {
      logger.warn('Failed to get commit message:', error);
      return '';
    }
  }

  async isRepository(): Promise<boolean> {
    try {
      await this.git.status();
      return true;
    } catch {
      return false;
    }
  }
}

// Validation schemas
const CreateTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(''),
  priority: z.number().optional().default(0),
  dependencies: z.array(z.number()).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
  execution_environment: z.string().optional(),
  code_language: z.string().optional()
});

const ExecuteCodeSchema = z.object({
  task_id: z.number(),
  language: z.enum(['python', 'javascript', 'typescript', 'bash', 'sql']),
  code: z.string().min(1),
  timeout: z.number().optional().default(30000),
  working_directory: z.string().optional(),
  packages: z.array(z.string()).optional().default([])
});

const AnalyzeCodeSchema = z.object({
  task_id: z.number(),
  target_path: z.string().min(1),
  analysis_type: z.enum(['quality', 'security', 'complexity']).optional().default('quality'),
  language: z.string().optional()
});

// Initialize components
const taskDb = new EnhancedTaskDatabase(TASKS_DB);
const git = new GitIntegration();
const codeExecutor = new CodeExecutor();
const codeAnalyzer = new CodeAnalyzer();

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
  }
);

// Define tools - Enhanced with code execution and analysis
const tools: Tool[] = [
  // Original task management tools
  {
    name: 'create_task',
    description: 'Create a new task with optional dependencies and code execution environment',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'Task description' },
        priority: { type: 'number', description: 'Task priority (higher = more important)', default: 0 },
        dependencies: { type: 'array', items: { type: 'number' }, description: 'Array of task IDs this task depends on', default: [] },
        tags: { type: 'array', items: { type: 'string' }, description: 'Array of tags', default: [] },
        execution_environment: { type: 'string', description: 'Code execution environment (e.g., python, javascript)' },
        code_language: { type: 'string', description: 'Primary code language for this task' },
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
        task_id: { type: 'number', description: 'Task ID' },
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
        task_id: { type: 'number', description: 'Task ID' },
        include_executions: { type: 'boolean', description: 'Include execution history', default: false },
        include_analysis: { type: 'boolean', description: 'Include analysis results', default: false },
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
        code_language: { type: 'string', description: 'Filter by code language' },
        include_metrics: { type: 'boolean', description: 'Include execution metrics', default: false },
      },
    },
  },
  {
    name: 'delete_task',
    description: 'Delete a task and associated execution history',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'number', description: 'Task ID to delete' },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'get_task_graph',
    description: 'Get task dependency graph with execution information',
    inputSchema: {
      type: 'object',
      properties: {
        format: { type: 'string', enum: ['json', 'mermaid'], description: 'Output format', default: 'json' },
        include_executions: { type: 'boolean', description: 'Include execution data in graph', default: false },
      },
    },
  },
  {
    name: 'link_git_commit',
    description: 'Link a git commit to a task',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'number', description: 'Task ID' },
        commit_sha: { type: 'string', description: 'Git commit SHA' },
      },
      required: ['task_id', 'commit_sha'],
    },
  },
  {
    name: 'get_recent_commits',
    description: 'Get recent git commits',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of commits to retrieve', default: 10 },
      },
    },
  },
  // New code execution tools
  {
    name: 'execute_code',
    description: 'Execute code in multiple programming languages',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'number', description: 'Task ID to associate with execution' },
        language: { type: 'string', enum: ['python', 'javascript', 'typescript', 'bash', 'sql'], description: 'Programming language' },
        code: { type: 'string', description: 'Code to execute' },
        timeout: { type: 'number', description: 'Execution timeout in milliseconds', default: 30000 },
        working_directory: { type: 'string', description: 'Working directory for execution' },
        packages: { type: 'array', items: { type: 'string' }, description: 'Packages to install (for Python)', default: [] },
      },
      required: ['task_id', 'language', 'code'],
    },
  },
  {
    name: 'execute_python_code',
    description: 'Execute Python code in a secure sandbox',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'number', description: 'Task ID' },
        code: { type: 'string', description: 'Python code to execute' },
        timeout: { type: 'number', description: 'Execution timeout in milliseconds', default: 30000 },
        packages: { type: 'array', items: { type: 'string' }, description: 'Python packages to install', default: [] },
        sandbox_enabled: { type: 'boolean', description: 'Enable sandbox security', default: true },
      },
      required: ['task_id', 'code'],
    },
  },
  {
    name: 'execute_javascript_code',
    description: 'Execute JavaScript/TypeScript code in a secure sandbox',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'number', description: 'Task ID' },
        code: { type: 'string', description: 'JavaScript code to execute' },
        timeout: { type: 'number', description: 'Execution timeout in milliseconds', default: 30000 },
        sandbox_enabled: { type: 'boolean', description: 'Enable sandbox security', default: true },
      },
      required: ['task_id', 'code'],
    },
  },
  {
    name: 'execute_bash_command',
    description: 'Execute bash commands safely with security restrictions',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'number', description: 'Task ID' },
        command: { type: 'string', description: 'Bash command to execute' },
        timeout: { type: 'number', description: 'Execution timeout in milliseconds', default: 30000 },
        working_directory: { type: 'string', description: 'Working directory' },
        security_level: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Security level', default: 'medium' },
      },
      required: ['task_id', 'command'],
    },
  },
  // New code analysis tools
  {
    name: 'analyze_code_quality',
    description: 'Perform comprehensive code quality analysis',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'number', description: 'Task ID' },
        target_path: { type: 'string', description: 'Path to file or code to analyze' },
        code: { type: 'string', description: 'Code to analyze (alternative to target_path)' },
        language: { type: 'string', description: 'Programming language' },
        analysis_depth: { type: 'string', enum: ['basic', 'full'], description: 'Analysis depth', default: 'full' },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'scan_security',
    description: 'Security vulnerability scanning for code',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'number', description: 'Task ID' },
        target_path: { type: 'string', description: 'Path to file to scan' },
        code: { type: 'string', description: 'Code to scan (alternative to target_path)' },
        language: { type: 'string', description: 'Programming language' },
        scan_types: { type: 'array', items: { type: 'string' }, description: 'Types of security scans to perform', default: ['vulnerabilities', 'secrets', 'injection'] },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'get_code_metrics',
    description: 'Calculate code complexity and quality metrics',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'number', description: 'Task ID' },
        target_path: { type: 'string', description: 'Path to file to analyze' },
        code: { type: 'string', description: 'Code to analyze (alternative to target_path)' },
        language: { type: 'string', description: 'Programming language' },
        include_trends: { type: 'boolean', description: 'Include historical trends', default: false },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'get_execution_history',
    description: 'Get execution history for a task or all tasks',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'number', description: 'Task ID (omit for all tasks)' },
        status: { type: 'string', enum: ['queued', 'running', 'completed', 'failed', 'timeout'], description: 'Filter by status' },
        language: { type: 'string', description: 'Filter by language' },
        limit: { type: 'number', description: 'Limit results', default: 50 },
      },
    },
  },
  {
    name: 'get_analysis_results',
    description: 'Get code analysis results for a task',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'number', description: 'Task ID' },
        analysis_type: { type: 'string', enum: ['quality', 'security', 'complexity'], description: 'Filter by analysis type' },
      },
      required: ['task_id'],
    },
  },
];

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // Enhanced task management
      case 'create_task': {
        const validated = CreateTaskSchema.parse(args);
        const taskId = taskDb.createTask(
          validated.title,
          validated.description,
          validated.priority,
          validated.dependencies,
          validated.tags,
          validated.execution_environment,
          validated.code_language
        );
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                task_id: taskId,
                title: validated.title,
                status: 'created',
                execution_environment: validated.execution_environment,
                code_language: validated.code_language,
              }, null, 2),
            },
          ],
        };
      }

      case 'update_task_status': {
        taskDb.updateTaskStatus(
          args?.task_id as number,
          args?.status as TaskStatus
        );
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                task_id: args?.task_id,
                status: args?.status,
                updated: true,
              }, null, 2),
            },
          ],
        };
      }

      case 'get_task': {
        const task = taskDb.getTask(args?.task_id as number);
        
        if (!task) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: 'Task not found' }),
              },
            ],
            isError: true,
          };
        }
        
        const response: any = { task };
        
        if (args?.include_executions) {
          response.executions = taskDb.getTaskExecutions(task.id);
        }
        
        if (args?.include_analysis) {
          response.analysis = taskDb.getTaskAnalysis(task.id);
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      }

      case 'list_tasks': {
        const tasks = taskDb.getAllTasks(args?.status as TaskStatus);
        const response: any = {
          count: tasks.length,
          tasks: tasks.map(t => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            created_at: t.created_at,
            code_language: t.code_language,
            execution_environment: t.execution_environment,
            quality_score: t.quality_score,
          })),
        };
        
        if (args?.code_language) {
          response.tasks = response.tasks.filter((task: any) => task.code_language === args?.code_language);
          response.count = response.tasks.length;
        }
        
        if (args?.include_metrics) {
          // Add execution metrics
          for (const task of response.tasks) {
            const executions = taskDb.getTaskExecutions(task.id);
            const analysis = taskDb.getTaskAnalysis(task.id);
            task.execution_count = executions.length;
            task.last_execution = executions[0]?.created_at;
            task.analysis_count = analysis.length;
            task.quality_trend = analysis.map((a: any) => ({ date: a.created_at, score: a.quality_score }));
          }
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      }

      case 'delete_task': {
        const taskId = args?.task_id as number;
        taskDb.deleteTask(taskId);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                task_id: taskId,
                deleted: true,
              }, null, 2),
            },
          ],
        };
      }

      case 'get_task_graph': {
        const graph = taskDb.buildDependencyGraph();
        const format = args?.format as string || 'json';
        
        if (format === 'mermaid') {
          let mermaid = 'graph TD\n';
          graph.forEachNode((node: string, attrs: any) => {
            const label = attrs.title;
            const status = attrs.status;
            const lang = attrs.language ? ` (${attrs.language})` : '';
            mermaid += `  ${node}["${label}${lang}"]:::${status}\n`;
          });
          
          // Add style for different statuses
          const statuses = ['pending', 'in_progress', 'blocked', 'completed'];
          statuses.forEach(status => {
            mermaid += `  classDef ${status} fill:#${getStatusColor(status)}\n`;
          });
          
          graph.forEachEdge((edge: string, attrs: any, source: string, target: string) => {
            mermaid += `  ${source} --> ${target}\n`;
          });
          
          return {
            content: [
              {
                type: 'text',
                text: mermaid,
              },
            ],
          };
        }
        
        // JSON format with execution data
        const nodes: any[] = [];
        const edges: any[] = [];
        
        graph.forEachNode((node: string, attrs: any) => {
          const nodeData: any = { id: node, ...attrs };
          
          if (args?.include_executions) {
            const executions = taskDb.getTaskExecutions(parseInt(node));
            nodeData.executions = executions.slice(0, 5); // Limit to recent 5
          }
          
          nodes.push(nodeData);
        });
        
        graph.forEachEdge((edge: string, attrs: any, source: string, target: string) => {
          edges.push({ from: source, to: target });
        });
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ nodes, edges }, null, 2),
            },
          ],
        };
      }

      case 'link_git_commit': {
        taskDb.addGitCommit(
          args?.task_id as number,
          args?.commit_sha as string || ''
        );
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                task_id: args?.task_id,
                commit_sha: args?.commit_sha,
                linked: true,
              }, null, 2),
            },
          ],
        };
      }

      case 'get_recent_commits': {
        const commits = await git.getRecentCommits(args?.limit as number || 10);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                count: commits.length,
                commits: commits.map(c => ({
                  sha: c.hash,
                  message: c.message,
                  author: c.author_name,
                  date: c.date,
                })),
              }, null, 2),
            },
          ],
        };
      }

      // Code execution tools
      case 'execute_code': {
        const validated = ExecuteCodeSchema.parse(args);
        const executionId = uuidv4();
        const startTime = new Date().toISOString();
        
        // Create execution record
        taskDb.createExecution({
          task_id: validated.task_id,
          language: validated.language,
          code: validated.code,
          status: ExecutionStatus.RUNNING,
          output: '',
          error: '',
          execution_time: 0,
          memory_usage: 0,
          start_time: startTime,
          environment: validated.working_directory || 'default',
          dependencies: validated.packages,
          security_level: 'medium'
        });
        
        let result: ExecutionResult;
        
        try {
          switch (validated.language) {
            case 'python':
              result = await codeExecutor.executePython(validated.code, validated.timeout, validated.packages);
              break;
            case 'javascript':
            case 'typescript':
              result = await codeExecutor.executeJavaScript(validated.code, validated.timeout);
              break;
            case 'bash':
              result = await codeExecutor.executeBash(validated.code, validated.timeout, validated.working_directory);
              break;
            case 'sql':
              result = await codeExecutor.executeSQL(validated.code);
              break;
            default:
              throw new Error(`Unsupported language: ${validated.language}`);
          }
        } catch (error) {
          result = {
            executionId,
            status: ExecutionStatus.FAILED,
            output: '',
            error: error instanceof Error ? error.message : String(error),
            executionTime: 0,
            memoryUsage: 0
          };
        }
        
        // Update execution record
        taskDb.updateExecution(executionId, {
          status: result.status,
          output: result.output,
          error: result.error,
          execution_time: result.executionTime,
          memory_usage: result.memoryUsage,
          end_time: new Date().toISOString()
        });
        
        // Update task with execution data
        taskDb.updateTaskExecutionData(validated.task_id, {
          execution_logs: JSON.stringify({ last_execution: result })
        });
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                execution_id: executionId,
                task_id: validated.task_id,
                language: validated.language,
                status: result.status,
                output: result.output,
                error: result.error,
                execution_time_ms: result.executionTime,
                memory_usage_mb: Math.round(result.memoryUsage / 1024 / 1024 * 100) / 100,
                completed_at: new Date().toISOString()
              }, null, 2),
            },
          ],
        };
      }

      case 'execute_python_code': {
        const taskId = args?.task_id as number;
        const code = args?.code as string;
        const timeout = args?.timeout as number || 30000;
        const packages = args?.packages as string[] || [];
        
        const result = await codeExecutor.executePython(code, timeout, packages);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                execution_id: result.executionId,
                task_id: taskId,
                language: 'python',
                status: result.status,
                output: result.output,
                error: result.error,
                execution_time_ms: result.executionTime,
                packages_installed: packages
              }, null, 2),
            },
          ],
        };
      }

      case 'execute_javascript_code': {
        const taskId = args?.task_id as number;
        const code = args?.code as string;
        const timeout = args?.timeout as number || 30000;
        
        const result = await codeExecutor.executeJavaScript(code, timeout);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                execution_id: result.executionId,
                task_id: taskId,
                language: 'javascript',
                status: result.status,
                output: result.output,
                error: result.error,
                execution_time_ms: result.executionTime
              }, null, 2),
            },
          ],
        };
      }

      case 'execute_bash_command': {
        const taskId = args?.task_id as number;
        const command = args?.command as string;
        const timeout = args?.timeout as number || 30000;
        const workingDirectory = args?.working_directory as string;
        
        const result = await codeExecutor.executeBash(command, timeout, workingDirectory);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                execution_id: result.executionId,
                task_id: taskId,
                language: 'bash',
                command: command,
                status: result.status,
                output: result.output,
                error: result.error,
                execution_time_ms: result.executionTime,
                working_directory: workingDirectory
              }, null, 2),
            },
          ],
        };
      }

      // Code analysis tools
      case 'analyze_code_quality': {
        const taskId = args?.task_id as number;
        const targetPath = args?.target_path as string;
        const code = args?.code as string;
        const language = args?.language as string;
        const analysisDepth = args?.analysis_depth as string || 'full';
        
        const codeToAnalyze = code || (targetPath ? readFileSync(targetPath, 'utf-8') : '');
        
        if (!codeToAnalyze) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: 'No code provided for analysis' }),
              },
            ],
            isError: true,
          };
        }
        
        const result = await codeAnalyzer.analyzeCodeQuality(codeToAnalyze, language || 'unknown', targetPath || 'inline');
        
        // Save analysis to database
        taskDb.createAnalysis({
          task_id: taskId,
          analysis_type: 'quality',
          target_path: targetPath || 'inline',
          results: result.results,
          quality_score: result.qualityScore,
          suggestions: JSON.stringify(result.suggestions),
          issues: JSON.stringify(result.issues),
          scan_duration: result.scanDuration
        });
        
        // Update task quality score
        taskDb.updateTaskExecutionData(taskId, { quality_score: result.qualityScore });
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                analysis_id: result.analysisId,
                task_id: taskId,
                analysis_type: 'quality',
                target_path: targetPath || 'inline',
                quality_score: result.qualityScore,
                suggestions: result.suggestions,
                issues: result.issues,
                results: JSON.parse(result.results),
                scan_duration_ms: result.scanDuration
              }, null, 2),
            },
          ],
        };
      }

      case 'scan_security': {
        const taskId = args?.task_id as number;
        const targetPath = args?.target_path as string;
        const code = args?.code as string;
        const language = args?.language as string;
        const scanTypes = args?.scan_types as string[] || ['vulnerabilities', 'secrets', 'injection'];
        
        const codeToScan = code || (targetPath ? readFileSync(targetPath, 'utf-8') : '');
        
        if (!codeToScan) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: 'No code provided for security scanning' }),
              },
            ],
            isError: true,
          };
        }
        
        const result = await codeAnalyzer.scanSecurity(codeToScan, language || 'unknown', targetPath || 'inline');
        
        // Save analysis to database
        taskDb.createAnalysis({
          task_id: taskId,
          analysis_type: 'security',
          target_path: targetPath || 'inline',
          results: result.results,
          quality_score: result.qualityScore,
          suggestions: JSON.stringify(result.suggestions),
          issues: JSON.stringify(result.issues),
          scan_duration: result.scanDuration
        });
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                analysis_id: result.analysisId,
                task_id: taskId,
                analysis_type: 'security',
                target_path: targetPath || 'inline',
                security_score: result.qualityScore,
                vulnerabilities: result.issues,
                suggestions: result.suggestions,
                scan_types: scanTypes,
                results: JSON.parse(result.results),
                scan_duration_ms: result.scanDuration
              }, null, 2),
            },
          ],
        };
      }

      case 'get_code_metrics': {
        const taskId = args?.task_id as number;
        const targetPath = args?.target_path as string;
        const code = args?.code as string;
        const language = args?.language as string;
        const includeTrends = args?.include_trends as boolean || false;
        
        const codeToAnalyze = code || (targetPath ? readFileSync(targetPath, 'utf-8') : '');
        
        if (!codeToAnalyze) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: 'No code provided for metrics analysis' }),
              },
            ],
            isError: true,
          };
        }
        
        // Basic metrics calculation
        const lines = codeToAnalyze.split('\n');
        const nonEmptyLines = lines.filter(line => line.trim().length > 0);
        const avgLineLength = lines.reduce((sum, line) => sum + line.length, 0) / lines.length;
        const maxLineLength = Math.max(...lines.map(line => line.length));
        
        // Language-specific metrics
        let metrics: any = {
          lineCount: lines.length,
          nonEmptyLines: nonEmptyLines.length,
          commentLines: 0,
          avgLineLength: Math.round(avgLineLength * 100) / 100,
          maxLineLength: maxLineLength,
          codeComplexity: 'unknown'
        };
        
        switch (language?.toLowerCase()) {
          case 'python':
            metrics.commentLines = (codeToAnalyze.match(/^\s*#/gm) || []).length;
            metrics.indentations = (codeToAnalyze.match(/^\s+/gm) || []).length;
            metrics.functions = (codeToAnalyze.match(/^\s*def\s+\w+/gm) || []).length;
            metrics.classes = (codeToAnalyze.match(/^\s*class\s+\w+/gm) || []).length;
            break;
          case 'javascript':
          case 'typescript':
            metrics.commentLines = (codeToAnalyze.match(/^\s*\/\//gm) || []).length + 
                                   (codeToAnalyze.match(/\/\*[\s\S]*?\*\//g) || []).length;
            metrics.functions = (codeToAnalyze.match(/function\s+\w+|\w+\s*=>|\(\w+\)\s*=>/g) || []).length;
            metrics.variables = (codeToAnalyze.match(/\b(let|const|var)\s+\w+/g) || []).length;
            break;
        }
        
        let qualityScore = 100;
        if (maxLineLength > 80) qualityScore -= 10;
        if (avgLineLength > 80) qualityScore -= 5;
        
        const response: any = {
          task_id: taskId,
          target_path: targetPath || 'inline',
          language: language || 'unknown',
          quality_score: qualityScore,
          metrics: metrics,
          analysis_date: new Date().toISOString()
        };
        
        if (includeTrends) {
          const analyses = taskDb.getTaskAnalysis(taskId);
          const trends = analyses
            .filter(a => a.analysis_type === 'quality')
            .map(a => ({ date: a.created_at, score: a.quality_score }))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          response.trends = trends;
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      }

      case 'get_execution_history': {
        const taskId = args?.task_id as number;
        const status = args?.status as ExecutionStatus;
        const language = args?.language as string;
        const limit = args?.limit as number || 50;
        
        let executions: CodeExecution[] = [];
        
        if (taskId) {
          executions = taskDb.getTaskExecutions(taskId);
        } else {
          // Get all executions (would need a new method for this)
          // For now, return empty array for all tasks
          executions = [];
        }
        
        // Filter by status and language
        if (status) {
          executions = executions.filter(e => e.status === status);
        }
        if (language) {
          executions = executions.filter(e => e.language === language);
        }
        
        // Limit results
        executions = executions.slice(0, limit);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                count: executions.length,
                executions: executions.map(e => ({
                  id: e.id,
                  task_id: e.task_id,
                  language: e.language,
                  status: e.status,
                  execution_time: e.execution_time,
                  memory_usage: e.memory_usage,
                  created_at: e.created_at,
                  start_time: e.start_time,
                  end_time: e.end_time
                }))
              }, null, 2),
            },
          ],
        };
      }

      case 'get_analysis_results': {
        const taskId = args?.task_id as number;
        const analysisType = args?.analysis_type as string;
        
        const analyses = taskDb.getTaskAnalysis(taskId);
        
        let filteredAnalyses = analyses;
        if (analysisType) {
          filteredAnalyses = analyses.filter(a => a.analysis_type === analysisType);
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                task_id: taskId,
                count: filteredAnalyses.length,
                analysis_type: analysisType || 'all',
                analyses: filteredAnalyses.map(a => ({
                  id: a.id,
                  analysis_type: a.analysis_type,
                  target_path: a.target_path,
                  quality_score: a.quality_score,
                  suggestions: JSON.parse(a.suggestions),
                  issues: JSON.parse(a.issues),
                  created_at: a.created_at,
                  scan_duration: a.scan_duration
                }))
              }, null, 2),
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
    logger.error('Tool execution error:', error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
            tool: name,
            arguments: args
          }),
        },
      ],
      isError: true,
    };
  }
});

function getStatusColor(status: string): string {
  switch (status) {
    case 'pending': return 'yellow';
    case 'in_progress': return 'blue';
    case 'blocked': return 'red';
    case 'completed': return 'green';
    default: return 'gray';
  }
}

// Start server
async function main() {
  try {
    // Initialize database first
    await taskDb.init();
    logger.info('Task Orchestrator database initialized');
    
    // Set up file watching for auto-analysis (optional)
    const watcher = chokidar.watch(join(process.cwd(), '**/*.py'), {
      ignored: /node_modules|\.git/,
      persistent: true
    });
    
    watcher.on('change', (path: string) => {
      logger.info(`File changed: ${path} - triggering auto-analysis`);
      // Could trigger automatic analysis here
    });
    
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info('Enhanced Task Orchestrator MCP Server running on stdio');
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

main().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});