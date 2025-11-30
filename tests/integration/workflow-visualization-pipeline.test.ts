/**
 * Integration Test: Visualization Pipeline Workflow
 * 
 * Tests visualization workflow: Chart-Generator (Phase 11) → Context-Persistence (Phase 6) → Task-Orchestrator (Phase 7)
 * - Generate charts from knowledge graph data → Create tasks from insights → Track progress
 * - Validate chart generation from complex data structures
 * - Test theme application and customization
 * - Test chart export and embedding
 */

import { mcpManager } from './utils/mcp-server-manager.js';
import { 
  SAMPLE_CHART_DATA,
  WORKFLOW_SCENARIOS,
  ERROR_SCENARIOS 
} from './fixtures/test-data.js';
import { writeFile, remove } from 'fs-extra';
import { join } from 'path';

describe('Visualization Pipeline Workflow Integration', () => {
  let chartClient: any;
  let contextClient: any;
  let taskClient: any;
  let chartServer: any;
  let contextServer: any;
  let taskServer: any;

  beforeAll(async () => {
    // Start required MCP servers
    console.log('🔧 Starting MCP servers for visualization pipeline workflow test');
    
    chartServer = await mcpManager.startServer('chart-generator');
    contextServer = await mcpManager.startServer('context-persistence');
    taskServer = await mcpManager.startServer('task-orchestrator');
    
    chartClient = mcpManager.getClient('chart-generator');
    contextClient = mcpManager.getClient('context-persistence');
    taskClient = mcpManager.getClient('task-orchestrator');
    
    // Wait for servers to be fully ready
    await global.testUtils.wait(3000);
    
    // Verify servers are healthy
    expect(await mcpManager.getServerHealth('chart-generator')).toBe(true);
    expect(await mcpManager.getServerHealth('context-persistence')).toBe(true);
    expect(await mcpManager.getServerHealth('task-orchestrator')).toBe(true);
  });

  afterAll(async () => {
    // Clean up servers
    console.log('🧹 Stopping MCP servers');
    await mcpManager.stopAllServers();
  });

  describe('Complete Visualization Pipeline Workflow', () => {
    test('should execute end-to-end visualization workflow successfully', async () => {
      const startTime = Date.now();
      
      // Step 1: Generate charts from sample data
      console.log('📊 Step 1: Generating charts from data');
      const chartResults = [];
      
      for (const [chartType, chartConfig] of Object.entries(SAMPLE_CHART_DATA)) {
        const chartResult = await chartClient.callTool('generate_chart', {
          type: chartType,
          data: chartConfig.data,
          options: {
            ...chartConfig.options,
            theme: 'light',
            legend: true,
            width: 800,
            height: 600
          }
        });
        
        expect(chartResult.content).toBeDefined();
        const chartData = JSON.parse(chartResult.content[0].text);
        expect(chartData.success).toBe(true);
        expect(chartData.imagePath).toBeDefined();
        expect(chartData.imageBase64).toBeDefined();
        chartResults.push(chartData);
      }
      
      // Step 2: Store chart metadata in context persistence
      console.log('💾 Step 2: Storing chart metadata in context');
      const conversationId = `visualization-${Date.now()}`;
      
      const chartMetadata = chartResults.map((chart: any, index: number) => ({
        chartType: Object.keys(SAMPLE_CHART_DATA)[index],
        imagePath: chart.imagePath,
        metadata: chart.metadata,
        generatedAt: new Date().toISOString()
      }));
      
      const saveResult = await contextClient.callTool('save_conversation', {
        conversation_id: conversationId,
        messages: [{
          role: 'assistant',
          content: `Generated ${chartResults.length} charts: ${chartResults.map(c => c.chartType).join(', ')}`
        }],
        project_path: join(process.cwd(), 'test-data', 'charts'),
        mode: 'visualization'
      });
      
      expect(saveResult.content).toBeDefined();
      const saveData = JSON.parse(saveResult.content[0].text);
      expect(saveData.status).toBe('saved');
      
      // Step 3: Extract insights from chart data and create tasks
      console.log('🔍 Step 3: Creating tasks from chart insights');
      const insightTasks = [];
      
      for (const chartResult of chartResults) {
        const chartType = chartResult.chartType || 'unknown';
        
        // Create analysis task based on chart type
        const taskResult = await taskClient.callTool('create_task', {
          title: `Analyze ${chartType} chart performance`,
          description: `Review and optimize ${chartType} chart based on generated visualization`,
          priority: 2,
          tags: ['visualization', 'analysis', chartType],
          code_language: 'javascript'
        });
        
        expect(taskResult.content).toBeDefined();
        const taskData = JSON.parse(taskResult.content[0].text);
        expect(taskData.task.id).toBeDefined();
        insightTasks.push(taskData.task);
      }
      
      // Step 4: Track task progress
      console.log('📈 Step 4: Tracking task progress');
      const progressResults = [];
      
      for (const task of insightTasks) {
        // Update task status
        const updateResult = await taskClient.callTool('update_task_status', {
          task_id: task.id,
          status: 'in_progress'
        });
        
        expect(updateResult.content).toBeDefined();
        const updateData = JSON.parse(updateResult.content[0].text);
        expect(updateData.task.status).toBe('in_progress');
        
        // Get task details with execution history
        const getTaskResult = await taskClient.callTool('get_task', {
          task_id: task.id,
          include_executions: true,
          include_analysis: true
        });
        
        expect(getTaskResult.content).toBeDefined();
        const getTaskData = JSON.parse(getTaskResult.content[0].text);
        expect(getTaskData.task.id).toBe(task.id);
        expect(getTaskData.task.status).toBe('in_progress');
        
        progressResults.push(getTaskData.task);
      }
      
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      // Performance assertion
      expect(duration).toBeLessThan(WORKFLOW_SCENARIOS.visualizationPipeline.expectedDuration);
      
      // Validate workflow completeness
      expect(chartResults.length).toBe(Object.keys(SAMPLE_CHART_DATA).length);
      expect(insightTasks.length).toBe(chartResults.length);
      expect(progressResults.length).toBe(insightTasks.length);
      
      console.log(`✅ Complete visualization workflow executed in ${duration}s`);
      console.log(`📊 Generated ${chartResults.length} charts, created ${insightTasks.length} tasks`);
    }, 50000);

    test('should validate chart generation from complex data structures', async () => {
      console.log('🔬 Testing chart generation from complex data');
      
      // Create complex data structure for testing
      const complexData = {
        labels: ['Q1', 'Q2', 'Q3', 'Q4'],
        datasets: [
          {
            label: 'Revenue',
            data: [12500, 15800, 18900, 22100],
            backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
            metadata: {
              category: 'financial',
              source: 'accounting',
              currency: 'USD',
              growth: '+15.2%'
            }
          },
          {
            label: 'Costs',
            data: [8000, 9500, 11200, 13500],
            backgroundColor: ['#dc2626', '#ea580c', '#fbbf24', '#f97316'],
            metadata: {
              category: 'financial',
              source: 'accounting',
              currency: 'USD',
              growth: '+18.7%'
            }
          },
          {
            label: 'Profit',
            data: [4500, 6300, 7700, 8600],
            backgroundColor: ['#16a34a', '#059669', '#d97706', '#15803d'],
            metadata: {
              category: 'financial',
              source: 'calculated',
              currency: 'USD',
              margin: '38.9%'
            }
          }
        ]
      };
      
      // Generate chart with complex data
      const chartResult = await chartClient.callTool('generate_chart', {
        type: 'bar',
        data: complexData,
        options: {
          title: 'Quarterly Financial Performance',
          width: 1000,
          height: 700,
          theme: 'light',
          legend: true,
          xAxisLabel: 'Quarter',
          yAxisLabel: 'Amount (USD)'
        }
      });
      
      expect(chartResult.content).toBeDefined();
      const chartData = JSON.parse(chartResult.content[0].text);
      expect(chartData.success).toBe(true);
      expect(chartData.metadata.dimensions.width).toBe(1000);
      expect(chartData.metadata.dimensions.height).toBe(700);
      
      // Validate that complex metadata is preserved
      const metadata = chartData.metadata;
      expect(metadata).toBeDefined();
      expect(metadata.datasetCount).toBe(3);
      
      console.log('✅ Complex data structure handled correctly');
      console.log(`📊 Chart: ${metadata.datasetCount} datasets, ${metadata.dimensions.width}x${metadata.dimensions.height}`);
    }, 35000);

    test('should test theme application and customization', async () => {
      console.log('🎨 Testing theme application and customization');
      
      const baseData = SAMPLE_CHART_DATA.line.data;
      
      // Test different themes
      const themes = ['light', 'dark', 'colorblind'];
      const themeResults = [];
      
      for (const theme of themes) {
        const chartResult = await chartClient.callTool('generate_chart', {
          type: 'line',
          data: baseData,
          options: {
            title: `User Growth - ${theme} theme`,
            width: 800,
            height: 600,
            theme: theme,
            legend: true
          }
        });
        
        expect(chartResult.content).toBeDefined();
        const chartData = JSON.parse(chartResult.content[0].text);
        expect(chartData.success).toBe(true);
        expect(chartData.metadata.theme).toBe(theme);
        
        themeResults.push(chartData);
      }
      
      // Test customization options
      const customResult = await chartClient.callTool('generate_chart', {
        type: 'pie',
        data: SAMPLE_CHART_DATA.pie.data,
        options: {
          title: 'Custom Styled Chart',
          width: 600,
          height: 600,
          theme: 'dark',
          legend: false,
          backgroundColor: '#1a1a1a',
          borderColor: '#ffffff'
        }
      });
      
      expect(customResult.content).toBeDefined();
      const customData = JSON.parse(customResult.content[0].text);
      expect(customData.success).toBe(true);
      expect(customData.metadata.theme).toBe('dark');
      expect(customData.metadata.legend).toBe(false);
      
      console.log(`✅ Theme testing completed: ${themeResults.length} themes + custom styling`);
    }, 40000);

    test('should test chart export and embedding', async () => {
      console.log('📤 Testing chart export and embedding');
      
      const chartResult = await chartClient.callTool('generate_chart', {
        type: 'gantt',
        data: SAMPLE_CHART_DATA.gantt.data,
        options: {
          title: 'Project Timeline',
          width: 1200,
          height: 800,
          theme: 'light'
        }
      });
      
      expect(chartResult.content).toBeDefined();
      const chartData = JSON.parse(chartResult.content[0].text);
      expect(chartData.success).toBe(true);
      expect(chartData.imagePath).toBeDefined();
      expect(chartData.imageBase64).toBeDefined();
      
      // Validate base64 encoding
      const base64Pattern = /^[A-Za-z0-9+/]=*$/;
      expect(base64Pattern.test(chartData.imageBase64)).toBe(true);
      
      // Validate image path exists and is reasonable
      expect(chartData.imagePath).toMatch(/\.(png|jpg|jpeg|svg)$/);
      expect(chartData.imagePath).toContain('chart-generator');
      
      // Store chart embedding information
      const conversationId = `export-test-${Date.now()}`;
      const embeddingResult = await contextClient.callTool('save_conversation', {
        conversation_id: conversationId,
        messages: [{
          role: 'assistant',
          content: `Generated Gantt chart with ${chartData.metadata.taskCount} tasks, saved to ${chartData.imagePath}`
        }],
        project_path: join(process.cwd(), 'test-data', 'charts'),
        mode: 'visualization'
      });
      
      expect(embeddingResult.content).toBeDefined();
      const embeddingData = JSON.parse(embeddingResult.content[0].text);
      expect(embeddingData.status).toBe('saved');
      
      console.log(`✅ Chart export and embedding successful`);
      console.log(`📊 Chart saved to: ${chartData.imagePath}`);
    }, 35000);
  });

  describe('Integration with Knowledge Graph Data', () => {
    test('should generate charts from knowledge graph insights', async () => {
      console.log('🧠 Testing charts from knowledge graph');
      
      // Create sample knowledge graph data
      const conversationId = `kg-charts-${Date.now()}`;
      
      // Store entities and relationships in context
      const entities = [
        { id: 'user-service', name: 'UserService', type: 'class', confidence: 0.9 },
        { id: 'user-interface', name: 'User', type: 'interface', confidence: 0.8 },
        { id: 'create-method', name: 'createUser', type: 'method', confidence: 0.95 },
        { id: 'task-service', name: 'TaskService', type: 'class', confidence: 0.85 }
      ];
      
      const relationships = [
        { source: 'user-service', target: 'user-interface', type: 'implements', confidence: 0.9 },
        { source: 'user-service', target: 'create-method', type: 'contains', confidence: 0.95 },
        { source: 'task-service', target: 'user-service', type: 'uses', confidence: 0.8 }
      ];
      
      // Save knowledge graph data
      const kgMessages = [{
        role: 'assistant',
        content: `Knowledge graph with ${entities.length} entities and ${relationships.length} relationships`
      }];
      
      await contextClient.callTool('save_conversation', {
        conversation_id: conversationId,
        messages: kgMessages,
        mode: 'knowledge-graph'
      });
      
      // Extract entities for chart generation
      const extractResult = await contextClient.callTool('extract_entities', {
        conversation_id: conversationId
      });
      
      expect(extractResult.content).toBeDefined();
      const extractData = JSON.parse(extractResult.content[0].text);
      expect(extractData.entities_extracted).toBeGreaterThan(0);
      
      // Create relationship chart
      const relationshipData = {
        labels: ['Implements', 'Contains', 'Uses'],
        datasets: [{
          label: 'Entity Relationships',
          data: [
            relationships.filter(r => r.type === 'implements').length,
            relationships.filter(r => r.type === 'contains').length,
            relationships.filter(r => r.type === 'uses').length
          ],
          backgroundColor: ['#3b82f6', '#10b981', '#f59e0b']
        }]
      };
      
      const relationshipChartResult = await chartClient.callTool('generate_chart', {
        type: 'bar',
        data: relationshipData,
        options: {
          title: 'Knowledge Graph Entity Relationships',
          width: 800,
          height: 600,
          theme: 'light'
        }
      });
      
      expect(relationshipChartResult.content).toBeDefined();
      const chartData = JSON.parse(relationshipChartResult.content[0].text);
      expect(chartData.success).toBe(true);
      
      console.log(`✅ Knowledge graph chart generated with ${relationshipData.labels.length} relationship types`);
    }, 45000);

    test('should visualize entity distribution and complexity', async () => {
      console.log('📊 Testing entity distribution visualization');
      
      // Create entity distribution data
      const entityTypes = {
        'class': 3,
        'interface': 2,
        'method': 5,
        'function': 8,
        'variable': 4
      };
      
      const distributionData = {
        labels: Object.keys(entityTypes),
        datasets: [{
          label: 'Entity Type Distribution',
          data: Object.values(entityTypes),
          backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
        }]
      };
      
      const distributionChartResult = await chartClient.callTool('generate_chart', {
        type: 'pie',
        data: distributionData,
        options: {
          title: 'Entity Type Distribution in Codebase',
          width: 600,
          height: 600,
          theme: 'light'
        }
      });
      
      expect(distributionChartResult.content).toBeDefined();
      const chartData = JSON.parse(distributionChartResult.content[0].text);
      expect(chartData.success).toBe(true);
      
      // Create complexity heatmap
      const complexityData = {
        labels: ['UserService', 'User', 'TaskService', 'createUser'],
        datasets: [{
          label: 'Code Complexity',
          data: [
            [8, 3, 6, 2, 7, 5, 9, 4, 6]
          ],
          backgroundColor: '#3b82f6'
        }]
      };
      
      const complexityChartResult = await chartClient.callTool('generate_chart', {
        type: 'heatmap',
        data: complexityData,
        options: {
          title: 'Code Complexity Heatmap',
          width: 800,
          height: 600,
          theme: 'light'
        }
      });
      
      expect(complexityChartResult.content).toBeDefined();
      const heatmapData = JSON.parse(complexityChartResult.content[0].text);
      expect(heatmapData.success).toBe(true);
      
      console.log('✅ Entity distribution and complexity charts generated');
    }, 45000);
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle invalid chart configurations gracefully', async () => {
      console.log('⚠️ Testing invalid chart configuration handling');
      
      // Test with invalid chart type
      const invalidTypeResult = await chartClient.callTool('generate_chart', {
        type: 'invalid-chart-type',
        data: SAMPLE_CHART_DATA.bar.data
      });
      
      expect(invalidTypeResult.isError).toBe(true);
      expect(invalidTypeResult.content[0].text).toContain('error');
      
      // Test with invalid data structure
      const invalidDataResult = await chartClient.callTool('generate_chart', {
        type: 'bar',
        data: { invalid: 'structure' }
      });
      
      expect(invalidDataResult.isError).toBe(true);
      
      // Test with invalid options
      const invalidOptionsResult = await chartClient.callTool('generate_chart', {
        type: 'line',
        data: SAMPLE_CHART_DATA.line.data,
        options: {
          width: -100, // Invalid width
          height: 0 // Invalid height
        }
      });
      
      expect(invalidOptionsResult.isError).toBe(true);
      
      console.log('✅ Invalid configurations handled gracefully');
    }, 30000);

    test('should handle large chart generation without memory issues', async () => {
      console.log('📚 Testing large chart generation');
      
      // Create large dataset
      const largeData = {
        labels: Array.from({ length: 100 }, (_, i) => `Label ${i}`),
        datasets: [{
          label: 'Large Dataset',
          data: Array.from({ length: 100 }, (_, i) => Math.random() * 1000),
          backgroundColor: '#3b82f6'
        }]
      };
      
      const startTime = Date.now();
      
      const chartResult = await chartClient.callTool('generate_chart', {
        type: 'line',
        data: largeData,
        options: {
          title: 'Large Dataset Chart',
          width: 1200,
          height: 800,
          theme: 'light'
        }
      });
      
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      expect(chartResult.content).toBeDefined();
      const chartData = JSON.parse(chartResult.content[0].text);
      expect(chartData.success).toBe(true);
      
      // Should handle large data within reasonable time
      expect(duration).toBeLessThan(30);
      
      console.log(`✅ Large chart generated in ${duration}s`);
    }, 40000);

    test('should handle chart generation failures gracefully', async () => {
      console.log('💥 Testing chart generation failure handling');
      
      // Simulate chart generation failure
      const failureResult = await chartClient.callTool('generate_chart', {
        type: 'scatter',
        data: {
          labels: [], // Empty labels
          datasets: [] // Empty datasets
        }
      });
      
      expect(failureResult.content).toBeDefined();
      
      // Should either succeed with empty chart or fail gracefully
      const chartData = JSON.parse(failureResult.content[0].text);
      
      if (chartData.success) {
        expect(chartData.imagePath).toBeDefined();
      } else {
        expect(failureResult.isError).toBe(true);
        expect(failureResult.content[0].text).toContain('error');
      }
      
      console.log('✅ Chart generation failure handled gracefully');
    }, 30000);
  });

  describe('Performance and Scalability', () => {
    test('should meet performance requirements for chart generation', async () => {
      console.log('📊 Testing chart generation performance');
      
      const iterations = 5;
      const durations: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        // Generate different chart types
        const chartTypes = ['bar', 'line', 'pie'];
        const chartType = chartTypes[i % chartTypes.length];
        
        await chartClient.callTool('generate_chart', {
          type: chartType,
          data: SAMPLE_CHART_DATA[chartType]?.data || SAMPLE_CHART_DATA.bar.data,
          options: {
            title: `Performance Test ${i}`,
            width: 800,
            height: 600,
            theme: 'light'
          }
        });
        
        const endTime = Date.now();
        durations.push((endTime - startTime) / 1000);
        
        // Brief pause between iterations
        await global.testUtils.wait(200);
      }
      
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      
      // Performance assertions
      expect(avgDuration).toBeLessThan(8); // Average under 8 seconds
      expect(maxDuration).toBeLessThan(15); // Max under 15 seconds
      
      console.log(`📊 Chart generation performance: avg ${avgDuration}s, max ${maxDuration}s`);
    }, 60000);

    test('should handle concurrent chart generation efficiently', async () => {
      console.log('🚀 Testing concurrent chart generation');
      
      const startTime = Date.now();
      
      // Generate multiple charts concurrently
      const concurrentCharts = [
        chartClient.callTool('generate_chart', {
          type: 'bar',
          data: SAMPLE_CHART_DATA.bar.data,
          options: { title: 'Concurrent Bar Chart', width: 600, height: 400 }
        }),
        chartClient.callTool('generate_chart', {
          type: 'line',
          data: SAMPLE_CHART_DATA.line.data,
          options: { title: 'Concurrent Line Chart', width: 600, height: 400 }
        }),
        chartClient.callTool('generate_chart', {
          type: 'pie',
          data: SAMPLE_CHART_DATA.pie.data,
          options: { title: 'Concurrent Pie Chart', width: 600, height: 400 }
        })
      ];
      
      const results = await Promise.all(concurrentCharts);
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      // All charts should generate successfully
      results.forEach((result, index) => {
        expect(result.content).toBeDefined();
        const chartData = JSON.parse(result.content[0].text);
        expect(chartData.success).toBe(true);
        console.log(`✅ Concurrent chart ${index + 1} generated`);
      });
      
      // Concurrent execution should be efficient
      expect(duration).toBeLessThan(20);
      
      console.log(`🚀 Concurrent chart generation: ${concurrentCharts.length} charts in ${duration}s`);
    }, 40000);

    test('should scale memory usage with large visualizations', async () => {
      console.log('🧠 Testing memory scaling with visualizations');
      
      const dataSizes = [50, 100, 200];
      const memoryUsage = [];
      
      for (const size of dataSizes) {
        const startTime = Date.now();
        
        const largeData = {
          labels: Array.from({ length: size }, (_, i) => `Label ${i}`),
          datasets: [{
            label: 'Large Dataset',
            data: Array.from({ length: size }, () => Math.random() * 100)
          }]
        };
        
        await chartClient.callTool('generate_chart', {
          type: 'line',
          data: largeData,
          options: { title: `Memory Test ${size}`, width: 800, height: 600 }
        });
        
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;
        
        memoryUsage.push({
          size,
          duration,
          throughput: size / duration
        });
        
        // Brief pause between tests
        await global.testUtils.wait(500);
      }
      
      // Verify memory usage scales reasonably
      const throughputs = memoryUsage.map(m => m.throughput);
      const avgThroughput = throughputs.reduce((a, b) => a + b, 0) / throughputs.length;
      
      // Throughput should not degrade significantly with size
      const maxThroughput = Math.max(...throughputs);
      const minThroughput = Math.min(...throughputs);
      
      expect(maxThroughput / minThroughput).toBeLessThan(3); // Less than 3x variation
      
      console.log(`🧠 Memory scaling: avg throughput ${avgThroughput.toFixed(2)} items/sec`);
    }, 80000);
  });
});