import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export interface SearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  source: 'duckduckgo';
  score: number;
  timestamp: string;
  citations?: string[];
}

export interface DuckDuckGoSearchOptions {
  limit?: number;
  language?: string;
  region?: string;
  safe_search?: 'strict' | 'moderate' | 'off';
  time?: 'd' | 'w' | 'm' | 'y';
}

export class DuckDuckGoProvider {
  readonly name = 'duckduckgo';
  private readonly baseUrl = 'https://html.duckduckgo.com/html/';
  private readonly instantAnswerUrl = 'https://api.duckduckgo.com/';

  async search(query: string, options: DuckDuckGoSearchOptions = {}): Promise<SearchResult[]> {
    const {
      limit = 10,
      language = 'en-US',
      region = 'us-en',
      safe_search = 'moderate',
      time
    } = options;

    try {
      const params = new URLSearchParams({
        q: query,
        kl: region,
        dl: language,
        safesearch: safe_search,
      });

      if (time) {
        params.append('df', time);
      }

      const response = await axios.get(`${this.baseUrl}?${params.toString()}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': language,
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
        },
        timeout: 15000,
      });

      const html = response.data;
      const results: SearchResult[] = [];

      const resultRegex = /<div class="result results_links results_links_deep web-result[^>]*>[\s\S]*?<\/div>/g;
      const matches = html.match(resultRegex) || [];

      for (let i = 0; i < Math.min(matches.length, limit); i++) {
        const match = matches[i];
        const result = this.parseResult(match, i);
        if (result) {
          results.push(result);
        }
      }

      if (results.length === 0) {
        const instantResults = await this.getInstantAnswers(query);
        results.push(...instantResults);
      }

      return results;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.message;
        
        if (status === 429) {
          throw new Error('DuckDuckGo rate limit exceeded');
        } else if (status === 403) {
          throw new Error('DuckDuckGo access forbidden - may need to change request pattern');
        }
        
        throw new Error(`DuckDuckGo search error (${status}): ${message}`);
      }
      
      throw new Error(`DuckDuckGo search failed: ${error instanceof Error ? error.message : String(error)}`);
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

  private async getInstantAnswers(query: string): Promise<SearchResult[]> {
    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        no_html: '1',
        skip_disambig: '1',
      });

      const response = await axios.get(`${this.instantAnswerUrl}?${params.toString()}`, {
        timeout: 10000,
      });

      const data = response.data;
      const results: SearchResult[] = [];

      if (data.Abstract) {
        results.push({
          id: uuidv4(),
          title: data.Heading || query,
          url: data.AbstractURL || data.AbstractSource || '',
          snippet: data.Abstract,
          source: this.name,
          score: 0.95,
          timestamp: new Date().toISOString(),
        });
      }

      if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        for (let i = 0; i < Math.min(data.RelatedTopics.length, 5); i++) {
          const topic = data.RelatedTopics[i];
          if (topic.Text && topic.FirstURL) {
            results.push({
              id: uuidv4(),
              title: this.extractTitleFromText(topic.Text),
              url: topic.FirstURL,
              snippet: topic.Text,
              source: this.name,
              score: 0.8 - (i * 0.1),
              timestamp: new Date().toISOString(),
            });
          }
        }
      }

      return results;
    } catch {
      return [];
    }
  }

  private parseResult(html: string, position: number): SearchResult | null {
    try {
      const titleMatch = html.match(/<a[^>]*class="result__a"[^>]*>([^<]+)<\/a>/);
      const urlMatch = html.match(/<a[^>]*class="result__a"[^>]*href="([^"]+)"/);
      const snippetMatch = html.match(/<a[^>]*class="result__snippet"[^>]*>([^<]+)<\/a>/);

      if (!titleMatch || !urlMatch) {
        return null;
      }

      const title = this.cleanText(titleMatch[1]);
      const url = this.cleanUrl(urlMatch[1]);
      const snippet = snippetMatch ? this.cleanText(snippetMatch[1]) : '';

      if (!title || !url) {
        return null;
      }

      return {
        id: uuidv4(),
        title,
        url,
        snippet,
        source: this.name,
        score: this.calculateScore({ title, snippet, url }, position),
        timestamp: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  private cleanText(text: string): string {
    return text
      .replace(/<[^>]*>/g, '')
      .replace(/&[^;]+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private cleanUrl(url: string): string {
    if (url.startsWith('/l/?uddg=')) {
      const match = url.match(/uddg=([^&]+)/);
      if (match) {
        return decodeURIComponent(match[1]);
      }
    }
    
    if (url.startsWith('http')) {
      return url;
    }
    
    return '';
  }

  private extractTitleFromText(text: string): string {
    const sentences = text.split(/[.!?]+/);
    if (sentences.length > 0) {
      const firstSentence = sentences[0].trim();
      return firstSentence.length > 100 ? firstSentence.substring(0, 100) + '...' : firstSentence;
    }
    return text.substring(0, 100);
  }

  private calculateScore(result: { title: string; snippet: string; url: string }, position: number): number {
    let score = 1.0 - (position * 0.1);
    
    if (result.title.length > 0) {
      score += 0.1;
    }
    
    if (result.snippet.length > 50) {
      score += 0.1;
    }
    
    if (this.isHighQualityDomain(result.url)) {
      score += 0.1;
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