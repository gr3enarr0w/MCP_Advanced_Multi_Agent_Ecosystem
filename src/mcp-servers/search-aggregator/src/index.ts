/**
 * Search Aggregator MCP Server
 * 
 * Multi-provider search with fallback and caching:
 * - Perplexity (primary)
 * - Brave Search (secondary)
 * - Google Search (tertiary)
 * - DuckDuckGo (fallback)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance } from 'axios';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

// Configuration
const MCP_HOME = join(homedir(), '.mcp');
const CACHE_DB = join(MCP_HOME, 'cache', 'search', 'cache.db');

// Ensure directory exists
const cacheDir = join(MCP_HOME, 'cache', 'search');
if (!existsSync(cacheDir)) {
  mkdirSync(cacheDir, { recursive: true });
}

// Provider configuration from environment
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || '';
const BRAVE_API_KEY = process.env.BRAVE_API_KEY || '';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';
const GOOGLE_CX = process.env.GOOGLE_CX || '';

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  provider: string;
  timestamp: string;
}

interface CachedResult {
  query: string;
  results: string; // JSON
  provider: string;
  timestamp: number;
}

class SearchCache {
  private db: SqlJsDatabase | null = null;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async init() {
    const SQL = await initSqlJs();
    
    // Load existing database or create new one
    if (existsSync(this.dbPath)) {
      const buffer = readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
      this.initDatabase();
      this.save();
    }
  }

  private initDatabase() {
    if (!this.db) return;
    
    this.db.run(`
      CREATE TABLE IF NOT EXISTS search_cache (
        query TEXT PRIMARY KEY,
        results TEXT NOT NULL,
        provider TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      )
    `);
    
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_timestamp ON search_cache(timestamp)`);
  }

  private save() {
    if (!this.db) return;
    const data = this.db.export();
    writeFileSync(this.dbPath, data);
  }

  get(query: string, maxAge: number = 86400): SearchResult[] | null {
    if (!this.db) return null;
    
    const now = Date.now();
    const minTimestamp = now - (maxAge * 1000);
    
    const result = this.db.exec(
      'SELECT results FROM search_cache WHERE query = ? AND timestamp > ?',
      [query, minTimestamp]
    );
    
    if (result.length > 0 && result[0].values.length > 0) {
      return JSON.parse(result[0].values[0][0] as string);
    }
    
    return null;
  }

  set(query: string, results: SearchResult[], provider: string): void {
    if (!this.db) return;
    
    this.db.run(
      `INSERT OR REPLACE INTO search_cache (query, results, provider, timestamp)
       VALUES (?, ?, ?, ?)`,
      [query, JSON.stringify(results), provider, Date.now()]
    );
    
    this.save();
  }

  clearOld(maxAge: number = 604800): void {
    if (!this.db) return;
    
    const cutoff = Date.now() - (maxAge * 1000);
    this.db.run('DELETE FROM search_cache WHERE timestamp < ?', [cutoff]);
    
    this.save();
  }

  close() {
    // sql.js doesn't need explicit close
  }
}

abstract class SearchProvider {
  protected client: AxiosInstance;
  abstract name: string;
  abstract priority: number;

  constructor() {
    this.client = axios.create({
      timeout: 10000,
    });
  }

  abstract isConfigured(): boolean;
  abstract search(query: string, limit: number): Promise<SearchResult[]>;
}

class PerplexityProvider extends SearchProvider {
  name = 'perplexity';
  priority = 1;

  isConfigured(): boolean {
    return PERPLEXITY_API_KEY.length > 0;
  }

  async search(query: string, limit: number = 5): Promise<SearchResult[]> {
    try {
      const response = await this.client.post(
        'https://api.perplexity.ai/chat/completions',
        {
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful search assistant. Provide concise, accurate information.'
            },
            {
              role: 'user',
              content: query
            }
          ],
          max_tokens: 1000,
        },
        {
          headers: {
            'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const content = response.data.choices[0].message.content;
      
      // Parse Perplexity response into search results
      return [{
        title: 'Perplexity AI Response',
        url: 'https://perplexity.ai',
        snippet: content,
        provider: this.name,
        timestamp: new Date().toISOString(),
      }];
    } catch (error) {
      console.error('Perplexity search failed:', error);
      throw error;
    }
  }
}

class BraveProvider extends SearchProvider {
  name = 'brave';
  priority = 2;

  isConfigured(): boolean {
    return BRAVE_API_KEY.length > 0;
  }

  async search(query: string, limit: number = 5): Promise<SearchResult[]> {
    try {
      const response = await this.client.get(
        'https://api.search.brave.com/res/v1/web/search',
        {
          params: {
            q: query,
            count: limit,
          },
          headers: {
            'X-Subscription-Token': BRAVE_API_KEY,
            'Accept': 'application/json',
          },
        }
      );

      const results: SearchResult[] = [];
      for (const result of response.data.web?.results || []) {
        results.push({
          title: result.title,
          url: result.url,
          snippet: result.description || '',
          provider: this.name,
          timestamp: new Date().toISOString(),
        });
      }

      return results;
    } catch (error) {
      console.error('Brave search failed:', error);
      throw error;
    }
  }
}

class GoogleProvider extends SearchProvider {
  name = 'google';
  priority = 3;

  isConfigured(): boolean {
    return GOOGLE_API_KEY.length > 0 && GOOGLE_CX.length > 0;
  }

  async search(query: string, limit: number = 5): Promise<SearchResult[]> {
    try {
      const response = await this.client.get(
        'https://www.googleapis.com/customsearch/v1',
        {
          params: {
            key: GOOGLE_API_KEY,
            cx: GOOGLE_CX,
            q: query,
            num: limit,
          },
        }
      );

      const results: SearchResult[] = [];
      for (const item of response.data.items || []) {
        results.push({
          title: item.title,
          url: item.link,
          snippet: item.snippet || '',
          provider: this.name,
          timestamp: new Date().toISOString(),
        });
      }

      return results;
    } catch (error) {
      console.error('Google search failed:', error);
      throw error;
    }
  }
}

class DuckDuckGoProvider extends SearchProvider {
  name = 'duckduckgo';
  priority = 4;

  isConfigured(): boolean {
    return true; // Always available (no API key needed)
  }

  async search(query: string, limit: number = 5): Promise<SearchResult[]> {
    try {
      // Using DuckDuckGo instant answer API
      const response = await this.client.get(
        'https://api.duckduckgo.com/',
        {
          params: {
            q: query,
            format: 'json',
            no_html: 1,
            skip_disambig: 1,
          },
        }
      );

      const results: SearchResult[] = [];
      
      // Add abstract if available
      if (response.data.AbstractText) {
        results.push({
          title: response.data.Heading || 'DuckDuckGo Result',
          url: response.data.AbstractURL || 'https://duckduckgo.com',
          snippet: response.data.AbstractText,
          provider: this.name,
          timestamp: new Date().toISOString(),
        });
      }

      // Add related topics
      for (const topic of (response.data.RelatedTopics || []).slice(0, limit - results.length)) {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(' - ')[0] || 'DuckDuckGo Topic',
            url: topic.FirstURL,
            snippet: topic.Text,
            provider: this.name,
            timestamp: new Date().toISOString(),
          });
        }
      }

      return results;
    } catch (error) {
      console.error('DuckDuckGo search failed:', error);
      throw error;
    }
  }
}

class SearchAggregator {
  private providers: SearchProvider[];
  private cache: SearchCache;

  constructor(cachePath: string) {
    this.providers = [
      new PerplexityProvider(),
      new BraveProvider(),
      new GoogleProvider(),
      new DuckDuckGoProvider(),
    ].sort((a, b) => a.priority - b.priority);

    this.cache = new SearchCache(cachePath);
  }

  async init() {
    await this.cache.init();
  }

  async search(query: string, limit: number = 5, useCache: boolean = true): Promise<{
    results: SearchResult[];
    provider: string;
    cached: boolean;
  }> {
    // Check cache first
    if (useCache) {
      const cached = this.cache.get(query);
      if (cached) {
        return {
          results: cached,
          provider: cached[0]?.provider || 'cache',
          cached: true,
        };
      }
    }

    // Try each provider in order
    for (const provider of this.providers) {
      if (!provider.isConfigured()) {
        console.log(`Provider ${provider.name} not configured, skipping`);
        continue;
      }

      try {
        const results = await provider.search(query, limit);
        
        // Cache successful results
        if (results.length > 0) {
          this.cache.set(query, results, provider.name);
          
          return {
            results,
            provider: provider.name,
            cached: false,
          };
        }
      } catch (error) {
        console.error(`Provider ${provider.name} failed:`, error);
        // Continue to next provider
      }
    }

    // All providers failed
    throw new Error('All search providers failed or returned no results');
  }

  getAvailableProviders(): string[] {
    return this.providers
      .filter(p => p.isConfigured())
      .map(p => p.name);
  }

  clearCache(maxAge?: number): void {
    this.cache.clearOld(maxAge);
  }

  close() {
    this.cache.close();
  }
}

// Initialize server
const server = new Server(
  {
    name: 'search-aggregator',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Initialize aggregator (will be initialized in main())
const aggregator = new SearchAggregator(CACHE_DB);

// Define tools
const tools: Tool[] = [
  {
    name: 'search',
    description: 'Search the web using multiple providers with automatic fallback',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results',
          default: 5,
        },
        use_cache: {
          type: 'boolean',
          description: 'Use cached results if available',
          default: true,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_available_providers',
    description: 'Get list of configured search providers',
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
        max_age_days: {
          type: 'number',
          description: 'Clear entries older than this many days',
          default: 7,
        },
      },
    },
  },
];

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'search': {
        const result = await aggregator.search(
          args?.query as string,
          args?.limit as number || 5,
          args?.use_cache as boolean ?? true
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                query: args?.query,
                provider: result.provider,
                cached: result.cached,
                count: result.results.length,
                results: result.results,
              }, null, 2),
            },
          ],
        };
      }

      case 'get_available_providers': {
        const providers = aggregator.getAvailableProviders();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                providers,
                count: providers.length,
              }, null, 2),
            },
          ],
        };
      }

      case 'clear_search_cache': {
        const maxAgeDays = args?.max_age_days as number || 7;
        aggregator.clearCache(maxAgeDays * 86400);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: 'cleared',
                max_age_days: maxAgeDays,
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

// Cleanup on exit
process.on('SIGINT', () => {
  aggregator.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  aggregator.close();
  process.exit(0);
});

// Start server
async function main() {
  // Initialize aggregator first
  await aggregator.init();
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Search Aggregator MCP Server running on stdio');
}

main().catch(console.error);