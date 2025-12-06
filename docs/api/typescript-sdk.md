# TypeScript SDK for MCP Servers

## Overview

The TypeScript SDK provides a comprehensive interface for interacting with all TypeScript-based MCP servers in the ecosystem: Task-Orchestrator, Search-Aggregator, Agent-Swarm, Code-Intelligence, and Chart-Generator. This SDK is designed for TypeScript/Node.js environments with full type safety and modern async/await support.

## Installation

### Prerequisites

- Node.js 18+ or TypeScript 5.0+
- npm or yarn package manager
- TypeScript compiler (for development)

### Install from Source

```bash
# Clone the repository
git clone https://github.com/your-org/mcp-advanced-multi-agent-ecosystem.git
cd mcp-advanced-multi-agent-ecosystem

# Install dependencies for all servers
npm install

# Build all packages
npm run build

# Install TypeScript SDK
npm install -g @mcp-ecosystem/typescript-sdk
```

### Install from NPM (when available)

```bash
npm install @mcp-ecosystem/typescript-sdk
```

### Dependencies

The SDK automatically installs these core dependencies:

- **Core**: `@mcp-ecosystem/core`, `typescript`, `node-fetch`
- **Task Management**: `@mcp-ecosystem/task-orchestrator`
- **Search**: `@mcp-ecosystem/search-aggregator`
- **Agent Swarm**: `@mcp-ecosystem/agent-swarm`
- **Code Intelligence**: `@mcp-ecosystem/code-intelligence`
- **Charts**: `@mcp-ecosystem/chart-generator`
- **Utilities**: `zod`, `winston`, `lodash`, `uuid`

## Quick Start

### Basic Usage

```typescript
import { 
  TaskOrchestratorClient,
  SearchAggregatorClient,
  AgentSwarmClient,
  CodeIntelligenceClient,
  ChartGeneratorClient
} from '@mcp-ecosystem/typescript-sdk';

// Initialize clients
const taskClient = new TaskOrchestratorClient({
  baseUrl: 'http://localhost:3001',
  timeout: 30000
});

const searchClient = new SearchAggregatorClient({
  baseUrl: 'http://localhost:3002',
  providers: ['brave', 'tavily', 'perplexity']
});

const swarmClient = new AgentSwarmClient({
  baseUrl: 'http://localhost:3003',
  llmProvider: 'openai',
  topology: 'hierarchical'
});

const codeClient = new CodeIntelligenceClient({
  baseUrl: 'http://localhost:3004',
  supportedLanguages: ['typescript', 'javascript', 'python']
});

const chartClient = new ChartGeneratorClient({
  baseUrl: 'http://localhost:3005',
  defaultTheme: 'light'
});

// Example: Create and execute a task
const task = await taskClient.createTask({
  title: 'Analyze market trends',
  description: 'Research current AI market trends and create summary',
  priority: 'high',
  estimatedHours: 8,
  tags: ['research', 'ai', 'market-analysis']
});

console.log(`Created task ${task.taskId}`);

// Execute code for the task
const execution = await taskClient.executeCode({
  taskId: task.taskId,
  code: `
    const trends = await fetchMarketTrends('AI');
    const summary = generateSummary(trends);
    console.log(summary);
  `,
  language: 'typescript',
  environment: 'node'
});

console.log(`Execution status: ${execution.status}`);
```

### Advanced Usage

```typescript
import { 
  MCPClient,
  TaskOrchestratorClient,
  SearchAggregatorClient,
  AgentSwarmClient
} from '@mcp-ecosystem/typescript-sdk';

// Initialize with custom configuration
const mcpClient = new MCPClient({
  timeout: 60000,
  retries: 3,
  logging: {
    level: 'debug',
    format: 'json'
  }
});

const taskClient = new TaskOrchestratorClient({
  baseUrl: process.env.TASK_ORCHESTRATOR_URL || 'http://localhost:3001',
  timeout: 45000,
  authentication: {
    type: 'bearer',
    token: process.env.MCP_TOKEN
  },
  llmConfig: {
    provider: 'anthropic',
    model: 'claude-3-sonnet-20240229',
    temperature: 0.1,
    maxTokens: 4000
  }
});

// Complex workflow: Research → Task Analysis → Agent Execution
async function executeComplexWorkflow() {
  // 1. Research phase
  const research = await searchClient.executeParallelSearch({
    query: 'enterprise AI adoption trends 2024',
    providers: ['brave', 'perplexity'],
    maxResultsPerProvider: 10,
    timeout: 30000
  });

  // 2. Parse PRD from research results
  const prd = await taskClient.parsePRD({
    content: formatResearchAsPRD(research.results),
    extractRequirements: true,
    extractDependencies: true,
    extractTimeline: true
  });

  // 3. Expand tasks
  const expandedTasks = await taskClient.expandTasks({
    tasks: prd.prd.tasks,
    expansionLevel: 'comprehensive',
    includeDependencies: true,
    maxDepth: 3
  });

  // 4. Create agent swarm session
  const session = await swarmClient.createSession({
    name: 'AI Market Analysis',
    topology: 'hierarchical',
    memoryTier: 'persistent',
    llmConfig: {
      provider: 'openai',
      model: 'gpt-4-turbo-preview'
    }
  });

  // 5. Delegate tasks to agents
  const delegations = [];
  for (const task of expandedTasks.expandedTasks.slice(0, 5)) {
    const delegation = await swarmClient.delegateTask({
      sessionId: session.sessionId,
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        estimatedHours: task.estimatedHours
      },
      targetWorkerType: 'researcher',
      requiredCapabilities: ['analysis', 'synthesis'],
      timeout: 3600000 // 1 hour
    });
    delegations.push(delegation);
  }

  // 6. Monitor progress
  const results = await Promise.all(
    delegations.map(d => swarmClient.getDelegationStatus(d.delegationId))
  );

  return {
    research,
    prd,
    expandedTasks,
    session,
    delegations,
    results
  };
}

// Execute the workflow
const workflowResults = await executeComplexWorkflow();
console.log('Workflow completed successfully');
```

## API Reference

### Core Classes

#### `MCPClient`

The base client class for all MCP server interactions.

```typescript
interface MCPClientConfig {
  baseUrl?: string;
  timeout?: number;
  retries?: number;
  authentication?: {
    type: 'bearer' | 'api-key' | 'basic';
    token?: string;
    username?: string;
    password?: string;
  };
  logging?: {
    level: 'error' | 'warn' | 'info' | 'debug';
    format?: 'json' | 'text';
  };
  headers?: Record<string, string>;
}

class MCPClient {
  constructor(config: MCPClientConfig);
  
  // Core methods
  async request<T>(endpoint: string, options?: RequestOptions): Promise<T>;
  async healthCheck(): Promise<HealthStatus>;
  async getServerInfo(): Promise<ServerInfo>;
  
  // Utility methods
  setAuthentication(auth: AuthenticationConfig): void;
  setTimeout(timeout: number): void;
  setRetryPolicy(policy: RetryPolicy): void;
}
```

