/**
 * Perplexity Provider Implementation
 * Provides integration with Perplexity models via nanogpt-proxy service
 */

import axios, { AxiosInstance } from 'axios';
import { 
  LLMProvider, 
  LLMResponse, 
  GenerateOptions, 
  ChatMessage, 
  ProviderCapabilities, 
  LLMProviderError, 
  LLMUnavailableError,
  LLMAuthenticationError,
  LLMRateLimitError,
  TokenUsage,
  ResponseMetadata
} from './llm-provider.js';

/**
 * Perplexity provider configuration
 */
export interface PerplexityConfig {
  /** Base URL for nanogpt-proxy service */
  baseUrl: string;
  /** API key for nanogpt-proxy */
  apiKey?: string;
  /** Default model to use */
  model: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Profile to use (personal/work) */
  profile?: string;
  /** Additional headers */
  headers?: Record<string, string>;
}

/**
 * OpenAI-compatible chat request (matching nanogpt-proxy format)
 */
interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  stop?: string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  // Custom fields for nanogpt-proxy
  role?: string;
  conversation_id?: string;
}

/**
 * OpenAI-compatible chat response (matching nanogpt-proxy format)
 */
interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  x_proxy_metadata?: {
    backend: string;
    model_selected: string;
    original_prompt_length?: number;
    optimized_prompt_length?: number;
    prompt_engineer_time_ms?: number;
    strategy_used?: string;
    selection_reason?: string;
  };
}

/**
 * Perplexity provider implementation via nanogpt-proxy
 */
export class PerplexityProvider implements LLMProvider {
  private client: AxiosInstance;
  private config: PerplexityConfig;

  constructor(config: PerplexityConfig) {
    this.config = {
      timeout: 60000,
      profile: 'personal',
      headers: {},
      ...config
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
        ...(this.config.profile && { 'X-Profile': this.config.profile }),
        ...this.config.headers
      }
    });
  }

  /**
   * Generate completion using Perplexity via nanogpt-proxy
   */
  async generate(
    prompt: string | ChatMessage[], 
    options?: GenerateOptions
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    
    try {
      // Convert prompt to OpenAI format
      const messages = this.convertPrompt(prompt);
      
      // Build request
      const request: ChatCompletionRequest = {
        model: options?.model || this.config.model,
        messages,
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
        top_p: options?.topP,
        stream: false,
        stop: options?.stop,
        presence_penalty: options?.presencePenalty,
        frequency_penalty: options?.frequencyPenalty,
        role: options?.role,
        conversation_id: options?.conversationId
      };

      // Make request to nanogpt-proxy
      const response = await this.client.post<ChatCompletionResponse>(
        '/v1/chat/completions',
        request
      );

      // Calculate response time
      const responseTime = Date.now() - startTime;

      // Convert to standard format
      return this.convertResponse(response.data, responseTime);

    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const data = error.response?.data as any;
        const message = data?.error?.message || data?.message || error.message;
        
        if (status === 401) {
          throw new LLMAuthenticationError('perplexity', message);
        } else if (status === 429) {
          throw new LLMRateLimitError('perplexity', message);
        } else if (status === 404) {
          throw new LLMUnavailableError('perplexity', `Model not found: ${options?.model || this.config.model}`);
        } else if (status === 503) {
          throw new LLMUnavailableError('perplexity', 'Service temporarily unavailable');
        } else if (status === 0) {
          throw new LLMUnavailableError('perplexity', 'Cannot connect to nanogpt-proxy service');
        }
        
        throw new LLMProviderError(
          `Perplexity API error: ${message}`,
          'perplexity',
          'API_ERROR',
          status
        );
      }
      
      throw error;
    }
  }

  /**
   * Get provider name
   */
  getProvider(): string {
    return 'perplexity';
  }

  /**
   * Get current model
   */
  getModel(): string {
    return this.config.model;
  }

  /**
   * Check if provider is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.client.get('/health');
      return true;
    } catch {
      try {
        // Fallback: try models endpoint
        await this.client.get('/v1/models');
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Get provider capabilities
   */
  getCapabilities(): ProviderCapabilities {
    return {
      modalities: ['text'],
      maxContextSize: 200000, // Perplexity models typically have large context
      streaming: true,
      functionCalling: true,
      vision: false,
      costTier: 'paid'
    };
  }

  /**
   * Get list of available models
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await this.client.get<{ data: Array<{ id: string }> }>('/v1/models');
      return response.data.data.map(model => model.id);
    } catch (error) {
      throw new LLMProviderError(
        'Failed to fetch Perplexity models',
        'perplexity',
        'MODELS_ERROR'
      );
    }
  }

  /**
   * Convert prompt to OpenAI format
   */
  private convertPrompt(prompt: string | ChatMessage[]): ChatMessage[] {
    if (typeof prompt === 'string') {
      return [{ role: 'user', content: prompt }];
    }
    return prompt as ChatMessage[];
  }

  /**
   * Convert OpenAI response to standard format
   */
  private convertResponse(
    openaiResponse: ChatCompletionResponse,
    responseTime: number
  ): LLMResponse {
    const choice = openaiResponse.choices[0];
    const usage = openaiResponse.usage;
    const metadata = openaiResponse.x_proxy_metadata;

    return {
      content: choice.message.content,
      model: openaiResponse.model,
      usage: {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens
      },
      metadata: {
        backend: metadata?.backend || 'perplexity',
        responseTimeMs: responseTime,
        originalPromptLength: metadata?.original_prompt_length,
        optimizedPromptLength: metadata?.optimized_prompt_length,
        strategyUsed: metadata?.strategy_used,
        selectionReason: metadata?.selection_reason || 'perplexity_model'
      },
      finishReason: choice.finish_reason
    };
  }

  /**
   * Update profile for request routing
   */
  setProfile(profile: string): void {
    this.config.profile = profile;
    this.client.defaults.headers['X-Profile'] = profile;
  }

  /**
   * Get current profile
   */
  getProfile(): string {
    return this.config.profile || 'personal';
  }
}