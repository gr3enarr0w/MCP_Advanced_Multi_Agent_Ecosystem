/**
 * Core types and interfaces for the MCP Performance Benchmark Framework
 */

export interface BenchmarkConfig {
  /** Benchmark execution configuration */
  execution: {
    /** Number of warmup iterations */
    warmupIterations: number;
    /** Number of benchmark iterations */
    iterations: number;
    /** Concurrent request count */
    concurrency: number;
    /** Request timeout in milliseconds */
    timeout: number;
    /** Delay between iterations in milliseconds */
    iterationDelay: number;
  };
  /** Provider configuration */
  providers: {
    /** LLM providers to benchmark */
    llm: string[];
    /** Search providers to benchmark */
    search: string[];
  };
  /** Test scenarios to run */
  scenarios: BenchmarkScenario[];
  /** Output configuration */
  output: {
    /** Output directory for reports */
    directory: string;
    /** Report formats to generate */
    formats: ReportFormat[];
    /** Whether to generate charts */
    generateCharts: boolean;
  };
}

export interface BenchmarkScenario {
  /** Unique scenario identifier */
  id: string;
  /** Human-readable scenario name */
  name: string;
  /** Scenario description */
  description: string;
  /** Scenario type */
  type: 'latency' | 'throughput' | 'stress' | 'cold-start' | 'sustained-load' | 'failover';
  /** Test parameters */
  parameters: Record<string, any>;
  /** Expected duration in seconds */
  expectedDuration?: number;
  /** Success criteria */
  successCriteria: {
    /** Maximum acceptable latency (ms) */
    maxLatency?: number;
    /** Minimum required throughput (req/s) */
    minThroughput?: number;
    /** Maximum acceptable error rate (%) */
    maxErrorRate?: number;
  };
}

export interface BenchmarkResult {
  /** Unique result identifier */
  id: string;
  /** Benchmark timestamp */
  timestamp: string;
  /** Scenario that was executed */
  scenario: BenchmarkScenario;
  /** Provider that was tested */
  provider: string;
  /** Individual iteration results */
  iterations: IterationResult[];
  /** Aggregated metrics */
  metrics: BenchmarkMetrics;
  /** Execution metadata */
  metadata: {
    /** Total execution time (ms) */
    totalExecutionTime: number;
    /** Number of successful iterations */
    successfulIterations: number;
    /** Number of failed iterations */
    failedIterations: number;
    /** Environment information */
    environment: EnvironmentInfo;
  };
}

export interface IterationResult {
  /** Iteration number */
  iteration: number;
  /** Request timestamp */
  timestamp: string;
  /** Request latency (ms) */
  latency: number;
  /** Whether the request was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Response size in bytes */
  responseSize?: number;
  /** Token usage for LLM requests */
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
  /** Additional provider-specific metrics */
  providerMetrics?: Record<string, any>;
}

export interface BenchmarkMetrics {
  /** Latency statistics */
  latency: {
    /** Minimum latency (ms) */
    min: number;
    /** Maximum latency (ms) */
    max: number;
    /** Mean latency (ms) */
    mean: number;
    /** Median latency (ms) */
    median: number;
    /** 95th percentile latency (ms) */
    p95: number;
    /** 99th percentile latency (ms) */
    p99: number;
    /** Standard deviation */
    stddev: number;
  };
  /** Throughput metrics */
  throughput: {
    /** Requests per second */
    rps: number;
    /** Average response time (ms) */
    avgResponseTime: number;
    /** Peak concurrent requests */
    peakConcurrency: number;
  };
  /** Error metrics */
  errors: {
    /** Total number of errors */
    total: number;
    /** Error rate percentage */
    rate: number;
    /** Error types and counts */
    types: Record<string, number>;
  };
  /** Resource usage metrics */
  resources?: {
    /** Memory usage (MB) */
    memory: number;
    /** CPU usage percentage */
    cpu: number;
    /** Network usage (bytes) */
    network: number;
  };
}

export interface EnvironmentInfo {
  /** Node.js version */
  nodeVersion: string;
  /** Operating system */
  platform: string;
  /** Architecture */
  arch: string;
  /** Available memory (MB) */
  totalMemory: number;
  /** CPU cores */
  cpuCores: number;
  /** Git commit hash */
  gitCommit?: string;
  /** Build timestamp */
  buildTime?: string;
}

export interface LLMProviderConfig {
  /** Provider name */
  name: string;
  /** Provider type */
  type: 'ollama' | 'perplexity';
  /** API endpoint */
  endpoint: string;
  /** API key (if required) */
  apiKey?: string;
  /** Default model */
  model: string;
  /** Additional configuration */
  config?: Record<string, any>;
}

export interface SearchProviderConfig {
  /** Provider name */
  name: string;
  /** Provider type */
  type: 'tavily' | 'perplexity' | 'brave' | 'duckduckgo';
  /** API endpoint */
  endpoint: string;
  /** API key (if required) */
  apiKey?: string;
  /** Additional configuration */
  config?: Record<string, any>;
}

export interface LLMTestPayload {
  /** Test prompt or message array */
  prompt: string | ChatMessage[];
  /** Generation options */
  options?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    stop?: string[];
  };
  /** Expected response characteristics */
  expectations?: {
    minResponseLength?: number;
    maxResponseLength?: number;
    responseTime?: number;
  };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface SearchTestPayload {
  /** Search query */
  query: string;
  /** Maximum results to return */
  limit?: number;
  /** Whether to use cache */
  useCache?: boolean;
  /** Expected result characteristics */
  expectations?: {
    minResults?: number;
    maxResults?: number;
    responseTime?: number;
  };
}

export type ReportFormat = 'json' | 'csv' | 'html' | 'markdown';

export interface BenchmarkReport {
  /** Report metadata */
  metadata: {
    /** Report generation timestamp */
    generatedAt: string;
    /** Benchmark framework version */
    frameworkVersion: string;
    /** Report format version */
    formatVersion: string;
  };
  /** Executive summary */
  summary: {
    /** Total benchmarks run */
    totalBenchmarks: number;
    /** Successful benchmarks */
    successfulBenchmarks: number;
    /** Failed benchmarks */
    failedBenchmarks: number;
    /** Overall success rate */
    successRate: number;
    /** Key findings */
    keyFindings: string[];
  };
  /** Detailed results */
  results: BenchmarkResult[];
  /** Comparative analysis */
  comparison?: {
    /** Provider rankings by metric */
    rankings: Record<string, ProviderRanking[]>;
    /** Performance recommendations */
    recommendations: string[];
  };
}

export interface ProviderRanking {
  /** Provider name */
  provider: string;
  /** Rank position */
  rank: number;
  /** Score */
  score: number;
  /** Metrics used for ranking */
  metrics: Record<string, number>;
}

export interface BenchmarkError extends Error {
  /** Error type */
  type: 'TIMEOUT' | 'CONNECTION' | 'AUTHENTICATION' | 'RATE_LIMIT' | 'PROVIDER_ERROR' | 'CONFIGURATION';
  /** Provider that generated the error */
  provider: string;
  /** HTTP status code if applicable */
  statusCode?: number;
  /** Original error */
  originalError?: Error;
}

export interface ProgressCallback {
  (progress: ProgressInfo): void;
}

export interface ProgressInfo {
  /** Current operation */
  operation: string;
  /** Progress percentage (0-100) */
  percentage: number;
  /** Current item being processed */
  current?: string;
  /** Total items to process */
  total?: number;
  /** Estimated time remaining (seconds) */
  eta?: number;
  /** Additional information */
  details?: Record<string, any>;
}