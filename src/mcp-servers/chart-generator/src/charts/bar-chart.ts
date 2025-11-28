/**
 * Bar Chart Implementation
 */

import type { ChartConfig, ChartData, ChartOptions } from '../types/charts.js';

export function createBarChart(
  data: ChartData,
  options: ChartOptions = {}
): ChartConfig {
  return {
    type: 'bar',
    data,
    options: {
      ...options,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: !!options.yAxisLabel,
            text: options.yAxisLabel,
          },
          ...options.scales?.y,
        },
        x: {
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
