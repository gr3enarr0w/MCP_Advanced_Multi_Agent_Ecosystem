import { getLogger } from './util/logging.js';

const log = getLogger('vision-config');

export type VisionProviderId = 'openai_compatible' | 'ollama';

export interface OpenAICompatibleConfig {
  type: 'openai_compatible';
  name: string;
  baseUrl: string;
  apiKey?: string;
  model: string;
}

export interface OllamaConfig {
  type: 'ollama';
  name: string;
  baseUrl: string;
  model: string;
}

export type BackendConfig = OpenAICompatibleConfig | OllamaConfig;

export interface VisionConfig {
  providers: BackendConfig[];
  orderedProviderNames: string[];
}

/**
 * Load ordered backend configuration from environment.
 *
 * Environment variables:
 * - VISION_PROVIDERS: comma-separated provider keys, e.g. "openai,ollama"
 *
 * OpenAI-compatible backend:
 * - VISION_OPENAI_BASE_URL (required)
 * - VISION_OPENAI_API_KEY (optional, but typically required)
 * - VISION_OPENAI_MODEL (required)
 *
 * Ollama backend:
 * - VISION_OLLAMA_BASE_URL (default "http://127.0.0.1:11434")
 * - VISION_OLLAMA_MODEL (required, e.g. "llava:latest")
 */
export function loadVisionConfig(): VisionConfig {
  const providersEnv = (process.env.VISION_PROVIDERS || '')
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const orderedProviderNames: string[] = [];
  const providers: BackendConfig[] = [];

  for (const key of providersEnv) {
    if (key.toLowerCase() === 'openai' || key.toLowerCase() === 'openai_compatible') {
      const baseUrl = process.env.VISION_OPENAI_BASE_URL || '';
      const model = process.env.VISION_OPENAI_MODEL || '';
      const apiKey = process.env.VISION_OPENAI_API_KEY || process.env.OPENAI_API_KEY || undefined;

      if (!baseUrl || !model) {
        log.warn('Skipping openai_compatible backend due to missing base URL or model', {
          baseUrlConfigured: !!baseUrl,
          modelConfigured: !!model,
        });
        continue;
      }

      const name = 'vision-openai-compatible';
      providers.push({
        type: 'openai_compatible',
        name,
        baseUrl,
        apiKey,
        model,
      });
      orderedProviderNames.push(name);
    } else if (key.toLowerCase() === 'ollama') {
      const baseUrl = process.env.VISION_OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
      const model = process.env.VISION_OLLAMA_MODEL || '';

      if (!model) {
        log.warn('Skipping ollama backend due to missing VISION_OLLAMA_MODEL');
        continue;
      }

      const name = 'vision-ollama';
      providers.push({
        type: 'ollama',
        name,
        baseUrl,
        model,
      });
      orderedProviderNames.push(name);
    } else {
      log.warn('Unknown VISION_PROVIDERS entry; ignoring', { key });
    }
  }

  if (providers.length === 0) {
    log.warn('No vision backends configured; stub backend will be used as fallback');
  }

  return {
    providers,
    orderedProviderNames,
  };
}