import { VisionDescription, OcrResult, EmbeddingResult, DescribeImageOptions, OcrOptions, EmbedOptions } from '../types.js';
import { BackendConfig, loadVisionConfig } from '../config.js';
import { getLogger } from '../util/logging.js';

const log = getLogger('vision-backends');

export interface IVisionBackend {
  readonly name: string;
  isAvailable(): Promise<boolean>;
  describe(image: Buffer, options?: DescribeImageOptions): Promise<VisionDescription>;
  ocr(image: Buffer, options?: OcrOptions): Promise<OcrResult>;
  embed(image: Buffer, options?: EmbedOptions): Promise<EmbeddingResult>;
  getCapabilities(): {
    name: string;
    models: string[];
    supportsDescribe: boolean;
    supportsOcr: boolean;
    supportsEmbed: boolean;
    endpointType: string;
  };
}

/**
 * Factory: create all enabled backends based on configuration.
 * Falls back to stub backend when nothing is configured.
 */
export async function createVisionBackends(): Promise<IVisionBackend[]> {
  const config = loadVisionConfig();
  const backends: IVisionBackend[] = [];

  for (const backendCfg of config.providers) {
    try {
      if (backendCfg.type === 'openai_compatible') {
        const { OpenAIVisionBackend } = await import('./openai_compatible.js');
        const backend = new OpenAIVisionBackend(backendCfg);
        if (await backend.isAvailable()) {
          backends.push(backend);
        } else {
          log.warn('OpenAI-compatible backend reported unavailable', { name: backendCfg.name });
        }
      } else if (backendCfg.type === 'ollama') {
        const { OllamaVisionBackend } = await import('./ollama.js');
        const backend = new OllamaVisionBackend(backendCfg);
        if (await backend.isAvailable()) {
          backends.push(backend);
        } else {
          log.warn('Ollama backend reported unavailable', { name: backendCfg.name });
        }
      }
    } catch (error) {
      log.error('Failed to initialize configured vision backend', {
        backend: backendCfg.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (backends.length === 0) {
    const { StubVisionBackend } = await import('./stub.js');
    log.warn('No configured/available vision backends; using stub backend');
    backends.push(new StubVisionBackend());
  }

  // Preserve configured order where possible
  const ordered = orderBackends(backends, config.orderedProviderNames);
  return ordered;
}

function orderBackends(backends: IVisionBackend[], orderedNames: string[]): IVisionBackend[] {
  if (!orderedNames.length) return backends;
  const byName = new Map(backends.map((b) => [b.name, b]));
  const result: IVisionBackend[] = [];

  for (const name of orderedNames) {
    const backend = byName.get(name);
    if (backend) {
      result.push(backend);
      byName.delete(name);
    }
  }

  // Append any remaining backends not explicitly ordered
  for (const backend of byName.values()) {
    result.push(backend);
  }

  return result;
}