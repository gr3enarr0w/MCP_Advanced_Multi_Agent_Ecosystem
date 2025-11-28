import axios, { AxiosInstance } from 'axios';
import {
  VisionDescription,
  OcrResult,
  EmbeddingResult,
  DescribeImageOptions,
  OcrOptions,
  EmbedOptions,
} from '../types.js';
import { OllamaConfig } from '../config.js';
import { IVisionBackend } from './base.js';
import { computeImageFingerprint } from '../util/hashing.js';
import { getLogger } from '../util/logging.js';

const log = getLogger('vision-ollama');

export class OllamaVisionBackend implements IVisionBackend {
  public readonly name: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private client: AxiosInstance;

  constructor(config: OllamaConfig) {
    this.name = config.name;
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.model = config.model;
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
    });
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Lightweight health check; if it fails we mark unavailable.
      await this.client.get('/api/tags');
      return true;
    } catch (error) {
      log.warn('Ollama backend unavailable or not running', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async describe(image: Buffer, options?: DescribeImageOptions): Promise<VisionDescription> {
    const prompt = this.buildDescribePrompt(options);
    const imageB64 = image.toString('base64');

    try {
      const resp = await this.client.post(
        '/api/chat',
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content:
                'You are a vision analysis assistant. Provide clear, factual descriptions suitable for LLM prompts.',
            },
            {
              role: 'user',
              content: prompt,
              images: [imageB64],
            },
          ],
          stream: false,
        }
      );

      const text: string =
        resp.data?.message?.content ||
        resp.data?.choices?.[0]?.message?.content ||
        '';

      const imageFingerprint = computeImageFingerprint(image, {
        backend: this.name,
        model: this.model,
        detail: options?.detailLevel || 'medium',
        domainHint: options?.domainHint,
        includeRawText: options?.includeRawText,
      });

      return {
        provider: this.name,
        model: this.model,
        imageFingerprint,
        detailLevel: options?.detailLevel || 'medium',
        domainHint: options?.domainHint,
        includeRawText: options?.includeRawText,
        summary: text || 'No description returned by Ollama vision model',
        meta: {
          backendType: 'ollama',
        },
      };
    } catch (error) {
      log.error('describe() failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('ollama.describe_failed');
    }
  }

  async ocr(image: Buffer, options?: OcrOptions): Promise<OcrResult> {
    const prompt =
      'Extract all readable text from this image. Return only plain text content, no explanations.';
    const imageB64 = image.toString('base64');

    try {
      const resp = await this.client.post(
        '/api/chat',
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content:
                'You are an OCR engine using a vision model. Return exactly the text visible in the image.',
            },
            {
              role: 'user',
              content: prompt,
              images: [imageB64],
            },
          ],
          stream: false,
        }
      );

      const text: string =
        resp.data?.message?.content ||
        resp.data?.choices?.[0]?.message?.content ||
        '';

      const imageFingerprint = computeImageFingerprint(image, {
        backend: this.name,
        model: this.model,
        mode: 'ocr',
      });

      return {
        provider: this.name,
        model: this.model,
        imageFingerprint,
        text: text || '',
        meta: {
          backendType: 'ollama',
        },
      };
    } catch (error) {
      log.error('ocr() failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('ollama.ocr_failed');
    }
  }

  async embed(image: Buffer, options?: EmbedOptions): Promise<EmbeddingResult> {
    // Some Ollama models support embeddings; use generic /api/embeddings if available.
    const imageFingerprint = computeImageFingerprint(image, {
      backend: this.name,
      model: this.model,
      mode: 'embed',
      pooling: options?.pooling,
      normalize: options?.normalize,
    });

    try {
      const resp = await this.client.post('/api/embeddings', {
        model: this.model,
        // Strategy: embed fingerprint string; avoids sending raw bytes twice.
        input: imageFingerprint,
      });

      const vector =
        resp.data?.embedding ||
        resp.data?.data?.[0]?.embedding;

      if (!Array.isArray(vector)) {
        throw new Error('No embedding returned from Ollama');
      }

      return {
        provider: this.name,
        model: this.model,
        imageFingerprint,
        vector,
        dimensions: vector.length,
        meta: {
          backendType: 'ollama',
          source: 'fingerprint_embedding',
        },
      };
    } catch (error) {
      log.error('embed() failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('ollama.embed_failed');
    }
  }

  getCapabilities() {
    return {
      name: this.name,
      models: [this.model],
      supportsDescribe: true,
      supportsOcr: true,
      supportsEmbed: true,
      endpointType: 'ollama',
    };
  }

  private buildDescribePrompt(options?: DescribeImageOptions): string {
    const parts: string[] = [
      'Describe this image clearly for downstream language models.',
    ];

    if (options?.detailLevel === 'high') {
      parts.push('Include detailed structure, objects, and relationships.');
    } else if (options?.detailLevel === 'low') {
      parts.push('Keep it brief and high-level.');
    }

    if (options?.domainHint) {
      parts.push(`Optimize for domain: ${options.domainHint}.`);
    }

    if (options?.includeRawText) {
      parts.push('Also include any visible text exactly if possible.');
    }

    return parts.join(' ');
  }
}