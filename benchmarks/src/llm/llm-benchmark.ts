/**
 * LLM Provider Benchmark Implementation
 * Benchmarks Ollama and Perplexity providers for performance comparison
 */

import axios from 'axios';
import { BenchmarkRunner } from '@/core/benchmark-runner';
import {
  BenchmarkConfig,
  BenchmarkResult,
  BenchmarkScenario,
  LLMProviderConfig,
  LLMTestPayload,
  IterationResult,
  ChatMessage,
  BenchmarkError
} from '@/types';

export class LLMBenchmark extends BenchmarkRunner {
  private llmProviders: Map<string, LLMProviderConfig> = new Map();

  constructor(config: BenchmarkConfig) {
    super(config);
    this.initializeProviders();
  }

  /**
   * Initialize LLM providers from configuration
   */
  private initializeProviders(): void {
    // Ollama provider
    if (this.config.providers.llm.includes('ollama')) {
      this.llmProviders.set('ollama', {
        name: 'ollama',
        type: 'ollama',
        endpoint: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
        model: process.env.OLLAMA_MODEL || 'llama2'
      });
    }

    // Perplexity provider
    if (this.config.providers.llm.includes('perplexity')) {
      this.llmProviders.set('perplexity', {
        name: 'perplexity',
        type: 'perplexity',
        endpoint: process.env.PERPLEXITY_BASE_URL || 'http://localhost:8080',
        apiKey: process.env.PERPLEXITY_API_KEY,
        model: process.env.PERPLEXITY_MODEL || 'llama-3.1-sonar-small-128k-online'
      });
    }
  }

