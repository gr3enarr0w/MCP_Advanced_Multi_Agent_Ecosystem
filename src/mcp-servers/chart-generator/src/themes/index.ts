/**
 * Chart Themes
 */

import type { ThemeName } from '../types/charts.js';

export interface Theme {
  backgroundColor: string;
  textColor: string;
  gridColor: string;
  colors: string[];
}

export const themes: Record<ThemeName, Theme> = {
  light: {
    backgroundColor: '#ffffff',
    textColor: '#333333',
    gridColor: '#e0e0e0',
    colors: [
      '#3b82f6', // blue
      '#10b981', // green
      '#f59e0b', // amber
      '#ef4444', // red
      '#8b5cf6', // purple
      '#ec4899', // pink
      '#14b8a6', // teal
      '#f97316', // orange
    ],
  },
  dark: {
    backgroundColor: '#1a1a1a',
    textColor: '#e0e0e0',
    gridColor: '#404040',
    colors: [
      '#60a5fa', // blue
      '#34d399', // green
      '#fbbf24', // amber
      '#f87171', // red
      '#a78bfa', // purple
      '#f472b6', // pink
      '#2dd4bf', // teal
      '#fb923c', // orange
    ],
  },
  colorblind: {
    backgroundColor: '#ffffff',
    textColor: '#333333',
    gridColor: '#e0e0e0',
    colors: [
      '#0173b2', // blue
      '#de8f05', // orange
      '#029e73', // green
      '#cc78bc', // purple
      '#ca9161', // brown
      '#fbafe4', // pink
      '#949494', // gray
      '#ece133', // yellow
    ],
  },
};

export function getTheme(themeName: ThemeName = 'light'): Theme {
  return themes[themeName];
}

export function applyThemeToOptions(options: any, themeName: ThemeName): any {
  const theme = getTheme(themeName);

  return {
    ...options,
    plugins: {
      ...options.plugins,
      legend: {
        ...options.plugins?.legend,
        labels: {
          ...options.plugins?.legend?.labels,
          color: theme.textColor,
        },
      },
      title: {
        ...options.plugins?.title,
        color: theme.textColor,
      },
    },
    scales: {
      ...options.scales,
      x: {
        ...options.scales?.x,
        ticks: {
          ...options.scales?.x?.ticks,
          color: theme.textColor,
        },
        grid: {
          ...options.scales?.x?.grid,
          color: theme.gridColor,
        },
      },
      y: {
        ...options.scales?.y,
        ticks: {
          ...options.scales?.y?.ticks,
          color: theme.textColor,
        },
        grid: {
          ...options.scales?.y?.grid,
          color: theme.gridColor,
        },
      },
    },
  };
}

export function applyThemeToData(data: any, themeName: ThemeName): any {
  const theme = getTheme(themeName);

  return {
    ...data,
    datasets: data.datasets.map((dataset: any, index: number) => ({
      ...dataset,
      backgroundColor:
        dataset.backgroundColor || theme.colors[index % theme.colors.length],
      borderColor: dataset.borderColor || theme.colors[index % theme.colors.length],
    })),
  };
}
