/**
 * Scatter Chart Implementation
 */

import type { ChartConfig, ChartData, ChartOptions } from '../types/charts.js';

export function createScatterChart(
  data: ChartData,
  options: ChartOptions = {}
): ChartConfig {
  return {
    type: 'scatter',
    data,
    options: {
      ...options,
      scales: {
        y: {
          title: {
            display: !!options.yAxisLabel,
            text: options.yAxisLabel,
          },
          ...options.scales?.y,
        },
        x: {
          type: 'linear',
          position: 'bottom',
          title: {
            display: !!options.xAxisLabel,
            text: options.xAxisLabel,
          },
          ...options.scales?.x,
        },
        ...options.scales,
      },
    },
  };
}
