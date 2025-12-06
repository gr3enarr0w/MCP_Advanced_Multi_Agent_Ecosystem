# Quick Start Guide

## Overview

The MCP Advanced Multi-Agent Ecosystem is a comprehensive platform for building intelligent, multi-agent applications. This guide will get you up and running with your first multi-agent workflow in minutes.

## Prerequisites

### System Requirements

- **Node.js**: 18+ or TypeScript 5.0+
- **Python**: 3.12+ (for Context-Persistence server)
- **Memory**: Minimum 8GB RAM, 16GB recommended
- **Storage**: Minimum 10GB free disk space
- **Network**: Stable internet connection for API calls

### Required Accounts and Services

1. **GitHub Account**: For git operations and MCP server hosting
2. **AI Service Accounts**: At least one of:
   - OpenAI (GPT-4, GPT-3.5-turbo)
   - Anthropic (Claude-3 Sonnet, Claude-3 Opus)
   - Perplexity (for search capabilities)
3. **Search Providers** (optional but recommended):
   - Brave Search API
   - Tavily Search API
   - DuckDuckGo (free)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/mcp-advanced-multi-agent-ecosystem.git
cd mcp-advanced-multi-agent-ecosystem
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit with your configuration
nano .env
```

**Required Environment Variables:**

```bash
# Core Configuration
MCP_ENV=development
LOG_LEVEL=info

# AI Services
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key

# Search Providers
BRAVE_API_KEY=your-brave-api-key
TAVILY_API_KEY=your-tavily-api-key
PERPLEXITY_API_KEY=your-perplexity-api-key

# Database Configuration
CONTEXT_DB_URL=sqlite:///context.db
VECTOR_DB_URL=localhost:6333

# Server URLs
TASK_ORCHESTRATOR_URL=http://localhost:3001
SEARCH_AGGREGATOR_URL=http://localhost:3002
AGENT_SWARM_URL=http://localhost:3003
CODE_INTELLIGENCE_URL=http://localhost:3004
CHART_GENERATOR_URL=http://localhost:3005
```

### 3. Install Dependencies

```bash
# Run the setup script
./scripts/setup.sh

# Install MCP servers
./scripts/install-mcp-servers.sh

# Test installation
./scripts/test-installation.sh
```

### 4. Start the Services

```bash
# Start all MCP servers
./scripts/start-all-servers.sh

# Or start individual servers
npm run start:context-persistence &
npm run start:task-orchestrator &
npm run start:search-aggregator &
npm run start:agent-swarm &
npm run start:code-intelligence &
npm run start:chart-generator &

# Check if all services are running
./scripts/health-check.sh
```

## Your First Multi-Agent Workflow

### Step 1: Research and Task Creation

Let's create a workflow that researches a topic and generates actionable tasks:

```typescript
// research-to-tasks.ts
import { 
  TaskOrchestratorClient,
  SearchAggregatorClient 
} from '@mcp-ecosystem/typescript-sdk';

async function researchAndCreateTasks() {
  // Initialize clients
  const taskClient = new TaskOrchestratorClient({
    baseUrl: process.env.TASK_ORCHESTRATOR_URL || 'http://localhost:3001',
    llmConfig: {
      provider: 'openai',
      model: 'gpt-4-turbo-preview',
      apiKey: process.env.OPENAI_API_KEY
    }
  });

  const searchClient = new SearchAggregatorClient({
    baseUrl: process.env.SEARCH_AGGREGATOR_URL || 'http://localhost:3002',
    providers: ['brave', 'tavily'],
    providerConfig: {
      brave: {
        apiKey: process.env.BRAVE_API_KEY
      },
      tavily: {
        apiKey: process.env.TAVILY_API_KEY
      }
    }
  });

  try {
    // 1. Research the topic
    console.log('🔍 Researching: AI trends in software development...');
    const research = await searchClient.executeParallelSearch({
      query: 'AI trends in software development 2024',
      providers: ['brave', 'tavily'],
      maxResultsPerProvider: 10,
      timeout: 30000
    });

    console.log(`📊 Found ${research.totalResults} research results`);

    // 2. Parse research into PRD
    console.log('📋 Parsing research into product requirements...');
    const prd = await taskClient.parsePRD({
      content: formatResearchAsPRD(research.results),
      extractRequirements: true,
      extractDependencies: true,
      extractTimeline: true
    });

    console.log(`📝 Extracted ${prd.prd.requirements.length} requirements`);

    // 3. Expand requirements into tasks
    console.log('🔄 Expanding requirements into actionable tasks...');
    const expanded = await taskClient.expandTasks({
      tasks: prd.prd.tasks,
      expansionLevel: 'comprehensive',
      includeDependencies: true,
      maxDepth: 3
    });

    console.log(`✅ Created ${expanded.expanded_tasks.length} actionable tasks`);

    // 4. Select high-priority tasks
    console.log('🎯 Selecting high-priority tasks for execution...');
    const selected = await taskClient.selectTasks({
      criteria: {
        priority: ['high', 'critical'],
        estimatedHours: { max: 40 }
      },
      limit: 5
    });

    console.log(`🚀 Selected ${selected.selected_tasks.length} tasks for execution`);

    return {
      research,
      prd,
      expandedTasks: expanded.expanded_tasks,
      selectedTasks: selected.selected_tasks
    };

  } catch (error) {
    console.error('❌ Workflow failed:', error.message);
    throw error;
  }
}

