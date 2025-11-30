/**
 * HTML Reporter for Benchmark Results
 * Generates interactive HTML reports with charts and visualizations
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { BenchmarkReport, BenchmarkResult } from '@/types';

export class HTMLReporter {
  private outputDir: string;

  constructor(outputDir: string = './reports') {
    this.outputDir = outputDir;
    this.ensureOutputDirectory();
  }

  /**
   * Generate HTML report
   */
  generateReport(results: BenchmarkResult[], metadata?: any): void {
    const reportData = {
      metadata: {
        generatedAt: new Date().toISOString(),
        frameworkVersion: '1.0.0',
        formatVersion: '1.0'
      },
      summary: this.generateSummary(results),
      results,
      comparison: this.generateComparison(results)
    };

    const html = this.generateHTML(reportData);
    const filename = `benchmark-report-${new Date().toISOString().replace(/[:.]/g, '-')}.html`;
    const filepath = join(this.outputDir, filename);
    
    writeFileSync(filepath, html, 'utf8');
    console.log(`HTML report generated: ${filepath}`);
  }

  /**
   * Generate HTML content
   */
  private generateHTML(data: any): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MCP Performance Benchmark Report</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        ${this.getStyles()}
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <h1>MCP Performance Benchmark Report</h1>
            <p class="timestamp">Generated: ${data.metadata.generatedAt}</p>
        </header>

        <section class="summary">
            <h2>Executive Summary</h2>
            ${this.generateSummaryHTML(data.summary)}
        </section>

        <section class="charts">
            <h2>Performance Visualizations</h2>
            ${this.generateChartsHTML(data.results)}
        </section>

        <section class="comparison">
            <h2>Provider Comparison</h2>
            ${this.generateComparisonHTML(data.comparison)}
        </section>

        <section class="details">
            <h2>Detailed Results</h2>
            ${this.generateDetailsHTML(data.results)}
        </section>

        <section class="recommendations">
            <h2>Recommendations</h2>
            ${this.generateRecommendationsHTML(data.comparison?.recommendations || [])}
        </section>
    </div>

    <script>
        ${this.generateScripts(data)}
    </script>
