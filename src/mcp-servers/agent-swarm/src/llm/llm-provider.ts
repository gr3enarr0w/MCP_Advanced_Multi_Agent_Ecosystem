/**
 * Base LLM Provider Interface
 * Defines the contract for all LLM providers in the agent swarm system
 */

export interface LLMProvider {
  /**
   * Generate a completion for the given prompt
   * @param prompt - The input prompt or message array
   * @param options - Generation options
   * @returns Promise resolving to the generation response
   */
  generate(prompt: string | ChatMessage[], options?: GenerateOptions): Promise<LLMResponse>;

  /**
   * Get the provider name
   * @returns Provider identifier string
   */
  getProvider(): string;

  /**
   * Get the current model name
   * @returns Model identifier string
   */
  getModel(): string;

  /**
   * Check if the provider is available and healthy
   * @returns Promise resolving to availability status
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get provider capabilities
   * @returns Object describing provider capabilities
   */
  getCapabilities(): ProviderCapabilities;
}

/**
 * Chat message interface
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Generation options interface
 */
export interface GenerateOptions {
  /** Model to use for generation */
  model?: string;
  /** Temperature for sampling (0-2) */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Top-p sampling parameter */
  topP?: number;
  /** Enable streaming response */
  stream?: boolean;
  /** Stop sequences */
  stop?: string[];
  /** Presence penalty */
  presencePenalty?: number;
  /** Frequency penalty */
  frequencyPenalty?: number;
  /** Agent role for context */
  role?: string;
  /** Conversation ID for context tracking */
  conversationId?: string;
}

/**
 * LLM response interface
 */
export interface LLMResponse {
  /** Generated content */
  content: string;
  /** Model used for generation */
  model: string;
  /** Token usage information */
  usage: TokenUsage;
  /** Response metadata */
  metadata?: ResponseMetadata;
  /** Finish reason */
  finishReason?: string;
}

/**
 * Token usage information
 */
export interface TokenUsage {
  /** Tokens in the prompt */
  promptTokens: number;
  /** Tokens in the completion */
  completionTokens: number;
  /** Total tokens used */
  totalTokens: number;
}

/**
 * Response metadata
 */
export interface ResponseMetadata {
  /** Backend provider used */
  backend: string;
  /** Time taken in milliseconds */
  responseTimeMs: number;
  /** Original prompt length (if optimized) */
  originalPromptLength?: number;
  /** Optimized prompt length (if applicable) */
  optimizedPromptLength?: number;
  /** Strategy used for optimization */
  strategyUsed?: string;
  /** Selection reason for provider/model */
  selectionReason?: string;
  /** Provider actually used for generation */
  providerUsed?: string;
}

/**
 * Provider capabilities
 */
export interface ProviderCapabilities {
  /** Supported modalities */
  modalities: ('text' | 'image' | 'audio')[];
  /** Maximum context window */
  maxContextSize: number;
  /** Streaming support */
  streaming: boolean;
  /** Function calling support */
  functionCalling: boolean;
  /** Vision/image analysis support */
  vision: boolean;
  /** Cost tier */
  costTier: 'free' | 'paid' | 'enterprise';
}

/**
 * Provider configuration interface
 */
export interface ProviderConfig {
  /** Provider name */
  name: string;
  /** Base URL for API */
  baseUrl?: string;
  /** API key or authentication */
  apiKey?: string;
  /** Default model */
  model: string;
  /** Additional provider-specific config */
  config?: Record<string, any>;
}

/**
 * Error types for LLM providers
 */
export class LLMProviderError extends Error {
  constructor(
    message: string,
    public provider: string,
    public code?: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'LLMProviderError';
  }
}

export class LLMUnavailableError extends LLMProviderError {
  constructor(provider: string, message?: string) {
    super(message || `Provider ${provider} is unavailable`, provider, 'UNAVAILABLE');
    this.name = 'LLMUnavailableError';
  }
}

export class LLMRateLimitError extends LLMProviderError {
  constructor(provider: string, message?: string) {
    super(message || `Rate limit exceeded for ${provider}`, provider, 'RATE_LIMIT', 429);
    this.name = 'LLMRateLimitError';
  }
}

export class LLMAuthenticationError extends LLMProviderError {
  constructor(provider: string, message?: string) {
    super(message || `Authentication failed for ${provider}`, provider, 'AUTH', 401);
    this.name = 'LLMAuthenticationError';
  }
}