### Task-Orchestrator Client

#### `TaskOrchestratorClient`

```typescript
interface TaskOrchestratorConfig extends MCPClientConfig {
  llmConfig?: {
    provider: 'openai' | 'anthropic' | 'local';
    model?: string;
    temperature?: number;
    maxTokens?: number;
    apiKey?: string;
  };
  defaultPriority?: 'low' | 'medium' | 'high' | 'critical';
  defaultAssignee?: string;
}

class TaskOrchestratorClient extends MCPClient {
  constructor(config: TaskOrchestratorConfig);
  
  // Task Management
  async createTask(params: CreateTaskParams): Promise<CreateTaskResponse>;
  async updateTaskStatus(params: UpdateTaskStatusParams): Promise<UpdateTaskStatusResponse>;
  async deleteTask(params: DeleteTaskParams): Promise<DeleteTaskResponse>;
  async listTasks(params?: ListTasksParams): Promise<ListTasksResponse>;
  
  // Code Execution
  async executeCode(params: ExecuteCodeParams): Promise<ExecuteCodeResponse>;
  
  // PRD Processing
  async parsePRD(params: ParsePRDParams): Promise<ParsePRDResponse>;
  
  // Analysis Operations
  async analyzeComplexity(params: AnalyzeComplexityParams): Promise<AnalyzeComplexityResponse>;
  async expandTasks(params: ExpandTasksParams): Promise<ExpandTasksResponse>;
  async selectTasks(params: SelectTasksParams): Promise<SelectTasksResponse>;
}
```

#### Task Management Methods

###### `createTask`

```typescript
interface CreateTaskParams {
  title: string;
  description: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  estimatedHours?: number;
  tags?: string[];
  assignee?: string;
  dependencies?: string[];
  executionEnvironment?: string;
  codeLanguage?: string;
  dueDate?: string;
  metadata?: Record<string, any>;
}

interface CreateTaskResponse {
  success: boolean;
  taskId: number;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;
  error?: string;
  processingTime?: number;
}
```

**Example:**

```typescript
const task = await taskClient.createTask({
  title: 'Implement user authentication',
  description: 'Add JWT-based authentication with refresh tokens',
  priority: 'high',
  estimatedHours: 16,
  tags: ['authentication', 'security', 'backend'],
  assignee: 'dev-team-1',
  dependencies: ['user-model', 'database-setup'],
  executionEnvironment: 'node',
  codeLanguage: 'typescript',
  dueDate: '2024-12-31T23:59:59Z',
  metadata: {
    epic: 'security-enhancement',
    storyPoints: 8,
    complexity: 'medium'
  }
});

if (task.success) {
  console.log(`Task created with ID: ${task.taskId}`);
} else {
  console.error(`Failed to create task: ${task.error}`);
}
```

###### `executeCode`

```typescript
interface ExecuteCodeParams {
  taskId: number;
  code: string;
  language?: 'typescript' | 'javascript' | 'python' | 'bash' | 'sql';
  environment?: string;
  timeout?: number;
  workingDirectory?: string;
  packages?: string[];
  envVars?: Record<string, string>;
}

interface ExecuteCodeResponse {
  success: boolean;
  taskId: number;
  executionId: string;
  status: 'running' | 'completed' | 'failed' | 'timeout' | 'cancelled';
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  executionTime?: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
  resourceUsage?: {
    cpuTime: number;
    memoryPeak: number;
    diskUsage: number;
  };
}
```

**Example:**

```typescript
const execution = await taskClient.executeCode({
  taskId: 123,
  code: `
    import { fetch } from 'node-fetch';
    
    async function analyzeData() {
      const response = await fetch('https://api.example.com/data');
      const data = await response.json();
      
      const analysis = {
        total: data.length,
        average: data.reduce((sum, item) => sum + item.value, 0) / data.length,
        timestamp: new Date().toISOString()
      };
      
      console.log(JSON.stringify(analysis, null, 2));
    }
    
    analyzeData().catch(console.error);
  `,
  language: 'typescript',
  environment: 'node',
  timeout: 30000,
  packages: ['node-fetch', '@types/node'],
  envVars: {
    NODE_ENV: 'production',
    API_KEY: process.env.API_KEY
  }
});

console.log(`Execution ${execution.executionId}: ${execution.status}`);
if (execution.stdout) {
  console.log('Output:', execution.stdout);
}
```

### Search-Aggregator Client

#### `SearchAggregatorClient`

```typescript
interface SearchAggregatorConfig extends MCPClientConfig {
  providers?: string[];
  defaultMaxResults?: number;
  parallelLimit?: number;
  cacheEnabled?: boolean;
  cacheTTL?: number;
}

class SearchAggregatorClient extends MCPClient {
  constructor(config: SearchAggregatorConfig);
  
  // Search Operations
  async search(params: SearchParams): Promise<SearchResponse>;
  async executeParallelSearch(params: ExecuteParallelSearchParams): Promise<ExecuteParallelSearchResponse>;
  
  // Research Operations
  async planResearch(params: PlanResearchParams): Promise<PlanResearchResponse>;
  async localSearch(params: LocalSearchParams): Promise<LocalSearchResponse>;
  
  // Execution and Synthesis
  async parallelExecute(params: ParallelExecuteParams): Promise<ParallelExecuteResponse>;
  async synthesizeReport(params: SynthesizeReportParams): Promise<SynthesizeReportResponse>;
  
  // Provider Management
  async getAvailableProviders(): Promise<GetAvailableProvidersResponse>;
}
```

#### Search Methods

###### `executeParallelSearch`

```typescript
interface ExecuteParallelSearchParams {
  query: string;
  providers: string[];
  maxResultsPerProvider?: number;
  timeout?: number;
  parallelLimit?: number;
  filters?: Record<string, any>;
  includeMetadata?: boolean;
}

interface ExecuteParallelSearchResponse {
  success: boolean;
  query: string;
  results: Array<{
    provider: string;
    results: Array<{
      title: string;
      url: string;
      snippet: string;
      relevanceScore: number;
      metadata?: Record<string, any>;
    }>;
    totalResults: number;
    searchTime: number;
  }>;
  totalResults: number;
  executionTime: number;
  parallelEfficiency: number;
  error?: string;
}
```

**Example:**

