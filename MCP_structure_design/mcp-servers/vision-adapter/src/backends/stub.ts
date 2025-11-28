import {
  VisionDescription,
  OcrResult,
  EmbeddingResult,
  DescribeImageOptions,
  OcrOptions,
  EmbedOptions,
} from '../types.js';
import { IVisionBackend } from './base.js';
import { computeImageFingerprint } from '../util/hashing.js';
import { getLogger } from '../util/logging.js';

const log = getLogger('vision-stub');

/**
 * Stub backend used when no real providers are configured.
 * Returns deterministic placeholder data so callers can handle gracefully.
 */
export class StubVisionBackend implements IVisionBackend {
  public readonly name = 'vision-stub-backend';

  async isAvailable(): Promise<boolean> {
    // Always "available" as a logical fallback.
    return true;
  }

  async describe(image: Buffer, options?: DescribeImageOptions): Promise<VisionDescription> {
    const imageFingerprint = computeImageFingerprint(image, {
      backend: this.name,
      mode: 'describe',
      detail: options?.detailLevel || 'medium',
    });

    log.warn('describe() called on StubVisionBackend; no real vision provider configured', {
      imageFingerprint,
    });

    return {
      provider: this.name,
      model: 'stub-model',
      imageFingerprint,
      detailLevel: options?.detailLevel || 'medium',
      domainHint: options?.domainHint,
      includeRawText: options?.includeRawText,
      summary:
        'No vision backend configured. This is a stub description. Configure VISION_PROVIDERS and related environment variables to enable real image understanding.',
      details: [],
      meta: {
        error: 'no_vision_backend_configured',
      },
    };
  }

  async ocr(image: Buffer, _options?: OcrOptions): Promise<OcrResult> {
    const imageFingerprint = computeImageFingerprint(image, {
      backend: this.name,
      mode: 'ocr',
    });

    log.warn('ocr() called on StubVisionBackend; no real OCR provider configured', {
      imageFingerprint,
    });

    return {
      provider: this.name,
      model: 'stub-model',
      imageFingerprint,
      text: '',
      meta: {
        error: 'no_vision_backend_configured',
      },
    };
  }

  async embed(image: Buffer, _options?: EmbedOptions): Promise<EmbeddingResult> {
    const imageFingerprint = computeImageFingerprint(image, {
      backend: this.name,
      mode: 'embed',
    });

    log.warn('embed() called on StubVisionBackend; no real embedding provider configured', {
      imageFingerprint,
    });

    // Deterministic pseudo-vector derived from fingerprint prefix for shape sanity.
    const vector = this.buildDeterministicVector(imageFingerprint, 16);

    return {
      provider: this.name,
      model: 'stub-model',
      imageFingerprint,
      vector,
      dimensions: vector.length,
      meta: {
        error: 'no_vision_backend_configured',
        note: 'stub_embedding_for_testing_only',
      },
    };
  }

  getCapabilities() {
    return {
      name: this.name,
      models: ['stub-model'],
      supportsDescribe: true,
      supportsOcr: true,
      supportsEmbed: true,
      endpointType: 'stub',
    };
  }

  private buildDeterministicVector(fingerprint: string, dim: number): number[] {
    const cleaned = fingerprint.replace(/[^0-9a-f]/gi, '');
    const vector: number[] = [];
    for (let i = 0; i < dim; i++) {
      const idx = (i * 2) % Math.max(cleaned.length, 2);
      const hex = cleaned.slice(idx, idx + 2) || '00';
      const val = parseInt(hex, 16);
      vector.push((val / 255) * 2 - 1); // map to [-1, 1]
    }
    return vector;
  }
}