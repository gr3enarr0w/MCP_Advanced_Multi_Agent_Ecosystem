#!/usr/bin/env node

/**
 * Chart Generator MCP Server
 * Generates PNG charts with multiple chart types and themes
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { ChartFactory } from './charts/index.js';
import { CanvasRenderer } from './renderers/canvas-renderer.js';
import { validateChartConfig } from './utils/validation.js';
import type { ChartType, ChartData, ChartOptions } from './types/charts.js';

// Initialize MCP server
const server = new Server(
  {
    name: 'chart-generator',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Initialize renderer
const renderer = new CanvasRenderer();

// Define MCP tools
const tools: Tool[] = [
  {
    name: 'generate_chart',
    description: 'Generate a chart image (PNG) with specified type, data, and options. Returns base64 encoded image and file path.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['bar', 'line', 'pie', 'scatter', 'gantt', 'heatmap'],
          description: 'Type of chart to generate',
        },
        data: {
          type: 'object',
          description: 'Chart data including labels and datasets',
        },
        options: {
          type: 'object',
          description: 'Chart options including title, dimensions, theme, etc.',
          properties: {
            title: { type: 'string', description: 'Chart title' },
            width: { type: 'number', description: 'Chart width in pixels (default: 800)' },
            height: { type: 'number', description: 'Chart height in pixels (default: 600)' },
            theme: {
              type: 'string',
              enum: ['light', 'dark', 'colorblind'],
              description: 'Chart theme (default: light)',
            },
            legend: { type: 'boolean', description: 'Show legend (default: true)' },
            xAxisLabel: { type: 'string', description: 'X-axis label' },
            yAxisLabel: { type: 'string', description: 'Y-axis label' },
          },
        },
      },
      required: ['type', 'data'],
    },
  },
  {
    name: 'list_chart_types',
    description: 'List all available chart types with descriptions',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'preview_chart_config',
    description: 'Validate chart configuration without rendering. Returns validation results and warnings.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['bar', 'line', 'pie', 'scatter', 'gantt', 'heatmap'],
          description: 'Type of chart',
        },
        data: {
          type: 'object',
          description: 'Chart data to validate',
        },
        options: {
          type: 'object',
          description: 'Chart options to validate',
        },
      },
      required: ['type', 'data'],
    },
  },
];

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'generate_chart': {
        const { type, data, options = {} } = args as {
          type: ChartType;
          data: ChartData;
          options?: ChartOptions;
        };

        // Validate configuration
        const validation = validateChartConfig(type, data, options);
        if (!validation.valid) {
          return {
            content: [
              {
                type: 'text',
                text: `Chart validation failed:\n${validation.errors.join('\n')}`,
              },
            ],
            isError: true,
          };
        }

        // Create chart configuration
        const chartConfig = ChartFactory.create(type, data, options);

        // Render chart
        const result = await renderer.render(chartConfig);

        if (!result.success) {
          return {
            content: [
              {
                type: 'text',
                text: `Chart rendering failed: ${result.error}`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                imagePath: result.imagePath,
                imageBase64: result.imageBase64,
                metadata: result.metadata,
                message: `${type.charAt(0).toUpperCase() + type.slice(1)} chart generated successfully`,
              }, null, 2),
            },
          ],
        };
      }

      case 'list_chart_types': {
        const chartTypes = [
          {
            type: 'bar',
            description: 'Vertical or horizontal bar charts for comparing categories',
            dataFormat: '{ labels: string[], datasets: [{ label: string, data: number[] }] }',
          },
          {
            type: 'line',
            description: 'Line charts for showing trends over time',
            dataFormat: '{ labels: string[], datasets: [{ label: string, data: number[] }] }',
          },
          {
            type: 'pie',
            description: 'Pie or donut charts for showing proportions',
            dataFormat: '{ labels: string[], datasets: [{ data: number[] }] }',
          },
          {
            type: 'scatter',
            description: 'Scatter plots for showing correlations between variables',
            dataFormat: '{ datasets: [{ data: [{ x: number, y: number }] }] }',
          },
          {
            type: 'gantt',
            description: 'Gantt charts for project timelines and scheduling',
            dataFormat: '[{ task: string, start: Date, end: Date, progress?: number }]',
          },
          {
            type: 'heatmap',
            description: 'Heatmaps for visualizing matrix data with color intensity',
            dataFormat: '[{ x: string|number, y: string|number, value: number }]',
          },
        ];

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(chartTypes, null, 2),
            },
          ],
        };
      }

      case 'preview_chart_config': {
        const { type, data, options = {} } = args as {
          type: ChartType;
          data: ChartData;
          options?: ChartOptions;
        };

        const validation = validateChartConfig(type, data, options);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                valid: validation.valid,
                errors: validation.errors,
                warnings: [],
                chartType: type,
                datasetCount: data.datasets?.length || 0,
                dimensions: {
                  width: options.width || 800,
                  height: options.height || 600,
                },
                theme: options.theme || 'light',
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
              text: `Unknown tool: ${name}`,
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
          text: `Error executing ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Chart Generator MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