function formatResearchAsPRD(results: any[]): string {
  return `
# AI Trends in Software Development - 2024

## Executive Summary
${results.map(r => `- ${r.title}: ${r.snippet}`).join('\n')}

## Key Trends Identified
${extractKeyTrends(results)}

## Requirements Analysis
Based on the research, we identify the following requirements:

### Functional Requirements
1. **AI Integration**: Integrate AI capabilities for code generation and analysis
2. **Trend Monitoring**: Monitor and adapt to emerging AI trends
3. **Developer Tools**: Create tools that leverage AI for productivity

### Technical Requirements
1. **Multi-language Support**: Support TypeScript, Python, and JavaScript
2. **API Integration**: Connect to multiple AI providers
3. **Performance**: Optimize for speed and resource efficiency

### Timeline
- **Phase 1** (2 weeks): Research and Planning
- **Phase 2** (4 weeks): Core AI Integration
- **Phase 3** (2 weeks): Advanced Features
- **Phase 4** (2 weeks): Testing and Optimization

## Proposed Tasks
### Task 1: AI Integration Framework
- **Priority**: Critical
- **Estimated Hours**: 40
- **Description**: Create a framework for integrating multiple AI providers
- **Dependencies**: Research completion

### Task 2: Trend Analysis Module
- **Priority**: High
- **Estimated Hours**: 24
- **Description**: Build module to analyze and track AI trends
- **Dependencies**: AI Integration Framework

### Task 3: Developer Assistant Tools
- **Priority**: High
- **Estimated Hours**: 32
- **Description**: Create AI-powered developer assistance tools
- **Dependencies**: Trend Analysis Module

## Success Criteria
- Integration with at least 2 AI providers
- Response time under 2 seconds for AI operations
- 95% accuracy in trend identification
  `;
}

function extractKeyTrends(results: any[]): string {
  const trends = [
    'AI-powered development tools',
    'Multi-modal AI applications',
    'AI in code review and testing',
    'Low-code/no-code AI platforms',
    'AI for documentation and knowledge management'
  ];

  return trends.map(trend => `- ${trend}`).join('\n');
}

// Run the workflow
researchAndCreateTasks()
  .then(result => {
    console.log('🎉 Workflow completed successfully!');
    console.log('📊 Summary:', {
      researchResults: result.research.totalResults,
      requirementsFound: result.prd.prd.requirements.length,
      tasksCreated: result.expandedTasks.length,
      tasksSelected: result.selectedTasks.length
    });
  })
  .catch(console.error);
```

### Step 2: Run the Workflow

```bash
# Save the workflow file
cat > research-to-tasks.ts << 'EOF'
[Paste the TypeScript code from above]
EOF

# Run the workflow
npx ts-node research-to-tasks.ts
```

### Step 3: Agent Swarm Orchestration

Now let's create an agent swarm to execute the tasks:

```typescript
// agent-execution.ts
import { AgentSwarmClient, TaskOrchestratorClient } from '@mcp-ecosystem/typescript-sdk';

