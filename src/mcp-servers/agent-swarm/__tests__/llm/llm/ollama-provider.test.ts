/**
 * Tests for Ollama Provider
 */

import axios from 'axios';
import { AxiosInstance } from 'axios';
import { OllamaProvider, OllamaConfig } from '../../src/llm/ollama-provider.js';
import { LLMUnavailableError, LLMProviderError } from '../../src/llm/llm-provider.js';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Ollama Provider', () => {
  let provider: OllamaProvider;
  let mockAxiosInstance: jest.Mocked<AxiosInstance>;

  const mockConfig: OllamaConfig = {
    baseUrl: 'http://localhost:11434',
    model: 'llama2',
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
    
    provider = new OllamaProvider(mockConfig);
  });

  describe('Initialization', () => {
    test('should create provider with correct config', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://localhost:11434',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    });

    test('should use default timeout when not specified', () => {
      const configWithoutTimeout: OllamaConfig = {
        baseUrl: 'http://localhost:11434',
        model: 'llama2'
      };

      new OllamaProvider(configWithoutTimeout);

      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 60000
        })
      );
    });
  });

  describe('Provider Information', () => {
    test('should return correct provider name', () => {
      expect(provider.getProvider()).toBe('ollama');
    });

    test('should return correct model name', () => {
      expect(provider.getModel()).toBe('llama2');
    });

    test('should return correct capabilities', () => {
      const capabilities = provider.getCapabilities();
      
      expect(capabilities.modalities).toEqual(['text']);
      expect(capabilities.maxContextSize).toBe(128000);
      expect(capabilities.streaming).toBe(true);
      expect(capabilities.functionCalling).toBe(false);
      expect(capabilities.vision).toBe(false);
      expect(capabilities.costTier).toBe('free');
    });
  });

  describe('Availability', () => {
    test('should return true when health check succeeds', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { models: [] } });

      const isAvailable = await provider.isAvailable();

      expect(isAvailable).toBe(true);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/tags');
    });

    test('should return false when health check fails', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Connection failed'));

      const isAvailable = await provider.isAvailable();

      expect(isAvailable).toBe(false);
    });
  });

  describe('Generation', () => {
    test('should generate response from string prompt', async () => {
      const mockResponse = {
        data: {
          model: 'llama2',
          response: 'Generated response',
          done: true,
          prompt_eval_count: 10,
          eval_count: 5
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await provider.generate('Test prompt');

      expect(result.content).toBe('Generated response');
      expect(result.model).toBe('llama2');
      expect(result.usage.promptTokens).toBe(10);
      expect(result.usage.completionTokens).toBe(5);
      expect(result.usage.totalTokens).toBe(15);
      expect(result.metadata?.backend).toBe('ollama');
      expect(result.finishReason).toBe('stop');
    });

    test('should generate response from chat messages', async () => {
      const mockResponse = {
        data: {
          model: 'llama2',
          response: 'Chat response',
          done: true,
          prompt_eval_count: 15,
          eval_count: 8
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const messages = [
        { role: 'system' as const, content: 'You are helpful' },
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' },
        { role: 'user' as const, content: 'How are you?' }
      ];

      const result = await provider.generate(messages);

      expect(result.content).toBe('Chat response');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/generate',
        expect.objectContaining({
          model: 'llama2',
          prompt: 'Hello\nAssistant: Hi there!\nHow are you?',
          system: 'You are helpful'
        })
      );
    });

    test('should use custom options', async () => {
      const mockResponse = {
        data: {
          model: 'custom-model',
          response: 'Custom response',
          done: true,
          prompt_eval_count: 20,
          eval_count: 10
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const options = {
        model: 'custom-model',
        temperature: 0.7,
        maxTokens: 100,
        topP: 0.9,
        stop: ['END']
      };

      const result = await provider.generate('Test', options);

      expect(result.model).toBe('custom-model');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/generate',
        expect.objectContaining({
          model: 'custom-model',
          options: {
            temperature: 0.7,
            top_p: 0.9,
            num_predict: 100,
            stop: ['END']
          }
        })
      );
    });
  });

  describe('Error Handling', () => {
    test('should throw LLMUnavailableError for 404', async () => {
      const error = {
        response: {
          status: 404,
          data: { error: 'Model not found' }
        }
      };

      mockAxiosInstance.post.mockRejectedValue(error);
      mockedAxios.isAxiosError.mockReturnValue(true);

      await expect(provider.generate('Test')).rejects.toThrow(LLMUnavailableError);
    });

    test('should throw LLMUnavailableError for 500', async () => {
      const error = {
        response: {
          status: 500,
          data: { error: 'Server error' }
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
          data: { error: 'Bad request' }
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
          models: [
            { name: 'llama2' },
            { name: 'codellama' },
            { name: 'mistral' }
          ]
        }
      };

      mockAxiosInstance.get.mockResolvedValue(mockModelsResponse);

      const models = await provider.getAvailableModels();

      expect(models).toEqual(['llama2', 'codellama', 'mistral']);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/tags');
    });

    test('should handle model fetch error', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Network error'));

      await expect(provider.getAvailableModels()).rejects.toThrow(LLMProviderError);
    });

    test('should pull model', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: {} });

      await provider.pullModel('new-model');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/pull', {
        name: 'new-model'
      });
    });

    test('should handle model pull error', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('Pull failed'));

      await expect(provider.pullModel('new-model')).rejects.toThrow(LLMProviderError);
    });
  });

  describe('Response Conversion', () => {
    test('should handle partial response data', async () => {
      const mockResponse = {
        data: {
          model: 'llama2',
          response: 'Partial response',
          done: true
          // Missing token counts
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await provider.generate('Test');

      expect(result.content).toBe('Partial response');
      expect(result.usage.promptTokens).toBe(0);
      expect(result.usage.completionTokens).toBe(0);
      expect(result.usage.totalTokens).toBe(0);
    });

    test('should handle unfinished response', async () => {
      const mockResponse = {
        data: {
          model: 'llama2',
          response: 'Partial response',
          done: false,
          prompt_eval_count: 10,
          eval_count: 5
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await provider.generate('Test');

      expect(result.finishReason).toBe('length');
    });
  });
});