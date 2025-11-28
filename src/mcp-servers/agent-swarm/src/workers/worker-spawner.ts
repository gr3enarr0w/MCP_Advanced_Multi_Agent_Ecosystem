// Worker Spawning and Load Balancing
// Phase 9: Spawn parallel agents, pool management, task distribution

import { Agent, AgentType, Task, AgentStatus } from '../types/agents.js';
import { v4 as uuidv4 } from 'uuid';

export interface WorkerPool {
  id: string;
  name: string;
  agentType: AgentType;
  workers: Map<string, Agent>;
  maxWorkers: number;
  minWorkers: number;
  taskQueue: Task[];
  loadBalanceStrategy: LoadBalanceStrategy;
  status: 'active' | 'paused' | 'terminated';
  createdAt: Date;
  stats: PoolStats;
}

export interface PoolStats {
  totalTasksProcessed: number;
  totalTasksFailed: number;
  averageTaskTime: number;
  currentLoad: number;  // 0-1
  idleWorkers: number;
  busyWorkers: number;
  utilization: number;  // 0-1
}

export type LoadBalanceStrategy =
  | 'round-robin'
  | 'least-loaded'
  | 'random'
  | 'weighted'
  | 'priority';

export interface SpawnConfig {
  agentType: AgentType;
  count: number;
  poolId?: string;
  maxConcurrentTasks?: number;
  capabilities?: string[];
  resourceLimits?: any;
}

export interface TaskDistribution {
  workerId: string;
  taskId: string;
  assignedAt: Date;
  estimatedCompletionTime?: number;
}

/**
 * WorkerSpawner manages pools of parallel agents
 * Handles spawning, pooling, load balancing, and task distribution
 */
export class WorkerSpawner {
  private pools: Map<string, WorkerPool> = new Map();
  private globalWorkerRegistry: Map<string, Agent> = new Map();
  private taskDistributions: Map<string, TaskDistribution> = new Map();

