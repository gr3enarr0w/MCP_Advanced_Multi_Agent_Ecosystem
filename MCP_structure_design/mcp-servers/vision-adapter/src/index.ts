import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import { createVisionBackends, IVisionBackend } from './backends/base.js';
import { loadImage } from './util/image-loader.js';
import { computeImageFingerprint } from './util/hashing.js';
import { getLogger } from './util/logging.js';
import {
  DescribeImageOptions,
  OcrOptions,
  EmbedOptions,
  VisionDescription,
  OcrResult,
  EmbeddingResult,
  BackendCapability,
} from './types.js';

const log = getLogger('vision-adapter-index');

// Initialize MCP server
const server = new Server(
  {
    name: 'vision-adapter-mcp',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

let backends: IVisionBackend[] = [];

/**
 * Tools:
 * - describe_image
 * - extract_text_from_image
 * - embed_image
 * - get_vision_backends
 */

const tools: Tool[] = [
  {
    name: 'describe_image',
    description:
      'Describe an image via configured vision backends. Accepts local path, URL, or data/base64.',
    inputSchema: {
      type: 'object',
      properties: {
        image_ref: {
          type: 'string',
          description:
            'Image reference: local filesystem path, http(s) URL, or data URL (base64).',
        },
        detail_level: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          default: 'medium',
          description: 'Desired description detail level.',
        },
        domain_hint: {
          type: 'string',
          description:
            'Optional domain hint (e.g., "code", "diagram", "ui", "document") to shape description.',
        },
        include_raw_text: {
          type: 'boolean',
          default: false,
          description:
            'If true, backends should also attempt to include visible text in the description.',
        },
      },
      required: ['image_ref'],
    },
  },
  {
    name: 'extract_text_from_image',
    description:
      'Extract text/OCR from an image via configured vision backends. Accepts local path, URL, or data/base64.',
    inputSchema: {
      type: 'object',
      properties: {
        image_ref: {
          type: 'string',
          description:
            'Image reference: local filesystem path, http(s) URL, or data URL (base64).',
        },
        detail_level: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          default: 'medium',
          description: 'Optional hint for OCR precision.',
        },
      },
      required: ['image_ref'],
    },
  },
  {
    name: 'embed_image',
    description:
      'Compute an image embedding via configured vision backends for similarity/caching.',
    inputSchema: {
      type: 'object',
      properties: {
        image_ref: {
          type: 'string',
          description:
            'Image reference: local filesystem path, http(s) URL, or data URL (base64).',
        },
        pooling: {
          type: 'string',
          enum: ['mean', 'cls', 'max'],
          description: 'Optional pooling strategy hint.',
        },
        normalize: {
          type: 'boolean',
          description: 'Whether to normalize the embedding vector.',
          default: false,
        },
      },
      required: ['image_ref'],
    },
  },
  {
    name: 'get_vision_backends',
    description:
      'List configured vision backends and their capabilities as seen by this adapter.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// Register tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

// Register tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    switch (name) {
      case 'describe_image':
        return await handleDescribeImage(args);
      case 'extract_text_from_image':
        return await handleExtractText(args);
      case 'embed_image':
        return await handleEmbedImage(args);
      case 'get_vision_backends':
        return await handleGetBackends();
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
    log.error('Tool handler error', {
      tool: name,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'vision_adapter_tool_failed',
            tool: name,
            message: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
      isError: true,
    };
  }
});

async function ensureBackends() {
  if (!backends || backends.length === 0) {
    backends = await createVisionBackends();
    log.info('Vision backends initialized', {
      count: backends.length,
      names: backends.map((b) => b.name),
    });
  }
}

async function handleDescribeImage(args: any) {
  await ensureBackends();
  const imageRef = String(args?.image_ref || '');
  const detailLevel =
    (args?.detail_level as 'low' | 'medium' | 'high') || 'medium';
  const domainHint = args?.domain_hint
    ? String(args.domain_hint)
    : undefined;
  const includeRawText =
    typeof args?.include_raw_text === 'boolean'
      ? args.include_raw_text
      : false;

  if (!imageRef) {
    throw new Error('image_ref is required');
  }

  const loaded = await loadImage(imageRef);
  const commonFingerprint = computeImageFingerprint(loaded.buffer, {
    source: loaded.ref,
  });

  const describeOptions: DescribeImageOptions = {
    detailLevel,
    domainHint,
    includeRawText: includeRawText,
  };

  const errors: any[] = [];

  for (const backend of backends) {
    try {
      if (!(await backend.isAvailable())) {
        continue;
      }
      const result: VisionDescription = await backend.describe(
        loaded.buffer,
        describeOptions
      );
      // Ensure fingerprint present / aligned
      const imageFingerprint =
        result.imageFingerprint ||
        computeImageFingerprint(loaded.buffer, {
          backend: backend.name,
          mode: 'describe',
          options: describeOptions,
        });

      const enriched: VisionDescription = {
        ...result,
        provider: backend.name,
        imageFingerprint,
        detailLevel,
        domainHint,
        includeRawText,
        meta: {
          ...(result.meta || {}),
          source_ref: loaded.ref,
          mime: loaded.mime,
          size: loaded.size,
          commonFingerprint,
        },
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(enriched, null, 2),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.warn('describe_image backend failed', {
        backend: backend.name,
        error: message,
      });
      errors.push({ backend: backend.name, error: message });
    }
  }

  // All failed
  log.error('All vision backends failed for describe_image', { errors });
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            error: 'vision_adapter_all_backends_failed',
            operation: 'describe_image',
            image_ref: imageRef,
            backends_tried: backends.map((b) => b.name),
            backend_errors: errors,
          },
          null,
          2
        ),
      },
    ],
    isError: true,
  };
}

