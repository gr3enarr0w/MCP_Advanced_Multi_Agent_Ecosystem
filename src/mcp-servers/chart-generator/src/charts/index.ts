/**
 * Chart Factory - Central chart creation interface
 */

import { createBarChart } from './bar-chart.js';
import { createLineChart } from './line-chart.js';
import { createPieChart } from './pie-chart.js';
import { createScatterChart } from './scatter-chart.js';
import { createGanttChart } from './gantt-chart.js';
import { createHeatmapChart } from './heatmap-chart.js';
import type { ChartType, ChartData, ChartOptions, ChartConfig, GanttTask, HeatmapCell } from '../types/charts.js';

export class ChartFactory {
  static create(
    type: ChartType,
    data: ChartData | GanttTask[] | HeatmapCell[],
    options: ChartOptions = {}
  ): ChartConfig {
    switch (type) {
      case 'bar':
        return createBarChart(data as ChartData, options);

      case 'line':
        return createLineChart(data as ChartData, options);

      case 'pie':
        return createPieChart(data as ChartData, options);

      case 'scatter':
        return createScatterChart(data as ChartData, options);

      case 'gantt':
        return createGanttChart(data as GanttTask[], options);

      case 'heatmap':
        return createHeatmapChart(data as HeatmapCell[], options);

      default:
        throw new Error(`Unsupported chart type: ${type}`);
    }
  }
}

// Re-export individual chart creators
export { createBarChart, createLineChart, createPieChart, createScatterChart, createGanttChart, createHeatmapChart };
