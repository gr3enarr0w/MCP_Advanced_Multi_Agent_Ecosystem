/**
 * JSON Reporter for Benchmark Results
 * Generates detailed JSON reports with all benchmark data
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { BenchmarkReport, BenchmarkResult } from '@/types';

export class JSONReporter {
  private outputDir: string;

  constructor(outputDir: string = './reports') {
    this.outputDir = outputDir;
    this.ensureOutputDirectory();
  }

  /**
   * Generate JSON report
   */
  generateReport(results: BenchmarkResult[], metadata?: any): void {
    const report: BenchmarkReport = {
      metadata: {
        generatedAt: new Date().toISOString(),
        frameworkVersion: '1.0.0',
        formatVersion: '1.0'
      },
      summary: this.generateSummary(results),
      results,
      comparison: this.generateComparison(results)
    };

    const filename = `benchmark-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filepath = join(this.outputDir, filename);
    
    writeFileSync(filepath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`JSON report generated: ${filepath}`);
  }

  /**
   * Generate summary statistics
   */
  private generateSummary(results: BenchmarkResult[]): any {
    const totalBenchmarks = results.length;
    const successfulBenchmarks = results.filter(r => 
      r.metadata.failedIterations === 0
    ).length;
    const failedBenchmarks = totalBenchmarks - successfulBenchmarks;
    const successRate = totalBenchmarks > 0 ? (successfulBenchmarks / totalBenchmarks) * 100 : 0;

    // Provider performance summary
    const providerStats = this.calculateProviderStats(results);
    
    // Scenario performance summary
    const scenarioStats = this.calculateScenarioStats(results);

    return {
      totalBenchmarks,
      successfulBenchmarks,
      failedBenchmarks,
      successRate: Math.round(successRate * 100) / 100,
      providerStats,
      scenarioStats,
      keyFindings: this.generateKeyFindings(results, providerStats, scenarioStats)
    };
  }

  /**
   * Calculate provider statistics
   */
  private calculateProviderStats(results: BenchmarkResult[]): Record<string, any> {
    const providerStats: Record<string, any> = {};
    
    // Group results by provider
    const providerGroups = results.reduce((groups, result) => {
      if (!groups[result.provider]) {
        groups[result.provider] = [];
      }
      groups[result.provider].push(result);
      return groups;
    }, {} as Record<string, BenchmarkResult[]>);

    // Calculate stats for each provider
    for (const [provider, providerResults] of Object.entries(providerGroups)) {
      const allLatencies = providerResults.flatMap(r => 
        r.iterations.filter(i => i.success).map(i => i.latency)
      );
      const allThroughputs = providerResults.map(r => r.metrics.throughput.rps);
      const allErrorRates = providerResults.map(r => r.metrics.errors.rate);

      providerStats[provider] = {
        totalTests: providerResults.length,
        successfulTests: providerResults.filter(r => r.metadata.failedIterations === 0).length,
        avgLatency: allLatencies.length > 0 ? 
          Math.round(allLatencies.reduce((sum, lat) => sum + lat, 0) / allLatencies.length) : 0,
        minLatency: allLatencies.length > 0 ? Math.min(...allLatencies) : 0,
        maxLatency: allLatencies.length > 0 ? Math.max(...allLatencies) : 0,
        p95Latency: this.calculatePercentile(allLatencies, 95),
        p99Latency: this.calculatePercentile(allLatencies, 99),
        avgThroughput: allThroughputs.length > 0 ? 
          Math.round(allThroughputs.reduce((sum, t) => sum + t, 0) / allThroughputs.length) : 0,
        avgErrorRate: allErrorRates.length > 0 ? 
          Math.round(allErrorRates.reduce((sum, e) => sum + e, 0) / allErrorRates.length) : 0,
        reliability: this.calculateReliability(providerResults)
      };
    }

    return providerStats;
  }

  /**
   * Calculate scenario statistics
   */
  private calculateScenarioStats(results: BenchmarkResult[]): Record<string, any> {
    const scenarioStats: Record<string, any> = {};
    
    // Group results by scenario
    const scenarioGroups = results.reduce((groups, result) => {
      if (!groups[result.scenario.id]) {
        groups[result.scenario.id] = [];
      }
      groups[result.scenario.id].push(result);
      return groups;
    }, {} as Record<string, BenchmarkResult[]>);

    // Calculate stats for each scenario
    for (const [scenarioId, scenarioResults] of Object.entries(scenarioGroups)) {
      const avgLatency = scenarioResults.reduce((sum, r) => 
        sum + r.metrics.latency.mean, 0) / scenarioResults.length;
      const avgThroughput = scenarioResults.reduce((sum, r) => 
        sum + r.metrics.throughput.rps, 0) / scenarioResults.length;
      const avgErrorRate = scenarioResults.reduce((sum, r) => 
        sum + r.metrics.errors.rate, 0) / scenarioResults.length;

      scenarioStats[scenarioId] = {
        totalTests: scenarioResults.length,
        avgLatency: Math.round(avgLatency),
        avgThroughput: Math.round(avgThroughput),
        avgErrorRate: Math.round(avgErrorRate),
        bestProvider: this.findBestProvider(scenarioResults, 'latency'),
        worstProvider: this.findWorstProvider(scenarioResults, 'latency')
      };
    }

    return scenarioStats;
  }

  /**
   * Generate comparison analysis
   */
  private generateComparison(results: BenchmarkResult[]): any {
    if (results.length === 0) return null;

    const providers = [...new Set(results.map(r => r.provider))];
    const rankings: Record<string, any[]> = {};

    // Rank by latency (lower is better)
    rankings.latency = providers.map(provider => {
      const providerResults = results.filter(r => r.provider === provider);
      const avgLatency = providerResults.reduce((sum, r) => 
        sum + r.metrics.latency.mean, 0) / providerResults.length;
      
      return {
        provider,
        score: avgLatency,
        rank: 0, // Will be calculated below
        metrics: { avgLatency, reliability: this.calculateReliability(providerResults) }
      };
    }).sort((a, b) => a.score - b.score)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    // Rank by throughput (higher is better)
    rankings.throughput = providers.map(provider => {
      const providerResults = results.filter(r => r.provider === provider);
      const avgThroughput = providerResults.reduce((sum, r) => 
        sum + r.metrics.throughput.rps, 0) / providerResults.length;
      
      return {
        provider,
        score: avgThroughput,
        rank: 0,
        metrics: { avgThroughput, reliability: this.calculateReliability(providerResults) }
      };
    }).sort((a, b) => b.score - a.score)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    // Rank by reliability (higher is better)
    rankings.reliability = providers.map(provider => {
      const providerResults = results.filter(r => r.provider === provider);
      const reliability = this.calculateReliability(providerResults);
      
      return {
        provider,
        score: reliability,
        rank: 0,
        metrics: { reliability, avgLatency: providerResults.reduce((sum, r) => 
          sum + r.metrics.latency.mean, 0) / providerResults.length }
      };
    }).sort((a, b) => b.score - a.score)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    return {
      rankings,
      recommendations: this.generateRecommendations(rankings)
    };
  }

  /**
   * Calculate reliability score
   */
  private calculateReliability(results: BenchmarkResult[]): number {
    if (results.length === 0) return 0;
    
    const totalIterations = results.reduce((sum, r) => sum + r.iterations.length, 0);
    const successfulIterations = results.reduce((sum, r) => 
      sum + r.iterations.filter(i => i.success).length, 0);
    
    return totalIterations > 0 ? Math.round((successfulIterations / totalIterations) * 100) : 0;
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Find best provider for a metric
   */
  private findBestProvider(results: BenchmarkResult[], metric: string): string {
    if (results.length === 0) return 'unknown';
    
    let bestResult = results[0];
    let bestScore = this.getProviderScore(bestResult, metric);
    
    for (const result of results) {
      const score = this.getProviderScore(result, metric);
      if (score < bestScore) {
        bestScore = score;
        bestResult = result;
      }
    }
    
    return bestResult.provider;
  }

  /**
   * Find worst provider for a metric
   */
  private findWorstProvider(results: BenchmarkResult[], metric: string): string {
    if (results.length === 0) return 'unknown';
    
    let worstResult = results[0];
    let worstScore = this.getProviderScore(worstResult, metric);
    
    for (const result of results) {
      const score = this.getProviderScore(result, metric);
      if (score > worstScore) {
        worstScore = score;
        worstResult = result;
      }
    }
    
    return worstResult.provider;
  }

  /**
   * Get provider score for a metric
   */
  private getProviderScore(result: BenchmarkResult, metric: string): number {
    switch (metric) {
      case 'latency':
        return result.metrics.latency.mean;
      case 'throughput':
        return -result.metrics.throughput.rps; // Negative for ascending sort
      case 'reliability':
        return -result.metadata.successfulIterations; // Negative for ascending sort
      default:
        return 0;
    }
  }

  /**
   * Generate key findings
   */
  private generateKeyFindings(
    results: BenchmarkResult[],
    providerStats: Record<string, any>,
    scenarioStats: Record<string, any>
  ): string[] {
    const findings: string[] = [];

    // Performance differences
    const latencies = Object.values(providerStats).map((stat: any) => stat.avgLatency);
    if (latencies.length > 1) {
      const minLatency = Math.min(...latencies);
      const maxLatency = Math.max(...latencies);
      const ratio = maxLatency / minLatency;
      
      if (ratio > 3) {
        findings.push(`Significant latency variation: fastest provider is ${ratio.toFixed(1)}x faster than slowest`);
      } else if (ratio > 2) {
        findings.push(`Moderate latency variation: fastest provider is ${ratio.toFixed(1)}x faster than slowest`);
      }
    }

    // Reliability issues
    const unreliableProviders = Object.entries(providerStats)
      .filter(([, stat]: [string, any]) => stat.reliability < 95)
      .map(([provider]) => provider);
    
    if (unreliableProviders.length > 0) {
      findings.push(`Reliability concerns: ${unreliableProviders.join(', ')} showing <95% success rate`);
    }

    // Performance outliers
    const outlierScenarios = Object.entries(scenarioStats)
      .filter(([, stat]: [string, any]) => stat.avgErrorRate > 10)
      .map(([scenario]) => scenario);
    
    if (outlierScenarios.length > 0) {
      findings.push(`High error rates in scenarios: ${outlierScenarios.join(', ')}`);
    }

    // Recommendations
    if (latencies.length > 0) {
      const [fastestProvider] = Object.entries(providerStats)
        .sort(([, a], [, b]) => a.avgLatency - b.avgLatency)[0];
      
      findings.push(`Fastest provider: ${fastestProvider[0]} (avg: ${fastestProvider[1].avgLatency}ms)`);
    }

    return findings;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(rankings: Record<string, any[]>): string[] {
    const recommendations: string[] = [];

    // Latency recommendations
    if (rankings.latency && rankings.latency.length > 0) {
      const bestLatency = rankings.latency[0];
      recommendations.push(`For lowest latency: Use ${bestLatency.provider}`);
    }

    // Throughput recommendations
    if (rankings.throughput && rankings.throughput.length > 0) {
      const bestThroughput = rankings.throughput[0];
      recommendations.push(`For highest throughput: Use ${bestThroughput.provider}`);
    }

    // Reliability recommendations
    if (rankings.reliability && rankings.reliability.length > 0) {
      const bestReliability = rankings.reliability[0];
      recommendations.push(`For highest reliability: Use ${bestReliability.provider}`);
    }

    // General recommendations
    recommendations.push('Consider using different providers for different use cases based on these benchmarks');
    recommendations.push('Monitor provider performance regularly as conditions may change');

    return recommendations;
  }

  /**
   * Ensure output directory exists
   */
  private ensureOutputDirectory(): void {
    try {
      mkdirSync(this.outputDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }
}