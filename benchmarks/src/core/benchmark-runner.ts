/**
 * Core Benchmark Runner
 * Orchestrates execution of performance benchmarks across different providers and scenarios
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  BenchmarkConfig,
  BenchmarkResult,
  BenchmarkScenario,
  BenchmarkMetrics,
  IterationResult,
  EnvironmentInfo,
  ProgressCallback,
  ProgressInfo,
  BenchmarkError
} from '@/types';

export class BenchmarkRunner extends EventEmitter {
  private config: BenchmarkConfig;
  private environment: EnvironmentInfo;

  constructor(config: BenchmarkConfig) {
    super();
    this.config = config;
    this.environment = this.gatherEnvironmentInfo();
  }

  /**
   * Run all configured benchmarks
   */
  async runAllBenchmarks(progressCallback?: ProgressCallback): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];
    const totalScenarios = this.config.scenarios.length;
    
    progressCallback?.({
      operation: 'Initializing benchmarks',
      percentage: 0,
      total: totalScenarios,
      details: { environment: this.environment }
    });

    for (let i = 0; i < totalScenarios; i++) {
      const scenario = this.config.scenarios[i];
      
      progressCallback?.({
        operation: `Running scenario: ${scenario.name}`,
        percentage: (i / totalScenarios) * 100,
        current: scenario.name,
        total: totalScenarios
      });

      try {
        const scenarioResults = await this.runScenario(scenario, progressCallback);
        results.push(...scenarioResults);
      } catch (error) {
        this.emit('scenarioError', { scenario, error });
        
        // Add failed result
        const failedResult: BenchmarkResult = {
          id: uuidv4(),
          timestamp: new Date().toISOString(),
          scenario,
          provider: 'unknown',
          iterations: [],
          metrics: this.createEmptyMetrics(),
          metadata: {
            totalExecutionTime: 0,
            successfulIterations: 0,
            failedIterations: 1,
            environment: this.environment
          }
        };
        results.push(failedResult);
      }
    }

    progressCallback?.({
      operation: 'Benchmarking complete',
      percentage: 100,
      details: { totalResults: results.length }
    });

    return results;
  }

  /**
   * Run a specific benchmark scenario
   */
  async runScenario(
    scenario: BenchmarkScenario,
    progressCallback?: ProgressCallback
  ): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];
    
    switch (scenario.type) {
      case 'latency':
        results.push(...await this.runLatencyBenchmark(scenario, progressCallback));
        break;
      case 'throughput':
        results.push(...await this.runThroughputBenchmark(scenario, progressCallback));
        break;
      case 'stress':
        results.push(...await this.runStressBenchmark(scenario, progressCallback));
        break;
      case 'cold-start':
        results.push(...await this.runColdStartBenchmark(scenario, progressCallback));
        break;
      case 'sustained-load':
        results.push(...await this.runSustainedLoadBenchmark(scenario, progressCallback));
        break;
      case 'failover':
        results.push(...await this.runFailoverBenchmark(scenario, progressCallback));
        break;
      default:
        throw new BenchmarkError(
          `Unknown scenario type: ${scenario.type}`,
          'CONFIGURATION',
          'unknown'
        );
    }

    return results;
  }

  /**
   * Run latency benchmarks
   */
  private async runLatencyBenchmark(
    scenario: BenchmarkScenario,
    progressCallback?: ProgressCallback
  ): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];
    
    // Test each configured provider
    for (const providerName of this.config.providers.llm) {
      progressCallback?.({
        operation: `Testing latency for ${providerName}`,
        percentage: 50,
        current: providerName
      });

      const result = await this.measureLatency(providerName, scenario);
      results.push(result);
    }

    return results;
  }

  /**
   * Run throughput benchmarks
   */
  private async runThroughputBenchmark(
    scenario: BenchmarkScenario,
    progressCallback?: ProgressCallback
  ): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];
    
    for (const providerName of this.config.providers.llm) {
      progressCallback?.({
        operation: `Testing throughput for ${providerName}`,
        percentage: 50,
        current: providerName
      });

      const result = await this.measureThroughput(providerName, scenario);
      results.push(result);
    }

    return results;
  }

  /**
   * Run stress benchmarks
   */
  private async runStressBenchmark(
    scenario: BenchmarkScenario,
    progressCallback?: ProgressCallback
  ): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];
    
    for (const providerName of this.config.providers.llm) {
      progressCallback?.({
        operation: `Stress testing ${providerName}`,
        percentage: 50,
        current: providerName
      });

      const result = await this.measureStressTolerance(providerName, scenario);
      results.push(result);
    }

    return results;
  }

  /**
   * Run cold start benchmarks
   */
  private async runColdStartBenchmark(
    scenario: BenchmarkScenario,
    progressCallback?: ProgressCallback
  ): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];
    
    for (const providerName of this.config.providers.llm) {
      progressCallback?.({
        operation: `Cold start testing ${providerName}`,
        percentage: 50,
        current: providerName
      });

      const result = await this.measureColdStart(providerName, scenario);
      results.push(result);
    }

    return results;
  }

  /**
   * Run sustained load benchmarks
   */
  private async runSustainedLoadBenchmark(
    scenario: BenchmarkScenario,
    progressCallback?: ProgressCallback
  ): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];
    
    for (const providerName of this.config.providers.llm) {
      progressCallback?.({
        operation: `Sustained load testing ${providerName}`,
        percentage: 50,
        current: providerName
      });

      const result = await this.measureSustainedLoad(providerName, scenario);
      results.push(result);
    }

    return results;
  }

  /**
   * Run failover benchmarks
   */
  private async runFailoverBenchmark(
    scenario: BenchmarkScenario,
    progressCallback?: ProgressCallback
  ): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];
    
    for (const providerName of this.config.providers.llm) {
      progressCallback?.({
        operation: `Failover testing ${providerName}`,
        percentage: 50,
        current: providerName
      });

      const result = await this.measureFailoverPerformance(providerName, scenario);
      results.push(result);
    }

    return results;
  }

  /**
   * Measure latency for a provider
   */
  private async measureLatency(
    providerName: string,
    scenario: BenchmarkScenario
  ): Promise<BenchmarkResult> {
    const iterations: IterationResult[] = [];
    const { warmupIterations, iterations: benchmarkIterations, timeout } = this.config.execution;

    // Warmup phase
    for (let i = 0; i < warmupIterations; i++) {
      try {
        await this.executeProviderRequest(providerName, scenario, i, true);
      } catch (error) {
        // Ignore warmup errors
      }
    }

    // Benchmark phase
    for (let i = 0; i < benchmarkIterations; i++) {
      const startTime = Date.now();
      
      try {
        const result = await this.executeProviderRequest(providerName, scenario, i, false);
        const latency = Date.now() - startTime;
        
        iterations.push({
          iteration: i,
          timestamp: new Date().toISOString(),
          latency,
          success: true,
          responseSize: result.responseSize,
          tokenUsage: result.tokenUsage,
          providerMetrics: result.providerMetrics
        });

        // Delay between iterations
        if (this.config.execution.iterationDelay > 0) {
          await this.sleep(this.config.execution.iterationDelay);
        }

      } catch (error) {
        const latency = Date.now() - startTime;
        iterations.push({
          iteration: i,
          timestamp: new Date().toISOString(),
          latency,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return this.createBenchmarkResult(providerName, scenario, iterations);
  }

  /**
   * Measure throughput for a provider
   */
  private async measureThroughput(
    providerName: string,
    scenario: BenchmarkScenario
  ): Promise<BenchmarkResult> {
    const { concurrency, iterations, timeout } = this.config.execution;
    const startTime = Date.now();
    const iterations: IterationResult[] = [];

    // Execute concurrent requests
    const promises = Array.from({ length: iterations }, (_, i) =>
      this.executeProviderRequest(providerName, scenario, i, false)
        .then(result => ({
          iteration: i,
          timestamp: new Date().toISOString(),
          latency: 0, // Will be calculated
          success: true,
          responseSize: result.responseSize,
          tokenUsage: result.tokenUsage,
          providerMetrics: result.providerMetrics
        }))
        .catch(error => ({
          iteration: i,
          timestamp: new Date().toISOString(),
          latency: 0,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }))
    );

    const results = await Promise.allSettled(promises);
    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    // Process results
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        iterations.push(result.value);
      } else {
        iterations.push({
          iteration: index,
          timestamp: new Date().toISOString(),
          latency: totalDuration,
          success: false,
          error: result.reason
        });
      }
    });

    return this.createBenchmarkResult(providerName, scenario, iterations);
  }

  /**
   * Measure stress tolerance for a provider
   */
  private async measureStressTolerance(
    providerName: string,
    scenario: BenchmarkScenario
  ): Promise<BenchmarkResult> {
    // Implement stress testing logic
    const iterations: IterationResult[] = [];
    const maxConcurrency = scenario.parameters.maxConcurrency || 50;
    
    for (let concurrency = 1; concurrency <= maxConcurrency; concurrency *= 2) {
      const result = await this.measureThroughput(providerName, {
        ...scenario,
        parameters: { ...scenario.parameters, concurrency }
      });
      
      iterations.push(...result.iterations);
      
      // Check if we've hit the failure threshold
      const errorRate = result.metrics.errors.rate;
      if (errorRate > (scenario.successCriteria.maxErrorRate || 10)) {
        break;
      }
    }

    return this.createBenchmarkResult(providerName, scenario, iterations);
  }

  /**
   * Measure cold start performance
   */
  private async measureColdStart(
    providerName: string,
    scenario: BenchmarkScenario
  ): Promise<BenchmarkResult> {
    const iterations: IterationResult[] = [];
    const coldStartCount = scenario.parameters.coldStartCount || 5;

    for (let i = 0; i < coldStartCount; i++) {
      // Ensure cold start by waiting
      await this.sleep(scenario.parameters.idleTime || 30000);
      
      const startTime = Date.now();
      try {
        const result = await this.executeProviderRequest(providerName, scenario, i, false);
        const latency = Date.now() - startTime;
        
        iterations.push({
          iteration: i,
          timestamp: new Date().toISOString(),
          latency,
          success: true,
          responseSize: result.responseSize,
          tokenUsage: result.tokenUsage,
          providerMetrics: result.providerMetrics
        });
      } catch (error) {
        const latency = Date.now() - startTime;
        iterations.push({
          iteration: i,
          timestamp: new Date().toISOString(),
          latency,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return this.createBenchmarkResult(providerName, scenario, iterations);
  }

  /**
   * Measure sustained load performance
   */
  private async measureSustainedLoad(
    providerName: string,
    scenario: BenchmarkScenario
  ): Promise<BenchmarkResult> {
    const iterations: IterationResult[] = [];
    const duration = scenario.parameters.duration || 300000; // 5 minutes default
    const interval = scenario.parameters.interval || 1000; // 1 second default
    const endTime = Date.now() + duration;
    let iteration = 0;

    while (Date.now() < endTime) {
      const startTime = Date.now();
      try {
        const result = await this.executeProviderRequest(providerName, scenario, iteration, false);
        const latency = Date.now() - startTime;
        
        iterations.push({
          iteration,
          timestamp: new Date().toISOString(),
          latency,
          success: true,
          responseSize: result.responseSize,
          tokenUsage: result.tokenUsage,
          providerMetrics: result.providerMetrics
        });
      } catch (error) {
        const latency = Date.now() - startTime;
        iterations.push({
          iteration,
          timestamp: new Date().toISOString(),
          latency,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      iteration++;
      await this.sleep(interval);
    }

    return this.createBenchmarkResult(providerName, scenario, iterations);
  }

  /**
   * Measure failover performance
   */
  private async measureFailoverPerformance(
    providerName: string,
    scenario: BenchmarkScenario
  ): Promise<BenchmarkResult> {
    const iterations: IterationResult[] = [];
    const failoverChain = scenario.parameters.failoverChain || [providerName];

    for (let i = 0; i < failoverChain.length; i++) {
      const currentProvider = failoverChain[i];
      const startTime = Date.now();
      
      try {
        const result = await this.executeProviderRequest(currentProvider, scenario, i, false);
        const latency = Date.now() - startTime;
        
        iterations.push({
          iteration: i,
          timestamp: new Date().toISOString(),
          latency,
          success: true,
          responseSize: result.responseSize,
          tokenUsage: result.tokenUsage,
          providerMetrics: {
            ...result.providerMetrics,
            failoverStep: i,
            provider: currentProvider
          }
        });
      } catch (error) {
        const latency = Date.now() - startTime;
        iterations.push({
          iteration: i,
          timestamp: new Date().toISOString(),
          latency,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          providerMetrics: {
            failoverStep: i,
            provider: currentProvider
          }
        });
      }
    }

    return this.createBenchmarkResult(providerName, scenario, iterations);
  }

  /**
   * Execute a provider request (to be implemented by specific benchmarks)
   */
  private async executeProviderRequest(
    providerName: string,
    scenario: BenchmarkScenario,
    iteration: number,
    isWarmup: boolean
  ): Promise<any> {
    // This will be overridden by specific benchmark implementations
    throw new Error('executeProviderRequest must be implemented by specific benchmarks');
  }

  /**
   * Create benchmark result from iterations
   */
  private createBenchmarkResult(
    providerName: string,
    scenario: BenchmarkScenario,
    iterations: IterationResult[]
  ): BenchmarkResult {
    const successfulIterations = iterations.filter(i => i.success);
    const failedIterations = iterations.filter(i => !i.success);
    const latencies = successfulIterations.map(i => i.latency);

    const metrics = this.calculateMetrics(iterations);

    return {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      scenario,
      provider: providerName,
      iterations,
      metrics,
      metadata: {
        totalExecutionTime: Math.max(...latencies, 0),
        successfulIterations: successfulIterations.length,
        failedIterations: failedIterations.length,
        environment: this.environment
      }
    };
  }

  /**
   * Calculate metrics from iterations
   */
  private calculateMetrics(iterations: IterationResult[]): BenchmarkMetrics {
    const successfulIterations = iterations.filter(i => i.success);
    const failedIterations = iterations.filter(i => !i.success);
    const latencies = successfulIterations.map(i => i.latency);

    if (latencies.length === 0) {
      return this.createEmptyMetrics();
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const mean = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
    const variance = latencies.reduce((sum, lat) => sum + Math.pow(lat - mean, 2), 0) / latencies.length;
    const stddev = Math.sqrt(variance);

    return {
      latency: {
        min: Math.min(...latencies),
        max: Math.max(...latencies),
        mean,
        median: sorted[Math.floor(sorted.length / 2)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)],
        stddev
      },
      throughput: {
        rps: successfulIterations.length / (iterations.length / 1000), // requests per second
        avgResponseTime: mean,
        peakConcurrency: this.config.execution.concurrency
      },
      errors: {
        total: failedIterations.length,
        rate: (failedIterations.length / iterations.length) * 100,
        types: failedIterations.reduce((acc, iteration) => {
          const errorType = iteration.error || 'unknown';
          acc[errorType] = (acc[errorType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      }
    };
  }

  /**
   * Create empty metrics object
   */
  private createEmptyMetrics(): BenchmarkMetrics {
    return {
      latency: { min: 0, max: 0, mean: 0, median: 0, p95: 0, p99: 0, stddev: 0 },
      throughput: { rps: 0, avgResponseTime: 0, peakConcurrency: 0 },
      errors: { total: 0, rate: 0, types: {} }
    };
  }

  /**
   * Gather environment information
   */
  private gatherEnvironmentInfo(): EnvironmentInfo {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      totalMemory: require('os').totalmem() / 1024 / 1024, // MB
      cpuCores: require('os').cpus().length,
      gitCommit: process.env.GIT_COMMIT || 'unknown',
      buildTime: new Date().toISOString()
    };
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}