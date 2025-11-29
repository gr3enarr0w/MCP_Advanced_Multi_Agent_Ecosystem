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
type SearchProvider = 'google' | 'bing' | 'duckduckgo' | 'serpapi' | 'tavily';

interface SearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  source: SearchProvider;
  score: number;
  timestamp: string;
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

// Mock Google Search Provider (replace with actual implementation)
class GoogleProvider extends BaseSearchProvider {
  name: SearchProvider = 'google';

  async search(query: string, options?: { limit?: number; language?: string }): Promise<SearchResult[]> {
    // Mock implementation - replace with actual Google Search API
    const limit = options?.limit || 10;
    
    return Array.from({ length: Math.min(limit, 5) }, (_, i) => ({
      id: uuidv4(),
      title: `Google Result ${i + 1} for "${query}"`,
      url: `https://google.com/search?q=${encodeURIComponent(query)}&start=${i * 10}`,
      snippet: `This is a mock search result from Google for the query "${query}". In a real implementation, this would contain the actual search snippet.`,
      source: 'google' as SearchProvider,
      score: 0.9 - (i * 0.1),
      timestamp: new Date().toISOString(),
    }));
  }
}

// Mock DuckDuckGo Provider
class DuckDuckGoProvider extends BaseSearchProvider {
  name: SearchProvider = 'duckduckgo';

  async search(query: string, options?: { limit?: number; language?: string }): Promise<SearchResult[]> {
    const limit = options?.limit || 10;
    
    return Array.from({ length: Math.min(limit, 5) }, (_, i) => ({
      id: uuidv4(),
      title: `DuckDuckGo Result ${i + 1} for "${query}"`,
      url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
      snippet: `Private search result from DuckDuckGo for "${query}". This is a mock result.`,
      source: 'duckduckgo' as SearchProvider,
      score: 0.8 - (i * 0.1),
      timestamp: new Date().toISOString(),
    }));
  }
}

// Mock SerpAPI Provider
class SerpApiProvider extends BaseSearchProvider {
  name: SearchProvider = 'serpapi';

  async search(query: string, options?: { limit?: number; language?: string }): Promise<SearchResult[]> {
    const limit = options?.limit || 10;
    
    return Array.from({ length: Math.min(limit, 5) }, (_, i) => ({
      id: uuidv4(),
      title: `SerpAPI Result ${i + 1} for "${query}"`,
      url: `https://serpapi.com/search?q=${encodeURIComponent(query)}`,
      snippet: `Professional search API result for "${query}". Mock implementation.`,
      source: 'serpapi' as SearchProvider,
      score: 0.85 - (i * 0.1),
      timestamp: new Date().toISOString(),
    }));
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

  constructor() {
    this.cache = new SearchCacheStore();
    this.providers = [
      new GoogleProvider(),
      new DuckDuckGoProvider(),
      new SerpApiProvider(),
    ];
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

    // Fall back to live search
    const allResults: SearchResult[] = [];
    
    for (const provider of this.providers) {
      if (!providers.includes(provider.name)) continue;

      try {
        const results = await provider.search(query, { limit });
        
        // Deduplicate by URL
        for (const result of results) {
          if (!allResults.find(r => r.url === result.url) && result.score >= minScore) {
            allResults.push(result);
          }
        }

        // Cache successful results
        if (results.length > 0) {
          await this.cache.saveResult(query, provider.name, results);
        }

      } catch (error) {
        console.warn(`Search failed for ${provider.name}:`, error);
        continue;
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
          items: { type: 'string', enum: ['google', 'bing', 'duckduckgo', 'serpapi', 'tavily'] },
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
          items: { type: 'string', enum: ['google', 'bing', 'duckduckgo', 'serpapi', 'tavily'] },
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
