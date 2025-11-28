import axios, { AxiosInstance } from 'axios';
import {
  VisionDescription,
  OcrResult,
  EmbeddingResult,
  DescribeImageOptions,
  OcrOptions,
  EmbedOptions,
} from '../types.js';
import { OpenAICompatibleConfig } from '../config.js';
import { IVisionBackend } from './base.js';
import { computeImageFingerprint } from '../util/hashing.js';
import { getLogger } from '../util/logging.js';

const log = getLogger('vision-openai-compatible');

interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: Array<
    | { type: 'text'; text: string }
    | {
        type: 'image_url';
        image_url: { url: string; detail?: 'low' | 'high' };
      }
  >;
}

interface OpenAIEmbeddingRequest {
  model: string;
  input: string | string[] | number[] | number[][];
}

export class OpenAIVisionBackend implements IVisionBackend {
  public readonly name: string;
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly model: string;
  private client: AxiosInstance;

  constructor(config: OpenAICompatibleConfig) {
    this.name = config.name;
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
    });
  }

  async isAvailable(): Promise<boolean> {
    if (!this.baseUrl || !this.model) return false;
    // For local-first / generic OpenAI-compatible, avoid mandatory live probe.
    // Assume available; failures will be caught per-call.
    return true;
  }

  async describe(image: Buffer, options?: DescribeImageOptions): Promise<VisionDescription> {
    const detail = options?.detailLevel === 'high' ? 'high' : 'low';
    const prompt = this.buildDescribePrompt(options);
    const b64 = image.toString('base64');

    try {
      const messages: OpenAIChatMessage[] = [
        {
          role: 'system',
          content: [
            {
              type: 'text',
              text:
                'You are a vision analysis assistant. Provide concise, factual descriptions suitable for LLM prompts.',
            },
          ],
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${b64}`,
                detail,
              },
            },
          ],
        },
      ];

      const resp = await this.client.post(
        '/v1/chat/completions',
        {
          model: this.model,
          messages,
          max_tokens: 512,
        },
        this.buildHeaders()
      );

      const text: string =
        resp.data?.choices?.[0]?.message?.content?.[0]?.text ||
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
        summary: text || 'No description returned by vision backend',
        meta: {
          backendType: 'openai_compatible',
        },
      };
    } catch (error) {
      log.error('describe() failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('openai_compatible.describe_failed');
    }
  }

  async ocr(image: Buffer, options?: OcrOptions): Promise<OcrResult> {
    // If backend does not support dedicated OCR, fall back to describe()
    // with OCR-focused prompt.
    const prompt =
      'Extract all readable text from this image. Preserve layout where helpful. Respond with plain text only.';
    const b64 = image.toString('base64');

    try {
      const messages: OpenAIChatMessage[] = [
        {
          role: 'system',
          content: [
            {
              type: 'text',
              text:
                'You are an OCR engine. Return only the text you can read from the image. No commentary.',
            },
          ],
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${b64}`,
                detail: options?.detailLevel === 'high' ? 'high' : 'low',
              },
            },
          ],
        },
      ];

      const resp = await this.client.post(
        '/v1/chat/completions',
        {
          model: this.model,
          messages,
          max_tokens: 2048,
        },
        this.buildHeaders()
      );

      const text: string =
        resp.data?.choices?.[0]?.message?.content?.[0]?.text ||
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
          backendType: 'openai_compatible',
        },
      };
    } catch (error) {
      log.error('ocr() failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Fall back: treat OCR failure as description failure.
      throw new Error('openai_compatible.ocr_failed');
    }
  }

  async embed(image: Buffer, options?: EmbedOptions): Promise<EmbeddingResult> {
    // Generic pattern: hash image and call /v1/embeddings with base64 string.
    const imageB64 = image.toString('base64');
    const input = `image://base64:${imageB64}`;
    const req: OpenAIEmbeddingRequest = {
      model: this.model,
      input,
    };

    try {
      const resp = await this.client.post('/v1/embeddings', req, this.buildHeaders());
      const embedding = resp.data?.data?.[0]?.embedding as number[] | undefined;
      if (!embedding || !Array.isArray(embedding)) {
        throw new Error('No embedding returned');
      }

      const imageFingerprint = computeImageFingerprint(image, {
        backend: this.name,
        model: this.model,
        mode: 'embed',
        pooling: options?.pooling,
        normalize: options?.normalize,
      });

      return {
        provider: this.name,
        model: this.model,
        imageFingerprint,
        vector: embedding,
        dimensions: embedding.length,
        meta: {
          backendType: 'openai_compatible',
        },
      };
    } catch (error) {
      log.error('embed() failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('openai_compatible.embed_failed');
    }
  }

  getCapabilities() {
    return {
      name: this.name,
      models: [this.model],
      supportsDescribe: true,
      supportsOcr: true,
      supportsEmbed: true,
      endpointType: 'openai_compatible',
    };
  }

  private buildHeaders() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return { headers };
  }

  private buildDescribePrompt(options?: DescribeImageOptions): string {
    const parts: string[] = ['Describe this image clearly for use in an LLM prompt.'];

    if (options?.detailLevel === 'high') {
      parts.push('Include fine-grained details, structure, and relevant context.');
    } else if (options?.detailLevel === 'low') {
      parts.push('Provide a concise high-level overview only.');
    }

    if (options?.domainHint) {
      parts.push(`Optimize description for domain: ${options.domainHint}.`);
    }

    if (options?.includeRawText) {
      parts.push('Also extract any visible text content verbatim where possible.');
    }

    return parts.join(' ');
  }
}