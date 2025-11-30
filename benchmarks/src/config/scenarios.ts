/**
 * Benchmark Scenarios Configuration
 * Defines comprehensive test scenarios for LLM and search provider performance evaluation
 */

import { BenchmarkScenario } from '@/types';

export const BENCHMARK_SCENARIOS: BenchmarkScenario[] = [
  // LLM Latency Scenarios
  {
    id: 'small-prompt',
    name: 'Small Prompt Latency',
    description: 'Measures response time for small, simple prompts',
    type: 'latency',
    parameters: {
      promptSize: 'small',
      expectedTokens: 50
    },
    successCriteria: {
      maxLatency: 2000, // 2 seconds
      maxErrorRate: 1
    }
  },
  {
    id: 'medium-prompt',
    name: 'Medium Prompt Latency',
    description: 'Measures response time for medium complexity prompts',
    type: 'latency',
    parameters: {
      promptSize: 'medium',
      expectedTokens: 500
    },
    successCriteria: {
      maxLatency: 5000, // 5 seconds
      maxErrorRate: 2
    }
  },
  {
    id: 'large-prompt',
    name: 'Large Prompt Latency',
    description: 'Measures response time for large, complex prompts',
    type: 'latency',
    parameters: {
      promptSize: 'large',
      expectedTokens: 2000
    },
    successCriteria: {
      maxLatency: 15000, // 15 seconds
      maxErrorRate: 3
    }
  },

  // LLM Throughput Scenarios
  {
    id: 'concurrent-requests',
    name: 'Concurrent Request Throughput',
    description: 'Tests ability to handle multiple simultaneous requests',
    type: 'throughput',
    parameters: {
      concurrency: 10,
      duration: 30000 // 30 seconds
    },
    successCriteria: {
      minThroughput: 5, // 5 requests per second
      maxErrorRate: 5
    }
  },
  {
    id: 'high-concurrency',
    name: 'High Concurrency Test',
    description: 'Stress test with high concurrent request count',
    type: 'stress',
    parameters: {
      maxConcurrency: 50,
      stepSize: 5
    },
    successCriteria: {
      maxErrorRate: 10
    }
  },

  // LLM Cold Start Scenarios
  {
    id: 'cold-start',
    name: 'Cold Start Performance',
    description: 'Measures first request performance after idle period',
    type: 'cold-start',
    parameters: {
      idleTime: 30000, // 30 seconds
      coldStartCount: 5
    },
    successCriteria: {
      maxLatency: 10000, // 10 seconds for cold start
      maxErrorRate: 5
    }
  },

  // LLM Sustained Load Scenarios
  {
    id: 'sustained-load',
    name: 'Sustained Load Test',
    description: 'Tests performance over extended period',
    type: 'sustained-load',
    parameters: {
      duration: 300000, // 5 minutes
      interval: 2000 // Every 2 seconds
    },
    successCriteria: {
      maxLatency: 5000, // 5 seconds average
      maxErrorRate: 2
    }
  },

  // LLM Failover Scenarios
  {
    id: 'failover-chain',
    name: 'Provider Failover Test',
    description: 'Tests fallback chain performance',
    type: 'failover',
    parameters: {
      failoverChain: ['perplexity', 'ollama'],
      simulateFailure: true
    },
    successCriteria: {
      maxLatency: 8000, // 8 seconds for failover
      maxErrorRate: 15 // Higher tolerance for failover
    }
  },

  // Search Provider Scenarios
  {
    id: 'simple-query',
    name: 'Simple Search Query',
    description: 'Basic search performance test',
    type: 'latency',
    parameters: {
      queryType: 'simple',
      expectedResults: 5
    },
    successCriteria: {
      maxLatency: 3000, // 3 seconds
      maxErrorRate: 2
    }
  },
  {
    id: 'complex-query',
    name: 'Complex Search Query',
    description: 'Complex multi-term search performance',
    type: 'latency',
    parameters: {
      queryType: 'complex',
      expectedResults: 10
    },
    successCriteria: {
      maxLatency: 5000, // 5 seconds
      maxErrorRate: 3
    }
  },
  {
    id: 'search-throughput',
    name: 'Search Throughput Test',
    description: 'Concurrent search request performance',
    type: 'throughput',
    parameters: {
      concurrency: 20,
      duration: 60000 // 1 minute
    },
    successCriteria: {
      minThroughput: 10, // 10 searches per second
      maxErrorRate: 5
    }
  },
  {
    id: 'search-quality',
    name: 'Search Quality Assessment',
    description: 'Evaluates result quality across providers',
    type: 'latency',
    parameters: {
      qualityMetrics: ['title', 'url', 'snippet', 'relevance']
    },
    successCriteria: {
      maxLatency: 5000,
      maxErrorRate: 2,
      minQualityScore: 70 // Minimum 70% quality score
    }
  },
  {
    id: 'rate-limit-test',
    name: 'Rate Limit Handling',
    description: 'Tests behavior under rate limiting',
    type: 'stress',
    parameters: {
      requestsPerSecond: 100,
      duration: 120000 // 2 minutes
    },
    successCriteria: {
      maxErrorRate: 20 // Higher tolerance for rate limit testing
    }
  },
  {
    id: 'cache-performance',
    name: 'Cache Performance Test',
    description: 'Tests caching effectiveness and performance',
    type: 'latency',
    parameters: {
      cacheTest: true,
      repeatQueries: 3,
      cacheDelay: 5000 // 5 seconds between repeats
    },
    successCriteria: {
      maxLatency: 1000, // 1 second for cached results
      maxErrorRate: 1
    }
  }
];

