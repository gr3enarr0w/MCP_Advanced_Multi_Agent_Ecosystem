# MCP Performance Benchmark Suite

Comprehensive performance benchmarking framework for the MCP Advanced Multi-Agent Ecosystem, designed to measure and compare LLM and search provider performance across various scenarios.

## 🎯 Overview

This benchmark suite provides:

- **LLM Provider Benchmarks**: Performance testing for Ollama and Perplexity providers
- **Search Provider Benchmarks**: Performance testing for Tavily, Perplexity, Brave, and DuckDuckGo providers
- **Comprehensive Scenarios**: Latency, throughput, stress, cold start, sustained load, and failover testing
- **Interactive Reports**: HTML reports with charts, JSON data, and regression detection
- **CI/CD Integration**: Automated benchmark execution and performance monitoring

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ 
- Access to MCP servers (Ollama, Perplexity, search providers)
- API keys for external providers (Tavily, Brave)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd MCP_Advanced_Multi_Agent_Ecosystem/benchmarks

# Install dependencies
npm install

# Build the benchmark suite
npm run build
```

### Environment Configuration

Set up environment variables for provider access:

```bash
# LLM Providers
export OLLAMA_BASE_URL="http://localhost:11434"
export OLLAMA_MODEL="llama2"
export PERPLEXITY_API_KEY="your-perplexity-api-key"
export PERPLEXITY_BASE_URL="http://localhost:8080"
export PERPLEXITY_MODEL="llama-3.1-sonar-small-128k-online"

# Search Providers
export TAVILY_API_KEY="your-tavily-api-key"
export BRAVE_API_KEY="your-brave-api-key"
# DuckDuckGo (no API key required)
```

## 📊 Usage

### Basic Benchmark Execution

```bash
# Run quick benchmarks (recommended for daily checks)
npm run benchmark -- --type quick

# Run comprehensive benchmarks
npm run benchmark -- --type comprehensive

# Run stress tests
npm run benchmark -- --type stress

# Run production readiness benchmarks
npm run benchmark -- --type production

# LLM-specific benchmarks
npm run llm -- --providers ollama,perplexity

# Search-specific benchmarks
npm run search -- --providers tavily,perplexity,brave,duckduckgo
```

### Advanced Options

```bash
# Custom provider selection
npm run benchmark -- --providers ollama --providers perplexity

# Custom scenarios
npm run benchmark -- --scenarios small-prompt,medium-prompt,large-prompt

# Custom output directory
npm run benchmark -- --output ./custom-reports

# Disable charts (JSON only)
npm run benchmark -- --no-charts

