/**
 * Chart Configuration Validation
 */

import type { ChartType, ChartData, ChartOptions, ValidationResult } from '../types/charts.js';

export function validateChartType(type: string): ValidationResult {
  const validTypes: ChartType[] = ['bar', 'line', 'pie', 'scatter', 'gantt', 'heatmap'];

  if (!validTypes.includes(type as ChartType)) {
    return {
      valid: false,
      errors: [`Invalid chart type: ${type}. Must be one of: ${validTypes.join(', ')}`],
    };
  }

  return { valid: true, errors: [] };
}

export function validateChartData(type: ChartType, data: ChartData): ValidationResult {
  const errors: string[] = [];

  if (!data) {
    errors.push('Chart data is required');
    return { valid: false, errors };
  }

  if (!data.datasets || !Array.isArray(data.datasets)) {
    errors.push('datasets array is required');
    return { valid: false, errors };
  }

  if (data.datasets.length === 0) {
    errors.push('At least one dataset is required');
    return { valid: false, errors };
  }

  // Type-specific validation
  switch (type) {
    case 'bar':
    case 'line':
    case 'pie':
      if (!data.labels || data.labels.length === 0) {
        errors.push(`${type} charts require labels`);
      }
      data.datasets.forEach((dataset, index) => {
        if (!dataset.data || !Array.isArray(dataset.data)) {
          errors.push(`Dataset ${index} must have data array`);
        }
      });
      break;

    case 'scatter':
      data.datasets.forEach((dataset, index) => {
        if (!dataset.data || !Array.isArray(dataset.data)) {
          errors.push(`Dataset ${index} must have data array`);
        }
        if (Array.isArray(dataset.data) && dataset.data.length > 0) {
          const firstPoint = dataset.data[0];
          if (typeof firstPoint !== 'object' || !('x' in firstPoint) || !('y' in firstPoint)) {
            errors.push(`Dataset ${index} must have data points with x and y coordinates`);
          }
        }
      });
      break;

    case 'gantt':
      // Gantt charts use specialized data format, validated in gantt-chart.ts
      break;

    case 'heatmap':
      // Heatmap charts use specialized data format, validated in heatmap-chart.ts
      break;
  }

  return { valid: errors.length === 0, errors };
}

export function validateChartOptions(options: ChartOptions): ValidationResult {
  const errors: string[] = [];

  if (options.width && (options.width < 100 || options.width > 4000)) {
    errors.push('Width must be between 100 and 4000 pixels');
  }

  if (options.height && (options.height < 100 || options.height > 4000)) {
    errors.push('Height must be between 100 and 4000 pixels');
  }

  if (options.theme && !['light', 'dark', 'colorblind'].includes(options.theme)) {
    errors.push('Theme must be one of: light, dark, colorblind');
  }

  return { valid: errors.length === 0, errors };
}

export function validateChartConfig(
  type: ChartType,
  data: ChartData,
  options: ChartOptions
): ValidationResult {
  const errors: string[] = [];

  const typeValidation = validateChartType(type);
  if (!typeValidation.valid) {
    errors.push(...typeValidation.errors);
  }

  const dataValidation = validateChartData(type, data);
  if (!dataValidation.valid) {
    errors.push(...dataValidation.errors);
  }

  const optionsValidation = validateChartOptions(options);
  if (!optionsValidation.valid) {
    errors.push(...optionsValidation.errors);
  }

  return { valid: errors.length === 0, errors };
}
