# Chart Generator MCP Server

Generate PNG charts with multiple chart types, themes, and customization options.

## Features

- **6 Chart Types**: Bar, Line, Pie, Scatter, Gantt, Heatmap
- **3 Themes**: Light, Dark, Colorblind-friendly
- **PNG Output**: High-quality rendered images
- **Base64 Support**: Direct embedding in applications
- **Customizable**: Extensive options for styling and configuration

## Installation

```bash
cd src/mcp-servers/chart-generator
npm install
npm run build
```

## Usage

### MCP Tools

#### 1. generate_chart

Generate a chart image with specified configuration.

**Parameters:**
- `type` (required): Chart type - 'bar', 'line', 'pie', 'scatter', 'gantt', or 'heatmap'
- `data` (required): Chart data object
- `options` (optional): Chart options

**Example - Bar Chart:**
```json
{
  "type": "bar",
  "data": {
    "labels": ["Jan", "Feb", "Mar", "Apr"],
    "datasets": [{
      "label": "Sales",
      "data": [65, 59, 80, 81]
    }]
  },
  "options": {
    "title": "Monthly Sales",
    "width": 800,
    "height": 600,
    "theme": "light",
    "xAxisLabel": "Month",
    "yAxisLabel": "Revenue ($)"
  }
}
```

**Example - Gantt Chart:**
```json
{
  "type": "gantt",
  "data": [
    {
      "task": "Design Phase",
      "start": "2025-01-01",
      "end": "2025-01-15",
      "progress": 100
    },
    {
      "task": "Development",
      "start": "2025-01-16",
      "end": "2025-02-28",
      "progress": 45
    }
  ],
  "options": {
    "title": "Project Timeline",
    "theme": "dark"
  }
}
```

**Example - Heatmap:**
```json
{
  "type": "heatmap",
  "data": [
    { "x": "Mon", "y": "Morning", "value": 25 },
    { "x": "Mon", "y": "Afternoon", "value": 45 },
    { "x": "Tue", "y": "Morning", "value": 30 },
    { "x": "Tue", "y": "Afternoon", "value": 55 }
  ],
  "options": {
    "title": "Activity Heatmap",
    "theme": "colorblind"
  }
}
```

#### 2. list_chart_types

List all available chart types with descriptions and data formats.

#### 3. preview_chart_config

Validate chart configuration without rendering.

## Chart Types

### Bar Chart
- **Use**: Comparing categories
- **Data Format**: Labels + numeric datasets

### Line Chart
- **Use**: Trends over time
- **Data Format**: Labels + numeric datasets
- **Features**: Smooth curves, filled areas

### Pie Chart
- **Use**: Proportions and percentages
- **Data Format**: Labels + single dataset

### Scatter Plot
- **Use**: Correlations between variables
- **Data Format**: {x, y} coordinate pairs

### Gantt Chart
- **Use**: Project timelines and scheduling
- **Data Format**: Tasks with start/end dates and progress
- **Features**: Progress-based coloring

### Heatmap
- **Use**: Matrix data visualization
- **Data Format**: {x, y, value} cells
- **Features**: Color gradient based on values

## Themes

### Light
- White background
- Dark text
- Standard color palette

### Dark
- Dark background
- Light text
- Brighter color palette

### Colorblind
- Accessible color palette
- High contrast
- Distinguishable without color perception

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| title | string | - | Chart title |
| width | number | 800 | Width in pixels (100-4000) |
| height | number | 600 | Height in pixels (100-4000) |
| theme | string | 'light' | Theme name |
| legend | boolean | true | Show legend |
| xAxisLabel | string | - | X-axis label |
| yAxisLabel | string | - | Y-axis label |

## Output

Charts are saved to `~/.mcp/charts/` and returned with:
- **imagePath**: Full path to PNG file
- **imageBase64**: Base64 encoded image data
- **metadata**: Chart dimensions, type, and theme

## Configuration

Add to your MCP client configuration:

```json
{
  "chart-generator": {
    "command": "node",
    "args": ["/path/to/chart-generator/dist/index.js"]
  }
}
```

## Development

```bash
# Watch mode
npm run dev

# Build
npm run build

# Test
npm test

# Lint
npm run lint
```

## Dependencies

- **Chart.js**: Chart rendering engine
- **canvas**: Node.js canvas implementation
- **@modelcontextprotocol/sdk**: MCP server framework

## Examples

See `examples/` directory for complete working examples of each chart type.
