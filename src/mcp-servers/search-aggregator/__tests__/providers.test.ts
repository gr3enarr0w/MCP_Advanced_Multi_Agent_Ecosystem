import { TavilyProvider } from '../src/providers/tavily-provider';
import { PerplexityProvider } from '../src/providers/perplexity-provider';
import { BraveProvider } from '../src/providers/brave-provider';
import { DuckDuckGoProvider } from '../src/providers/duckduckgo-provider';
import axios from 'axios';

// Mock axios to avoid actual API calls during tests
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Search Providers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('TavilyProvider', () => {
    let provider: TavilyProvider;

    beforeEach(() => {
      provider = new TavilyProvider('test-api-key');
    });

    it('should throw error when API key is not provided', () => {
      expect(() => new TavilyProvider('')).toThrow('Tavily API key is required');
    });

    it('should initialize with API key', () => {
      expect(provider.name).toBe('tavily');
    });

    it('should handle successful search response', async () => {
      const mockResponse = {
        data: {
          results: [
            {
              title: 'Test Result 1',
              url: 'https://example.com/1',
              content: 'Test content 1',
              score: 0.9
            },
            {
              title: 'Test Result 2',
              url: 'https://example.com/2',
              content: 'Test content 2',
              score: 0.8
            }
          ]
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const results = await provider.search('test query', { limit: 5 });

      expect(results).toHaveLength(2);
      expect(results[0].title).toBe('Test Result 1');
      expect(results[0].url).toBe('https://example.com/1');
      expect(results[0].source).toBe('tavily');
      expect(results[0].score).toBeGreaterThan(0);
    });

    it('should handle API errors', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Network error'));

      await expect(provider.search('test query')).rejects.toThrow('Tavily search failed: Network error');
    });

    it('should handle 401 unauthorized error', async () => {
      const error = {
        response: {
          status: 401,
          data: { message: 'Invalid API key' }
        }
      };
      mockedAxios.post.mockRejectedValue(error);

      await expect(provider.search('test query')).rejects.toThrow('Tavily API key is invalid or expired');
    });

    it('should handle rate limiting', async () => {
      const error = {
        response: {
          status: 429,
          data: { message: 'Rate limit exceeded' }
        }
      };
      mockedAxios.post.mockRejectedValue(error);

      await expect(provider.search('test query')).rejects.toThrow('Tavily API rate limit exceeded');
    });

    it('should pass health check', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { results: [{ title: 'test', url: 'test', content: 'test' }] }
      });

      const isHealthy = await provider.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should fail health check on error', async () => {
      mockedAxios.post.mockRejectedValue(new Error('API error'));

      const isHealthy = await provider.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });

  describe('PerplexityProvider', () => {
    let provider: PerplexityProvider;

    beforeEach(() => {
      provider = new PerplexityProvider('test-api-key');
    });

    it('should throw error when API key is not provided', () => {
      expect(() => new PerplexityProvider('')).toThrow('Perplexity API key is required');
    });

    it('should initialize with API key', () => {
      expect(provider.name).toBe('perplexity');
    });

    it('should handle successful search response with citations', async () => {
      const mockResponse = {
        data: {
          choices: [
            {
              message: {
                content: 'Search response content'
              }
            }
          ],
          citations: [
            {
              title: 'Test Result 1',
              url: 'https://example.com/1',
              snippet: 'Test snippet 1'
            },
            {
              title: 'Test Result 2',
              url: 'https://example.com/2',
              snippet: 'Test snippet 2'
            }
          ]
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const results = await provider.search('test query', { limit: 5 });

      expect(results).toHaveLength(2);
      expect(results[0].title).toBe('Test Result 1');
      expect(results[0].url).toBe('https://example.com/1');
      expect(results[0].source).toBe('perplexity');
      expect(results[0].citations).toEqual(['https://example.com/1']);
    });

    it('should handle search response without citations', async () => {
      const mockResponse = {
        data: {
          choices: [
            {
              message: {
                content: 'First result. Second result. Third result.'
              }
            }
          ]
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const results = await provider.search('test query', { limit: 5 });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].source).toBe('perplexity');
    });

    it('should handle API errors', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Network error'));

      await expect(provider.search('test query')).rejects.toThrow('Perplexity search failed: Network error');
    });

    it('should handle 401 unauthorized error', async () => {
      const error = {
        response: {
          status: 401,
          data: { error: { message: 'Invalid API key' } }
        }
      };
      mockedAxios.post.mockRejectedValue(error);

      await expect(provider.search('test query')).rejects.toThrow('Perplexity API key is invalid or expired');
    });
  });

  describe('BraveProvider', () => {
    let provider: BraveProvider;

    beforeEach(() => {
      provider = new BraveProvider('test-api-key');
    });

    it('should throw error when API key is not provided', () => {
      expect(() => new BraveProvider('')).toThrow('Brave Search API key is required');
    });

    it('should initialize with API key', () => {
      expect(provider.name).toBe('brave');
    });

    it('should handle successful search response', async () => {
      const mockResponse = {
        data: {
          web: {
            results: [
              {
                title: 'Test Result 1',
                url: 'https://example.com/1',
                description: 'Test description 1',
                age: '2 days ago'
              },
              {
                title: 'Test Result 2',
                url: 'https://example.com/2',
                description: 'Test description 2'
              }
            ]
          }
        }
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const results = await provider.search('test query', { limit: 5 });

      expect(results).toHaveLength(2);
      expect(results[0].title).toBe('Test Result 1');
      expect(results[0].url).toBe('https://example.com/1');
      expect(results[0].source).toBe('brave');
      expect(results[0].citations).toEqual(['2 days ago']);
    });

    it('should handle mix results when web results are empty', async () => {
      const mockResponse = {
        data: {
          web: { results: [] },
          mix: {
            results: [
              {
                type: 'web',
                title: 'Mix Result 1',
                url: 'https://example.com/mix1',
                description: 'Mix description 1'
              }
            ]
          }
        }
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const results = await provider.search('test query');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Mix Result 1');
      expect(results[0].source).toBe('brave');
    });

    it('should handle API errors', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      await expect(provider.search('test query')).rejects.toThrow('Brave Search failed: Network error');
    });

    it('should handle 401 unauthorized error', async () => {
      const error = {
        response: {
          status: 401,
          data: { error: { message: 'Invalid API key' } }
        }
      };
      mockedAxios.get.mockRejectedValue(error);

      await expect(provider.search('test query')).rejects.toThrow('Brave Search API key is invalid or expired');
    });
  });

  describe('DuckDuckGoProvider', () => {
    let provider: DuckDuckGoProvider;

    beforeEach(() => {
      provider = new DuckDuckGoProvider();
    });

    it('should initialize without API key', () => {
      expect(provider.name).toBe('duckduckgo');
    });

    it('should handle successful HTML search response', async () => {
      const mockHtml = `
        <div class="result results_links results_links_deep web-result">
          <a class="result__a" href="https://example.com/1">Test Result 1</a>
          <a class="result__snippet">Test snippet 1</a>
        </div>
        <div class="result results_links results_links_deep web-result">
          <a class="result__a" href="https://example.com/2">Test Result 2</a>
          <a class="result__snippet">Test snippet 2</a>
        </div>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const results = await provider.search('test query', { limit: 5 });

      expect(results).toHaveLength(2);
      expect(results[0].title).toBe('Test Result 1');
      expect(results[0].url).toBe('https://example.com/1');
      expect(results[0].source).toBe('duckduckgo');
    });

    it('should handle instant answers when no results found', async () => {
      mockedAxios.get.mockResolvedValue({ data: '' });

      const mockInstantResponse = {
        data: {
          Abstract: 'Test abstract content',
          Heading: 'Test Heading',
          AbstractURL: 'https://example.com/abstract'
        }
      };

      mockedAxios.get
        .mockResolvedValueOnce({ data: '' })
        .mockResolvedValueOnce(mockInstantResponse);

      const results = await provider.search('test query');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Test Heading');
      expect(results[0].snippet).toBe('Test abstract content');
      expect(results[0].source).toBe('duckduckgo');
    });

    it('should handle API errors', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      await expect(provider.search('test query')).rejects.toThrow('DuckDuckGo search failed: Network error');
    });

    it('should handle rate limiting', async () => {
      const error = {
        response: {
          status: 429
        }
      };
      mockedAxios.get.mockRejectedValue(error);

      await expect(provider.search('test query')).rejects.toThrow('DuckDuckGo rate limit exceeded');
    });
  });

  describe('Provider Score Calculation', () => {
    it('should calculate scores within valid range', async () => {
      const tavilyProvider = new TavilyProvider('test-key');
      const mockResponse = {
        data: {
          results: [
            { title: 'Test', url: 'https://test.com', content: 'Test content' }
          ]
        }
      };
      mockedAxios.post.mockResolvedValue(mockResponse);

      const results = await tavilyProvider.search('test');
      
      results.forEach(result => {
        expect(result.score).toBeGreaterThanOrEqual(0.1);
        expect(result.score).toBeLessThanOrEqual(1.0);
      });
    });

    it('should boost scores for high-quality domains', async () => {
      const braveProvider = new BraveProvider('test-key');
      const mockResponse = {
        data: {
          web: {
            results: [
              { title: 'Test', url: 'https://github.com/test', description: 'Test' }
            ]
          }
        }
      };
      mockedAxios.get.mockResolvedValue(mockResponse);

      const results = await braveProvider.search('test');
      expect(results[0].score).toBeGreaterThan(0.9);
    });
  });
});