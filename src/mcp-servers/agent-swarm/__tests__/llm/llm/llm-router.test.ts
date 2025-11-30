/**
 * Tests for LLM Router
 */

import { LLMRouter, RouterConfig, RoutingRule, TaskType, TaskComplexity } from '../../src/llm/llm-router.js';
import { OllamaProvider } from '../../src/llm/ollama-provider.js';
import { PerplexityProvider } from '../../src/llm/perplexity-provider.js';
import { LLMUnavailableError } from '../../src/llm/llm-provider.js';

// Mock providers
jest.mock('../../src/llm/ollama-provider.js');
jest.mock('../../src/llm/perplexity-provider.js');

const MockedOllamaProvider = OllamaProvider as jest.MockedClass<typeof OllamaProvider>;
const MockedPerplexityProvider = PerplexityProvider as jest.MockedClass<typeof PerplexityProvider>;

describe('LLM Router', () => {
  let router: LLMRouter;
  let mockOllamaProvider: jest.Mocked<OllamaProvider>;
  let mockPerplexityProvider: jest.Mocked<PerplexityProvider>;

  const mockConfig: RouterConfig = {
    defaultProvider: 'ollama',
    costOptimization: 'quality',
    fallbackProviders: ['perplexity'],
    providers: {
      ollama: {
        baseUrl: 'http://localhost:11434',
        model: 'llama2'
      },
      perplexity: {
        baseUrl: 'http://localhost:8090',
        model: 'llama-3.1-70b-instruct'
      }
    },
    rules: [
      {
        name: 'complex-tasks-to-perplexity',
        condition: {
          complexity: ['complex', 'critical']
        },
        provider: 'perplexity',
        priority: 10,
        reason: 'Complex tasks require powerful models'
      },
      {
        name: 'research-tasks-to-perplexity',
        condition: {
          taskTypes: ['research']
        },
        provider: 'perplexity',
        priority: 8,
        reason: 'Research tasks benefit from large context'
      },
      {
        name: 'simple-tasks-to-ollama',
        condition: {
          complexity: ['simple']
        },
        provider: 'ollama',
        priority: 5,
        reason: 'Simple tasks can use local models'
      }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock provider instances
    mockOllamaProvider = {
      generate: jest.fn(),
      getProvider: jest.fn().mockReturnValue('ollama'),
      getModel: jest.fn().mockReturnValue('llama2'),
      isAvailable: jest.fn().mockResolvedValue(true),
      getCapabilities: jest.fn().mockReturnValue({
        modalities: ['text'],
        maxContextSize: 128000,
        streaming: true,
        functionCalling: false,
        vision: false,
        costTier: 'free'
      })
    } as any;

    mockPerplexityProvider = {
      generate: jest.fn(),
      getProvider: jest.fn().mockReturnValue('perplexity'),
      getModel: jest.fn().mockReturnValue('llama-3.1-70b-instruct'),
      isAvailable: jest.fn().mockResolvedValue(true),
      getCapabilities: jest.fn().mockReturnValue({
        modalities: ['text'],
        maxContextSize: 200000,
        streaming: true,
        functionCalling: true,
        vision: false,
        costTier: 'paid'
      })
    } as any;

    MockedOllamaProvider.mockImplementation(() => mockOllamaProvider);
    MockedPerplexityProvider.mockImplementation(() => mockPerplexityProvider);

    router = new LLMRouter(mockConfig);
  });

  describe('Initialization', () => {
    test('should initialize with correct config', () => {
      expect(MockedOllamaProvider).toHaveBeenCalledWith(mockConfig.providers.ollama);
      expect(MockedPerplexityProvider).toHaveBeenCalledWith(mockConfig.providers.perplexity);
    });

    test('should get available providers', () => {
      const providers = router.getAvailableProviders();
      
      expect(providers).toContain('ollama');
      expect(providers).toContain('perplexity');
    });

    test('should get provider by name', () => {
      const ollama = router.getProvider('ollama');
      const perplexity = router.getProvider('perplexity');
      
      expect(ollama).toBe(mockOllamaProvider);
      expect(perplexity).toBe(mockPerplexityProvider);
    });
  });

  describe('Provider Selection', () => {
    test('should select default provider for simple task', async () => {
      const task = {
        type: 'generation' as TaskType,
        complexity: 'simple' as TaskComplexity,
        contextSize: 50,
        iteration: 1
      };

      const selection = await router.selectProvider(task);

      expect(selection.providerName).toBe('ollama');
      expect(selection.reason).toBe('Simple tasks can use local models');
      expect(selection.fallbackChain).toEqual(['ollama', 'perplexity']);
    });

    test('should select perplexity for complex task', async () => {
      const task = {
        type: 'generation' as TaskType,
        complexity: 'complex' as TaskComplexity,
        contextSize: 5000,
        iteration: 1
      };

      const selection = await router.selectProvider(task);

      expect(selection.providerName).toBe('perplexity');
      expect(selection.reason).toBe('Complex tasks require powerful models');
    });

    test('should select perplexity for research task', async () => {
      const task = {
        type: 'research' as TaskType,
        complexity: 'medium' as TaskComplexity,
        contextSize: 2000,
        iteration: 1
      };

      const selection = await router.selectProvider(task);

      expect(selection.providerName).toBe('perplexity');
      expect(selection.reason).toBe('Research tasks benefit from large context');
    });

    test('should fallback when primary provider unavailable', async () => {
      mockOllamaProvider.isAvailable.mockResolvedValue(false);
      
      const task = {
        type: 'generation' as TaskType,
        complexity: 'simple' as TaskComplexity,
        contextSize: 50,
        iteration: 1
      };

      const selection = await router.selectProvider(task);

      expect(selection.providerName).toBe('perplexity');
      expect(selection.reason).toBe('Fallback from ollama to perplexity');
    });

    test('should throw error when no providers available', async () => {
      mockOllamaProvider.isAvailable.mockResolvedValue(false);
      mockPerplexityProvider.isAvailable.mockResolvedValue(false);
      
      const task = {
        type: 'generation' as TaskType,
        complexity: 'simple' as TaskComplexity,
        contextSize: 50,
        iteration: 1
      };

      await expect(router.selectProvider(task)).rejects.toThrow(LLMUnavailableError);
    });
  });

  describe('Generation with Routing', () => {
    test('should generate using selected provider', async () => {
      const mockResponse = {
        content: 'Generated response',
        model: 'llama2',
        usage: {
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15
        },
        metadata: {
          backend: 'ollama',
          responseTimeMs: 100
        }
      };

      mockOllamaProvider.generate.mockResolvedValue(mockResponse);

      const result = await router.generate('Test prompt');

      expect(result.content).toBe('Generated response');
      expect(mockOllamaProvider.generate).toHaveBeenCalledWith(
        'Test prompt',
        undefined
      );
      expect(result.metadata?.selectionReason).toBe('Simple tasks can use local models');
    });

    test('should use task characteristics when provided', async () => {
      const mockResponse = {
        content: 'Complex response',
        model: 'llama-3.1-70b-instruct',
        usage: {
          promptTokens: 50,
          completionTokens: 25,
          totalTokens: 75
        },
        metadata: {
          backend: 'perplexity',
          responseTimeMs: 200
        }
      };

      mockPerplexityProvider.generate.mockResolvedValue(mockResponse);

      const task = {
        type: 'research' as TaskType,
        complexity: 'complex' as TaskComplexity,
        contextSize: 3000,
        iteration: 1,
        agentRole: 'researcher'
      };

      const result = await router.generate('Research prompt', {
        temperature: 0.7,
        task
      });

      expect(result.content).toBe('Complex response');
      expect(mockPerplexityProvider.generate).toHaveBeenCalledWith(
        'Research prompt',
        expect.objectContaining({
          temperature: 0.7,
          role: 'researcher'
        })
      );
    });

    test('should fallback on generation failure', async () => {
      const ollamaError = new Error('Ollama failed');
      const perplexityResponse = {
        content: 'Fallback response',
        model: 'llama-3.1-70b-instruct',
        usage: {
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15
        },
        metadata: {
          backend: 'perplexity',
          responseTimeMs: 150
        }
      };

      mockOllamaProvider.generate.mockRejectedValue(ollamaError);
      mockPerplexityProvider.generate.mockResolvedValue(perplexityResponse);

      const result = await router.generate('Test prompt');

      expect(result.content).toBe('Fallback response');
      expect(result.metadata?.selectionReason).toBe('Fallback from ollama to perplexity');
    });

    test('should throw error when all providers fail', async () => {
      const ollamaError = new Error('Ollama failed');
      const perplexityError = new Error('Perplexity failed');

      mockOllamaProvider.generate.mockRejectedValue(ollamaError);
      mockPerplexityProvider.generate.mockRejectedValue(perplexityError);

      await expect(router.generate('Test prompt')).rejects.toThrow('All providers failed');
    });
  });

  describe('Task Characteristic Estimation', () => {
    test('should estimate simple task from short prompt', async () => {
      const mockResponse = {
        content: 'Response',
        model: 'llama2',
        usage: { promptTokens: 5, completionTokens: 3, totalTokens: 8 },
        metadata: { backend: 'ollama', responseTimeMs: 50 }
      };

      mockOllamaProvider.generate.mockResolvedValue(mockResponse);

      await router.generate('Short prompt');

      expect(mockOllamaProvider.generate).toHaveBeenCalledWith(
        'Short prompt',
        expect.objectContaining({
          task: expect.objectContaining({
            complexity: 'simple',
            contextSize: expect.any(Number)
          })
        })
      );
    });

    test('should estimate complex task from long prompt', async () => {
      const longPrompt = 'A'.repeat(2000); // ~500 tokens
      
      const mockResponse = {
        content: 'Response',
        model: 'llama2',
        usage: { promptTokens: 500, completionTokens: 200, totalTokens: 700 },
        metadata: { backend: 'ollama', responseTimeMs: 200 }
      };

      mockOllamaProvider.generate.mockResolvedValue(mockResponse);

      await router.generate(longPrompt);

      expect(mockOllamaProvider.generate).toHaveBeenCalledWith(
        longPrompt,
        expect.objectContaining({
          task: expect.objectContaining({
            complexity: 'complex'
          })
        })
      );
    });

    test('should estimate task type from prompt content', async () => {
      const mockResponse = {
        content: 'Response',
        model: 'llama2',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        metadata: { backend: 'ollama', responseTimeMs: 100 }
      };

      mockOllamaProvider.generate.mockResolvedValue(mockResponse);

      // Test different task types
      await router.generate('Debug this error');
      await router.generate('Summarize this text');
      await router.generate('Analyze the data');
      await router.generate('Research the topic');
      await router.generate('Plan the project');
      await router.generate('Review the code');
      await router.generate('Write documentation');
      await router.generate('Generate code');

      // Verify the calls included task type estimation
      expect(mockOllamaProvider.generate).toHaveBeenCalledTimes(8);
    });

    test('should estimate critical complexity for architect role', async () => {
      const mockResponse = {
        content: 'Response',
        model: 'llama2',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        metadata: { backend: 'ollama', responseTimeMs: 100 }
      };

      mockOllamaProvider.generate.mockResolvedValue(mockResponse);

      await router.generate('Test', { role: 'architect' });

      expect(mockOllamaProvider.generate).toHaveBeenCalledWith(
        'Test',
        expect.objectContaining({
          role: 'architect',
          task: expect.objectContaining({
            complexity: 'critical'
          })
        })
      );
    });
  });

  describe('Rule Matching', () => {
    test('should match rules by priority', async () => {
      // Create config with conflicting rules to test priority
      const configWithPriority: RouterConfig = {
        ...mockConfig,
        rules: [
          {
            name: 'low-priority',
            condition: { taskTypes: ['generation'] },
            provider: 'ollama',
            priority: 1,
            reason: 'Low priority rule'
          },
          {
            name: 'high-priority',
            condition: { complexity: ['simple'] },
            provider: 'perplexity',
            priority: 10,
            reason: 'High priority rule'
          }
        ]
      };

      const priorityRouter = new LLMRouter(configWithPriority);

      const task = {
        type: 'generation' as TaskType,
        complexity: 'simple' as TaskComplexity,
        contextSize: 50,
        iteration: 1
      };

      const selection = await priorityRouter.selectProvider(task);

      // High priority rule should match despite low priority rule also matching
      expect(selection.providerName).toBe('perplexity');
      expect(selection.reason).toBe('High priority rule');
    });

    test('should match multiple conditions', async () => {
      const configWithComplexRule: RouterConfig = {
        ...mockConfig,
        rules: [
          {
            name: 'multi-condition',
            condition: {
              taskTypes: ['research'],
              complexity: ['complex'],
              contextSize: { min: 1000 },
              iteration: { max: 3 },
              agentRole: ['researcher']
            },
            provider: 'perplexity',
            priority: 10,
            reason: 'Multiple conditions match'
          }
        ]
      };

      const complexRouter = new LLMRouter(configWithComplexRule);

      const task = {
        type: 'research' as TaskType,
        complexity: 'complex' as TaskComplexity,
        contextSize: 2000,
        iteration: 2,
        agentRole: 'researcher'
      };

      const selection = await complexRouter.selectProvider(task);

      expect(selection.providerName).toBe('perplexity');
      expect(selection.reason).toBe('Multiple conditions match');
    });

    test('should not match when conditions fail', async () => {
      const configWithStrictRule: RouterConfig = {
        ...mockConfig,
        rules: [
          {
            name: 'strict-rule',
            condition: {
              taskTypes: ['research'],
              complexity: ['complex']
            },
            provider: 'perplexity',
            priority: 10,
            reason: 'Strict rule'
          }
        ]
      };

      const strictRouter = new LLMRouter(configWithStrictRule);

      // Task doesn't match complexity condition
      const task = {
        type: 'research' as TaskType,
        complexity: 'simple' as TaskComplexity,
        contextSize: 500,
        iteration: 1
      };

      const selection = await strictRouter.selectProvider(task);

      // Should fall back to default provider
      expect(selection.providerName).toBe('ollama');
    });
  });

  describe('Health Management', () => {
    test('should check provider health', async () => {
      const healthMap = await router.getProviderHealth();

      expect(mockOllamaProvider.isAvailable).toHaveBeenCalled();
      expect(mockPerplexityProvider.isAvailable).toHaveBeenCalled();
      expect(healthMap.size).toBe(2);
    });

    test('should cache health status', async () => {
      // First call should check health
      await router.getProviderHealth();
      
      // Second call within cache window should not check again
      jest.clearAllMocks();
      await router.getProviderHealth();
      
      expect(mockOllamaProvider.isAvailable).not.toHaveBeenCalled();
      expect(mockPerplexityProvider.isAvailable).not.toHaveBeenCalled();
    });
  });
});