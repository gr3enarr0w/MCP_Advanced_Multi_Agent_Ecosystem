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
import { 
  Agent, 
  Task, 
  AgentMessage, 
  AgentMemory, 
  AgentTeam, 
  KnowledgeShare,
  ConflictResolution
} from '../types/agents.js';
import { DatabaseConfig } from '../types/database.js';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Agent Storage Manager
 * Handles all database operations for the agent swarm
 */
export class AgentStorage {
  private db: SqlJsDatabase | null = null;
  private dbPath: string;
  private config: DatabaseConfig;

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
      const agent: any = {
        id: row[0],
        name: row[1],
        type: row[2],
        version: row[3],
        status: row[4],
        capabilities: JSON.parse(row[5]),
        maxConcurrentTasks: row[6],
        resourceLimits: JSON.parse(row[7]),
        performanceMetrics: JSON.parse(row[8]),
        createdAt: row[9],
        lastActive: row[10],
        currentTasks: JSON.parse(row[11]),
        learningData: JSON.parse(row[12]),
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
      id: row[0],
      name: row[1],
      type: row[2],
      version: row[3],
      status: row[4],
      capabilities: JSON.parse(row[5]),
      maxConcurrentTasks: row[6],
      resourceLimits: JSON.parse(row[7]),
      performanceMetrics: JSON.parse(row[8]),
      createdAt: row[9],
      lastActive: row[10],
      currentTasks: JSON.parse(row[11]),
      learningData: JSON.parse(row[12]),
    };
  }

  // Task operations
  async saveTask(task: Task): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    const taskData = {
      ...task,
      inputData: task.inputData ? JSON.stringify(task.inputData) : null,
      outputData: task.outputData ? JSON.stringify(task.outputData) : null,
      dependencies: JSON.stringify(task.dependencies),
      startedAt: task.startedAt ? task.startedAt.toISOString() : null,
      completedAt: task.completedAt ? task.completedAt.toISOString() : null,
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
      const task: any = {
        id: row[0],
        agentId: row[1],
        teamId: row[2],
        type: row[3],
        description: row[4],
        inputData: row[5] ? JSON.parse(row[5]) : undefined,
        outputData: row[6] ? JSON.parse(row[6]) : undefined,
        status: row[7],
        priority: row[8],
        dependencies: JSON.parse(row[9]),
        startedAt: row[10] ? new Date(row[10]) : undefined,
        completedAt: row[11] ? new Date(row[11]) : undefined,
        executionTime: row[12],
        errorMessage: row[13],
        resultQuality: row[14],
        createdAt: row[15],
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
      id: row[0],
      agentId: row[1],
      teamId: row[2],
      type: row[3],
      description: row[4],
      inputData: row[5] ? JSON.parse(row[5]) : undefined,
      outputData: row[6] ? JSON.parse(row[6]) : undefined,
      status: row[7],
      priority: row[8],
      dependencies: JSON.parse(row[9]),
      startedAt: row[10] ? new Date(row[10]) : undefined,
      completedAt: row[11] ? new Date(row[11]) : undefined,
      executionTime: row[12],
      errorMessage: row[13],
      resultQuality: row[14],
      createdAt: row[15],
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
      const message: any = {
        id: row[0],
        from: row[1],
        to: row[2],
        type: row[3],
        priority: row[4],
        timestamp: new Date(row[5]),
        correlationId: row[6],
        content: JSON.parse(row[7]),
        context: JSON.parse(row[8]),
        requiresResponse: row[9] === 1,
        timeout: row[10],
        retryCount: row[11],
        maxRetries: row[12],
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
      const memory: any = {
        id: row[0],
        agentId: row[1],
        memoryType: row[2],
        category: row[3],
        key: row[4],
        value: JSON.parse(row[5]),
        importance: row[6],
        createdAt: new Date(row[7]),
        lastAccessed: new Date(row[8]),
        accessCount: row[9],
        expiresAt: row[10] ? new Date(row[10]) : undefined,
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
        stats[table] = result[0].values[0][0];
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