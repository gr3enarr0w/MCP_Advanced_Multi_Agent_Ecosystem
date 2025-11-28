import crypto from 'crypto';
import { FingerprintInput } from '../types.js';

/**
 * Compute a stable SHA256 fingerprint over canonical JSON representation
 * of the prompt request components:
 * - prompt text
 * - system instructions subset
 * - model id
 * - tools
 * - scope
 * - tags
 * - param buckets
 */
export function computeFingerprint(input: FingerprintInput): string {
  const canonical = canonicalize(input);
  const hash = crypto.createHash('sha256');
  hash.update(canonical, 'utf8');
  return hash.digest('hex');
}

/**
 * Stable JSON canonicalization:
 * - sort object keys
 * - normalize arrays (no sorting, order is significant for e.g. messages)
 * - drop undefined values
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: any): any {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value && typeof value === 'object') {
    const result: any = {};
    const keys = Object.keys(value).sort();
    for (const k of keys) {
      const v = value[k];
      if (v !== undefined) {
        result[k] = sortValue(v);
      }
    }
    return result;
  }

  return value;
}

/**
 * Compute SHA256 hash for arbitrary payload (used for full_payload_hash).
 */
export function sha256Of(value: unknown): string {
  const canonical = typeof value === 'string' ? value : canonicalize(value);
  const hash = crypto.createHash('sha256');
  hash.update(canonical, 'utf8');
  return hash.digest('hex');
}