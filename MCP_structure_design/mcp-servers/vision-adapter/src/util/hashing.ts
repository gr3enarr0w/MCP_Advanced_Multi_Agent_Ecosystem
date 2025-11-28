import crypto from 'crypto';

/**
 * Compute a stable SHA256 fingerprint for an image and optional parameters.
 * Uses:
 * - raw image bytes
 * - sorted JSON of params (if provided)
 */
export function computeImageFingerprint(
  image: Buffer,
  params?: Record<string, unknown>
): string {
  const hash = crypto.createHash('sha256');
  hash.update(image);

  if (params && Object.keys(params).length > 0) {
    const stable = stableStringify(params);
    hash.update('|');
    hash.update(stable);
  }

  return hash.digest('hex');
}

/**
 * Deterministic JSON stringifier (sorted keys, stable structure).
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: any): any {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === 'object') {
    const sortedKeys = Object.keys(value).sort();
    const result: any = {};
    for (const key of sortedKeys) {
      const v = value[key];
      if (v !== undefined) {
        result[key] = sortValue(v);
      }
    }
    return result;
  }
  return value;
}