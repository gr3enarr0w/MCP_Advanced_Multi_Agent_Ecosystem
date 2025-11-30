import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export interface SearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  source: 'tavily';
  score: number;
  timestamp: string;
  citations?: string[];
}

export interface TavilySearchOptions {
  limit?: number;
  language?: string;
  search_depth?: 'basic' | 'advanced';
  include_answer?: boolean;
  include_raw_content?: boolean;
  max_results?: number;
}

export class TavilyProvider {
  private apiKey: string;
  readonly name = 'tavily';
  private readonly baseUrl = 'https://api.tavily.com/search';

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Tavily API key is required');
    }
    this.apiKey = apiKey;
  }

  async search(query: string, options: TavilySearchOptions = {}): Promise<SearchResult[]> {
    const {
      limit = 10,
      language = 'en',
      search_depth = 'basic',
      include_answer = false,
      include_raw_content = false,
      max_results = 10
    } = options;

    try {
      const response = await axios.post(this.baseUrl, {
        api_key: this.apiKey,
        query,
        search_depth,
        include_answer,
        include_raw_content,
        max_results: Math.min(limit, max_results),
        include_domains: [],
        exclude_domains: [],
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });

      const data = response.data;
      const results: SearchResult[] = [];

      if (data.results && Array.isArray(data.results)) {
        for (let i = 0; i < data.results.length; i++) {
          const result = data.results[i];
          results.push({
            id: uuidv4(),
            title: result.title || '',
            url: result.url || '',
            snippet: result.content || result.snippet || '',
            source: this.name,
            score: this.calculateScore(result, i),
            timestamp: new Date().toISOString(),
            citations: result.published_date ? [result.published_date] : undefined,
          });
        }
      }

      return results;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;
        
        if (status === 401) {
          throw new Error('Tavily API key is invalid or expired');
        } else if (status === 429) {
          throw new Error('Tavily API rate limit exceeded');
        } else if (status === 400) {
          throw new Error(`Tavily API bad request: ${message}`);
        }
        
        throw new Error(`Tavily API error (${status}): ${message}`);
      }
      
      throw new Error(`Tavily search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.search('test', { limit: 1 });
      return true;
    } catch {
      return false;
    }
  }

  private calculateScore(result: any, position: number): number {
    let score = 1.0 - (position * 0.1);
    
    if (result.score) {
      score = Math.min(score + result.score * 0.2, 1.0);
    }
    
    if (result.title && result.title.length > 0) {
      score += 0.1;
    }
    
    if (result.content && result.content.length > 100) {
      score += 0.1;
    }
    
    return Math.max(Math.min(score, 1.0), 0.1);
  }
}