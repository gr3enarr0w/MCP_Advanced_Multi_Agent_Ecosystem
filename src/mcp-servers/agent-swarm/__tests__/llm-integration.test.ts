/**
 * LLM Provider Integration Tests
 * Tests for Ollama and Perplexity providers with mocking and real connectivity
 */

import axios from 'axios';
import AxiosMockAdapter from 'axios-mock-adapter';
import { config } from 'dotenv';

// Load test environment variables
config({ path: '../../../.env.test' });

import { OllamaProvider, OllamaConfig } from '../src/llm/ollama-provider';
import { PerplexityProvider, PerplexityConfig } from '../src/llm/perplexity-provider';
import {
  LLMProviderError,
  LLMUnavailableError,
  LLMAuthenticationError,
  LLMRateLimitError,
  GenerateOptions,
  ChatMessage
} from '../src/llm/llm-provider';

describe('LLM Provider Integration Tests', () => {
  let mock: AxiosMockAdapter;

  beforeEach(() => {
    mock = new AxiosMockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
  });

  describe('OllamaProvider', () => {
    const defaultConfig: OllamaConfig = {
      baseUrl: 'http://localhost:11434',
      model: 'llama2',
      timeout: 30000
    };

    it('should initialize with correct configuration', () => {
      const provider = new OllamaProvider(defaultConfig);
      
      expect(provider.getProvider()).toBe('ollama');
      expect(provider.getModel()).toBe('llama2');
    });

    it('should handle successful generation with string prompt', async () => {
      const provider = new OllamaProvider(defaultConfig);
      
      // Mock the models endpoint
      mock.onGet('http://localhost:11434/api/tags').reply(200, {
        models: [
          { name: 'llama2', size: 1234567890 }
        ]
      });

      // Mock the generate endpoint
      mock.onPost('http://localhost:11434/api/generate').reply(200, {
        model: 'llama2',
        created_at: '2023-11-01T00:00:00Z',
        response: 'This is a test response from Ollama',
        done: true,
        context: [1, 2, 3],
        total_duration: 1000000,
        load_duration: 100000,
        prompt_eval_count: 10,
        prompt_eval_duration: 500000,
        eval_count: 15,
        eval_duration: 400000
      });

      const result = await provider.generate('Test prompt');

      expect(result.content).toBe('This is a test response from Ollama');
      expect(result.model).toBe('llama2');
      expect(result.usage.promptTokens).toBe(10);
      expect(result.usage.completionTokens).toBe(15);
      expect(result.usage.totalTokens).toBe(25);
      expect(result.metadata?.backend).toBe('ollama');
      expect(result.finishReason).toBe('stop');
    });

    it('should handle successful generation with chat messages', async () => {
      const provider = new OllamaProvider(defaultConfig);
      
      mock.onGet('http://localhost:11434/api/tags').reply(200, {
        models: [{ name: 'llama2' }]
      });

      mock.onPost('http://localhost:11434/api/generate').reply(200, {
        model: 'llama2',
        response: 'Chat response',
        done: true,
        prompt_eval_count: 15,
        eval_count: 20
      });

      const messages: ChatMessage[] = [
        { role: 'system', content: 'You are a helpful assistant' },
        { role: 'user', content: 'Hello' }
      ];

      const result = await provider.generate(messages);

      expect(result.content).toBe('Chat response');
      expect(result.usage.totalTokens).toBe(35);
    });

    it('should handle generation with options', async () => {
      const provider = new OllamaProvider(defaultConfig);
      
      mock.onGet('http://localhost:11434/api/tags').reply(200, {
        models: [{ name: 'llama2' }]
      });

      mock.onPost('http://localhost:11434/api/generate').reply(200, {
        model: 'codellama',
        response: 'Code response',
        done: true,
        prompt_eval_count: 5,
        eval_count: 10
      });

      const options: GenerateOptions = {
        model: 'codellama',
        temperature: 0.7,
        maxTokens: 500,
        topP: 0.9,
        stop: ['\n', 'END']
      };

      const result = await provider.generate('Generate code', options);

      expect(result.model).toBe('codellama');
      
      // Verify the request was made with correct options
      const requestData = JSON.parse(mock.history.post[0].data);
      expect(requestData.options.temperature).toBe(0.7);
      expect(requestData.options.num_predict).toBe(500);
      expect(requestData.options.top_p).toBe(0.9);
      expect(requestData.options.stop).toEqual(['\n', 'END']);
    });

    it('should handle 404 model not found error', async () => {
      const provider = new OllamaProvider(defaultConfig);
      
      mock.onPost('http://localhost:11434/api/generate').reply(404, {
        error: 'Model not found'
      });

      await expect(provider.generate('Test')).rejects.toThrow(LLMUnavailableError);
    });

    it('should handle 500 server error', async () => {
      const provider = new OllamaProvider(defaultConfig);
      
      mock.onPost('http://localhost:11434/api/generate').reply(500, {
        error: 'Internal server error'
      });

      await expect(provider.generate('Test')).rejects.toThrow(LLMUnavailableError);
    });

    it('should handle connection error', async () => {
      const provider = new OllamaProvider(defaultConfig);
      
      mock.onPost('http://localhost:11434/api/generate').networkError();

      await expect(provider.generate('Test')).rejects.toThrow(LLMProviderError);
    });

    it('should check availability correctly', async () => {
      const provider = new OllamaProvider(defaultConfig);
      
      // Test successful health check
      mock.onGet('http://localhost:11434/api/tags').reply(200, {
        models: [{ name: 'llama2' }]
      });

      const isAvailable = await provider.isAvailable();
      expect(isAvailable).toBe(true);

      // Test failed health check
      mock.resetHistory();
      mock.onGet('http://localhost:11434/api/tags').reply(500);

      const isUnavailable = await provider.isAvailable();
      expect(isUnavailable).toBe(false);
    });

    it('should return correct capabilities', () => {
      const provider = new OllamaProvider(defaultConfig);
      const capabilities = provider.getCapabilities();

      expect(capabilities.modalities).toEqual(['text']);
      expect(capabilities.maxContextSize).toBe(128000);
      expect(capabilities.streaming).toBe(true);
      expect(capabilities.functionCalling).toBe(false);
      expect(capabilities.vision).toBe(false);
      expect(capabilities.costTier).toBe('free');
    });

    it('should fetch available models', async () => {
      const provider = new OllamaProvider(defaultConfig);
      
      mock.onGet('http://localhost:11434/api/tags').reply(200, {
        models: [
          { name: 'llama2', size: 1234567890 },
          { name: 'codellama', size: 987654321 }
        ]
      });

      const models = await provider.getAvailableModels();
      expect(models).toEqual(['llama2', 'codellama']);
    });

    it('should handle model fetching error', async () => {
      const provider = new OllamaProvider(defaultConfig);
      
      mock.onGet('http://localhost:11434/api/tags').reply(500);

      await expect(provider.getAvailableModels()).rejects.toThrow(LLMProviderError);
    });
  });

  describe('PerplexityProvider', () => {
    const defaultConfig: PerplexityConfig = {
      baseUrl: 'https://api.perplexity.ai',
      apiKey: 'test-api-key',
      model: 'sonar-pro',
      timeout: 30000
    };

    it('should initialize with correct configuration', () => {
      const provider = new PerplexityProvider(defaultConfig);
      
      expect(provider.getProvider()).toBe('perplexity');
      expect(provider.getModel()).toBe('sonar-pro');
      expect(provider.getProfile()).toBe('personal');
    });

    it('should handle successful generation with string prompt', async () => {
      const provider = new PerplexityProvider(defaultConfig);
      
      mock.onPost('https://api.perplexity.ai/v1/chat/completions').reply(200, {
        id: 'chat-123',
        object: 'chat.completion',
        created: 1698765432,
        model: 'sonar-pro',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'This is a test response from Perplexity'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 15,
          total_tokens: 25
        },
        x_proxy_metadata: {
          backend: 'perplexity',
          model_selected: 'sonar-pro',
          selection_reason: 'perplexity_model'
        }
      });

      const result = await provider.generate('Test prompt');

      expect(result.content).toBe('This is a test response from Perplexity');
      expect(result.model).toBe('sonar-pro');
      expect(result.usage.promptTokens).toBe(10);
      expect(result.usage.completionTokens).toBe(15);
      expect(result.usage.totalTokens).toBe(25);
      expect(result.metadata?.backend).toBe('perplexity');
      expect(result.finishReason).toBe('stop');
    });

    it('should handle successful generation with chat messages', async () => {
      const provider = new PerplexityProvider(defaultConfig);
      
      mock.onPost('https://api.perplexity.ai/v1/chat/completions').reply(200, {
        id: 'chat-456',
        model: 'sonar-pro',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Chat response with metadata'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 20,
          completion_tokens: 25,
          total_tokens: 45
        },
        x_proxy_metadata: {
          backend: 'perplexity',
          original_prompt_length: 100,
          optimized_prompt_length: 80,
          strategy_used: 'compression',
          selection_reason: 'optimized_prompt'
        }
      });

      const messages: ChatMessage[] = [
        { role: 'system', content: 'You are a helpful assistant' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' }
      ];

      const result = await provider.generate(messages);

      expect(result.content).toBe('Chat response with metadata');
      expect(result.metadata?.originalPromptLength).toBe(100);
      expect(result.metadata?.optimizedPromptLength).toBe(80);
      expect(result.metadata?.strategyUsed).toBe('compression');
    });

    it('should handle generation with all options', async () => {
      const provider = new PerplexityProvider(defaultConfig);
      
      mock.onPost('https://api.perplexity.ai/v1/chat/completions').reply(200, {
        id: 'chat-789',
        model: 'sonar-medium',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'Response with options' },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 15, completion_tokens: 20, total_tokens: 35 }
      });

      const options: GenerateOptions = {
        model: 'sonar-medium',
        temperature: 0.8,
        maxTokens: 1000,
        topP: 0.95,
        stop: ['END', 'STOP'],
        presencePenalty: 0.1,
        frequencyPenalty: 0.2,
        role: 'researcher',
        conversationId: 'conv-123'
      };

      const result = await provider.generate('Test with options', options);

      expect(result.model).toBe('sonar-medium');
      
      // Verify the request was made with correct options
      const requestData = JSON.parse(mock.history.post[0].data);
      expect(requestData.model).toBe('sonar-medium');
      expect(requestData.temperature).toBe(0.8);
      expect(requestData.max_tokens).toBe(1000);
      expect(requestData.top_p).toBe(0.95);
      expect(requestData.stop).toEqual(['END', 'STOP']);
      expect(requestData.presence_penalty).toBe(0.1);
      expect(requestData.frequency_penalty).toBe(0.2);
      expect(requestData.role).toBe('researcher');
      expect(requestData.conversation_id).toBe('conv-123');
    });

    it('should handle 401 authentication error', async () => {
      const provider = new PerplexityProvider(defaultConfig);
      
      mock.onPost('https://api.perplexity.ai/v1/chat/completions').reply(401, {
        error: { message: 'Invalid API key' }
      });

      await expect(provider.generate('Test')).rejects.toThrow(LLMAuthenticationError);
    });

    it('should handle 429 rate limit error', async () => {
      const provider = new PerplexityProvider(defaultConfig);
      
      mock.onPost('https://api.perplexity.ai/v1/chat/completions').reply(429, {
        error: { message: 'Rate limit exceeded' }
      });

      await expect(provider.generate('Test')).rejects.toThrow(LLMRateLimitError);
    });

    it('should handle 404 model not found error', async () => {
      const provider = new PerplexityProvider(defaultConfig);
      
      mock.onPost('https://api.perplexity.ai/v1/chat/completions').reply(404, {
        error: { message: 'Model not found' }
      });

      await expect(provider.generate('Test')).rejects.toThrow(LLMUnavailableError);
    });

    it('should handle 503 service unavailable error', async () => {
      const provider = new PerplexityProvider(defaultConfig);
      
      mock.onPost('https://api.perplexity.ai/v1/chat/completions').reply(503, {
        error: { message: 'Service temporarily unavailable' }
      });

      await expect(provider.generate('Test')).rejects.toThrow(LLMUnavailableError);
    });

    it('should handle connection error', async () => {
      const provider = new PerplexityProvider(defaultConfig);
      
      mock.onPost('https://api.perplexity.ai/v1/chat/completions').networkError();

      await expect(provider.generate('Test')).rejects.toThrow(LLMProviderError);
    });

    it('should check availability with health endpoint', async () => {
      const provider = new PerplexityProvider(defaultConfig);
      
      mock.onGet('https://api.perplexity.ai/health').reply(200);

      const isAvailable = await provider.isAvailable();
      expect(isAvailable).toBe(true);
    });

    it('should check availability with models endpoint fallback', async () => {
      const provider = new PerplexityProvider(defaultConfig);
      
      // Health endpoint fails, models endpoint succeeds
      mock.onGet('https://api.perplexity.ai/health').reply(404);
      mock.onGet('https://api.perplexity.ai/v1/models').reply(200, {
        data: [{ id: 'sonar-pro' }]
      });

      const isAvailable = await provider.isAvailable();
      expect(isAvailable).toBe(true);
    });

    it('should return false when both health endpoints fail', async () => {
      const provider = new PerplexityProvider(defaultConfig);
      
      mock.onGet('https://api.perplexity.ai/health').reply(404);
      mock.onGet('https://api.perplexity.ai/v1/models').reply(500);

      const isAvailable = await provider.isAvailable();
      expect(isAvailable).toBe(false);
    });

    it('should return correct capabilities', () => {
      const provider = new PerplexityProvider(defaultConfig);
      const capabilities = provider.getCapabilities();

      expect(capabilities.modalities).toEqual(['text']);
      expect(capabilities.maxContextSize).toBe(200000);
      expect(capabilities.streaming).toBe(true);
      expect(capabilities.functionCalling).toBe(true);
      expect(capabilities.vision).toBe(false);
      expect(capabilities.costTier).toBe('paid');
    });

    it('should fetch available models', async () => {
      const provider = new PerplexityProvider(defaultConfig);
      
      mock.onGet('https://api.perplexity.ai/v1/models').reply(200, {
        data: [
          { id: 'sonar-pro' },
          { id: 'sonar-medium' },
          { id: 'sonar-small' }
        ]
      });

      const models = await provider.getAvailableModels();
      expect(models).toEqual(['sonar-pro', 'sonar-medium', 'sonar-small']);
    });

    it('should handle models fetching error', async () => {
      const provider = new PerplexityProvider(defaultConfig);
      
      mock.onGet('https://api.perplexity.ai/v1/models').reply(500);

      await expect(provider.getAvailableModels()).rejects.toThrow(LLMProviderError);
    });

    it('should update and get profile', () => {
      const provider = new PerplexityProvider(defaultConfig);
      
      expect(provider.getProfile()).toBe('personal');
      
      provider.setProfile('work');
      expect(provider.getProfile()).toBe('work');
    });

    it('should handle custom headers', () => {
      const customConfig: PerplexityConfig = {
        ...defaultConfig,
        profile: 'work',
        headers: {
          'X-Custom-Header': 'custom-value'
        }
      };

      const provider = new PerplexityProvider(customConfig);
      expect(provider.getProfile()).toBe('work');
    });
  });

  describe('Provider Fallback Mechanisms', () => {
    it('should test Ollama fallback when primary fails', async () => {
      const provider = new OllamaProvider({
        baseUrl: 'http://localhost:11434',
        model: 'llama2'
      });

      // First call fails
      mock.onPost('http://localhost:11434/api/generate').replyOnce(500);
      
      // Second call succeeds
      mock.onPost('http://localhost:11434/api/generate').replyOnce(200, {
        model: 'llama2',
        response: 'Fallback response',
        done: true,
        prompt_eval_count: 5,
        eval_count: 10
      });

      // First call should fail
      await expect(provider.generate('Test')).rejects.toThrow();
      
      // Second call should succeed (simulating retry)
      const result = await provider.generate('Test retry');
      expect(result.content).toBe('Fallback response');
    });

    it('should test Perplexity fallback with different error types', async () => {
      const provider = new PerplexityProvider({
        baseUrl: 'https://api.perplexity.ai',
        apiKey: 'test-key',
        model: 'sonar-pro'
      });

      // Test different error scenarios
      const errorScenarios = [
        { status: 401, errorType: LLMAuthenticationError },
        { status: 429, errorType: LLMRateLimitError },
        { status: 404, errorType: LLMUnavailableError },
        { status: 503, errorType: LLMUnavailableError }
      ];

      for (const scenario of errorScenarios) {
        mock.resetHistory();
        mock.onPost('https://api.perplexity.ai/v1/chat/completions').reply(
          scenario.status,
          { error: { message: 'Test error' } }
        );

        await expect(provider.generate('Test')).rejects.toThrow(scenario.errorType);
      }
    });
  });

  describe('Streaming Response Handling', () => {
    it('should handle non-streaming responses correctly', async () => {
      const ollamaProvider = new OllamaProvider({
        baseUrl: 'http://localhost:11434',
        model: 'llama2'
      });

      const perplexityProvider = new PerplexityProvider({
        baseUrl: 'https://api.perplexity.ai',
        apiKey: 'test-key',
        model: 'sonar-pro'
      });

      // Mock Ollama response
      mock.onPost('http://localhost:11434/api/generate').reply(200, {
        model: 'llama2',
        response: 'Non-streaming response',
        done: true,
        prompt_eval_count: 5,
        eval_count: 10
      });

      // Mock Perplexity response
      mock.onPost('https://api.perplexity.ai/v1/chat/completions').reply(200, {
        id: 'chat-stream',
        model: 'sonar-pro',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'Non-streaming response' },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 }
      });

      const ollamaResult = await ollamaProvider.generate('Test', { stream: false });
      const perplexityResult = await perplexityProvider.generate('Test', { stream: false });

      expect(ollamaResult.content).toBe('Non-streaming response');
      expect(perplexityResult.content).toBe('Non-streaming response');
      
      // Both providers should handle stream=false by making non-streaming requests
      expect(ollamaResult.finishReason).toBe('stop');
      expect(perplexityResult.finishReason).toBe('stop');
    });
  });
});