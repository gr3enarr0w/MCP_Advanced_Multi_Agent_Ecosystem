/**
 * LLM Router Implementation
 * Smart routing logic for selecting optimal LLM providers based on task characteristics
 */

import { 
  LLMProvider, 
  LLMResponse, 
  GenerateOptions, 
  ChatMessage, 
  ProviderCapabilities,
  LLMProviderError,
  LLMUnavailableError
} from './llm-provider.js';
import { OllamaProvider, OllamaConfig } from './ollama-provider.js';
import { PerplexityProvider, PerplexityConfig } from './perplexity-provider.js';

/**
 * Task complexity levels
 */
export type TaskComplexity = 'simple' | 'medium' | 'complex' | 'critical';

/**
 * Task type categories
 */
export type TaskType = 
  | 'research'
  | 'analysis'
  | 'generation'
  | 'summarization'
  | 'coding'
  | 'debugging'
  | 'planning'
  | 'review'
  | 'documentation';

/**
 * Routing configuration
 */
export interface RouterConfig {
  /** Default provider to use */
  defaultProvider: string;
  /** Cost optimization preference */
  costOptimization: 'speed' | 'cost' | 'quality';
  /** Fallback providers in order of preference */
  fallbackProviders: string[];
  /** Provider configurations */
  providers: {
    ollama?: OllamaConfig;
    perplexity?: PerplexityConfig;
  };
  /** Routing rules */
  rules: RoutingRule[];
}

/**
 * Routing rule for provider selection
 */
export interface RoutingRule {
  /** Rule name */
  name: string;
  /** Condition to match */
  condition: {
    taskTypes?: TaskType[];
    complexity?: TaskComplexity[];
    contextSize?: {
      min?: number;
      max?: number;
    };
    iteration?: {
      min?: number;
      max?: number;
    };
    agentRole?: string[];
  };
  /** Provider to use when condition matches */
  provider: string;
  /** Priority of this rule (higher = more specific) */
  priority: number;
  /** Reason for selection */
  reason: string;
}

/**
 * Task characteristics for routing
 */
export interface TaskCharacteristics {
  /** Task type */
  type: TaskType;
  /** Task complexity */
  complexity: TaskComplexity;
  /** Estimated context size in tokens */
  contextSize: number;
  /** Current iteration number */
  iteration: number;
  /** Agent role */
  agentRole?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Provider selection result
 */
export interface ProviderSelection {
  /** Selected provider */
  provider: LLMProvider;
  /** Provider name */
  providerName: string;
  /** Selection reason */
  reason: string;
  /** Fallback chain */
  fallbackChain: string[];
}

/**
 * LLM Router with smart routing capabilities
 */
export class LLMRouter {
  private providers: Map<string, LLMProvider> = new Map();
  private config: RouterConfig;
  private providerHealth: Map<string, boolean> = new Map();
  private providerLastCheck: Map<string, number> = new Map();

  constructor(config: RouterConfig) {
    this.config = config;
    this.initializeProviders();
  }

  /**
   * Initialize all configured providers
   */
  private async initializeProviders(): Promise<void> {
    // Initialize Ollama provider if configured
    if (this.config.providers.ollama) {
      const ollamaProvider = new OllamaProvider(this.config.providers.ollama);
      this.providers.set('ollama', ollamaProvider);
    }

    // Initialize Perplexity provider if configured
    if (this.config.providers.perplexity) {
      const perplexityProvider = new PerplexityProvider(this.config.providers.perplexity);
      this.providers.set('perplexity', perplexityProvider);
    }

    // Check initial health of all providers
    await this.checkAllProvidersHealth();
  }

