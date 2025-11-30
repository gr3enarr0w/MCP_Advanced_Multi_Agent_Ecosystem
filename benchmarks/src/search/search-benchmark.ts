/**
 * Search Provider Benchmark Implementation
 * Benchmarks Tavily, Perplexity, Brave, and DuckDuckGo providers for performance comparison
 */

import axios from 'axios';
import { BenchmarkRunner } from '@/core/benchmark-runner';
import {
  BenchmarkConfig,
  BenchmarkResult,
  BenchmarkScenario,
  SearchProviderConfig,
  SearchTestPayload,
  IterationResult,
  BenchmarkError
} from '@/types';

export class SearchBenchmark extends BenchmarkRunner {
  private searchProviders: Map<string, SearchProviderConfig> = new Map();

  constructor(config: BenchmarkConfig) {
    super(config);
    this.initializeProviders();
  }

  /**
   * Initialize search providers from configuration
   */
  private initializeProviders(): void {
    // Tavily provider
    if (this.config.providers.search.includes('tavily')) {
      this.searchProviders.set('tavily', {
        name: 'tavily',
        type: 'tavily',
        endpoint: 'https://api.tavily.com',
        apiKey: process.env.TAVILY_API_KEY
      });
    }

    // Perplexity search provider
    if (this.config.providers.search.includes('perplexity')) {
      this.searchProviders.set('perplexity', {
        name: 'perplexity',
        type: 'perplexity',
        endpoint: process.env.PERPLEXITY_SEARCH_URL || 'http://localhost:8080',
        apiKey: process.env.PERPLEXITY_API_KEY
      });
    }

    // Brave search provider
    if (this.config.providers.search.includes('brave')) {
      this.searchProviders.set('brave', {
        name: 'brave',
        type: 'brave',
        endpoint: 'https://api.search.brave.com',
        apiKey: process.env.BRAVE_API_KEY
      });
    }

    // DuckDuckGo provider (no API key needed)
    if (this.config.providers.search.includes('duckduckgo')) {
      this.searchProviders.set('duckduckgo', {
        name: 'duckduckgo',
        type: 'duckduckgo',
        endpoint: 'https://api.duckduckgo.com'
      });
    }
  }

