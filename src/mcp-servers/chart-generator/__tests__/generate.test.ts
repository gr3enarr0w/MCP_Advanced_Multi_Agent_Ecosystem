import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ChartFactory } from '../src/charts/index';
import { CanvasRenderer } from '../src/renderers/canvas-renderer';
import { validateChartConfig } from '../src/utils/validation';

describe('chart-generator integration', () => {
  it('renders a bar chart to a temp directory', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'mcp-charts-'));
    const data = {
      labels: ['A', 'B', 'C'],
      datasets: [{ label: 'Sample', data: [1, 2, 3] }],
    };
    const options = { title: 'Test Chart', width: 400, height: 300, theme: 'light' };

    const validation = validateChartConfig('bar', data as any, options as any);
    expect(validation.valid).toBe(true);

    const config = ChartFactory.create('bar', data as any, options as any);
    const renderer = new CanvasRenderer(400, 300, outDir);
    const result = await renderer.render(config);

    expect(result.success).toBe(true);
    expect(result.imagePath).toBeTruthy();
    expect(result.imageBase64).toBeTruthy();
  });
});