  /**
   * Select optimal provider for given task
   */
  async selectProvider(
    task: TaskCharacteristics
  ): Promise<ProviderSelection> {
    // Find matching routing rule
    const rule = this.findMatchingRule(task);
    
    // Get preferred provider from rule or default
    const preferredProvider = rule?.provider || this.config.defaultProvider;
    
    // Check if preferred provider is available
    const provider = await this.getAvailableProvider(preferredProvider);
    
    if (provider) {
      return {
        provider,
        providerName: preferredProvider,
        reason: rule?.reason || `Default provider: ${preferredProvider}`,
        fallbackChain: this.buildFallbackChain(preferredProvider)
      };
    }

    // Try fallback providers
    for (const fallbackName of this.config.fallbackProviders) {
      const fallbackProvider = await this.getAvailableProvider(fallbackName);
      if (fallbackProvider) {
        return {
          provider: fallbackProvider,
          providerName: fallbackName,
          reason: `Fallback from ${preferredProvider} to ${fallbackName}`,
          fallbackChain: this.buildFallbackChain(fallbackName)
        };
      }
    }

    throw new LLMUnavailableError(
      'router',
      `No available providers for task type: ${task.type}`
    );
  }

  /**
   * Generate completion using optimal provider
   */
  async generate(
    prompt: string | ChatMessage[],
    options?: GenerateOptions & { task?: TaskCharacteristics }
  ): Promise<LLMResponse> {
    const task = options?.task || this.estimateTaskCharacteristics(prompt, options);
    
    // Select provider
    const selection = await this.selectProvider(task);
    
    try {
      // Add task metadata to options
      const enhancedOptions = {
        ...options,
        role: task.agentRole
      };

      // Generate using selected provider
      const response = await selection.provider.generate(prompt, enhancedOptions);
      
      // Add routing metadata
      if (response.metadata) {
        response.metadata.selectionReason = selection.reason;
        response.metadata.providerUsed = selection.providerName;
      }

      return response;

    } catch (error) {
      // Try fallback if primary provider fails
      if (error instanceof LLMProviderError && selection.fallbackChain.length > 0) {
        return this.tryFallbackProviders(
          prompt,
          selection.fallbackChain,
          options,
          task
        );
      }
      
      throw error;
    }
  }

  /**
   * Find matching routing rule
   */
  private findMatchingRule(task: TaskCharacteristics): RoutingRule | undefined {
    // Sort rules by priority (highest first)
    const sortedRules = [...this.config.rules].sort((a, b) => b.priority - a.priority);
    
    for (const rule of sortedRules) {
      if (this.matchesRule(task, rule)) {
        return rule;
      }
    }
    
    return undefined;
  }