async function executeWithAgentSwarm(taskIds: number[]) {
  const swarmClient = new AgentSwarmClient({
    baseUrl: process.env.AGENT_SWARM_URL || 'http://localhost:3003',
    llmProvider: 'anthropic',
    defaultTopology: 'hierarchical',
    llmConfig: {
      provider: 'anthropic',
      model: 'claude-3-sonnet-20240229',
      apiKey: process.env.ANTHROPIC_API_KEY
    }
  });

  const taskClient = new TaskOrchestratorClient({
    baseUrl: process.env.TASK_ORCHESTRATOR_URL || 'http://localhost:3001'
  });

  try {
    // 1. Create swarm session
    console.log('🐝 Creating agent swarm session...');
    const session = await swarmClient.createSession({
      name: 'AI Development Task Execution',
      topology: 'hierarchical',
      memoryTier: 'persistent',
      workerConfig: {
        maxWorkers: 5,
        defaultCapabilities: ['analysis', 'development', 'testing']
      }
    });

    console.log(`📊 Session created: ${session.sessionId}`);

    // 2. Spawn specialized workers
    const workers = [];
    for (const taskId of taskIds) {
      const task = await taskClient.getTask(taskId);
      
      console.log(`🤖 Spawning worker for task: ${task.title}`);
      const worker = await swarmClient.spawnWorker({
        sessionId: session.sessionId,
        workerType: determineWorkerType(task),
        task: {
          id: task.id,
          title: task.title,
          description: task.description,
          priority: task.priority
        },
        requiredCapabilities: getRequiredCapabilities(task)
      });

      workers.push(worker);
      console.log(`✅ Worker spawned: ${worker.workerId}`);
    }

    // 3. Monitor execution
    console.log('📈 Monitoring task execution...');
    const results = [];
    
    for (const worker of workers) {
      const delegation = await swarmClient.delegateTask({
        sessionId: session.sessionId,
        task: {
          id: worker.task.id,
          title: worker.task.title,
          description: worker.task.description
        },
        targetWorkerId: worker.workerId,
        timeout: 3600000 // 1 hour
      });

      // Monitor progress
      let status = await swarmClient.getDelegationStatus(delegation.delegationId);
      
      while (status.status === 'in_progress' && status.progress < 100) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Check every 5 seconds
        status = await swarmClient.getDelegationStatus(delegation.delegationId);
        console.log(`📊 Task ${worker.task.title}: ${status.progress}%`);
      }

      const result = await swarmClient.getDelegationStatus(delegation.delegationId);
      results.push({
        taskId: worker.task.id,
        workerId: worker.workerId,
        status: result.status,
        output: result.output,
        executionTime: result.executionTime
      });

      console.log(`✅ Task completed: ${worker.task.title}`);
    }

    // 4. Generate summary report
    console.log('📋 Generating execution summary...');
    const summary = generateExecutionSummary(results);

    // Clean up
    await swarmClient.deleteSession(session.sessionId);
    console.log('🧹 Session cleaned up');

    return summary;

  } catch (error) {
    console.error('❌ Agent execution failed:', error.message);
    throw error;
  }
}

function determineWorkerType(task: any): string {
  if (task.title.toLowerCase().includes('framework')) return 'architect';
  if (task.title.toLowerCase().includes('analysis')) return 'analyst';
  if (task.title.toLowerCase().includes('tools')) return 'developer';
  return 'generalist';
}

function getRequiredCapabilities(task: any): string[] {
  const capabilities = [];
  
  if (task.title.toLowerCase().includes('ai')) capabilities.push('ai-integration');
  if (task.title.toLowerCase().includes('trend')) capabilities.push('trend-analysis');
  if (task.title.toLowerCase().includes('development')) capabilities.push('development');
  
  return capabilities;
}

function generateExecutionSummary(results: any[]): string {
  const completed = results.filter(r => r.status === 'completed');
  const failed = results.filter(r => r.status === 'failed');
  const totalTime = results.reduce((sum, r) => sum + (r.executionTime || 0), 0);

  return `
# Agent Swarm Execution Summary

## Overview
- Total Tasks: ${results.length}
- Completed: ${completed.length}
- Failed: ${failed.length}
- Total Execution Time: ${totalTime}ms

## Task Results
${completed.map(r => `
### ✅ ${r.taskId}: ${r.taskId}
- **Status**: ${r.status}
- **Worker**: ${r.workerId}
- **Execution Time**: ${r.executionTime}ms
- **Output**: ${r.output ? r.output.substring(0, 200) + '...' : 'No output'}
`).join('\n')}

${failed.length > 0 ? `
## Failed Tasks
${failed.map(r => `
### ❌ ${r.taskId}: ${r.taskId}
- **Error**: ${r.status}
- **Worker**: ${r.workerId}
`).join('\n')}
` : ''}

## Performance Metrics
- Average Task Time: ${totalTime / results.length}ms
- Success Rate: ${((completed.length / results.length) * 100).toFixed(1)}%
- Agent Efficiency: ${calculateEfficiency(results)}
  `;
}

function calculateEfficiency(results: any[]): string {
  const avgTime = results.reduce((sum, r) => sum + (r.executionTime || 0), 0) / results.length;
  const optimalTime = 30000; // 30 seconds per task
  const efficiency = Math.min(100, (optimalTime / avgTime) * 100);
  
  return `${efficiency.toFixed(1)}%`;
}