  /**
   * Execute search provider request
   */
  protected async executeProviderRequest(
    providerName: string,
    scenario: BenchmarkScenario,
    iteration: number,
    isWarmup: boolean
  ): Promise<any> {
    const provider = this.searchProviders.get(providerName);
    if (!provider) {
      throw new BenchmarkError(
        `Provider ${providerName} not configured`,
        'CONFIGURATION',
        'unknown'
      );
    }

    const payload = this.getTestPayload(scenario, iteration);
    const startTime = Date.now();

    try {
      let response;
      
      if (provider.type === 'tavily') {
        response = await this.executeTavilyRequest(provider, payload);
      } else if (provider.type === 'perplexity') {
        response = await this.executePerplexitySearchRequest(provider, payload);
      } else if (provider.type === 'brave') {
        response = await this.executeBraveRequest(provider, payload);
      } else if (provider.type === 'duckduckgo') {
        response = await this.executeDuckDuckGoRequest(provider, payload);
      } else {
        throw new BenchmarkError(
          `Unknown provider type: ${provider.type}`,
          'CONFIGURATION',
          'unknown'
        );
      }

      const endTime = Date.now();
      
      return {
        responseSize: JSON.stringify(response).length,
        providerMetrics: {
          providerType: provider.type,
          responseTime: endTime - startTime,
          resultCount: this.extractResultCount(response, provider.type),
          queryLength: payload.query.length,
          cached: response.cached || false
        }
      };

    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.error || error.message;
        
        if (status === 401) {
          throw new BenchmarkError(message, 'AUTHENTICATION', providerName, status);
        } else if (status === 429) {
          throw new BenchmarkError(message, 'RATE_LIMIT', providerName, status);
        } else if (status === 404) {
          throw new BenchmarkError(message, 'PROVIDER_ERROR', providerName, status);
        } else if (status === 0 || !status) {
          throw new BenchmarkError(message, 'CONNECTION', providerName);
        } else {
          throw new BenchmarkError(message, 'PROVIDER_ERROR', providerName, status);
        }
      }
      
      throw new BenchmarkError(
        error instanceof Error ? error.message : String(error),
        'PROVIDER_ERROR',
        providerName
      );
    }
  }

  /**
   * Execute Tavily API request
   */
  private async executeTavilyRequest(
    provider: SearchProviderConfig,
    payload: SearchTestPayload
  ): Promise<any> {
    const request = {
      api_key: provider.apiKey,
      query: payload.query,
      search_depth: 'basic',
      include_answer: true,
      include_domains: [],
      exclude_domains: [],
      max_results: payload.limit || 10
    };

    const response = await axios.post(
      `${provider.endpoint}/search`,
      request,
      {
        timeout: this.config.execution.timeout,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  }

  /**
   * Execute Perplexity search API request
   */
  private async executePerplexitySearchRequest(
    provider: SearchProviderConfig,
    payload: SearchTestPayload
  ): Promise<any> {
    const request = {
      model: 'llama-3.1-sonar-small-128k-online',
      messages: [
        {
          role: 'user',
          content: `Search for: ${payload.query}. Provide relevant and accurate results.`
        }
      ],
      max_tokens: 1000,
      temperature: 0.1
    };

    const response = await axios.post(
      `${provider.endpoint}/v1/chat/completions`,
      request,
      {
        timeout: this.config.execution.timeout,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.apiKey}`,
          'X-Profile': 'personal'
        }
      }
    );

    // Extract search results from the response
    const content = response.data.choices?.[0]?.message?.content || '';
    const searchResults = this.parseSearchResultsFromContent(content);

    return {
      results: searchResults,
      cached: false,
      provider: 'perplexity'
    };
  }

  /**
   * Execute Brave search API request
   */
  private async executeBraveRequest(
    provider: SearchProviderConfig,
    payload: SearchTestPayload
  ): Promise<any> {
    const request = {
      q: payload.query,
      count: payload.limit || 10,
      offset: 0,
      search_lang: 'en',
      safesearch: 'moderate',
      text_decorations: false,
      spellcheck: true,
      result_filter: null,
      safesearch: 'moderate',
      units: 'metric',
      extra_snippets: true
    };

    const response = await axios.get(
      `${provider.endpoint}/res/v1/web/search`,
      {
        timeout: this.config.execution.timeout,
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': provider.apiKey
        },
        params: request
      }
    );

    return response.data;
  }

  /**
   * Execute DuckDuckGo API request
   */
  private async executeDuckDuckGoRequest(
    provider: SearchProviderConfig,
    payload: SearchTestPayload
  ): Promise<any> {
    const request = {
      q: payload.query,
      format: 'json',
      no_html: 1,
      skip_disambig: 1
    };

    const response = await axios.get(
      `${provider.endpoint}/`,
      {
        timeout: this.config.execution.timeout,
        headers: {
          'Content-Type': 'application/json'
        },
        params: request
      }
    );

    return response.data;
  }

  /**
   * Parse search results from Perplexity content
   */
  private parseSearchResultsFromContent(content: string): any[] {
    const results: any[] = [];
    
    // Try to extract structured data from the content
    const lines = content.split('\n');
    let currentResult: any = {};
    
    for (const line of lines) {
      if (line.match(/^\d+\./)) {
        if (Object.keys(currentResult).length > 0) {
          results.push(currentResult);
        }
        currentResult = {};
      } else if (line.match(/^(Title|URL|Snippet):/)) {
        const [key, ...valueParts] = line.split(':');
        const value = valueParts.join(':').trim();
        currentResult[key.toLowerCase()] = value;
      }
    }
    
    if (Object.keys(currentResult).length > 0) {
      results.push(currentResult);
    }

    // Fallback: create generic results if parsing failed
    if (results.length === 0) {
      results.push({
        title: 'Search Result',
        url: '',
        snippet: content.substring(0, 200) + '...',
        provider: 'perplexity'
      });
    }

    return results;
  }

  /**
   * Extract result count from response
   */
  private extractResultCount(response: any, providerType: string): number {
    switch (providerType) {
      case 'tavily':
        return response.results?.length || 0;
      case 'perplexity':
        return response.results?.length || 0;
      case 'brave':
        return response.web?.results?.length || 0;
      case 'duckduckgo':
        return response.Results?.length || 0;
      default:
        return 0;
    }
  }

  /**
   * Get test payload for scenario
   */
  private getTestPayload(scenario: BenchmarkScenario, iteration: number): SearchTestPayload {
    const payloads = this.getPayloadsForScenario(scenario);
    return payloads[iteration % payloads.length];
  }

  /**
   * Get predefined payloads for different scenarios
   */
  private getPayloadsForScenario(scenario: BenchmarkScenario): SearchTestPayload[] {
    switch (scenario.id) {
      case 'simple-query':
        return [
          {
            query: 'What is machine learning?',
            limit: 5,
            useCache: false
          }
        ];

      case 'technical-query':
        return [
          {
            query: 'TypeScript async await best practices 2024',
            limit: 10,
            useCache: false
          }
        ];

      case 'news-query':
        return [
          {
            query: 'latest artificial intelligence breakthroughs November 2024',
            limit: 10,
            useCache: false
          }
        ];

      case 'research-query':
        return [
          {
            query: 'distributed systems architecture patterns microservices vs monolith performance comparison',
            limit: 15,
            useCache: false
          }
        ];

      case 'local-search':
        return [
          {
            query: 'restaurants near downtown Seattle',
            limit: 10,
            useCache: false
          }
        ];

      case 'coding-query':
        return [
          {
            query: 'React hooks useEffect cleanup function example',
            limit: 5,
            useCache: false
          }
        ];

      case 'ambiguous-query':
        return [
          {
            query: 'python',
            limit: 10,
            useCache: false
          }
        ];

      case 'long-tail-query':
        return [
          {
            query: 'how to implement caching strategies in distributed systems with Redis and Node.js',
            limit: 5,
            useCache: false
          }
        ];

      default:
        return [
          {
            query: 'test query',
            limit: 5,
            useCache: false
          }
        ];
    }
  }

  /**
   * Get provider health status
   */
  async getProviderHealth(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};

    for (const [name, provider] of this.searchProviders) {
      try {
        if (provider.type === 'tavily') {
          await axios.get(`${provider.endpoint}/search`, { 
            timeout: 5000,
            headers: { 'Authorization': `Bearer ${provider.apiKey}` },
            params: { q: 'test', max_results: 1 }
          });
          health[name] = true;
        } else if (provider.type === 'perplexity') {
          await axios.get(`${provider.endpoint}/v1/models`, { 
            timeout: 5000,
            headers: { 'Authorization': `Bearer ${provider.apiKey}` }
          });
          health[name] = true;
        } else if (provider.type === 'brave') {
          await axios.get(`${provider.endpoint}/res/v1/web/search`, {
            timeout: 5000,
            headers: { 'X-Subscription-Token': provider.apiKey },
            params: { q: 'test', count: 1 }
          });
          health[name] = true;
        } else if (provider.type === 'duckduckgo') {
          await axios.get(`${provider.endpoint}/`, {
            timeout: 5000,
            params: { q: 'test', format: 'json' }
          });
          health[name] = true;
        }
      } catch (error) {
        health[name] = false;
      }
    }

    return health;
  }

  /**
   * Get available search capabilities for each provider
   */
  async getProviderCapabilities(): Promise<Record<string, any>> {
    const capabilities: Record<string, any> = {};

    for (const [name, provider] of this.searchProviders) {
      try {
        if (provider.type === 'tavily') {
          capabilities[name] = {
            maxResults: 10,
            searchTypes: ['web', 'news', 'images'],
            features: ['answer_box', 'related_questions'],
            rateLimit: 'unknown'
          };
        } else if (provider.type === 'perplexity') {
          capabilities[name] = {
            maxResults: 20,
            searchTypes: ['web', 'academic', 'writing', 'math'],
            features: ['real_time_search', 'citations'],
            rateLimit: 'unknown'
          };
        } else if (provider.type === 'brave') {
          capabilities[name] = {
            maxResults: 20,
            searchTypes: ['web', 'news', 'images', 'videos'],
            features: ['safe_search', 'spellcheck'],
            rateLimit: 'unknown'
          };
        } else if (provider.type === 'duckduckgo') {
          capabilities[name] = {
            maxResults: 30,
            searchTypes: ['web', 'images', 'videos', 'news'],
            features: ['privacy_focused', 'no_tracking'],
            rateLimit: 'unknown'
          };
        }
      } catch (error) {
        capabilities[name] = { error: error instanceof Error ? error.message : String(error) };
      }
    }

    return capabilities;
  }

  /**
   * Test search result quality
   */
  async testSearchQuality(providerName: string, query: string): Promise<any> {
    const provider = this.searchProviders.get(providerName);
    if (!provider) {
      throw new BenchmarkError(`Provider ${providerName} not configured`, 'CONFIGURATION', 'unknown');
    }

    const payload: SearchTestPayload = { query, limit: 10, useCache: false };
    const response = await this.executeProviderRequest(providerName, {
      id: 'quality-test',
      name: 'Search Quality Test',
      type: 'latency',
      description: `Test search result quality for ${providerName}`,
      parameters: {},
      successCriteria: {}
    }, 0, false);

    // Quality metrics
    const results = this.extractResultCount(response, provider.type);
    const hasTitles = results > 0 && results.every((r: any) => r.title && r.title.length > 0);
    const hasUrls = results > 0 && results.every((r: any) => r.url && r.url.length > 0);
    const hasSnippets = results > 0 && results.every((r: any) => r.snippet && r.snippet.length > 0);

    return {
      provider: providerName,
      query,
      resultCount: results,
      qualityScore: this.calculateQualityScore(hasTitles, hasUrls, hasSnippets, results),
      responseTime: response.providerMetrics?.responseTime || 0,
      results: response
    };
  }

  /**
   * Calculate quality score for search results
   */
  private calculateQualityScore(
    hasTitles: boolean,
    hasUrls: boolean,
    hasSnippets: boolean,
    resultCount: number
  ): number {
    let score = 0;
    
    // Title presence (30%)
    if (hasTitles) score += 30;
    
    // URL presence (30%)
    if (hasUrls) score += 30;
    
    // Snippet presence (20%)
    if (hasSnippets) score += 20;
    
    // Result count (20% - normalized)
    score += Math.min(20, (resultCount / 10) * 20);
    
    return Math.round(score);
  }
}