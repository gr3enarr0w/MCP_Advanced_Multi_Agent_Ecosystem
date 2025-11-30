/**
 * Ollama Provider Implementation
 * Provides integration with local Ollama models for the agent swarm system
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
  TokenUsage,
  ResponseMetadata
} from './llm-provider.js';

/**
 * Ollama provider configuration
 */
export interface OllamaConfig {
  /** Base URL for Ollama API */
  baseUrl: string;
  /** Default model to use */
  model: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Additional headers */
  headers?: Record<string, string>;
}

/**
 * Ollama API request/response types
 */
interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  system?: string;
  context?: number[];
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
    stop?: string[];
  };
  stream?: boolean;
  raw?: boolean;
}

interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

/**
 * Ollama provider implementation
 */
export class OllamaProvider implements LLMProvider {
  private client: AxiosInstance;
  private config: OllamaConfig;
  private availableModels: Set<string> = new Set();

  constructor(config: OllamaConfig) {
    this.config = {
      timeout: 60000,
      headers: {},
      ...config
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers
      }
    });

    // Initialize available models
    this.initializeModels();
  }

  /**
   * Initialize the list of available models
   */
  private async initializeModels(): Promise<void> {
    try {
      const response = await this.client.get<{ models: OllamaModel[] }>('/api/tags');
      this.availableModels = new Set(
        response.data.models.map(model => model.name)
      );
    } catch (error) {
      // Log error but don't fail initialization
      console.warn('Failed to fetch Ollama models:', error);
    }
  }

  /**
   * Generate completion using Ollama API
   */
  async generate(
    prompt: string | ChatMessage[], 
    options?: GenerateOptions
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    
    try {
      // Convert prompt to Ollama format
      const { systemPrompt, userPrompt } = this.convertPrompt(prompt);
      
      // Build request
      const request: OllamaGenerateRequest = {
        model: options?.model || this.config.model,
        prompt: userPrompt,
        system: systemPrompt,
        options: {
          temperature: options?.temperature,
          top_p: options?.topP,
          num_predict: options?.maxTokens,
          stop: options?.stop
        },
        stream: false
      };

      // Make request
      const response = await this.client.post<OllamaGenerateResponse>(
        '/api/generate',
        request
      );

      // Calculate response time
      const responseTime = Date.now() - startTime;

      // Convert to standard format
      return this.convertResponse(response.data, responseTime);

    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.error || error.message;
        
        if (status === 404) {
          throw new LLMUnavailableError('ollama', `Model not found: ${options?.model || this.config.model}`);
        } else if (status === 500) {
          throw new LLMUnavailableError('ollama', 'Ollama server error');
        } else if (status === 0) {
          throw new LLMUnavailableError('ollama', 'Cannot connect to Ollama server');
        }
        
        throw new LLMProviderError(
          `Ollama API error: ${message}`,
          'ollama',
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
    return 'ollama';
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
      await this.client.get('/api/tags');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get provider capabilities
   */
  getCapabilities(): ProviderCapabilities {
    return {
      modalities: ['text'],
      maxContextSize: 128000, // Varies by model, conservative estimate
      streaming: true,
      functionCalling: false,
      vision: false,
      costTier: 'free'
    };
  }

  /**
   * Get list of available models
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await this.client.get<{ models: OllamaModel[] }>('/api/tags');
      return response.data.models.map(model => model.name);
    } catch (error) {
      throw new LLMProviderError(
        'Failed to fetch Ollama models',
        'ollama',
        'MODELS_ERROR'
      );
    }
  }

  /**
   * Pull a model if not available
   */
  async pullModel(modelName: string): Promise<void> {
    try {
      await this.client.post('/api/pull', { name: modelName });
    } catch (error) {
      throw new LLMProviderError(
        `Failed to pull model ${modelName}`,
        'ollama',
        'PULL_ERROR'
      );
    }
  }

  /**
   * Convert prompt to Ollama format
   */
  private convertPrompt(prompt: string | ChatMessage[]): { systemPrompt?: string; userPrompt: string } {
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
   * Convert Ollama response to standard format
   */
  private convertResponse(
    ollamaResponse: OllamaGenerateResponse,
    responseTime: number
  ): LLMResponse {
    const promptTokens = ollamaResponse.prompt_eval_count || 0;
    const completionTokens = ollamaResponse.eval_count || 0;

    return {
      content: ollamaResponse.response,
      model: ollamaResponse.model,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens
      },
      metadata: {
        backend: 'ollama',
        responseTimeMs: responseTime,
        selectionReason: 'local_model'
      },
      finishReason: ollamaResponse.done ? 'stop' : 'length'
    };
  }
}