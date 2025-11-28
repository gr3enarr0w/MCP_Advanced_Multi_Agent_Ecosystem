import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import os from 'os';

import {
  CacheEntry,
  CacheScope,
  CacheStats,
  LookupPromptArgs,
  LookupPromptResult,
  StorePromptResultArgs,
  InvalidateCacheArgs,
  StatsCacheResult,
} from './types.js';
import { computeFingerprint, sha256Of } from './util/hashing.js';

const CACHE_ROOT = path.join(os.homedir(), '.mcp', 'prompt-cache');
const DB_FILE = path.join(CACHE_ROOT, 'cache.json');

interface CacheState {
  entries: Record<string, CacheEntry>;
  stats: CacheStats & {
    missCount: number;
  };
  config: {
    dbPath: string;
    maxSizeBytes: number | null;
    defaultTtlSeconds: number;
  };
}

function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_ROOT)) {
    fs.mkdirSync(CACHE_ROOT, { recursive: true });
  }
}

function createEmptyState(): CacheState {
  return {
    entries: {},
    stats: {
      entryCount: 0,
      totalSizeBytes: 0,
      oldestEntry: null,
      newestEntry: null,
      hitCount: 0,
      missCount: 0,
      lastVacuumAt: null,
    },
    config: {
      dbPath: DB_FILE,
      maxSizeBytes: null,
      defaultTtlSeconds: 60 * 60,
    },
  };
}

function loadState(): CacheState {
  ensureCacheDir();

  if (!fs.existsSync(DB_FILE)) {
    const empty = createEmptyState();
    fs.writeFileSync(DB_FILE, JSON.stringify(empty), 'utf8');
    return empty;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw) as CacheState;

    if (!parsed.stats) {
      parsed.stats = {
        entryCount: 0,
        totalSizeBytes: 0,
        oldestEntry: null,
        newestEntry: null,
        hitCount: 0,
        missCount: 0,
        lastVacuumAt: null,
      };
    }
    if (!parsed.config) {
      parsed.config = {
        dbPath: DB_FILE,
        maxSizeBytes: null,
        defaultTtlSeconds: 60 * 60,
      };
    }

    return parsed;
  } catch {
    const empty = createEmptyState();
    fs.writeFileSync(DB_FILE, JSON.stringify(empty), 'utf8');
    return empty;
  }
}

function saveState(state: CacheState): void {
  fs.writeFileSync(DB_FILE, JSON.stringify(state), 'utf8');
}

function isExpired(entry: CacheEntry, now: number): boolean {
  return entry.expiresAt !== null && entry.expiresAt <= now;
}

function selectScope(inputScope?: CacheScope): CacheScope {
  return inputScope || 'global';
}

function toEntryKey(fingerprint: string, scope: CacheScope): string {
  return `${scope}:${fingerprint}`;
}

function storePromptResult(state: CacheState, args: StorePromptResultArgs): CacheEntry {
  const now = Date.now();
  const scope = selectScope(args.scope);
  const deterministic = args.deterministic ?? true;
  const ttlSeconds = args.ttl ?? state.config.defaultTtlSeconds;
  const ttlMs = ttlSeconds > 0 ? ttlSeconds * 1000 : 0;

  const key = toEntryKey(args.request_fingerprint, scope);

  const payloadHash = args.full_payload_hash || sha256Of(args.result_payload);
  const tags = args.tags || [];
  const toolsUsed = args.tools_used || [];

  const inputSummary =
    args.input_summary ??
    `prompt_fingerprint=${args.request_fingerprint.slice(0, 12)} model=${args.model}`;

  const outputSummary =
    args.output_summary ??
    `payload_hash=${payloadHash.slice(0, 12)} size=${JSON.stringify(
      args.result_payload
    ).length}`;

  const expiresAt = ttlMs > 0 ? now + ttlMs : null;
  const serializedPayload = JSON.stringify(args.result_payload);
  const sizeBytes = Buffer.byteLength(serializedPayload, 'utf8');

  const existing = state.entries[key];

  const entry: CacheEntry = {
    id: existing?.id || uuidv4(),
    fingerprint: args.request_fingerprint,
    model: args.model,
    toolsUsed,
    scope,
    tags,
    inputSummary,
    outputSummary,
    fullPayloadHash: payloadHash,
    resultPayload: args.result_payload,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    expiresAt,
    deterministic,
    sizeBytes,
    hitCount: existing?.hitCount ?? 0,
    lastHitAt: existing?.lastHitAt ?? null,
  };

  state.entries[key] = entry;

  let totalSize = 0;
  let count = 0;
  let oldest: number | null = null;
  let newest: number | null = null;

  for (const e of Object.values(state.entries)) {
    totalSize += e.sizeBytes;
    count++;
    oldest = oldest === null ? e.createdAt : Math.min(oldest, e.createdAt);
    newest = newest === null ? e.createdAt : Math.max(newest, e.createdAt);
  }

  state.stats.entryCount = count;
  state.stats.totalSizeBytes = totalSize;
  state.stats.oldestEntry = oldest;
  state.stats.newestEntry = newest;

  return entry;
}