```typescript
const searchResults = await searchClient.executeParallelSearch({
  query: 'TypeScript performance optimization techniques 2024',
  providers: ['brave', 'tavily', 'perplexity'],
  maxResultsPerProvider: 15,
  timeout: 45000,
  parallelLimit: 3,
  filters: {
    dateRange: {
      start: '2024-01-01',
      end: '2024-12-31'
    },
    contentTypes: ['article', 'documentation', 'tutorial'],
    language: 'en'
  },
  includeMetadata: true
});

if (searchResults.success) {
  console.log(`Found ${searchResults.totalResults} total results`);
  
  for (const providerResult of searchResults.results) {
    console.log(`\n${providerResult.provider.toUpperCase()} Results:`);
    for (const result of providerResult.results.slice(0, 3)) {
      console.log(`  ${result.title} (${result.relevanceScore.toFixed(3)})`);
      console.log(`  ${result.url}`);
      console.log(`  ${result.snippet.substring(0, 100)}...`);
    }
  }
  
  console.log(`\nParallel efficiency: ${(searchResults.parallelEfficiency * 100).toFixed(1)}%`);
}
```

### Agent-Swarm Client

#### `AgentSwarmClient`

```typescript
interface AgentSwarmConfig extends MCPClientConfig {
  llmProvider?: 'openai' | 'anthropic' | 'ollama' | 'perplexity';
  defaultTopology?: 'hierarchical' | 'mesh' | 'star' | 'dynamic';
  maxWorkers?: number;
  memoryConfig?: {
    workingSize?: number;
    episodicSize?: number;
    persistentSize?: number;
  };
}

class AgentSwarmClient extends MCPClient {
  constructor(config: AgentSwarmConfig);
  
  // Session Management
  async createSession(params: CreateSessionParams): Promise<CreateSessionResponse>;
  async getSession(params: GetSessionParams): Promise<GetSessionResponse>;
  async updateSession(params: UpdateSessionParams): Promise<UpdateSessionResponse>;
  async deleteSession(params: DeleteSessionParams): Promise<DeleteSessionResponse>;
  async listSessions(params?: ListSessionsParams): Promise<ListSessionsResponse>;
  
  // Topology Management
  async createTopology(params: CreateTopologyParams): Promise<CreateTopologyResponse>;
  async getTopology(params: GetTopologyParams): Promise<GetTopologyResponse>;
  async listTopologies(): Promise<ListTopologiesResponse>;
  
  // Worker Management
  async spawnWorker(params: SpawnWorkerParams): Promise<SpawnWorkerResponse>;
  async getWorkerStatus(params: GetWorkerStatusParams): Promise<GetWorkerStatusResponse>;
  async terminateWorker(params: TerminateWorkerParams): Promise<TerminateWorkerResponse>;
  async listWorkers(params?: ListWorkersParams): Promise<ListWorkersResponse>;
  
  // Memory Management
  async storeMemory(params: StoreMemoryParams): Promise<StoreMemoryResponse>;
  async retrieveMemory(params: RetrieveMemoryParams): Promise<RetrieveMemoryResponse>;
  async clearMemory(params: ClearMemoryParams): Promise<ClearMemoryResponse>;
  async getMemoryStats(params: GetMemoryStatsParams): Promise<GetMemoryStatsResponse>;
  
  // LLM Integration
  async configureLLM(params: ConfigureLLMParams): Promise<ConfigureLLMResponse>;
  async getLLMProviders(): Promise<GetLLMProvidersResponse>;
  async testLLMConnection(params: TestLLMConnectionParams): Promise<TestLLMConnectionResponse>;
  
  // Task Delegation
  async delegateTask(params: DelegateTaskParams): Promise<DelegateTaskResponse>;
  async getDelegationStatus(params: GetDelegationStatusParams): Promise<GetDelegationStatusResponse>;
  async cancelDelegation(params: CancelDelegationParams): Promise<CancelDelegationResponse>;
  
  // Agent Communication
  async sendMessageToAgent(params: SendMessageToAgentParams): Promise<SendMessageToAgentResponse>;
  async receiveAgentMessage(params: ReceiveAgentMessageParams): Promise<ReceiveAgentMessageResponse>;
}
```

#### Session Management

###### `createSession`

```typescript
interface CreateSessionParams {
  name: string;
  topology: 'hierarchical' | 'mesh' | 'star' | 'dynamic';
  memoryTier?: 'working' | 'episodic' | 'persistent';
  llmConfig?: {
    provider?: 'openai' | 'anthropic' | 'ollama' | 'perplexity';
    model?: string;
    temperature?: number;
    maxTokens?: number;
    apiKey?: string;
    systemPrompt?: string;
  };
  workerConfig?: {
    maxWorkers?: number;
    defaultCapabilities?: string[];
    memoryConfig?: Record<string, any>;
  };
  sessionConfig?: Record<string, any>;
}

interface CreateSessionResponse {
  success: boolean;
  sessionId: string;
  name: string;
  topology: string;
  status: 'initializing' | 'active' | 'paused' | 'completed' | 'error';
  createdAt: string;
  workersSpawned: number;
  error?: string;
}
```

**Example:**

```typescript
const session = await swarmClient.createSession({
  name: 'Enterprise Software Architecture Analysis',
  topology: 'hierarchical',
  memoryTier: 'persistent',
  llmConfig: {
    provider: 'anthropic',
    model: 'claude-3-sonnet-20240229',
    temperature: 0.1,
    maxTokens: 8000,
    systemPrompt: 'You are an expert software architect analyzing enterprise systems.'
  },
  workerConfig: {
    maxWorkers: 8,
    defaultCapabilities: ['analysis', 'design', 'documentation'],
    memoryConfig: {
      workingSize: 1024 * 1024 * 100, // 100MB
      episodicSize: 1024 * 1024 * 500, // 500MB
      persistentSize: 1024 * 1024 * 1024 // 1GB
    }
  },
  sessionConfig: {
    autoSave: true,
    saveInterval: 300000, // 5 minutes
    maxDuration: 3600000 // 1 hour
  }
});

if (session.success) {
  console.log(`Session created: ${session.sessionId}`);
  console.log(`Workers spawned: ${session.workersSpawned}`);
  
  // Start delegating tasks
  await startTaskDelegation(session.sessionId);
}
```

### Code-Intelligence Client

#### `CodeIntelligenceClient`

