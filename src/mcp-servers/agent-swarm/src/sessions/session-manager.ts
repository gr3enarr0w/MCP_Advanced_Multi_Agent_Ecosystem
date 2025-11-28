// Session Management for Agent Swarm
// Phase 9: Create, resume, checkpoint, and manage swarm sessions

import { Agent, Task } from '../types/agents.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

export type SessionStatus =
  | 'initializing'
  | 'active'
  | 'paused'
  | 'checkpointing'
  | 'resuming'
  | 'completed'
  | 'failed'
  | 'terminated';

export type TopologyType =
  | 'hierarchical'  // architect → leads → workers
  | 'mesh'          // peer-to-peer
  | 'star'          // central coordinator
  | 'dynamic';      // adaptive topology

export interface SwarmSession {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  topology: TopologyType;
  status: SessionStatus;

  // Session participants
  agents: string[];          // Agent IDs in this session
  coordinatorId?: string;    // Central coordinator (for star/hierarchical)

  // State management
  currentState: SessionState;
  checkpoints: SessionCheckpoint[];

  // Metrics
  tasksCompleted: number;
  tasksTotal: number;
  startedAt: Date;
  lastActiveAt: Date;
  completedAt?: Date;

  // Configuration
  config: SessionConfig;

  // Metadata
  metadata: Record<string, any>;
}

export interface SessionState {
  activeAgents: Map<string, Agent>;
  activeTasks: Map<string, Task>;
  taskQueue: Task[];
  completedTasks: string[];
  failedTasks: string[];

  // Working context
  workingMemory: Map<string, any>;
  sharedContext: Record<string, any>;

  // Topology state
  topologyConfig: any;

  // Execution state
  currentPhase?: string;
  nextActions: string[];
}

export interface SessionCheckpoint {
  id: string;
  sessionId: string;
  timestamp: Date;
  state: SessionState;
  reason: string;
  metadata: Record<string, any>;
}

export interface SessionConfig {
  maxAgents: number;
  maxConcurrentTasks: number;
  checkpointInterval: number;  // milliseconds
  autoCheckpoint: boolean;
  persistToDisk: boolean;
  maxCheckpoints: number;
  timeout?: number;  // milliseconds
}

export class SessionManager {
  private sessions: Map<string, SwarmSession> = new Map();
  private storageDir: string;