# Verbose output
npm run benchmark -- --verbose
```

## 📋 Benchmark Scenarios

### LLM Scenarios

| Scenario | Description | Duration | Metrics |
|----------|-------------|----------|---------|
| `small-prompt` | Tests small, simple prompts | Latency (p50, p95, p99) |
| `medium-prompt` | Medium complexity prompts | Latency, token usage |
| `large-prompt` | Large, complex prompts | Latency, throughput, error rate |
| `concurrent-requests` | Multiple simultaneous requests | Throughput, concurrency handling |
| `high-concurrency` | Stress test with high concurrency | Error rate, resource limits |
| `cold-start` | First request after idle period | Cold start latency |
| `sustained-load` | Extended period testing | Performance over time |
| `failover-chain` | Provider fallback testing | Failover performance |

### Search Scenarios

| Scenario | Description | Metrics |
|----------|-------------|---------|
| `simple-query` | Basic search queries | Latency, result count |
| `complex-query` | Multi-term searches | Latency, result quality |
| `search-throughput` | Concurrent searches | Throughput, rate limiting |
| `search-quality` | Result quality assessment | Relevance, completeness |
| `rate-limit-test` | Rate limiting behavior | Error handling, recovery |
| `cache-performance` | Caching effectiveness | Cache hit/miss rates |

## 📈 Reports

### Report Formats

#### HTML Reports
- Interactive charts and visualizations
- Performance comparisons and rankings
- Provider recommendations
- Mobile-responsive design

#### JSON Reports
- Machine-readable format for programmatic analysis
- Complete metric data
- Integration-friendly structure

#### Markdown Reports
- Summary tables and statistics
- Performance trends
- Regression analysis

### Key Metrics

#### Latency Metrics
- **p50**: 50th percentile response time
- **p95**: 95th percentile response time
- **p99**: 99th percentile response time
- **Mean**: Average response time
- **StdDev**: Standard deviation

#### Throughput Metrics
- **RPS**: Requests per second
- **Concurrency**: Peak concurrent requests
- **Success Rate**: Percentage of successful requests

#### Quality Metrics
- **Reliability**: Success rate over time
- **Error Rate**: Failure percentage
- **Consistency**: Performance variance

## 🔧 Configuration

### Benchmark Types

#### Quick Benchmarks
```json
{
  "execution": {
    "warmupIterations": 1,
    "iterations": 5,
    "concurrency": 5,
    "timeout": 30000,
    "iterationDelay": 100
  },
  "scenarios": ["small-prompt", "simple-query", "medium-prompt"]
}
```

#### Comprehensive Benchmarks
```json
{
  "execution": {
    "warmupIterations": 5,
    "iterations": 50,
    "concurrency": 20,
    "timeout": 60000,
    "iterationDelay": 50
  },
  "scenarios": "all"
}
```

#### Stress Tests
```json
{
  "execution": {
    "warmupIterations": 2,
    "iterations": 100,
    "concurrency": 50,
    "timeout": 120000,
    "iterationDelay": 10
  },
  "scenarios": ["stress", "high-concurrency", "rate-limit-test"]
}
```

### Provider Configuration

#### LLM Providers
- **Ollama**: Local models, no API key required
- **Perplexity**: Cloud-based, API key required

#### Search Providers
- **Tavily**: Web search, API key required
- **Perplexity**: Web search with AI enhancement
- **Brave**: Privacy-focused search, API key required
- **DuckDuckGo**: Privacy-focused, no API key required

## 🔄 CI/CD Integration

### GitHub Actions

The benchmark suite includes automated CI/CD integration:

- **Automated Execution**: Daily scheduled runs
- **Pull Request Testing**: Benchmarks on PR changes
- **Regression Detection**: Automatic performance regression analysis
- **Result Archiving**: Historical performance tracking
- **Status Reporting**: GitHub status updates

### Regression Detection

Automated detection of performance regressions:

- **Thresholds**: Configurable tolerance levels
- **Baseline Comparison**: Compare with previous runs
- **Severity Levels**: Minor, Major, Critical
- **Alerting**: Automatic PR comments for regressions

#### Regression Thresholds
- **Latency**: 15% increase triggers alert
- **Throughput**: 10% decrease triggers alert
- **Error Rate**: 25% increase triggers alert
- **Reliability**: Below 90% triggers alert

## 📊 Performance Baselines

### Current Baselines

Established performance baselines for comparison:

#### LLM Providers
| Provider | Scenario | Latency (p95) | Throughput | Reliability |
|-----------|----------|------------------|------------|------------|
| Ollama | small-prompt | 500ms | 10 req/s | 99% |
| Perplexity | small-prompt | 800ms | 8 req/s | 98% |

#### Search Providers
| Provider | Scenario | Latency (p95) | Result Count | Quality Score |
|-----------|----------|------------------|-------------|------------|
| Tavily | simple-query | 300ms | 8.2 | 85% |
| Perplexity | simple-query | 450ms | 7.8 | 82% |
| Brave | simple-query | 350ms | 8.5 | 88% |
| DuckDuckGo | simple-query | 400ms | 7.2 | 80% |

*Note: Baselines are updated weekly based on latest measurements*

## 🛠️ Development

### Project Structure

```
benchmarks/
├── src/
│   ├── core/
│   │   └── benchmark-runner.ts     # Core benchmark execution engine
│   ├── llm/
│   │   └── llm-benchmark.ts      # LLM provider benchmarks
│   ├── search/
│   │   └── search-benchmark.ts    # Search provider benchmarks
│   ├── config/
│   │   └── scenarios.ts          # Benchmark scenarios configuration
│   ├── reporters/
│   │   ├── json-reporter.ts       # JSON report generation
│   │   └── html-reporter.ts       # HTML report generation
│   ├── ci/
│   │   └── regression-detector.ts # Regression detection
│   └── index.ts                  # CLI interface
├── reports/                         # Generated reports
├── baselines/                       # Performance baselines
└── docs/                          # Documentation
```

### Adding New Scenarios

1. Define scenario in `src/config/scenarios.ts`
2. Add test payloads to relevant benchmark class
3. Update configuration presets if needed
4. Add documentation

### Adding New Providers

1. Implement provider interface in relevant benchmark class
2. Add provider configuration handling
3. Update type definitions
4. Add test cases and scenarios

## 🧪 Testing

### Running Tests

```bash
# Run unit tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test files
npm test -- --testPathPattern=llm
```

### Test Structure

- Unit tests for core functionality
- Integration tests for provider APIs
- Mock providers for testing without API calls
- Performance test validation

## 📚 API Reference

### Core Classes

#### BenchmarkRunner
Base class for benchmark execution with methods:
- `runAllBenchmarks()`: Execute all configured scenarios
- `runScenario()`: Execute specific scenario
- `executeProviderRequest()`: Abstract method for provider requests

#### LLMBenchmark
Extends BenchmarkRunner for LLM testing:
- `executeOllamaRequest()`: Ollama API integration
- `executePerplexityRequest()`: Perplexity API integration
- `getProviderHealth()`: Health check functionality

#### SearchBenchmark
Extends BenchmarkRunner for search testing:
- `executeTavilyRequest()`: Tavily API integration
- `executeBraveRequest()`: Brave API integration
- `executeDuckDuckGoRequest()`: DuckDuckGo API integration

### Reporters

#### JSONReporter
Generates machine-readable JSON reports:
- `generateReport()`: Create comprehensive JSON report
- `generateSummary()`: Calculate statistics and summaries
- `generateComparison()`: Provider ranking and analysis

#### HTMLReporter
Generates interactive HTML reports:
- `generateHTML()`: Create HTML with Chart.js visualizations
- `generateChartsHTML()`: Performance comparison charts
- `generateComparisonHTML()`: Provider ranking tables

## 🔍 Troubleshooting

### Common Issues

#### Provider Connection Errors
```bash
# Check provider availability
npm run llm -- --providers ollama --scenarios health-check

# Verify API keys
echo $PERPLEXITY_API_KEY
```

#### Performance Issues
```bash
# Increase timeout for slow providers
npm run benchmark -- --type stress -- --timeout 300000

# Reduce concurrency for rate limiting
npm run benchmark -- --concurrency 5
```

#### Report Generation Errors
```bash
# Check output directory permissions
ls -la reports/

# Clear cache and retry
rm -rf reports/ && npm run benchmark
```

### Debug Mode

Enable verbose logging for detailed execution information:

```bash
npm run benchmark -- --verbose
```

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add your benchmark improvements
4. Ensure all tests pass
5. Submit a pull request
6. Follow the coding standards and documentation

## 📞 Support

For issues and questions:

- Create GitHub issues with detailed reproduction steps
- Include environment information and provider versions
- Provide benchmark configuration and results
- Share performance expectations vs actual results

---

*Last updated: November 29, 2024*