```typescript
interface CodeIntelligenceConfig extends MCPClientConfig {
  supportedLanguages?: string[];
  defaultMaxDepth?: number;
  cacheEnabled?: boolean;
  indexingEnabled?: boolean;
}

class CodeIntelligenceClient extends MCPClient {
  constructor(config: CodeIntelligenceConfig);
  
  // Repository Analysis
  async analyzeRepository(params: AnalyzeRepositoryParams): Promise<AnalyzeRepositoryResponse>;
  
  // Symbol Operations
  async findSymbols(params: FindSymbolsParams): Promise<FindSymbolsResponse>;
  async findReferences(params: FindReferencesParams): Promise<FindReferencesResponse>;
  async getSymbolDetails(params: GetSymbolDetailsParams): Promise<GetSymbolDetailsResponse>;
  async getSymbolReferences(params: GetSymbolReferencesParams): Promise<GetSymbolReferencesResponse>;
  
  // Outline Generation
  async generateOutline(params: GenerateOutlineParams): Promise<GenerateOutlineResponse>;
  async getOutlineStructure(params: GetOutlineStructureParams): Promise<GetOutlineStructureResponse>;
}
```

#### Code Analysis Methods

###### `analyzeRepository`

```typescript
interface AnalyzeRepositoryParams {
  path: string;
  languages?: string[];
  includeTests?: boolean;
  maxDepth?: number;
  excludePatterns?: string[];
  outputFormat?: 'json' | 'markdown' | 'tree';
  analyzeDependencies?: boolean;
  calculateMetrics?: boolean;
}

interface AnalyzeRepositoryResponse {
  success: boolean;
  repositoryPath: string;
  analysis: {
    languages: Array<{
      language: string;
      fileCount: number;
      lineCount: number;
      complexityScore: number;
      frameworks: string[];
      patterns: Array<{
        pattern: string;
        description: string;
        examples: string[];
      }>;
    }>;
    structure: {
      directories: Array<{
        path: string;
        fileCount: number;
        totalSize: number;
      }>;
      metrics: {
        totalFiles: number;
        totalLines: number;
        analysisTime: number;
        cyclomaticComplexity?: number;
        maintainabilityIndex?: number;
      };
    };
    dependencies?: Array<{
      name: string;
      version: string;
      type: 'runtime' | 'development' | 'peer';
      optional: boolean;
    }>;
  };
  analyzedAt: string;
  error?: string;
}
```

**Example:**

```typescript
const analysis = await codeClient.analyzeRepository({
  path: './src',
  languages: ['typescript', 'javascript', 'python'],
  includeTests: true,
  maxDepth: 5,
  excludePatterns: ['node_modules', '.git', 'dist', 'coverage'],
  outputFormat: 'json',
  analyzeDependencies: true,
  calculateMetrics: true
});

if (analysis.success) {
  console.log(`Repository Analysis for: ${analysis.repositoryPath}`);
  
  // Language breakdown
  console.log('\nLanguages:');
  for (const lang of analysis.analysis.languages) {
    console.log(`  ${lang.language}:`);
    console.log(`    Files: ${lang.fileCount}`);
    console.log(`    Lines: ${lang.lineCount.toLocaleString()}`);
    console.log(`    Complexity: ${lang.complexityScore.toFixed(2)}`);
    console.log(`    Frameworks: ${lang.frameworks.join(', ')}`);
  }
  
  // Structure metrics
  const metrics = analysis.analysis.structure.metrics;
  console.log('\nMetrics:');
  console.log(`  Total Files: ${metrics.totalFiles}`);
  console.log(`  Total Lines: ${metrics.totalLines.toLocaleString()}`);
  console.log(`  Analysis Time: ${metrics.analysisTime}ms`);
  
  if (metrics.cyclomaticComplexity) {
    console.log(`  Cyclomatic Complexity: ${metrics.cyclomaticComplexity.toFixed(2)}`);
  }
  
  // Dependencies
  if (analysis.analysis.dependencies) {
    console.log('\nDependencies:');
    for (const dep of analysis.analysis.dependencies) {
      const optional = dep.optional ? ' (optional)' : '';
      console.log(`  ${dep.name}@${dep.version}${optional} [${dep.type}]`);
    }
  }
}
```

### Chart-Generator Client

#### `ChartGeneratorClient`

```typescript
interface ChartGeneratorConfig extends MCPClientConfig {
  defaultTheme?: 'light' | 'dark' | 'colorblind';
  defaultWidth?: number;
  defaultHeight?: number;
  outputFormat?: 'png' | 'svg' | 'pdf';
  cacheEnabled?: boolean;
}

class ChartGeneratorClient extends MCPClient {
  constructor(config: ChartGeneratorConfig);
  
  // Chart Generation
  async generateChart(params: GenerateChartParams): Promise<GenerateChartResponse>;
  async listChartTypes(): Promise<ListChartTypesResponse>;
  async previewChartConfig(params: PreviewChartConfigParams): Promise<PreviewChartConfigResponse>;
  
  // Template Management
  async getChartThemes(): Promise<GetChartThemesResponse>;
  async createChartTemplate(params: CreateChartTemplateParams): Promise<CreateChartTemplateResponse>;
  async applyChartTemplate(params: ApplyChartTemplateParams): Promise<ApplyChartTemplateResponse>;
  
  // Export and History
  async exportChartSVG(params: ExportChartSVGParams): Promise<ExportChartSVGResponse>;
  async getChartHistory(params?: GetChartHistoryParams): Promise<GetChartHistoryResponse>;
}
```

#### Chart Generation Methods

###### `generateChart`

```typescript
interface GenerateChartParams {
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'gantt' | 'heatmap';
  data: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      backgroundColor?: string | string[];
      borderColor?: string | string[];
      borderWidth?: number;
      fill?: boolean;
      tension?: number;
      pointRadius?: number;
      pointHoverRadius?: number;
      pointStyle?: string;
      steppedLine?: boolean;
      yAxisID?: string;
    }>;
  };
  options?: {
    title?: string;
    width?: number;
    height?: number;
    theme?: 'light' | 'dark' | 'colorblind';
    legend?: boolean;
    xAxisLabel?: string;
    yAxisLabel?: string;
    responsive?: boolean;
    maintainAspectRatio?: boolean;
    animation?: {
      duration?: number;
      easing?: string;
    };
    scales?: {
      x?: {
        type?: 'linear' | 'logarithmic' | 'category' | 'time';
        min?: number;
        max?: number;
        title?: string;
        stacked?: boolean;
        position?: 'top' | 'bottom';
      };
      y?: {
        type?: 'linear' | 'logarithmic' | 'category';
        min?: number;
        max?: number;
        title?: string;
        stacked?: boolean;
        position?: 'left' | 'right';
      };
    };
    plugins?: {
      legend?: {
        display?: boolean;
        position?: 'top' | 'bottom' | 'left' | 'right';
      };
      tooltip?: {
        enabled?: boolean;
        mode?: 'index' | 'nearest' | 'point' | 'average';
        callbacks?: Record<string, any>;
      };
    };
  };
  exportFormat?: 'png' | 'svg' | 'pdf';
  filename?: string;
}

interface GenerateChartResponse {
  success: boolean;
  chartId: string;
  imagePath?: string;
  imageBase64?: string;
  metadata: {
    width: number;
    height: number;
    format: string;
    fileSize: number;
    generationTime: number;
  };
  error?: string;
}
```