  /**
   * Execute LLM provider request
   */
  protected async executeProviderRequest(
    providerName: string,
    scenario: BenchmarkScenario,
    iteration: number,
    isWarmup: boolean
  ): Promise<any> {
    const provider = this.llmProviders.get(providerName);
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
      
      if (provider.type === 'ollama') {
        response = await this.executeOllamaRequest(provider, payload);
      } else if (provider.type === 'perplexity') {
        response = await this.executePerplexityRequest(provider, payload);
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
        tokenUsage: this.extractTokenUsage(response, provider.type),
        providerMetrics: {
          providerType: provider.type,
          model: provider.model,
          responseTime: endTime - startTime,
          promptLength: typeof payload.prompt === 'string' 
            ? payload.prompt.length 
            : payload.prompt.map(m => m.content).join('').length
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
   * Execute Ollama API request
   */
  private async executeOllamaRequest(
    provider: LLMProviderConfig,
    payload: LLMTestPayload
  ): Promise<any> {
    const { systemPrompt, userPrompt } = this.convertToOllamaFormat(payload.prompt);
    
    const request = {
      model: payload.options?.model || provider.model,
      prompt: userPrompt,
      system: systemPrompt,
      options: {
        temperature: payload.options?.temperature,
        top_p: payload.options?.topP,
        num_predict: payload.options?.maxTokens,
        stop: payload.options?.stop
      },
      stream: false
    };

    const response = await axios.post(
      `${provider.endpoint}/api/generate`,
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
   * Execute Perplexity API request
   */
  private async executePerplexityRequest(
    provider: LLMProviderConfig,
    payload: LLMTestPayload
  ): Promise<any> {
    const messages = this.convertToOpenAIFormat(payload.prompt);
    
    const request = {
      model: payload.options?.model || provider.model,
      messages,
      temperature: payload.options?.temperature,
      max_tokens: payload.options?.maxTokens,
      top_p: payload.options?.topP,
      stream: false,
      stop: payload.options?.stop,
      presence_penalty: payload.options?.presencePenalty,
      frequency_penalty: payload.options?.frequencyPenalty
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

    return response.data;
  }

  /**
   * Convert prompt to Ollama format
   */
  private convertToOllamaFormat(prompt: string | ChatMessage[]): { systemPrompt?: string; userPrompt: string } {
    if (typeof prompt === 'string') {
      return { userPrompt: prompt };
    }

    const messages = prompt as ChatMessage[];
    let systemPrompt: string | undefined;
    let userPrompt = '';

    for (const message of messages) {
      if (message.role === 'system') {
        systemPrompt = message.content;
      } else if (message.role === 'user') {
        userPrompt += message.content + '\n';
      } else if (message.role === 'assistant') {
        userPrompt += `Assistant: ${message.content}\n`;
      }
    }

    return { systemPrompt, userPrompt: userPrompt.trim() };
  }

  /**
   * Convert prompt to OpenAI format
   */
  private convertToOpenAIFormat(prompt: string | ChatMessage[]): ChatMessage[] {
    if (typeof prompt === 'string') {
      return [{ role: 'user', content: prompt }];
    }
    return prompt as ChatMessage[];
  }

  /**
   * Extract token usage from response
   */
  private extractTokenUsage(response: any, providerType: string): { prompt: number; completion: number; total: number } {
    if (providerType === 'ollama') {
      return {
        prompt: response.prompt_eval_count || 0,
        completion: response.eval_count || 0,
        total: (response.prompt_eval_count || 0) + (response.eval_count || 0)
      };
    } else if (providerType === 'perplexity') {
      const usage = response.usage || {};
      return {
        prompt: usage.prompt_tokens || 0,
        completion: usage.completion_tokens || 0,
        total: usage.total_tokens || 0
      };
    }

    return { prompt: 0, completion: 0, total: 0 };
  }

  /**
   * Get test payload for scenario
   */
  private getTestPayload(scenario: BenchmarkScenario, iteration: number): LLMTestPayload {
    const payloads = this.getPayloadsForScenario(scenario);
    return payloads[iteration % payloads.length];
  }

  /**
   * Get predefined payloads for different scenarios
   */
  private getPayloadsForScenario(scenario: BenchmarkScenario): LLMTestPayload[] {
    switch (scenario.id) {
      case 'small-prompt':
        return [
          {
            prompt: 'What is 2 + 2?',
            options: { maxTokens: 50 }
          }
        ];

      case 'medium-prompt':
        return [
          {
            prompt: 'Explain the concept of machine learning in detail, including its main types and applications.',
            options: { maxTokens: 500 }
          }
        ];

      case 'large-prompt':
        return [
          {
            prompt: `Write a comprehensive technical documentation for a distributed system architecture.
            Include:
            1. System overview
            2. Component breakdown
            3. Data flow diagrams
            4. API specifications
            5. Deployment considerations
            6. Monitoring and observability
            7. Security considerations
            8. Scaling strategies
            9. Performance optimization
            10. Disaster recovery`,
            options: { maxTokens: 2000 }
          }
        ];

      case 'coding-task':
        return [
          {
            prompt: 'Write a TypeScript function that implements a binary search tree with insert, delete, and search operations. Include proper error handling and type definitions.',
            options: { maxTokens: 1000 }
          }
        ];

      case 'reasoning-task':
        return [
          {
            prompt: 'Analyze this complex business problem and propose a solution architecture: "A e-commerce platform needs to handle 1M concurrent users during flash sales, with 99.99% uptime. The system must support real-time inventory management, personalized recommendations, and fraud detection."',
            options: { maxTokens: 1500 }
          }
        ];

      case 'conversation':
        return [
          {
            prompt: [
              { role: 'system', content: 'You are a helpful AI assistant specializing in technical documentation.' },
              { role: 'user', content: 'What are the key principles of microservices architecture?' },
              { role: 'assistant', content: 'Microservices architecture is an architectural style that structures an application as a collection of loosely coupled, independently deployable services...' },
              { role: 'user', content: 'How does this compare to monolithic architecture?' }
            ],
            options: { maxTokens: 800 }
          }
        ];

      default:
        return [
          {
            prompt: 'Hello, how are you?',
            options: { maxTokens: 100 }
          }
        ];
    }
  }

  /**
   * Get provider health status
   */
  async getProviderHealth(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};

    for (const [name, provider] of this.llmProviders) {
      try {
        if (provider.type === 'ollama') {
          await axios.get(`${provider.endpoint}/api/tags`, { timeout: 5000 });
          health[name] = true;
        } else if (provider.type === 'perplexity') {
          await axios.get(`${provider.endpoint}/v1/models`, { 
            timeout: 5000,
            headers: { 'Authorization': `Bearer ${provider.apiKey}` }
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
   * Get available models for each provider
   */
  async getAvailableModels(): Promise<Record<string, string[]>> {
    const models: Record<string, string[]> = {};

    for (const [name, provider] of this.llmProviders) {
      try {
        if (provider.type === 'ollama') {
          const response = await axios.get(`${provider.endpoint}/api/tags`, { timeout: 10000 });
          models[name] = response.data.models?.map((model: any) => model.name) || [];
        } else if (provider.type === 'perplexity') {
          const response = await axios.get(`${provider.endpoint}/v1/models`, { 
            timeout: 10000,
            headers: { 'Authorization': `Bearer ${provider.apiKey}` }
          });
          models[name] = response.data.data?.map((model: any) => model.id) || [];
        }
      } catch (error) {
        models[name] = [];
      }
    }

    return models;
  }
}