  /**
   * Create a new worker pool
   */
  createPool(params: {
    name: string;
    agentType: AgentType;
    minWorkers?: number;
    maxWorkers?: number;
    loadBalanceStrategy?: LoadBalanceStrategy;
  }): WorkerPool {
    const poolId = `pool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const pool: WorkerPool = {
      id: poolId,
      name: params.name,
      agentType: params.agentType,
      workers: new Map(),
      maxWorkers: params.maxWorkers || 10,
      minWorkers: params.minWorkers || 1,
      taskQueue: [],
      loadBalanceStrategy: params.loadBalanceStrategy || 'least-loaded',
      status: 'active',
      createdAt: new Date(),
      stats: {
        totalTasksProcessed: 0,
        totalTasksFailed: 0,
        averageTaskTime: 0,
        currentLoad: 0,
        idleWorkers: 0,
        busyWorkers: 0,
        utilization: 0
      }
    };

    this.pools.set(poolId, pool);

    // Spawn minimum workers
    for (let i = 0; i < pool.minWorkers; i++) {
      this.spawnWorker(poolId);
    }

    return pool;
  }

  /**
   * Spawn worker agents
   */
  async spawnWorkers(config: SpawnConfig): Promise<Agent[]> {
    const poolId = config.poolId || this.getOrCreateDefaultPool(config.agentType);
    const pool = this.pools.get(poolId);

    if (!pool) {
      throw new Error(`Pool ${poolId} not found`);
    }

    if (pool.workers.size + config.count > pool.maxWorkers) {
      throw new Error(`Cannot spawn ${config.count} workers: would exceed max workers (${pool.maxWorkers})`);
    }

    const workers: Agent[] = [];

    for (let i = 0; i < config.count; i++) {
      const worker = await this.spawnWorker(poolId, config);
      workers.push(worker);
    }

    return workers;
  }

  /**
   * Spawn a single worker
   */
  private async spawnWorker(poolId: string, config?: SpawnConfig): Promise<Agent> {
    const pool = this.pools.get(poolId);
    if (!pool) {
      throw new Error(`Pool ${poolId} not found`);
    }

    const agentId = uuidv4();
    const workerNumber = pool.workers.size + 1;

    const agent: Agent = {
      id: agentId,
      name: `${pool.agentType}-worker-${workerNumber}`,
      type: config?.agentType || pool.agentType,
      version: '1.0.0',
      status: 'idle',
      capabilities: config?.capabilities || this.getDefaultCapabilities(pool.agentType),
      maxConcurrentTasks: config?.maxConcurrentTasks || 3,
      resourceLimits: config?.resourceLimits || this.getDefaultResourceLimits(),
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
    };

    pool.workers.set(agentId, agent);
    this.globalWorkerRegistry.set(agentId, agent);

    this.updatePoolStats(poolId);

    return agent;
  }

  /**
   * Distribute task to a worker using load balancing strategy
   */
  distributeTask(poolId: string, task: Task): TaskDistribution {
    const pool = this.pools.get(poolId);
    if (!pool) {
      throw new Error(`Pool ${poolId} not found`);
    }

    if (pool.status !== 'active') {
      throw new Error(`Pool ${poolId} is not active`);
    }

    // Select worker based on strategy
    const workerId = this.selectWorker(pool, task);

    if (!workerId) {
      // No available workers, queue the task
      pool.taskQueue.push(task);
      throw new Error('No available workers, task queued');
    }

    const worker = pool.workers.get(workerId)!;

    // Assign task to worker
    worker.currentTasks.push(task.id);
    worker.status = 'busy';
    worker.lastActive = new Date();

    const distribution: TaskDistribution = {
      workerId,
      taskId: task.id,
      assignedAt: new Date(),
      estimatedCompletionTime: this.estimateCompletionTime(worker, task)
    };

    this.taskDistributions.set(task.id, distribution);
    this.updatePoolStats(poolId);

    return distribution;
  }

  /**
   * Select worker based on load balance strategy
   */
  private selectWorker(pool: WorkerPool, task: Task): string | null {
    const workers = Array.from(pool.workers.values());

    switch (pool.loadBalanceStrategy) {
      case 'round-robin':
        return this.roundRobinSelect(workers);

      case 'least-loaded':
        return this.leastLoadedSelect(workers);

      case 'random':
        return this.randomSelect(workers);

      case 'weighted':
        return this.weightedSelect(workers, task);

      case 'priority':
        return this.prioritySelect(workers, task);

      default:
        return this.leastLoadedSelect(workers);
    }
  }

  private roundRobinSelect(workers: Agent[]): string | null {
    // Simple round-robin: find first idle worker
    const idle = workers.find(w => w.status === 'idle');
    if (idle) return idle.id;

    // If no idle, find least loaded
    return this.leastLoadedSelect(workers);
  }

  private leastLoadedSelect(workers: Agent[]): string | null {
    if (workers.length === 0) return null;

    // Find worker with fewest current tasks
    const leastLoaded = workers.reduce((min, worker) => {
      if (worker.currentTasks.length < min.currentTasks.length) {
        return worker;
      }
      return min;
    });

    // Don't assign if worker is at capacity
    if (leastLoaded.currentTasks.length >= leastLoaded.maxConcurrentTasks) {
      return null;
    }

    return leastLoaded.id;
  }

  private randomSelect(workers: Agent[]): string | null {
    const available = workers.filter(w => w.currentTasks.length < w.maxConcurrentTasks);
    if (available.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * available.length);
    return available[randomIndex].id;
  }

  private weightedSelect(workers: Agent[], task: Task): string | null {
    // Weight based on performance history
    const available = workers.filter(w => w.currentTasks.length < w.maxConcurrentTasks);
    if (available.length === 0) return null;

    // Calculate weights based on success rate and task type
    const weighted = available.map(worker => {
      const metrics = worker.performanceMetrics.find(m => m.taskType === task.type);
      const weight = metrics ? metrics.successRate * metrics.qualityScore : 0.5;
      return { worker, weight };
    });

    // Select worker with highest weight
    weighted.sort((a, b) => b.weight - a.weight);
    return weighted[0].worker.id;
  }

  private prioritySelect(workers: Agent[], _task: Task): string | null {
    // Prioritize idle workers first, then by load
    const idle = workers.filter(w => w.status === 'idle');

    if (idle.length > 0) {
      return idle[0].id;
    }

    return this.leastLoadedSelect(workers);
  }

  /**
   * Complete a task and update worker status
   */
  completeTask(taskId: string, success: boolean, executionTime?: number): void {
    const distribution = this.taskDistributions.get(taskId);
    if (!distribution) return;

    const worker = this.globalWorkerRegistry.get(distribution.workerId);
    if (!worker) return;

    // Remove task from worker
    worker.currentTasks = worker.currentTasks.filter(t => t !== taskId);

    if (worker.currentTasks.length === 0) {
      worker.status = 'idle';
    }

    worker.lastActive = new Date();

    // Update stats
    const poolId = this.findPoolForWorker(distribution.workerId);
    if (poolId) {
      const pool = this.pools.get(poolId)!;

      if (success) {
        pool.stats.totalTasksProcessed++;
      } else {
        pool.stats.totalTasksFailed++;
      }

      if (executionTime) {
        const totalTasks = pool.stats.totalTasksProcessed + pool.stats.totalTasksFailed;
        pool.stats.averageTaskTime =
          (pool.stats.averageTaskTime * (totalTasks - 1) + executionTime) / totalTasks;
      }

      this.updatePoolStats(poolId);

      // Process queued tasks
      this.processTaskQueue(poolId);
    }

    this.taskDistributions.delete(taskId);
  }

  /**
   * Process queued tasks
   */
  private processTaskQueue(poolId: string): void {
    const pool = this.pools.get(poolId);
    if (!pool || pool.taskQueue.length === 0) return;

    while (pool.taskQueue.length > 0) {
      const task = pool.taskQueue[0];

      try {
        this.distributeTask(poolId, task);
        pool.taskQueue.shift();  // Remove from queue
      } catch (error) {
        // No available workers, stop processing queue
        break;
      }
    }
  }

  /**
   * Scale pool up or down based on load
   */
  async autoScale(poolId: string): Promise<void> {
    const pool = this.pools.get(poolId);
    if (!pool) return;

    const utilization = pool.stats.utilization;
    const currentWorkers = pool.workers.size;

    // Scale up if utilization > 80% and below max
    if (utilization > 0.8 && currentWorkers < pool.maxWorkers) {
      const toSpawn = Math.min(
        Math.ceil(currentWorkers * 0.5),  // Spawn 50% more
        pool.maxWorkers - currentWorkers
      );

      for (let i = 0; i < toSpawn; i++) {
        await this.spawnWorker(poolId);
      }
    }

    // Scale down if utilization < 30% and above min
    if (utilization < 0.3 && currentWorkers > pool.minWorkers) {
      const toRemove = Math.min(
        Math.floor(currentWorkers * 0.3),  // Remove 30%
        currentWorkers - pool.minWorkers
      );

      // Remove idle workers
      const workers = Array.from(pool.workers.values());
      const idle = workers.filter(w => w.status === 'idle');

      for (let i = 0; i < Math.min(toRemove, idle.length); i++) {
        this.removeWorker(poolId, idle[i].id);
      }
    }
  }

  /**
   * Remove a worker from pool
   */
  removeWorker(poolId: string, workerId: string): void {
    const pool = this.pools.get(poolId);
    if (!pool) return;

    const worker = pool.workers.get(workerId);
    if (!worker) return;

    // Only remove idle workers
    if (worker.status !== 'idle') {
      throw new Error(`Cannot remove busy worker ${workerId}`);
    }

    pool.workers.delete(workerId);
    this.globalWorkerRegistry.delete(workerId);

    this.updatePoolStats(poolId);
  }

  /**
   * Get pool statistics
   */
  getPoolStats(poolId: string): PoolStats | null {
    const pool = this.pools.get(poolId);
    return pool ? pool.stats : null;
  }

  /**
   * Get all pools
   */
  getAllPools(): WorkerPool[] {
    return Array.from(this.pools.values());
  }

  /**
   * Terminate a pool
   */
  terminatePool(poolId: string): void {
    const pool = this.pools.get(poolId);
    if (!pool) return;

    // Remove all workers
    for (const workerId of pool.workers.keys()) {
      this.globalWorkerRegistry.delete(workerId);
    }

    pool.status = 'terminated';
    pool.workers.clear();
  }

  // Private helper methods

  private updatePoolStats(poolId: string): void {
    const pool = this.pools.get(poolId);
    if (!pool) return;

    const workers = Array.from(pool.workers.values());

    pool.stats.idleWorkers = workers.filter(w => w.status === 'idle').length;
    pool.stats.busyWorkers = workers.filter(w => w.status === 'busy').length;

    const totalTasks = workers.reduce((sum, w) => sum + w.currentTasks.length, 0);
    const maxPossibleTasks = workers.reduce((sum, w) => sum + w.maxConcurrentTasks, 0);

    pool.stats.currentLoad = totalTasks;
    pool.stats.utilization = maxPossibleTasks > 0 ? totalTasks / maxPossibleTasks : 0;
  }

  private estimateCompletionTime(worker: Agent, task: Task): number {
    const metrics = worker.performanceMetrics.find(m => m.taskType === task.type);
    return metrics ? metrics.averageExecutionTime : 60000;  // Default: 1 minute
  }

  private findPoolForWorker(workerId: string): string | null {
    for (const [poolId, pool] of this.pools) {
      if (pool.workers.has(workerId)) {
        return poolId;
      }
    }
    return null;
  }

  private getOrCreateDefaultPool(agentType: AgentType): string {
    // Find existing pool for this agent type
    for (const pool of this.pools.values()) {
      if (pool.agentType === agentType && pool.status === 'active') {
        return pool.id;
      }
    }

    // Create new default pool
    const pool = this.createPool({
      name: `default-${agentType}-pool`,
      agentType,
      minWorkers: 1,
      maxWorkers: 10
    });

    return pool.id;
  }

  private getDefaultCapabilities(agentType: AgentType): string[] {
    const capabilities: Record<AgentType, string[]> = {
      research: ['web-search', 'data-analysis', 'summarization'],
      architect: ['system-design', 'tech-selection', 'architecture-patterns'],
      implementation: ['coding', 'testing', 'debugging'],
      testing: ['unit-testing', 'integration-testing', 'e2e-testing'],
      review: ['code-review', 'quality-assurance', 'best-practices'],
      documentation: ['api-docs', 'user-guides', 'technical-writing'],
      debugger: ['error-analysis', 'log-parsing', 'root-cause-analysis']
    };

    return capabilities[agentType] || [];
  }

  private getDefaultResourceLimits(): any {
    return {
      maxMemoryMB: 512,
      maxCPUTimeMs: 60000,
      maxDiskSpaceMB: 100,
      maxNetworkCalls: 100,
      maxFileHandles: 50,
      executionTimeoutMs: 300000,
      maxConcurrentTasks: 3
    };
  }
}