**Example:**

```typescript
const chart = await chartClient.generateChart({
  type: 'bar',
  data: {
    labels: ['Q1', 'Q2', 'Q3', 'Q4'],
    datasets: [
      {
        label: 'Revenue',
        data: [1200000, 1400000, 1300000, 1600000],
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 2
      },
      {
        label: 'Costs',
        data: [800000, 750000, 900000, 850000],
        backgroundColor: 'rgba(255, 99, 132, 0.6)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 2
      }
    ]
  },
  options: {
    title: 'Quarterly Financial Performance',
    width: 800,
    height: 600,
    theme: 'light',
    legend: true,
    xAxisLabel: 'Quarter',
    yAxisLabel: 'Amount ($)',
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Amount ($)'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Quarter'
        }
      }
    },
    plugins: {
      legend: {
        position: 'top'
      },
      tooltip: {
        enabled: true,
        mode: 'index',
        callbacks: {
          label: function(context) {
            return context.dataset.label + ': $' + context.parsed.y.toLocaleString();
          }
        }
      }
    }
  },
  exportFormat: 'png',
  filename: 'financial-performance.png'
});

if (chart.success) {
  console.log(`Chart generated: ${chart.chartId}`);
  console.log(`File size: ${(chart.metadata.fileSize / 1024).toFixed(1)}KB`);
  console.log(`Generation time: ${chart.metadata.generationTime}ms`);
  
  if (chart.imagePath) {
    console.log(`Chart saved to: ${chart.imagePath}`);
  }
}
```

## Data Models and Types

### Common Types

#### `ResponseBase`

```typescript
interface ResponseBase {
  success: boolean;
  error?: string;
  processingTime?: number;
  requestId?: string;
  timestamp?: string;
}
```

#### `PaginationParams`

```typescript
interface PaginationParams {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
```

#### `FilterParams`

```typescript
interface FilterParams {
  dateRange?: {
    start: string;
    end: string;
  };
  tags?: string[];
  status?: string | string[];
  priority?: string | string[];
  assignee?: string;
  metadata?: Record<string, any>;
}
```

### Task Management Types

#### `Task`

```typescript
interface Task {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignee?: string;
  tags: string[];
  estimatedHours?: number;
  dependencies: string[];
  executionEnvironment?: string;
  codeLanguage?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  completionPercentage?: number;
  metadata?: Record<string, any>;
}
```

#### `PRD`

```typescript
interface PRD {
  title: string;
  description: string;
  requirements: Array<{
    id: string;
    title: string;
    description: string;
    priority: string;
    acceptanceCriteria: string[];
    dependencies: string[];
    estimatedHours: number;
    assignee?: string;
    dueDate?: string;
  }>;
  timeline?: Array<{
    phase: string;
    title: string;
    description: string;
    startDate: string;
    endDate: string;
    deliverables: string[];
  }>;
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    priority: string;
    estimatedHours: number;
    dependencies: string[];
    assignee?: string;
    dueDate: string;
    tags: string[];
    acceptanceCriteria: string[];
  }>;
  metadata?: Record<string, any>;
}
```

### Search Types

#### `SearchResult`

```typescript
interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  relevanceScore: number;
  metadata?: Record<string, any>;
  provider: string;
  timestamp?: string;
  contentType?: 'article' | 'documentation' | 'tutorial' | 'forum' | 'news';
  language?: string;
  author?: string;
  publishDate?: string;
}
```

### Agent Swarm Types

#### `Session`

```typescript
interface Session {
  id: string;
  name: string;
  topology: 'hierarchical' | 'mesh' | 'star' | 'dynamic';
  status: 'initializing' | 'active' | 'paused' | 'completed' | 'error';
  createdAt: string;
  updatedAt: string;
  workers: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    capabilities: string[];
    createdAt: string;
    lastActivity: string;
  }>;
  memory: {
    working: Record<string, any>;
    episodic: Record<string, any>;
    persistent: Record<string, any>;
  };
  messages: Array<{
    id: string;
    role: string;
    content: string;
    timestamp: string;
    metadata?: Record<string, any>;
  }>;
  config?: Record<string, any>;
}
```

#### `Worker`

```typescript
interface Worker {
  id: string;
  sessionId: string;
  workerType: string;
  capabilities: string[];
  status: 'initializing' | 'idle' | 'busy' | 'error' | 'completed' | 'terminated';
  currentTask?: {
    id: string;
    title: string;
    status: string;
    progress: number;
  };
  memoryUsage: {
    working: Record<string, any>;
    episodic: Record<string, any>;
    persistent: Record<string, any>;
  };
  performance: {
    tasksCompleted: number;
    averageTaskTime: number;
    errorRate: number;
  };
  createdAt: string;
  lastActivity: string;
}
```

### Code Intelligence Types

#### `Symbol`

```typescript
interface Symbol {
  id: string;
  name: string;
  type: 'class' | 'function' | 'interface' | 'enum' | 'namespace' | 'variable' | 'constant';
  language: string;
  filePath: string;
  lineNumber: number;
  columnNumber: number;
  definition?: {
    signature: string;
    parameters: Array<{
      name: string;
      type: string;
      optional: boolean;
      defaultValue?: any;
    }>;
    returnType?: string;
    visibility?: 'public' | 'private' | 'protected' | 'internal';
    isAsync?: boolean;
    isGenerator?: boolean;
    isStatic?: boolean;
  };
  references: Array<{
    filePath: string;
    lineNumber: number;
    context: string;
    type: 'definition' | 'call' | 'implementation' | 'assignment' | 'import' | 'documentation';
    snippet: string;
  }>;
  metadata?: Record<string, any>;
}
```

### Chart Types

#### `ChartTheme`

```typescript
interface ChartTheme {
  name: string;
  colors: {
    primary: string[];
    secondary: string[];
    background: string;
    text: string;
    grid: string;
    border: string;
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  backgroundColor?: string;
  textColor?: string;
  gridColor?: string;
  borderColor?: string;
  description: string;
}
```

## Configuration

### Environment Variables