async function handleExtractText(args: any) {
  await ensureBackends();
  const imageRef = String(args?.image_ref || '');
  const detailLevel =
    (args?.detail_level as 'low' | 'medium' | 'high') || 'medium';

  if (!imageRef) {
    throw new Error('image_ref is required');
  }

  const loaded = await loadImage(imageRef);
  const commonFingerprint = computeImageFingerprint(loaded.buffer, {
    source: loaded.ref,
  });

  const ocrOptions: OcrOptions = { detailLevel };

  const errors: any[] = [];

  for (const backend of backends) {
    try {
      if (!(await backend.isAvailable())) {
        continue;
      }
      const result: OcrResult = await backend.ocr(
        loaded.buffer,
        ocrOptions
      );
      const imageFingerprint =
        result.imageFingerprint ||
        computeImageFingerprint(loaded.buffer, {
          backend: backend.name,
          mode: 'ocr',
          options: ocrOptions,
        });

      const enriched: OcrResult = {
        ...result,
        provider: backend.name,
        imageFingerprint,
        meta: {
          ...(result.meta || {}),
          source_ref: loaded.ref,
          mime: loaded.mime,
          size: loaded.size,
          commonFingerprint,
        },
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(enriched, null, 2),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.warn('extract_text_from_image backend failed', {
        backend: backend.name,
        error: message,
      });
      errors.push({ backend: backend.name, error: message });
    }
  }

  log.error('All vision backends failed for extract_text_from_image', {
    errors,
  });
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            error: 'vision_adapter_all_backends_failed',
            operation: 'extract_text_from_image',
            image_ref: imageRef,
            backends_tried: backends.map((b) => b.name),
            backend_errors: errors,
          },
          null,
          2
        ),
      },
    ],
    isError: true,
  };
}

async function handleEmbedImage(args: any) {
  await ensureBackends();
  const imageRef = String(args?.image_ref || '');
  const pooling = args?.pooling as EmbedOptions['pooling'];
  const normalize =
    typeof args?.normalize === 'boolean' ? args.normalize : false;

  if (!imageRef) {
    throw new Error('image_ref is required');
  }

  const loaded = await loadImage(imageRef);
  const commonFingerprint = computeImageFingerprint(loaded.buffer, {
    source: loaded.ref,
  });

  const embedOptions: EmbedOptions = { pooling, normalize };
  const errors: any[] = [];

  for (const backend of backends) {
    try {
      if (!(await backend.isAvailable())) {
        continue;
      }
      const result: EmbeddingResult = await backend.embed(
        loaded.buffer,
        embedOptions
      );
      const imageFingerprint =
        result.imageFingerprint ||
        computeImageFingerprint(loaded.buffer, {
          backend: backend.name,
          mode: 'embed',
          options: embedOptions,
        });

      const enriched: EmbeddingResult = {
        ...result,
        provider: backend.name,
        imageFingerprint,
        meta: {
          ...(result.meta || {}),
          source_ref: loaded.ref,
          mime: loaded.mime,
          size: loaded.size,
          commonFingerprint,
        },
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(enriched, null, 2),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.warn('embed_image backend failed', {
        backend: backend.name,
        error: message,
      });
      errors.push({ backend: backend.name, error: message });
    }
  }

  log.error('All vision backends failed for embed_image', { errors });
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            error: 'vision_adapter_all_backends_failed',
            operation: 'embed_image',
            image_ref: imageRef,
            backends_tried: backends.map((b) => b.name),
            backend_errors: errors,
          },
          null,
          2
        ),
      },
    ],
    isError: true,
  };
}

async function handleGetBackends() {
  await ensureBackends();
  const capabilities: BackendCapability[] = backends.map((b) => {
    const caps = b.getCapabilities();
    return {
      name: caps.name,
      models: caps.models,
      supportsDescribe: caps.supportsDescribe,
      supportsOcr: caps.supportsOcr,
      supportsEmbed: caps.supportsEmbed,
      endpointType: caps.endpointType as BackendCapability['endpointType'],
      available: true,
      meta: {},
    };
  });

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            backends: capabilities,
            count: capabilities.length,
          },
          null,
          2
        ),
      },
    ],
  };
}

// Start server (no top-level await)
async function main() {
  try {
    // Pre-initialize backends so capability queries are fast.
    await ensureBackends();

    const transport = new StdioServerTransport();
    await server.connect(transport);
    log.info('Vision Adapter MCP server running on stdio');
  } catch (error) {
    log.error('Failed to start Vision Adapter MCP server', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

main().catch((error) => {
  log.error('Fatal error in Vision Adapter MCP server', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});