  constructor(storageDir?: string) {
    this.storageDir = storageDir || path.join(os.homedir(), '.mcp', 'agents', 'sessions');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.storageDir, { recursive: true });
    await this.loadPersistedSessions();
  }

  /**
   * Create a new swarm session
   */
  async createSession(params: {
    projectId: string;
    name: string;
    topology: TopologyType;
    description?: string;
    config?: Partial<SessionConfig>;
    metadata?: Record<string, any>;
  }): Promise<SwarmSession> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const defaultConfig: SessionConfig = {
      maxAgents: 10,
      maxConcurrentTasks: 5,
      checkpointInterval: 60000,  // 1 minute
      autoCheckpoint: true,
      persistToDisk: true,
      maxCheckpoints: 10,
      ...params.config
    };

    const session: SwarmSession = {
      id: sessionId,
      projectId: params.projectId,
      name: params.name,
      description: params.description,
      topology: params.topology,
      status: 'initializing',
      agents: [],
      currentState: {
        activeAgents: new Map(),
        activeTasks: new Map(),
        taskQueue: [],
        completedTasks: [],
        failedTasks: [],
        workingMemory: new Map(),
        sharedContext: {},
        topologyConfig: {},
        nextActions: []
      },
      checkpoints: [],
      tasksCompleted: 0,
      tasksTotal: 0,
      startedAt: new Date(),
      lastActiveAt: new Date(),
      config: defaultConfig,
      metadata: params.metadata || {}
    };

    this.sessions.set(sessionId, session);

    if (defaultConfig.persistToDisk) {
      await this.persistSession(session);
    }

    // Start auto-checkpoint timer if enabled
    if (defaultConfig.autoCheckpoint) {
      this.scheduleAutoCheckpoint(sessionId);
    }

    session.status = 'active';
    return session;
  }

  /**
   * Resume a session from checkpoint
   */
  async resumeSession(sessionId: string, checkpointId?: string): Promise<SwarmSession> {
    let session = this.sessions.get(sessionId);

    if (!session) {
      // Try loading from disk
      session = await this.loadSession(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }
      this.sessions.set(sessionId, session);
    }

    session.status = 'resuming';

    if (checkpointId) {
      const checkpoint = session.checkpoints.find(cp => cp.id === checkpointId);
      if (!checkpoint) {
        throw new Error(`Checkpoint ${checkpointId} not found`);
      }

      // Restore state from checkpoint
      session.currentState = this.cloneState(checkpoint.state);
    }

    session.status = 'active';
    session.lastActiveAt = new Date();

    if (session.config.autoCheckpoint) {
      this.scheduleAutoCheckpoint(sessionId);
    }

    return session;
  }

  /**
   * Create a checkpoint of current session state
   */
  async createCheckpoint(
    sessionId: string,
    reason: string = 'manual',
    metadata: Record<string, any> = {}
  ): Promise<SessionCheckpoint> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const previousStatus = session.status;
    session.status = 'checkpointing';

    const checkpointId = `checkpoint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const checkpoint: SessionCheckpoint = {
      id: checkpointId,
      sessionId,
      timestamp: new Date(),
      state: this.cloneState(session.currentState),
      reason,
      metadata
    };

    session.checkpoints.push(checkpoint);

    // Maintain max checkpoints limit
    if (session.checkpoints.length > session.config.maxCheckpoints) {
      session.checkpoints.shift();
    }

    if (session.config.persistToDisk) {
      await this.persistCheckpoint(session, checkpoint);
    }

    session.status = previousStatus;
    return checkpoint;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): SwarmSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * List all sessions
   */
  listSessions(filters?: {
    projectId?: string;
    status?: SessionStatus;
    topology?: TopologyType;
  }): SwarmSession[] {
    let sessions = Array.from(this.sessions.values());

    if (filters?.projectId) {
      sessions = sessions.filter(s => s.projectId === filters.projectId);
    }

    if (filters?.status) {
      sessions = sessions.filter(s => s.status === filters.status);
    }

    if (filters?.topology) {
      sessions = sessions.filter(s => s.topology === filters.topology);
    }

    return sessions;
  }

  /**
   * Pause a session
   */
  async pauseSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Create checkpoint before pausing
    await this.createCheckpoint(sessionId, 'pause');
    session.status = 'paused';
  }

  /**
   * Terminate a session
   */
  async terminateSession(sessionId: string, reason: string = 'manual'): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Create final checkpoint
    await this.createCheckpoint(sessionId, `terminate: ${reason}`);
    session.status = 'terminated';
    session.completedAt = new Date();

    if (session.config.persistToDisk) {
      await this.persistSession(session);
    }
  }

  /**
   * Add agent to session
   */
  addAgent(sessionId: string, agent: Agent): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.agents.length >= session.config.maxAgents) {
      throw new Error(`Session ${sessionId} has reached max agents (${session.config.maxAgents})`);
    }

    session.agents.push(agent.id);
    session.currentState.activeAgents.set(agent.id, agent);
    session.lastActiveAt = new Date();
  }

  /**
   * Add task to session
   */
  addTask(sessionId: string, task: Task): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.currentState.activeTasks.set(task.id, task);
    session.tasksTotal++;
    session.lastActiveAt = new Date();
  }

  /**
   * Update task status in session
   */
  updateTaskStatus(sessionId: string, taskId: string, status: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const task = session.currentState.activeTasks.get(taskId);
    if (task) {
      task.status = status as any;

      if (status === 'completed') {
        session.currentState.completedTasks.push(taskId);
        session.currentState.activeTasks.delete(taskId);
        session.tasksCompleted++;
      } else if (status === 'failed') {
        session.currentState.failedTasks.push(taskId);
        session.currentState.activeTasks.delete(taskId);
      }

      session.lastActiveAt = new Date();
    }
  }

  /**
   * Get session statistics
   */
  getSessionStats(sessionId: string): {
    sessionId: string;
    status: SessionStatus;
    uptime: number;
    activeAgents: number;
    activeTasks: number;
    completedTasks: number;
    failedTasks: number;
    successRate: number;
    checkpoints: number;
  } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const now = Date.now();
    const uptime = now - session.startedAt.getTime();
    const totalFinished = session.tasksCompleted + session.currentState.failedTasks.length;
    const successRate = totalFinished > 0 ? session.tasksCompleted / totalFinished : 0;

    return {
      sessionId,
      status: session.status,
      uptime,
      activeAgents: session.currentState.activeAgents.size,
      activeTasks: session.currentState.activeTasks.size,
      completedTasks: session.tasksCompleted,
      failedTasks: session.currentState.failedTasks.length,
      successRate,
      checkpoints: session.checkpoints.length
    };
  }

  // Private helper methods

  private async persistSession(session: SwarmSession): Promise<void> {
    const sessionFile = path.join(this.storageDir, `${session.id}.json`);
    const data = this.serializeSession(session);
    await fs.writeFile(sessionFile, JSON.stringify(data, null, 2));
  }

  private async persistCheckpoint(session: SwarmSession, checkpoint: SessionCheckpoint): Promise<void> {
    const checkpointDir = path.join(this.storageDir, session.id, 'checkpoints');
    await fs.mkdir(checkpointDir, { recursive: true });

    const checkpointFile = path.join(checkpointDir, `${checkpoint.id}.json`);
    const data = this.serializeCheckpoint(checkpoint);
    await fs.writeFile(checkpointFile, JSON.stringify(data, null, 2));
  }

  private async loadSession(sessionId: string): Promise<SwarmSession | null> {
    try {
      const sessionFile = path.join(this.storageDir, `${sessionId}.json`);
      const data = await fs.readFile(sessionFile, 'utf-8');
      return this.deserializeSession(JSON.parse(data));
    } catch (error) {
      return null;
    }
  }

  private async loadPersistedSessions(): Promise<void> {
    try {
      const files = await fs.readdir(this.storageDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const sessionId = file.replace('.json', '');
          const session = await this.loadSession(sessionId);
          if (session) {
            this.sessions.set(sessionId, session);
          }
        }
      }
    } catch (error) {
      // Directory doesn't exist yet
    }
  }

  private scheduleAutoCheckpoint(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const interval = session.config.checkpointInterval;

    setTimeout(async () => {
      if (session.status === 'active') {
        await this.createCheckpoint(sessionId, 'auto');
        this.scheduleAutoCheckpoint(sessionId);
      }
    }, interval);
  }

  private cloneState(state: SessionState): SessionState {
    return {
      activeAgents: new Map(state.activeAgents),
      activeTasks: new Map(state.activeTasks),
      taskQueue: [...state.taskQueue],
      completedTasks: [...state.completedTasks],
      failedTasks: [...state.failedTasks],
      workingMemory: new Map(state.workingMemory),
      sharedContext: { ...state.sharedContext },
      topologyConfig: { ...state.topologyConfig },
      currentPhase: state.currentPhase,
      nextActions: [...state.nextActions]
    };
  }

  private serializeSession(session: SwarmSession): any {
    return {
      ...session,
      currentState: {
        ...session.currentState,
        activeAgents: Array.from(session.currentState.activeAgents.entries()),
        activeTasks: Array.from(session.currentState.activeTasks.entries()),
        workingMemory: Array.from(session.currentState.workingMemory.entries())
      }
    };
  }

  private deserializeSession(data: any): SwarmSession {
    return {
      ...data,
      startedAt: new Date(data.startedAt),
      lastActiveAt: new Date(data.lastActiveAt),
      completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
      currentState: {
        ...data.currentState,
        activeAgents: new Map(data.currentState.activeAgents),
        activeTasks: new Map(data.currentState.activeTasks),
        workingMemory: new Map(data.currentState.workingMemory)
      },
      checkpoints: data.checkpoints.map((cp: any) => ({
        ...cp,
        timestamp: new Date(cp.timestamp)
      }))
    };
  }

  private serializeCheckpoint(checkpoint: SessionCheckpoint): any {
    return {
      ...checkpoint,
      state: {
        ...checkpoint.state,
        activeAgents: Array.from(checkpoint.state.activeAgents.entries()),
        activeTasks: Array.from(checkpoint.state.activeTasks.entries()),
        workingMemory: Array.from(checkpoint.state.workingMemory.entries())
      }
    };
  }
}
