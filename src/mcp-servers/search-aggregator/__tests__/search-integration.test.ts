/**
 * Search Provider Integration Tests
 * Tests for Tavily, Perplexity, Brave, and DuckDuckGo providers with mocking
 */

import axios from 'axios';
import AxiosMockAdapter from 'axios-mock-adapter';
import { config } from 'dotenv';

// Load test environment variables
config({ path: '../../../.env.test' });

import { TavilyProvider } from '../src/providers/tavily-provider.js';
import { PerplexityProvider } from '../src/providers/perplexity-provider.js';
import { BraveProvider } from '../src/providers/brave-provider.js';
import { DuckDuckGoProvider } from '../src/providers/duckduckgo-provider.js';

describe('Search Provider Integration Tests', () => {
  let mock: AxiosMockAdapter;

  beforeEach(() => {
    mock = new AxiosMockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
  });

  describe('TavilyProvider', () => {
    const apiKey = 'test-tavily-api-key';
    let provider: TavilyProvider;

    beforeEach(() => {
      provider = new TavilyProvider(apiKey);
    });

    it('should initialize with correct configuration', () => {
      expect(provider.name).toBe('tavily');
    });

    it('should handle successful search with default options', async () => {
      mock.onPost('https://api.tavily.com/search').reply(200, {
        results: [
          {
            title: 'Test Result 1',
            url: 'https://example.com/1',
            content: 'This is the first test result',
            score: 0.9,
            published_date: '2023-11-01'
          },
          {
            title: 'Test Result 2',
            url: 'https://example.com/2',
            snippet: 'This is the second test result',
            score: 0.8
          }
        ]
      });

      const results = await provider.search('test query');

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        title: 'Test Result 1',
        url: 'https://example.com/1',
        snippet: 'This is the first test result',
        source: 'tavily',
        score: expect.any(Number),
        timestamp: expect.any(String),
        citations: ['2023-11-01']
      });
      expect(results[0].id).toBeDefined();
    });

    it('should handle search with custom options', async () => {
      mock.onPost('https://api.tavily.com/search').reply(200, {
        results: [
          {
            title: 'Advanced Result',
            url: 'https://example.com/advanced',
            content: 'Advanced search result',
            score: 0.95
          }
        ]
      });

      const options = {
        limit: 5,
        language: 'es',
        search_depth: 'advanced' as const,
        include_answer: true,
        include_raw_content: true,
        max_results: 15
      };

      const results = await provider.search('advanced query', options);

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Advanced Result');

      // Verify request parameters
      const requestData = mock.history.post[0].data;
      expect(requestData.api_key).toBe(apiKey);
      expect(requestData.query).toBe('advanced query');
      expect(requestData.search_depth).toBe('advanced');
      expect(requestData.include_answer).toBe(true);
      expect(requestData.include_raw_content).toBe(true);
      expect(requestData.max_results).toBe(5); // min(limit, max_results)
    });

    it('should handle 401 authentication error', async () => {
      mock.onPost('https://api.tavily.com/search').reply(401, {
        message: 'Invalid API key'
      });

      await expect(provider.search('test')).rejects.toThrow('Tavily API key is invalid or expired');
    });

    it('should handle 429 rate limit error', async () => {
      mock.onPost('https://api.tavily.com/search').reply(429, {
        message: 'Rate limit exceeded'
      });

      await expect(provider.search('test')).rejects.toThrow('Tavily API rate limit exceeded');
    });

    it('should handle 400 bad request error', async () => {
      mock.onPost('https://api.tavily.com/search').reply(400, {
        message: 'Invalid query parameter'
      });

      await expect(provider.search('test')).rejects.toThrow('Tavily API bad request: Invalid query parameter');
    });

    it('should handle network error', async () => {
      mock.onPost('https://api.tavily.com/search').networkError();

      await expect(provider.search('test')).rejects.toThrow('Tavily search failed');
    });

    it('should handle empty results', async () => {
      mock.onPost('https://api.tavily.com/search').reply(200, {
        results: []
      });

      const results = await provider.search('test');
      expect(results).toHaveLength(0);
    });

    it('should handle missing result fields gracefully', async () => {
      mock.onPost('https://api.tavily.com/search').reply(200, {
        results: [
          {
            // Missing title
            url: 'https://example.com/1',
            content: 'Content without title'
          },
          {
            title: 'Title without URL',
            // Missing URL
            content: 'Content without URL'
          }
        ]
      });

      const results = await provider.search('test');

      expect(results).toHaveLength(2);
      expect(results[0].title).toBe('');
      expect(results[0].url).toBe('https://example.com/1');
      expect(results[1].title).toBe('Title without URL');
      expect(results[1].url).toBe('');
    });

    it('should pass health check', async () => {
      mock.onPost('https://api.tavily.com/search').reply(200, {
        results: [{ title: 'Health Check', url: 'https://example.com', content: 'OK' }]
      });

      const isHealthy = await provider.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should fail health check on error', async () => {
      mock.onPost('https://api.tavily.com/search').reply(500);

      const isHealthy = await provider.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });

  describe('PerplexityProvider', () => {
    const apiKey = 'test-perplexity-api-key';
    let provider: PerplexityProvider;

    beforeEach(() => {
      provider = new PerplexityProvider(apiKey);
    });

    it('should initialize with correct configuration', () => {
      expect(provider.name).toBe('perplexity');
    });

    it('should handle successful search with citations', async () => {
      mock.onPost('https://api.perplexity.ai/chat/completions').reply(200, {
        choices: [{
          message: {
            content: 'Here are the search results with citations'
          }
        }],
        citations: [
          {
            title: 'Perplexity Result 1',
            url: 'https://example.com/perplexity1',
            snippet: 'First Perplexity search result'
          },
          {
            title: 'Perplexity Result 2',
            url: 'https://example.com/perplexity2',
            snippet: 'Second Perplexity search result'
          }
        ]
      });

      const results = await provider.search('test query');

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        title: 'Perplexity Result 1',
        url: 'https://example.com/perplexity1',
        source: 'perplexity',
        score: expect.any(Number),
        timestamp: expect.any(String),
        citations: ['https://example.com/perplexity1']
      });
      expect(results[0].id).toBeDefined();
    });

    it('should handle search without citations', async () => {
      mock.onPost('https://api.perplexity.ai/chat/completions').reply(200, {
        choices: [{
          message: {
            content: 'Result 1: First result\nResult 2: Second result\nResult 3: Third result'
          }
        }]
      });

      const results = await provider.search('test query', { limit: 5 });

      expect(results).toHaveLength(3);
      expect(results[0].title).toBe('Result 1: First result');
      expect(results[0].url).toBe('');
      expect(results[0].snippet).toBe('Result 1: First result');
      expect(results[1].title).toBe('Result 2: Second result');
    });

    it('should handle search with custom options', async () => {
      mock.onPost('https://api.perplexity.ai/chat/completions').reply(200, {
        choices: [{
          message: { content: 'Custom model response' }
        }],
        citations: []
      });

      const options = {
        limit: 3,
        language: 'fr',
        model: 'sonar-medium',
        temperature: 0.2,
        max_tokens: 500
      };

      await provider.search('custom query', options);

      const requestData = mock.history.post[0].data;
      expect(requestData.model).toBe('sonar-medium');
      expect(requestData.temperature).toBe(0.2);
      expect(requestData.max_tokens).toBe(500);
      expect(requestData.top_p).toBe(0.9);
      expect(requestData.return_citations).toBe(true);
      expect(requestData.search_recency_filter).toBe('month');
    });

    it('should handle 401 authentication error', async () => {
      mock.onPost('https://api.perplexity.ai/chat/completions').reply(401, {
        error: { message: 'Invalid API key' }
      });

      await expect(provider.search('test')).rejects.toThrow('Perplexity API key is invalid or expired');
    });

    it('should handle 429 rate limit error', async () => {
      mock.onPost('https://api.perplexity.ai/chat/completions').reply(429, {
        error: { message: 'Rate limit exceeded' }
      });

      await expect(provider.search('test')).rejects.toThrow('Perplexity API rate limit exceeded');
    });

    it('should handle network error', async () => {
      mock.onPost('https://api.perplexity.ai/chat/completions').networkError();

      await expect(provider.search('test')).rejects.toThrow('Perplexity search failed');
    });

    it('should extract title from citation snippet', async () => {
      mock.onPost('https://api.perplexity.ai/chat/completions').reply(200, {
        choices: [{ message: { content: 'Response' } }],
        citations: [{
          url: 'https://example.com',
          snippet: 'This is a long snippet that should be truncated to 100 characters when used as a title for testing purposes'
        }]
      });

      const results = await provider.search('test');

      expect(results[0].title).toBe('This is a long snippet that should be truncated to 100 characters when used as a title for te...');
    });

    it('should pass health check', async () => {
      mock.onPost('https://api.perplexity.ai/chat/completions').reply(200, {
        choices: [{ message: { content: 'Health check OK' } }],
        citations: []
      });

      const isHealthy = await provider.healthCheck();
      expect(isHealthy).toBe(true);
    });
  });

  describe('BraveProvider', () => {
    const apiKey = 'test-brave-api-key';
    let provider: BraveProvider;

    beforeEach(() => {
      provider = new BraveProvider(apiKey);
    });

    it('should initialize with correct configuration', () => {
      expect(provider.name).toBe('brave');
    });

    it('should handle successful web search', async () => {
      mock.onGet(/https:\/\/api\.search\.brave\.com\/res\/v1\/web\/search.*/).reply(200, {
        web: {
          results: [
            {
              title: 'Brave Result 1',
              url: 'https://example.com/brave1',
              description: 'First Brave search result',
              age: '2 days ago'
            },
            {
              title: 'Brave Result 2',
              url: 'https://example.com/brave2',
              description: 'Second Brave search result',
              meta: { score: 0.85 }
            }
          ]
        }
      });

      const results = await provider.search('test query');

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        title: 'Brave Result 1',
        url: 'https://example.com/brave1',
        snippet: 'First Brave search result',
        source: 'brave',
        score: expect.any(Number),
        timestamp: expect.any(String),
        citations: ['2 days ago']
      });
      expect(results[0].id).toBeDefined();
    });

    it('should handle search with mix results fallback', async () => {
      mock.onGet(/https:\/\/api\.search\.brave\.com\/res\/v1\/web\/search.*/).reply(200, {
        web: { results: [] },
        mix: {
          results: [
            {
              type: 'web',
              title: 'Mix Result',
              url: 'https://example.com/mix',
              description: 'Mix search result'
            }
          ]
        }
      });

      const results = await provider.search('test query');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Mix Result');
      expect(results[0].url).toBe('https://example.com/mix');
    });

    it('should handle search with all options', async () => {
      mock.onGet(/https:\/\/api\.search\.brave\.com\/res\/v1\/web\/search.*/).reply(200, {
        web: { results: [] }
      });

      const options = {
        limit: 5,
        language: 'de',
        country: 'DE',
        search_type: 'news' as const,
        safesearch: 'strict' as const,
        freshness: 'pw' as const,
        text_decorations: true,
        spellcheck: false,
        result_filter: 'news',
        safesearch_off: false,
        units: 'imperial' as const,
        extra_snippets: true
      };

      await provider.search('news query', options);

      const requestUrl = mock.history.get[0].url;
      expect(requestUrl).toContain('q=news+query');
      expect(requestUrl).toContain('count=5');
      expect(requestUrl).toContain('lang=de');
      expect(requestUrl).toContain('country=DE');
      expect(requestUrl).toContain('search_type=news');
      expect(requestUrl).toContain('safesearch=strict');
      expect(requestUrl).toContain('freshness=pw');
      expect(requestUrl).toContain('text_decorations=true');
      expect(requestUrl).toContain('spellcheck=false');
      expect(requestUrl).toContain('result_filter=news');
      expect(requestUrl).toContain('units=imperial');
      expect(requestUrl).toContain('extra_snippets=true');
    });

    it('should handle 401 authentication error', async () => {
      mock.onGet(/https:\/\/api\.search\.brave\.com\/res\/v1\/web\/search.*/).reply(401, {
        error: { message: 'Invalid API key' }
      });

      await expect(provider.search('test')).rejects.toThrow('Brave Search API key is invalid or expired');
    });

    it('should handle 403 forbidden error', async () => {
      mock.onGet(/https:\/\/api\.search\.brave\.com\/res\/v1\/web\/search.*/).reply(403, {
        error: { message: 'Access forbidden' }
      });

      await expect(provider.search('test')).rejects.toThrow('Brave Search API access forbidden: Access forbidden');
    });

    it('should handle 429 rate limit error', async () => {
      mock.onGet(/https:\/\/api\.search\.brave\.com\/res\/v1\/web\/search.*/).reply(429, {
        error: { message: 'Rate limit exceeded' }
      });

      await expect(provider.search('test')).rejects.toThrow('Brave Search API rate limit exceeded');
    });

    it('should handle empty results', async () => {
      mock.onGet(/https:\/\/api\.search\.brave\.com\/res\/v1\/web\/search.*/).reply(200, {
        web: { results: [] }
      });

      const results = await provider.search('test');
      expect(results).toHaveLength(0);
    });

    it('should boost score for high-quality domains', async () => {
      mock.onGet(/https:\/\/api\.search\.brave\.com\/res\/v1\/web\/search.*/).reply(200, {
        web: {
          results: [
            {
              title: 'GitHub Result',
              url: 'https://github.com/example/repo',
              description: 'GitHub repository'
            },
            {
              title: 'Random Site',
              url: 'https://random-site.example',
              description: 'Random website'
            }
          ]
        }
      });

      const results = await provider.search('test');

      expect(results).toHaveLength(2);
      // GitHub result should have higher score due to high-quality domain
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it('should pass health check', async () => {
      mock.onGet(/https:\/\/api\.search\.brave\.com\/res\/v1\/web\/search.*/).reply(200, {
        web: { results: [{ title: 'Health', url: 'https://example.com', description: 'OK' }] }
      });

      const isHealthy = await provider.healthCheck();
      expect(isHealthy).toBe(true);
    });
  });

  describe('DuckDuckGoProvider', () => {
    let provider: DuckDuckGoProvider;

    beforeEach(() => {
      provider = new DuckDuckGoProvider();
    });

    it('should initialize with correct configuration', () => {
      expect(provider.name).toBe('duckduckgo');
    });

    it('should handle successful HTML search', async () => {
      const mockHtml = `
        <div class="result results_links results_links_deep web-result">
          <a class="result__a" href="https://example.com/ddg1">DuckDuckGo Result 1</a>
          <a class="result__snippet">First DuckDuckGo search result</a>
        </div>
        <div class="result results_links results_links_deep web-result">
          <a class="result__a" href="https://example.com/ddg2">DuckDuckGo Result 2</a>
          <a class="result__snippet">Second DuckDuckGo search result</a>
        </div>
      `;

      mock.onGet(/https:\/\/html\.duckduckgo\.com\/html\/.*/).reply(200, mockHtml);

      const results = await provider.search('test query');

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        title: 'DuckDuckGo Result 1',
        url: 'https://example.com/ddg1',
        snippet: 'First DuckDuckGo search result',
        source: 'duckduckgo',
        score: expect.any(Number),
        timestamp: expect.any(String)
      });
      expect(results[0].id).toBeDefined();
    });

    it('should handle search with custom options', async () => {
      mock.onGet(/https:\/\/html\.duckduckgo\.com\/html\/.*/).reply(200, '');

      const options = {
        limit: 3,
        language: 'fr-FR',
        region: 'fr-fr',
        safe_search: 'strict' as const,
        time: 'w' as const
      };

      await provider.search('test query', options);

      const requestUrl = mock.history.get[0].url;
      expect(requestUrl).toContain('q=test+query');
      expect(requestUrl).toContain('kl=fr-fr');
      expect(requestUrl).toContain('dl=fr-FR');
      expect(requestUrl).toContain('safesearch=strict');
      expect(requestUrl).toContain('df=w');
    });

    it('should handle instant answers when no HTML results', async () => {
      // Empty HTML results
      mock.onGet(/https:\/\/html\.duckduckgo\.com\/html\/.*/).reply(200, '');

      // Instant answer API response
      mock.onGet(/https:\/\/api\.duckduckgo\.com\/.*/).reply(200, {
        Abstract: 'DuckDuckGo is a search engine',
        Heading: 'DuckDuckGo',
        AbstractURL: 'https://duckduckgo.com',
        AbstractSource: 'Wikipedia',
        RelatedTopics: [
          {
            Text: 'Privacy-focused search engine',
            FirstURL: 'https://example.com/privacy'
          },
          {
            Text: 'Alternative to Google',
            FirstURL: 'https://example.com/alternative'
          }
        ]
      });

      const results = await provider.search('DuckDuckGo');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toBe('DuckDuckGo');
      expect(results[0].snippet).toBe('DuckDuckGo is a search engine');
      expect(results[0].url).toBe('https://duckduckgo.com');
      expect(results[0].score).toBe(0.95);
    });

    it('should handle 429 rate limit error', async () => {
      mock.onGet(/https:\/\/html\.duckduckgo\.com\/html\/.*/).reply(429);

      await expect(provider.search('test')).rejects.toThrow('DuckDuckGo rate limit exceeded');
    });

    it('should handle 403 forbidden error', async () => {
      mock.onGet(/https:\/\/html\.duckduckgo\.com\/html\/.*/).reply(403);

      await expect(provider.search('test')).rejects.toThrow('DuckDuckGo access forbidden');
    });

    it('should handle malformed HTML gracefully', async () => {
      const malformedHtml = `
        <div class="result">
          <a class="result__a" href="https://example.com">Good Result</a>
          <a class="result__snippet">Good snippet</a>
        </div>
        <div class="result">
          <!-- Missing title link -->
          <a class="result__snippet">Bad result</a>
        </div>
        <div class="result">
          <a class="result__a" href="">Empty URL</a>
          <a class="result__snippet">Empty URL result</a>
        </div>
      `;

      mock.onGet(/https:\/\/html\.duckduckgo\.com\/html\/.*/).reply(200, malformedHtml);

      const results = await provider.search('test');

      // Should only parse valid results
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Good Result');
      expect(results[0].url).toBe('https://example.com');
    });

    it('should handle redirected URLs', async () => {
      const mockHtml = `
        <div class="result results_links results_links_deep web-result">
          <a class="result__a" href="/l/?uddg=https%3A%2F%2Fexample.com%2Fredirected">Redirected Result</a>
          <a class="result__snippet">Redirected result</a>
        </div>
      `;

      mock.onGet(/https:\/\/html\.duckduckgo\.com\/html\/.*/).reply(200, mockHtml);

      const results = await provider.search('test');

      expect(results).toHaveLength(1);
      expect(results[0].url).toBe('https://example.com/redirected');
    });

    it('should boost score for high-quality domains', async () => {
      const mockHtml = `
        <div class="result results_links results_links_deep web-result">
          <a class="result__a" href="https://github.com/example">GitHub Result</a>
          <a class="result__snippet">GitHub repository</a>
        </div>
        <div class="result results_links results_links_deep web-result">
          <a class="result__a" href="https://random-site.example">Random Site</a>
          <a class="result__snippet">Random website</a>
        </div>
      `;

      mock.onGet(/https:\/\/html\.duckduckgo\.com\/html\/.*/).reply(200, mockHtml);

      const results = await provider.search('test');

      expect(results).toHaveLength(2);
      // GitHub result should have higher score due to high-quality domain
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it('should pass health check', async () => {
      mock.onGet(/https:\/\/html\.duckduckgo\.com\/html\/.*/).reply(200, `
        <div class="result results_links results_links_deep web-result">
          <a class="result__a" href="https://example.com">Health Check</a>
          <a class="result__snippet">Health check result</a>
        </div>
      `);

      const isHealthy = await provider.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should fail health check on error', async () => {
      mock.onGet(/https:\/\/html\.duckduckgo\.com\/html\/.*/).reply(500);

      const isHealthy = await provider.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });

  describe('Parallel Execution and Deduplication', () => {
    it('should handle concurrent searches across providers', async () => {
      const tavilyProvider = new TavilyProvider('tavily-key');
      const perplexityProvider = new PerplexityProvider('perplexity-key');
      const braveProvider = new BraveProvider('brave-key');
      const duckDuckGoProvider = new DuckDuckGoProvider();

      // Mock all providers
      mock.onPost('https://api.tavily.com/search').reply(200, {
        results: [{ title: 'Tavily Result', url: 'https://example.com/tavily', content: 'Tavily' }]
      });

      mock.onPost('https://api.perplexity.ai/chat/completions').reply(200, {
        choices: [{ message: { content: 'Response' } }],
        citations: [{ title: 'Perplexity Result', url: 'https://example.com/perplexity', snippet: 'Perplexity' }]
      });

      mock.onGet(/https:\/\/api\.search\.brave\.com\/res\/v1\/web\/search.*/).reply(200, {
        web: { results: [{ title: 'Brave Result', url: 'https://example.com/brave', description: 'Brave' }] }
      });

      mock.onGet(/https:\/\/html\.duckduckgo\.com\/html\/.*/).reply(200, `
        <div class="result results_links results_links_deep web-result">
          <a class="result__a" href="https://example.com/ddg">DuckDuckGo Result</a>
          <a class="result__snippet">DuckDuckGo</a>
        </div>
      `);

      // Execute searches in parallel
      const searchPromises = [
        tavilyProvider.search('test'),
        perplexityProvider.search('test'),
        braveProvider.search('test'),
        duckDuckGoProvider.search('test')
      ];

      const results = await Promise.all(searchPromises);

      expect(results).toHaveLength(4);
      expect(results[0][0].source).toBe('tavily');
      expect(results[1][0].source).toBe('perplexity');
      expect(results[2][0].source).toBe('brave');
      expect(results[3][0].source).toBe('duckduckgo');
    });

    it('should handle duplicate URLs across providers', async () => {
      const tavilyProvider = new TavilyProvider('tavily-key');
      const braveProvider = new BraveProvider('brave-key');

      const duplicateUrl = 'https://example.com/duplicate';

      mock.onPost('https://api.tavily.com/search').reply(200, {
        results: [{ title: 'Tavily Duplicate', url: duplicateUrl, content: 'From Tavily' }]
      });

      mock.onGet(/https:\/\/api\.search\.brave\.com\/res\/v1\/web\/search.*/).reply(200, {
        web: { results: [{ title: 'Brave Duplicate', url: duplicateUrl, description: 'From Brave' }] }
      });

      const tavilyResults = await tavilyProvider.search('test');
      const braveResults = await braveProvider.search('test');

      expect(tavilyResults[0].url).toBe(duplicateUrl);
      expect(braveResults[0].url).toBe(duplicateUrl);
      expect(tavilyResults[0].title).toBe('Tavily Duplicate');
      expect(braveResults[0].title).toBe('Brave Duplicate');
      // In a real aggregator, these would be deduplicated by URL
    });
  });

  describe('Error Handling and Timeout', () => {
    it('should handle provider timeouts gracefully', async () => {
      const provider = new TavilyProvider('tavily-key');

      // Mock timeout
      mock.onPost('https://api.tavily.com/search').timeout();

      await expect(provider.search('test')).rejects.toThrow();
    });

    it('should handle malformed API responses', async () => {
      const provider = new PerplexityProvider('perplexity-key');

      // Mock malformed response
      mock.onPost('https://api.perplexity.ai/chat/completions').reply(200, {
        // Missing choices array
        citations: []
      });

      const results = await provider.search('test');
      expect(results).toHaveLength(0);
    });

    it('should handle missing API keys gracefully', () => {
      expect(() => new TavityProvider('')).toThrow('Tavily API key is required');
      expect(() => new PerplexityProvider('')).toThrow('Perplexity API key is required');
      expect(() => new BraveProvider('')).toThrow('Brave Search API key is required');
      // DuckDuckGo doesn't require API key
      expect(() => new DuckDuckGoProvider()).not.toThrow();
    });
  });
});