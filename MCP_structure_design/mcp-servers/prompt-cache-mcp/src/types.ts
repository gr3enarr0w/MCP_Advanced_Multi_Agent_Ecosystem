export type CacheScope = 'global' | 'project' | 'session' | 'user';

export interface FingerprintInput {
  prompt: string;
  systemInstructions?: string[];
  modelId?: string;
  tools?: string[];
  scope?: CacheScope;
  tags?: string[];
  params?: Record<string, unknown>;
}

export interface CacheEntry {
  id: string;
  fingerprint: string;
  model: string;
  toolsUsed: string[];
  scope: CacheScope;
  tags: string[];
  inputSummary?: string;
  outputSummary?: string;
  fullPayloadHash: string;
  resultPayload: unknown;
  createdAt: number;
  updatedAt: number;
  expiresAt: number | null;
  deterministic: boolean;
  sizeBytes: number;
  hitCount: number;
  lastHitAt: number | null;
}

export interface CacheStats {
  entryCount: number;
  totalSizeBytes: number;
  oldestEntry?: number | null;
  newestEntry?: number | null;
  hitCount: number;
  missCount: number;
  lastVacuumAt?: number | null;
}

export interface LookupPromptArgs {
  request_fingerprint: string;
  max_age?: number;
  scope?: CacheScope;
  model_hint?: string;
  require_deterministic?: boolean;
}

export interface LookupPromptResult {
  hit: boolean;
  entry?: CacheEntry;
}

export type InvalidateSelector =
  | { type: 'all' }
  | { type: 'by_model'; model: string }
  | { type: 'by_tag'; tag: string }
  | { type: 'by_prefix'; fingerprint_prefix: string }
  | { type: 'by_scope'; scope: CacheScope };

export interface StorePromptResultArgs {
  request_fingerprint: string;
  model: string;
  tools_used?: string[];
  scope?: CacheScope;
  tags?: string[];
  input_summary?: string;
  output_summary?: string;
  full_payload_hash: string;
  result_payload: unknown;
  ttl?: number;
  deterministic?: boolean;
}

export interface InvalidateCacheArgs {
  selector: InvalidateSelector;
}

export interface StatsCacheResult extends CacheStats {
  config: {
    dbPath: string;
    maxSizeBytes?: number | null;
    defaultTtlSeconds: number;
  };
}