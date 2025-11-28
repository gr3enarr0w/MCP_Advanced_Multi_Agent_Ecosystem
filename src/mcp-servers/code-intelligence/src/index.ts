/**
 * Code Intelligence MCP Server
 * Phase 10: Tree-sitter parsing, symbol finding, reference tracking, and code analysis
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import { CodeParser } from './parser.js';
import { SymbolFinder } from './symbol-finder.js';
import { ReferenceFinder } from './reference-finder.js';
import { OutlineGenerator } from './outline-generator.js';

// Initialize components
const parser = new CodeParser();
const symbolFinder = new SymbolFinder(parser);
const referenceFinder = new ReferenceFinder(parser, symbolFinder);
const outlineGenerator = new OutlineGenerator(parser, symbolFinder);

// Initialize server
const server = new Server(
  {
    name: 'code-intelligence',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Define tools
const tools: Tool[] = [
  {
    name: 'find_symbol',
    description: 'Find symbol definitions by name across multiple files',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Symbol name to find',
        },
        filePaths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Files to search',
        },
        language: {
          type: 'string',
          description: 'Optional language filter',
        },
      },
      required: ['name', 'filePaths'],
    },
  },
  {
    name: 'find_references',
    description: 'Find all references to a symbol',
    inputSchema: {
      type: 'object',
      properties: {
        symbolName: {
          type: 'string',
          description: 'Symbol to find references for',
        },
        filePaths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Files to search',
        },
      },
      required: ['symbolName', 'filePaths'],
    },
  },
  {
    name: 'get_code_outline',
    description: 'Generate code structure outline for a file',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'File to analyze',
        },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'analyze_semantic_structure',
    description: 'Analyze file and return symbols, imports, complexity',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'File to analyze',
        },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'get_call_hierarchy',
    description: 'Build call hierarchy for a function',
    inputSchema: {
      type: 'object',
      properties: {
        functionName: {
          type: 'string',
          description: 'Function name',
        },
        filePaths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Files to analyze',
        },
      },
      required: ['functionName', 'filePaths'],
    },
  },
  {
    name: 'parse_file',
    description: 'Parse a file and return AST information',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'File to parse',
        },
        printTree: {
          type: 'boolean',
          description: 'Include pretty-printed AST',
          default: false,
        },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'get_supported_languages',
    description: 'List all supported programming languages',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name } = request.params;
  const args = request.params.arguments as Record<string, any> | undefined;

  try {
    switch (name) {
      case 'find_symbol': {
        const symbols = await symbolFinder.findSymbol(
          args?.name,
          args?.filePaths || []
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                symbolName: args?.name,
                matches: symbols.map(s => ({
                  name: s.name,
                  type: s.type,
                  filePath: s.filePath,
                  location: `${s.filePath}:${s.startLine}:${s.startColumn}`,
                  signature: s.signature,
                })),
                count: symbols.length,
              }, null, 2),
            },
          ],
        };
      }

      case 'find_references': {
        const references = await referenceFinder.findReferences(
          args?.symbolName,
          args?.filePaths || []
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                symbolName: args?.symbolName,
                references: references.map(r => ({
                  filePath: r.filePath,
                  line: r.startLine,
                  column: r.startColumn,
                  context: r.context,
                  isDefinition: r.isDefinition,
                })),
                count: references.length,
              }, null, 2),
            },
          ],
        };
      }

      case 'get_code_outline': {
        const outline = await outlineGenerator.generateOutline(args?.filePath);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                filePath: outline.filePath,
                language: outline.language,
                imports: outline.imports,
                symbols: outline.symbols.map(s => ({
                  name: s.name,
                  type: s.type,
                  line: s.startLine,
                })),
                complexity: outline.complexity,
                structure: outline.structure,
              }, null, 2),
            },
          ],
        };
      }

      case 'analyze_semantic_structure': {
        const outline = await outlineGenerator.generateOutline(args?.filePath);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                filePath: outline.filePath,
                language: outline.language,
                metrics: {
                  imports: outline.imports.length,
                  functions: outline.complexity.functions,
                  classes: outline.complexity.classes,
                  lines: outline.complexity.lines,
                  complexity: outline.complexity.cyclomaticComplexity,
                  maintainability: outline.complexity.maintainabilityIndex,
                },
                symbols: outline.symbols,
                imports: outline.imports,
              }, null, 2),
            },
          ],
        };
      }

      case 'get_call_hierarchy': {
        const hierarchy = await referenceFinder.buildCallHierarchy(
          args?.functionName,
          args?.filePaths || []
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                function: args?.functionName,
                calledBy: hierarchy.calledBy.map(r => ({
                  filePath: r.filePath,
                  line: r.startLine,
                  context: r.context,
                })),
                calls: hierarchy.calls,
              }, null, 2),
            },
          ],
        };
      }

      case 'parse_file': {
        const result = await parser.parseFile(args?.filePath);
        const hasErrors = parser.hasErrors(result);
        const errors = hasErrors ? parser.getErrors(result) : [];

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                filePath: result.filePath,
                language: result.language,
                hasErrors,
                errors: errors.map(e => ({
                  location: e.location,
                  text: e.text,
                })),
                tree: args?.printTree ? parser.printTree(result.rootNode) : undefined,
              }, null, 2),
            },
          ],
        };
      }

      case 'get_supported_languages': {
        const languages = parser.getSupportedLanguages();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                languages,
                count: languages.length,
              }, null, 2),
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
          text: JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Code Intelligence MCP Server running on stdio');
  } catch (error) {
    console.error('Failed to start Code Intelligence MCP Server:', error);
    process.exit(1);
  }
}

main().catch(console.error);
