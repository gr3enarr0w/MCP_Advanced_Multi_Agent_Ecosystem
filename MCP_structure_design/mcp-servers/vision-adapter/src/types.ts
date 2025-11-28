export interface VisionDescription {
  provider: string;
  model: string;
  imageFingerprint: string;
  detailLevel: 'low' | 'medium' | 'high';
  domainHint?: string;
  includeRawText?: boolean;
  summary: string;
  details?: string[];
  rawTextBlocks?: string[];
  meta?: Record<string, unknown>;
}

export interface OcrResult {
  provider: string;
  model: string;
  imageFingerprint: string;
  text: string;
  blocks?: Array<{
    text: string;
    confidence?: number;
    bbox?: [number, number, number, number];
  }>;
  meta?: Record<string, unknown>;
}

export interface EmbeddingResult {
  provider: string;
  model: string;
  imageFingerprint: string;
  vector: number[];
  dimensions: number;
  meta?: Record<string, unknown>;
}

export interface BackendCapability {
  name: string;
  models: string[];
  supportsDescribe: boolean;
  supportsOcr: boolean;
  supportsEmbed: boolean;
  endpointType: 'openai_compatible' | 'ollama' | 'stub' | 'other';
  available: boolean;
  meta?: Record<string, unknown>;
}

export interface DescribeImageOptions {
  detailLevel?: 'low' | 'medium' | 'high';
  domainHint?: string;
  includeRawText?: boolean;
}

export interface OcrOptions {
  detailLevel?: 'low' | 'medium' | 'high';
}

export interface EmbedOptions {
  pooling?: 'mean' | 'cls' | 'max';
  normalize?: boolean;
}