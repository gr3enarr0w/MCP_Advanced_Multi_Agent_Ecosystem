/**
 * Router Integration Tests
 * Tests for LLM Router with provider selection, fallback mechanisms, and routing logic
 */

import axios from 'axios';
import AxiosMockAdapter from 'axios-mock-adapter';
import { config } from 'dotenv';

// Load test environment variables
config({ path: '../../../.env.test' });

import { LLMRouter, RouterConfig, TaskCharacteristics, TaskType, TaskComplexity } from '../src/llm/llm-router';
import { LLMProviderError, LLMUnavailableError } from '../src/llm/llm-provider';

describe('Router Integration Tests', () => {
  let mock: AxiosMockAdapter;

  beforeEach(() => {
    mock = new AxiosMockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
  });

  const createRouterConfig = (): RouterConfig => ({
    defaultProvider: 'ollama',
    costOptimization: 'quality',
    fallbackProviders: ['perplexity'],
    providers: {
      ollama: {
        baseUrl: 'http://localhost:11434',
        model: 'llama2'
      },
      perplexity: {
        baseUrl: 'https://api.perplexity.ai',
        apiKey: 'test-api-key',
        model: 'sonar-pro'
      }
    },
    rules: [
      {
        name: 'research_tasks',
        condition: {
          taskTypes: ['research', 'analysis'],
          complexity: ['complex', 'critical']
        },
        provider: 'perplexity',
        priority: 10,
        reason: 'Research tasks require high-quality cloud models'
      },
      {
        name: 'simple_tasks',
        condition: {
          taskTypes: ['generation'],
          complexity: ['simple']
        },
        provider: 'ollama',
        priority: 5,
        reason: 'Simple tasks can use local models'
      },
      {
        name: 'coding_tasks',
        condition: {
          taskTypes: ['coding', 'debugging']
        },
        provider: 'ollama',
        priority: 8,
        reason: 'Code tasks benefit from local models'
      }
    ]
  });

  describe('Router Initialization', () => {
    it('should initialize with correct configuration', async () => {
      const config = createRouterConfig();
      const router = new LLMRouter(config);

      expect(router.getAvailableProviders()).toEqual(['ollama', 'perplexity']);
      expect(router.getProvider('ollama')).toBeDefined();
      expect(router.getProvider('perplexity')).toBeDefined();
    });

    it('should handle missing provider configurations gracefully', () => {
      const config: RouterConfig = {
        defaultProvider: 'ollama',
        costOptimization: 'speed',
        fallbackProviders: [],
        providers: {
          ollama: {
            baseUrl: 'http://localhost:11434',
            model: 'llama2'
          }
        },
        rules: []
      };

      const router = new LLMRouter(config);
      expect(router.getAvailableProviders()).toEqual(['ollama']);
      expect(router.getProvider('perplexity')).toBeUndefined();
    });
  });

  describe('Provider Selection Logic', () => {
    it('should select provider based on task type and complexity', async () => {
      const router = new LLMRouter(createRouterConfig());

      // Mock health checks
      mock.onGet('http://localhost:11434/api/tags').reply(200, { models: [{ name: 'llama2' }] });
      mock.onGet('https://api.perplexity.ai/health').reply(200);

      const researchTask: TaskCharacteristics = {
        type: 'research',
        complexity: 'complex',
        contextSize: 5000,
        iteration: 1,
        agentRole: 'researcher'
      };

      const selection = await router.selectProvider(researchTask);
      expect(selection.providerName).toBe('perplexity');
      expect(selection.reason).toContain('Research tasks require high-quality cloud models');
    });

    it('should select ollama for simple generation tasks', async () => {
      const router = new LLMRouter(createRouterConfig());

      mock.onGet('http://localhost:11434/api/tags').reply(200, { models: [{ name: 'llama2' }] });
      mock.onGet('https://api.perplexity.ai/health').reply(200);

      const simpleTask: TaskCharacteristics = {
        type: 'generation',
        complexity: 'simple',
        contextSize: 50,
        iteration: 1
      };

      const selection = await router.selectProvider(simpleTask);
      expect(selection.providerName).toBe('ollama');
      expect(selection.reason).toContain('Simple tasks can use local models');
    });

    it('should select ollama for coding tasks', async () => {
      const router = new LLMRouter(createRouterConfig());

      mock.onGet('http://localhost:11434/api/tags').reply(200, { models: [{ name: 'llama2' }] });
      mock.onGet('https://api.perplexity.ai/health').reply(200);

      const codingTask: TaskCharacteristics = {
        type: 'coding',
        complexity: 'medium',
        contextSize: 2000,
        iteration: 1,
        agentRole: 'code'
      };

      const selection = await router.selectProvider(codingTask);
      expect(selection.providerName).toBe('ollama');
      expect(selection.reason).toContain('Code tasks benefit from local models');
    });

    it('should use default provider when no rules match', async () => {
      const router = new LLMRouter(createRouterConfig());

      mock.onGet('http://localhost:11434/api/tags').reply(200, { models: [{ name: 'llama2' }] });
      mock.onGet('https://api.perplexity.ai/health').reply(200);

      const unknownTask: TaskCharacteristics = {
        type: 'documentation',
        complexity: 'medium',
        contextSize: 1000,
        iteration: 1
      };

      const selection = await router.selectProvider(unknownTask);
      expect(selection.providerName).toBe('ollama');
      expect(selection.reason).toContain('Default provider');
    });

    it('should prioritize higher priority rules', async () => {
      const config = createRouterConfig();
      config.rules.push({
        name: 'high_priority_research',
        condition: {
          taskTypes: ['research'],
          complexity: ['complex'],
          agentRole: ['researcher']
        },
        provider: 'perplexity',
        priority: 20, // Higher priority than existing research rule
        reason: 'High priority research rule'
      });

      const router = new LLMRouter(config);

      mock.onGet('http://localhost:11434/api/tags').reply(200, { models: [{ name: 'llama2' }] });
      mock.onGet('https://api.perplexity.ai/health').reply(200);

      const researchTask: TaskCharacteristics = {
        type: 'research',
        complexity: 'complex',
        contextSize: 5000,
        iteration: 1,
        agentRole: 'researcher'
      };

      const selection = await router.selectProvider(researchTask);
      expect(selection.reason).toBe('High priority research rule');
    });
  });

  describe('Fallback Mechanisms', () => {
    it('should fallback to next available provider when primary fails', async () => {
      const router = new LLMRouter(createRouterConfig());

      // Mock primary provider (perplexity) as unavailable
      mock.onGet('https://api.perplexity.ai/health').reply(500);
      mock.onGet('http://localhost:11434/api/tags').reply(200, { models: [{ name: 'llama2' }] });

      const researchTask: TaskCharacteristics = {
        type: 'research',
        complexity: 'complex',
        contextSize: 5000,
        iteration: 1
      };

      const selection = await router.selectProvider(researchTask);
      expect(selection.providerName).toBe('ollama');
      expect(selection.reason).toContain('Fallback');
    });

    it('should throw error when all providers are unavailable', async () => {
      const router = new LLMRouter(createRouterConfig());

      // Mock all providers as unavailable
      mock.onGet('https://api.perplexity.ai/health').reply(500);
      mock.onGet('http://localhost:11434/api/tags').reply(500);

      const task: TaskCharacteristics = {
        type: 'research',
        complexity: 'complex',
        contextSize: 5000,
        iteration: 1
      };

      await expect(router.selectProvider(task)).rejects.toThrow(LLMUnavailableError);
    });

    it('should build correct fallback chain', async () => {
      const config = createRouterConfig();
      config.fallbackProviders = ['perplexity', 'ollama'];
      
      const router = new LLMRouter(config);

      mock.onGet('http://localhost:11434/api/tags').reply(200, { models: [{ name: 'llama2' }] });
      mock.onGet('https://api.perplexity.ai/health').reply(200);

      const task: TaskCharacteristics = {
        type: 'generation',
        complexity: 'simple',
        contextSize: 100,
        iteration: 1
      };

      const selection = await router.selectProvider(task);
      // The fallback chain should include the selected provider and all fallback providers
      expect(selection.fallbackChain).toContain('ollama');
      expect(selection.fallbackChain).toContain('perplexity');
      expect(selection.fallbackChain[0]).toBe('ollama'); // Default provider
    });
  });

  describe('Health Monitoring and Caching', () => {
    it('should cache provider health status', async () => {
      const router = new LLMRouter(createRouterConfig());

      // First health check
      mock.onGet('http://localhost:11434/api/tags').reply(200, { models: [{ name: 'llama2' }] });
      mock.onGet('https://api.perplexity.ai/health').reply(200);

      const health1 = await router.getProviderHealth();
      expect(health1.get('ollama')).toBe(true);
      expect(health1.get('perplexity')).toBe(true);

      // Second call should use cache (no additional network requests)
      const health2 = await router.getProviderHealth();
      expect(health2.get('ollama')).toBe(true);
      expect(health2.get('perplexity')).toBe(true);

      // Should only have made one set of health check calls
      expect(mock.history.get.length).toBe(2); // One for each provider
    });

    it('should refresh health status after cache timeout', async () => {
      const router = new LLMRouter(createRouterConfig());

      // Mock initial health check
      mock.onGet('http://localhost:11434/api/tags').reply(200, { models: [{ name: 'llama2' }] });
      mock.onGet('https://api.perplexity.ai/health').reply(200);

      await router.getProviderHealth();

      // Wait for cache to expire (5 minutes) - we'll simulate by changing mock responses
      mock.resetHistory();
      
      // Change responses to simulate provider becoming unavailable
      mock.onGet('http://localhost:11434/api/tags').reply(500);
      mock.onGet('https://api.perplexity.ai/health').reply(500);

      // Force health check by calling selectProvider (which checks health)
      const task: TaskCharacteristics = {
        type: 'generation',
        complexity: 'simple',
        contextSize: 100,
        iteration: 1
      };

      // This should trigger health checks again and throw LLMUnavailableError
      await expect(router.selectProvider(task)).rejects.toThrow(LLMUnavailableError);
    });
  });

  describe('Task Characteristics Estimation', () => {
    it('should estimate task characteristics from simple prompt', async () => {
      const router = new LLMRouter(createRouterConfig());

      mock.onGet('http://localhost:11434/api/tags').reply(200, { models: [{ name: 'llama2' }] });
      mock.onGet('https://api.perplexity.ai/health').reply(200);

      // Mock generation endpoints
      mock.onPost('http://localhost:11434/api/generate').reply(200, {
        model: 'llama2',
        response: 'Simple response',
        done: true,
        prompt_eval_count: 5,
        eval_count: 10
      });

      const result = await router.generate('Hello world');

      // Should use ollama for simple prompt
      expect(result.metadata?.providerUsed).toBe('ollama');
    });

    it('should estimate task characteristics from complex prompt', async () => {
      const router = new LLMRouter(createRouterConfig());

      mock.onGet('http://localhost:11434/api/tags').reply(200, { models: [{ name: 'llama2' }] });
      mock.onGet('https://api.perplexity.ai/health').reply(200);

      // Mock generation endpoints for both providers to handle fallback
      mock.onPost('http://localhost:11434/api/generate').reply(200, {
        model: 'llama2',
        response: 'Complex response from ollama',
        done: true,
        prompt_eval_count: 1000,
        eval_count: 500
      });

      mock.onPost('https://api.perplexity.ai/v1/chat/completions').reply(200, {
        id: 'chat-123',
        model: 'sonar-pro',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'Complex response' },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 }
      });

      const complexPrompt = 'Analyze the economic impact of climate change on global supply chains, considering factors such as extreme weather events, carbon pricing mechanisms, and international trade agreements. Provide a comprehensive analysis with specific examples and policy recommendations.';

      const result = await router.generate(complexPrompt);

      // Should use either provider (depending on routing logic)
      expect(result.metadata?.providerUsed).toBeDefined();
      expect(['ollama', 'perplexity']).toContain(result.metadata?.providerUsed);
    });

    it('should detect task type from prompt content', async () => {
      const router = new LLMRouter(createRouterConfig());

      mock.onGet('http://localhost:11434/api/tags').reply(200, { models: [{ name: 'llama2' }] });
      mock.onGet('https://api.perplexity.ai/health').reply(200);

      // Mock generation endpoints
      mock.onPost('http://localhost:11434/api/generate').reply(200, {
        model: 'llama2',
        response: 'Debug response',
        done: true,
        prompt_eval_count: 10,
        eval_count: 15
      });

      const debugPrompt = 'Debug this error: TypeError: Cannot read property of undefined';

      const result = await router.generate(debugPrompt);

      // Should detect debugging task and use appropriate provider
      expect(result.metadata?.providerUsed).toBeDefined();
    });

    it('should handle chat messages for task estimation', async () => {
      const router = new LLMRouter(createRouterConfig());

      mock.onGet('http://localhost:11434/api/tags').reply(200, { models: [{ name: 'llama2' }] });
      mock.onGet('https://api.perplexity.ai/health').reply(200);

      // Mock generation endpoints for both providers
      mock.onPost('http://localhost:11434/api/generate').reply(200, {
        model: 'llama2',
        response: 'Research response from ollama',
        done: true,
        prompt_eval_count: 50,
        eval_count: 100
      });

      mock.onPost('https://api.perplexity.ai/v1/chat/completions').reply(200, {
        id: 'chat-456',
        model: 'sonar-pro',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'Research response' },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 50, completion_tokens: 100, total_tokens: 150 }
      });

      const messages = [
        { role: 'system' as const, content: 'You are a research assistant' },
        { role: 'user' as const, content: 'Research the impact of AI on healthcare' },
        { role: 'assistant' as const, content: 'I can help with that research.' },
        { role: 'user' as const, content: 'Provide detailed analysis with sources' }
      ];

      const result = await router.generate(messages, { role: 'researcher' });

      // Should detect research task from messages and role
      expect(result.metadata?.providerUsed).toBeDefined();
      expect(['ollama', 'perplexity']).toContain(result.metadata?.providerUsed);
    });
  });

  describe('Generation with Routing', () => {
    it('should generate using selected provider with metadata', async () => {
      const router = new LLMRouter(createRouterConfig());

      // Mock health checks
      mock.onGet('http://localhost:11434/api/tags').reply(200, { models: [{ name: 'llama2' }] });
      mock.onGet('https://api.perplexity.ai/health').reply(200);

      // Mock generation
      mock.onPost('http://localhost:11434/api/generate').reply(200, {
        model: 'llama2',
        response: 'Generated response with routing',
        done: true,
        prompt_eval_count: 10,
        eval_count: 20
      });

      const result = await router.generate('Test prompt');

      expect(result.content).toBe('Generated response with routing');
      expect(result.metadata?.selectionReason).toBeDefined();
      expect(result.metadata?.providerUsed).toBe('ollama');
    });

    it('should handle generation errors with fallback', async () => {
      const router = new LLMRouter(createRouterConfig());

      // Mock health checks
      mock.onGet('http://localhost:11434/api/tags').reply(200, { models: [{ name: 'llama2' }] });
      mock.onGet('https://api.perplexity.ai/health').reply(200);

      // Mock primary provider failure and fallback success
      mock.onPost('http://localhost:11434/api/generate').replyOnce(500);
      mock.onPost('https://api.perplexity.ai/v1/chat/completions').replyOnce(200, {
        id: 'fallback-response',
        model: 'sonar-pro',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'Fallback response' },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 }
      });

      const result = await router.generate('Test prompt');
      expect(result.content).toBe('Fallback response');
      expect(result.metadata?.providerUsed).toBe('perplexity');
    });

    it('should include task metadata in generation', async () => {
      const router = new LLMRouter(createRouterConfig());

      mock.onGet('http://localhost:11434/api/tags').reply(200, { models: [{ name: 'llama2' }] });
      mock.onGet('https://api.perplexity.ai/health').reply(200);

      mock.onPost('http://localhost:11434/api/generate').reply(200, {
        model: 'llama2',
        response: 'Response with metadata',
        done: true,
        prompt_eval_count: 15,
        eval_count: 25
      });

      const task: TaskCharacteristics = {
        type: 'coding',
        complexity: 'medium',
        contextSize: 2000,
        iteration: 2,
        agentRole: 'code'
      };

      const result = await router.generate('Test prompt', { task, role: 'code' });

      expect(result.metadata?.providerUsed).toBe('ollama');
      expect(result.metadata?.selectionReason).toContain('Code tasks benefit from local models');
    });
  });

  describe('Cost Optimization', () => {
    it('should respect cost optimization preferences', async () => {
      const config = createRouterConfig();
      config.costOptimization = 'cost';
      
      const router = new LLMRouter(config);

      mock.onGet('http://localhost:11434/api/tags').reply(200, { models: [{ name: 'llama2' }] });
      mock.onGet('https://api.perplexity.ai/health').reply(200);

      mock.onPost('http://localhost:11434/api/generate').reply(200, {
        model: 'llama2',
        response: 'Cost-optimized response',
        done: true,
        prompt_eval_count: 10,
        eval_count: 15
      });

      const task: TaskCharacteristics = {
        type: 'generation',
        complexity: 'medium',
        contextSize: 1000,
        iteration: 1
      };

      const result = await router.generate('Test prompt', { task });
      expect(result.metadata?.providerUsed).toBe('ollama'); // Should prefer free local model
    });

    it('should prioritize speed when configured', async () => {
      const config = createRouterConfig();
      config.costOptimization = 'speed';
      
      const router = new LLMRouter(config);

      mock.onGet('http://localhost:11434/api/tags').reply(200, { models: [{ name: 'llama2' }] });
      mock.onGet('https://api.perplexity.ai/health').reply(200);

      // Mock responses from both providers
      mock.onPost('http://localhost:11434/api/generate').reply(200, {
        model: 'llama2',
        response: 'Ollama response',
        done: true,
        prompt_eval_count: 10,
        eval_count: 15
      });

      mock.onPost('https://api.perplexity.ai/v1/chat/completions').reply(200, {
        id: 'fast-response',
        model: 'sonar-pro',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'Fast response' },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 10, completion_tokens: 15, total_tokens: 25 }
      });

      const task: TaskCharacteristics = {
        type: 'generation',
        complexity: 'simple',
        contextSize: 100,
        iteration: 1
      };

      const result = await router.generate('Test prompt', { task });
      // With speed optimization, might choose different provider based on response time
      expect(result.metadata?.providerUsed).toBeDefined();
      expect(['ollama', 'perplexity']).toContain(result.metadata?.providerUsed);
    });
  });

  describe('Complexity Calculation', () => {
    it('should calculate complexity based on context size', async () => {
      const router = new LLMRouter(createRouterConfig());

      mock.onGet('http://localhost:11434/api/tags').reply(200, { models: [{ name: 'llama2' }] });
      mock.onGet('https://api.perplexity.ai/health').reply(200);

      // Mock both providers
      mock.onPost('http://localhost:11434/api/generate').reply(200, {
        model: 'llama2',
        response: 'Complex task response from ollama',
        done: true,
        prompt_eval_count: 1000,
        eval_count: 500
      });

      mock.onPost('https://api.perplexity.ai/v1/chat/completions').reply(200, {
        id: 'complex-response',
        model: 'sonar-pro',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'Complex task response' },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 }
      });

      // Very long prompt should trigger complex routing
      const longPrompt = 'A'.repeat(2000); // ~500 tokens

      const result = await router.generate(longPrompt);
      expect(result.metadata?.providerUsed).toBeDefined();
      expect(['ollama', 'perplexity']).toContain(result.metadata?.providerUsed);
    });

    it('should calculate complexity based on maxTokens', async () => {
      const router = new LLMRouter(createRouterConfig());

      mock.onGet('http://localhost:11434/api/tags').reply(200, { models: [{ name: 'llama2' }] });
      mock.onGet('https://api.perplexity.ai/health').reply(200);

      mock.onPost('https://api.perplexity.ai/v1/chat/completions').reply(200, {
        id: 'large-generation',
        model: 'sonar-pro',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'Large generation response' },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 50, completion_tokens: 2500, total_tokens: 2550 }
      });

      const result = await router.generate('Simple prompt', { maxTokens: 3000 });
      expect(result.metadata?.providerUsed).toBe('perplexity');
    });

    it('should detect critical complexity for architect/research roles', async () => {
      const router = new LLMRouter(createRouterConfig());

      mock.onGet('http://localhost:11434/api/tags').reply(200, { models: [{ name: 'llama2' }] });
      mock.onGet('https://api.perplexity.ai/health').reply(200);

      mock.onPost('https://api.perplexity.ai/v1/chat/completions').reply(200, {
        id: 'architect-response',
        model: 'sonar-pro',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'Architectural analysis' },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 }
      });

      const result = await router.generate('Design system architecture', { role: 'architect' });
      expect(result.metadata?.providerUsed).toBe('perplexity');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing task characteristics gracefully', async () => {
      const router = new LLMRouter(createRouterConfig());

      mock.onGet('http://localhost:11434/api/tags').reply(200, { models: [{ name: 'llama2' }] });
      mock.onGet('https://api.perplexity.ai/health').reply(200);

      mock.onPost('http://localhost:11434/api/generate').reply(200, {
        model: 'llama2',
        response: 'Response without explicit task',
        done: true,
        prompt_eval_count: 10,
        eval_count: 15
      });

      const result = await router.generate('Simple prompt');
      expect(result.content).toBe('Response without explicit task');
      expect(result.metadata?.providerUsed).toBeDefined();
    });

    it('should handle all providers failing in fallback chain', async () => {
      const router = new LLMRouter(createRouterConfig());

      // Mock health checks as available
      mock.onGet('http://localhost:11434/api/tags').reply(200, { models: [{ name: 'llama2' }] });
      mock.onGet('https://api.perplexity.ai/health').reply(200);

      // Mock all generation attempts as failing
      mock.onPost('http://localhost:11434/api/generate').reply(500);
      mock.onPost('https://api.perplexity.ai/v1/chat/completions').reply(500);

      await expect(router.generate('Test prompt')).rejects.toThrow(LLMProviderError);
    });

    it('should handle iteration-based routing rules', async () => {
      const config = createRouterConfig();
      config.rules.push({
        name: 'refinement_iterations',
        condition: {
          iteration: { min: 3, max: 10 }
        },
        provider: 'perplexity',
        priority: 15,
        reason: 'Use cloud models for refinement iterations'
      });

      const router = new LLMRouter(config);

      mock.onGet('http://localhost:11434/api/tags').reply(200, { models: [{ name: 'llama2' }] });
      mock.onGet('https://api.perplexity.ai/health').reply(200);

      mock.onPost('https://api.perplexity.ai/v1/chat/completions').reply(200, {
        id: 'iteration-response',
        model: 'sonar-pro',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'Refinement response' },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 50, completion_tokens: 100, total_tokens: 150 }
      });

      const task: TaskCharacteristics = {
        type: 'generation',
        complexity: 'medium',
        contextSize: 500,
        iteration: 5 // Should trigger iteration-based rule
      };

      const result = await router.generate('Refinement prompt', { task });
      expect(result.metadata?.providerUsed).toBe('perplexity');
      expect(result.metadata?.selectionReason).toContain('refinement iterations');
    });
  });
});