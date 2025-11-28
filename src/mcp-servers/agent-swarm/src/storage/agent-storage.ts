/**
 * Agent Storage Module
 * 
 * SQLite-based persistence layer for agent swarm data:
 * - Agent state and metadata
 * - Task management and history
 * - Message logging and communication
 * - Performance metrics and learning data
 * - SPARC workflow tracking
 * - Boomerang task state
 */

import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import type { SqlValue } from 'sql.js';
import { 
  Agent, 
  Task, 
  AgentMessage, 
  AgentMemory, 
  AgentTeam, 
  KnowledgeShare,
  ConflictResolution,
  TaskStatus,
  MessageType
} from '../types/agents.js';
import type {
  AgentType,
  AgentStatus,
  LearningData,
  ResourceLimits,
  PerformanceMetrics,
  MemoryType,
  MemoryCategory,
  MessagePriority
} from '../types/agents.js';
import { DatabaseConfig } from '../types/database.js';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { TextDecoder } from 'util';

/**
 * Agent Storage Manager
 * Handles all database operations for the agent swarm
 */
export class AgentStorage {
  private db: SqlJsDatabase | null = null;
  private dbPath: string;
  private config: DatabaseConfig;
  private decoder = new TextDecoder();

  private normalizeValue(value: SqlValue | undefined | null): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return value.toString();
    return this.decoder.decode(value);
  }

  private toJson<T>(value: SqlValue | undefined | null, fallback: T): T {
    const text = this.normalizeValue(value);
    if (!text) return fallback;
    try {
      return JSON.parse(text) as T;
    } catch {
      return fallback;
    }
  }

  private toNumber(value: SqlValue | undefined | null): number | undefined {
    const text = this.normalizeValue(value);
    if (text === '') return undefined;
    const parsed = Number(text);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  private toDate(value: SqlValue | undefined | null): Date | undefined {
    const text = this.normalizeValue(value);
    if (!text) return undefined;
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private toBoolean(value: SqlValue | undefined | null): boolean {
    const text = this.normalizeValue(value).toLowerCase();
    return text === '1' || text === 'true';
  }

  private toOptionalString(value: SqlValue | undefined | null): string | undefined {
    const normalized = this.normalizeValue(value);
    return normalized === '' ? undefined : normalized;
  }

  private toMessagePriority(value: SqlValue | undefined | null): MessagePriority {
    const num = this.toNumber(value) ?? 0;
    const clamped = Math.min(4, Math.max(0, Math.round(num)));
    return clamped as MessagePriority;
  }

  private readonly defaultResourceLimits: ResourceLimits = {
    maxMemoryMB: 1024,
    maxCPUTimeMs: 1800000,
    maxDiskSpaceMB: 500,
    maxNetworkCalls: 50,
    maxFileHandles: 20,
    executionTimeoutMs: 1800000,
    maxConcurrentTasks: 2,
  };

  private readonly defaultLearningData: LearningData = {
    performanceHistory: [],
    successPatterns: [],
    failurePatterns: [],
    learnedSkills: [],
    discoveredPatterns: [],
    effectiveStrategies: [],
    behaviorAdaptations: [],
    preferenceChanges: [],
    capabilityEnhancements: [],
  };

  constructor(dbPath: string, config?: Partial<DatabaseConfig>) {
    this.dbPath = dbPath;
    this.config = {
      path: dbPath,
      backupInterval: 24, // hours
      maxBackupFiles: 7,
      ...config,
    };
  }

  async initialize(): Promise<void> {
    try {
      const SQL = await initSqlJs();
      
      // Load existing database or create new one
      if (existsSync(this.dbPath)) {
        const buffer = readFileSync(this.dbPath);
        this.db = new SQL.Database(buffer);
        console.log('Agent Storage: Loaded existing database');
      } else {
        this.db = new SQL.Database();
        await this.initDatabase();
        await this.save();
        console.log('Agent Storage: Created new database');
      }

      // Set up database optimizations
      await this.optimizeDatabase();
      
    } catch (error) {
      console.error('Failed to initialize Agent Storage:', error);
      throw error;
    }
  }

  private async initDatabase(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Agents table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        version TEXT NOT NULL,
        status TEXT NOT NULL,
        capabilities TEXT NOT NULL, -- JSON array
        maxConcurrentTasks INTEGER DEFAULT 1,
        resourceLimits TEXT NOT NULL, -- JSON
        performanceMetrics TEXT NOT NULL, -- JSON
        createdAt TEXT NOT NULL,
        lastActive TEXT NOT NULL,
        currentTasks TEXT DEFAULT '[]', -- JSON array
        learningData TEXT NOT NULL, -- JSON
        updatedAt TEXT NOT NULL
      )
    `);

    // Tasks table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        agentId TEXT,
        teamId TEXT,
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        inputData TEXT, -- JSON
        outputData TEXT, -- JSON
        status TEXT NOT NULL,
        priority INTEGER DEFAULT 1,
        dependencies TEXT DEFAULT '[]', -- JSON array
        startedAt TEXT,
        completedAt TEXT,
        executionTime INTEGER,
        errorMessage TEXT,
        resultQuality REAL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (agentId) REFERENCES agents(id)
      )
    `);

    // Agent messages table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS agent_messages (
        id TEXT PRIMARY KEY,
        fromAgent TEXT NOT NULL,
        toAgent TEXT,
        type TEXT NOT NULL,
        priority INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        correlationId TEXT,
        content TEXT NOT NULL, -- JSON
        context TEXT NOT NULL, -- JSON
        requiresResponse BOOLEAN DEFAULT 0,
        timeout INTEGER,
        retryCount INTEGER DEFAULT 0,
        maxRetries INTEGER DEFAULT 3,
        responseReceived BOOLEAN DEFAULT 0,
        responseTimestamp TEXT,
        createdAt TEXT NOT NULL
      )
    `);

    // Agent memory table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS agent_memory (
        id TEXT PRIMARY KEY,
        agentId TEXT NOT NULL,
        memoryType TEXT NOT NULL,
        category TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL, -- JSON
        importance REAL DEFAULT 0.5,
        createdAt TEXT NOT NULL,
        lastAccessed TEXT NOT NULL,
        accessCount INTEGER DEFAULT 0,
        expiresAt TEXT,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (agentId) REFERENCES agents(id)
      )
    `);

    // Agent teams table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS agent_teams (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        teamType TEXT NOT NULL,
        status TEXT NOT NULL,
        members TEXT NOT NULL, -- JSON array
        coordinationRules TEXT, -- JSON
        performanceMetrics TEXT, -- JSON
        createdAt TEXT NOT NULL,
        disbandedAt TEXT,
        updatedAt TEXT NOT NULL
      )
    `);

    // Knowledge sharing table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS knowledge_shares (
        id TEXT PRIMARY KEY,
        fromAgentId TEXT NOT NULL,
        toAgentId TEXT,
        knowledgeType TEXT NOT NULL,
        content TEXT NOT NULL, -- JSON
        context TEXT NOT NULL, -- JSON
        sharedAt TEXT NOT NULL,
        acknowledgedAt TEXT,
        appliedAt TEXT,
        effectiveness REAL,
        createdAt TEXT NOT NULL
      )
    `);

    // Conflict resolution table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS conflict_resolutions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        involvedAgents TEXT NOT NULL, -- JSON array
        context TEXT NOT NULL, -- JSON
        resolutionStrategy TEXT NOT NULL,
        resolution TEXT, -- JSON
        resolvedAt TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);

    // SPARC workflows table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS sparc_workflows (
        id TEXT PRIMARY KEY,
        projectDescription TEXT NOT NULL,
        requirements TEXT, -- JSON array
        constraints TEXT, -- JSON array
        currentPhase TEXT NOT NULL,
        phases TEXT NOT NULL, -- JSON array
        status TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        completedAt TEXT,
        updatedAt TEXT NOT NULL
      )
    `);

    // Boomerang tasks table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS boomerang_tasks (
        id TEXT PRIMARY KEY,
        originalTaskId TEXT NOT NULL,
        targetAgent TEXT NOT NULL,
        feedback TEXT NOT NULL,
        priority INTEGER DEFAULT 2,
        status TEXT NOT NULL,
        sentAt TEXT NOT NULL,
        returnedAt TEXT,
        result TEXT, -- JSON
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (originalTaskId) REFERENCES tasks(id)
      )
    `);

    // Create indexes for performance
    this.db.run('CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(type)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(agentId)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_messages_from ON agent_messages(fromAgent)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_messages_to ON agent_messages(toAgent)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_memory_agent ON agent_memory(agentId)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_knowledge_from ON knowledge_shares(fromAgentId)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_knowledge_to ON knowledge_shares(toAgentId)');
  }

  private async optimizeDatabase(): Promise<void> {
    if (!this.db) return;

    try {
      this.db.run('PRAGMA journal_mode = WAL');
      this.db.run('PRAGMA synchronous = NORMAL');
      this.db.run('PRAGMA cache_size = 1000');
      this.db.run('PRAGMA temp_store = memory');
      this.db.run('PRAGMA mmap_size = 268435456'); // 256MB
    } catch (error) {
      console.warn('Database optimization failed:', error);
    }
  }

  private save(): void {
    if (!this.db) return;
    const data = this.db.export();
    writeFileSync(this.dbPath, data);
  }

  // Agent operations
  async saveAgent(agent: Agent): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    const agentData = {
      ...agent,
      capabilities: JSON.stringify(agent.capabilities),
      resourceLimits: JSON.stringify(agent.resourceLimits),
      performanceMetrics: JSON.stringify(agent.performanceMetrics),
      currentTasks: JSON.stringify(agent.currentTasks),
      learningData: JSON.stringify(agent.learningData),
      updatedAt: now,
      createdAt: agent.createdAt ? agent.createdAt.toISOString() : now,
      lastActive: agent.lastActive ? agent.lastActive.toISOString() : now,
    };

    this.db.run(`
      INSERT OR REPLACE INTO agents 
      (id, name, type, version, status, capabilities, maxConcurrentTasks, 
       resourceLimits, performanceMetrics, createdAt, lastActive, currentTasks, 
       learningData, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      agentData.id, agentData.name, agentData.type, agentData.version, agentData.status,
      agentData.capabilities, agentData.maxConcurrentTasks, agentData.resourceLimits,
      agentData.performanceMetrics, agentData.createdAt, agentData.lastActive,
      agentData.currentTasks, agentData.learningData, agentData.updatedAt
    ]);

    this.save();
  }

  async getAllAgents(): Promise<Agent[]> {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec('SELECT * FROM agents');
    if (result.length === 0) return [];

    const agents: Agent[] = [];
    for (const row of result[0].values) {
      const agent: Agent = {
        id: this.normalizeValue(row[0]),
        name: this.normalizeValue(row[1]),
        type: this.normalizeValue(row[2]) as AgentType,
        version: this.normalizeValue(row[3]),
        status: this.normalizeValue(row[4]) as AgentStatus,
        capabilities: this.toJson<string[]>(row[5], []),
        maxConcurrentTasks: this.toNumber(row[6]) ?? 1,
        resourceLimits: this.toJson<ResourceLimits>(row[7], this.defaultResourceLimits),
        performanceMetrics: this.toJson<PerformanceMetrics[]>(row[8], []),
        createdAt: this.toDate(row[9]) ?? new Date(),
        lastActive: this.toDate(row[10]) ?? new Date(),
        currentTasks: this.toJson<string[]>(row[11], []),
        learningData: this.toJson<LearningData>(row[12], this.defaultLearningData),
      };
      agents.push(agent);
    }
    return agents;
  }

  async getAgent(agentId: string): Promise<Agent | null> {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec('SELECT * FROM agents WHERE id = ?', [agentId]);
    if (result.length === 0 || result[0].values.length === 0) return null;

    const row = result[0].values[0];
    return {
      id: this.normalizeValue(row[0]),
      name: this.normalizeValue(row[1]),
      type: this.normalizeValue(row[2]) as AgentType,
      version: this.normalizeValue(row[3]),
      status: this.normalizeValue(row[4]) as AgentStatus,
      capabilities: this.toJson<string[]>(row[5], []),
      maxConcurrentTasks: this.toNumber(row[6]) ?? 1,
      resourceLimits: this.toJson<ResourceLimits>(row[7], this.defaultResourceLimits),
      performanceMetrics: this.toJson<PerformanceMetrics[]>(row[8], []),
      createdAt: this.toDate(row[9]) ?? new Date(),
      lastActive: this.toDate(row[10]) ?? new Date(),
      currentTasks: this.toJson<string[]>(row[11], []),
      learningData: this.toJson<LearningData>(row[12], this.defaultLearningData),
    };
  }

  // Task operations
  async saveTask(task: Task): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    const createdAt = task.createdAt ? task.createdAt.toISOString() : now;
    const startedAt = task.startedAt ? task.startedAt.toISOString() : null;
    const completedAt = task.completedAt ? task.completedAt.toISOString() : null;

    const taskData = {
      ...task,
      inputData: task.inputData ? JSON.stringify(task.inputData) : null,
      outputData: task.outputData ? JSON.stringify(task.outputData) : null,
      dependencies: JSON.stringify(task.dependencies),
      startedAt,
      completedAt,
      resultQuality: task.resultQuality ?? null,
      createdAt,
      updatedAt: now,
    };

    this.db.run(`
      INSERT OR REPLACE INTO tasks 
      (id, agentId, teamId, type, description, inputData, outputData, status, 
       priority, dependencies, startedAt, completedAt, executionTime, errorMessage, 
       resultQuality, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      taskData.id, taskData.agentId, taskData.teamId, taskData.type, taskData.description,
      taskData.inputData, taskData.outputData, taskData.status, taskData.priority,
      taskData.dependencies, taskData.startedAt, taskData.completedAt, taskData.executionTime,
      taskData.errorMessage, taskData.resultQuality, taskData.createdAt || now, taskData.updatedAt
    ]);

    this.save();
  }

  async getAllTasks(): Promise<Task[]> {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec('SELECT * FROM tasks ORDER BY createdAt DESC');
    if (result.length === 0) return [];

    const tasks: Task[] = [];
    for (const row of result[0].values) {
      const task: Task = {
        id: this.normalizeValue(row[0]),
        agentId: this.toOptionalString(row[1]),
        teamId: this.toOptionalString(row[2]),
        type: this.normalizeValue(row[3]) as AgentType,
        description: this.normalizeValue(row[4]),
        inputData: row[5] ? JSON.parse(this.normalizeValue(row[5])) : undefined,
        outputData: row[6] ? JSON.parse(this.normalizeValue(row[6])) : undefined,
        status: this.normalizeValue(row[7]) as TaskStatus,
        priority: this.toNumber(row[8]) ?? 1,
        dependencies: this.toJson<string[]>(row[9], []),
        startedAt: this.toDate(row[10]),
        completedAt: this.toDate(row[11]),
        executionTime: this.toNumber(row[12]),
        errorMessage: this.toOptionalString(row[13]),
        resultQuality: this.toNumber(row[14]),
        createdAt: this.toDate(row[15]) ?? new Date(),
      };
      tasks.push(task);
    }
    return tasks;
  }

  async getTask(taskId: string): Promise<Task | null> {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (result.length === 0 || result[0].values.length === 0) return null;

    const row = result[0].values[0];
    return {
      id: this.normalizeValue(row[0]),
      agentId: this.toOptionalString(row[1]),
      teamId: this.toOptionalString(row[2]),
      type: this.normalizeValue(row[3]) as AgentType,
      description: this.normalizeValue(row[4]),
      inputData: row[5] ? JSON.parse(this.normalizeValue(row[5])) : undefined,
      outputData: row[6] ? JSON.parse(this.normalizeValue(row[6])) : undefined,
      status: this.normalizeValue(row[7]) as TaskStatus,
      priority: this.toNumber(row[8]) ?? 1,
      dependencies: this.toJson<string[]>(row[9], []),
      startedAt: this.toDate(row[10]),
      completedAt: this.toDate(row[11]),
      executionTime: this.toNumber(row[12]),
      errorMessage: this.toOptionalString(row[13]),
      resultQuality: this.toNumber(row[14]),
      createdAt: this.toDate(row[15]) ?? new Date(),
    };
  }

  // Message operations
  async logMessage(message: AgentMessage): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    this.db.run(`
      INSERT INTO agent_messages 
      (id, fromAgent, toAgent, type, priority, timestamp, correlationId, content, 
       context, requiresResponse, timeout, retryCount, maxRetries, responseReceived, 
       responseTimestamp, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      message.id, message.from, message.to, message.type, message.priority,
      message.timestamp.toISOString(), message.correlationId, JSON.stringify(message.content),
      JSON.stringify(message.context), message.requiresResponse ? 1 : 0, message.timeout,
      message.retryCount, message.maxRetries, 0, null, now
    ]);

    this.save();
  }

  async getMessages(agentId?: string, limit: number = 100): Promise<AgentMessage[]> {
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM agent_messages';
    const params: any[] = [];

    if (agentId) {
      query += ' WHERE fromAgent = ? OR toAgent = ?';
      params.push(agentId, agentId);
    }

    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    const result = this.db.exec(query, params);
    if (result.length === 0) return [];

    const messages: AgentMessage[] = [];
    for (const row of result[0].values) {
      const message: AgentMessage = {
        id: this.normalizeValue(row[0]),
        from: this.normalizeValue(row[1]),
        to: this.toOptionalString(row[2]),
        type: this.normalizeValue(row[3]) as MessageType,
        priority: this.toMessagePriority(row[4]),
        timestamp: this.toDate(row[5]) ?? new Date(),
        correlationId: this.toOptionalString(row[6]),
        content: this.toJson<any>(row[7], {}),
        context: this.toJson<any>(row[8], {}),
        requiresResponse: this.toBoolean(row[9]),
        timeout: this.toNumber(row[10]),
        retryCount: this.toNumber(row[11]) ?? 0,
        maxRetries: this.toNumber(row[12]) ?? 0,
      };
      messages.push(message);
    }
    return messages;
  }

  // Memory operations
  async saveMemory(memory: AgentMemory): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    this.db.run(`
      INSERT OR REPLACE INTO agent_memory 
      (id, agentId, memoryType, category, key, value, importance, createdAt, 
       lastAccessed, accessCount, expiresAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      memory.id, memory.agentId, memory.memoryType, memory.category, memory.key,
      JSON.stringify(memory.value), memory.importance, memory.createdAt.toISOString(),
      memory.lastAccessed.toISOString(), memory.accessCount, 
      memory.expiresAt ? memory.expiresAt.toISOString() : null, now
    ]);

    this.save();
  }

  async getMemory(agentId: string, category?: string): Promise<AgentMemory[]> {
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM agent_memory WHERE agentId = ?';
    const params: any[] = [agentId];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    query += ' ORDER BY importance DESC, lastAccessed DESC';

    const result = this.db.exec(query, params);
    if (result.length === 0) return [];

    const memories: AgentMemory[] = [];
    for (const row of result[0].values) {
      const memory: AgentMemory = {
        id: this.normalizeValue(row[0]),
        agentId: this.normalizeValue(row[1]),
        memoryType: this.normalizeValue(row[2]) as MemoryType,
        category: this.normalizeValue(row[3]) as MemoryCategory,
        key: this.normalizeValue(row[4]),
        value: this.toJson<any>(row[5], null),
        importance: this.toNumber(row[6]) ?? 0,
        createdAt: this.toDate(row[7]) ?? new Date(),
        lastAccessed: this.toDate(row[8]) ?? new Date(),
        accessCount: this.toNumber(row[9]) ?? 0,
        expiresAt: this.toDate(row[10]),
      };
      memories.push(memory);
    }
    return memories;
  }

  // Knowledge sharing operations
  async saveKnowledgeShare(share: KnowledgeShare): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    this.db.run(`
      INSERT INTO knowledge_shares 
      (id, fromAgentId, toAgentId, knowledgeType, content, context, sharedAt, 
       acknowledgedAt, appliedAt, effectiveness, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      share.id, share.fromAgentId, share.toAgentId, share.knowledgeType,
      JSON.stringify(share.content), JSON.stringify(share.context), 
      share.sharedAt.toISOString(), 
      share.acknowledgedAt ? share.acknowledgedAt.toISOString() : null,
      share.appliedAt ? share.appliedAt.toISOString() : null,
      share.effectiveness, now
    ]);

    this.save();
  }

  // SPARC Workflow operations
  async saveSPARCWorkflow(workflow: {
    id: string;
    projectDescription: string;
    requirements?: string[];
    constraints?: string[];
    currentPhase: string;
    phases: any[];
    status: string;
    createdAt: Date;
    completedAt?: Date;
  }): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    this.db.run(`
      INSERT OR REPLACE INTO sparc_workflows
      (id, projectDescription, requirements, constraints, currentPhase, phases,
       status, createdAt, completedAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      workflow.id,
      workflow.projectDescription,
      JSON.stringify(workflow.requirements || []),
      JSON.stringify(workflow.constraints || []),
      workflow.currentPhase,
      JSON.stringify(workflow.phases),
      workflow.status,
      workflow.createdAt.toISOString(),
      workflow.completedAt ? workflow.completedAt.toISOString() : null,
      now
    ]);

    this.save();
  }

  async getAllSPARCWorkflows(): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec('SELECT * FROM sparc_workflows ORDER BY createdAt DESC');
    if (result.length === 0) return [];

    const workflows: any[] = [];
    for (const row of result[0].values) {
      workflows.push({
        id: this.normalizeValue(row[0]),
        projectDescription: this.normalizeValue(row[1]),
        requirements: this.toJson<string[]>(row[2], []),
        constraints: this.toJson<string[]>(row[3], []),
        currentPhase: this.normalizeValue(row[4]),
        phases: this.toJson<any[]>(row[5], []),
        status: this.normalizeValue(row[6]),
        createdAt: this.toDate(row[7]) ?? new Date(),
        completedAt: this.toDate(row[8]),
      });
    }
    return workflows;
  }

  async getSPARCWorkflow(workflowId: string): Promise<any | null> {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec('SELECT * FROM sparc_workflows WHERE id = ?', [workflowId]);
    if (result.length === 0 || result[0].values.length === 0) return null;

    const row = result[0].values[0];
    return {
      id: this.normalizeValue(row[0]),
      projectDescription: this.normalizeValue(row[1]),
      requirements: this.toJson<string[]>(row[2], []),
      constraints: this.toJson<string[]>(row[3], []),
      currentPhase: this.normalizeValue(row[4]),
      phases: this.toJson<any[]>(row[5], []),
      status: this.normalizeValue(row[6]),
      createdAt: this.toDate(row[7]) ?? new Date(),
      completedAt: this.toDate(row[8]),
    };
  }

  async deleteSPARCWorkflow(workflowId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run('DELETE FROM sparc_workflows WHERE id = ?', [workflowId]);
    this.save();
  }

  // Boomerang Task operations
  async saveBoomerangTask(task: {
    id: string;
    originalTaskId: string;
    targetAgent: string;
    feedback: string;
    priority: number;
    status: string;
    sentAt: Date;
    returnedAt?: Date;
    result?: any;
  }): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    this.db.run(`
      INSERT OR REPLACE INTO boomerang_tasks
      (id, originalTaskId, targetAgent, feedback, priority, status,
       sentAt, returnedAt, result, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      task.id,
      task.originalTaskId,
      task.targetAgent,
      task.feedback,
      task.priority,
      task.status,
      task.sentAt.toISOString(),
      task.returnedAt ? task.returnedAt.toISOString() : null,
      task.result ? JSON.stringify(task.result) : null,
      now,
      now
    ]);

    this.save();
  }

  async getAllBoomerangTasks(): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec('SELECT * FROM boomerang_tasks ORDER BY sentAt DESC');
    if (result.length === 0) return [];

    const tasks: any[] = [];
    for (const row of result[0].values) {
      tasks.push({
        id: this.normalizeValue(row[0]),
        originalTaskId: this.normalizeValue(row[1]),
        targetAgent: this.normalizeValue(row[2]),
        feedback: this.normalizeValue(row[3]),
        priority: this.toNumber(row[4]) ?? 2,
        status: this.normalizeValue(row[5]),
        sentAt: this.toDate(row[6]) ?? new Date(),
        returnedAt: this.toDate(row[7]),
        result: this.toJson<any>(row[8], null),
      });
    }
    return tasks;
  }

  async getBoomerangTask(taskId: string): Promise<any | null> {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec('SELECT * FROM boomerang_tasks WHERE id = ?', [taskId]);
    if (result.length === 0 || result[0].values.length === 0) return null;

    const row = result[0].values[0];
    return {
      id: this.normalizeValue(row[0]),
      originalTaskId: this.normalizeValue(row[1]),
      targetAgent: this.normalizeValue(row[2]),
      feedback: this.normalizeValue(row[3]),
      priority: this.toNumber(row[4]) ?? 2,
      status: this.normalizeValue(row[5]),
      sentAt: this.toDate(row[6]) ?? new Date(),
      returnedAt: this.toDate(row[7]),
      result: this.toJson<any>(row[8], null),
    };
  }

  async getBoomerangTasksByOriginalTask(originalTaskId: string): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec(
      'SELECT * FROM boomerang_tasks WHERE originalTaskId = ? ORDER BY sentAt DESC',
      [originalTaskId]
    );
    if (result.length === 0) return [];

    const tasks: any[] = [];
    for (const row of result[0].values) {
      tasks.push({
        id: this.normalizeValue(row[0]),
        originalTaskId: this.normalizeValue(row[1]),
        targetAgent: this.normalizeValue(row[2]),
        feedback: this.normalizeValue(row[3]),
        priority: this.toNumber(row[4]) ?? 2,
        status: this.normalizeValue(row[5]),
        sentAt: this.toDate(row[6]) ?? new Date(),
        returnedAt: this.toDate(row[7]),
        result: this.toJson<any>(row[8], null),
      });
    }
    return tasks;
  }

  async deleteBoomerangTask(taskId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run('DELETE FROM boomerang_tasks WHERE id = ?', [taskId]);
    this.save();
  }

  // Database maintenance
  async cleanup(): Promise<void> {
    if (!this.db) return;

    try {
      // Clean up old messages (older than 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      this.db.run('DELETE FROM agent_messages WHERE createdAt < ?', [thirtyDaysAgo]);

      // Clean up expired memory
      const now = new Date().toISOString();
      this.db.run('DELETE FROM agent_memory WHERE expiresAt < ?', [now]);

      // Clean up resolved conflicts older than 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      this.db.run('DELETE FROM conflict_resolutions WHERE resolvedAt < ?', [sevenDaysAgo]);

      this.save();
      console.log('Database cleanup completed');
    } catch (error) {
      console.error('Database cleanup failed:', error);
    }
  }

  async getStats(): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');

    const stats: any = {};

    // Count records in each table
    const tables = ['agents', 'tasks', 'agent_messages', 'agent_memory', 'agent_teams', 'knowledge_shares'];
    
    for (const table of tables) {
      const result = this.db.exec(`SELECT COUNT(*) FROM ${table}`);
      if (result.length > 0) {
        stats[table] = this.toNumber(result[0].values[0][0]) ?? 0;
      }
    }

    return stats;
  }

  async close(): Promise<void> {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
      console.log('Agent Storage closed');
    }
  }
}
