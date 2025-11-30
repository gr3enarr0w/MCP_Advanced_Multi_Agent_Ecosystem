/**
 * Regression Detection for Benchmark Results
 * Compares current benchmark results with historical baselines to detect performance regressions
 */

import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { BenchmarkResult, BenchmarkMetrics } from '@/types';

export interface RegressionThreshold {
  /** Maximum acceptable latency increase (percentage) */
  latencyIncrease: number;
  /** Maximum acceptable throughput decrease (percentage) */
  throughputDecrease: number;
  /** Maximum acceptable error rate increase (percentage) */
  errorRateIncrease: number;
  /** Minimum acceptable reliability (percentage) */
  minReliability: number;
}

export interface RegressionResult {
  /** Whether regression was detected */
  hasRegression: boolean;
  /** Regression details */
  regressions: RegressionDetail[];
  /** Overall summary */
  summary: {
    totalComparisons: number;
    regressionsDetected: number;
    severity: 'none' | 'minor' | 'major' | 'critical';
  };
}

export interface RegressionDetail {
  /** Provider that regressed */
  provider: string;
  /** Scenario that regressed */
  scenario: string;
  /** Metric that regressed */
  metric: string;
  /** Baseline value */
  baseline: number;
  /** Current value */
  current: number;
  /** Percentage change */
  changePercent: number;
  /** Regression severity */
  severity: 'minor' | 'major' | 'critical';
  /** Description */
  description: string;
}

export class RegressionDetector {
  private baselineDir: string;
  private thresholds: RegressionThreshold;

  constructor(
    baselineDir: string = './baselines',
    thresholds: RegressionThreshold = {
      latencyIncrease: 15, // 15% increase
      throughputDecrease: 10, // 10% decrease
      errorRateIncrease: 25, // 25% increase
      minReliability: 90 // 90% minimum reliability
    }
  ) {
    this.baselineDir = baselineDir;
    this.thresholds = thresholds;
    this.ensureBaselineDirectory();
  }

  /**
   * Detect regressions by comparing current results with baselines
   */
  async detectRegressions(currentResults: BenchmarkResult[]): Promise<RegressionResult> {
    const regressions: RegressionDetail[] = [];
    let totalComparisons = 0;

    for (const currentResult of currentResults) {
      const baseline = await this.loadBaseline(currentResult.provider, currentResult.scenario.id);
      
      if (baseline) {
        totalComparisons++;
        const comparison = this.compareWithBaseline(currentResult, baseline);
        
        if (comparison.hasRegression) {
          regressions.push(...comparison.regressions);
        }
      } else {
        // Save current result as new baseline
        await this.saveBaseline(currentResult);
      }
    }

    const severity = this.calculateOverallSeverity(regressions);

    return {
      hasRegression: regressions.length > 0,
      regressions,
      summary: {
        totalComparisons,
        regressionsDetected: regressions.length,
        severity
      }
    };
  }

  /**
   * Compare current result with baseline
   */
  private compareWithBaseline(
    currentResult: BenchmarkResult,
    baseline: BenchmarkResult
  ): { hasRegression: boolean; regressions: RegressionDetail[] } {
    const regressions: RegressionDetail[] = [];

    // Compare latency metrics
    const latencyRegression = this.compareMetric(
      currentResult.provider,
      currentResult.scenario.id,
      'latency',
      currentResult.metrics.latency.mean,
      baseline.metrics.latency.mean,
      this.thresholds.latencyIncrease
    );

    if (latencyRegression) {
      regressions.push(latencyRegression);
    }

    // Compare throughput metrics
    const throughputRegression = this.compareMetric(
      currentResult.provider,
      currentResult.scenario.id,
      'throughput',
      currentResult.metrics.throughput.rps,
      baseline.metrics.throughput.rps,
      this.thresholds.throughputDecrease,
      true // Decrease is bad
    );

    if (throughputRegression) {
      regressions.push(throughputRegression);
    }

    // Compare error rate metrics
    const errorRateRegression = this.compareMetric(
      currentResult.provider,
      currentResult.scenario.id,
      'errorRate',
      currentResult.metrics.errors.rate,
      baseline.metrics.errors.rate,
      this.thresholds.errorRateIncrease
    );

    if (errorRateRegression) {
      regressions.push(errorRateRegression);
    }

    // Compare reliability
    const currentReliability = this.calculateReliability(currentResult);
    const baselineReliability = this.calculateReliability(baseline);
    
    if (currentReliability < this.thresholds.minReliability && baselineReliability >= this.thresholds.minReliability) {
      regressions.push({
        provider: currentResult.provider,
        scenario: currentResult.scenario.id,
        metric: 'reliability',
        baseline: baselineReliability,
        current: currentReliability,
        changePercent: ((currentReliability - baselineReliability) / baselineReliability) * 100,
        severity: this.calculateSeverity(currentReliability, baselineReliability, this.thresholds.minReliability, false),
        description: `Reliability dropped from ${baselineReliability}% to ${currentReliability}%`
      });
    }

    return {
      hasRegression: regressions.length > 0,
      regressions
    };
  }

