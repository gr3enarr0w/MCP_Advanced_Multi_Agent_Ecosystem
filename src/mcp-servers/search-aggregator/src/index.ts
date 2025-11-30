/**
 * Search Aggregator MCP Server
 *
 * Multi-provider search aggregation with caching, result ranking, and fallback mechanisms
 *
 * Core Capabilities:
 * - Multi-provider search with automatic fallback
 * - Result caching and deduplication
 * - Search result ranking and filtering
 * - Batch search operations
 * - Search provider status monitoring
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import initSqlJs, { Database } from 'sql.js';
import { v4 as uuidv4 } from 'uuid';

// Import real search providers
import { TavilyProvider } from './providers/tavily-provider';
import { PerplexityProvider } from './providers/perplexity-provider';
import { BraveProvider } from './providers/brave-provider';
import { DuckDuckGoProvider } from './providers/duckduckgo-provider';

// Import Phase 8 enhancements
import { ResearchPlanner } from './research-planner';
import { LocalDocumentSearch, searchLocalDocuments } from './local-search';
import { ParallelSearchExecutor, executeParallelSearches } from './parallel-executor';
import { ReportSynthesizer, generateReport, createComparison } from './report-synthesizer';

// Configuration
const MCP_HOME = process.env.MCP_HOME || join(homedir(), '.mcp');
const CACHE_DB = join(MCP_HOME, 'cache', 'search', 'search_cache.db');

// Ensure directories exist
if (!existsSync(MCP_HOME)) {
  mkdirSync(MCP_HOME, { recursive: true });
}
if (!existsSync(join(MCP_HOME, 'cache', 'search'))) {
  mkdirSync(join(MCP_HOME, 'cache', 'search'), { recursive: true });
}

// Types
type SearchProvider = 'tavily' | 'perplexity' | 'brave' | 'duckduckgo';

export interface SearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  source: SearchProvider;
  score: number;
  timestamp: string;
  citations?: string[];
}

interface SearchCacheRow {
  id: number;
  query_hash: string;
  query: string;
  provider: SearchProvider;
  results: string; // JSON string
  score: number;
  timestamp: string;
  expires_at: string;
}

// Search Provider Interface
abstract class BaseSearchProvider {
  abstract name: SearchProvider;
  
  abstract search(query: string, options?: { limit?: number; language?: string }): Promise<SearchResult[]>;
  
  async healthCheck(): Promise<boolean> {
    try {
      const results = await this.search('test', { limit: 1 });
      return results.length >= 0;
    } catch {
      return false;
    }
  }
}

// Search Cache Manager
class SearchCacheStore {
  private db: Database | null = null;
  private SQL: any = null;

  async initialize(): Promise<void> {
    this.SQL = await initSqlJs();
    
    if (existsSync(CACHE_DB)) {
      const fs = await import('fs/promises');
      const buffer = await fs.readFile(CACHE_DB);
      this.db = new this.SQL.Database(buffer);
    } else {
      this.db = new this.SQL.Database();
      await this.createSchema();
    }
  }

  private async createSchema(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(`
      CREATE TABLE IF NOT EXISTS search_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query_hash TEXT UNIQUE NOT NULL,
        query TEXT NOT NULL,
        provider TEXT NOT NULL,
        results TEXT NOT NULL,
        score REAL DEFAULT 0,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        expires_at TEXT
      )
    `);

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_query_hash ON search_cache(query_hash)
    `);

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_timestamp ON search_cache(timestamp)
    `);

    await this.persist();
  }

  async saveResult(query: string, provider: SearchProvider, results: SearchResult[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const queryHash = this.getQueryHash(query);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    this.db.run(`
      INSERT OR REPLACE INTO search_cache (query_hash, query, provider, results, score, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      queryHash,
      query,
      provider,
      JSON.stringify(results),
      0, // Score calculated during retrieval
      expiresAt,
    ]);

    await this.persist();
  }

  async get(query: string, provider: SearchProvider): Promise<SearchCacheRow | null> {
    if (!this.db) throw new Error('Database not initialized');

    const queryHash = this.getQueryHash(query);
    
    const stmt = this.db.prepare(`
      SELECT * FROM search_cache 
      WHERE query_hash = ? AND provider = ? AND expires_at > ?
      ORDER BY timestamp DESC LIMIT 1
    `);

    stmt.bind([queryHash, provider, new Date().toISOString()]);

    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return this.rowToCache(row);
    }

    stmt.free();
    return null;
  }

  async clear(maxAgeDays: number = 7): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();
    
    const stmt = this.db.prepare('DELETE FROM search_cache WHERE timestamp < ?');
    stmt.run([cutoff]);
    const deleted = this.db.getRowsModified();
    stmt.free();

    await this.persist();
    return deleted;
  }

  private getQueryHash(query: string): string {
    // Simple hash function - replace with proper hashing in production
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  private rowToCache(row: any): SearchCacheRow {
    return {
      id: row.id as number,
      query_hash: row.query_hash as string,
      query: row.query as string,
      provider: row.provider as SearchProvider,
      results: row.results as string,
      score: row.score as number,
      timestamp: row.timestamp as string,
      expires_at: row.expires_at as string,
    };
  }

  async persist(): Promise<void> {
    if (!this.db) return;
    const fs = await import('fs/promises');
    const data = this.db.export();
    await fs.writeFile(CACHE_DB, Buffer.from(data));
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.persist();
      this.db.close();
      this.db = null;
    }
  }
}

// Search Aggregator
class SearchAggregator {
  private cache: SearchCacheStore;
  private providers: BaseSearchProvider[];
  private providerPriority: Record<SearchProvider, number> = {
    'tavily': 1,
    'perplexity': 2,
    'brave': 3,
    'duckduckgo': 4,
  };

  constructor() {
    this.cache = new SearchCacheStore();
    this.providers = this.initializeProviders();
  }

  private initializeProviders(): BaseSearchProvider[] {
    const providers: BaseSearchProvider[] = [];

    // Initialize DuckDuckGo (no API key required)
    try {
      providers.push(new DuckDuckGoProvider());
    } catch (error) {
      console.warn('Failed to initialize DuckDuckGo provider:', error);
    }

    // Initialize Tavily (requires API key)
    const tavilyKey = process.env.TAVILY_API_KEY;
    if (tavilyKey) {
      try {
        providers.push(new TavilyProvider(tavilyKey));
      } catch (error) {
        console.warn('Failed to initialize Tavily provider:', error);
      }
    } else {
      console.warn('TAVILY_API_KEY not found, Tavily provider will not be available');
    }

    // Initialize Perplexity (requires API key)
    const perplexityKey = process.env.PERPLEXITY_API_KEY;
    if (perplexityKey) {
      try {
        providers.push(new PerplexityProvider(perplexityKey));
      } catch (error) {
        console.warn('Failed to initialize Perplexity provider:', error);
      }
    } else {
      console.warn('PERPLEXITY_API_KEY not found, Perplexity provider will not be available');
    }

    // Initialize Brave (requires API key)
    const braveKey = process.env.BRAVE_API_KEY;
    if (braveKey) {
      try {
        providers.push(new BraveProvider(braveKey));
      } catch (error) {
        console.warn('Failed to initialize Brave provider:', error);
      }
    } else {
      console.warn('BRAVE_API_KEY not found, Brave provider will not be available');
    }

    // Sort providers by priority
    providers.sort((a, b) => this.providerPriority[a.name] - this.providerPriority[b.name]);

    return providers;
  }

  async initialize(): Promise<void> {
    await this.cache.initialize();
  }

  async search(query: string, options?: {
    limit?: number;
    providers?: SearchProvider[];
    use_cache?: boolean;
    min_score?: number;
  }): Promise<SearchResult[]> {
    const limit = options?.limit || 10;
    const providers = options?.providers || this.providers.map(p => p.name);
    const useCache = options?.use_cache ?? true;
    const minScore = options?.min_score || 0;

    // Try cache first if enabled
    if (useCache) {
      for (const providerName of providers) {
        try {
          const cached = await this.cache.get(query, providerName);
          if (cached) {
            const results = JSON.parse(cached.results) as SearchResult[];
            if (results.length > 0) {
              return results.filter(r => r.score >= minScore).slice(0, limit);
            }
          }
        } catch (error) {
          console.warn(`Cache lookup failed for ${providerName}:`, error);
        }
      }
    }

    // Fall back to live search with parallel execution
    const allResults: SearchResult[] = [];
    const providerPromises: Promise<{ provider: SearchProvider; results: SearchResult[] }>[] = [];
    
    // Create parallel search promises for requested providers
    for (const provider of this.providers) {
      if (!providers.includes(provider.name)) continue;

      const promise = provider.search(query, { limit })
        .then(results => ({ provider: provider.name, results }))
        .catch(error => {
          console.warn(`Search failed for ${provider.name}:`, error);
          return { provider: provider.name, results: [] as SearchResult[] };
        });
      
      providerPromises.push(promise);
    }

    // Execute all searches in parallel
    const providerResults = await Promise.all(providerPromises);

    // Process results with deduplication
    const seenUrls = new Set<string>();
    for (const { provider, results } of providerResults) {
      // Cache successful results
      if (results.length > 0) {
        await this.cache.saveResult(query, provider, results);
      }

      // Deduplicate by URL and filter by score
      for (const result of results) {
        if (!seenUrls.has(result.url) && result.score >= minScore) {
          seenUrls.add(result.url);
          allResults.push(result);
        }
      }
    }

    // Sort by score and limit results
    return allResults
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async batchSearch(queries: string[], options?: {
    limit?: number;
    providers?: SearchProvider[];
    use_cache?: boolean;
  }): Promise<Record<string, SearchResult[]>> {
    const results: Record<string, SearchResult[]> = {};
    
    for (const query of queries) {
      try {
        results[query] = await this.search(query, options);
      } catch (error) {
        console.warn(`Batch search failed for query "${query}":`, error);
        results[query] = [];
      }
    }

    return results;
  }

  async getProviderStatus(): Promise<Record<SearchProvider, boolean>> {
    const status: Record<SearchProvider, boolean> = {} as any;
    
    for (const provider of this.providers) {
      try {
        status[provider.name] = await provider.healthCheck();
      } catch {
        status[provider.name] = false;
      }
    }

    return status;
  }

  async clearCache(maxAgeDays?: number): Promise<number> {
    return this.cache.clear(maxAgeDays);
  }

  async close(): Promise<void> {
    await this.cache.close();
  }
}

// Initialize server
const server = new Server(
  {
    name: 'search-aggregator',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

const aggregator = new SearchAggregator();

// Define MCP tools
const tools: Tool[] = [
  {
    name: 'search',
    description: 'Perform web search using multiple providers with automatic fallback and caching',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Maximum results to return', default: 10 },
        providers: {
          type: 'array',
          items: { type: 'string', enum: ['tavily', 'perplexity', 'brave', 'duckduckgo'] },
          description: 'Specific providers to use (empty = all available)'
        },
        use_cache: { type: 'boolean', description: 'Use cached results if available', default: true },
        min_score: { type: 'number', description: 'Minimum result score (0-1)', default: 0 },
      },
      required: ['query'],
    },
  },
  {
    name: 'batch_search',
    description: 'Perform multiple searches in a single operation',
    inputSchema: {
      type: 'object',
      properties: {
        queries: { type: 'array', items: { type: 'string' }, description: 'List of search queries' },
        limit: { type: 'number', description: 'Results per query', default: 5 },
        providers: {
          type: 'array',
          items: { type: 'string', enum: ['tavily', 'perplexity', 'brave', 'duckduckgo'] },
          description: 'Specific providers to use'
        },
        use_cache: { type: 'boolean', description: 'Use cached results', default: true },
      },
      required: ['queries'],
    },
  },
  {
    name: 'get_available_providers',
    description: 'Get list of configured search providers and their status',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'clear_search_cache',
    description: 'Clear old search cache entries',
    inputSchema: {
      type: 'object',
      properties: {
        max_age_days: { type: 'number', description: 'Maximum age in days to keep (default: 7)', default: 7 },
      },
    },
  },
  {
    name: 'deep_research',
    description: 'Perform comprehensive deep research on a topic using multiple strategies and sources',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Research topic to investigate' },
        depth: { type: 'string', enum: ['quick', 'standard', 'comprehensive'], description: 'Research depth level', default: 'standard' },
        breadth: { type: 'string', enum: ['focused', 'balanced', 'extensive'], description: 'Research breadth level', default: 'balanced' },
        include_local: { type: 'boolean', description: 'Include local document search', default: true },
        max_sources: { type: 'number', description: 'Maximum number of sources to gather', default: 20 },
      },
      required: ['topic'],
    },
  },
  {
    name: 'generate_research_plan',
    description: 'Generate a detailed research plan for a given topic with structured approach',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Topic to create research plan for' },
        methodology: { type: 'string', enum: ['academic', 'practical', 'exploratory', 'comparative'], description: 'Research methodology', default: 'exploratory' },
        depth: { type: 'string', enum: ['quick', 'standard', 'comprehensive'], description: 'Plan depth level', default: 'standard' },
        breadth: { type: 'string', enum: ['focused', 'balanced', 'extensive'], description: 'Plan breadth level', default: 'balanced' },
        include_local: { type: 'boolean', description: 'Include local search strategies', default: true },
      },
      required: ['topic'],
    },
  },
  {
    name: 'search_local_documents',
    description: 'Search through indexed local documents with relevance scoring',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        paths: { type: 'array', items: { type: 'string' }, description: 'Optional paths to search within' },
        max_results: { type: 'number', description: 'Maximum results to return', default: 20 },
        min_score: { type: 'number', description: 'Minimum relevance score (0-1)', default: 0.1 },
        search_in: { type: 'array', items: { type: 'string', enum: ['title', 'content', 'summary'] }, description: 'Fields to search in', default: ['title', 'content', 'summary'] },
        fuzzy_match: { type: 'boolean', description: 'Enable fuzzy matching', default: true },
      },
      required: ['query'],
    },
  },
  {
    name: 'generate_report',
    description: 'Generate comprehensive research report in multiple formats',
    inputSchema: {
      type: 'object',
      properties: {
        research_id: { type: 'string', description: 'Unique research identifier' },
        format: { type: 'string', enum: ['markdown', 'html', 'json'], description: 'Output format', default: 'markdown' },
        include_executive_summary: { type: 'boolean', description: 'Include executive summary', default: true },
        include_methodology: { type: 'boolean', description: 'Include methodology section', default: true },
        include_sources: { type: 'boolean', description: 'Include sources section', default: true },
        include_comparisons: { type: 'boolean', description: 'Include comparison tables', default: true },
        detailed_analysis: { type: 'boolean', description: 'Include detailed analysis sections', default: true },
      },
      required: ['research_id'],
    },
  },
  {
    name: 'create_comparison',
    description: 'Create structured comparison table between different approaches or items',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Comparison topic or question' },
        items: { type: 'array', items: { type: 'object' }, description: 'Items to compare' },
        criteria: { type: 'array', items: { type: 'string' }, description: 'Comparison criteria (auto-detected if not provided)' },
      },
      required: ['topic', 'items'],
    },
  },
];

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name } = request.params;
  const args = request.params.arguments as Record<string, any> | undefined;

  try {
    switch (name) {
      case 'search': {
        const results = await aggregator.search(args?.query, {
          limit: args?.limit,
          providers: args?.providers,
          use_cache: args?.use_cache,
          min_score: args?.min_score,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                query: args?.query,
                results: results.map(r => ({
                  title: r.title,
                  url: r.url,
                  snippet: r.snippet,
                  source: r.source,
                  score: r.score,
                })),
                count: results.length,
                cached: !args?.use_cache ? false : undefined,
              }, null, 2),
            },
          ],
        };
      }

      case 'batch_search': {
        const results = await aggregator.batchSearch(args?.queries, {
          limit: args?.limit,
          providers: args?.providers,
          use_cache: args?.use_cache,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                results,
                total_queries: args?.queries?.length || 0,
                successful_queries: Object.keys(results).length,
              }, null, 2),
            },
          ],
        };
      }

      case 'get_available_providers': {
        const status = await aggregator.getProviderStatus();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                providers: Object.entries(status).map(([name, available]) => ({
                  name,
                  available,
                  status: available ? 'online' : 'offline',
                })),
                total: Object.keys(status).length,
                online: Object.values(status).filter(Boolean).length,
              }, null, 2),
            },
          ],
        };
      }

      case 'clear_search_cache': {
        const deleted = await aggregator.clearCache(args?.max_age_days);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                message: `Cleared ${deleted} cache entries`,
                max_age_days: args?.max_age_days || 7,
              }, null, 2),
            },
          ],
        };
      }

      case 'deep_research': {
        const { topic, depth, breadth, include_local, max_sources } = args;
        
        // Generate research plan
        const plan = ResearchPlanner.generateResearchPlan(topic, {
          depth,
          breadth,
          includeLocal: include_local,
          maxQuestions: Math.min(max_sources, 15),
        });

        // Execute parallel searches
        const executor = new ParallelSearchExecutor();
        await executor.initialize();
        
        try {
          const executionPlan = await executor.executeParallelSearches(plan, {
            maxConcurrent: 3,
            rateLimitDelay: 1000,
            timeout: 30,
          });

          // Generate report
          const searchResults = executor.aggregateResults(executionPlan);
          const report = generateReport(
            plan.id,
            plan,
            searchResults,
            [], // No local documents in this simple implementation
            {
              format: 'markdown',
              includeExecutiveSummary: true,
              includeSources: true,
              detailedAnalysis: true,
            }
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  research_id: plan.id,
                  topic,
                  status: executionPlan.status,
                  total_tasks: executionPlan.totalTasks,
                  completed_tasks: executionPlan.tasks.filter(t => t.status === 'completed').length,
                  report_preview: report.executiveSummary,
                  report_sections: report.sections.length,
                  total_sources: report.sources.length,
                }, null, 2),
              },
            ],
          };
        } finally {
          await executor.cleanup();
        }
      }

      case 'generate_research_plan': {
        const { topic, methodology, depth, breadth, include_local } = args;
        
        const plan = ResearchPlanner.generateResearchPlan(topic, {
          methodology,
          depth,
          breadth,
          includeLocal: include_local,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                plan_id: plan.id,
                topic: plan.topic,
                objective: plan.objective,
                scope: plan.scope,
                methodology: plan.methodology,
                questions_count: plan.questions.length,
                strategies_count: plan.strategies.length,
                estimated_time: plan.timeline.totalEstimatedTime,
                phases: plan.timeline.phases,
                success_criteria: plan.successCriteria,
              }, null, 2),
            },
          ],
        };
      }

      case 'search_local_documents': {
        const { query, paths, max_results, min_score, search_in, fuzzy_match } = args;
        
        const results = await searchLocalDocuments(query, paths, {
          maxResults: max_results,
          minScore: min_score,
          searchIn: search_in,
          fuzzyMatch: fuzzy_match,
          includeMetadata: true,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                query,
                results_count: results.length,
                results: results.map(r => ({
                  document: {
                    id: r.document.id,
                    title: r.document.title,
                    type: r.document.type,
                    language: r.document.language,
                    path: r.document.path,
                    summary: r.document.summary,
                  },
                  score: r.score,
                  matches: r.matches,
                })),
              }, null, 2),
            },
          ],
        };
      }

      case 'generate_report': {
        const { research_id, format, include_executive_summary, include_methodology, include_sources, include_comparisons, detailed_analysis } = args;
        
        // Note: In a real implementation, you would retrieve the stored research data
        // For this implementation, we'll return a placeholder response
        const synthesizer = new ReportSynthesizer();
        
        // Create a mock report for demonstration
        const mockReport = {
          id: research_id,
          title: `Research Report: ${research_id}`,
          format,
          generatedAt: new Date().toISOString(),
          status: 'generated',
          message: 'Report generation requires stored research data. Use deep_research first to generate and store research data.',
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(mockReport, null, 2),
            },
          ],
        };
      }

      case 'create_comparison': {
        const { topic, items, criteria } = args;
        
        const comparison = createComparison(topic, items, criteria);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                comparison_id: comparison.id,
                title: comparison.title,
                description: comparison.description,
                criteria: comparison.criteria,
                items_count: comparison.items.length,
                winner: comparison.winner,
                analysis: comparison.analysis,
                items: comparison.items.map(item => ({
                  name: item.name,
                  score: item.score,
                  pros: item.pros,
                  cons: item.cons,
                })),
              }, null, 2),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: `Unknown tool: ${name}` }),
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
      isError: true,
    };
  }
});

export { SearchAggregator, SearchCacheStore };

// Cleanup on exit
process.on('SIGINT', () => {
  aggregator.close().catch(console.error);
  process.exit(0);
});

process.on('SIGTERM', () => {
  aggregator.close().catch(console.error);
  process.exit(0);
});

// Start server
async function main() {
  try {
    await aggregator.initialize();
    console.error('Search Aggregator initialized');
    
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Search Aggregator MCP Server running on stdio');
  } catch (error) {
    console.error('Failed to start Search Aggregator MCP Server:', error);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(console.error);
}
