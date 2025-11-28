import axios from 'axios';
import { lookup as lookupMime } from 'mime-types';
import { readFile } from 'fs/promises';
import { URL } from 'url';

export interface LoadedImage {
  buffer: Buffer;
  mime: string;
  size: number;
  source: 'file' | 'url' | 'data_url';
  ref: string;
}

/**
 * Load image from:
 * - local path
 * - http/https URL
 * - data URL / base64
 */
export async function loadImage(imageRef: string): Promise<LoadedImage> {
  if (!imageRef || typeof imageRef !== 'string') {
    throw new Error('image_ref must be a non-empty string');
  }

  // Data URL
  if (imageRef.startsWith('data:')) {
    return loadFromDataUrl(imageRef);
  }

  // HTTP/HTTPS URL
  if (isHttpUrl(imageRef)) {
    return loadFromHttp(imageRef);
  }

  // Fallback: treat as local file path
  return loadFromFile(imageRef);
}

function isHttpUrl(ref: string): boolean {
  try {
    const url = new URL(ref);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

async function loadFromFile(path: string): Promise<LoadedImage> {
  const buffer = await readFile(path);
  const mime =
    lookupMime(path) ||
    'application/octet-stream';

  return {
    buffer,
    mime,
    size: buffer.length,
    source: 'file',
    ref: path,
  };
}

async function loadFromHttp(url: string): Promise<LoadedImage> {
  const response = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    validateStatus: (s) => s >= 200 && s < 400,
  });

  const buffer = Buffer.from(response.data);
  const contentType =
    (response.headers['content-type'] as string | undefined) || '';
  const mime =
    contentType.split(';')[0].trim() ||
    'application/octet-stream';

  return {
    buffer,
    mime,
    size: buffer.length,
    source: 'url',
    ref: url,
  };
}

async function loadFromDataUrl(dataUrl: string): Promise<LoadedImage> {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) {
    throw new Error('Invalid data URL format for image_ref');
  }

  const mime = match[1] || 'application/octet-stream';
  const isBase64 = !!match[2];
  const data = match[3];

  const buffer = isBase64
    ? Buffer.from(data, 'base64')
    : Buffer.from(decodeURIComponent(data), 'utf8');

  return {
    buffer,
    mime,
    size: buffer.length,
    source: 'data_url',
    ref: '[data-url]',
  };
}