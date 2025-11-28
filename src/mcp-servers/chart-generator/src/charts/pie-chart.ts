/**
 * Pie Chart Implementation
 */

import type { ChartConfig, ChartData, ChartOptions } from '../types/charts.js';

export function createPieChart(
  data: ChartData,
  options: ChartOptions = {}
): ChartConfig {
  return {
    type: 'pie',
    data,
    options: {
      ...options,
      plugins: {
        ...options.plugins,
        legend: {
          display: options.legend !== false,
          position: options.plugins?.legend?.position || 'right',
          ...options.plugins?.legend,
        },
      },
    },
  };
}
