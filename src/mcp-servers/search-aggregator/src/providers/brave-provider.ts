import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export interface SearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  source: 'brave';
  score: number;
  timestamp: string;
  citations?: string[];
}

export interface BraveSearchOptions {
  limit?: number;
  language?: string;
  country?: string;
  search_type?: 'web' | 'news' | 'images' | 'videos';
  safesearch?: 'strict' | 'moderate' | 'off';
  freshness?: 'pd' | 'pw' | 'pm' | 'py' | 'pd-1w' | 'pd-1m' | 'pd-1y';
  text_decorations?: boolean;
  spellcheck?: boolean;
  result_filter?: string;
  safesearch_off?: boolean;
  units?: 'metric' | 'imperial';
  extra_snippets?: boolean;
}

export class BraveProvider {
  private apiKey: string;
  readonly name = 'brave';
  private readonly baseUrl = 'https://api.search.brave.com/res/v1/web/search';

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Brave Search API key is required');
    }
    this.apiKey = apiKey;
  }

  async search(query: string, options: BraveSearchOptions = {}): Promise<SearchResult[]> {
    const {
      limit = 10,
      language = 'en',
      country = 'US',
      search_type = 'web',
      safesearch = 'moderate',
      freshness,
      text_decorations = false,
      spellcheck = true,
      result_filter,
      safesearch_off = false,
      units = 'metric',
      extra_snippets = false
    } = options;

    try {
      const params = new URLSearchParams({
        q: query,
        count: Math.min(limit, 20).toString(),
        lang: language,
        country,
        search_type,
        safesearch,
        text_decorations: text_decorations.toString(),
        spellcheck: spellcheck.toString(),
        units,
        extra_snippets: extra_snippets.toString(),
      });

      if (freshness) {
        params.append('freshness', freshness);
      }

      if (result_filter) {
        params.append('result_filter', result_filter);
      }

      if (safesearch_off) {
        params.append('safesearch_off', 'true');
      }

      const response = await axios.get(`${this.baseUrl}?${params.toString()}`, {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': this.apiKey,
        },
        timeout: 30000,
      });

      const data = response.data;
      const results: SearchResult[] = [];

      if (data.web && data.web.results && Array.isArray(data.web.results)) {
        for (let i = 0; i < Math.min(data.web.results.length, limit); i++) {
          const result = data.web.results[i];
          results.push({
            id: uuidv4(),
            title: result.title || '',
            url: result.url || '',
            snippet: result.description || result.snippet || '',
            source: this.name,
            score: this.calculateScore(result, i),
            timestamp: new Date().toISOString(),
            citations: result.age ? [result.age] : undefined,
          });
        }
      }

      if (results.length === 0 && data.mix && data.mix.results && Array.isArray(data.mix.results)) {
        for (let i = 0; i < Math.min(data.mix.results.length, limit); i++) {
          const result = data.mix.results[i];
          if (result.type === 'web') {
            results.push({
              id: uuidv4(),
              title: result.title || '',
              url: result.url || '',
              snippet: result.description || result.snippet || '',
              source: this.name,
              score: this.calculateScore(result, i),
              timestamp: new Date().toISOString(),
            });
          }
        }
      }

      return results;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.error?.message || error.message;
        
        if (status === 401) {
          throw new Error('Brave Search API key is invalid or expired');
        } else if (status === 429) {
          throw new Error('Brave Search API rate limit exceeded');
        } else if (status === 400) {
          throw new Error(`Brave Search API bad request: ${message}`);
        } else if (status === 403) {
          throw new Error(`Brave Search API access forbidden: ${message}`);
        }
        
        throw new Error(`Brave Search API error (${status}): ${message}`);
      }
      
      throw new Error(`Brave Search failed: ${error instanceof Error ? error.message : String(error)}`);
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
    
    if (result.meta && result.meta.score) {
      score = Math.min(score + result.meta.score * 0.2, 1.0);
    }
    
    if (result.title && result.title.length > 0) {
      score += 0.1;
    }
    
    if (result.description && result.description.length > 100) {
      score += 0.1;
    }
    
    if (result.url && this.isHighQualityDomain(result.url)) {
      score += 0.1;
    }
    
    if (result.age && !result.age.includes('year')) {
      score += 0.05;
    }
    
    return Math.max(Math.min(score, 1.0), 0.1);
  }

  private isHighQualityDomain(url: string): boolean {
    const highQualityDomains = [
      'wikipedia.org',
      'github.com',
      'stackoverflow.com',
      'medium.com',
      'techcrunch.com',
      'arxiv.org',
      'nature.com',
      'science.org',
      'reuters.com',
      'apnews.com',
      'bbc.com',
      'cnn.com',
      'nytimes.com',
      'wsj.com',
      'theguardian.com'
    ];
    
    try {
      const domain = new URL(url).hostname.toLowerCase();
      return highQualityDomains.some(hqd => domain.includes(hqd) || domain.endsWith(hqd));
    } catch {
      return false;
    }
  }
}