export const DEFAULT_BENCHMARK_CONFIG = {
  execution: {
    warmupIterations: 3,
    iterations: 10,
    concurrency: 5,
    timeout: 30000, // 30 seconds
    iterationDelay: 100 // 100ms between iterations
  },
  providers: {
    llm: ['ollama', 'perplexity'],
    search: ['tavily', 'perplexity', 'brave', 'duckduckgo']
  },
  scenarios: BENCHMARK_SCENARIOS,
  output: {
    directory: './reports',
    formats: ['json', 'html', 'markdown'],
    generateCharts: true
  }
};

export const QUICK_BENCHMARK_CONFIG = {
  ...DEFAULT_BENCHMARK_CONFIG,
  execution: {
    ...DEFAULT_BENCHMARK_CONFIG.execution,
    iterations: 5,
    warmupIterations: 1
  },
  scenarios: BENCHMARK_SCENARIOS.filter(s => 
    s.type === 'latency' && 
    ['small-prompt', 'simple-query', 'medium-prompt'].includes(s.id)
  )
};

export const COMPREHENSIVE_BENCHMARK_CONFIG = {
  ...DEFAULT_BENCHMARK_CONFIG,
  execution: {
    warmupIterations: 5,
    iterations: 50,
    concurrency: 20,
    timeout: 60000, // 60 seconds
    iterationDelay: 50
  },
  scenarios: BENCHMARK_SCENARIOS
};

export const STRESS_TEST_CONFIG = {
  ...DEFAULT_BENCHMARK_CONFIG,
  execution: {
    warmupIterations: 2,
    iterations: 100,
    concurrency: 50,
    timeout: 120000, // 2 minutes
    iterationDelay: 10
  },
  scenarios: BENCHMARK_SCENARIOS.filter(s => 
    ['stress', 'high-concurrency', 'rate-limit-test'].includes(s.type)
  )
};

export const PRODUCTION_READINESS_CONFIG = {
  ...COMPREHENSIVE_BENCHMARK_CONFIG,
  execution: {
    warmupIterations: 10,
    iterations: 100,
    concurrency: 25,
    timeout: 120000, // 2 minutes
    iterationDelay: 25
  },
  scenarios: BENCHMARK_SCENARIOS
};