/**
 * Heatmap Chart Implementation
 * Uses bubble chart with size based on value
 */

import type { ChartConfig, ChartOptions, HeatmapCell } from '../types/charts.js';

export function createHeatmapChart(
  cells: HeatmapCell[],
  options: ChartOptions = {}
): ChartConfig {
  // Find min and max values for color scaling
  const values = cells.map(c => c.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue;

  // Convert cells to bubble chart data
  const data = cells.map(cell => ({
    x: cell.x,
    y: cell.y,
    r: 20, // Fixed radius for heatmap cells
    value: cell.value,
  }));

  // Generate colors based on value (gradient from blue to red)
  const backgroundColor = cells.map(cell => {
    const normalized = (cell.value - minValue) / range;
    // Interpolate between blue (cold) and red (hot)
    const r = Math.round(normalized * 255);
    const b = Math.round((1 - normalized) * 255);
    return `rgba(${r}, 100, ${b}, 0.7)`;
  });

  return {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Heatmap',
        data,
        backgroundColor,
        borderColor: backgroundColor.map(c => c.replace('0.7', '1')),
        borderWidth: 1,
        pointStyle: 'rect',
        pointRadius: 15,
      }],
    },
    options: {
      ...options,
      scales: {
        x: {
          type: 'category',
          title: {
            display: !!options.xAxisLabel,
            text: options.xAxisLabel,
          },
          ...options.scales?.x,
        },
        y: {
          type: 'category',
          title: {
            display: !!options.yAxisLabel,
            text: options.yAxisLabel,
          },
          ...options.scales?.y,
        },
        ...options.scales,
      },
      plugins: {
        ...options.plugins,
        legend: {
          display: false,
          ...options.plugins?.legend,
        },
        tooltip: {
          callbacks: {
            label: function(context: any) {
              const cell = cells[context.dataIndex];
              return [
                `X: ${cell.x}`,
                `Y: ${cell.y}`,
                `Value: ${cell.value}`,
              ];
            },
          },
          ...options.plugins?.tooltip,
        },
      },
    },
  };
}
