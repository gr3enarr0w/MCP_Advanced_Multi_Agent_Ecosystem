/**
 * Canvas Renderer for Chart.js
 */

import { createCanvas } from 'canvas';
import { Chart, registerables } from 'chart.js';
import type { ChartConfig, RenderResult } from '../types/charts.js';
import { getTheme, applyThemeToOptions, applyThemeToData } from '../themes/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Register Chart.js components
Chart.register(...registerables);

export class CanvasRenderer {
  private width: number;
  private height: number;
  private outputDir: string;

  constructor(width: number = 800, height: number = 600, outputDir?: string) {
    this.width = width;
    this.height = height;
    this.outputDir = outputDir || path.join(os.homedir(), '.mcp', 'charts');
  }

  async ensureOutputDir(): Promise<void> {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create output directory:', error);
      throw error;
    }
  }

  async render(config: ChartConfig): Promise<RenderResult> {
    try {
      await this.ensureOutputDir();

      const width = config.options.width || this.width;
      const height = config.options.height || this.height;
      const themeName = config.options.theme || 'light';

      // Create canvas
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');

      // Apply theme
      const theme = getTheme(themeName);
      ctx.fillStyle = theme.backgroundColor;
      ctx.fillRect(0, 0, width, height);

      // Apply theme to data and options
      const themedData = applyThemeToData(config.data, themeName);
      const themedOptions = applyThemeToOptions(
        {
          responsive: false,
          maintainAspectRatio: false,
          ...config.options,
          plugins: {
            ...config.options.plugins,
            title: {
              display: !!config.options.title,
              text: config.options.title,
              ...config.options.plugins?.title,
            },
            legend: {
              display: config.options.legend !== false,
              ...config.options.plugins?.legend,
            },
          },
        },
        themeName
      );

      // Create chart
      const chart = new Chart(ctx as any, {
        type: config.type as any,
        data: themedData,
        options: themedOptions,
      });

      // Generate filename
      const timestamp = Date.now();
      const filename = `chart_${config.type}_${timestamp}.png`;
      const imagePath = path.join(this.outputDir, filename);

      // Save as PNG
      const buffer = canvas.toBuffer('image/png');
      await fs.writeFile(imagePath, buffer);

      // Generate base64
      const imageBase64 = buffer.toString('base64');

      // Cleanup
      chart.destroy();

      return {
        success: true,
        imagePath,
        imageBase64,
        metadata: {
          width,
          height,
          type: config.type,
          theme: themeName,
        },
      };
    } catch (error) {
      console.error('Chart rendering error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async renderToFile(config: ChartConfig, outputPath: string): Promise<RenderResult> {
    try {
      const result = await this.render(config);

      if (result.success && result.imagePath) {
        // Copy to specified output path
        await fs.copyFile(result.imagePath, outputPath);

        return {
          ...result,
          imagePath: outputPath,
        };
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async renderToBase64(config: ChartConfig): Promise<string> {
    const result = await this.render(config);

    if (result.success && result.imageBase64) {
      return result.imageBase64;
    }

    throw new Error(result.error || 'Failed to render chart');
  }
}