function lookupPrompt(state: CacheState, args: LookupPromptArgs): LookupPromptResult {
  const now = Date.now();
  const scope = selectScope(args.scope);
  const key = toEntryKey(args.request_fingerprint, scope);
  const candidate = state.entries[key];

  if (!candidate || isExpired(candidate, now)) {
    if (candidate && isExpired(candidate, now)) {
      delete state.entries[key];
    }
    state.stats.missCount += 1;
    return { hit: false };
  }

  if (args.require_deterministic && !candidate.deterministic) {
    state.stats.missCount += 1;
    return { hit: false };
  }

  if (args.model_hint && candidate.model !== args.model_hint) {
    state.stats.missCount += 1;
    return { hit: false };
  }

  if (args.max_age) {
    const maxAgeMs = args.max_age * 1000;
    if (now - candidate.createdAt > maxAgeMs) {
      state.stats.missCount += 1;
      return { hit: false };
    }
  }

  candidate.hitCount += 1;
  candidate.lastHitAt = now;
  state.stats.hitCount += 1;

  return { hit: true, entry: candidate };
}

function invalidateCache(state: CacheState, args: InvalidateCacheArgs): void {
  const selector = args.selector;
  const now = Date.now();

  switch (selector.type) {
    case 'all':
      state.entries = {};
      break;
    case 'by_model':
      for (const [key, entry] of Object.entries(state.entries)) {
        if (entry.model === selector.model) {
          delete state.entries[key];
        }
      }
      break;
    case 'by_tag':
      for (const [key, entry] of Object.entries(state.entries)) {
        if (entry.tags.includes(selector.tag)) {
          delete state.entries[key];
        }
      }
      break;
    case 'by_prefix':
      for (const [key, entry] of Object.entries(state.entries)) {
        if (entry.fingerprint.startsWith(selector.fingerprint_prefix)) {
          delete state.entries[key];
        }
      }
      break;
    case 'by_scope':
      for (const [key, entry] of Object.entries(state.entries)) {
        if (entry.scope === selector.scope) {
          delete state.entries[key];
        }
      }
      break;
  }

  let totalSize = 0;
  let count = 0;
  let oldest: number | null = null;
  let newest: number | null = null;

  for (const entry of Object.values(state.entries)) {
    totalSize += entry.sizeBytes;
    count++;
    oldest = oldest === null ? entry.createdAt : Math.min(oldest, entry.createdAt);
    newest = newest === null ? entry.createdAt : Math.max(newest, entry.createdAt);
  }

  state.stats.entryCount = count;
  state.stats.totalSizeBytes = totalSize;
  state.stats.oldestEntry = oldest;
  state.stats.newestEntry = newest;
  state.stats.lastVacuumAt = now;
}

function getStats(state: CacheState): StatsCacheResult {
  return {
    entryCount: state.stats.entryCount,
    totalSizeBytes: state.stats.totalSizeBytes,
    oldestEntry: state.stats.oldestEntry ?? null,
    newestEntry: state.stats.newestEntry ?? null,
    hitCount: state.stats.hitCount,
    missCount: state.stats.missCount,
    lastVacuumAt: state.stats.lastVacuumAt ?? null,
    config: {
      dbPath: state.config.dbPath,
      maxSizeBytes: state.config.maxSizeBytes ?? null,
      defaultTtlSeconds: state.config.defaultTtlSeconds,
    },
  };
}

