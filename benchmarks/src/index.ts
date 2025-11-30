/**
 * Main Benchmark Entry Point
 * CLI interface for running MCP performance benchmarks
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { LLMBenchmark } from '@/llm/llm-benchmark';
import { SearchBenchmark } from '@/search/search-benchmark';
import { JSONReporter } from '@/reporters/json-reporter';
import { HTMLReporter } from '@/reporters/html-reporter';
import { BenchmarkConfig } from '@/types';
import { 
  DEFAULT_BENCHMARK_CONFIG, 
  QUICK_BENCHMARK_CONFIG, 
  COMPREHENSIVE_BENCHMARK_CONFIG,
  STRESS_TEST_CONFIG,
  PRODUCTION_READINESS_CONFIG 
} from '@/config/scenarios';

const program = new Command();

program
  .name('mcp-benchmarks')
  .description('Performance benchmark suite for MCP Advanced Multi-Agent Ecosystem')
  .version('1.0.0');

program
  .command('run')
  .description('Run benchmark suite')
  .option('-c, --config <path>', 'Configuration file path')
  .option('-t, --type <type>', 'Benchmark type', 'quick|comprehensive|stress|production')
  .option('-p, --providers <providers>', 'Comma-separated list of providers to test')
  .option('-s, --scenarios <scenarios>', 'Comma-separated list of scenarios to run')
  .option('-o, --output <directory>', 'Output directory for reports', './reports')
  .option('--no-charts', 'Disable chart generation')
  .option('--no-html', 'Disable HTML report generation')
  .option('--no-json', 'Disable JSON report generation')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    try {
      const config = buildConfig(options);
      await runBenchmarks(config);
    } catch (error) {
      console.error(chalk.red('Benchmark execution failed:'), error);
      process.exit(1);
    }
  });

program
  .command('llm')
  .description('Run LLM provider benchmarks')
  .option('-c, --config <path>', 'Configuration file path')
  .option('-p, --providers <providers>', 'Comma-separated list of LLM providers')
  .option('-s, --scenarios <scenarios>', 'Comma-separated list of scenarios')
  .option('-o, --output <directory>', 'Output directory', './reports')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    try {
      const config = buildLLMConfig(options);
      await runLLMBenchmarks(config);
    } catch (error) {
      console.error(chalk.red('LLM benchmark execution failed:'), error);
      process.exit(1);
    }
  });

program
  .command('search')
  .description('Run search provider benchmarks')
  .option('-c, --config <path>', 'Configuration file path')
  .option('-p, --providers <providers>', 'Comma-separated list of search providers')
  .option('-s, --scenarios <scenarios>', 'Comma-separated list of scenarios')
  .option('-o, --output <directory>', 'Output directory', './reports')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    try {
      const config = buildSearchConfig(options);
      await runSearchBenchmarks(config);
    } catch (error) {
      console.error(chalk.red('Search benchmark execution failed:'), error);
      process.exit(1);
    }
  });

program
  .command('compare')
  .description('Compare benchmark results')
  .option('-r, --reports <files>', 'Comma-separated list of report files to compare')
  .option('-o, --output <directory>', 'Output directory', './reports')
  .action(async (options) => {
    try {
      await compareResults(options);
    } catch (error) {
      console.error(chalk.red('Result comparison failed:'), error);
      process.exit(1);
    }
  });

/**
 * Build configuration from command line options
 */
function buildConfig(options: any): BenchmarkConfig {
  let config: BenchmarkConfig;

  // Use predefined config based on type
  switch (options.type) {
    case 'quick':
      config = { ...QUICK_BENCHMARK_CONFIG };
      break;
    case 'comprehensive':
      config = { ...COMPREHENSIVE_BENCHMARK_CONFIG };
      break;
    case 'stress':
      config = { ...STRESS_TEST_CONFIG };
      break;
    case 'production':
      config = { ...PRODUCTION_READINESS_CONFIG };
      break;
    default:
      config = { ...DEFAULT_BENCHMARK_CONFIG };
  }

  // Override with command line options
  if (options.providers) {
    const providers = options.providers.split(',').map(p => p.trim());
    config.providers.llm = providers.filter(p => ['ollama', 'perplexity'].includes(p));
    config.providers.search = providers.filter(p => 
      ['tavily', 'perplexity', 'brave', 'duckduckgo'].includes(p)
    );
  }

  if (options.scenarios) {
    const scenarioIds = options.scenarios.split(',').map(s => s.trim());
    config.scenarios = config.scenarios.filter(s => scenarioIds.includes(s.id));
  }

  if (options.output) {
    config.output.directory = options.output;
  }

  if (options.noCharts) {
    config.output.generateCharts = false;
  }

  if (options.noHtml) {
    config.output.formats = config.output.formats.filter(f => f !== 'html');
  }

  if (options.noJson) {
    config.output.formats = config.output.formats.filter(f => f !== 'json');
  }

  return config;
}

/**
 * Build LLM-specific configuration
 */
