/**
 * Line Chart Implementation
 */

import type { ChartConfig, ChartData, ChartOptions } from '../types/charts.js';

export function createLineChart(
  data: ChartData,
  options: ChartOptions = {}
): ChartConfig {
  return {
    type: 'line',
    data: {
      ...data,
      datasets: data.datasets.map(dataset => ({
        ...dataset,
        tension: dataset.tension || 0.4, // Smooth curves
        fill: dataset.fill !== undefined ? dataset.fill : false,
      })),
    },
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