// Execute with sample task IDs
executeWithAgentSwarm([1, 2, 3])
  .then(summary => {
    console.log('🎉 Agent execution completed!');
    console.log(summary);
  })
  .catch(console.error);
```

### Step 4: Visualization

Let's create charts to visualize the results:

```typescript
// visualization.ts
import { ChartGeneratorClient } from '@mcp-ecosystem/typescript-sdk';

async function createVisualizationCharts(executionResults: any[]) {
  const chartClient = new ChartGeneratorClient({
    baseUrl: process.env.CHART_GENERATOR_URL || 'http://localhost:3005',
    defaultTheme: 'light'
  });

  try {
    // 1. Task completion chart
    console.log('📊 Creating task completion chart...');
    const completionData = prepareCompletionData(executionResults);
    const completionChart = await chartClient.generateChart({
      type: 'bar',
      data: completionData,
      options: {
        title: 'Task Completion Status',
        width: 800,
        height: 600,
        xAxisLabel: 'Tasks',
        yAxisLabel: 'Count',
        legend: true,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      },
      filename: 'task-completion.png'
    });

    console.log(`✅ Completion chart created: ${completionChart.chartId}`);

    // 2. Execution time chart
    console.log('⏱️ Creating execution time chart...');
    const timeData = prepareTimeData(executionResults);
    const timeChart = await chartClient.generateChart({
      type: 'line',
      data: timeData,
      options: {
        title: 'Task Execution Times',
        width: 800,
        height: 600,
        xAxisLabel: 'Tasks',
        yAxisLabel: 'Time (ms)',
        legend: true,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      },
      filename: 'execution-times.png'
    });

    console.log(`✅ Time chart created: ${timeChart.chartId}`);

    // 3. Success rate pie chart
    console.log('🥧 Creating success rate chart...');
    const successData = prepareSuccessData(executionResults);
    const successChart = await chartClient.generateChart({
      type: 'pie',
      data: successData,
      options: {
        title: 'Task Success Rate',
        width: 800,
        height: 600,
        legend: true
      },
      filename: 'success-rate.png'
    });

    console.log(`✅ Success chart created: ${successChart.chartId}`);

    return {
      completionChart: completionChart.chartId,
      timeChart: timeChart.chartId,
      successChart: successChart.chartId
    };

  } catch (error) {
    console.error('❌ Visualization failed:', error.message);
    throw error;
  }
}

function prepareCompletionData(results: any[]) {
  const completed = results.filter(r => r.status === 'completed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  
  return {
    labels: ['Completed', 'Failed'],
    datasets: [{
      label: 'Task Status',
      data: [completed, failed],
      backgroundColor: ['rgba(75, 192, 192, 0.6)', 'rgba(255, 99, 132, 0.6)'],
      borderColor: ['rgba(75, 192, 192, 1)', 'rgba(255, 99, 132, 1)'],
      borderWidth: 2
    }]
  };
}

function prepareTimeData(results: any[]) {
  const times = results
    .filter(r => r.executionTime)
    .map(r => r.executionTime || 0);

  return {
    labels: results.map((_, i) => `Task ${i + 1}`),
    datasets: [{
      label: 'Execution Time (ms)',
      data: times,
      backgroundColor: 'rgba(54, 162, 235, 0.6)',
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 2,
      fill: false,
      tension: 0.1
    }]
  };
}

function prepareSuccessData(results: any[]) {
  const completed = results.filter(r => r.status === 'completed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  
  return {
    labels: ['Completed', 'Failed'],
    datasets: [{
      label: 'Tasks',
      data: [completed, failed],
      backgroundColor: ['rgba(75, 192, 192, 0.6)', 'rgba(255, 99, 132, 0.6)'],
      borderColor: ['rgba(75, 192, 192, 1)', 'rgba(255, 99, 132, 1)'],
      borderWidth: 2
    }]
  };
}

// Create visualizations
createVisualizationCharts(mockExecutionResults)
  .then(charts => {
    console.log('🎉 All visualizations created!');
    console.log('📊 Chart IDs:', {
      completion: charts.completionChart,
      time: charts.timeChart,
      success: charts.successChart
    });
  })
  .catch(console.error);

function mockExecutionResults(): any[] {
  return [
    {
      taskId: 1,
      workerId: 'worker-1',
      status: 'completed',
      executionTime: 25000,
      output: 'AI framework successfully implemented'
    },
    {
      taskId: 2,
      workerId: 'worker-2',
      status: 'completed',
      executionTime: 18000,
      output: 'Trend analysis module completed'
    },
    {
      taskId: 3,
      workerId: 'worker-3',
      status: 'failed',
      executionTime: 30000,
      output: 'Task failed due to API rate limit'
    }
  ];
}
```

## Verification

### Check System Status

```bash
# Check all services
./scripts/health-check.sh

# Expected output:
# ✅ Task Orchestrator: healthy (http://localhost:3001)
# ✅ Search Aggregator: healthy (http://localhost:3002)
# ✅ Agent Swarm: healthy (http://localhost:3003)
# ✅ Code Intelligence: healthy (http://localhost:3004)
# ✅ Chart Generator: healthy (http://localhost:3005)
```

### Test Individual Components

```bash
# Test Context Persistence
curl -X POST http://localhost:3000/health

# Test Task Creation
curl -X POST http://localhost:3001/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Task",
    "description": "Test Description",
    "priority": "medium"
  }'

# Test Search
curl -X POST http://localhost:3002/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "test search",
    "maxResults": 5
  }'