</body>
</html>`;
  }

  /**
   * Generate CSS styles
   */
  private getStyles(): string {
    return `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f5f5f5;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            text-align: center;
            margin-bottom: 40px;
            padding: 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 10px;
        }

        .header h1 {
            margin-bottom: 10px;
            font-size: 2.5em;
        }

        .timestamp {
            opacity: 0.9;
            font-size: 1.1em;
        }

        section {
            margin-bottom: 40px;
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        h2 {
            color: #2c3e50;
            margin-bottom: 20px;
            font-size: 1.8em;
            border-bottom: 2px solid #e1e8ed;
            padding-bottom: 10px;
        }

        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .summary-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }

        .summary-card h3 {
            color: #667eea;
            margin-bottom: 10px;
        }

        .summary-value {
            font-size: 2em;
            font-weight: bold;
            color: #2c3e50;
        }

        .chart-container {
            margin-bottom: 30px;
            height: 400px;
            position: relative;
        }

        .chart-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }

        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e1e8ed;
        }

        th {
            background-color: #f8f9fa;
            font-weight: 600;
            color: #2c3e50;
        }

        .provider-name {
            font-weight: 600;
            color: #667eea;
        }

        .success {
            color: #10b981;
            font-weight: bold;
        }

        .warning {
            color: #f59e0b;
            font-weight: bold;
        }

        .error {
            color: #ef4444;
            font-weight: bold;
        }

        .recommendations {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 8px;
            padding: 20px;
        }

        .recommendations ul {
            margin-left: 20px;
        }

        .recommendations li {
            margin-bottom: 10px;
        }

        .metric-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            font-weight: 600;
            margin-left: 10px;
        }

        .metric-good {
            background: #10b981;
            color: white;
        }

        .metric-warning {
            background: #f59e0b;
            color: white;
        }

        .metric-error {
            background: #ef4444;
            color: white;
        }

        @media (max-width: 768px) {
            .container {
                padding: 10px;
            }
            
            .chart-grid {
                grid-template-columns: 1fr;
            }
            
            .summary-grid {
                grid-template-columns: 1fr;
            }
        }
    `;
  }

  /**
   * Generate summary HTML
   */
  private generateSummaryHTML(summary: any): string {
    return `
        <div class="summary-grid">
            <div class="summary-card">
                <h3>Total Benchmarks</h3>
                <div class="summary-value">${summary.totalBenchmarks}</div>
            </div>
            <div class="summary-card">
                <h3>Success Rate</h3>
                <div class="summary-value ${summary.successRate >= 95 ? 'success' : summary.successRate >= 80 ? 'warning' : 'error'}">
                    ${summary.successRate}%
                </div>
            </div>
            <div class="summary-card">
                <h3>Successful</h3>
                <div class="summary-value success">${summary.successfulBenchmarks}</div>
            </div>
            <div class="summary-card">
                <h3>Failed</h3>
                <div class="summary-value error">${summary.failedBenchmarks}</div>
            </div>
        </div>
    `;
  }

  /**
   * Generate charts HTML
   */
  private generateChartsHTML(results: BenchmarkResult[]): string {
    const latencyData = this.prepareLatencyData(results);
    const throughputData = this.prepareThroughputData(results);
    const errorRateData = this.prepareErrorRateData(results);

    return `
        <div class="chart-grid">
            <div class="chart-container">
                <h3>Latency Comparison</h3>
                <canvas id="latencyChart"></canvas>
            </div>
            <div class="chart-container">
                <h3>Throughput Comparison</h3>
                <canvas id="throughputChart"></canvas>
            </div>
        </div>
        <div class="chart-container">
            <h3>Error Rate Comparison</h3>
            <canvas id="errorRateChart"></canvas>
            </div>
    `;
  }

  /**
   * Generate comparison HTML
   */
  private generateComparisonHTML(comparison: any): string {
    if (!comparison || !comparison.rankings) {
      return '<p>No comparison data available</p>';
    }

    return `
        <div class="comparison-tables">
            <h3>Latency Rankings</h3>
            <table>
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Provider</th>
                        <th>Avg Latency (ms)</th>
                        <th>P95 Latency (ms)</th>
                        <th>Reliability (%)</th>
                    </tr>
                </thead>
                <tbody>
                    ${comparison.rankings.latency.map((item: any) => `
                        <tr>
                            <td>${item.rank}</td>
                            <td class="provider-name">${item.provider}</td>
                            <td>${item.metrics.avgLatency}</td>
                            <td>${item.metrics.p95Latency || 'N/A'}</td>
                            <td class="${item.metrics.reliability >= 95 ? 'success' : item.metrics.reliability >= 80 ? 'warning' : 'error'}">
                                ${item.metrics.reliability}%
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <h3>Throughput Rankings</h3>
            <table>
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Provider</th>
                        <th>Avg Throughput (req/s)</th>
                        <th>Reliability (%)</th>
                    </tr>
                </thead>
                <tbody>
                    ${comparison.rankings.throughput.map((item: any) => `
                        <tr>
                            <td>${item.rank}</td>
                            <td class="provider-name">${item.provider}</td>
                            <td>${item.metrics.avgThroughput}</td>
                            <td class="${item.metrics.reliability >= 95 ? 'success' : item.metrics.reliability >= 80 ? 'warning' : 'error'}">
                                ${item.metrics.reliability}%
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
  }

  /**
   * Generate details HTML
   */
  private generateDetailsHTML(results: BenchmarkResult[]): string {
    return `
        <div class="details-tables">
            ${results.map(result => `
                <h3>${result.scenario.name} - ${result.provider}</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Metric</th>
                            <th>Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Total Iterations</td>
                            <td>${result.iterations.length}</td>
                        </tr>
                        <tr>
                            <td>Successful</td>
                            <td class="success">${result.metadata.successfulIterations}</td>
                        </tr>
                        <tr>
                            <td>Failed</td>
                            <td class="error">${result.metadata.failedIterations}</td>
                        </tr>
                        <tr>
                            <td>Avg Latency</td>
                            <td>${result.metrics.latency.mean}ms</td>
                        </tr>
                        <tr>
                            <td>P95 Latency</td>
                            <td>${result.metrics.latency.p95}ms</td>
                        </tr>
                        <tr>
                            <td>P99 Latency</td>
                            <td>${result.metrics.latency.p99}ms</td>
                        </tr>
                        <tr>
                            <td>Throughput</td>
                            <td>${result.metrics.throughput.rps} req/s</td>
                        </tr>
                        <tr>
                            <td>Error Rate</td>
                            <td class="${result.metrics.errors.rate <= 5 ? 'success' : result.metrics.errors.rate <= 10 ? 'warning' : 'error'}">
                                ${result.metrics.errors.rate}%
                            </td>
                        </tr>
                    </tbody>
                </table>
            `).join('')}
        </div>
    `;
  }

  /**
   * Generate recommendations HTML
   */
  private generateRecommendationsHTML(recommendations: string[]): string {
    return `
        <div class="recommendations">
            <ul>
                ${recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        </div>
    `;
  }

  /**
   * Prepare latency data for charts
   */
  private prepareLatencyData(results: BenchmarkResult[]): any {
    const providers = [...new Set(results.map(r => r.provider))];
    const datasets = providers.map(provider => {
      const providerResults = results.filter(r => r.provider === provider);
      const latencies = providerResults.flatMap(r => 
        r.iterations.filter(i => i.success).map(i => i.latency)
      );
      
      return {
        label: provider,
        data: latencies,
        backgroundColor: this.getProviderColor(provider)
      };
    });

    return {
      type: 'boxPlot',
      data: { datasets }
    };
  }

  /**
   * Prepare throughput data for charts
   */
  private prepareThroughputData(results: BenchmarkResult[]): any {
    const providers = [...new Set(results.map(r => r.provider))];
    const datasets = providers.map(provider => {
      const providerResults = results.filter(r => r.provider === provider);
      const throughputs = providerResults.map(r => r.metrics.throughput.rps);
      
      return {
        label: provider,
        data: throughputs,
        backgroundColor: this.getProviderColor(provider)
      };
    });

    return {
      type: 'bar',
      data: { datasets }
    };
  }

  /**
   * Prepare error rate data for charts
   */
  private prepareErrorRateData(results: BenchmarkResult[]): any {
    const providers = [...new Set(results.map(r => r.provider))];
    const datasets = providers.map(provider => {
      const providerResults = results.filter(r => r.provider === provider);
      const errorRates = providerResults.map(r => r.metrics.errors.rate);
      
      return {
        label: provider,
        data: errorRates,
        backgroundColor: this.getProviderColor(provider)
      };
    });

    return {
      type: 'bar',
      data: { datasets }
    };
  }

  /**
   * Get color for provider
   */
  private getProviderColor(provider: string): string {
    const colors: Record<string, string> = {
      'ollama': 'rgba(54, 162, 235, 0.8)',
      'perplexity': 'rgba(59, 130, 246, 0.8)',
      'tavily': 'rgba(16, 185, 129, 0.8)',
      'brave': 'rgba(251, 146, 60, 0.8)',
      'duckduckgo': 'rgba(245, 158, 11, 0.8)'
    };
    return colors[provider] || 'rgba(156, 163, 175, 0.8)';
  }

  /**
   * Generate JavaScript for charts
   */
  private generateScripts(data: any): string {
    return `
        // Initialize charts when DOM is ready
        document.addEventListener('DOMContentLoaded', function() {
            const chartOptions = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Performance Comparison'
                    }
                }
            };

            // Latency Chart
            const latencyCtx = document.getElementById('latencyChart').getContext('2d');
            new Chart(latencyCtx, {
                type: 'boxPlot',
                data: ${JSON.stringify(this.prepareLatencyData(data.results))},
                options: {
                    ...chartOptions,
                    plugins: {
                        ...chartOptions.plugins,
                        title: {
                            ...chartOptions.plugins.title,
                            text: 'Latency Distribution by Provider'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Latency (ms)'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Provider'
                            }
                        }
                    }
                }
            });

            // Throughput Chart
            const throughputCtx = document.getElementById('throughputChart').getContext('2d');
            new Chart(throughputCtx, {
                type: 'bar',
                data: ${JSON.stringify(this.prepareThroughputData(data.results))},
                options: {
                    ...chartOptions,
                    plugins: {
                        ...chartOptions.plugins,
                        title: {
                            ...chartOptions.plugins.title,
                            text: 'Throughput by Provider'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Requests per Second'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Provider'
                            }
                        }
                    }
                }
            });

            // Error Rate Chart
            const errorRateCtx = document.getElementById('errorRateChart').getContext('2d');
            new Chart(errorRateCtx, {
                type: 'bar',
                data: ${JSON.stringify(this.prepareErrorRateData(data.results))},
                options: {
                    ...chartOptions,
                    plugins: {
                        ...chartOptions.plugins,
                        title: {
                            ...chartOptions.plugins.title,
                            text: 'Error Rate by Provider'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            title: {
                                display: true,
                                text: 'Error Rate (%)'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Provider'
                            }
                        }
                    }
                }
            });
        });
    `;
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