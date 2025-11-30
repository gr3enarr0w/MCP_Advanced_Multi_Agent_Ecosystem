/**
 * Parallel Search Executor Module
 * 
 * Advanced parallel search execution capabilities including:
 * - Concurrent search execution with rate limiting per provider
 * - Retry logic with exponential backoff
 * - Advanced result deduplication
 * - Search result aggregation and scoring
 */

import { SearchAggregator, SearchResult } from './index.js';
import { ResearchPlan, SearchStrategy } from './research-planner.js';

// Types
export interface SearchTask {
  id: string;
  strategy: SearchStrategy;
  query: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'retrying';
  attempts: number;
  maxAttempts: number;
  results: SearchResult[];
  error?: string;
  startedAt?: string;
  completedAt?: string;
  estimatedDuration: number; // seconds
}

export interface ExecutionResult {
  taskId: string;
  query: string;
  results: SearchResult[];
  provider: string;
  duration: number; // seconds
  attempts: number;
  success: boolean;
  error?: string;
  cacheHit: boolean;
}

export interface ExecutionOptions {
  maxConcurrent?: number;
  rateLimitDelay?: number; // ms between requests to same provider
  retryAttempts?: number;
  retryDelay?: number; // base retry delay in ms
  timeout?: number; // per task timeout in seconds
  useCache?: boolean;
  prioritizeCache?: boolean;
}

export interface SearchExecutionPlan {
  planId: string;
  tasks: SearchTask[];
  totalTasks: number;
  estimatedDuration: number; // seconds
  providers: string[];
  strategies: SearchStrategy[];
  createdAt: string;
  status: 'planning' | 'ready' | 'running' | 'completed' | 'failed';
}

/**
 * Rate Limiter for search providers
 */
class ProviderRateLimiter {
  private lastRequest: Map<string, number> = new Map();
  private requestCounts: Map<string, number[]> = new Map();
  private readonly WINDOW_SIZE = 60000; // 1 minute in ms

  /**
   * Check if we can make a request to this provider
   */
  canMakeRequest(provider: string, rateLimitDelay: number): boolean {
    const now = Date.now();
    const lastRequestTime = this.lastRequest.get(provider) || 0;
    
    // Basic delay check
    if (now - lastRequestTime < rateLimitDelay) {
      return false;
    }

    // Check request rate window
    const requests = this.requestCounts.get(provider) || [];
    const windowStart = now - this.WINDOW_SIZE;
    
    // Remove old requests outside the window
    const recentRequests = requests.filter(time => time > windowStart);
    
    // Update the request count
    this.requestCounts.set(provider, recentRequests);
    
    // Limit: 10 requests per minute per provider (configurable)
    if (recentRequests.length >= 10) {
      return false;
    }

    return true;
  }

  /**
   * Record a request to this provider
   */
  recordRequest(provider: string): void {
    const now = Date.now();
    this.lastRequest.set(provider, now);
    
    const requests = this.requestCounts.get(provider) || [];
    requests.push(now);
    this.requestCounts.set(provider, requests);
  }

  /**
   * Get recommended delay for next request
   */
  getRecommendedDelay(provider: string, baseDelay: number): number {
    const lastRequestTime = this.lastRequest.get(provider) || 0;
    const timeSinceLastRequest = Date.now() - lastRequestTime;
    const recommendedDelay = Math.max(0, baseDelay - timeSinceLastRequest);
    
    return Math.min(recommendedDelay, baseDelay * 2); // Cap at 2x base delay
  }
}

/**
 * Search Result Deduplicator
 */
class ResultDeduplicator {
  private seenUrls: Set<string> = new Set();
  private seenTitles: Map<string, Set<string>> = new Map();

  /**
   * Deduplicate search results
   */
  deduplicate(results: SearchResult[]): SearchResult[] {
    const deduplicated: SearchResult[] = [];
    
    for (const result of results) {
      if (this.isDuplicate(result)) {
        continue;
      }
      
      deduplicated.push(result);
    }
    
    return deduplicated;
  }

  /**
   * Check if a result is a duplicate
   */
  private isDuplicate(result: SearchResult): boolean {
    // Check URL deduplication (highest priority)
    if (result.url && this.seenUrls.has(result.url)) {
      return true;
    }

    // Check title deduplication (case-insensitive)
    const titleLower = result.title.toLowerCase();
    if (result.source && this.seenTitles.has(result.source)) {
      const sourceTitles = this.seenTitles.get(result.source)!;
      if (sourceTitles.has(titleLower)) {
        return true;
      }
    }

    // Record this result
    if (result.url) {
      this.seenUrls.add(result.url);
    }
    
    if (result.source) {
      if (!this.seenTitles.has(result.source)) {
        this.seenTitles.set(result.source, new Set());
      }
      this.seenTitles.get(result.source)!.add(titleLower);
    }

    return false;
  }

  /**
   * Reset deduplication state
   */
  reset(): void {
    this.seenUrls.clear();
    this.seenTitles.clear();
  }
}

/**
 * Parallel Search Executor
 */
export class ParallelSearchExecutor {
  private searchAggregator: SearchAggregator;
  private rateLimiter: ProviderRateLimiter;
  private deduplicator: ResultDeduplicator;