function buildLLMConfig(options: any): BenchmarkConfig {
  const config = { ...DEFAULT_BENCHMARK_CONFIG };
  
  if (options.providers) {
    const providers = options.providers.split(',').map(p => p.trim());
    config.providers.llm = providers.filter(p => ['ollama', 'perplexity'].includes(p));
  }

  if (options.scenarios) {
    const scenarioIds = options.scenarios.split(',').map(s => s.trim());
    config.scenarios = config.scenarios.filter(s => 
      scenarioIds.includes(s.id) && ['latency', 'throughput', 'stress', 'cold-start', 'sustained-load', 'failover'].includes(s.type)
    );
  }

  if (options.output) {
    config.output.directory = options.output;
  }

  return config;
}

/**
 * Build search-specific configuration
 */
function buildSearchConfig(options: any): BenchmarkConfig {
  const config = { ...DEFAULT_BENCHMARK_CONFIG };
  
  if (options.providers) {
    const providers = options.providers.split(',').map(p => p.trim());
    config.providers.search = providers.filter(p => 
      ['tavily', 'perplexity', 'brave', 'duckduckgo'].includes(p)
    );
  }

  if (options.scenarios) {
    const scenarioIds = options.scenarios.split(',').map(s => s.trim());
    config.scenarios = config.scenarios.filter(s => 
      scenarioIds.includes(s.id) && ['latency', 'throughput', 'stress'].includes(s.type)
    );
  }

  if (options.output) {
    config.output.directory = options.output;
  }

  return config;
}

/**
 * Run full benchmark suite
 */
async function runBenchmarks(config: BenchmarkConfig): Promise<void> {
  console.log(chalk.blue('🚀 Starting MCP Performance Benchmarks'));
  console.log(chalk.gray(`Configuration: ${JSON.stringify(config, null, 2)}`));

  const results: any[] = [];

  // Run LLM benchmarks
  if (config.providers.llm.length > 0) {
    console.log(chalk.yellow('\n🤖 Running LLM Provider Benchmarks...'));
    const llmBenchmark = new LLMBenchmark(config);
    const llmResults = await llmBenchmark.runAllBenchmarks();
    results.push(...llmResults);
  }

  // Run search benchmarks
  if (config.providers.search.length > 0) {
    console.log(chalk.yellow('\n🔍 Running Search Provider Benchmarks...'));
    const searchBenchmark = new SearchBenchmark(config);
    const searchResults = await searchBenchmark.runAllBenchmarks();
    results.push(...searchResults);
  }

  // Generate reports
  console.log(chalk.yellow('\n📊 Generating Reports...'));
  
  if (config.output.formats.includes('json')) {
    const jsonReporter = new JSONReporter(config.output.directory);
    jsonReporter.generateReport(results);
  }

  if (config.output.formats.includes('html')) {
    const htmlReporter = new HTMLReporter(config.output.directory);
    htmlReporter.generateReport(results);
  }

  console.log(chalk.green('\n✅ Benchmarks completed successfully!'));
  console.log(chalk.blue(`📁 Reports generated in: ${config.output.directory}`));
}

/**
 * Run LLM benchmarks only
 */
async function runLLMBenchmarks(config: BenchmarkConfig): Promise<void> {
  console.log(chalk.blue('🤖 LLM Provider Benchmarks'));
  console.log(chalk.gray(`Providers: ${config.providers.llm.join(', ')}`));
  console.log(chalk.gray(`Scenarios: ${config.scenarios.map(s => s.name).join(', ')}`));

  const llmBenchmark = new LLMBenchmark(config);
  const results = await llmBenchmark.runAllBenchmarks();

  // Generate reports
  console.log(chalk.yellow('\n📊 Generating LLM Reports...'));
  
  if (config.output.formats.includes('json')) {
    const jsonReporter = new JSONReporter(config.output.directory);
    jsonReporter.generateReport(results);
  }

  if (config.output.formats.includes('html')) {
    const htmlReporter = new HTMLReporter(config.output.directory);
    htmlReporter.generateReport(results);
  }

  console.log(chalk.green('\n✅ LLM benchmarks completed successfully!'));
}

/**
 * Run search benchmarks only
 */
async function runSearchBenchmarks(config: BenchmarkConfig): Promise<void> {
  console.log(chalk.blue('🔍 Search Provider Benchmarks'));
  console.log(chalk.gray(`Providers: ${config.providers.search.join(', ')}`));
  console.log(chalk.gray(`Scenarios: ${config.scenarios.map(s => s.name).join(', ')}`));

  const searchBenchmark = new SearchBenchmark(config);
  const results = await searchBenchmark.runAllBenchmarks();

  // Generate reports
  console.log(chalk.yellow('\n📊 Generating Search Reports...'));
  
  if (config.output.formats.includes('json')) {
    const jsonReporter = new JSONReporter(config.output.directory);
    jsonReporter.generateReport(results);
  }

  if (config.output.formats.includes('html')) {
    const htmlReporter = new HTMLReporter(config.output.directory);
    htmlReporter.generateReport(results);
  }

  console.log(chalk.green('\n✅ Search benchmarks completed successfully!'));
}

/**
 * Compare benchmark results
 */
async function compareResults(options: any): Promise<void> {
  console.log(chalk.blue('📊 Comparing Benchmark Results...'));
  
  // This would implement comparison logic
  console.log(chalk.yellow('Result comparison feature coming soon!'));
}

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('Unhandled Rejection at:'), promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught Exception:'), error);
  process.exit(1);
});

// Parse command line arguments
program.parse();