```bash
# Task Orchestrator
TASK_ORCHESTRATOR_URL=http://localhost:3001
TASK_ORCHESTRATOR_TIMEOUT=30000
TASK_ORCHESTRATOR_RETRIES=3
TASK_ORCHESTRATOR_LLM_PROVIDER=openai
TASK_ORCHESTRATOR_LLM_MODEL=gpt-4-turbo-preview
TASK_ORCHESTRATOR_LLM_API_KEY=your-openai-key

# Search Aggregator
SEARCH_AGGREGATOR_URL=http://localhost:3002
SEARCH_AGGREGATOR_PROVIDERS=brave,tavily,perplexity
SEARCH_AGGREGATOR_BRAVE_API_KEY=your-brave-key
SEARCH_AGGREGATOR_TAVILY_API_KEY=your-tavily-key
SEARCH_AGGREGATOR_PERPLEXITY_API_KEY=your-perplexity-key
SEARCH_AGGREGATOR_CACHE_ENABLED=true
SEARCH_AGGREGATOR_CACHE_TTL=3600

# Agent Swarm
AGENT_SWARM_URL=http://localhost:3003
AGENT_SWARM_LLM_PROVIDER=anthropic
AGENT_SWARM_LLM_MODEL=claude-3-sonnet-20240229
AGENT_SWARM_LLM_API_KEY=your-anthropic-key
AGENT_SWARM_MAX_WORKERS=10
AGENT_SWARM_MEMORY_WORKING_SIZE=104857600
AGENT_SWARM_MEMORY_EPISODIC_SIZE=524288000
AGENT_SWARM_MEMORY_PERSISTENT_SIZE=1073741824

# Code Intelligence
CODE_INTELLIGENCE_URL=http://localhost:3004
CODE_INTELLIGENCE_SUPPORTED_LANGUAGES=typescript,javascript,python,go,rust
CODE_INTELLIGENCE_CACHE_ENABLED=true
CODE_INTELLIGENCE_INDEXING_ENABLED=true
CODE_INTELLIGENCE_MAX_DEPTH=10

# Chart Generator
CHART_GENERATOR_URL=http://localhost:3005
CHART_GENERATOR_DEFAULT_THEME=light
CHART_GENERATOR_DEFAULT_WIDTH=800
CHART_GENERATOR_DEFAULT_HEIGHT=600
CHART_GENERATOR_OUTPUT_FORMAT=png
CHART_GENERATOR_CACHE_ENABLED=true

# General MCP Configuration
MCP_SDK_TIMEOUT=30000
MCP_SDK_RETRIES=3
MCP_SDK_LOG_LEVEL=info
MCP_SDK_AUTH_TOKEN=your-auth-token
```

### Configuration File

Create a `mcp-config.json` file:

```json
{
  "taskOrchestrator": {
    "baseUrl": "http://localhost:3001",
    "timeout": 30000,
    "retries": 3,
    "llmConfig": {
      "provider": "openai",
      "model": "gpt-4-turbo-preview",
      "temperature": 0.1,
      "maxTokens": 4000,
      "apiKey": "${OPENAI_API_KEY}"
    },
    "defaultPriority": "medium",
    "defaultAssignee": "dev-team"
  },
  "searchAggregator": {
    "baseUrl": "http://localhost:3002",
    "providers": ["brave", "tavily", "perplexity"],
    "defaultMaxResults": 20,
    "parallelLimit": 3,
    "cacheEnabled": true,
    "cacheTTL": 3600,
    "providerConfig": {
      "brave": {
        "apiKey": "${BRAVE_API_KEY}",
        "maxResults": 20
      },
      "tavily": {
        "apiKey": "${TAVILY_API_KEY}",
        "maxResults": 10
      },
      "perplexity": {
        "apiKey": "${PERPLEXITY_API_KEY}",
        "model": "mixtral-8x7b"
      }
    }
  },
  "agentSwarm": {
    "baseUrl": "http://localhost:3003",
    "llmProvider": "anthropic",
    "defaultTopology": "hierarchical",
    "maxWorkers": 10,
    "memoryConfig": {
      "workingSize": 104857600,
      "episodicSize": 524288000,
      "persistentSize": 1073741824
    },
    "llmConfig": {
      "provider": "anthropic",
      "model": "claude-3-sonnet-20240229",
      "temperature": 0.1,
      "maxTokens": 8000,
      "apiKey": "${ANTHROPIC_API_KEY}"
    }
  },
  "codeIntelligence": {
    "baseUrl": "http://localhost:3004",
    "supportedLanguages": ["typescript", "javascript", "python", "go", "rust"],
    "defaultMaxDepth": 10,
    "cacheEnabled": true,
    "indexingEnabled": true
  },
  "chartGenerator": {
    "baseUrl": "http://localhost:3005",
    "defaultTheme": "light",
    "defaultWidth": 800,
    "defaultHeight": 600,
    "outputFormat": "png",
    "cacheEnabled": true
  },
  "logging": {
    "level": "info",
    "format": "json",
    "file": "mcp-sdk.log"
  }
}
```

## Advanced Features

### Multi-Client Coordination

```typescript
import { MCPClientManager } from '@mcp-ecosystem/typescript-sdk';

// Initialize all clients with coordinated configuration
const manager = new MCPClientManager({
  configPath: './mcp-config.json',
  healthCheckInterval: 30000,
  failoverEnabled: true
});

// Get all clients
const taskClient = manager.getClient('taskOrchestrator');
const searchClient = manager.getClient('searchAggregator');
const swarmClient = manager.getClient('agentSwarm');
const codeClient = manager.getClient('codeIntelligence');
const chartClient = manager.getClient('chartGenerator');

// Health check all services
const healthStatus = await manager.healthCheckAll();
console.log('Service Health:', healthStatus);

// Automatic failover
if (healthStatus.taskOrchestrator.status !== 'healthy') {
  console.log('Task Orchestrator unhealthy, switching to backup...');
  await manager.switchToFailover('taskOrchestrator');
}
```

### Batch Operations

```typescript
// Batch task creation
const tasks = [
  { title: 'Task 1', description: 'Description 1', priority: 'high' },
  { title: 'Task 2', description: 'Description 2', priority: 'medium' },
  { title: 'Task 3', description: 'Description 3', priority: 'low' }
];

const batchResults = await taskClient.batchCreateTasks(tasks);
const successful = batchResults.filter(r => r.success);
console.log(`Created ${successful.length}/${tasks.length} tasks`);

// Parallel search across multiple queries
const queries = [
  'TypeScript best practices',
  'React performance optimization',
  'Node.js security patterns'
];

const parallelSearchResults = await Promise.all(
  queries.map(query => searchClient.search({ query, maxResults: 10 }))
);

// Aggregate results
const aggregatedResults = parallelSearchResults.flatMap(result => 
  result.success ? result.results : []
);
console.log(`Total aggregated results: ${aggregatedResults.length}`);
```

