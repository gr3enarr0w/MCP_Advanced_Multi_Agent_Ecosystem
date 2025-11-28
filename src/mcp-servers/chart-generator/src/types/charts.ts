/**
 * Chart Generator Type Definitions
 */

export type ChartType = 'bar' | 'line' | 'pie' | 'scatter' | 'gantt' | 'heatmap';

export type ThemeName = 'light' | 'dark' | 'colorblind';

export interface ChartData {
  labels?: string[];
  datasets: Dataset[];
}

export interface Dataset {
  label: string;
  data: number[] | Point[] | GanttTask[] | HeatmapCell[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
  [key: string]: any; // Allow additional Chart.js properties
}

export interface Point {
  x: number;
  y: number;
}

export interface GanttTask {
  task: string;
  start: string | Date;
  end: string | Date;
  progress?: number;
}

export interface HeatmapCell {
  x: number | string;
  y: number | string;
  value: number;
}

export interface ChartOptions {
  title?: string;
  width?: number;
  height?: number;
  theme?: ThemeName;
  legend?: boolean;
  xAxisLabel?: string;
  yAxisLabel?: string;
  responsive?: boolean;
  maintainAspectRatio?: boolean;
  plugins?: any;
  scales?: any;
  [key: string]: any; // Allow additional Chart.js options
}

export interface ChartConfig {
  type: ChartType;
  data: ChartData;
  options: ChartOptions;
}

export interface RenderResult {
  success: boolean;
  imagePath?: string;
  imageBase64?: string;
  error?: string;
  metadata?: {
    width: number;
    height: number;
    type: ChartType;
    theme: ThemeName;
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