# Test Agent Swarm
curl -X POST http://localhost:3003/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Session",
    "topology": "hierarchical"
  }'
```

## Common Issues and Solutions

### Issue: Services Won't Start

**Symptoms:**
- Services fail to start with port binding errors
- Health checks show connection refused

**Solutions:**
```bash
# Check if ports are in use
netstat -tulpn | grep :300

# Kill existing processes
pkill -f "mcp-"

# Clear port locks
sudo rm -f /tmp/.X0-lock

# Restart services
./scripts/start-all-servers.sh
```

### Issue: Authentication Failures

**Symptoms:**
- API key errors from AI services
- 401 Unauthorized responses

**Solutions:**
```bash
# Verify API keys
echo $OPENAI_API_KEY | head -c 10
echo $ANTHROPIC_API_KEY | head -c 10

# Test authentication
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models

# Update environment variables
export OPENAI_API_KEY="sk-new-key-here"
```

### Issue: Memory or Performance Problems

**Symptoms:**
- Services become slow or unresponsive
- High memory usage
- Timeout errors

**Solutions:**
```bash
# Monitor resource usage
htop

# Increase memory limits
export NODE_OPTIONS="--max-old-space-size=4096"

# Restart services with clean state
./scripts/restart-all-servers.sh

# Check logs for errors
tail -f logs/*.log
```

## Next Steps

Congratulations! You've successfully set up the MCP Advanced Multi-Agent Ecosystem and created your first multi-agent workflow. Here are some suggested next steps:

### 1. Explore the Documentation

- [Phase Documentation](../phases/) - Learn about each MCP server's capabilities
- [API Reference](../api/) - Detailed API documentation
- [Integration Guides](../integration/) - Cross-phase workflow patterns

### 2. Build Advanced Workflows

- **Research → Code Generation**: Use research to inform code creation
- **Multi-Agent Collaboration**: Coordinate multiple specialized agents
- **Visual Analytics**: Create dashboards and reports
- **Automated Testing**: Integrate testing into workflows

### 3. Customize and Extend

- **Custom Agents**: Create specialized worker types
- **Custom Tools**: Build domain-specific tools
- **Integration Patterns**: Implement custom workflow patterns
- **Performance Optimization**: Tune for your specific use case

### 4. Production Deployment

- **Containerization**: Docker and Kubernetes deployment
- **Monitoring**: Set up logging and metrics
- **Scaling**: Horizontal and vertical scaling strategies
- **Security**: Authentication and authorization

## Getting Help

### Documentation
- [Full Documentation](../README.md)
- [API Reference](../api/mcp-tools-reference.md)
- [Examples Repository](https://github.com/your-org/mcp-examples)

### Community
- [Discord Community](https://discord.gg/mcp-ecosystem)
- [GitHub Discussions](https://github.com/your-org/mcp-advanced-multi-agent-ecosystem/discussions)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/mcp-ecosystem)

### Support
- [Issue Tracker](https://github.com/your-org/mcp-advanced-multi-agent-ecosystem/issues)
- [Email Support](mailto:support@mcp-ecosystem.com)

---

**🎉 You're ready to build with the MCP Advanced Multi-Agent Ecosystem!**

This quick start guide has walked you through setting up the environment, creating your first multi-agent workflow, and verifying the installation. The ecosystem is designed to be extensible and customizable, so feel free to experiment with different configurations and workflows.

For more detailed information about any specific component or advanced usage patterns, refer to the comprehensive documentation in the `docs/` directory.