  constructor() {
    this.searchAggregator = new SearchAggregator();
    this.rateLimiter = new ProviderRateLimiter();
    this.deduplicator = new ResultDeduplicator();
  }

  /**
   * Initialize the executor
   */
  async initialize(): Promise<void> {
    await this.searchAggregator.initialize();
  }

  /**
   * Execute search plan with parallel execution
   */
  async executeParallelSearches(
    plan: ResearchPlan,
    options: ExecutionOptions = {}
  ): Promise<SearchExecutionPlan> {
    const {
      maxConcurrent = 3,
      rateLimitDelay = 1000,
      retryAttempts = 3,
      retryDelay = 2000,
      timeout = 30,
      useCache = true,
      prioritizeCache = true
    } = options;

    // Create execution plan
    const executionPlan = this.createExecutionPlan(plan);
    executionPlan.status = 'running';

    // Execute tasks in parallel with rate limiting
    const batches = this.createExecutionBatches(executionPlan.tasks, maxConcurrent);
    
    for (const batch of batches) {
      await Promise.all(
        batch.map(task => 
          this.executeTask(task, rateLimitDelay, retryAttempts, retryDelay, timeout, useCache)
        )
      );
    }

    // Update execution plan status
    const completedTasks = executionPlan.tasks.filter(t => t.status === 'completed').length;
    const failedTasks = executionPlan.tasks.filter(t => t.status === 'failed').length;
    
    executionPlan.status = failedTasks > 0 && completedTasks > 0 ? 'completed' : 
                          failedTasks === 0 ? 'completed' : 'failed';

    return executionPlan;
  }