const tools: Tool[] = [
  {
    name: 'lookup_prompt',
    description:
      'Lookup a cached prompt/response pair by fingerprint and optional constraints.',
    inputSchema: {
      type: 'object',
      properties: {
        request_fingerprint: { type: 'string' },
        max_age: {
          type: 'number',
          description:
            'Maximum age in seconds for a cache entry to be considered valid.',
        },
        scope: {
          type: 'string',
          enum: ['global', 'project', 'session', 'user'],
        },
        model_hint: {
          type: 'string',
          description: 'If set, only consider entries for this model id.',
        },
        require_deterministic: {
          type: 'boolean',
          description: 'If true, only return deterministic entries.',
          default: true,
        },
      },
      required: ['request_fingerprint'],
    },
  },
  {
    name: 'store_prompt_result',
    description:
      'Store a prompt result in the cache keyed by request fingerprint and scope.',
    inputSchema: {
      type: 'object',
      properties: {
        request_fingerprint: { type: 'string' },
        model: { type: 'string' },
        tools_used: {
          type: 'array',
          items: { type: 'string' },
        },
        scope: {
          type: 'string',
          enum: ['global', 'project', 'session', 'user'],
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
        },
        input_summary: { type: 'string' },
        output_summary: { type: 'string' },
        full_payload_hash: { type: 'string' },
        result_payload: {},
        ttl: {
          type: 'number',
          description:
            'TTL in seconds for this entry. If omitted, uses default TTL.',
        },
        deterministic: {
          type: 'boolean',
          description:
            'Whether this response is deterministic for the given fingerprint.',
        },
      },
      required: [
        'request_fingerprint',
        'model',
        'result_payload',
        'full_payload_hash',
      ],
    },
  },
  {
    name: 'invalidate_cache',
    description:
      'Invalidate cached entries by selector (all, by_model, by_tag, by_prefix, by_scope).',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          anyOf: [
            {
              type: 'object',
              properties: { type: { const: 'all' } },
              required: ['type'],
            },
            {
              type: 'object',
              properties: {
                type: { const: 'by_model' },
                model: { type: 'string' },
              },
              required: ['type', 'model'],
            },
            {
              type: 'object',
              properties: {
                type: { const: 'by_tag' },
                tag: { type: 'string' },
              },
              required: ['type', 'tag'],
            },
            {
              type: 'object',
              properties: {
                type: { const: 'by_prefix' },
                fingerprint_prefix: { type: 'string' },
              },
              required: ['type', 'fingerprint_prefix'],
            },
            {
              type: 'object',
              properties: {
                type: { const: 'by_scope' },
                scope: {
                  type: 'string',
                  enum: ['global', 'project', 'session', 'user'],
                },
              },
              required: ['type', 'scope'],
            },
          ],
        },
      },
      required: ['selector'],
    },
  },
  {
    name: 'stats_cache',
    description: 'Get prompt cache statistics and configuration.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

const server = new Server(
  {
    name: 'prompt-cache-mcp',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const state = loadState();

  try {
    switch (name) {
      case 'lookup_prompt': {
        const lookupArgs = (args ?? {}) as unknown as LookupPromptArgs;
        const result = lookupPrompt(state, lookupArgs);
        saveState(state);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'store_prompt_result': {
        const storeArgs = (args ?? {}) as unknown as StorePromptResultArgs;
        const entry = storePromptResult(state, storeArgs);
        saveState(state);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(entry, null, 2),
            },
          ],
        };
      }

      case 'invalidate_cache': {
        const invalidateArgs = (args ?? {}) as unknown as InvalidateCacheArgs;
        invalidateCache(state, invalidateArgs);
        saveState(state);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ ok: true }, null, 2),
            },
          ],
        };
      }

      case 'stats_cache': {
        const stats = getStats(state);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(stats, null, 2),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: `Unknown tool: ${name}` }),
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: error instanceof Error ? error.message : String(error),
              tool: name,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
});

async function main(): Promise<void> {
  try {
    ensureCacheDir();
    const transport = new StdioServerTransport();
    await server.connect(transport);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(
      'Failed to start prompt-cache-mcp server',
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(
    'Fatal error in prompt-cache-mcp server',
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});