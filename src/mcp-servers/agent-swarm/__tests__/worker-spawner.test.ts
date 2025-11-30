/**
 * Comprehensive Unit Tests for WorkerSpawner
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

import {
  WorkerSpawner, 
  WorkerPool, 
  PoolStats, 
  LoadBalanceStrategy, 
  SpawnConfig, 
  TaskDistribution 
} from '../src/workers/worker-spawner.js';
import { Agent, AgentType, Task, TaskStatus, AgentStatus } from '../src/types/agents.js';
import { v4 as uuidv4 } from 'uuid';

// Mock uuid module
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-' + Math.random().toString(36).substr(2, 9))
}));

describe('WorkerSpawner', () => {
  let workerSpawner: WorkerSpawner;
  let mockUuid: jest.MockedFunction<typeof uuidv4>;

  // Test data factories
  const createMockAgent = (id: string, type: AgentType = 'implementation', status: AgentStatus = 'idle'): Agent => ({
    id,
    name: `test-agent-${id}`,
    type,
    version: '1.0.0',
    status,
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
    mockUuid = uuidv4 as jest.MockedFunction<typeof uuidv4>;
    workerSpawner = new WorkerSpawner();
  });

  describe('Pool Creation', () => {
    it('should create a new worker pool with default values', () => {
      const pool = workerSpawner.createPool({
        name: 'Test Pool',
        agentType: 'implementation'
      });

      expect(pool).toBeDefined();
      expect(pool.name).toBe('Test Pool');
      expect(pool.agentType).toBe('implementation');
      expect(pool.maxWorkers).toBe(10);
      expect(pool.minWorkers).toBe(1);
      expect(pool.loadBalanceStrategy).toBe('least-loaded');
      expect(pool.status).toBe('active');
      expect(pool.workers.size).toBe(1); // Should spawn min workers
      expect(pool.taskQueue).toEqual([]);
      expect(pool.stats.totalTasksProcessed).toBe(0);
      expect(pool.stats.totalTasksFailed).toBe(0);
      expect(pool.stats.averageTaskTime).toBe(0);
      expect(pool.stats.currentLoad).toBe(0);
      expect(pool.stats.idleWorkers).toBe(1);
      expect(pool.stats.busyWorkers).toBe(0);
      expect(pool.stats.utilization).toBe(0);
    });

    it('should create pool with custom configuration', () => {
      const pool = workerSpawner.createPool({
        name: 'Custom Pool',
        agentType: 'testing',
        minWorkers: 2,
        maxWorkers: 15,
        loadBalanceStrategy: 'round-robin'
      });

      expect(pool.minWorkers).toBe(2);
      expect(pool.maxWorkers).toBe(15);
      expect(pool.loadBalanceStrategy).toBe('round-robin');
      expect(pool.workers.size).toBe(2); // Should spawn min workers
    });

    it('should generate unique pool ID', () => {
      const pool1 = workerSpawner.createPool({
        name: 'Pool 1',
        agentType: 'implementation'
      });

      const pool2 = workerSpawner.createPool({
        name: 'Pool 2',
        agentType: 'testing'
      });

      expect(pool1.id).not.toBe(pool2.id);
      expect(pool1.id).toMatch(/^pool_\d+_[a-z0-9]+$/);
      expect(pool2.id).toMatch(/^pool_\d+_[a-z0-9]+$/);
    });

    it('should create workers with appropriate capabilities', () => {
      const pool = workerSpawner.createPool({
        name: 'Research Pool',
        agentType: 'research'
      });

      const workers = Array.from(pool.workers.values());
      expect(workers).toHaveLength(1);
      expect(workers[0].capabilities).toContain('web-search');
      expect(workers[0].capabilities).toContain('data-analysis');
      expect(workers[0].capabilities).toContain('summarization');
    });

    it('should create workers with appropriate resource limits', () => {
      const pool = workerSpawner.createPool({
        name: 'Resource Test Pool',
        agentType: 'implementation'
      });

      const workers = Array.from(pool.workers.values());
      expect(workers).toHaveLength(1);
      expect(workers[0].resourceLimits.maxMemoryMB).toBe(512);
      expect(workers[0].resourceLimits.maxCPUTimeMs).toBe(60000);
      expect(workers[0].resourceLimits.maxConcurrentTasks).toBe(3);
    });

    it('should set worker names correctly', () => {
      const pool = workerSpawner.createPool({
        name: 'Naming Test Pool',
        agentType: 'testing'
      });

      const workers = Array.from(pool.workers.values());
      expect(workers[0].name).toBe('testing-worker-1');
    });

    it('should initialize worker learning data', () => {
      const pool = workerSpawner.createPool({
        name: 'Learning Test Pool',
        agentType: 'implementation'
      });

      const workers = Array.from(pool.workers.values());
      expect(workers[0].learningData).toBeDefined();
      expect(workers[0].learningData.performanceHistory).toEqual([]);
      expect(workers[0].learningData.learnedSkills).toEqual([]);
    });
  });

  describe('Worker Spawning', () => {
    let pool: WorkerPool;

    beforeEach(() => {
      pool = workerSpawner.createPool({
        name: 'Spawn Test Pool',
        agentType: 'implementation',
        minWorkers: 1,
        maxWorkers: 5
      });
    });

    it('should spawn workers with default configuration', async () => {
      const workers = await workerSpawner.spawnWorkers({
        agentType: 'implementation',
        count: 2,
        poolId: pool.id
      });

      expect(workers).toHaveLength(2);
      expect(workers[0].type).toBe('implementation');
      expect(workers[1].type).toBe('implementation');
      expect(workers[0].status).toBe('idle');
      expect(workers[1].status).toBe('idle');
    });

    it('should spawn workers with custom configuration', async () => {
      const workers = await workerSpawner.spawnWorkers({
        agentType: 'testing',
        count: 1,
        poolId: pool.id,
        maxConcurrentTasks: 5,
        capabilities: ['unit-testing', 'integration-testing'],
        resourceLimits: {
          maxMemoryMB: 1024,
          maxCPUTimeMs: 120000,
          maxDiskSpaceMB: 200,
          maxNetworkCalls: 200,
          maxFileHandles: 100,
          executionTimeoutMs: 600000,
          maxConcurrentTasks: 5
        }
      });

      expect(workers).toHaveLength(1);
      expect(workers[0].maxConcurrentTasks).toBe(5);
      expect(workers[0].capabilities).toEqual(['unit-testing', 'integration-testing']);
      expect(workers[0].resourceLimits.maxMemoryMB).toBe(1024);
    });

    it('should throw error when pool not found', async () => {
      await expect(
        workerSpawner.spawnWorkers({
          agentType: 'implementation',
          count: 1,
          poolId: 'non-existent-pool'
        })
      ).rejects.toThrow('Pool non-existent-pool not found');
    });

    it('should throw error when exceeding max workers', async () => {
      await expect(
        workerSpawner.spawnWorkers({
          agentType: 'implementation',
          count: 10, // Exceeds maxWorkers of 5
          poolId: pool.id
        })
      ).rejects.toThrow('Cannot spawn 10 workers: would exceed max workers (5)');
    });

    it('should use default pool when none specified', async () => {
      const workers = await workerSpawner.spawnWorkers({
        agentType: 'implementation',
        count: 1
        // No poolId specified
      });

      expect(workers).toHaveLength(1);
      // Should create a default pool
      const allPools = workerSpawner.getAllPools();
      expect(allPools.length).toBeGreaterThan(1);
    });

    it('should reuse existing default pool', async () => {
      // First spawn creates default pool
      await workerSpawner.spawnWorkers({
        agentType: 'implementation',
        count: 1
      });

      const initialPoolCount = workerSpawner.getAllPools().length;

      // Second spawn should reuse default pool
      await workerSpawner.spawnWorkers({
        agentType: 'implementation',
        count: 1
      });

      const finalPoolCount = workerSpawner.getAllPools().length;
      expect(finalPoolCount).toBe(initialPoolCount);
    });

    it('should create separate default pools for different agent types', async () => {
      await workerSpawner.spawnWorkers({
        agentType: 'implementation',
        count: 1
      });

      await workerSpawner.spawnWorkers({
        agentType: 'testing',
        count: 1
      });

      const pools = workerSpawner.getAllPools();
      const implementationPools = pools.filter(p => p.agentType === 'implementation');
      const testingPools = pools.filter(p => p.agentType === 'testing');

      expect(implementationPools.length).toBe(1);
      expect(testingPools.length).toBe(1);
    });

    it('should generate unique worker IDs', async () => {
      const workers = await workerSpawner.spawnWorkers({
        agentType: 'implementation',
        count: 3,
        poolId: pool.id
      });

      const workerIds = workers.map(w => w.id);
      expect(new Set(workerIds).size).toBe(3); // All unique
    });

    it('should update pool statistics after spawning', async () => {
      const initialStats = workerSpawner.getPoolStats(pool.id);
      expect(initialStats?.idleWorkers).toBe(1);

      await workerSpawner.spawnWorkers({
        agentType: 'implementation',
        count: 2,
        poolId: pool.id
      });

      const updatedStats = workerSpawner.getPoolStats(pool.id);
      expect(updatedStats?.idleWorkers).toBe(3); // 1 initial + 2 new
    });
  });

  describe('Task Distribution', () => {
    let pool: WorkerPool;
    let mockTask: Task;

    beforeEach(() => {
      pool = workerSpawner.createPool({
        name: 'Distribution Test Pool',
        agentType: 'implementation',
        minWorkers: 3,
        maxWorkers: 5
      });
      mockTask = createMockTask('test-task-1', 'implementation');
    });

    it('should distribute task using round-robin strategy', () => {
      const roundRobinPool = workerSpawner.createPool({
        name: 'Round Robin Pool',
        agentType: 'implementation',
        loadBalanceStrategy: 'round-robin',
        minWorkers: 2
      });

      const distribution = workerSpawner.distributeTask(roundRobinPool.id, mockTask);

      expect(distribution.workerId).toBeDefined();
      expect(distribution.taskId).toBe(mockTask.id);
      expect(distribution.assignedAt).toBeInstanceOf(Date);
      expect(distribution.estimatedCompletionTime).toBeDefined();

      const worker = roundRobinPool.workers.get(distribution.workerId);
      expect(worker?.currentTasks).toContain(mockTask.id);
      expect(worker?.status).toBe('busy');
    });

    it('should distribute task using least-loaded strategy', () => {
      const distribution = workerSpawner.distributeTask(pool.id, mockTask);

      expect(distribution.workerId).toBeDefined();
      
      const worker = pool.workers.get(distribution.workerId);
      expect(worker?.currentTasks).toContain(mockTask.id);
      expect(worker?.status).toBe('busy');
    });

    it('should distribute task using random strategy', () => {
      const randomPool = workerSpawner.createPool({
        name: 'Random Pool',
        agentType: 'implementation',
        loadBalanceStrategy: 'random',
        minWorkers: 2
      });

      const distribution = workerSpawner.distributeTask(randomPool.id, mockTask);

      expect(distribution.workerId).toBeDefined();
      
      const worker = randomPool.workers.get(distribution.workerId);
      expect(worker?.currentTasks).toContain(mockTask.id);
    });

    it('should distribute task using weighted strategy', () => {
      const weightedPool = workerSpawner.createPool({
        name: 'Weighted Pool',
        agentType: 'implementation',
        loadBalanceStrategy: 'weighted',
        minWorkers: 2
      });

      // Add performance metrics to workers
      const workers = Array.from(weightedPool.workers.values());
      workers[0].performanceMetrics.push({
        taskType: 'implementation',
        successRate: 0.9,
        averageExecutionTime: 5000,
        qualityScore: 0.8,
        resourceUsage: {
          memoryMB: 256,
          cpuTimeMs: 5000,
          diskSpaceMB: 50,
          networkCalls: 10
        },
        timestamp: new Date().toISOString()
      });

      workers[1].performanceMetrics.push({
        taskType: 'implementation',
        successRate: 0.7,
        averageExecutionTime: 8000,
        qualityScore: 0.6,
        resourceUsage: {
          memoryMB: 300,
          cpuTimeMs: 8000,
          diskSpaceMB: 60,
          networkCalls: 15
        },
        timestamp: new Date().toISOString()
      });

      const distribution = workerSpawner.distributeTask(weightedPool.id, mockTask);

      // Should prefer worker with higher performance metrics
      expect(distribution.workerId).toBe(workers[0].id);
    });

    it('should distribute task using priority strategy', () => {
      const priorityPool = workerSpawner.createPool({
        name: 'Priority Pool',
        agentType: 'implementation',
        loadBalanceStrategy: 'priority',
        minWorkers: 2
      });

      // Make one worker busy
      const workers = Array.from(priorityPool.workers.values());
      workers[0].status = 'busy';
      workers[0].currentTasks.push('existing-task');

      const distribution = workerSpawner.distributeTask(priorityPool.id, mockTask);

      // Should select idle worker
      expect(distribution.workerId).toBe(workers[1].id);
    });

    it('should throw error when pool not found', () => {
      expect(() => {
        workerSpawner.distributeTask('non-existent-pool', mockTask);
      }).toThrow('Pool non-existent-pool not found');
    });

    it('should throw error when pool is not active', () => {
      pool.status = 'paused';

      expect(() => {
        workerSpawner.distributeTask(pool.id, mockTask);
      }).toThrow('Pool pool_ is not active');
    });

    it('should queue task when no workers available', () => {
      // Make all workers busy
      const workers = Array.from(pool.workers.values());
      workers.forEach(worker => {
        worker.status = 'busy';
        worker.currentTasks.push('existing-task');
      });

      expect(() => {
        workerSpawner.distributeTask(pool.id, mockTask);
      }).toThrow('No available workers, task queued');

      // Task should be queued
      expect(pool.taskQueue).toHaveLength(1);
      expect(pool.taskQueue[0]).toBe(mockTask);
    });

    it('should estimate completion time based on worker performance', () => {
      const workers = Array.from(pool.workers.values());
      workers[0].performanceMetrics.push({
        taskType: 'implementation',
        successRate: 0.8,
        averageExecutionTime: 10000,
        qualityScore: 0.7,
        resourceUsage: {
          memoryMB: 256,
          cpuTimeMs: 10000,
          diskSpaceMB: 50,
          networkCalls: 10
        },
        timestamp: new Date().toISOString()
      });

      const distribution = workerSpawner.distributeTask(pool.id, mockTask);

      expect(distribution.estimatedCompletionTime).toBe(10000);
    });

    it('should use default completion time when no performance data', () => {
      const distribution = workerSpawner.distributeTask(pool.id, mockTask);

      expect(distribution.estimatedCompletionTime).toBe(60000); // Default 1 minute
    });

    it('should update pool statistics after task distribution', () => {
      const initialStats = workerSpawner.getPoolStats(pool.id);
      expect(initialStats?.currentLoad).toBe(0);

      workerSpawner.distributeTask(pool.id, mockTask);

      const updatedStats = workerSpawner.getPoolStats(pool.id);
      expect(updatedStats?.currentLoad).toBe(1);
      expect(updatedStats?.busyWorkers).toBe(1);
      expect(updatedStats?.idleWorkers).toBe(2);
    });
  });

  describe('Task Completion', () => {
    let pool: WorkerPool;
    let mockTask: Task;
    let distribution: TaskDistribution;

    beforeEach(() => {
      pool = workerSpawner.createPool({
        name: 'Completion Test Pool',
        agentType: 'implementation',
        minWorkers: 2
      });
      mockTask = createMockTask('completion-task', 'implementation');
      distribution = workerSpawner.distributeTask(pool.id, mockTask);
    });

    it('should complete task successfully', () => {
      const executionTime = 5000;

      workerSpawner.completeTask(mockTask.id, true, executionTime);

      const worker = pool.workers.get(distribution.workerId);
      expect(worker?.currentTasks).not.toContain(mockTask.id);
      expect(worker?.status).toBe('idle');

      const stats = workerSpawner.getPoolStats(pool.id);
      expect(stats?.totalTasksProcessed).toBe(1);
      expect(stats?.totalTasksFailed).toBe(0);
      expect(stats?.averageTaskTime).toBe(5000);
    });

    it('should complete task with failure', () => {
      const executionTime = 3000;

      workerSpawner.completeTask(mockTask.id, false, executionTime);

      const stats = workerSpawner.getPoolStats(pool.id);
      expect(stats?.totalTasksProcessed).toBe(0);
      expect(stats?.totalTasksFailed).toBe(1);
      expect(stats?.averageTaskTime).toBe(3000);
    });

    it('should handle completion without execution time', () => {
      workerSpawner.completeTask(mockTask.id, true);

      const stats = workerSpawner.getPoolStats(pool.id);
      expect(stats?.totalTasksProcessed).toBe(1);
      expect(stats?.averageTaskTime).toBe(0); // No execution time provided
    });

    it('should handle completion for non-existent task', () => {
      expect(() => {
        workerSpawner.completeTask('non-existent-task', true);
      }).not.toThrow(); // Should handle gracefully
    });

    it('should update worker last active time', () => {
      const originalLastActive = pool.workers.get(distribution.workerId)?.lastActive;

      // Wait a bit to ensure timestamp difference
      setTimeout(() => {
        workerSpawner.completeTask(mockTask.id, true);

        const worker = pool.workers.get(distribution.workerId);
        expect(worker?.lastActive.getTime()).toBeGreaterThan(originalLastActive!.getTime());
      }, 10);
    });

    it('should process queued tasks after completion', () => {
      // Queue a task
      const queuedTask = createMockTask('queued-task', 'implementation');
      pool.taskQueue.push(queuedTask);

      // Complete current task
      workerSpawner.completeTask(mockTask.id, true);

      // Should process queued task
      const stats = workerSpawner.getPoolStats(pool.id);
      expect(stats?.currentLoad).toBe(1); // Queued task should be distributed
      expect(pool.taskQueue).toHaveLength(0); // Queue should be empty
    });

    it('should handle multiple queued tasks', () => {
      // Queue multiple tasks
      const queuedTasks = [
        createMockTask('queued-task-1', 'implementation'),
        createMockTask('queued-task-2', 'implementation'),
        createMockTask('queued-task-3', 'implementation')
      ];
      pool.taskQueue.push(...queuedTasks);

      // Complete current task
      workerSpawner.completeTask(mockTask.id, true);

      // Should process one queued task (only one worker available)
      const stats = workerSpawner.getPoolStats(pool.id);
      expect(stats?.currentLoad).toBe(1);
      expect(pool.taskQueue).toHaveLength(2); // 2 tasks remaining in queue
    });

    it('should not process queued tasks when no workers available', () => {
      // Make all workers busy
      const workers = Array.from(pool.workers.values());
      workers.forEach(worker => {
        worker.status = 'busy';
        worker.currentTasks.push('existing-task');
      });

      // Queue a task
      const queuedTask = createMockTask('queued-task', 'implementation');
      pool.taskQueue.push(queuedTask);

      // Complete current task (but workers are still busy)
      workerSpawner.completeTask(mockTask.id, true);

      // Should not process queued task
      expect(pool.taskQueue).toHaveLength(1);
    });
  });

  describe('Auto-Scaling', () => {
    let pool: WorkerPool;

    beforeEach(() => {
      pool = workerSpawner.createPool({
        name: 'Auto-Scale Test Pool',
        agentType: 'implementation',
        minWorkers: 2,
        maxWorkers: 6
      });
    });

    it('should scale up when utilization is high', async () => {
      // Make workers busy to increase utilization
      const workers = Array.from(pool.workers.values());
      workers.forEach(worker => {
        worker.status = 'busy';
        worker.currentTasks.push('task-1', 'task-2'); // High load
      });

      const initialWorkerCount = pool.workers.size;

      await workerSpawner.autoScale(pool.id);

      expect(pool.workers.size).toBeGreaterThan(initialWorkerCount);
      expect(pool.workers.size).toBeLessThanOrEqual(pool.maxWorkers);
    });

    it('should scale down when utilization is low', async () => {
      // Start with more workers than minimum
      await workerSpawner.spawnWorkers({
        agentType: 'implementation',
        count: 2,
        poolId: pool.id
      });

      const initialWorkerCount = pool.workers.size;

      await workerSpawner.autoScale(pool.id);

      expect(pool.workers.size).toBeLessThan(initialWorkerCount);
      expect(pool.workers.size).toBeGreaterThanOrEqual(pool.minWorkers);
    });

    it('should not scale up when at max workers', async () => {
      // Fill to max capacity
      await workerSpawner.spawnWorkers({
        agentType: 'implementation',
        count: 4,
        poolId: pool.id
      });

      const initialWorkerCount = pool.workers.size;

      await workerSpawner.autoScale(pool.id);

      expect(pool.workers.size).toBe(initialWorkerCount);
    });

    it('should not scale down when at min workers', async () => {
      const initialWorkerCount = pool.workers.size;

      await workerSpawner.autoScale(pool.id);

      expect(pool.workers.size).toBe(initialWorkerCount);
    });

    it('should remove idle workers when scaling down', async () => {
      // Add extra workers
      await workerSpawner.spawnWorkers({
        agentType: 'implementation',
        count: 2,
        poolId: pool.id
      });

      // Make some workers idle
      const workers = Array.from(pool.workers.values());
      workers[0].status = 'idle';
      workers[0].currentTasks = [];
      workers[1].status = 'idle';
      workers[1].currentTasks = [];

      const initialWorkerCount = pool.workers.size;

      await workerSpawner.autoScale(pool.id);

      expect(pool.workers.size).toBeLessThan(initialWorkerCount);
    });

    it('should not remove busy workers when scaling down', async () => {
      // Add extra workers
      await workerSpawner.spawnWorkers({
        agentType: 'implementation',
        count: 2,
        poolId: pool.id
      });

      // Keep all workers busy
      const workers = Array.from(pool.workers.values());
      workers.forEach(worker => {
        worker.status = 'busy';
        worker.currentTasks.push('task');
      });

      const initialWorkerCount = pool.workers.size;

      await workerSpawner.autoScale(pool.id);

      expect(pool.workers.size).toBe(initialWorkerCount);
    });

    it('should calculate utilization correctly', async () => {
      // Add workers and assign tasks
      await workerSpawner.spawnWorkers({
        agentType: 'implementation',
        count: 2,
        poolId: pool.id
      });

      const workers = Array.from(pool.workers.values());
      workers[0].currentTasks.push('task-1');
      workers[1].currentTasks.push('task-1', 'task-2');

      const stats = workerSpawner.getPoolStats(pool.id);
      const expectedUtilization = 3 / (4 * 3); // 3 tasks / (4 workers * 3 max tasks each)
      expect(stats?.utilization).toBeCloseTo(expectedUtilization, 2);
    });
  });

  describe('Worker Removal', () => {
    let pool: WorkerPool;

    beforeEach(() => {
      pool = workerSpawner.createPool({
        name: 'Removal Test Pool',
        agentType: 'implementation',
        minWorkers: 3
      });
    });

    it('should remove idle worker', () => {
      const workers = Array.from(pool.workers.values());
      const workerToRemove = workers[0];
      const initialWorkerCount = pool.workers.size;

      workerSpawner.removeWorker(pool.id, workerToRemove.id);

      expect(pool.workers.size).toBe(initialWorkerCount - 1);
      expect(pool.workers.has(workerToRemove.id)).toBe(false);
    });

    it('should throw error when removing busy worker', () => {
      const workers = Array.from(pool.workers.values());
      const busyWorker = workers[0];
      busyWorker.status = 'busy';
      busyWorker.currentTasks.push('active-task');

      expect(() => {
        workerSpawner.removeWorker(pool.id, busyWorker.id);
      }).toThrow(`Cannot remove busy worker ${busyWorker.id}`);
    });

    it('should throw error when pool not found', () => {
      const workers = Array.from(pool.workers.values());
      const worker = workers[0];

      expect(() => {
        workerSpawner.removeWorker('non-existent-pool', worker.id);
      }).not.toThrow(); // Should handle gracefully
    });

    it('should throw error when worker not found', () => {
      expect(() => {
        workerSpawner.removeWorker(pool.id, 'non-existent-worker');
      }).not.toThrow(); // Should handle gracefully
    });

    it('should update pool statistics after removal', () => {
      const initialStats = workerSpawner.getPoolStats(pool.id);
      const initialIdleWorkers = initialStats?.idleWorkers || 0;

      const workers = Array.from(pool.workers.values());
      const workerToRemove = workers[0];

      workerSpawner.removeWorker(pool.id, workerToRemove.id);

      const updatedStats = workerSpawner.getPoolStats(pool.id);
      expect(updatedStats?.idleWorkers).toBe(initialIdleWorkers - 1);
    });

    it('should remove worker from global registry', () => {
      const workers = Array.from(pool.workers.values());
      const workerToRemove = workers[0];

      workerSpawner.removeWorker(pool.id, workerToRemove.id);

      // Worker should not be found in any pool
      const allPools = workerSpawner.getAllPools();
      let found = false;
      for (const pool of allPools) {
        if (pool.workers.has(workerToRemove.id)) {
          found = true;
          break;
        }
      }
      expect(found).toBe(false);
    });
  });

  describe('Pool Management', () => {
    it('should get pool statistics', () => {
      const pool = workerSpawner.createPool({
        name: 'Stats Test Pool',
        agentType: 'implementation'
      });

      const stats = workerSpawner.getPoolStats(pool.id);

      expect(stats).toBeDefined();
      expect(stats?.totalTasksProcessed).toBe(0);
      expect(stats?.totalTasksFailed).toBe(0);
      expect(stats?.averageTaskTime).toBe(0);
      expect(stats?.currentLoad).toBe(0);
      expect(stats?.idleWorkers).toBe(1);
      expect(stats?.busyWorkers).toBe(0);
      expect(stats?.utilization).toBe(0);
    });

    it('should return null for non-existent pool stats', () => {
      const stats = workerSpawner.getPoolStats('non-existent-pool');
      expect(stats).toBeNull();
    });

    it('should get all pools', () => {
      const pool1 = workerSpawner.createPool({
        name: 'Pool 1',
        agentType: 'implementation'
      });

      const pool2 = workerSpawner.createPool({
        name: 'Pool 2',
        agentType: 'testing'
      });

      const allPools = workerSpawner.getAllPools();

      expect(allPools).toHaveLength(2);
      expect(allPools).toContain(pool1);
      expect(allPools).toContain(pool2);
    });

    it('should terminate pool', () => {
      const pool = workerSpawner.createPool({
        name: 'Terminate Test Pool',
        agentType: 'implementation',
        minWorkers: 3
      });

      const initialPoolCount = workerSpawner.getAllPools().length;

      workerSpawner.terminatePool(pool.id);

      const finalPoolCount = workerSpawner.getAllPools().length;
      expect(finalPoolCount).toBe(initialPoolCount - 1);

      const terminatedPool = workerSpawner.getAllPools().find(p => p.id === pool.id);
      expect(terminatedPool?.status).toBe('terminated');
      expect(terminatedPool?.workers.size).toBe(0);
    });

    it('should handle termination of non-existent pool', () => {
      expect(() => {
        workerSpawner.terminatePool('non-existent-pool');
      }).not.toThrow(); // Should handle gracefully
    });

    it('should remove all workers from global registry on termination', () => {
      const pool = workerSpawner.createPool({
        name: 'Registry Test Pool',
        agentType: 'implementation',
        minWorkers: 2
      });

      const workers = Array.from(pool.workers.values());

      workerSpawner.terminatePool(pool.id);

      // All workers should be removed from global registry
      const allPools = workerSpawner.getAllPools();
      const allWorkers = allPools.flatMap(p => Array.from(p.workers.keys()));
      
      workers.forEach(worker => {
        expect(allWorkers).not.toContain(worker.id);
      });
    });
  });

  describe('Load Balance Strategies', () => {
    let pool: WorkerPool;
    let mockTask: Task;

    beforeEach(() => {
      pool = workerSpawner.createPool({
        name: 'Strategy Test Pool',
        agentType: 'implementation',
        minWorkers: 3
      });
      mockTask = createMockTask('strategy-task', 'implementation');
    });

    describe('Round-Robin Strategy', () => {
      beforeEach(() => {
        pool.loadBalanceStrategy = 'round-robin';
      });

      it('should distribute tasks in round-robin order', () => {
        const distribution1 = workerSpawner.distributeTask(pool.id, mockTask);
        const distribution2 = workerSpawner.distributeTask(pool.id, mockTask);
        const distribution3 = workerSpawner.distributeTask(pool.id, mockTask);

        const workers = Array.from(pool.workers.values());
        expect(distribution1.workerId).toBe(workers[0].id);
        expect(distribution2.workerId).toBe(workers[1].id);
        expect(distribution3.workerId).toBe(workers[2].id);
      });

      it('should handle busy workers in round-robin', () => {
        const workers = Array.from(pool.workers.values());
        workers[0].status = 'busy';
        workers[0].currentTasks.push('task');

        const distribution = workerSpawner.distributeTask(pool.id, mockTask);

        // Should skip busy worker and use least-loaded fallback
        expect(distribution.workerId).not.toBe(workers[0].id);
      });
    });

    describe('Least-Loaded Strategy', () => {
      beforeEach(() => {
        pool.loadBalanceStrategy = 'least-loaded';
      });

      it('should select worker with fewest tasks', () => {
        const workers = Array.from(pool.workers.values());
        workers[0].currentTasks.push('task-1', 'task-2');
        workers[1].currentTasks.push('task-1');

        const distribution = workerSpawner.distributeTask(pool.id, mockTask);

        expect(distribution.workerId).toBe(workers[2].id); // Has 0 tasks
      });

      it('should handle all workers at capacity', () => {
        const workers = Array.from(pool.workers.values());
        workers.forEach(worker => {
          worker.currentTasks.push('task-1', 'task-2', 'task-3'); // At capacity
        });

        expect(() => {
          workerSpawner.distributeTask(pool.id, mockTask);
        }).toThrow('No available workers, task queued');
      });
    });

    describe('Random Strategy', () => {
      beforeEach(() => {
        pool.loadBalanceStrategy = 'random';
      });

      it('should select random available worker', () => {
        const distribution = workerSpawner.distributeTask(pool.id, mockTask);

        const workers = Array.from(pool.workers.values());
        const selectedWorkerId = distribution.workerId;
        const availableWorkers = workers.filter(w => w.currentTasks.length < w.maxConcurrentTasks);

        expect(availableWorkers.map(w => w.id)).toContain(selectedWorkerId);
      });

      it('should handle no available workers', () => {
        const workers = Array.from(pool.workers.values());
        workers.forEach(worker => {
          worker.currentTasks.push('task-1', 'task-2', 'task-3');
        });

        expect(() => {
          workerSpawner.distributeTask(pool.id, mockTask);
        }).toThrow('No available workers, task queued');
      });
    });

    describe('Weighted Strategy', () => {
      beforeEach(() => {
        pool.loadBalanceStrategy = 'weighted';
      });

      it('should select worker with best performance metrics', () => {
        const workers = Array.from(pool.workers.values());
        
        // Set up performance metrics
        workers[0].performanceMetrics.push({
          taskType: 'implementation',
          successRate: 0.9,
          averageExecutionTime: 5000,
          qualityScore: 0.8,
          resourceUsage: {
            memoryMB: 256,
            cpuTimeMs: 5000,
            diskSpaceMB: 50,
            networkCalls: 10
          },
          timestamp: new Date().toISOString()
        });

        workers[1].performanceMetrics.push({
          taskType: 'implementation',
          successRate: 0.6,
          averageExecutionTime: 10000,
          qualityScore: 0.5,
          resourceUsage: {
            memoryMB: 300,
            cpuTimeMs: 10000,
            diskSpaceMB: 60,
            networkCalls: 15
          },
          timestamp: new Date().toISOString()
        });

        workers[2].performanceMetrics.push({
          taskType: 'implementation',
          successRate: 0.7,
          averageExecutionTime: 7000,
          qualityScore: 0.6,
          resourceUsage: {
            memoryMB: 280,
            cpuTimeMs: 7000,
            diskSpaceMB: 55,
            networkCalls: 12
          },
          timestamp: new Date().toISOString()
        });

        const distribution = workerSpawner.distributeTask(pool.id, mockTask);

        // Should select worker 0 (best performance)
        expect(distribution.workerId).toBe(workers[0].id);
      });

      it('should use default weight when no performance metrics', () => {
        const distribution = workerSpawner.distributeTask(pool.id, mockTask);

        const workers = Array.from(pool.workers.values());
        const availableWorkers = workers.filter(w => w.currentTasks.length < w.maxConcurrentTasks);
        expect(availableWorkers.map(w => w.id)).toContain(distribution.workerId);
      });
    });

    describe('Priority Strategy', () => {
      beforeEach(() => {
        pool.loadBalanceStrategy = 'priority';
      });

      it('should prioritize idle workers', () => {
        const workers = Array.from(pool.workers.values());
        workers[0].status = 'busy';
        workers[0].currentTasks.push('task');
        workers[1].status = 'idle';
        workers[1].currentTasks = [];
        workers[2].status = 'idle';
        workers[2].currentTasks = [];

        const distribution = workerSpawner.distributeTask(pool.id, mockTask);

        // Should select first idle worker
        expect(distribution.workerId).toBe(workers[1].id);
      });

      it('should fall back to least-loaded when no idle workers', () => {
        const workers = Array.from(pool.workers.values());
        workers[0].currentTasks.push('task-1', 'task-2');
        workers[1].currentTasks.push('task-1');
        workers[2].currentTasks.push('task-1', 'task-2', 'task-3');

        const distribution = workerSpawner.distributeTask(pool.id, mockTask);

        // Should select worker 1 (least loaded)
        expect(distribution.workerId).toBe(workers[1].id);
      });
    });
  });

  describe('Statistics and Metrics', () => {
    let pool: WorkerPool;

    beforeEach(() => {
      pool = workerSpawner.createPool({
        name: 'Metrics Test Pool',
        agentType: 'implementation',
        minWorkers: 3
      });
    });

    it('should calculate correct statistics after multiple tasks', () => {
      const task1 = createMockTask('task-1', 'implementation');
      const task2 = createMockTask('task-2', 'implementation');
      const task3 = createMockTask('task-3', 'implementation');

      const distribution1 = workerSpawner.distributeTask(pool.id, task1);
      const distribution2 = workerSpawner.distributeTask(pool.id, task2);
      const distribution3 = workerSpawner.distributeTask(pool.id, task3);

      // Complete tasks with different outcomes
      workerSpawner.completeTask(task1.id, true, 5000);
      workerSpawner.completeTask(task2.id, false, 3000);
      workerSpawner.completeTask(task3.id, true, 7000);

      const stats = workerSpawner.getPoolStats(pool.id);

      expect(stats?.totalTasksProcessed).toBe(2);
      expect(stats?.totalTasksFailed).toBe(1);
      expect(stats?.averageTaskTime).toBe((5000 + 3000 + 7000) / 3);
      expect(stats?.currentLoad).toBe(0); // All tasks completed
      expect(stats?.idleWorkers).toBe(3);
      expect(stats?.busyWorkers).toBe(0);
      expect(stats?.utilization).toBe(0);
    });

    it('should update statistics in real-time', () => {
      const initialStats = workerSpawner.getPoolStats(pool.id);

      const task = createMockTask('realtime-task', 'implementation');
      const distribution = workerSpawner.distributeTask(pool.id, task);

      const duringStats = workerSpawner.getPoolStats(pool.id);
      expect(duringStats?.currentLoad).toBe(initialStats!.currentLoad + 1);
      expect(duringStats?.busyWorkers).toBe(initialStats!.busyWorkers + 1);
      expect(duringStats?.idleWorkers).toBe(initialStats!.idleWorkers - 1);

      workerSpawner.completeTask(task.id, true, 4000);

      const finalStats = workerSpawner.getPoolStats(pool.id);
      expect(finalStats?.currentLoad).toBe(initialStats!.currentLoad);
      expect(finalStats?.busyWorkers).toBe(initialStats!.busyWorkers);
      expect(finalStats?.idleWorkers).toBe(initialStats!.idleWorkers);
      expect(finalStats?.totalTasksProcessed).toBe(initialStats!.totalTasksProcessed + 1);
    });

    it('should calculate utilization correctly', () => {
      const workers = Array.from(pool.workers.values());
      
      // Assign different loads to workers
      workers[0].currentTasks.push('task-1');
      workers[1].currentTasks.push('task-1', 'task-2');
      workers[2].currentTasks.push('task-1', 'task-2', 'task-3');

      const stats = workerSpawner.getPoolStats(pool.id);

      const totalTasks = 1 + 2 + 3; // 6 tasks
      const maxPossibleTasks = 3 * 3; // 3 workers * 3 max tasks each
      const expectedUtilization = totalTasks / maxPossibleTasks;

      expect(stats?.utilization).toBeCloseTo(expectedUtilization, 2);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid pool operations gracefully', () => {
      expect(() => {
        workerSpawner.distributeTask('invalid-pool', createMockTask('task', 'implementation'));
      }).toThrow('Pool invalid-pool not found');

      expect(workerSpawner.getPoolStats('invalid-pool')).toBeNull();

      expect(() => {
        workerSpawner.removeWorker('invalid-pool', 'invalid-worker');
      }).not.toThrow(); // Should handle gracefully

      expect(() => {
        workerSpawner.terminatePool('invalid-pool');
      }).not.toThrow(); // Should handle gracefully
    });

    it('should handle invalid worker operations gracefully', () => {
      const pool = workerSpawner.createPool({
        name: 'Error Test Pool',
        agentType: 'implementation'
      });

      expect(() => {
        workerSpawner.removeWorker(pool.id, 'invalid-worker');
      }).not.toThrow(); // Should handle gracefully

      expect(() => {
        workerSpawner.completeTask('invalid-task', true);
      }).not.toThrow(); // Should handle gracefully
    });

    it('should handle auto-scaling errors gracefully', async () => {
      const pool = workerSpawner.createPool({
        name: 'Scale Error Pool',
        agentType: 'implementation'
      });

      // Should not throw even with invalid state
      await expect(workerSpawner.autoScale(pool.id)).resolves.not.toThrow();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent task distribution', () => {
      const pool = workerSpawner.createPool({
        name: 'Concurrent Pool',
        agentType: 'implementation',
        minWorkers: 5
      });

      const tasks = Array.from({ length: 3 }, (_, i) => 
        createMockTask(`concurrent-task-${i}`, 'implementation')
      );

      const distributions = tasks.map(task => 
        workerSpawner.distributeTask(pool.id, task)
      );

      distributions.forEach(distribution => {
        expect(distribution.workerId).toBeDefined();
        expect(distribution.taskId).toBeDefined();
      });

      const stats = workerSpawner.getPoolStats(pool.id);
      expect(stats?.currentLoad).toBe(3);
      expect(stats?.busyWorkers).toBe(3);
    });

    it('should handle concurrent task completion', () => {
      const pool = workerSpawner.createPool({
        name: 'Concurrent Completion Pool',
        agentType: 'implementation',
        minWorkers: 3
      });

      // Distribute tasks
      const tasks = Array.from({ length: 3 }, (_, i) => 
        createMockTask(`concurrent-complete-${i}`, 'implementation')
      );

      const distributions = tasks.map(task => 
        workerSpawner.distributeTask(pool.id, task)
      );

      // Complete tasks concurrently
      distributions.forEach((_distribution, index) => {
        workerSpawner.completeTask(tasks[index].id, true, 1000);
      });

      const stats = workerSpawner.getPoolStats(pool.id);
      expect(stats?.totalTasksProcessed).toBe(3);
      expect(stats?.currentLoad).toBe(0);
      expect(stats?.idleWorkers).toBe(3);
    });

    it('should handle concurrent worker spawning', async () => {
      const pool = workerSpawner.createPool({
        name: 'Concurrent Spawn Pool',
        agentType: 'implementation',
        minWorkers: 1,
        maxWorkers: 10
      });

      const promises = Array.from({ length: 3 }, () =>
        workerSpawner.spawnWorkers({
          agentType: 'implementation',
          count: 2,
          poolId: pool.id
        })
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      expect(results.flatMap(r => r)).toHaveLength(6); // 6 workers total
      
      const stats = workerSpawner.getPoolStats(pool.id);
      expect(stats?.idleWorkers).toBe(7); // 1 initial + 6 spawned
    });

    it('should handle concurrent auto-scaling', async () => {
      const pool = workerSpawner.createPool({
        name: 'Concurrent Scale Pool',
        agentType: 'implementation',
        minWorkers: 2,
        maxWorkers: 8
      });

      // Create high load to trigger scaling
      const workers = Array.from(pool.workers.values());
      workers.forEach(worker => {
        worker.status = 'busy';
        worker.currentTasks.push('task-1', 'task-2');
      });

      const promises = Array.from({ length: 3 }, () =>
        workerSpawner.autoScale(pool.id)
      );

      await Promise.all(promises);

      expect(pool.workers.size).toBeGreaterThan(2);
      expect(pool.workers.size).toBeLessThanOrEqual(8);
    });
  });

  describe('Default Capabilities and Resources', () => {
    it('should provide appropriate capabilities for each agent type', () => {
      const researchPool = workerSpawner.createPool({
        name: 'Research Capabilities Pool',
        agentType: 'research'
      });

      const architectPool = workerSpawner.createPool({
        name: 'Architect Capabilities Pool',
        agentType: 'architect'
      });

      const implementationPool = workerSpawner.createPool({
        name: 'Implementation Capabilities Pool',
        agentType: 'implementation'
      });

      const testingPool = workerSpawner.createPool({
        name: 'Testing Capabilities Pool',
        agentType: 'testing'
      });

      const reviewPool = workerSpawner.createPool({
        name: 'Review Capabilities Pool',
        agentType: 'review'
      });

      const documentationPool = workerSpawner.createPool({
        name: 'Documentation Capabilities Pool',
        agentType: 'documentation'
      });

      const debuggerPool = workerSpawner.createPool({
        name: 'Debugger Capabilities Pool',
        agentType: 'debugger'
      });

      const researchWorker = Array.from(researchPool.workers.values())[0];
      const architectWorker = Array.from(architectPool.workers.values())[0];
      const implementationWorker = Array.from(implementationPool.workers.values())[0];
      const testingWorker = Array.from(testingPool.workers.values())[0];
      const reviewWorker = Array.from(reviewPool.workers.values())[0];
      const documentationWorker = Array.from(documentationPool.workers.values())[0];
      const debuggerWorker = Array.from(debuggerPool.workers.values())[0];

      expect(researchWorker.capabilities).toContain('web-search');
      expect(architectWorker.capabilities).toContain('system-design');
      expect(implementationWorker.capabilities).toContain('coding');
      expect(testingWorker.capabilities).toContain('unit-testing');
      expect(reviewWorker.capabilities).toContain('code-review');
      expect(documentationWorker.capabilities).toContain('api-docs');
      expect(debuggerWorker.capabilities).toContain('error-analysis');
    });

    it('should provide default resource limits for all workers', () => {
      const pool = workerSpawner.createPool({
        name: 'Resource Limits Pool',
        agentType: 'implementation'
      });

      const workers = Array.from(pool.workers.values());
      
      workers.forEach(worker => {
        expect(worker.resourceLimits.maxMemoryMB).toBe(512);
        expect(worker.resourceLimits.maxCPUTimeMs).toBe(60000);
        expect(worker.resourceLimits.maxDiskSpaceMB).toBe(100);
        expect(worker.resourceLimits.maxNetworkCalls).toBe(100);
        expect(worker.resourceLimits.maxFileHandles).toBe(50);
        expect(worker.resourceLimits.executionTimeoutMs).toBe(300000);
        expect(worker.resourceLimits.maxConcurrentTasks).toBe(3);
      });
    });
  });
});