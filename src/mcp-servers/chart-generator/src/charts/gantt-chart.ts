/**
 * Gantt Chart Implementation
 * Uses horizontal bar chart with time-based data
 */

import type { ChartConfig, ChartOptions, GanttTask } from '../types/charts.js';

export function createGanttChart(
  tasks: GanttTask[],
  options: ChartOptions = {}
): ChartConfig {
  // Convert tasks to horizontal bar chart data
  const taskLabels = tasks.map(t => t.task);

  // Calculate duration and start position for each task
  const data = tasks.map(task => {
    const start = new Date(task.start).getTime();
    const end = new Date(task.end).getTime();
    const duration = end - start;

    return {
      x: [start, end],
      y: task.task,
    };
  });

  const backgroundColor = tasks.map((task) => {
    if (task.progress !== undefined) {
      // Color by progress
      if (task.progress >= 100) return '#10b981'; // green - complete
      if (task.progress >= 50) return '#f59e0b'; // amber - in progress
      return '#ef4444'; // red - not started/early
    }
    return '#3b82f6'; // Default blue
  });

  return {
    type: 'bar',
    data: {
      labels: taskLabels,
      datasets: [{
        label: 'Task Duration',
        data: data.map((d, i) => ({
          x: d.x as any,
          y: i,
        })) as any,
        backgroundColor,
      }],
    },
    options: {
      ...options,
      indexAxis: 'y', // Horizontal bars
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'day',
          },
          title: {
            display: !!options.xAxisLabel,
            text: options.xAxisLabel || 'Timeline',
          },
          ...options.scales?.x,
        },
        y: {
          title: {
            display: !!options.yAxisLabel,
            text: options.yAxisLabel || 'Tasks',
          },
          ...options.scales?.y,
        },
        ...options.scales,
      },
      plugins: {
        ...options.plugins,
        tooltip: {
          callbacks: {
            label: function(context: any) {
              const task = tasks[context.dataIndex];
              const lines = [
                `Task: ${task.task}`,
                `Start: ${new Date(task.start).toLocaleDateString()}`,
                `End: ${new Date(task.end).toLocaleDateString()}`,
              ];
              if (task.progress !== undefined) {
                lines.push(`Progress: ${task.progress}%`);
              }
              return lines;
            },
          },
          ...options.plugins?.tooltip,
        },
      },
    },
  };
}