### Event-Driven Architecture

```typescript
import { EventEmitter } from '@mcp-ecosystem/typescript-sdk';

class TaskWorkflowManager extends EventEmitter {
  constructor(private taskClient: TaskOrchestratorClient) {
    super();
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    // Listen for task events
    this.taskClient.on('taskCreated', (task) => {
      console.log(`Task created: ${task.title}`);
      this.emit('workflowStep', 'task_created', task);
    });

    this.taskClient.on('taskCompleted', (task) => {
      console.log(`Task completed: ${task.title}`);
      this.emit('workflowStep', 'task_completed', task);
    });

    this.taskClient.on('executionStarted', (execution) => {
      console.log(`Execution started: ${execution.executionId}`);
      this.emit('workflowStep', 'execution_started', execution);
    });
  }

  async executeComplexWorkflow(workflowConfig: any) {
    this.emit('workflowStarted', workflowConfig);

    try {
      // Execute workflow steps
      for (const step of workflowConfig.steps) {
        await this.executeStep(step);
        this.emit('stepCompleted', step);
      }

      this.emit('workflowCompleted', workflowConfig);
    } catch (error) {
      this.emit('workflowError', { workflowConfig, error });
    }
  }
}

// Usage
const workflowManager = new TaskWorkflowManager(taskClient);

workflowManager.on('workflowStep', (stepType, data) => {
  console.log(`Workflow step: ${stepType}`, data);
});

workflowManager.on('workflowCompleted', (config) => {
  console.log('Workflow completed successfully', config);
});
```

### Custom Middleware

```typescript
import { Middleware, RequestContext } from '@mcp-ecosystem/typescript-sdk';

// Logging middleware
const loggingMiddleware: Middleware = async (ctx, next) => {
  const start = Date.now();
  
  console.log(`[${new Date().toISOString()}] ${ctx.method} ${ctx.endpoint}`);
  
  try {
    const result = await next(ctx);
    const duration = Date.now() - start;
    
    console.log(`[${new Date().toISOString()}] ${ctx.method} ${ctx.endpoint} - ${duration}ms`);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    
    console.error(`[${new Date().toISOString()}] ${ctx.method} ${ctx.endpoint} - ${duration}ms - ERROR: ${error.message}`);
    throw error;
  }
};

// Authentication middleware
const authMiddleware: Middleware = async (ctx, next) => {
  const token = ctx.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    throw new Error('Authentication required');
  }
  
  // Validate token
  const isValid = await validateToken(token);
  if (!isValid) {
    throw new Error('Invalid authentication token');
  }
  
  ctx.user = await getUserFromToken(token);
  return next(ctx);
};

// Rate limiting middleware
const rateLimitMiddleware: Middleware = (() => {
  const requests = new Map<string, number[]>();
  
  return async (ctx, next) => {
    const clientId = ctx.headers['x-client-id'] || 'anonymous';
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window
    
    if (!requests.has(clientId)) {
      requests.set(clientId, []);
    }
    
    const clientRequests = requests.get(clientId)!;
    const recentRequests = clientRequests.filter(time => time > windowStart);
    
    if (recentRequests.length >= 100) { // 100 requests per minute
      throw new Error('Rate limit exceeded');
    }
    
    recentRequests.push(now);
    requests.set(clientId, recentRequests);
    
    return next(ctx);
  };
})();

// Apply middleware to client
taskClient.use(loggingMiddleware);
taskClient.use(authMiddleware);
taskClient.use(rateLimitMiddleware);
```

## Error Handling

### Exception Hierarchy

