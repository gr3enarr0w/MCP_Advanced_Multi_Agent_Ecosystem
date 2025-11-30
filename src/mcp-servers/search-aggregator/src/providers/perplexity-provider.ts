import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export interface SearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  source: 'perplexity';
  score: number;
  timestamp: string;
  citations?: string[];
}

export interface PerplexitySearchOptions {
  limit?: number;
  language?: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

export class PerplexityProvider {
  private apiKey: string;
  readonly name = 'perplexity';
  private readonly baseUrl = 'https://api.perplexity.ai/chat/completions';

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Perplexity API key is required');
    }
    this.apiKey = apiKey;
  }

  async search(query: string, options: PerplexitySearchOptions = {}): Promise<SearchResult[]> {
    const {
      limit = 10,
      language = 'en',
      model = 'sonar-pro',
      temperature = 0.1,
      max_tokens = 1000
    } = options;

    try {
      const systemPrompt = `You are a research assistant. Search for information about the user's query and provide accurate, up-to-date results. Format your response to include relevant sources and citations.`;

      const response = await axios.post(this.baseUrl, {
        model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `Search for: ${query}. Provide ${limit} relevant results with sources.`
          }
        ],
        temperature,
        max_tokens,
        top_p: 0.9,
        return_citations: true,
        search_domain_filter: ["perplexity.ai"],
        return_images: false,
        return_related_questions: false,
        search_recency_filter: "month",
        top_k: 0,
        stream: false,
        presence_penalty: 0,
        frequency_penalty: 1
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });

      const data = response.data;
      const results: SearchResult[] = [];

      if (data.choices && data.choices.length > 0) {
        const choice = data.choices[0];
        const content = choice.message?.content || '';
        
        if (data.citations && Array.isArray(data.citations)) {
          for (let i = 0; i < Math.min(data.citations.length, limit); i++) {
            const citation = data.citations[i];
            results.push({
              id: uuidv4(),
              title: this.extractTitleFromCitation(citation) || `Search Result ${i + 1}`,
              url: citation.url || '',
              snippet: this.extractSnippetFromContent(content, citation) || citation.snippet || '',
              source: this.name,
              score: this.calculateScore(citation, i),
              timestamp: new Date().toISOString(),
              citations: [citation.url || ''],
            });
          }
        } else {
          const lines = content.split('\n').filter(line => line.trim());
          for (let i = 0; i < Math.min(lines.length, limit); i++) {
            const line = lines[i].trim();
            if (line.length > 20) {
              results.push({
                id: uuidv4(),
                title: this.extractTitleFromLine(line) || `Search Result ${i + 1}`,
                url: '',
                snippet: line,
                source: this.name,
                score: 0.9 - (i * 0.1),
                timestamp: new Date().toISOString(),
              });
            }
          }
        }
      }

      return results;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.error?.message || error.message;
        
        if (status === 401) {
          throw new Error('Perplexity API key is invalid or expired');
        } else if (status === 429) {
          throw new Error('Perplexity API rate limit exceeded');
        } else if (status === 400) {
          throw new Error(`Perplexity API bad request: ${message}`);
        }
        
        throw new Error(`Perplexity API error (${status}): ${message}`);
      }
      
      throw new Error(`Perplexity search failed: ${error instanceof Error ? error.message : String(error)}`);
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

  private extractTitleFromCitation(citation: any): string | null {
    if (citation.title) return citation.title;
    if (citation.snippet) {
      const title = citation.snippet.split('.')[0];
      return title.length > 100 ? title.substring(0, 100) + '...' : title;
    }
    return null;
  }

  private extractSnippetFromContent(content: string, citation: any): string | null {
    if (citation.snippet) return citation.snippet;
    
    const url = citation.url;
    if (url && content.includes(url)) {
      const beforeUrl = content.substring(0, content.indexOf(url));
      const sentences = beforeUrl.split(/[.!?]+/);
      return sentences[sentences.length - 1]?.trim() || null;
    }
    
    return null;
  }

  private extractTitleFromLine(line: string): string | null {
    const sentences = line.split(/[.!?]+/);
    if (sentences.length > 0) {
      const firstSentence = sentences[0].trim();
      return firstSentence.length > 100 ? firstSentence.substring(0, 100) + '...' : firstSentence;
    }
    return null;
  }

  private calculateScore(citation: any, position: number): number {
    let score = 1.0 - (position * 0.1);
    
    if (citation.url && citation.url.length > 0) {
      score += 0.1;
    }
    
    if (citation.title && citation.title.length > 0) {
      score += 0.1;
    }
    
    if (citation.snippet && citation.snippet.length > 50) {
      score += 0.1;
    }
    
    return Math.max(Math.min(score, 1.0), 0.1);
  }
}