  /**
   * Execute a single search task
   */
  private async executeTask(
    task: SearchTask,
    rateLimitDelay: number,
    maxAttempts: number,
    baseRetryDelay: number,
    timeout: number,
    useCache: boolean
  ): Promise<void> {
    task.status = 'running';
    task.startedAt = new Date().toISOString();

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      task.attempts = attempt;

      try {
        // Check rate limiting
        for (const provider of task.strategy.providers) {
          if (!this.rateLimiter.canMakeRequest(provider, rateLimitDelay)) {
            const delay = this.rateLimiter.getRecommendedDelay(provider, rateLimitDelay);
            await this.sleep(delay);
          }
        }

        // Execute search with timeout
        const searchPromise = this.searchAggregator.search(task.query, {
          limit: 10,
          providers: task.strategy.providers as any,
          use_cache: useCache,
        });

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Task timeout after ${timeout} seconds`)), timeout * 1000);
        });

        const results = await Promise.race([searchPromise, timeoutPromise]);
        
        // Record successful execution
        this.rateLimiter.recordRequest(task.strategy.providers[0]);
        task.results = this.deduplicator.deduplicate(results);
        task.status = 'completed';
        task.completedAt = new Date().toISOString();
        
        return;

      } catch (error) {
        task.error = error instanceof Error ? error.message : String(error);
        
        if (attempt < maxAttempts) {
          // Exponential backoff retry
          const retryDelay = baseRetryDelay * Math.pow(2, attempt - 1);
          task.status = 'retrying';
          
          await this.sleep(retryDelay);
        } else {
          task.status = 'failed';
        }
      }
    }

    task.completedAt = new Date().toISOString();
  }

  /**
   * Create execution plan from research plan
   */
  private createExecutionPlan(plan: ResearchPlan): SearchExecutionPlan {
    const tasks: SearchTask[] = [];
    let estimatedDuration = 0;

    for (const strategy of plan.strategies) {
      // Create a task for each strategy
      const strategyQuestions = plan.questions.slice(0, 3); // Limit to 3 questions per strategy
      
      for (const question of strategyQuestions) {
        const task: SearchTask = {
          id: `${strategy.id}_${question.id}`,
          strategy,
          query: question.question,
          status: 'pending',
          attempts: 0,
          maxAttempts: 3,
          results: [],
          estimatedDuration: strategy.estimatedTime * 60, // Convert to seconds
        };
        
        tasks.push(task);
        estimatedDuration += task.estimatedDuration;
      }
    }

    return {
      planId: plan.id,
      tasks,
      totalTasks: tasks.length,
      estimatedDuration,
      providers: [...new Set(plan.strategies.flatMap(s => s.providers))],
      strategies: plan.strategies,
      createdAt: new Date().toISOString(),
      status: 'ready',
    };
  }

  /**
   * Create execution batches for parallel processing
   */
  private createExecutionBatches(tasks: SearchTask[], maxConcurrent: number): SearchTask[][] {
    const batches: SearchTask[][] = [];
    
    for (let i = 0; i < tasks.length; i += maxConcurrent) {
      batches.push(tasks.slice(i, i + maxConcurrent));
    }
    
    return batches;
  }

  /**
   * Aggregate results from all completed tasks
   */
  aggregateResults(executionPlan: SearchExecutionPlan): ExecutionResult[] {
    const results: ExecutionResult[] = [];

    for (const task of executionPlan.tasks) {
      if (task.status === 'completed' && task.results.length > 0) {
        const duration = task.completedAt && task.startedAt ? 
          (new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime()) / 1000 : 0;

        const executionResult: ExecutionResult = {
          taskId: task.id,
          query: task.query,
          results: task.results,
          provider: task.strategy.providers[0] || 'unknown',
          duration,
          attempts: task.attempts,
          success: true,
          cacheHit: false, // This would need to be tracked in the search aggregator
        };

        results.push(executionResult);
      } else if (task.status === 'failed') {
        const duration = task.completedAt && task.startedAt ? 
          (new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime()) / 1000 : 0;

        const executionResult: ExecutionResult = {
          taskId: task.id,
          query: task.query,
          results: [],
          provider: task.strategy.providers[0] || 'unknown',
          duration,
          attempts: task.attempts,
          success: false,
          error: task.error,
          cacheHit: false,
        };

        results.push(executionResult);
      }
    }

    return results;
  }

  /**
   * Get execution statistics
   */
  getExecutionStats(executionPlan: SearchExecutionPlan): {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    retryingTasks: number;
    totalResults: number;
    averageDuration: number;
    successRate: number;
    providerStats: Record<string, { tasks: number; successes: number; failures: number }>;
  } {
    const completedTasks = executionPlan.tasks.filter(t => t.status === 'completed').length;
    const failedTasks = executionPlan.tasks.filter(t => t.status === 'failed').length;
    const retryingTasks = executionPlan.tasks.filter(t => t.status === 'retrying').length;
    const totalResults = executionPlan.tasks.reduce((sum, t) => sum + t.results.length, 0);

    // Calculate average duration
    const completedWithDuration = executionPlan.tasks.filter(t => 
      t.status === 'completed' && t.startedAt && t.completedAt
    );
    const averageDuration = completedWithDuration.length > 0 ? 
      completedWithDuration.reduce((sum, t) => {
        const duration = (new Date(t.completedAt!).getTime() - new Date(t.startedAt!).getTime()) / 1000;
        return sum + duration;
      }, 0) / completedWithDuration.length : 0;

    // Provider statistics
    const providerStats: Record<string, { tasks: number; successes: number; failures: number }> = {};
    
    for (const task of executionPlan.tasks) {
      const provider = task.strategy.providers[0] || 'unknown';
      
      if (!providerStats[provider]) {
        providerStats[provider] = { tasks: 0, successes: 0, failures: 0 };
      }
      
      providerStats[provider].tasks++;
      
      if (task.status === 'completed') {
        providerStats[provider].successes++;
      } else if (task.status === 'failed') {
        providerStats[provider].failures++;
      }
    }

    return {
      totalTasks: executionPlan.totalTasks,
      completedTasks,
      failedTasks,
      retryingTasks,
      totalResults,
      averageDuration,
      successRate: executionPlan.totalTasks > 0 ? completedTasks / executionPlan.totalTasks : 0,
      providerStats,
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.searchAggregator.close();
  }

  /**
   * Utility method to sleep for a given duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Convenience function for executing parallel searches
 */
export async function executeParallelSearches(
  plan: ResearchPlan,
  options: ExecutionOptions = {}
): Promise<SearchExecutionPlan> {
  const executor = new ParallelSearchExecutor();
  
  try {
    await executor.initialize();
    return await executor.executeParallelSearches(plan, options);
  } finally {
    await executor.cleanup();
  }
}

/**
 * Quick search execution for simple queries
 */
export async function quickParallelSearch(
  queries: string[],
  providers: string[] = ['tavily', 'perplexity', 'brave', 'duckduckgo'],
  options: ExecutionOptions = {}
): Promise<ExecutionResult[]> {
  // Create a simple research plan for the queries
  const simplePlan: ResearchPlan = {
    id: 'quick-search-' + Date.now(),
    topic: 'Quick Search',
    objective: 'Quick parallel search',
    scope: 'Simple search across multiple queries',
    methodology: 'exploratory',
    questions: queries.map(query => ({
      id: 'q-' + Math.random().toString(36).substr(2, 9),
      question: query,
      importance: 'medium' as const,
      estimatedEffort: 1,
      dependencies: [],
      searchTerms: query.split(' '),
      expectedSources: ['web'],
    })),
    strategies: [{
      id: 'quick-strategy',
      name: 'Quick Search Strategy',
      type: 'web' as const,
      providers,
      searchTerms: [],
      depth: 'shallow' as const,
      breadth: 'moderate' as const,
      estimatedTime: 5,
      priority: 1,
    }],
    timeline: {
      totalEstimatedTime: 5,
      phases: [{
        name: 'Quick Search',
        duration: 5,
        questions: queries.map(q => 'q-' + Math.random().toString(36).substr(2, 9)),
      }],
    },
    expectedOutcomes: ['Search results'],
    successCriteria: ['Results obtained'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const executionPlan = await executeParallelSearches(simplePlan, {
    maxConcurrent: 2,
    rateLimitDelay: 500,
    ...options,
  });

  const executor = new ParallelSearchExecutor();
  await executor.initialize();
  
  try {
    return executor.aggregateResults(executionPlan);
  } finally {
    await executor.cleanup();
  }
}