  /**
   * Check if task matches routing rule
   */
  private matchesRule(task: TaskCharacteristics, rule: RoutingRule): boolean {
    const { condition } = rule;
    
    // Check task types
    if (condition.taskTypes && !condition.taskTypes.includes(task.type)) {
      return false;
    }
    
    // Check complexity
    if (condition.complexity && !condition.complexity.includes(task.complexity)) {
      return false;
    }
    
    // Check context size
    if (condition.contextSize) {
      if (condition.contextSize.min && task.contextSize < condition.contextSize.min) {
        return false;
      }
      if (condition.contextSize.max && task.contextSize > condition.contextSize.max) {
        return false;
      }
    }
    
    // Check iteration
    if (condition.iteration) {
      if (condition.iteration.min && task.iteration < condition.iteration.min) {
        return false;
      }
      if (condition.iteration.max && task.iteration > condition.iteration.max) {
        return false;
      }
    }
    
    // Check agent role
    if (condition.agentRole && task.agentRole) {
      if (!condition.agentRole.includes(task.agentRole)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Get available provider with health check
   */
  private async getAvailableProvider(providerName: string): Promise<LLMProvider | null> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      return null;
    }

    // Check if health status is recent (within 5 minutes)
    const lastCheck = this.providerLastCheck.get(providerName) || 0;
    const now = Date.now();
    
    if (now - lastCheck > 300000) { // 5 minutes
      const isHealthy = await provider.isAvailable();
      this.providerHealth.set(providerName, isHealthy);
      this.providerLastCheck.set(providerName, now);
      
      return isHealthy ? provider : null;
    }
    
    return this.providerHealth.get(providerName) ? provider : null;
  }

  /**
   * Build fallback chain for provider
   */
  private buildFallbackChain(preferredProvider: string): string[] {
    const chain = [preferredProvider];
    
    for (const fallback of this.config.fallbackProviders) {
      if (!chain.includes(fallback)) {
        chain.push(fallback);
      }
    }
    
    return chain;
  }

  /**
   * Try fallback providers
   */
  private async tryFallbackProviders(
    prompt: string | ChatMessage[],
    fallbackChain: string[],
    options?: GenerateOptions,
    task?: TaskCharacteristics
  ): Promise<LLMResponse> {
    const errors: Error[] = [];
    
    for (let i = 1; i < fallbackChain.length; i++) {
      const providerName = fallbackChain[i];
      const provider = await this.getAvailableProvider(providerName);
      
      if (provider) {
        try {
          const enhancedOptions = {
            ...options,
            role: task?.agentRole
          };
          
          const response = await provider.generate(prompt, enhancedOptions);
          
          // Add fallback metadata
          if (response.metadata) {
            response.metadata.selectionReason = `Fallback from ${fallbackChain[0]} to ${providerName}`;
            response.metadata.providerUsed = providerName;
          }
          
          return response;
          
        } catch (error) {
          errors.push(error as Error);
          continue;
        }
      }
    }
    
    // All fallbacks failed
    throw new LLMProviderError(
      `All providers failed. Errors: ${errors.map(e => e.message).join(', ')}`,
      'router',
      'ALL_PROVIDERS_FAILED'
    );
  }

  /**
   * Estimate task characteristics from prompt and options
   */
  private estimateTaskCharacteristics(
    prompt: string | ChatMessage[],
    options?: GenerateOptions
  ): TaskCharacteristics {
    const promptText = typeof prompt === 'string' 
      ? prompt 
      : prompt.map(m => m.content).join(' ');
    
    const tokenCount = this.estimateTokenCount(promptText);
    
    // Determine complexity based on various factors
    let complexity: TaskComplexity = 'medium';
    
    if (tokenCount < 100 && !options?.maxTokens) {
      complexity = 'simple';
    } else if (tokenCount > 4000 || options?.maxTokens && options.maxTokens > 2000) {
      complexity = 'complex';
    } else if (options?.role === 'architect' || options?.role === 'research') {
      complexity = 'critical';
    }
    
    // Determine task type from prompt content and role
    let type: TaskType = 'generation';
    
    if (promptText.toLowerCase().includes('debug') || promptText.toLowerCase().includes('error')) {
      type = 'debugging';
    } else if (promptText.toLowerCase().includes('summarize') || promptText.toLowerCase().includes('summary')) {
      type = 'summarization';
    } else if (promptText.toLowerCase().includes('analyze') || promptText.toLowerCase().includes('analysis')) {
      type = 'analysis';
    } else if (promptText.toLowerCase().includes('research') || promptText.toLowerCase().includes('investigate')) {
      type = 'research';
    } else if (promptText.toLowerCase().includes('plan') || promptText.toLowerCase().includes('strategy')) {
      type = 'planning';
    } else if (promptText.toLowerCase().includes('review') || promptText.toLowerCase().includes('check')) {
      type = 'review';
    } else if (promptText.toLowerCase().includes('document') || promptText.toLowerCase().includes('readme')) {
      type = 'documentation';
    } else if (promptText.toLowerCase().includes('code') || promptText.toLowerCase().includes('function')) {
      type = 'coding';
    }
    
    return {
      type,
      complexity,
      contextSize: tokenCount,
      iteration: 1, // Default to first iteration
      agentRole: options?.role,
      metadata: { estimated: true }
    };
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokenCount(text: string): number {
    // Rough approximation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Check health of all providers
   */
  private async checkAllProvidersHealth(): Promise<void> {
    const healthPromises = Array.from(this.providers.entries()).map(
      async ([name, provider]) => {
        try {
          const isHealthy = await provider.isAvailable();
          this.providerHealth.set(name, isHealthy);
          this.providerLastCheck.set(name, Date.now());
        } catch {
          this.providerHealth.set(name, false);
          this.providerLastCheck.set(name, Date.now());
        }
      }
    );
    
    await Promise.allSettled(healthPromises);
  }

  /**
   * Get all available providers
   */
  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get provider by name
   */
  getProvider(name: string): LLMProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Get health status of all providers
   */
  async getProviderHealth(): Promise<Map<string, boolean>> {
    await this.checkAllProvidersHealth();
    return new Map(this.providerHealth);
  }
}