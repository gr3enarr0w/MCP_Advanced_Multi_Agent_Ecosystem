/**
 * Tests for Perplexity Provider
 */

import axios from 'axios';
import { AxiosInstance } from 'axios';
import { PerplexityProvider, PerplexityConfig } from '../../src/llm/perplexity-provider.js';
import { 
  LLMUnavailableError, 
  LLMProviderError, 
  LLMAuthenticationError,
  LLMRateLimitError 
} from '../../src/llm/llm-provider.js';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Perplexity Provider', () => {
  let provider: PerplexityProvider;
  let mockAxiosInstance: jest.Mocked<AxiosInstance>;

  const mockConfig: PerplexityConfig = {
    baseUrl: 'http://localhost:8090',
    apiKey: 'test-api-key',
    model: 'llama-3.1-70b-instruct',
    profile: 'personal',
    timeout: 30000
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock axios instance
    mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn(),
      defaults: {
        headers: {}
      }
    } as any;

    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    
    provider = new PerplexityProvider(mockConfig);
  });

  describe('Initialization', () => {
    test('should create provider with correct config', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://localhost:8090',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-api-key',
          'X-Profile': 'personal'
        }
      });
    });

    test('should work without API key', () => {
      const configWithoutKey: PerplexityConfig = {
        baseUrl: 'http://localhost:8090',
        model: 'llama-3.1-70b-instruct'
      };

      expect(() => new PerplexityProvider(configWithoutKey)).not.toThrow();
    });

    test('should use default profile when not specified', () => {
      const configWithoutProfile: PerplexityConfig = {
        baseUrl: 'http://localhost:8090',
        model: 'llama-3.1-70b-instruct'
      };

      new PerplexityProvider(configWithoutProfile);

      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Profile': 'personal'
          })
        })
      );
    });
  });

  describe('Provider Information', () => {
    test('should return correct provider name', () => {
      expect(provider.getProvider()).toBe('perplexity');
    });

    test('should return correct model name', () => {
      expect(provider.getModel()).toBe('llama-3.1-70b-instruct');
    });

    test('should return correct capabilities', () => {
      const capabilities = provider.getCapabilities();
      
      expect(capabilities.modalities).toEqual(['text']);
      expect(capabilities.maxContextSize).toBe(200000);
      expect(capabilities.streaming).toBe(true);
      expect(capabilities.functionCalling).toBe(true);
      expect(capabilities.vision).toBe(false);
      expect(capabilities.costTier).toBe('paid');
    });
  });

  describe('Profile Management', () => {
    test('should set profile', () => {
      provider.setProfile('work');
      
      expect(provider.getProfile()).toBe('work');
      expect(mockAxiosInstance.defaults.headers['X-Profile']).toBe('work');
    });

    test('should get current profile', () => {
      expect(provider.getProfile()).toBe('personal');
    });
  });

  describe('Availability', () => {
    test('should return true when health check succeeds', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: 'OK' });

      const isAvailable = await provider.isAvailable();

      expect(isAvailable).toBe(true);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/health');
    });

    test('should fallback to models endpoint for health check', async () => {
      // Health endpoint fails
      mockAxiosInstance.get
        .mockRejectedValueOnce(new Error('Health endpoint not found'))
        .mockResolvedValueOnce({ data: { data: [] } });

      const isAvailable = await provider.isAvailable();

      expect(isAvailable).toBe(true);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/health');
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v1/models');
    });

    test('should return false when all checks fail', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Connection failed'));

      const isAvailable = await provider.isAvailable();

      expect(isAvailable).toBe(false);
    });
  });

  describe('Generation', () => {
    test('should generate response from string prompt', async () => {
      const mockResponse = {
        data: {
          id: 'chat-123',
          object: 'chat.completion',
          created: Date.now(),
          model: 'llama-3.1-70b-instruct',
          choices: [{
            index: 0,
            message: {
              role: 'assistant' as const,
              content: 'Generated response'
            },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15
          }
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await provider.generate('Test prompt');

      expect(result.content).toBe('Generated response');
      expect(result.model).toBe('llama-3.1-70b-instruct');
      expect(result.usage.promptTokens).toBe(10);
      expect(result.usage.completionTokens).toBe(5);
      expect(result.usage.totalTokens).toBe(15);
      expect(result.metadata?.backend).toBe('perplexity');
      expect(result.finishReason).toBe('stop');
    });

    test('should generate response from chat messages', async () => {
      const mockResponse = {
        data: {
          id: 'chat-456',
          object: 'chat.completion',
          created: Date.now(),
          model: 'llama-3.1-70b-instruct',
          choices: [{
            index: 0,
            message: {
              role: 'assistant' as const,
              content: 'Chat response'
            },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: 15,
            completion_tokens: 8,
            total_tokens: 23
          }
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const messages = [
        { role: 'system' as const, content: 'You are helpful' },
        { role: 'user' as const, content: 'Hello' }
      ];

      const result = await provider.generate(messages);

      expect(result.content).toBe('Chat response');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/v1/chat/completions',
        expect.objectContaining({
          model: 'llama-3.1-70b-instruct',
          messages: [
            { role: 'system', content: 'You are helpful' },
            { role: 'user', content: 'Hello' }
          ]
        })
      );
    });

    test('should use custom options', async () => {
      const mockResponse = {
        data: {
          id: 'chat-789',
          object: 'chat.completion',
          created: Date.now(),
          model: 'custom-model',
          choices: [{
            index: 0,
            message: {
              role: 'assistant' as const,
              content: 'Custom response'
            },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: 20,
            completion_tokens: 10,
            total_tokens: 30
          }
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const options = {
        model: 'custom-model',
        temperature: 0.7,
        maxTokens: 100,
        topP: 0.9,
        stop: ['END'],
        presencePenalty: 0.1,
        frequencyPenalty: 0.1,
        role: 'architect',
        conversationId: 'conv-123'
      };

      const result = await provider.generate('Test', options);

      expect(result.model).toBe('custom-model');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/v1/chat/completions',
        expect.objectContaining({
          model: 'custom-model',
          temperature: 0.7,
          max_tokens: 100,
          top_p: 0.9,
          stop: ['END'],
          presence_penalty: 0.1,
          frequency_penalty: 0.1,
          role: 'architect',
          conversation_id: 'conv-123'
        })
      );
    });

    test('should include proxy metadata in response', async () => {
      const mockResponse = {
        data: {
          id: 'chat-123',
          object: 'chat.completion',
          created: Date.now(),
          model: 'llama-3.1-70b-instruct',
          choices: [{
            index: 0,
            message: {
              role: 'assistant' as const,
              content: 'Response with metadata'
            },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15
          },
          x_proxy_metadata: {
            backend: 'nanogpt',
            model_selected: 'llama-3.1-70b-instruct',
            original_prompt_length: 50,
            optimized_prompt_length: 30,
            prompt_engineer_time_ms: 150,
            strategy_used: 'architect_role',
            selection_reason: 'high_complexity_task'
          }
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await provider.generate('Test');

      expect(result.metadata?.backend).toBe('nanogpt');
      expect(result.metadata?.originalPromptLength).toBe(50);
      expect(result.metadata?.optimizedPromptLength).toBe(30);
      expect(result.metadata?.strategyUsed).toBe('architect_role');
      expect(result.metadata?.selectionReason).toBe('high_complexity_task');
    });
  });

  describe('Error Handling', () => {
    test('should throw LLMAuthenticationError for 401', async () => {
      const error = {
        response: {
          status: 401,
          data: { error: { message: 'Invalid API key' } }
        }
      };

      mockAxiosInstance.post.mockRejectedValue(error);
      mockedAxios.isAxiosError.mockReturnValue(true);

      await expect(provider.generate('Test')).rejects.toThrow(LLMAuthenticationError);
    });

    test('should throw LLMRateLimitError for 429', async () => {
      const error = {
        response: {
          status: 429,
          data: { error: { message: 'Rate limit exceeded' } }
        }
      };

      mockAxiosInstance.post.mockRejectedValue(error);
      mockedAxios.isAxiosError.mockReturnValue(true);

      await expect(provider.generate('Test')).rejects.toThrow(LLMRateLimitError);
    });

    test('should throw LLMUnavailableError for 404', async () => {
      const error = {
        response: {
          status: 404,
          data: { error: { message: 'Model not found' } }
        }
      };

      mockAxiosInstance.post.mockRejectedValue(error);
      mockedAxios.isAxiosError.mockReturnValue(true);

      await expect(provider.generate('Test')).rejects.toThrow(LLMUnavailableError);
    });

    test('should throw LLMUnavailableError for 503', async () => {
      const error = {
        response: {
          status: 503,
          data: { error: { message: 'Service unavailable' } }
        }
      };

      mockAxiosInstance.post.mockRejectedValue(error);
      mockedAxios.isAxiosError.mockReturnValue(true);

      await expect(provider.generate('Test')).rejects.toThrow(LLMUnavailableError);
    });

    test('should throw LLMUnavailableError for connection error', async () => {
      const error = {
        response: undefined
      };

      mockAxiosInstance.post.mockRejectedValue(error);
      mockedAxios.isAxiosError.mockReturnValue(true);

      await expect(provider.generate('Test')).rejects.toThrow(LLMUnavailableError);
    });

    test('should throw LLMProviderError for other errors', async () => {
      const error = {
        response: {
          status: 400,
          data: { error: { message: 'Bad request' } }
        }
      };

      mockAxiosInstance.post.mockRejectedValue(error);
      mockedAxios.isAxiosError.mockReturnValue(true);

      await expect(provider.generate('Test')).rejects.toThrow(LLMProviderError);
    });
  });

  describe('Model Management', () => {
    test('should get available models', async () => {
      const mockModelsResponse = {
        data: {
          data: [
            { id: 'llama-3.1-70b-instruct' },
            { id: 'llama-3.1-8b-instruct' },
            { id: 'mixtral-8x7b-instruct' }
          ]
        }
      };

      mockAxiosInstance.get.mockResolvedValue(mockModelsResponse);

      const models = await provider.getAvailableModels();

      expect(models).toEqual([
        'llama-3.1-70b-instruct',
        'llama-3.1-8b-instruct',
        'mixtral-8x7b-instruct'
      ]);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v1/models');
    });

    test('should handle model fetch error', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Network error'));

      await expect(provider.getAvailableModels()).rejects.toThrow(LLMProviderError);
    });
  });

  describe('Response Conversion', () => {
    test('should handle minimal response data', async () => {
      const mockResponse = {
        data: {
          id: 'chat-minimal',
          object: 'chat.completion',
          created: Date.now(),
          model: 'llama-3.1-70b-instruct',
          choices: [{
            index: 0,
            message: {
              role: 'assistant' as const,
              content: 'Minimal response'
            },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: 5,
            completion_tokens: 3,
            total_tokens: 8
          }
          // No x_proxy_metadata
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await provider.generate('Test');

      expect(result.content).toBe('Minimal response');
      expect(result.metadata?.backend).toBe('perplexity');
      expect(result.metadata?.selectionReason).toBe('perplexity_model');
    });
  });
});