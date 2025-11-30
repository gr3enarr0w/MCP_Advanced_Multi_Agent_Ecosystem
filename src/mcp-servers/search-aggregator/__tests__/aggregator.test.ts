import { SearchAggregator } from '../src/index';
import axios from 'axios';

// Mock axios to avoid actual API calls during tests
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock environment variables
const originalEnv = process.env;

describe('SearchAggregator', () => {
  let aggregator: SearchAggregator;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    process.env = { ...originalEnv };
    
    // Set test API keys
    process.env.TAVILY_API_KEY = 'test-tavily-key';
    process.env.PERPLEXITY_API_KEY = 'test-perplexity-key';
    process.env.BRAVE_API_KEY = 'test-brave-key';
    
    aggregator = new SearchAggregator();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Initialization', () => {
    it('should initialize with all providers when API keys are available', async () => {
      await aggregator.initialize();
      const status = await aggregator.getProviderStatus();
      
      expect(status).toHaveProperty('tavily');
      expect(status).toHaveProperty('perplexity');
      expect(status).toHaveProperty('brave');
      expect(status).toHaveProperty('duckduckgo');
    });

    it('should initialize with only DuckDuckGo when no API keys are provided', async () => {
      delete process.env.TAVILY_API_KEY;
      delete process.env.PERPLEXITY_API_KEY;
      delete process.env.BRAVE_API_KEY;
      
      const newAggregator = new SearchAggregator();
      await newAggregator.initialize();
      
      const status = await newAggregator.getProviderStatus();
      expect(status).toHaveProperty('duckduckgo');
      expect(Object.keys(status)).toHaveLength(1);
    });

    it('should prioritize providers correctly', async () => {
      await aggregator.initialize();
      const status = await aggregator.getProviderStatus();
      
      // Tavily should have highest priority (1)
      // Perplexity should have second priority (2)
      // Brave should have third priority (3)
      // DuckDuckGo should have lowest priority (4)
      const providerOrder = Object.keys(status).filter(key => status[key as keyof typeof status]);
      expect(providerOrder).toEqual(['duckduckgo', 'brave', 'perplexity', 'tavily']);
    });
  });

  describe('Search Functionality', () => {
    beforeEach(async () => {
      await aggregator.initialize();
    });

    it('should perform parallel search across all providers', async () => {
      // Mock successful responses for all providers
      mockedAxios.post.mockResolvedValue({
        data: {
          results: [
            { title: 'Tavily Result', url: 'https://tavily.com/1', content: 'Tavily content' }
          ]
        }
      });

      mockedAxios.get.mockImplementation((url) => {
        if (url.includes('perplexity.ai')) {
          return Promise.resolve({
            data: {
              choices: [{ message: { content: 'Perplexity response' } }],
              citations: [{ title: 'Perplexity Result', url: 'https://perplexity.ai/1' }]
            }
          });
        }
        if (url.includes('brave.com')) {
          return Promise.resolve({
            data: {
              web: {
                results: [{ title: 'Brave Result', url: 'https://brave.com/1', description: 'Brave content' }]
              }
            }
          });
        }
        if (url.includes('duckduckgo.com')) {
          return Promise.resolve({
            data: '<div class="result"><a class="result__a" href="https://duckduckgo.com/1">DuckDuckGo Result</a></div>'
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      const results = await aggregator.search('test query', { limit: 10 });

      expect(results.length).toBeGreaterThan(0);
      
      // Check that all providers were called in parallel
      expect(mockedAxios.post).toHaveBeenCalledTimes(1); // Tavily
      expect(mockedAxios.get).toHaveBeenCalledTimes(3); // Perplexity, Brave, DuckDuckGo
    });

    it('should deduplicate results by URL', async () => {
      // Mock responses with duplicate URLs
      mockedAxios.post.mockResolvedValue({
        data: {
          results: [
            { title: 'Result 1', url: 'https://example.com/duplicate', content: 'Content 1' }
          ]
        }
      });

      mockedAxios.get.mockImplementation((url) => {
        if (url.includes('brave.com')) {
          return Promise.resolve({
            data: {
              web: {
                results: [{ title: 'Result 2', url: 'https://example.com/duplicate', description: 'Content 2' }]
              }
            }
          });
        }
        if (url.includes('duckduckgo.com')) {
          return Promise.resolve({
            data: '<div class="result"><a class="result__a" href="https://example.com/unique">Unique Result</a></div>'
          });
        }
        return Promise.resolve({ data: { choices: [], citations: [] } });
      });

      const results = await aggregator.search('test query');

      // Should have only 2 results (one duplicate removed)
      expect(results.length).toBe(2);
      
      const urls = results.map(r => r.url);
      expect(urls).toContain('https://example.com/duplicate');
      expect(urls).toContain('https://example.com/unique');
      expect(urls.filter(url => url === 'https://example.com/duplicate')).toHaveLength(1);
    });

    it('should filter results by minimum score', async () => {
      mockedAxios.post.mockResolvedValue({
        data: {
          results: [
            { title: 'High Score', url: 'https://example.com/high', content: 'High score content' }
          ]
        }
      });

      mockedAxios.get.mockResolvedValue({
        data: '<div class="result"><a class="result__a" href="https://example.com/low">Low Score</a></div>'
      });

      const results = await aggregator.search('test query', { min_score: 0.5 });

      expect(results.length).toBeGreaterThan(0);
      
      // All results should have score >= 0.5
      results.forEach(result => {
        expect(result.score).toBeGreaterThanOrEqual(0.5);
      });
    });

    it('should limit number of results', async () => {
      mockedAxios.post.mockResolvedValue({
        data: {
          results: Array.from({ length: 10 }, (_, i) => ({
            title: `Result ${i}`,
            url: `https://example.com/${i}`,
            content: `Content ${i}`
          }))
        }
      });

      mockedAxios.get.mockResolvedValue({
        data: {
          web: {
            results: Array.from({ length: 10 }, (_, i) => ({
              title: `Web Result ${i}`,
              url: `https://web.com/${i}`,
              description: `Web Content ${i}`
            }))
          }
        }
      });

      const results = await aggregator.search('test query', { limit: 5 });

      expect(results.length).toBeLessThanOrEqual(5);
    });

    it('should use specific providers when requested', async () => {
      const results = await aggregator.search('test query', { 
        providers: ['tavily', 'duckduckgo'] 
      });

      // Should only call Tavily and DuckDuckGo
      expect(mockedAxios.post).toHaveBeenCalledTimes(1); // Tavily
      expect(mockedAxios.get).toHaveBeenCalledTimes(1); // DuckDuckGo
    });

    it('should handle provider failures gracefully', async () => {
      // Mock failures for some providers
      mockedAxios.post.mockRejectedValue(new Error('Tavily failed'));
      
      mockedAxios.get.mockImplementation((url) => {
        if (url.includes('brave.com')) {
          return Promise.reject(new Error('Brave failed'));
        }
        if (url.includes('duckduckgo.com')) {
          return Promise.resolve({
            data: '<div class="result"><a class="result__a" href="https://duckduckgo.com/1">Working Result</a></div>'
          });
        }
        return Promise.resolve({ data: { choices: [], citations: [] } });
      });

      const results = await aggregator.search('test query');

      // Should still return results from working providers
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].source).toBe('duckduckgo');
    });
  });

  describe('Batch Search', () => {
    beforeEach(async () => {
      await aggregator.initialize();
    });

    it('should handle multiple queries', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { results: [{ title: 'Batch Result', url: 'https://example.com/batch', content: 'Batch content' }] }
      });

      mockedAxios.get.mockResolvedValue({
        data: '<div class="result"><a class="result__a" href="https://example.com/batch">Batch Result</a></div>'
      });

      const results = await aggregator.batchSearch(['query1', 'query2']);

      expect(results).toHaveProperty('query1');
      expect(results).toHaveProperty('query2');
      expect(Object.keys(results)).toHaveLength(2);
    });

    it('should handle batch search failures gracefully', async () => {
      mockedAxios.post.mockRejectedValue(new Error('All providers failed'));
      mockedAxios.get.mockRejectedValue(new Error('All providers failed'));

      const results = await aggregator.batchSearch(['query1', 'query2']);

      expect(results).toHaveProperty('query1');
      expect(results).toHaveProperty('query2');
      expect(results['query1']).toEqual([]);
      expect(results['query2']).toEqual([]);
    });
  });

  describe('Caching', () => {
    beforeEach(async () => {
      await aggregator.initialize();
    });

    it('should use cached results when available', async () => {
      // First search
      mockedAxios.post.mockResolvedValue({
        data: { results: [{ title: 'Cached Result', url: 'https://example.com/cached', content: 'Cached content' }] }
      });
      mockedAxios.get.mockResolvedValue({
        data: '<div class="result"><a class="result__a" href="https://example.com/cached">Cached Result</a></div>'
      });

      const results1 = await aggregator.search('cache test', { use_cache: true });
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);

      // Second search with same query should use cache
      const results2 = await aggregator.search('cache test', { use_cache: true });
      expect(mockedAxios.post).toHaveBeenCalledTimes(1); // Should not increase

      expect(results1).toEqual(results2);
    });

    it('should skip cache when disabled', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { results: [{ title: 'No Cache Result', url: 'https://example.com/nocache', content: 'No cache content' }] }
      });
      mockedAxios.get.mockResolvedValue({
        data: '<div class="result"><a class="result__a" href="https://example.com/nocache">No Cache Result</a></div>'
      });

      await aggregator.search('no cache test', { use_cache: false });
      await aggregator.search('no cache test', { use_cache: false });

      // Should call API twice (no caching)
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });
  });

  describe('Provider Health', () => {
    beforeEach(async () => {
      await aggregator.initialize();
    });

    it('should return provider status', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { results: [{ title: 'Health Check', url: 'https://example.com/health', content: 'Health content' }] }
      });
      mockedAxios.get.mockResolvedValue({
        data: '<div class="result"><a class="result__a" href="https://example.com/health">Health Check</a></div>'
      });

      const status = await aggregator.getProviderStatus();

      expect(Object.keys(status)).toContain('tavily');
      expect(Object.keys(status)).toContain('perplexity');
      expect(Object.keys(status)).toContain('brave');
      expect(Object.keys(status)).toContain('duckduckgo');
    });

    it('should handle provider health check failures', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Provider unavailable'));
      mockedAxios.get.mockRejectedValue(new Error('Provider unavailable'));

      const status = await aggregator.getProviderStatus();

      // All providers should be marked as unhealthy
      Object.values(status).forEach(isHealthy => {
        expect(isHealthy).toBe(false);
      });
    });
  });

  describe('Cache Management', () => {
    beforeEach(async () => {
      await aggregator.initialize();
    });

    it('should clear old cache entries', async () => {
      const deletedCount = await aggregator.clearCache(7);
      expect(typeof deletedCount).toBe('number');
    });

    it('should use default cache age when not specified', async () => {
      const deletedCount = await aggregator.clearCache();
      expect(typeof deletedCount).toBe('number');
    });
  });
});