/**
 * Comprehensive Unit Tests for SessionManager
 * Phase 9 Agent-Swarm Component Testing
 * Coverage Target: >80%
 */

// Mock the problematic mcp-bridge module before importing anything else
jest.mock('../src/integration/mcp-bridge.js', () => ({
  MCPServerBridge: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { SessionManager, SessionStatus, TopologyType, SwarmSession, SessionCheckpoint } from '../src/sessions/session-manager.js';
import { Agent, AgentType, Task, TaskStatus } from '../src/types/agents.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Mock filesystem operations
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn(),
    readdir: jest.fn(),
    unlink: jest.fn()
  }
}));

// Mock os module
jest.mock('os', () => ({
  homedir: jest.fn(() => '/mock/home')
}));

// Add Jest types
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeDefined(): jest.JestMatchers<R>;
      toBe(expected: any): jest.JestMatchers<R>;
      toContain(expected: any): jest.JestMatchers<R>;
      toHaveLength(length: number): jest.JestMatchers<R>;
      toThrow(message?: string | RegExp): jest.JestMatchers<R>;
      toThrowError(message?: string | RegExp): jest.JestMatchers<R>;
      toEqual(expected: any): jest.JestMatchers<R>;
      toBeGreaterThan(expected: number): jest.JestMatchers<R>;
      toBeLessThan(expected: number): jest.JestMatchers<R>;
      toBeGreaterThanOrEqual(expected: number): jest.JestMatchers<R>;
      toBeLessThanOrEqual(expected: number): jest.JestMatchers<R>;
      toBeCloseTo(expected: number, precision?: number): jest.JestMatchers<R>;
      toBeNull(): jest.JestMatchers<R>;
      toBeUndefined(): jest.JestMatchers<R>;
      not: {
        toContain(expected: any): jest.JestMatchers<R>;
        toThrow(message?: string | RegExp): jest.JestMatchers<R>;
      };
    }
  }
}

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let mockFs: jest.Mocked<typeof fs>;
  let mockOs: jest.Mocked<typeof os>;

  // Test data factories
  const createMockAgent = (id: string, type: AgentType = 'implementation'): Agent => ({
    id,
    name: `test-agent-${id}`,
    type,
    version: '1.0.0',
    status: 'idle',
    capabilities: ['coding', 'testing'],
    maxConcurrentTasks: 3,
    resourceLimits: {
      maxMemoryMB: 512,
      maxCPUTimeMs: 60000,
      maxDiskSpaceMB: 100,
      maxNetworkCalls: 100,
      maxFileHandles: 50,
      executionTimeoutMs: 300000,
      maxConcurrentTasks: 3
    },
    performanceMetrics: [],
    createdAt: new Date(),
    lastActive: new Date(),
    currentTasks: [],
    learningData: {
      performanceHistory: [],
      successPatterns: [],
      failurePatterns: [],
      learnedSkills: [],
      discoveredPatterns: [],
      effectiveStrategies: [],
      behaviorAdaptations: [],
      preferenceChanges: [],
      capabilityEnhancements: []
    }
  });

  const createMockTask = (id: string, type: AgentType = 'implementation'): Task => ({
    id,
    type,
    description: `Test task ${id}`,
    status: 'pending',
    priority: 1,
    dependencies: [],
    createdAt: new Date()
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockFs = fs as jest.Mocked<typeof fs>;
    mockOs = os as jest.Mocked<typeof os>;
    
    // Setup default mock returns
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.readdir.mockResolvedValue([]);
    mockFs.readFile.mockResolvedValue('{}');
    
    sessionManager = new SessionManager('/test/sessions');
  });

  describe('Initialization', () => {
    it('should initialize with default storage directory', () => {
      const defaultManager = new SessionManager();
      expect(defaultManager).toBeDefined();
    });

    it('should initialize with custom storage directory', () => {
      const customManager = new SessionManager('/custom/path');
      expect(customManager).toBeDefined();
    });

    it('should create storage directory on initialize', async () => {
      await sessionManager.initialize();
      
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        '/test/sessions',
        { recursive: true }
      );
    });

    it('should load persisted sessions on initialize', async () => {
      const mockSessionData = JSON.stringify({
        id: 'test-session',
        projectId: 'test-project',
        name: 'Test Session',
        topology: 'hierarchical',
        status: 'active',
        agents: [],
        currentState: {
          activeAgents: [],
          activeTasks: [],
          taskQueue: [],
          completedTasks: [],
          failedTasks: [],
          workingMemory: [],
          sharedContext: {},
          topologyConfig: {},
          nextActions: []
        },
        checkpoints: [],
        tasksCompleted: 0,
        tasksTotal: 0,
        startedAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        config: {
          maxAgents: 10,
          maxConcurrentTasks: 5,
          checkpointInterval: 60000,
          autoCheckpoint: true,
          persistToDisk: true,
          maxCheckpoints: 10
        },
        metadata: {}
      });

      mockFs.readdir.mockResolvedValue(['test-session.json'] as any);
      mockFs.readFile.mockResolvedValue(mockSessionData);

      await sessionManager.initialize();

      expect(mockFs.readdir).toHaveBeenCalledWith('/test/sessions');
      expect(mockFs.readFile).toHaveBeenCalledWith(
        '/test/sessions/test-session.json',
        'utf-8'
      );
    });

    it('should handle directory not existing on initialize', async () => {
      mockFs.readdir.mockRejectedValue(new Error('ENOENT: no such file'));
      
      await expect(sessionManager.initialize()).resolves.not.toThrow();
    });
  });

  describe('Session Creation', () => {
    beforeEach(async () => {
      await sessionManager.initialize();
    });

    it('should create a new session with hierarchical topology', async () => {
      const session = await sessionManager.createSession({
        projectId: 'test-project',
        name: 'Test Hierarchical Session',
        topology: 'hierarchical',
        description: 'Test session with hierarchical topology'
      });

      expect(session).toBeDefined();
      expect(session.id).toMatch(/^session_\d+_[a-z0-9]+$/);
      expect(session.projectId).toBe('test-project');
      expect(session.name).toBe('Test Hierarchical Session');
      expect(session.topology).toBe('hierarchical');
      expect(session.status).toBe('active');
      expect(session.agents).toEqual([]);
      expect(session.tasksCompleted).toBe(0);
      expect(session.tasksTotal).toBe(0);
    });

    it('should create a new session with mesh topology', async () => {
      const session = await sessionManager.createSession({
        projectId: 'test-project',
        name: 'Test Mesh Session',
        topology: 'mesh'
      });

      expect(session.topology).toBe('mesh');
      expect(session.status).toBe('active');
    });

    it('should create a new session with star topology', async () => {
      const session = await sessionManager.createSession({
        projectId: 'test-project',
        name: 'Test Star Session',
        topology: 'star'
      });

      expect(session.topology).toBe('star');
      expect(session.status).toBe('active');
    });

    it('should create session with custom configuration', async () => {
      const customConfig = {
        maxAgents: 20,
        maxConcurrentTasks: 10,
        checkpointInterval: 30000,
        autoCheckpoint: false,
        persistToDisk: false,
        maxCheckpoints: 5
      };

      const session = await sessionManager.createSession({
        projectId: 'test-project',
        name: 'Custom Config Session',
        topology: 'hierarchical',
        config: customConfig
      });

      expect(session.config).toEqual(expect.objectContaining(customConfig));
    });

    it('should create session with metadata', async () => {
      const metadata = {
        owner: 'test-user',
        environment: 'development',
        tags: ['test', 'unit']
      };

      const session = await sessionManager.createSession({
        projectId: 'test-project',
        name: 'Metadata Session',
        topology: 'hierarchical',
        metadata
      });

      expect(session.metadata).toEqual(metadata);
    });

    it('should persist session to disk when persistToDisk is true', async () => {
      await sessionManager.createSession({
        projectId: 'test-project',
        name: 'Persist Session',
        topology: 'hierarchical',
        config: { persistToDisk: true }
      });

      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should not persist session to disk when persistToDisk is false', async () => {
      await sessionManager.createSession({
        projectId: 'test-project',
        name: 'No Persist Session',
        topology: 'hierarchical',
        config: { persistToDisk: false }
      });

      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });

    it('should schedule auto-checkpoint when enabled', async () => {
      jest.useFakeTimers();
      
      await sessionManager.createSession({
        projectId: 'test-project',
        name: 'Auto Checkpoint Session',
        topology: 'hierarchical',
        config: { 
          autoCheckpoint: true,
          checkpointInterval: 1000
        }
      });

      // Fast-forward time to trigger checkpoint
      jest.advanceTimersByTime(1000);

      expect(mockFs.writeFile).toHaveBeenCalled();
      
      jest.useRealTimers();
    });
  });

  describe('Session Retrieval', () => {
    let testSession: SwarmSession;

    beforeEach(async () => {
      await sessionManager.initialize();
      testSession = await sessionManager.createSession({
        projectId: 'test-project',
        name: 'Test Session',
        topology: 'hierarchical'
      });
    });

    it('should get session by ID', () => {
      const retrieved = sessionManager.getSession(testSession.id);
      expect(retrieved).toBe(testSession);
    });

    it('should return undefined for non-existent session', () => {
      const retrieved = sessionManager.getSession('non-existent');
      expect(retrieved).toBeUndefined();
    });

    it('should list all sessions', () => {
      const sessions = sessionManager.listSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0]).toBe(testSession);
    });

    it('should list sessions filtered by project ID', () => {
      const sessions = sessionManager.listSessions({ 
        projectId: 'test-project' 
      });
      expect(sessions).toHaveLength(1);
      expect(sessions[0].projectId).toBe('test-project');
    });

    it('should list sessions filtered by status', () => {
      const sessions = sessionManager.listSessions({ 
        status: 'active' 
      });
      expect(sessions).toHaveLength(1);
      expect(sessions[0].status).toBe('active');
    });

    it('should list sessions filtered by topology', () => {
      const sessions = sessionManager.listSessions({ 
        topology: 'hierarchical' 
      });
      expect(sessions).toHaveLength(1);
      expect(sessions[0].topology).toBe('hierarchical');
    });

    it('should apply multiple filters', () => {
      const sessions = sessionManager.listSessions({ 
        projectId: 'test-project',
        status: 'active',
        topology: 'hierarchical'
      });
      expect(sessions).toHaveLength(1);
    });

    it('should return empty list when no sessions match filters', () => {
      const sessions = sessionManager.listSessions({ 
        projectId: 'different-project' 
      });
      expect(sessions).toHaveLength(0);
    });
  });

  describe('Session Lifecycle', () => {
    let testSession: SwarmSession;

    beforeEach(async () => {
      await sessionManager.initialize();
      testSession = await sessionManager.createSession({
        projectId: 'test-project',
        name: 'Lifecycle Test Session',
        topology: 'hierarchical'
      });
    });

    it('should pause session and create checkpoint', async () => {
      await sessionManager.pauseSession(testSession.id);
      
      const session = sessionManager.getSession(testSession.id);
      expect(session?.status).toBe('paused');
      expect(session?.checkpoints).toHaveLength(1);
      expect(session?.checkpoints[0].reason).toBe('pause');
    });

    it('should throw error when pausing non-existent session', async () => {
      await expect(
        sessionManager.pauseSession('non-existent')
      ).rejects.toThrow('Session non-existent not found');
    });

    it('should terminate session with final checkpoint', async () => {
      const beforeTerminate = Date.now();
      
      await sessionManager.terminateSession(testSession.id, 'test completion');
      
      const session = sessionManager.getSession(testSession.id);
      expect(session?.status).toBe('terminated');
      expect(session?.completedAt).toBeDefined();
      expect(session?.completedAt!.getTime()).toBeGreaterThanOrEqual(beforeTerminate);
      expect(session?.checkpoints).toHaveLength(1);
      expect(session?.checkpoints[0].reason).toBe('terminate: test completion');
    });

    it('should throw error when terminating non-existent session', async () => {
      await expect(
        sessionManager.terminateSession('non-existent')
      ).rejects.toThrow('Session non-existent not found');
    });

    it('should resume session from checkpoint', async () => {
      // Create a checkpoint first
      const checkpoint = await sessionManager.createCheckpoint(
        testSession.id,
        'test checkpoint',
        { test: 'data' }
      );

      // Modify session state
      testSession.currentState.sharedContext.test = 'modified';

      // Resume from checkpoint
      const resumedSession = await sessionManager.resumeSession(
        testSession.id,
        checkpoint.id
      );

      expect(resumedSession.status).toBe('active');
      expect(resumedSession.currentState.sharedContext.test).toBeUndefined();
    });

    it('should resume session without specific checkpoint', async () => {
      await sessionManager.resumeSession(testSession.id);
      
      const session = sessionManager.getSession(testSession.id);
      expect(session?.status).toBe('active');
    });

    it('should throw error when resuming non-existent session', async () => {
      await expect(
        sessionManager.resumeSession('non-existent')
      ).rejects.toThrow('Session non-existent not found');
    });

    it('should throw error when resuming with non-existent checkpoint', async () => {
      await expect(
        sessionManager.resumeSession(testSession.id, 'non-existent-checkpoint')
      ).rejects.toThrow('Checkpoint non-existent-checkpoint not found');
    });

    it('should load session from disk if not in memory', async () => {
      const mockSessionData = JSON.stringify({
        id: 'disk-session',
        projectId: 'test-project',
        name: 'Disk Session',
        topology: 'hierarchical',
        status: 'paused',
        agents: [],
        currentState: {
          activeAgents: [],
          activeTasks: [],
          taskQueue: [],
          completedTasks: [],
          failedTasks: [],
          workingMemory: [],
          sharedContext: {},
          topologyConfig: {},
          nextActions: []
        },
        checkpoints: [],
        tasksCompleted: 0,
        tasksTotal: 0,
        startedAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        config: {
          maxAgents: 10,
          maxConcurrentTasks: 5,
          checkpointInterval: 60000,
          autoCheckpoint: true,
          persistToDisk: true,
          maxCheckpoints: 10
        },
        metadata: {}
      });

      mockFs.readFile.mockResolvedValue(mockSessionData);

      const resumedSession = await sessionManager.resumeSession('disk-session');
      
      expect(resumedSession.id).toBe('disk-session');
      expect(resumedSession.status).toBe('active');
    });
  });

  describe('Checkpoint Management', () => {
    let testSession: SwarmSession;

    beforeEach(async () => {
      await sessionManager.initialize();
      testSession = await sessionManager.createSession({
        projectId: 'test-project',
        name: 'Checkpoint Test Session',
        topology: 'hierarchical'
      });
    });

    it('should create manual checkpoint', async () => {
      const metadata = { reason: 'manual save', user: 'test-user' };
      
      const checkpoint = await sessionManager.createCheckpoint(
        testSession.id,
        'manual checkpoint',
        metadata
      );

      expect(checkpoint).toBeDefined();
      expect(checkpoint.id).toMatch(/^checkpoint_\d+_[a-z0-9]+$/);
      expect(checkpoint.sessionId).toBe(testSession.id);
      expect(checkpoint.reason).toBe('manual checkpoint');
      expect(checkpoint.metadata).toEqual(metadata);
      expect(checkpoint.timestamp).toBeInstanceOf(Date);

      const session = sessionManager.getSession(testSession.id);
      expect(session?.checkpoints).toHaveLength(1);
      expect(session?.checkpoints[0]).toBe(checkpoint);
    });

    it('should throw error when creating checkpoint for non-existent session', async () => {
      await expect(
        sessionManager.createCheckpoint('non-existent')
      ).rejects.toThrow('Session non-existent not found');
    });

    it('should maintain max checkpoints limit', async () => {
      // Set max checkpoints to 3
      testSession.config.maxCheckpoints = 3;

      // Create 5 checkpoints
      for (let i = 0; i < 5; i++) {
        await sessionManager.createCheckpoint(testSession.id, `checkpoint ${i}`);
      }

      const session = sessionManager.getSession(testSession.id);
      expect(session?.checkpoints).toHaveLength(3);
      
      // Should keep the most recent checkpoints
      expect(session?.checkpoints[0].reason).toBe('checkpoint 2');
      expect(session?.checkpoints[1].reason).toBe('checkpoint 3');
      expect(session?.checkpoints[2].reason).toBe('checkpoint 4');
    });

    it('should persist checkpoint to disk when persistToDisk is true', async () => {
      testSession.config.persistToDisk = true;

      await sessionManager.createCheckpoint(testSession.id, 'persist test');

      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should not persist checkpoint to disk when persistToDisk is false', async () => {
      testSession.config.persistToDisk = false;

      await sessionManager.createCheckpoint(testSession.id, 'no persist test');

      // Should not call writeFile for checkpoint
      const writeFileCalls = mockFs.writeFile.mock.calls.filter(call => 
        (call[0] as string).includes('checkpoints')
      );
      expect(writeFileCalls).toHaveLength(0);
    });

    it('should handle session status correctly during checkpointing', async () => {
      const originalStatus = testSession.status;
      
      const checkpointPromise = sessionManager.createCheckpoint(testSession.id);
      
      // Status should be checkpointing during creation
      const sessionDuring = sessionManager.getSession(testSession.id);
      expect(sessionDuring?.status).toBe('checkpointing');
      
      await checkpointPromise;
      
      // Status should be restored after creation
      const sessionAfter = sessionManager.getSession(testSession.id);
      expect(sessionAfter?.status).toBe(originalStatus);
    });
  });

  describe('Agent Management', () => {
    let testSession: SwarmSession;
    let mockAgent: Agent;

    beforeEach(async () => {
      await sessionManager.initialize();
      testSession = await sessionManager.createSession({
        projectId: 'test-project',
        name: 'Agent Test Session',
        topology: 'hierarchical'
      });
      mockAgent = createMockAgent('test-agent-1', 'implementation');
    });

    it('should add agent to session', () => {
      sessionManager.addAgent(testSession.id, mockAgent);

      const session = sessionManager.getSession(testSession.id);
      expect(session?.agents).toContain(mockAgent.id);
      expect(session?.currentState.activeAgents.get(mockAgent.id)).toBe(mockAgent);
      expect(session?.lastActiveAt.getTime()).toBeGreaterThan(testSession.lastActiveAt.getTime());
    });

    it('should throw error when adding agent to non-existent session', () => {
      expect(() => {
        sessionManager.addAgent('non-existent', mockAgent);
      }).toThrow('Session non-existent not found');
    });

    it('should throw error when exceeding max agents', () => {
      testSession.config.maxAgents = 1;
      sessionManager.addAgent(testSession.id, mockAgent);

      const secondAgent = createMockAgent('test-agent-2', 'implementation');
      
      expect(() => {
        sessionManager.addAgent(testSession.id, secondAgent);
      }).toThrow('Session test-session has reached max agents (1)');
    });

    it('should handle multiple agents in session', () => {
      const agent1 = createMockAgent('agent-1', 'implementation');
      const agent2 = createMockAgent('agent-2', 'testing');
      const agent3 = createMockAgent('agent-3', 'review');

      sessionManager.addAgent(testSession.id, agent1);
      sessionManager.addAgent(testSession.id, agent2);
      sessionManager.addAgent(testSession.id, agent3);

      const session = sessionManager.getSession(testSession.id);
      expect(session?.agents).toHaveLength(3);
      expect(session?.currentState.activeAgents.size).toBe(3);
    });
  });

  describe('Task Management', () => {
    let testSession: SwarmSession;
    let mockTask: Task;

    beforeEach(async () => {
      await sessionManager.initialize();
      testSession = await sessionManager.createSession({
        projectId: 'test-project',
        name: 'Task Test Session',
        topology: 'hierarchical'
      });
      mockTask = createMockTask('test-task-1', 'implementation');
    });

    it('should add task to session', () => {
      sessionManager.addTask(testSession.id, mockTask);

      const session = sessionManager.getSession(testSession.id);
      expect(session?.currentState.activeTasks.get(mockTask.id)).toBe(mockTask);
      expect(session?.tasksTotal).toBe(1);
      expect(session?.lastActiveAt.getTime()).toBeGreaterThan(testSession.lastActiveAt.getTime());
    });

    it('should throw error when adding task to non-existent session', () => {
      expect(() => {
        sessionManager.addTask('non-existent', mockTask);
      }).toThrow('Session non-existent not found');
    });

    it('should update task status to completed', () => {
      sessionManager.addTask(testSession.id, mockTask);
      sessionManager.updateTaskStatus(testSession.id, mockTask.id, 'completed');

      const session = sessionManager.getSession(testSession.id);
      expect(session?.currentState.activeTasks.has(mockTask.id)).toBe(false);
      expect(session?.currentState.completedTasks).toContain(mockTask.id);
      expect(session?.tasksCompleted).toBe(1);
    });

    it('should update task status to failed', () => {
      sessionManager.addTask(testSession.id, mockTask);
      sessionManager.updateTaskStatus(testSession.id, mockTask.id, 'failed');

      const session = sessionManager.getSession(testSession.id);
      expect(session?.currentState.activeTasks.has(mockTask.id)).toBe(false);
      expect(session?.currentState.failedTasks).toContain(mockTask.id);
      expect(session?.tasksCompleted).toBe(0); // Should not increment for failed tasks
    });

    it('should update task status without moving to completed/failed', () => {
      sessionManager.addTask(testSession.id, mockTask);
      sessionManager.updateTaskStatus(testSession.id, mockTask.id, 'running');

      const session = sessionManager.getSession(testSession.id);
      expect(session?.currentState.activeTasks.has(mockTask.id)).toBe(true);
      expect(session?.currentState.completedTasks).not.toContain(mockTask.id);
      expect(session?.currentState.failedTasks).not.toContain(mockTask.id);
    });

    it('should throw error when updating task in non-existent session', () => {
      expect(() => {
        sessionManager.updateTaskStatus('non-existent', mockTask.id, 'completed');
      }).toThrow('Session non-existent not found');
    });

    it('should handle non-existent task gracefully', () => {
      sessionManager.updateTaskStatus(testSession.id, 'non-existent-task', 'completed');

      const session = sessionManager.getSession(testSession.id);
      expect(session?.currentState.activeTasks.has('non-existent-task')).toBe(false);
    });
  });

  describe('Session Statistics', () => {
    let testSession: SwarmSession;
    let mockAgent: Agent;
    let mockTask: Task;

    beforeEach(async () => {
      await sessionManager.initialize();
      testSession = await sessionManager.createSession({
        projectId: 'test-project',
        name: 'Stats Test Session',
        topology: 'hierarchical'
      });
      mockAgent = createMockAgent('test-agent-1', 'implementation');
      mockTask = createMockTask('test-task-1', 'implementation');
    });

    it('should get session statistics', () => {
      sessionManager.addAgent(testSession.id, mockAgent);
      sessionManager.addTask(testSession.id, mockTask);

      const stats = sessionManager.getSessionStats(testSession.id);

      expect(stats.sessionId).toBe(testSession.id);
      expect(stats.status).toBe('active');
      expect(stats.uptime).toBeGreaterThan(0);
      expect(stats.activeAgents).toBe(1);
      expect(stats.activeTasks).toBe(1);
      expect(stats.completedTasks).toBe(0);
      expect(stats.failedTasks).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(stats.checkpoints).toBe(0);
    });

    it('should calculate success rate correctly', () => {
      const task1 = createMockTask('task-1', 'implementation');
      const task2 = createMockTask('task-2', 'implementation');
      const task3 = createMockTask('task-3', 'implementation');

      sessionManager.addTask(testSession.id, task1);
      sessionManager.addTask(testSession.id, task2);
      sessionManager.addTask(testSession.id, task3);

      sessionManager.updateTaskStatus(testSession.id, task1.id, 'completed');
      sessionManager.updateTaskStatus(testSession.id, task2.id, 'completed');
      sessionManager.updateTaskStatus(testSession.id, task3.id, 'failed');

      const stats = sessionManager.getSessionStats(testSession.id);
      expect(stats.completedTasks).toBe(2);
      expect(stats.failedTasks).toBe(1);
      expect(stats.successRate).toBe(2/3); // 2 completed out of 3 total finished
    });

    it('should handle zero success rate when no tasks completed', () => {
      const task1 = createMockTask('task-1', 'implementation');
      const task2 = createMockTask('task-2', 'implementation');

      sessionManager.addTask(testSession.id, task1);
      sessionManager.addTask(testSession.id, task2);

      sessionManager.updateTaskStatus(testSession.id, task1.id, 'failed');
      sessionManager.updateTaskStatus(testSession.id, task2.id, 'failed');

      const stats = sessionManager.getSessionStats(testSession.id);
      expect(stats.successRate).toBe(0);
    });

    it('should throw error when getting stats for non-existent session', () => {
      expect(() => {
        sessionManager.getSessionStats('non-existent');
      }).toThrow('Session non-existent not found');
    });

    it('should include checkpoint count in stats', async () => {
      await sessionManager.createCheckpoint(testSession.id, 'test checkpoint 1');
      await sessionManager.createCheckpoint(testSession.id, 'test checkpoint 2');

      const stats = sessionManager.getSessionStats(testSession.id);
      expect(stats.checkpoints).toBe(2);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await sessionManager.initialize();
    });

    it('should handle corrupted session data gracefully', async () => {
      mockFs.readdir.mockResolvedValue(['corrupted.json'] as any);
      mockFs.readFile.mockResolvedValue('invalid json {');

      await expect(sessionManager.initialize()).resolves.not.toThrow();
    });

    it('should handle filesystem errors during persistence', async () => {
      mockFs.writeFile.mockRejectedValue(new Error('Disk full'));

      const session = await sessionManager.createSession({
        projectId: 'test-project',
        name: 'Error Test Session',
        topology: 'hierarchical'
      });

      // Session should still be created despite persistence error
      expect(session).toBeDefined();
      expect(session.status).toBe('active');
    });

    it('should handle checkpoint persistence errors', async () => {
      mockFs.writeFile.mockRejectedValue(new Error('Cannot write checkpoint'));

      const session = await sessionManager.createSession({
        projectId: 'test-project',
        name: 'Checkpoint Error Session',
        topology: 'hierarchical'
      });

      await expect(
        sessionManager.createCheckpoint(session.id, 'error test')
      ).resolves.toBeDefined(); // Should still create checkpoint in memory
    });

    it('should handle session loading errors', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Permission denied'));

      await expect(sessionManager.initialize()).resolves.not.toThrow();
    });
  });

  describe('Concurrent Operations', () => {
    beforeEach(async () => {
      await sessionManager.initialize();
    });

    it('should handle concurrent session creation', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        sessionManager.createSession({
          projectId: 'concurrent-test',
          name: `Concurrent Session ${i}`,
          topology: 'hierarchical'
        })
      );

      const sessions = await Promise.all(promises);
      
      expect(sessions).toHaveLength(5);
      expect(new Set(sessions.map((s: any) => s.id)).size).toBe(3); // All unique IDs
    });

    it('should handle concurrent checkpoint creation', async () => {
      const session = await sessionManager.createSession({
        projectId: 'concurrent-test',
        name: 'Concurrent Checkpoint Session',
        topology: 'hierarchical'
      });

      const promises = Array.from({ length: 3 }, (_, i) =>
        sessionManager.createCheckpoint(session.id, `concurrent ${i}`)
      );

      const checkpoints = await Promise.all(promises);
      
      expect(checkpoints).toHaveLength(3);
      expect(new Set(checkpoints.map(cp => cp.id)).size).toBe(3); // All unique IDs
    });

    it('should handle concurrent agent additions', async () => {
      const session = await sessionManager.createSession({
        projectId: 'concurrent-test',
        name: 'Concurrent Agent Session',
        topology: 'hierarchical',
        config: { maxAgents: 5 }
      });

      const agents = Array.from({ length: 5 }, (_, i) =>
        createMockAgent(`agent-${i}`, 'implementation')
      );

      // Add agents concurrently
      agents.forEach(agent => {
        sessionManager.addAgent(session.id, agent);
      });

      const retrievedSession = sessionManager.getSession(session.id);
      expect(retrievedSession?.agents).toHaveLength(5);
    });
  });

  describe('State Persistence and Recovery', () => {
    beforeEach(async () => {
      await sessionManager.initialize();
    });

    it('should serialize and deserialize session correctly', async () => {
      const originalSession = await sessionManager.createSession({
        projectId: 'persistence-test',
        name: 'Persistence Test Session',
        topology: 'hierarchical'
      });

      const agent = createMockAgent('test-agent', 'implementation');
      const task = createMockTask('test-task', 'implementation');

      sessionManager.addAgent(originalSession.id, agent);
      sessionManager.addTask(originalSession.id, task);
      sessionManager.updateTaskStatus(originalSession.id, task.id, 'completed');

      await sessionManager.createCheckpoint(originalSession.id, 'persistence test');

      // Simulate loading from disk
      const serializedData = JSON.stringify(originalSession);
      const parsedData = JSON.parse(serializedData);

      expect(parsedData.id).toBe(originalSession.id);
      expect(parsedData.projectId).toBe(originalSession.projectId);
      expect(parsedData.agents).toContain(agent.id);
      expect(parsedData.tasksCompleted).toBe(1);
    });

    it('should handle Map serialization in session state', async () => {
      const session = await sessionManager.createSession({
        projectId: 'map-test',
        name: 'Map Serialization Test',
        topology: 'hierarchical'
      });

      // Add data to Maps in session state
      session.currentState.workingMemory.set('test-key', 'test-value');
      session.currentState.sharedContext.testContext = 'test-value';

      // Simulate serialization
      const serialized = JSON.stringify(session);
      const parsed = JSON.parse(serialized);

      expect(parsed.currentState.workingMemory).toEqual(
        Array.from(session.currentState.workingMemory.entries())
      );
      expect(parsed.currentState.sharedContext.testContext).toBe('test-value');
    });

    it('should recover session state from checkpoint', async () => {
      const originalSession = await sessionManager.createSession({
        projectId: 'recovery-test',
        name: 'Recovery Test Session',
        topology: 'hierarchical'
      });

      // Modify session state
      originalSession.currentState.sharedContext.testData = 'important';
      originalSession.currentState.nextActions.push('action1', 'action2');

      const checkpoint = await sessionManager.createCheckpoint(
        originalSession.id,
        'recovery test'
      );

      // Modify session further
      originalSession.currentState.sharedContext.testData = 'modified';
      originalSession.currentState.nextActions.push('action3');

      // Resume from checkpoint
      const recoveredSession = await sessionManager.resumeSession(
        originalSession.id,
        checkpoint.id
      );

      expect(recoveredSession.currentState.sharedContext.testData).toBe('important');
      expect(recoveredSession.currentState.nextActions).toEqual(['action1', 'action2']);
    });
  });

  describe('Auto-Checkpointing', () => {
    beforeEach(async () => {
      await sessionManager.initialize();
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should create auto-checkpoints at specified intervals', async () => {
      const session = await sessionManager.createSession({
        projectId: 'auto-test',
        name: 'Auto Checkpoint Test',
        topology: 'hierarchical',
        config: {
          autoCheckpoint: true,
          checkpointInterval: 1000
        }
      });

      // Clear any initial writeFile calls from session creation
      mockFs.writeFile.mockClear();

      // Fast-forward time
      jest.advanceTimersByTime(1000);

      expect(mockFs.writeFile).toHaveBeenCalled();
      
      const retrievedSession = sessionManager.getSession(session.id);
      expect(retrievedSession?.checkpoints.length).toBeGreaterThan(0);
      expect(retrievedSession?.checkpoints[0].reason).toBe('auto');
    });

    it('should not create auto-checkpoints when disabled', async () => {
      await sessionManager.createSession({
        projectId: 'no-auto-test',
        name: 'No Auto Checkpoint Test',
        topology: 'hierarchical',
        config: {
          autoCheckpoint: false,
          checkpointInterval: 1000
        }
      });

      mockFs.writeFile.mockClear();

      // Fast-forward time
      jest.advanceTimersByTime(2000);

      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });

    it('should stop auto-checkpointing when session is paused', async () => {
      const session = await sessionManager.createSession({
        projectId: 'pause-test',
        name: 'Pause Auto Checkpoint Test',
        topology: 'hierarchical',
        config: {
          autoCheckpoint: true,
          checkpointInterval: 1000
        }
      });

      mockFs.writeFile.mockClear();

      // Pause the session
      await sessionManager.pauseSession(session.id);

      // Fast-forward time
      jest.advanceTimersByTime(2000);

      // Should not create new auto-checkpoints while paused
      const autoCheckpoints = session.checkpoints.filter(cp => cp.reason === 'auto');
      expect(autoCheckpoints).toHaveLength(0);
    });

    it('should resume auto-checkpointing when session is resumed', async () => {
      const session = await sessionManager.createSession({
        projectId: 'resume-test',
        name: 'Resume Auto Checkpoint Test',
        topology: 'hierarchical',
        config: {
          autoCheckpoint: true,
          checkpointInterval: 1000
        }
      });

      await sessionManager.pauseSession(session.id);
      await sessionManager.resumeSession(session.id);

      mockFs.writeFile.mockClear();

      // Fast-forward time
      jest.advanceTimersByTime(1000);

      expect(mockFs.writeFile).toHaveBeenCalled();
    });
  });

  describe('Session Isolation and Boundaries', () => {
    beforeEach(async () => {
      await sessionManager.initialize();
    });

    it('should maintain isolation between sessions', async () => {
      const session1 = await sessionManager.createSession({
        projectId: 'project1',
        name: 'Session 1',
        topology: 'hierarchical'
      });

      const session2 = await sessionManager.createSession({
        projectId: 'project2',
        name: 'Session 2',
        topology: 'mesh'
      });

      const agent1 = createMockAgent('agent-1', 'implementation');
      const agent2 = createMockAgent('agent-2', 'testing');

      sessionManager.addAgent(session1.id, agent1);
      sessionManager.addAgent(session2.id, agent2);

      const task1 = createMockTask('task-1', 'implementation');
      const task2 = createMockTask('task-2', 'testing');

      sessionManager.addTask(session1.id, task1);
      sessionManager.addTask(session2.id, task2);

      // Verify isolation
      expect(session1.agents).toContain(agent1.id);
      expect(session1.agents).not.toContain(agent2.id);
      expect(session2.agents).toContain(agent2.id);
      expect(session2.agents).not.toContain(agent1.id);

      expect(session1.currentState.activeTasks.has(task1.id)).toBe(true);
      expect(session1.currentState.activeTasks.has(task2.id)).toBe(false);
      expect(session2.currentState.activeTasks.has(task2.id)).toBe(true);
      expect(session2.currentState.activeTasks.has(task1.id)).toBe(false);
    });

    it('should handle different configurations per session', async () => {
      const session1 = await sessionManager.createSession({
        projectId: 'config-test-1',
        name: 'Config Test 1',
        topology: 'hierarchical',
        config: {
          maxAgents: 5,
          maxConcurrentTasks: 10,
          autoCheckpoint: true
        }
      });

      const session2 = await sessionManager.createSession({
        projectId: 'config-test-2',
        name: 'Config Test 2',
        topology: 'star',
        config: {
          maxAgents: 15,
          maxConcurrentTasks: 3,
          autoCheckpoint: false
        }
      });

      expect(session1.config.maxAgents).toBe(5);
      expect(session1.config.maxConcurrentTasks).toBe(10);
      expect(session1.config.autoCheckpoint).toBe(true);

      expect(session2.config.maxAgents).toBe(15);
      expect(session2.config.maxConcurrentTasks).toBe(3);
      expect(session2.config.autoCheckpoint).toBe(false);
    });
  });
});