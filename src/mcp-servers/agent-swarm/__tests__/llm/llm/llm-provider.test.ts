/**
 * Tests for LLM Provider Base Interface
 */

import {
  LLMProvider,
  LLMProviderError,
  LLMUnavailableError,
  LLMRateLimitError,
  LLMAuthenticationError,
  ChatMessage,
  GenerateOptions,
  LLMResponse,
  ProviderCapabilities
} from '../../src/llm/llm-provider.js';

// Mock implementation for testing
class MockLLMProvider implements LLMProvider {
  constructor(
    private providerName: string,
    private modelName: string,
    private shouldFail: boolean = false,
    private errorType?: string
  ) {}

  async generate(
    prompt: string | ChatMessage[], 
    options?: GenerateOptions
  ): Promise<LLMResponse> {
    if (this.shouldFail) {
      switch (this.errorType) {
        case 'unavailable':
          throw new LLMUnavailableError(this.providerName);
        case 'rate_limit':
          throw new LLMRateLimitError(this.providerName);
        case 'auth':
          throw new LLMAuthenticationError(this.providerName);
        default:
          throw new LLMProviderError('Test error', this.providerName);
      }
    }

    return {
      content: 'Mock response',
      model: options?.model || this.modelName,
      usage: {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15
      },
      metadata: {
        backend: this.providerName,
        responseTimeMs: 100
      }
    };
  }

  getProvider(): string {
    return this.providerName;
  }

  getModel(): string {
    return this.modelName;
  }

  async isAvailable(): Promise<boolean> {
    return !this.shouldFail;
  }

  getCapabilities(): ProviderCapabilities {
    return {
      modalities: ['text'],
      maxContextSize: 4096,
      streaming: false,
      functionCalling: false,
      vision: false,
      costTier: 'free'
    };
  }
}

describe('LLM Provider Interface', () => {
  let provider: LLMProvider;

  beforeEach(() => {
    provider = new MockLLMProvider('test-provider', 'test-model');
  });

  describe('Basic functionality', () => {
    test('should generate response successfully', async () => {
      const response = await provider.generate('Test prompt');
      
      expect(response.content).toBe('Mock response');
      expect(response.model).toBe('test-model');
      expect(response.usage.totalTokens).toBe(15);
      expect(response.metadata?.backend).toBe('test-provider');
    });

    test('should handle chat messages', async () => {
      const messages: ChatMessage[] = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' }
      ];
      
      const response = await provider.generate(messages);
      
      expect(response.content).toBe('Mock response');
    });

    test('should use custom model option', async () => {
      const response = await provider.generate('Test', { model: 'custom-model' });
      
      expect(response.model).toBe('custom-model');
    });

    test('should return provider information', () => {
      expect(provider.getProvider()).toBe('test-provider');
      expect(provider.getModel()).toBe('test-model');
    });

    test('should return capabilities', () => {
      const capabilities = provider.getCapabilities();
      
      expect(capabilities.modalities).toContain('text');
      expect(capabilities.maxContextSize).toBe(4096);
      expect(capabilities.streaming).toBe(false);
      expect(capabilities.costTier).toBe('free');
    });
  });

  describe('Availability', () => {
    test('should report availability when healthy', async () => {
      const healthyProvider = new MockLLMProvider('healthy', 'model', false);
      
      const isAvailable = await healthyProvider.isAvailable();
      
      expect(isAvailable).toBe(true);
    });

    test('should report unavailability when unhealthy', async () => {
      const unhealthyProvider = new MockLLMProvider('unhealthy', 'model', true);
      
      const isAvailable = await unhealthyProvider.isAvailable();
      
      expect(isAvailable).toBe(false);
    });
  });
});

describe('LLM Provider Errors', () => {
  test('LLMProviderError should have correct properties', () => {
    const error = new LLMProviderError('Test message', 'test-provider', 'TEST_CODE', 500);
    
    expect(error.message).toBe('Test message');
    expect(error.provider).toBe('test-provider');
    expect(error.code).toBe('TEST_CODE');
    expect(error.statusCode).toBe(500);
    expect(error.name).toBe('LLMProviderError');
  });

  test('LLMUnavailableError should have correct properties', () => {
    const error = new LLMUnavailableError('test-provider', 'Custom message');
    
    expect(error.message).toBe('Custom message');
    expect(error.provider).toBe('test-provider');
    expect(error.code).toBe('UNAVAILABLE');
    expect(error.name).toBe('LLMUnavailableError');
  });

  test('LLMRateLimitError should have correct properties', () => {
    const error = new LLMRateLimitError('test-provider');
    
    expect(error.provider).toBe('test-provider');
    expect(error.code).toBe('RATE_LIMIT');
    expect(error.statusCode).toBe(429);
    expect(error.name).toBe('LLMRateLimitError');
  });

  test('LLMAuthenticationError should have correct properties', () => {
    const error = new LLMAuthenticationError('test-provider');
    
    expect(error.provider).toBe('test-provider');
    expect(error.code).toBe('AUTH');
    expect(error.statusCode).toBe(401);
    expect(error.name).toBe('LLMAuthenticationError');
  });
});

describe('Generate Options', () => {
  test('should accept all generate options', async () => {
    const options: GenerateOptions = {
      model: 'custom-model',
      temperature: 0.7,
      maxTokens: 100,
      topP: 0.9,
      stream: false,
      stop: ['END'],
      presencePenalty: 0.1,
      frequencyPenalty: 0.1,
      role: 'assistant',
      conversationId: 'conv-123'
    };

    const response = await mockLLMProvider.generate('Test', options);
    
    expect(response.model).toBe('custom-model');
    expect(response.content).toBe('Mock response');
  });
});