  /**
   * Compare a specific metric with baseline
   */
  private compareMetric(
    provider: string,
    scenario: string,
    metric: string,
    current: number,
    baseline: number,
    threshold: number,
    decreaseIsBad: boolean = false
  ): RegressionDetail | null {
    const change = current - baseline;
    const changePercent = Math.abs((change / baseline) * 100);

    if (baseline === 0) return null;

    let hasRegression = false;
    
    if (decreaseIsBad) {
      hasRegression = change < -threshold;
    } else {
      hasRegression = change > threshold;
    }

    if (!hasRegression) return null;

    const severity = this.calculateSeverity(current, baseline, threshold, decreaseIsBad);

    return {
      provider,
      scenario,
      metric,
      baseline,
      current,
      changePercent,
      severity,
      description: this.generateRegressionDescription(metric, change, changePercent, severity)
    };
  }

  /**
   * Calculate regression severity
   */
  private calculateSeverity(
    current: number,
    baseline: number,
    threshold: number,
    decreaseIsBad: boolean
  ): 'minor' | 'major' | 'critical' {
    const changePercent = Math.abs((current - baseline) / baseline) * 100);
    
    if (changePercent >= threshold * 3) {
      return 'critical';
    } else if (changePercent >= threshold * 2) {
      return 'major';
    } else {
      return 'minor';
    }
  }

  /**
   * Calculate overall regression severity
   */
  private calculateOverallSeverity(regressions: RegressionDetail[]): 'none' | 'minor' | 'major' | 'critical' {
    if (regressions.length === 0) return 'none';
    
    const hasCritical = regressions.some(r => r.severity === 'critical');
    const hasMajor = regressions.some(r => r.severity === 'major');
    
    if (hasCritical) return 'critical';
    if (hasMajor) return 'major';
    return 'minor';
  }

  /**
   * Generate regression description
   */
  private generateRegressionDescription(
    metric: string,
    change: number,
    changePercent: number,
    severity: 'minor' | 'major' | 'critical'
  ): string {
    const direction = change > 0 ? 'increased' : 'decreased';
    const metricNames: Record<string, string> = {
      latency: 'Latency',
      throughput: 'Throughput',
      errorRate: 'Error Rate',
      reliability: 'Reliability'
    };

    return `${metricNames[metric]} ${direction} by ${changePercent.toFixed(1)}% (${severity} regression)`;
  }

  /**
   * Calculate reliability percentage
   */
  private calculateReliability(result: BenchmarkResult): number {
    if (result.iterations.length === 0) return 0;
    
    const successfulIterations = result.iterations.filter(i => i.success).length;
    return (successfulIterations / result.iterations.length) * 100;
  }

  /**
   * Load baseline result
   */
  private async loadBaseline(provider: string, scenario: string): Promise<BenchmarkResult | null> {
    const baselineFile = join(this.baselineDir, `${provider}-${scenario}.json`);
    
    if (!existsSync(baselineFile)) {
      return null;
    }

    try {
      const data = readFileSync(baselineFile, 'utf8');
      return JSON.parse(data) as BenchmarkResult;
    } catch (error) {
      console.warn(`Failed to load baseline ${baselineFile}:`, error);
      return null;
    }
  }

  /**
   * Save baseline result
   */
  private async saveBaseline(result: BenchmarkResult): Promise<void> {
    const baselineFile = join(this.baselineDir, `${result.provider}-${result.scenario.id}.json`);
    
    try {
      const data = JSON.stringify(result, null, 2);
      require('fs').writeFileSync(baselineFile, data, 'utf8');
    } catch (error) {
      console.warn(`Failed to save baseline ${baselineFile}:`, error);
    }
  }

  /**
   * Update baselines with current results
   */
  async updateBaselines(results: BenchmarkResult[]): Promise<void> {
    for (const result of results) {
      await this.saveBaseline(result);
    }
  }

  /**
   * Generate regression report
   */
  generateRegressionReport(regressionResult: RegressionResult): string {
    const { hasRegression, regressions, summary } = regressionResult;

    if (!hasRegression) {
      return `
# Regression Analysis Report

## Summary
✅ **No regressions detected** - All performance metrics are within acceptable thresholds

**Total Comparisons**: ${summary.totalComparisons}
**Regressions Detected**: 0
**Overall Status**: PASS

---
*Report generated: ${new Date().toISOString()}*
      `;
    }

    const severityEmoji = {
      minor: '⚠️',
      major: '🚨',
      critical: '🔴'
    };

    return `
# Regression Analysis Report

## Summary
${severityEmoji[summary.severity]} **Regressions detected** - Performance degradation found in ${summary.regressionsDetected} areas

**Total Comparisons**: ${summary.totalComparisons}
**Regressions Detected**: ${summary.regressionsDetected}
**Overall Severity**: ${summary.severity.toUpperCase()}

## Regression Details

| Provider | Scenario | Metric | Baseline | Current | Change | Severity | Description |
|----------|----------|--------|---------|---------|----------|-------------|
${regressions.map(reg => 
  `| ${reg.provider} | ${reg.scenario} | ${reg.metric} | ${reg.baseline} | ${reg.current} | ${reg.changePercent.toFixed(1)}% | ${reg.severity} | ${reg.description} |`
).join('\n')}

## Recommendations

${this.generateRegressionRecommendations(regressions)}

---
*Report generated: ${new Date().toISOString()}*
    `;
  }

  /**
   * Generate recommendations based on regressions
   */
  private generateRegressionRecommendations(regressions: RegressionDetail[]): string {
    const recommendations: string[] = [];

    const criticalRegressions = regressions.filter(r => r.severity === 'critical');
    const majorRegressions = regressions.filter(r => r.severity === 'major');
    const minorRegressions = regressions.filter(r => r.severity === 'minor');

    if (criticalRegressions.length > 0) {
      recommendations.push('🔴 **CRITICAL**: Immediate investigation required for critical regressions');
      recommendations.push('Consider rolling back the changes that caused critical performance degradation');
    }

    if (majorRegressions.length > 0) {
      recommendations.push('🚨 **MAJOR**: Address major regressions before next release');
      recommendations.push('Review recent changes that may have impacted performance');
    }

    if (minorRegressions.length > 0) {
      recommendations.push('⚠️ **MINOR**: Monitor minor regressions closely');
      recommendations.push('Consider performance optimizations in future iterations');
    }

    // Specific recommendations by metric
    const latencyRegressions = regressions.filter(r => r.metric === 'latency');
    const throughputRegressions = regressions.filter(r => r.metric === 'throughput');
    const reliabilityRegressions = regressions.filter(r => r.metric === 'reliability');

    if (latencyRegressions.length > 0) {
      recommendations.push('🐌 **Latency**: Profile slow operations and optimize bottlenecks');
    }

    if (throughputRegressions.length > 0) {
      recommendations.push('📈 **Throughput**: Investigate concurrency limits and resource utilization');
    }

    if (reliabilityRegressions.length > 0) {
      recommendations.push('🛡️ **Reliability**: Review error handling and retry mechanisms');
    }

    return recommendations.map(rec => `- ${rec}`).join('\n');
  }

  /**
   * Ensure baseline directory exists
   */
  private ensureBaselineDirectory(): void {
    try {
      mkdirSync(this.baselineDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }
}