```typescript
import { 
  MCPError,
  NetworkError,
  ValidationError,
  AuthenticationError,
  RateLimitError,
  TimeoutError,
  ServerError
} from '@mcp-ecosystem/typescript-sdk';

// Error handling with retry logic
async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof ValidationError) {
        // Validation errors shouldn't be retried
        throw error;
      }
      
      if (error instanceof AuthenticationError) {
        // Auth errors require token refresh
        await refreshAuthToken();
        continue;
      }
      
      if (error instanceof RateLimitError) {
        // Rate limit errors need exponential backoff
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`Rate limited, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      if (error instanceof NetworkError || error instanceof TimeoutError) {
        // Network/timeout errors can be retried
        if (attempt === maxRetries) {
          throw error;
        }
        
        const delay = baseDelay * attempt;
        console.log(`Network error, retrying in ${delay}ms... (attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Server errors and unknown errors
      throw error;
    }
  }
  
  throw new Error('Max retries exceeded');
}

// Usage
try {
  const result = await executeWithRetry(() => 
    taskClient.createTask({
      title: 'Test Task',
      description: 'Test Description'
    })
  );
  console.log('Task created:', result);
} catch (error) {
  if (error instanceof MCPError) {
    console.error(`MCP Error [${error.code}]: ${error.message}`);
    console.error('Details:', error.details);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### Custom Error Classes

```typescript
import { MCPError } from '@mcp-ecosystem/typescript-sdk';

class TaskValidationError extends MCPError {
  constructor(message: string, field?: string) {
    super('TASK_VALIDATION_ERROR', message, {
      field,
      timestamp: new Date().toISOString()
    });
  }
}

class TaskDependencyError extends MCPError {
  constructor(taskId: number, dependencyId: string) {
    super('TASK_DEPENDENCY_ERROR', `Task ${taskId} depends on non-existent task ${dependencyId}`, {
      taskId,
      dependencyId,
      timestamp: new Date().toISOString()
    });
  }
}

class AgentSwarmCapacityError extends MCPError {
  constructor(sessionId: string, requestedWorkers: number, availableWorkers: number) {
    super('SWARM_CAPACITY_ERROR', `Cannot spawn ${requestedWorkers} workers, only ${availableWorkers} available`, {
      sessionId,
      requestedWorkers,
      availableWorkers,
      timestamp: new Date().toISOString()
    });
  }
}

// Usage in custom validation
function validateTaskCreation(params: CreateTaskParams): void {
  if (!params.title || params.title.trim().length === 0) {
    throw new TaskValidationError('Title is required', 'title');
  }
  
  if (params.estimatedHours && params.estimatedHours < 0) {
    throw new TaskValidationError('Estimated hours must be positive', 'estimatedHours');
  }
  
  if (params.dependencies && params.dependencies.length > 50) {
    throw new TaskValidationError('Too many dependencies (max 50)', 'dependencies');
  }
}
```

## Testing

### Unit Tests

```typescript
import { TaskOrchestratorClient } from '@mcp-ecosystem/typescript-sdk';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('TaskOrchestratorClient', () => {
  let client: TaskOrchestratorClient;
  
  beforeEach(() => {
    client = new TaskOrchestratorClient({
      baseUrl: 'http://localhost:3001',
      timeout: 5000
    });
  });
  
  afterEach(() => {
    client.close();
  });

  describe('createTask', () => {
    it('should create a task with valid parameters', async () => {
      const params = {
        title: 'Test Task',
        description: 'Test Description',
        priority: 'medium' as const
      };
      
      const result = await client.createTask(params);
      
      expect(result.success).toBe(true);
      expect(result.taskId).toBeDefined();
      expect(result.title).toBe(params.title);
      expect(result.status).toBe('pending');
    });
    
    it('should reject invalid parameters', async () => {
      const params = {
        title: '',
        description: 'Test Description'
      };
      
      await expect(client.createTask(params)).rejects.toThrow('Title is required');
    });
  });

  describe('executeCode', () => {
    it('should execute TypeScript code successfully', async () => {
      const params = {
        taskId: 1,
        code: 'console.log("Hello, World!");',
        language: 'typescript' as const
      };
      
      const result = await client.executeCode(params);
      
      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.stdout).toContain('Hello, World!');
    });
  });
});
```

### Integration Tests

```typescript
import { 
  TaskOrchestratorClient,
  SearchAggregatorClient,
  AgentSwarmClient
} from '@mcp-ecosystem/typescript-sdk';

describe('MCP Ecosystem Integration', () => {
  let taskClient: TaskOrchestratorClient;
  let searchClient: SearchAggregatorClient;
  let swarmClient: AgentSwarmClient;
  
  beforeEach(() => {
    taskClient = new TaskOrchestratorClient({
      baseUrl: process.env.TASK_ORCHESTRATOR_URL || 'http://localhost:3001'
    });
    
    searchClient = new SearchAggregatorClient({
      baseUrl: process.env.SEARCH_AGGREGATOR_URL || 'http://localhost:3002'
    });
    
    swarmClient = new AgentSwarmClient({
      baseUrl: process.env.AGENT_SWARM_URL || 'http://localhost:3003'
    });
  });

  it('should execute complete research-to-task workflow', async () => {
    // 1. Research
    const searchResult = await searchClient.search({
      query: 'microservices architecture patterns',
      maxResults: 10
    });
    expect(searchResult.success).toBe(true);
    
    // 2. Create task from research
    const taskResult = await taskClient.createTask({
      title: 'Implement Microservices Architecture',
      description: `Based on research: ${searchResult.results.map(r => r.title).join(', ')}`,
      priority: 'high',
      estimatedHours: 40
    });
    expect(taskResult.success).toBe(true);
    
    // 3. Create swarm session
    const sessionResult = await swarmClient.createSession({
      name: 'Microservices Implementation',
      topology: 'hierarchical'
    });
    expect(sessionResult.success).toBe(true);
    
    // 4. Delegate task to swarm
    const delegationResult = await swarmClient.delegateTask({
      sessionId: sessionResult.sessionId,
      task: {
        id: taskResult.taskId,
        title: taskResult.title,
        description: taskResult.description,
        priority: 'high'
      },
      targetWorkerType: 'developer'
    });
    expect(delegationResult.success).toBe(true);
    
    // 5. Verify delegation status
    const statusResult = await swarmClient.getDelegationStatus({
      delegationId: delegationResult.delegationId
    });
    expect(statusResult.success).toBe(true);
  }, 30000); // 30 second timeout
});
```

## Deployment

### Docker Configuration

```dockerfile
# Multi-stage build for TypeScript SDK
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/
COPY tsconfig.build.json ./

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Create non-root user
RUN addgroup -g mcpuser && adduser -D -G mcpuser mcpuser
USER mcpuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "dist/index.js"]
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-ecosystem
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mcp-ecosystem
  template:
    metadata:
      labels:
        app: mcp-ecosystem
    spec:
      containers:
      - name: task-orchestrator
        image: your-registry/mcp-task-orchestrator:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: LOG_LEVEL
          value: "info"
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
      - name: search-aggregator
        image: your-registry/mcp-search-aggregator:latest
        ports:
        - containerPort: 3002
        env:
        - name: SEARCH_PROVIDERS
          value: "brave,tavily,perplexity"
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "512Mi"
            cpu: "400m"
```

### Monitoring and Metrics

```typescript
import { MCPMetricsCollector } from '@mcp-ecosystem/typescript-sdk';

const metrics = new MCPMetricsCollector({
  enabled: true,
  interval: 60000, // 1 minute
  exportFormat: 'prometheus'
});

// Collect metrics from all clients
metrics.addClient('task-orchestrator', taskClient);
metrics.addClient('search-aggregator', searchClient);
metrics.addClient('agent-swarm', swarmClient);

// Start collection
metrics.start();

// Get current metrics
const currentMetrics = metrics.getCurrentMetrics();
console.log('Current Metrics:', currentMetrics);

// Export metrics for Prometheus
const prometheusMetrics = metrics.exportPrometheus();
console.log(prometheusMetrics);

// Custom metrics
metrics.recordCustomMetric('workflow_completion_time', 1500, {
  workflow_type: 'research_to_task',
  success: 'true'
});

metrics.recordCustomMetric('agent_swarm_active_sessions', 5);
metrics.recordCustomMetric('search_queries_per_minute', 12);
```

## Best Practices

### Performance Optimization

1. **Connection Pooling**: Reuse connections where possible
2. **Batch Operations**: Group multiple operations together
3. **Caching**: Enable client-side caching for frequently accessed data
4. **Timeout Configuration**: Set appropriate timeouts for different operations
5. **Parallel Processing**: Use Promise.all for independent operations

### Error Handling

1. **Typed Errors**: Use specific error types for better handling
2. **Retry Logic**: Implement exponential backoff for transient failures
3. **Circuit Breaker**: Prevent cascade failures
4. **Graceful Degradation**: Provide fallbacks when services are unavailable
5. **Logging**: Log errors with context for debugging

### Security

1. **Authentication**: Use secure token management
2. **Input Validation**: Validate all inputs before sending
3. **HTTPS**: Always use HTTPS in production
4. **Rate Limiting**: Respect service rate limits
5. **Secrets Management**: Use environment variables for sensitive data

### Code Organization

1. **Client Separation**: Use separate clients for different services
2. **Configuration Management**: Centralize configuration
3. **Type Safety**: Leverage TypeScript's type system
4. **Error Boundaries**: Implement proper error boundaries
5. **Testing**: Write comprehensive unit and integration tests

This comprehensive TypeScript SDK documentation provides developers with all the tools needed to effectively integrate with the MCP ecosystem's TypeScript-based servers.