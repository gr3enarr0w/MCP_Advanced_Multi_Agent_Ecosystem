# MCP Ecosystem Enhancement Plan

## Executive Summary

This document outlines a comprehensive enhancement plan for the MCP Advanced Multi-Agent Ecosystem. The plan is divided into:

1. **Third-Party Additions** - Atlassian Integration, FastMCP (add as git submodules)
2. **Custom Implementation** - Chart Generator for PNG presentation outputs
3. **Feature Extractions** - Enhance existing servers with features from Claude-Flow, Graphiti, Task-Master, GPT-Researcher, and Serena (without adding those MCPs)
4. **New Service** - NanoGPT Go Proxy for intelligent model routing

---

## Part 1: Third-Party MCP Additions

### 1.1 Atlassian Integration

**Recommended Source:** `github.com/sooperset/mcp-atlassian` (51 tools, active maintenance)

**Alternative:** `github.com/atlassian/atlassian-mcp-server` (Official, OAuth 2.0 focused)

#### Installation Steps

```bash
# Add as git submodule
cd src/mcp-servers/external
git submodule add https://github.com/sooperset/mcp-atlassian.git atlassian-mcp

# Initialize
cd atlassian-mcp
docker build -t atlassian-mcp .
```

#### Configuration

Create `configs/atlassian-config.json`:
```json
{
  "confluence": {
    "url": "https://your-domain.atlassian.net/wiki",
    "auth": {
      "type": "token",
      "email": "${ATLASSIAN_EMAIL}",
      "token": "${ATLASSIAN_API_TOKEN}"
    }
  },
  "jira": {
    "url": "https://your-domain.atlassian.net",
    "auth": {
      "type": "token",
      "email": "${ATLASSIAN_EMAIL}",
      "token": "${ATLASSIAN_API_TOKEN}"
    }
  }
}
```

#### Environment Variables

```bash
# Add to .env.external-mcps
ATLASSIAN_EMAIL=your-email@company.com
ATLASSIAN_API_TOKEN=your-api-token
ATLASSIAN_DOMAIN=your-domain.atlassian.net
```

#### Agent-Swarm Routing Integration

Update `src/mcp-servers/agent-swarm/src/integration/mcp-bridge.ts`:

```typescript
// Add to EXTERNAL_MCP_ROUTES
const ATLASSIAN_KEYWORDS = [
  'jira', 'confluence', 'ticket', 'issue', 'sprint',
  'board', 'backlog', 'page', 'space', 'epic', 'story'
];

// Route configuration
{
  name: 'atlassian-mcp',
  keywords: ATLASSIAN_KEYWORDS,
  tools: {
    jira: ['search_issues', 'create_issue', 'update_issue', 'get_issue',
           'list_projects', 'get_sprint', 'move_issue_to_sprint'],
    confluence: ['search_pages', 'get_page', 'create_page', 'update_page',
                 'list_spaces', 'get_page_comments']
  },
  timeout: 30000
}
```

#### Available Tools (51 total)

**Jira Tools:**
| Tool | Description |
|------|-------------|
| `jira_search` | JQL-based issue search |
| `jira_create_issue` | Create new issue with fields |
| `jira_update_issue` | Update existing issue |
| `jira_get_issue` | Get issue details |
| `jira_add_comment` | Add comment to issue |
| `jira_transition_issue` | Move issue through workflow |
| `jira_list_projects` | List accessible projects |
| `jira_get_sprint` | Get sprint details |
| `jira_list_sprints` | List sprints for board |
| `jira_move_to_sprint` | Move issue to sprint |
| `jira_get_board` | Get board configuration |
| `jira_list_boards` | List all boards |

**Confluence Tools:**
| Tool | Description |
|------|-------------|
| `confluence_search` | CQL-based content search |
| `confluence_get_page` | Get page content |
| `confluence_create_page` | Create new page |
| `confluence_update_page` | Update page content |
| `confluence_delete_page` | Delete page |
| `confluence_list_spaces` | List accessible spaces |
| `confluence_get_comments` | Get page comments |
| `confluence_add_comment` | Add comment to page |

---

### 1.2 FastMCP Framework

**Source:** `github.com/jlowin/fastmcp`

**Purpose:** Rapid Python MCP server development for future custom servers

#### Installation Steps

```bash
# Add as git submodule
cd src/mcp-servers/external
git submodule add https://github.com/jlowin/fastmcp.git fastmcp

# Or install as package for development
pip install fastmcp
```

#### Usage Pattern

FastMCP simplifies MCP server creation. Example for creating new tools:

```python
from fastmcp import FastMCP

mcp = FastMCP("my-custom-server")

@mcp.tool()
def my_tool(param1: str, param2: int = 10) -> str:
    """Tool description for the LLM."""
    return f"Result: {param1} with {param2}"

@mcp.resource("data://{item_id}")
def get_data(item_id: str) -> str:
    """Resource for retrieving data."""
    return load_data(item_id)

# Run server
if __name__ == "__main__":
    mcp.run()
```

#### Integration Points

- Use for rapid prototyping of new MCP tools
- Template for Python-based custom servers
- Reference implementation for context-persistence enhancements

---

## Part 2: Custom Chart Generator

### Overview

Build a TypeScript MCP server that generates PNG charts for presentations.

### Directory Structure

```
src/mcp-servers/chart-generator/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # MCP server entry
│   ├── charts/
│   │   ├── bar-chart.ts
│   │   ├── line-chart.ts
│   │   ├── pie-chart.ts
│   │   ├── scatter-chart.ts
│   │   ├── radar-chart.ts
│   │   ├── gantt-chart.ts
│   │   └── heatmap-chart.ts
│   ├── renderers/
│   │   └── png-renderer.ts   # Chart.js + node-canvas
│   ├── templates/
│   │   └── presentation-themes.ts
│   └── types/
│       └── charts.ts
└── test/
    └── charts.test.ts
```

### Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "chart.js": "^4.4.0",
    "chartjs-node-canvas": "^4.1.6",
    "canvas": "^2.11.2",
    "date-fns": "^3.0.0"
  }
}
```

### MCP Tools

#### `create_bar_chart`
```typescript
interface BarChartInput {
  title: string;
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string;
  }[];
  options?: {
    width?: number;      // default: 800
    height?: number;     // default: 600
    theme?: 'light' | 'dark' | 'presentation';
    showLegend?: boolean;
    showValues?: boolean;
    orientation?: 'vertical' | 'horizontal';
  };
}

// Output
interface ChartOutput {
  filePath: string;      // ~/.mcp/charts/chart-{uuid}.png
  base64?: string;       // Optional inline base64
  width: number;
  height: number;
}
```

#### `create_line_chart`
```typescript
interface LineChartInput {
  title: string;
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    borderColor?: string;
    fill?: boolean;
  }[];
  options?: {
    width?: number;
    height?: number;
    theme?: 'light' | 'dark' | 'presentation';
    showPoints?: boolean;
    smoothed?: boolean;
    showArea?: boolean;
  };
}
```

#### `create_pie_chart`
```typescript
interface PieChartInput {
  title: string;
  labels: string[];
  data: number[];
  options?: {
    width?: number;
    height?: number;
    theme?: 'light' | 'dark' | 'presentation';
    donut?: boolean;      // Ring chart
    showPercentages?: boolean;
    showLegend?: boolean;
  };
}
```

#### `create_gantt_chart`
```typescript
interface GanttChartInput {
  title: string;
  tasks: {
    name: string;
    start: string;        // ISO date
    end: string;          // ISO date
    progress?: number;    // 0-100
    dependencies?: string[];
    color?: string;
  }[];
  options?: {
    width?: number;
    height?: number;
    theme?: 'light' | 'dark' | 'presentation';
    showProgress?: boolean;
    showDependencies?: boolean;
  };
}
```

#### `create_heatmap`
```typescript
interface HeatmapInput {
  title: string;
  xLabels: string[];
  yLabels: string[];
  data: number[][];       // 2D matrix
  options?: {
    width?: number;
    height?: number;
    theme?: 'light' | 'dark' | 'presentation';
    colorScale?: 'blue' | 'green' | 'red' | 'purple';
    showValues?: boolean;
  };
}
```

### PNG Renderer Implementation

```typescript
// src/renderers/png-renderer.ts
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { ChartConfiguration } from 'chart.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const CHARTS_DIR = path.join(process.env.HOME || '', '.mcp', 'charts');

export class PNGRenderer {
  private canvas: ChartJSNodeCanvas;

  constructor(width: number = 800, height: number = 600) {
    this.canvas = new ChartJSNodeCanvas({
      width,
      height,
      backgroundColour: 'white'
    });
  }

  async render(config: ChartConfiguration, options: RenderOptions): Promise<ChartOutput> {
    // Apply theme
    const themedConfig = this.applyTheme(config, options.theme);

    // Render to buffer
    const buffer = await this.canvas.renderToBuffer(themedConfig);

    // Save to file
    await fs.mkdir(CHARTS_DIR, { recursive: true });
    const filename = `chart-${uuidv4()}.png`;
    const filePath = path.join(CHARTS_DIR, filename);
    await fs.writeFile(filePath, buffer);

    return {
      filePath,
      base64: options.includeBase64 ? buffer.toString('base64') : undefined,
      width: options.width,
      height: options.height
    };
  }

  private applyTheme(config: ChartConfiguration, theme: string): ChartConfiguration {
    const themes = {
      presentation: {
        font: { size: 16, family: 'Arial' },
        colors: ['#2563eb', '#16a34a', '#dc2626', '#ca8a04', '#9333ea'],
        backgroundColor: '#ffffff',
        gridColor: '#e5e7eb'
      },
      dark: {
        font: { size: 14, family: 'Arial' },
        colors: ['#60a5fa', '#4ade80', '#f87171', '#facc15', '#c084fc'],
        backgroundColor: '#1f2937',
        gridColor: '#374151'
      },
      light: {
        font: { size: 14, family: 'Arial' },
        colors: ['#3b82f6', '#22c55e', '#ef4444', '#eab308', '#a855f7'],
        backgroundColor: '#ffffff',
        gridColor: '#e5e7eb'
      }
    };

    // Apply theme to config...
    return config;
  }
}
```

### Routing Integration

Add to agent-swarm routing:
```typescript
const CHART_KEYWORDS = [
  'chart', 'graph', 'plot', 'visualization', 'visualize',
  'bar chart', 'line chart', 'pie chart', 'gantt', 'heatmap'
];
```

---

## Part 3: Agent-Swarm Enhancements (from Claude-Flow)

### 3.1 Session Management

**Current Gap:** No persistent multi-session orchestration with resume capability

#### New Schema

```typescript
// src/mcp-servers/agent-swarm/src/types/sessions.ts

interface SwarmSession {
  id: string;
  projectId: string;
  name: string;
  topology: SwarmTopology;
  status: 'active' | 'paused' | 'completed' | 'failed';
  createdAt: Date;
  lastActiveAt: Date;
  config: SessionConfig;
  state: SessionState;
}

interface SessionConfig {
  maxAgents: number;
  defaultTimeout: number;
  memoryTier: 'working' | 'episodic' | 'persistent';
  autoResume: boolean;
}

interface SessionState {
  activeAgents: string[];
  pendingTasks: string[];
  completedTasks: string[];
  workingMemory: Map<string, any>;
  checkpoints: SessionCheckpoint[];
}

interface SessionCheckpoint {
  id: string;
  timestamp: Date;
  state: Partial<SessionState>;
  reason: string;
}

type SwarmTopology = 'flat' | 'hierarchical' | 'mesh' | 'star' | 'ring';
```

#### Database Changes

Add to `src/mcp-servers/agent-swarm/src/storage/agent-storage.ts`:

```sql
CREATE TABLE IF NOT EXISTS swarm_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  topology TEXT DEFAULT 'flat',
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  config JSON,
  state JSON,
  UNIQUE(project_id, name)
);

CREATE TABLE IF NOT EXISTS session_checkpoints (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  state JSON,
  reason TEXT,
  FOREIGN KEY (session_id) REFERENCES swarm_sessions(id)
);

CREATE INDEX idx_sessions_project ON swarm_sessions(project_id);
CREATE INDEX idx_sessions_status ON swarm_sessions(status);
```

#### New Tools

```typescript
// Tool: swarm_session_create
{
  name: 'swarm_session_create',
  description: 'Create a new persistent swarm session for a project',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: { type: 'string', description: 'Project identifier' },
      name: { type: 'string', description: 'Session name' },
      topology: {
        type: 'string',
        enum: ['flat', 'hierarchical', 'mesh', 'star', 'ring'],
        default: 'hierarchical'
      },
      config: {
        type: 'object',
        properties: {
          maxAgents: { type: 'number', default: 10 },
          defaultTimeout: { type: 'number', default: 300000 },
          autoResume: { type: 'boolean', default: true }
        }
      }
    },
    required: ['projectId', 'name']
  }
}

// Tool: swarm_session_resume
{
  name: 'swarm_session_resume',
  description: 'Resume a paused or previously active swarm session',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: { type: 'string', description: 'Session ID to resume' },
      fromCheckpoint: { type: 'string', description: 'Optional checkpoint ID' }
    },
    required: ['sessionId']
  }
}

// Tool: swarm_session_checkpoint
{
  name: 'swarm_session_checkpoint',
  description: 'Create a checkpoint of current session state',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: { type: 'string' },
      reason: { type: 'string', description: 'Reason for checkpoint' }
    },
    required: ['sessionId']
  }
}
```

### 3.2 Swarm Topologies

#### Implementation

```typescript
// src/mcp-servers/agent-swarm/src/orchestrator/topologies.ts

export abstract class SwarmTopology {
  abstract route(task: Task, agents: Agent[]): Agent;
  abstract broadcast(message: AgentMessage, agents: Agent[]): void;
  abstract getCoordinator(): Agent | null;
}

export class HierarchicalTopology extends SwarmTopology {
  private queen: Agent;
  private workers: Map<AgentType, Agent[]> = new Map();

  route(task: Task, agents: Agent[]): Agent {
    // Queen delegates to appropriate worker type
    const workerType = this.queen.determineWorkerType(task);
    const availableWorkers = this.workers.get(workerType) || [];
    return this.selectLeastBusy(availableWorkers);
  }

  broadcast(message: AgentMessage, agents: Agent[]): void {
    // Queen broadcasts to all workers
    for (const agent of agents) {
      if (agent.id !== this.queen.id) {
        agent.receive(message);
      }
    }
  }

  getCoordinator(): Agent {
    return this.queen;
  }
}

export class MeshTopology extends SwarmTopology {
  route(task: Task, agents: Agent[]): Agent {
    // Any agent can handle, select by capability match
    return this.selectByCapability(task, agents);
  }

  broadcast(message: AgentMessage, agents: Agent[]): void {
    // All agents receive
    for (const agent of agents) {
      agent.receive(message);
    }
  }

  getCoordinator(): Agent | null {
    return null; // No central coordinator
  }
}

export class StarTopology extends SwarmTopology {
  private hub: Agent;

  route(task: Task, agents: Agent[]): Agent {
    // All tasks go through hub first
    return this.hub;
  }

  broadcast(message: AgentMessage, agents: Agent[]): void {
    // Hub broadcasts to all spokes
    for (const agent of agents) {
      if (agent.id !== this.hub.id) {
        this.hub.forward(message, agent);
      }
    }
  }

  getCoordinator(): Agent {
    return this.hub;
  }
}
```

### 3.3 Tiered Memory System

#### Memory Tiers

```typescript
// src/mcp-servers/agent-swarm/src/memory/tiered-memory.ts

interface MemoryTier {
  name: string;
  storage: MemoryStorage;
  ttl: number;           // Time to live in ms
  maxSize: number;       // Max items
  queryLatency: number;  // Expected ms
}

const MEMORY_TIERS: MemoryTier[] = [
  {
    name: 'working',
    storage: new InMemoryStorage(),
    ttl: 1800000,        // 30 minutes
    maxSize: 1000,
    queryLatency: 1      // ~1ms
  },
  {
    name: 'episodic',
    storage: new SQLiteStorage('episodic.db'),
    ttl: 86400000,       // 24 hours
    maxSize: 100000,
    queryLatency: 5      // ~5ms
  },
  {
    name: 'persistent',
    storage: new QdrantStorage(),
    ttl: -1,             // No expiry
    maxSize: -1,         // Unlimited
    queryLatency: 20     // ~20ms
  }
];

export class TieredMemory {
  private tiers: Map<string, MemoryTier> = new Map();

  async store(key: string, value: any, tier: string = 'working'): Promise<void> {
    const targetTier = this.tiers.get(tier);
    await targetTier.storage.set(key, value, targetTier.ttl);
  }

  async retrieve(key: string): Promise<any> {
    // Search tiers from fastest to slowest
    for (const [name, tier] of this.tiers) {
      const value = await tier.storage.get(key);
      if (value !== null) {
        // Promote to faster tier on access
        if (name !== 'working') {
          await this.promote(key, value, name, 'working');
        }
        return value;
      }
    }
    return null;
  }

  async promote(key: string, value: any, fromTier: string, toTier: string): Promise<void> {
    const target = this.tiers.get(toTier);
    await target.storage.set(key, value, target.ttl);
  }

  async searchSemantic(query: string, tiers: string[] = ['persistent']): Promise<any[]> {
    const results: any[] = [];
    for (const tierName of tiers) {
      const tier = this.tiers.get(tierName);
      if (tier.storage.supportsSemantic) {
        results.push(...await tier.storage.searchSemantic(query));
      }
    }
    return results;
  }
}
```

#### New Tools

```typescript
// Tool: memory_store_tiered
{
  name: 'memory_store_tiered',
  description: 'Store data in a specific memory tier',
  inputSchema: {
    type: 'object',
    properties: {
      key: { type: 'string' },
      value: { type: 'object' },
      tier: {
        type: 'string',
        enum: ['working', 'episodic', 'persistent'],
        default: 'working'
      },
      metadata: { type: 'object' }
    },
    required: ['key', 'value']
  }
}

// Tool: memory_search_tiered
{
  name: 'memory_search_tiered',
  description: 'Search across memory tiers',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      tiers: {
        type: 'array',
        items: { type: 'string', enum: ['working', 'episodic', 'persistent'] },
        default: ['working', 'episodic', 'persistent']
      },
      searchType: {
        type: 'string',
        enum: ['exact', 'semantic', 'hybrid'],
        default: 'hybrid'
      },
      limit: { type: 'number', default: 10 }
    },
    required: ['query']
  }
}

// Tool: memory_promote
{
  name: 'memory_promote',
  description: 'Promote memory item to a faster tier',
  inputSchema: {
    type: 'object',
    properties: {
      key: { type: 'string' },
      fromTier: { type: 'string' },
      toTier: { type: 'string' }
    },
    required: ['key', 'fromTier', 'toTier']
  }
}
```

### 3.4 Worker Agent Spawning

```typescript
// src/mcp-servers/agent-swarm/src/orchestrator/worker-manager.ts

export class WorkerManager {
  private workers: Map<string, WorkerAgent> = new Map();
  private maxWorkers: number;

  async spawnWorkers(
    count: number,
    type: AgentType,
    task: Task
  ): Promise<WorkerAgent[]> {
    const spawned: WorkerAgent[] = [];

    for (let i = 0; i < count; i++) {
      if (this.workers.size >= this.maxWorkers) {
        throw new Error(`Max workers (${this.maxWorkers}) reached`);
      }

      const worker = new WorkerAgent({
        id: `worker-${type}-${uuidv4().slice(0, 8)}`,
        type,
        parentTask: task.id,
        status: 'idle'
      });

      this.workers.set(worker.id, worker);
      spawned.push(worker);
    }

    return spawned;
  }

  async coordinateParallel(
    tasks: Task[],
    strategy: 'round_robin' | 'load_balanced' | 'capability_matched'
  ): Promise<TaskResult[]> {
    const assignments = this.assignTasks(tasks, strategy);

    // Execute in parallel
    const promises = assignments.map(({ worker, task }) =>
      worker.execute(task)
    );

    return Promise.all(promises);
  }

  async aggregateResults(taskIds: string[]): Promise<AggregatedResult> {
    const results = await Promise.all(
      taskIds.map(id => this.getTaskResult(id))
    );

    return {
      taskIds,
      results,
      summary: this.summarizeResults(results),
      conflicts: this.detectConflicts(results),
      mergedOutput: this.mergeOutputs(results)
    };
  }
}
```

---

## Part 4: Context-Persistence Enhancements (from Graphiti)

### 4.1 Bi-Temporal Data Model

**Current Gap:** Single timestamp, no point-in-time queries

#### Schema Changes

```python
# src/mcp-servers/context-persistence/src/context_persistence/models.py

from sqlalchemy import Column, String, DateTime, Integer, Text, JSON, ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime

class Message(Base):
    __tablename__ = 'messages'

    id = Column(Integer, primary_key=True, autoincrement=True)
    conversation_id = Column(String, ForeignKey('conversations.id'))

    # Bi-temporal fields
    event_time = Column(DateTime, nullable=False)      # When the message occurred
    ingestion_time = Column(DateTime, default=datetime.utcnow)  # When stored
    valid_from = Column(DateTime, default=datetime.utcnow)      # When became valid
    valid_until = Column(DateTime, nullable=True)               # When invalidated

    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    tokens = Column(Integer)
    embedding_id = Column(String)
    metadata = Column(JSON)

    __table_args__ = (
        Index('idx_message_event_time', 'event_time'),
        Index('idx_message_valid_range', 'valid_from', 'valid_until'),
    )


class Entity(Base):
    __tablename__ = 'entities'

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # person, project, concept, tool, etc.

    # Bi-temporal
    event_time = Column(DateTime, nullable=False)
    ingestion_time = Column(DateTime, default=datetime.utcnow)
    valid_from = Column(DateTime, default=datetime.utcnow)
    valid_until = Column(DateTime, nullable=True)

    properties = Column(JSON)
    embedding_id = Column(String)

    # Relationships
    source_relationships = relationship('Relationship', foreign_keys='Relationship.source_entity_id')
    target_relationships = relationship('Relationship', foreign_keys='Relationship.target_entity_id')

    __table_args__ = (
        Index('idx_entity_type', 'type'),
        Index('idx_entity_name', 'name'),
    )


class Relationship(Base):
    __tablename__ = 'relationships'

    id = Column(String, primary_key=True)
    source_entity_id = Column(String, ForeignKey('entities.id'))
    target_entity_id = Column(String, ForeignKey('entities.id'))
    relationship_type = Column(String, nullable=False)  # works_on, knows, uses, etc.

    # Bi-temporal
    event_time = Column(DateTime, nullable=False)
    ingestion_time = Column(DateTime, default=datetime.utcnow)
    valid_from = Column(DateTime, default=datetime.utcnow)
    valid_until = Column(DateTime, nullable=True)

    properties = Column(JSON)
    confidence = Column(Float, default=1.0)
    source = Column(String)  # Which conversation/message created this

    __table_args__ = (
        Index('idx_rel_source', 'source_entity_id'),
        Index('idx_rel_target', 'target_entity_id'),
        Index('idx_rel_type', 'relationship_type'),
    )


class Episode(Base):
    __tablename__ = 'episodes'

    id = Column(String, primary_key=True)
    conversation_id = Column(String, ForeignKey('conversations.id'))
    sequence_num = Column(Integer, nullable=False)

    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)

    summary = Column(Text)
    key_entities = Column(JSON)  # List of entity IDs
    key_decisions = Column(JSON)
    embedding_id = Column(String)

    __table_args__ = (
        Index('idx_episode_conv', 'conversation_id'),
        Index('idx_episode_time', 'start_time', 'end_time'),
    )
```

### 4.2 Entity Extraction

```python
# src/mcp-servers/context-persistence/src/context_persistence/extraction.py

import re
from typing import List, Dict, Any
from dataclasses import dataclass

@dataclass
class ExtractedEntity:
    name: str
    type: str
    mentions: List[int]  # Message IDs where mentioned
    confidence: float
    properties: Dict[str, Any]

class EntityExtractor:
    """Extract entities from conversation messages."""

    ENTITY_PATTERNS = {
        'person': [
            r'\b([A-Z][a-z]+ [A-Z][a-z]+)\b',  # Full names
            r'@(\w+)',  # Mentions
        ],
        'project': [
            r'\b([A-Z][A-Za-z0-9-]+(?:\.js|\.py|\.ts)?)\b',  # Project names
            r'repo(?:sitory)?\s+["\']?([^"\']+)["\']?',
        ],
        'tool': [
            r'\b(git|docker|npm|pip|kubectl|terraform)\b',
            r'\b([A-Za-z]+(?:DB|SQL|API))\b',
        ],
        'concept': [
            r'\b(API|REST|GraphQL|microservice|database|cache)\b',
        ],
        'file': [
            r'([a-zA-Z0-9_/-]+\.[a-z]{2,4})\b',
        ]
    }

    async def extract_from_conversation(
        self,
        conversation_id: str,
        messages: List[Dict]
    ) -> List[ExtractedEntity]:
        entities: Dict[str, ExtractedEntity] = {}

        for msg in messages:
            content = msg['content']
            msg_id = msg['id']

            for entity_type, patterns in self.ENTITY_PATTERNS.items():
                for pattern in patterns:
                    matches = re.findall(pattern, content, re.IGNORECASE)
                    for match in matches:
                        name = match.strip()
                        key = f"{entity_type}:{name.lower()}"

                        if key in entities:
                            entities[key].mentions.append(msg_id)
                            entities[key].confidence = min(1.0, entities[key].confidence + 0.1)
                        else:
                            entities[key] = ExtractedEntity(
                                name=name,
                                type=entity_type,
                                mentions=[msg_id],
                                confidence=0.5,
                                properties={}
                            )

        return list(entities.values())

    async def extract_relationships(
        self,
        entities: List[ExtractedEntity],
        messages: List[Dict]
    ) -> List[Dict]:
        """Extract relationships between entities based on co-occurrence."""
        relationships = []

        # Co-occurrence in same message = potential relationship
        for msg in messages:
            msg_entities = [e for e in entities if msg['id'] in e.mentions]

            for i, e1 in enumerate(msg_entities):
                for e2 in msg_entities[i+1:]:
                    rel_type = self._infer_relationship_type(e1, e2, msg['content'])
                    relationships.append({
                        'source': e1.name,
                        'target': e2.name,
                        'type': rel_type,
                        'source_message': msg['id']
                    })

        return relationships

    def _infer_relationship_type(self, e1, e2, context: str) -> str:
        """Infer relationship type from entity types and context."""
        type_pair = (e1.type, e2.type)

        relationship_map = {
            ('person', 'project'): 'works_on',
            ('person', 'tool'): 'uses',
            ('project', 'tool'): 'depends_on',
            ('person', 'person'): 'collaborates_with',
            ('project', 'concept'): 'implements',
        }

        return relationship_map.get(type_pair, 'related_to')
```

### 4.3 Hybrid Search

```python
# src/mcp-servers/context-persistence/src/context_persistence/search.py

from enum import Enum
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

class SearchMode(Enum):
    SEMANTIC = "semantic"
    KEYWORD = "keyword"
    GRAPH = "graph"
    HYBRID = "hybrid"

@dataclass
class SearchResult:
    id: str
    content: str
    score: float
    source: str  # semantic, keyword, or graph
    metadata: Dict[str, Any]

class HybridSearch:
    """Combines semantic, keyword (BM25), and graph traversal search."""

    def __init__(self, qdrant_client, db_session, bm25_index):
        self.qdrant = qdrant_client
        self.db = db_session
        self.bm25 = bm25_index

    async def search(
        self,
        query: str,
        mode: SearchMode = SearchMode.HYBRID,
        limit: int = 10,
        filters: Optional[Dict] = None
    ) -> List[SearchResult]:
        results = []

        if mode in (SearchMode.SEMANTIC, SearchMode.HYBRID):
            semantic_results = await self._semantic_search(query, limit, filters)
            results.extend(semantic_results)

        if mode in (SearchMode.KEYWORD, SearchMode.HYBRID):
            keyword_results = await self._keyword_search(query, limit, filters)
            results.extend(keyword_results)

        if mode in (SearchMode.GRAPH, SearchMode.HYBRID):
            graph_results = await self._graph_search(query, limit, filters)
            results.extend(graph_results)

        # Deduplicate and re-rank
        return self._merge_and_rank(results, limit)

    async def _semantic_search(self, query: str, limit: int, filters: Dict) -> List[SearchResult]:
        """Vector similarity search using Qdrant."""
        embedding = await self._get_embedding(query)

        results = self.qdrant.search(
            collection_name="messages",
            query_vector=embedding,
            limit=limit,
            query_filter=filters
        )

        return [
            SearchResult(
                id=r.id,
                content=r.payload.get('content', ''),
                score=r.score,
                source='semantic',
                metadata=r.payload
            )
            for r in results
        ]

    async def _keyword_search(self, query: str, limit: int, filters: Dict) -> List[SearchResult]:
        """BM25 keyword search."""
        tokens = self._tokenize(query)
        scores = self.bm25.get_scores(tokens)

        top_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:limit]

        results = []
        for idx in top_indices:
            if scores[idx] > 0:
                doc = self.bm25.corpus[idx]
                results.append(SearchResult(
                    id=doc['id'],
                    content=doc['content'],
                    score=scores[idx],
                    source='keyword',
                    metadata=doc.get('metadata', {})
                ))

        return results

    async def _graph_search(self, query: str, limit: int, filters: Dict) -> List[SearchResult]:
        """Graph traversal search starting from matched entities."""
        # Extract entities from query
        entities = await self._extract_query_entities(query)

        if not entities:
            return []

        # Traverse relationships
        visited = set()
        results = []

        for entity in entities:
            related = await self._traverse_relationships(entity, depth=2, visited=visited)
            for rel in related:
                results.append(SearchResult(
                    id=rel['entity_id'],
                    content=rel['summary'],
                    score=rel['relevance'],
                    source='graph',
                    metadata={'path': rel['path']}
                ))

        return results[:limit]

    def _merge_and_rank(self, results: List[SearchResult], limit: int) -> List[SearchResult]:
        """Merge results from different sources using reciprocal rank fusion."""
        scores = {}
        k = 60  # RRF constant

        # Group by source and rank
        by_source = {}
        for r in results:
            if r.source not in by_source:
                by_source[r.source] = []
            by_source[r.source].append(r)

        # Sort each source by score
        for source in by_source:
            by_source[source].sort(key=lambda x: x.score, reverse=True)

        # Calculate RRF scores
        for source, source_results in by_source.items():
            for rank, result in enumerate(source_results):
                if result.id not in scores:
                    scores[result.id] = {'score': 0, 'result': result}
                scores[result.id]['score'] += 1.0 / (k + rank + 1)

        # Sort by combined score
        merged = sorted(scores.values(), key=lambda x: x['score'], reverse=True)
        return [item['result'] for item in merged[:limit]]
```

### 4.4 New Tools

```python
# Add to src/mcp-servers/context-persistence/src/context_persistence/server.py

@server.tool()
async def extract_entities(conversation_id: str) -> Dict[str, Any]:
    """Extract entities (people, projects, tools, concepts) from a conversation."""
    messages = await load_messages(conversation_id)
    extractor = EntityExtractor()
    entities = await extractor.extract_from_conversation(conversation_id, messages)

    # Store entities
    for entity in entities:
        await store_entity(entity)

    return {
        "conversation_id": conversation_id,
        "entities_found": len(entities),
        "entities": [{"name": e.name, "type": e.type, "confidence": e.confidence} for e in entities]
    }

@server.tool()
async def create_relationship(
    source_entity: str,
    relationship_type: str,
    target_entity: str,
    event_time: Optional[str] = None,
    properties: Optional[Dict] = None
) -> Dict[str, Any]:
    """Create a relationship between two entities in the knowledge graph."""
    rel = Relationship(
        id=str(uuid4()),
        source_entity_id=source_entity,
        target_entity_id=target_entity,
        relationship_type=relationship_type,
        event_time=parse_datetime(event_time) if event_time else datetime.utcnow(),
        properties=properties or {}
    )
    await save_relationship(rel)
    return {"id": rel.id, "created": True}

@server.tool()
async def query_knowledge_graph(
    entity: str,
    depth: int = 2,
    relationship_types: Optional[List[str]] = None,
    as_of_time: Optional[str] = None
) -> Dict[str, Any]:
    """Query the knowledge graph starting from an entity, with optional point-in-time."""
    timestamp = parse_datetime(as_of_time) if as_of_time else datetime.utcnow()

    graph = await traverse_graph(
        start_entity=entity,
        depth=depth,
        relationship_types=relationship_types,
        valid_at=timestamp
    )

    return {
        "root": entity,
        "nodes": graph['nodes'],
        "edges": graph['edges'],
        "as_of": timestamp.isoformat()
    }

@server.tool()
async def search_hybrid(
    query: str,
    mode: str = "hybrid",  # semantic, keyword, graph, hybrid
    limit: int = 10,
    conversation_id: Optional[str] = None
) -> Dict[str, Any]:
    """Search using hybrid semantic + keyword + graph search."""
    search_mode = SearchMode(mode)
    filters = {"conversation_id": conversation_id} if conversation_id else None

    results = await hybrid_search.search(query, search_mode, limit, filters)

    return {
        "query": query,
        "mode": mode,
        "results": [
            {
                "id": r.id,
                "content": r.content[:500],
                "score": r.score,
                "source": r.source,
                "metadata": r.metadata
            }
            for r in results
        ]
    }

@server.tool()
async def get_point_in_time_context(
    entity: str,
    timestamp: str
) -> Dict[str, Any]:
    """Get the state of an entity and its relationships at a specific point in time."""
    ts = parse_datetime(timestamp)

    # Get entity state at timestamp
    entity_state = await get_entity_at_time(entity, ts)

    # Get valid relationships at timestamp
    relationships = await get_relationships_at_time(entity, ts)

    # Get relevant messages around timestamp
    messages = await get_messages_around_time(entity, ts, window_hours=24)

    return {
        "entity": entity_state,
        "relationships": relationships,
        "context_messages": messages,
        "as_of": ts.isoformat()
    }
```

---

## Part 5: Task-Orchestrator Enhancements (from Task-Master)

### 5.1 PRD Parsing

```typescript
// src/mcp-servers/task-orchestrator/src/prd/parser.ts

interface PRDSection {
  type: 'overview' | 'requirements' | 'user_stories' | 'technical' | 'acceptance';
  title: string;
  content: string;
  items: PRDItem[];
}

interface PRDItem {
  id: string;
  text: string;
  priority: 'must' | 'should' | 'could' | 'wont';
  complexity?: number;
}

interface ParsedPRD {
  title: string;
  version: string;
  sections: PRDSection[];
  extractedTasks: Task[];
}

export class PRDParser {
  private patterns = {
    requirement: /^(?:REQ|R)-?\d+[:\s]+(.+)$/gm,
    userStory: /^As an? (.+), I want (.+), so that (.+)$/gm,
    acceptance: /^(?:AC|Given|When|Then)[:\s]+(.+)$/gm,
    priority: /\[(must|should|could|won't)\]/i,
    heading: /^#{1,3}\s+(.+)$/gm,
  };

  async parse(content: string): Promise<ParsedPRD> {
    const sections = this.extractSections(content);
    const items = this.extractItems(sections);
    const tasks = await this.generateTasks(items);

    return {
      title: this.extractTitle(content),
      version: this.extractVersion(content),
      sections,
      extractedTasks: tasks
    };
  }

  private extractSections(content: string): PRDSection[] {
    const sections: PRDSection[] = [];
    const headings = content.match(this.patterns.heading) || [];

    // Split content by headings and categorize
    // Implementation details...

    return sections;
  }

  private async generateTasks(items: PRDItem[]): Promise<Task[]> {
    const tasks: Task[] = [];

    for (const item of items) {
      // Convert PRD items to tasks with dependencies
      const task: Task = {
        id: `task-${uuidv4().slice(0, 8)}`,
        title: this.itemToTitle(item),
        description: item.text,
        status: 'pending',
        priority: this.priorityToNumber(item.priority),
        tags: [item.type],
        metadata: {
          source: 'prd',
          sourceId: item.id,
          complexity: item.complexity
        }
      };

      tasks.push(task);
    }

    // Infer dependencies between tasks
    return this.inferDependencies(tasks);
  }

  private inferDependencies(tasks: Task[]): Task[] {
    // Use keywords and ordering to infer dependencies
    const keywords = {
      depends: ['after', 'requires', 'depends on', 'following'],
      blocks: ['before', 'enables', 'prerequisite for']
    };

    for (const task of tasks) {
      for (const dep of keywords.depends) {
        // Check if task description references other tasks
        // Implementation details...
      }
    }

    return tasks;
  }
}
```

### 5.2 Complexity Analysis

```typescript
// src/mcp-servers/task-orchestrator/src/analysis/complexity.ts

interface ComplexityFactors {
  codeChanges: number;      // 1-10: Estimated lines/files affected
  dependencies: number;     // 1-10: Number of dependent systems
  uncertainty: number;      // 1-10: Unknowns and research needed
  testing: number;          // 1-10: Testing effort required
  integration: number;      // 1-10: Integration complexity
}

interface ComplexityReport {
  taskId: string;
  overallScore: number;     // 1-10 weighted average
  factors: ComplexityFactors;
  estimatedHours: {
    optimistic: number;
    likely: number;
    pessimistic: number;
  };
  riskLevel: 'low' | 'medium' | 'high';
  recommendations: string[];
  breakdownSuggested: boolean;
}

export class ComplexityAnalyzer {
  private weights = {
    codeChanges: 0.25,
    dependencies: 0.20,
    uncertainty: 0.25,
    testing: 0.15,
    integration: 0.15
  };

  async analyze(task: Task): Promise<ComplexityReport> {
    const factors = await this.assessFactors(task);
    const overallScore = this.calculateScore(factors);
    const estimates = this.estimateEffort(factors, overallScore);

    return {
      taskId: task.id,
      overallScore,
      factors,
      estimatedHours: estimates,
      riskLevel: this.determineRisk(overallScore, factors),
      recommendations: this.generateRecommendations(factors, overallScore),
      breakdownSuggested: overallScore > 7
    };
  }

  private async assessFactors(task: Task): Promise<ComplexityFactors> {
    return {
      codeChanges: await this.assessCodeChanges(task),
      dependencies: await this.assessDependencies(task),
      uncertainty: await this.assessUncertainty(task),
      testing: await this.assessTesting(task),
      integration: await this.assessIntegration(task)
    };
  }

  private calculateScore(factors: ComplexityFactors): number {
    let score = 0;
    for (const [factor, weight] of Object.entries(this.weights)) {
      score += factors[factor as keyof ComplexityFactors] * weight;
    }
    return Math.round(score * 10) / 10;
  }

  private estimateEffort(factors: ComplexityFactors, score: number) {
    // Base hours estimation using PERT-like calculation
    const baseHours = score * 4; // 4 hours per complexity point base

    return {
      optimistic: Math.round(baseHours * 0.6),
      likely: Math.round(baseHours),
      pessimistic: Math.round(baseHours * 1.8)
    };
  }

  private generateRecommendations(factors: ComplexityFactors, score: number): string[] {
    const recommendations: string[] = [];

    if (factors.uncertainty > 7) {
      recommendations.push('Consider a spike/research task before implementation');
    }
    if (factors.dependencies > 7) {
      recommendations.push('Coordinate with dependent team/systems early');
    }
    if (factors.testing > 7) {
      recommendations.push('Plan dedicated testing phase with QA involvement');
    }
    if (score > 8) {
      recommendations.push('Break down into smaller subtasks');
    }

    return recommendations;
  }
}
```

### 5.3 Task Expansion

```typescript
// src/mcp-servers/task-orchestrator/src/expansion/task-expander.ts

interface ExpansionConfig {
  maxDepth: number;
  minSubtasks: number;
  maxSubtasks: number;
  includeTestTasks: boolean;
  includeDocTasks: boolean;
}

interface ExpandedTask extends Task {
  subtasks: ExpandedTask[];
  expansionDepth: number;
  parentTaskId: string | null;
}

export class TaskExpander {
  private defaultConfig: ExpansionConfig = {
    maxDepth: 3,
    minSubtasks: 2,
    maxSubtasks: 8,
    includeTestTasks: true,
    includeDocTasks: false
  };

  async expand(task: Task, config?: Partial<ExpansionConfig>): Promise<ExpandedTask> {
    const cfg = { ...this.defaultConfig, ...config };
    return this.expandRecursive(task, cfg, 0, null);
  }

  private async expandRecursive(
    task: Task,
    config: ExpansionConfig,
    depth: number,
    parentId: string | null
  ): Promise<ExpandedTask> {
    const expanded: ExpandedTask = {
      ...task,
      subtasks: [],
      expansionDepth: depth,
      parentTaskId: parentId
    };

    if (depth >= config.maxDepth) {
      return expanded;
    }

    // Analyze task to determine if expansion is needed
    const complexity = await this.analyzeComplexity(task);

    if (complexity.overallScore < 4) {
      return expanded; // Simple enough, no expansion needed
    }

    // Generate subtasks based on task type and content
    const subtasks = await this.generateSubtasks(task, config);

    // Recursively expand subtasks if needed
    for (const subtask of subtasks) {
      const expandedSubtask = await this.expandRecursive(
        subtask,
        config,
        depth + 1,
        task.id
      );
      expanded.subtasks.push(expandedSubtask);
    }

    return expanded;
  }

  private async generateSubtasks(task: Task, config: ExpansionConfig): Promise<Task[]> {
    const subtasks: Task[] = [];

    // Standard development phases
    const phases = [
      { name: 'Research & Design', prefix: 'design' },
      { name: 'Implementation', prefix: 'impl' },
      { name: 'Testing', prefix: 'test', conditional: config.includeTestTasks },
      { name: 'Documentation', prefix: 'doc', conditional: config.includeDocTasks }
    ];

    for (const phase of phases) {
      if (phase.conditional === false) continue;

      subtasks.push({
        id: `${task.id}-${phase.prefix}`,
        title: `${phase.name}: ${task.title}`,
        description: `${phase.name} phase for: ${task.description}`,
        status: 'pending',
        priority: task.priority,
        dependencies: phase.prefix !== 'design' ? [subtasks[subtasks.length - 1]?.id].filter(Boolean) : [],
        tags: [...(task.tags || []), phase.prefix],
        metadata: {
          parentTask: task.id,
          phase: phase.prefix
        }
      });
    }

    return subtasks;
  }
}
```

### 5.4 Smart Next Task

```typescript
// src/mcp-servers/task-orchestrator/src/scheduling/next-task.ts

interface NextTaskCriteria {
  projectId?: string;
  excludeBlocked: boolean;
  prioritizeUrgent: boolean;
  considerDependencies: boolean;
  considerSkills?: string[];
  maxComplexity?: number;
}

interface NextTaskResult {
  task: Task;
  reason: string;
  readinessScore: number;
  blockers: string[];
  prerequisites: Task[];
}

export class NextTaskSelector {
  async selectNext(criteria: NextTaskCriteria): Promise<NextTaskResult | null> {
    // Get all pending tasks
    let tasks = await this.getPendingTasks(criteria.projectId);

    // Filter out blocked tasks
    if (criteria.excludeBlocked) {
      tasks = await this.filterUnblocked(tasks);
    }

    // Score each task
    const scored = await Promise.all(
      tasks.map(task => this.scoreTask(task, criteria))
    );

    // Sort by score descending
    scored.sort((a, b) => b.readinessScore - a.readinessScore);

    if (scored.length === 0) {
      return null;
    }

    const selected = scored[0];
    return {
      task: selected.task,
      reason: this.generateReason(selected),
      readinessScore: selected.readinessScore,
      blockers: selected.blockers,
      prerequisites: selected.prerequisites
    };
  }

  private async scoreTask(
    task: Task,
    criteria: NextTaskCriteria
  ): Promise<ScoredTask> {
    let score = 0;
    const factors: string[] = [];

    // Priority weight (0-40 points)
    score += (5 - task.priority) * 10;
    factors.push(`priority: ${task.priority}`);

    // Dependency readiness (0-30 points)
    const depScore = await this.scoreDependencyReadiness(task);
    score += depScore * 30;
    factors.push(`deps ready: ${depScore}`);

    // Age bonus - older tasks get slight priority (0-10 points)
    const ageScore = this.scoreAge(task);
    score += ageScore * 10;

    // Complexity preference (0-20 points)
    if (criteria.maxComplexity) {
      const complexity = task.metadata?.complexity || 5;
      if (complexity <= criteria.maxComplexity) {
        score += (criteria.maxComplexity - complexity + 1) * 4;
      }
    }

    return {
      task,
      readinessScore: score,
      factors,
      blockers: await this.findBlockers(task),
      prerequisites: await this.getPrerequisites(task)
    };
  }

  private generateReason(scored: ScoredTask): string {
    const reasons: string[] = [];

    if (scored.task.priority <= 2) {
      reasons.push('high priority');
    }
    if (scored.blockers.length === 0) {
      reasons.push('no blockers');
    }
    if (scored.prerequisites.length === 0) {
      reasons.push('all prerequisites complete');
    }

    return `Recommended: ${reasons.join(', ')}`;
  }
}
```

### 5.5 New Tools

```typescript
// Add to src/mcp-servers/task-orchestrator/src/index.ts

// Tool: parse_prd
{
  name: 'parse_prd',
  description: 'Parse a PRD document and generate tasks',
  inputSchema: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'PRD content (markdown or plain text)'
      },
      projectId: {
        type: 'string',
        description: 'Project to add tasks to'
      },
      autoCreate: {
        type: 'boolean',
        default: false,
        description: 'Automatically create tasks (vs preview only)'
      }
    },
    required: ['content']
  }
}

// Tool: analyze_complexity
{
  name: 'analyze_complexity',
  description: 'Analyze task complexity and provide effort estimates',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: { type: 'string', description: 'Task to analyze' }
    },
    required: ['taskId']
  }
}

// Tool: expand_task
{
  name: 'expand_task',
  description: 'Expand a task into subtasks based on complexity',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: { type: 'string' },
      depth: { type: 'number', default: 2, maximum: 3 },
      includeTests: { type: 'boolean', default: true },
      includeDocs: { type: 'boolean', default: false }
    },
    required: ['taskId']
  }
}

// Tool: get_next_task
{
  name: 'get_next_task',
  description: 'Get AI-recommended next task to work on',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: { type: 'string' },
      maxComplexity: { type: 'number', minimum: 1, maximum: 10 },
      excludeBlocked: { type: 'boolean', default: true }
    }
  }
}

// Tool: get_project_complexity_report
{
  name: 'get_project_complexity_report',
  description: 'Get complexity analysis for all tasks in a project',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: { type: 'string' },
      includeSubtasks: { type: 'boolean', default: true }
    },
    required: ['projectId']
  }
}
```

---

## Part 6: Search-Aggregator Enhancements (from GPT-Researcher)

### 6.1 Deep Research Mode

```typescript
// src/mcp-servers/search-aggregator/src/research/deep-research.ts

interface ResearchConfig {
  topic: string;
  depth: 1 | 2 | 3 | 4 | 5;      // Research depth
  breadth: number;               // Questions per level (1-10)
  maxSources: number;
  includeLocal: boolean;
  localPaths?: string[];
  timeout: number;
}

interface ResearchPlan {
  mainQuestion: string;
  subQuestions: string[];
  searchStrategies: SearchStrategy[];
  expectedSources: number;
}

interface ResearchResult {
  id: string;
  topic: string;
  plan: ResearchPlan;
  sources: Source[];
  findings: Finding[];
  report: ResearchReport;
  metadata: {
    duration: number;
    sourcesSearched: number;
    sourcesUsed: number;
  };
}

export class DeepResearcher {
  private planner: ResearchPlanner;
  private executor: ParallelExecutor;
  private synthesizer: ReportSynthesizer;

  async research(config: ResearchConfig): Promise<ResearchResult> {
    const startTime = Date.now();

    // Phase 1: Generate research plan
    const plan = await this.planner.createPlan(config);

    // Phase 2: Execute searches in parallel
    const rawResults = await this.executor.executeParallel(plan, config);

    // Phase 3: Validate and score sources
    const validatedSources = await this.validateSources(rawResults);

    // Phase 4: Extract findings
    const findings = await this.extractFindings(validatedSources, config.topic);

    // Phase 5: Synthesize report
    const report = await this.synthesizer.generate(findings, config);

    return {
      id: uuidv4(),
      topic: config.topic,
      plan,
      sources: validatedSources,
      findings,
      report,
      metadata: {
        duration: Date.now() - startTime,
        sourcesSearched: rawResults.length,
        sourcesUsed: validatedSources.length
      }
    };
  }
}
```

### 6.2 Research Planner

```typescript
// src/mcp-servers/search-aggregator/src/research/planner.ts

export class ResearchPlanner {
  async createPlan(config: ResearchConfig): Promise<ResearchPlan> {
    // Generate sub-questions based on depth
    const subQuestions = await this.generateSubQuestions(
      config.topic,
      config.depth,
      config.breadth
    );

    // Determine search strategies for each question
    const strategies = subQuestions.map(q => this.selectStrategy(q));

    return {
      mainQuestion: config.topic,
      subQuestions,
      searchStrategies: strategies,
      expectedSources: config.breadth * config.depth * 3
    };
  }

  private async generateSubQuestions(
    topic: string,
    depth: number,
    breadth: number
  ): Promise<string[]> {
    const questions: string[] = [];

    // Level 1: Direct aspects of the topic
    const aspects = [
      `What is ${topic}?`,
      `How does ${topic} work?`,
      `What are the benefits of ${topic}?`,
      `What are the challenges with ${topic}?`,
      `What are alternatives to ${topic}?`
    ];

    questions.push(...aspects.slice(0, breadth));

    if (depth >= 2) {
      // Level 2: Implementation and practical aspects
      questions.push(
        `How to implement ${topic}?`,
        `Best practices for ${topic}`,
        `Common mistakes with ${topic}`
      );
    }

    if (depth >= 3) {
      // Level 3: Advanced and comparative
      questions.push(
        `${topic} vs alternatives comparison`,
        `Future of ${topic}`,
        `Case studies using ${topic}`
      );
    }

    if (depth >= 4) {
      // Level 4: Expert and edge cases
      questions.push(
        `Advanced ${topic} techniques`,
        `${topic} scalability considerations`,
        `${topic} security implications`
      );
    }

    if (depth >= 5) {
      // Level 5: Cutting edge
      questions.push(
        `Latest research on ${topic}`,
        `Emerging trends in ${topic}`,
        `${topic} in production at scale`
      );
    }

    return questions;
  }

  private selectStrategy(question: string): SearchStrategy {
    // Analyze question to determine best search approach
    if (question.includes('how to') || question.includes('implement')) {
      return { type: 'technical', providers: ['perplexity', 'google'], focus: 'tutorials' };
    }
    if (question.includes('vs') || question.includes('comparison')) {
      return { type: 'comparative', providers: ['perplexity', 'brave'], focus: 'reviews' };
    }
    if (question.includes('latest') || question.includes('research')) {
      return { type: 'academic', providers: ['perplexity'], focus: 'papers' };
    }
    return { type: 'general', providers: ['perplexity', 'brave', 'google'], focus: 'all' };
  }
}
```

### 6.3 Parallel Executor

```typescript
// src/mcp-servers/search-aggregator/src/research/parallel-executor.ts

export class ParallelExecutor {
  private maxConcurrent = 5;

  async executeParallel(plan: ResearchPlan, config: ResearchConfig): Promise<RawSearchResult[]> {
    const results: RawSearchResult[] = [];
    const queue = [...plan.subQuestions];
    const executing: Promise<void>[] = [];

    while (queue.length > 0 || executing.length > 0) {
      // Fill up to maxConcurrent
      while (queue.length > 0 && executing.length < this.maxConcurrent) {
        const question = queue.shift()!;
        const strategy = plan.searchStrategies[plan.subQuestions.indexOf(question)];

        const promise = this.executeSearch(question, strategy, config)
          .then(result => {
            results.push(...result);
          })
          .finally(() => {
            const idx = executing.indexOf(promise);
            if (idx > -1) executing.splice(idx, 1);
          });

        executing.push(promise);
      }

      // Wait for at least one to complete
      if (executing.length > 0) {
        await Promise.race(executing);
      }
    }

    return results;
  }

  private async executeSearch(
    question: string,
    strategy: SearchStrategy,
    config: ResearchConfig
  ): Promise<RawSearchResult[]> {
    const results: RawSearchResult[] = [];

    // Search each provider in parallel
    const providerSearches = strategy.providers.map(provider =>
      this.searchProvider(provider, question, config.maxSources / strategy.providers.length)
    );

    const providerResults = await Promise.all(providerSearches);

    for (const pr of providerResults) {
      results.push(...pr);
    }

    // Add local document search if enabled
    if (config.includeLocal && config.localPaths) {
      const localResults = await this.searchLocalDocuments(question, config.localPaths);
      results.push(...localResults);
    }

    return results;
  }

  private async searchLocalDocuments(
    query: string,
    paths: string[]
  ): Promise<RawSearchResult[]> {
    // Search PDF, CSV, Markdown files
    const results: RawSearchResult[] = [];

    for (const path of paths) {
      const files = await this.findDocuments(path);
      for (const file of files) {
        const matches = await this.searchFile(file, query);
        if (matches.length > 0) {
          results.push({
            title: file.name,
            url: `file://${file.path}`,
            snippet: matches[0].text,
            provider: 'local',
            timestamp: new Date().toISOString(),
            relevanceScore: matches[0].score
          });
        }
      }
    }

    return results;
  }
}
```

### 6.4 Report Synthesizer

```typescript
// src/mcp-servers/search-aggregator/src/research/report-synthesizer.ts

interface ResearchReport {
  title: string;
  summary: string;
  sections: ReportSection[];
  conclusions: string[];
  citations: Citation[];
  generatedAt: Date;
}

interface ReportSection {
  heading: string;
  content: string;
  sources: string[];
}

export class ReportSynthesizer {
  async generate(findings: Finding[], config: ResearchConfig): Promise<ResearchReport> {
    // Group findings by theme
    const themes = this.clusterFindings(findings);

    // Generate sections from themes
    const sections = await this.generateSections(themes);

    // Create executive summary
    const summary = await this.generateSummary(findings, config.topic);

    // Extract conclusions
    const conclusions = await this.extractConclusions(findings);

    // Format citations
    const citations = this.formatCitations(findings);

    return {
      title: `Research Report: ${config.topic}`,
      summary,
      sections,
      conclusions,
      citations,
      generatedAt: new Date()
    };
  }

  private clusterFindings(findings: Finding[]): Map<string, Finding[]> {
    const themes = new Map<string, Finding[]>();

    // Simple keyword-based clustering
    const themeKeywords = {
      'Overview': ['what is', 'definition', 'introduction'],
      'Implementation': ['how to', 'implement', 'setup', 'configure'],
      'Benefits': ['advantage', 'benefit', 'pro', 'strength'],
      'Challenges': ['challenge', 'problem', 'issue', 'con', 'weakness'],
      'Comparisons': ['vs', 'compare', 'alternative', 'versus'],
      'Best Practices': ['best practice', 'recommendation', 'tip']
    };

    for (const finding of findings) {
      let assigned = false;
      for (const [theme, keywords] of Object.entries(themeKeywords)) {
        if (keywords.some(kw => finding.content.toLowerCase().includes(kw))) {
          if (!themes.has(theme)) themes.set(theme, []);
          themes.get(theme)!.push(finding);
          assigned = true;
          break;
        }
      }
      if (!assigned) {
        if (!themes.has('Other')) themes.set('Other', []);
        themes.get('Other')!.push(finding);
      }
    }

    return themes;
  }

  private formatCitations(findings: Finding[]): Citation[] {
    return findings.map((f, i) => ({
      id: i + 1,
      title: f.sourceTitle,
      url: f.sourceUrl,
      accessedAt: f.timestamp,
      snippet: f.content.slice(0, 200)
    }));
  }
}
```

### 6.5 New Tools

```typescript
// Add to src/mcp-servers/search-aggregator/src/index.ts

// Tool: deep_research
{
  name: 'deep_research',
  description: 'Conduct deep multi-phase research on a topic',
  inputSchema: {
    type: 'object',
    properties: {
      topic: { type: 'string', description: 'Research topic or question' },
      depth: { type: 'number', minimum: 1, maximum: 5, default: 3 },
      breadth: { type: 'number', minimum: 1, maximum: 10, default: 5 },
      maxSources: { type: 'number', default: 20 },
      includeLocal: { type: 'boolean', default: false },
      localPaths: { type: 'array', items: { type: 'string' } },
      timeout: { type: 'number', default: 120000 }
    },
    required: ['topic']
  }
}

// Tool: generate_research_plan
{
  name: 'generate_research_plan',
  description: 'Generate a research plan with sub-questions (without executing)',
  inputSchema: {
    type: 'object',
    properties: {
      topic: { type: 'string' },
      depth: { type: 'number', minimum: 1, maximum: 5, default: 3 },
      breadth: { type: 'number', minimum: 1, maximum: 10, default: 5 }
    },
    required: ['topic']
  }
}

// Tool: search_local_documents
{
  name: 'search_local_documents',
  description: 'Search local PDF, CSV, Markdown files',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      paths: { type: 'array', items: { type: 'string' } },
      fileTypes: {
        type: 'array',
        items: { type: 'string', enum: ['pdf', 'csv', 'md', 'txt', 'docx'] },
        default: ['pdf', 'md', 'txt']
      },
      limit: { type: 'number', default: 10 }
    },
    required: ['query', 'paths']
  }
}

// Tool: generate_report
{
  name: 'generate_report',
  description: 'Generate a formatted report from research results',
  inputSchema: {
    type: 'object',
    properties: {
      researchId: { type: 'string' },
      format: { type: 'string', enum: ['markdown', 'json', 'html'], default: 'markdown' },
      includeCitations: { type: 'boolean', default: true }
    },
    required: ['researchId']
  }
}

// Tool: validate_sources
{
  name: 'validate_sources',
  description: 'Validate and score source reliability',
  inputSchema: {
    type: 'object',
    properties: {
      sources: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            title: { type: 'string' },
            content: { type: 'string' }
          }
        }
      }
    },
    required: ['sources']
  }
}
```

---

## Part 7: Code Intelligence Enhancements (from Serena)

### 7.1 Tree-Sitter Integration

```typescript
// src/mcp-servers/task-orchestrator/src/code-intelligence/tree-sitter-analyzer.ts

import Parser from 'tree-sitter';
import Python from 'tree-sitter-python';
import TypeScript from 'tree-sitter-typescript';
import Go from 'tree-sitter-go';
import Rust from 'tree-sitter-rust';

interface Symbol {
  name: string;
  type: 'function' | 'class' | 'method' | 'variable' | 'interface' | 'type';
  location: {
    file: string;
    line: number;
    column: number;
    endLine: number;
    endColumn: number;
  };
  signature?: string;
  docstring?: string;
  children?: Symbol[];
}

interface SymbolReference {
  symbol: string;
  location: {
    file: string;
    line: number;
    column: number;
  };
  context: string;
  referenceType: 'call' | 'import' | 'assignment' | 'parameter';
}

export class TreeSitterAnalyzer {
  private parsers: Map<string, Parser> = new Map();

  constructor() {
    // Initialize parsers for each language
    const pythonParser = new Parser();
    pythonParser.setLanguage(Python);
    this.parsers.set('python', pythonParser);
    this.parsers.set('py', pythonParser);

    const tsParser = new Parser();
    tsParser.setLanguage(TypeScript.typescript);
    this.parsers.set('typescript', tsParser);
    this.parsers.set('ts', tsParser);

    const goParser = new Parser();
    goParser.setLanguage(Go);
    this.parsers.set('go', goParser);

    const rustParser = new Parser();
    rustParser.setLanguage(Rust);
    this.parsers.set('rust', rustParser);
    this.parsers.set('rs', rustParser);
  }

  async findSymbol(name: string, language: string, scope?: string): Promise<Symbol[]> {
    const parser = this.getParser(language);
    const files = await this.findFilesWithLanguage(language);
    const symbols: Symbol[] = [];

    for (const file of files) {
      const content = await this.readFile(file);
      const tree = parser.parse(content);

      const matches = this.querySymbols(tree, name, language);
      for (const match of matches) {
        if (!scope || this.matchesScope(match, scope)) {
          symbols.push(this.nodeToSymbol(match, file, content));
        }
      }
    }

    return symbols;
  }

  async findReferences(symbolPath: string): Promise<SymbolReference[]> {
    const [file, symbolName] = this.parseSymbolPath(symbolPath);
    const language = this.detectLanguage(file);
    const parser = this.getParser(language);

    const references: SymbolReference[] = [];
    const files = await this.findFilesWithLanguage(language);

    for (const searchFile of files) {
      const content = await this.readFile(searchFile);
      const tree = parser.parse(content);

      const refs = this.queryReferences(tree, symbolName, language);
      for (const ref of refs) {
        references.push({
          symbol: symbolName,
          location: {
            file: searchFile,
            line: ref.startPosition.row + 1,
            column: ref.startPosition.column
          },
          context: this.getContext(content, ref),
          referenceType: this.classifyReference(ref, language)
        });
      }
    }

    return references;
  }

  async getCodeOutline(filePath: string): Promise<Symbol[]> {
    const language = this.detectLanguage(filePath);
    const parser = this.getParser(language);
    const content = await this.readFile(filePath);
    const tree = parser.parse(content);

    return this.extractOutline(tree, filePath, content, language);
  }

  private querySymbols(tree: Parser.Tree, name: string, language: string): Parser.SyntaxNode[] {
    const queries: Record<string, string> = {
      python: `
        (function_definition name: (identifier) @name (#eq? @name "${name}"))
        (class_definition name: (identifier) @name (#eq? @name "${name}"))
      `,
      typescript: `
        (function_declaration name: (identifier) @name (#eq? @name "${name}"))
        (class_declaration name: (identifier) @name (#eq? @name "${name}"))
        (interface_declaration name: (identifier) @name (#eq? @name "${name}"))
        (type_alias_declaration name: (type_identifier) @name (#eq? @name "${name}"))
      `,
      go: `
        (function_declaration name: (identifier) @name (#eq? @name "${name}"))
        (type_declaration (type_spec name: (type_identifier) @name (#eq? @name "${name}")))
      `,
      rust: `
        (function_item name: (identifier) @name (#eq? @name "${name}"))
        (struct_item name: (type_identifier) @name (#eq? @name "${name}"))
        (impl_item type: (type_identifier) @name (#eq? @name "${name}"))
      `
    };

    const query = new Parser.Query(this.parsers.get(language)!.getLanguage(), queries[language]);
    return query.matches(tree.rootNode).map(m => m.captures[0].node);
  }

  private extractOutline(
    tree: Parser.Tree,
    filePath: string,
    content: string,
    language: string
  ): Symbol[] {
    const symbols: Symbol[] = [];

    const walk = (node: Parser.SyntaxNode, parent?: Symbol) => {
      const symbol = this.nodeToSymbolIfRelevant(node, filePath, content, language);

      if (symbol) {
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(symbol);
        } else {
          symbols.push(symbol);
        }

        // Recurse into children with this symbol as parent
        for (const child of node.children) {
          walk(child, symbol);
        }
      } else {
        // Continue walking without adding symbol
        for (const child of node.children) {
          walk(child, parent);
        }
      }
    };

    walk(tree.rootNode);
    return symbols;
  }
}
```

### 7.2 New Tools

```typescript
// Add to src/mcp-servers/task-orchestrator/src/index.ts

// Tool: find_symbol
{
  name: 'find_symbol',
  description: 'Find symbol definitions (functions, classes, etc.) by name',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Symbol name to find' },
      language: {
        type: 'string',
        enum: ['python', 'typescript', 'javascript', 'go', 'rust'],
        description: 'Programming language'
      },
      scope: { type: 'string', description: 'Optional scope (e.g., class name)' },
      path: { type: 'string', description: 'Optional path to limit search' }
    },
    required: ['name']
  }
}

// Tool: find_references
{
  name: 'find_references',
  description: 'Find all references to a symbol',
  inputSchema: {
    type: 'object',
    properties: {
      symbolPath: {
        type: 'string',
        description: 'Path to symbol (e.g., "src/utils.py:calculate_total")'
      },
      includeDefinition: { type: 'boolean', default: false }
    },
    required: ['symbolPath']
  }
}

// Tool: get_code_outline
{
  name: 'get_code_outline',
  description: 'Get outline of symbols in a file',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: { type: 'string', description: 'Path to source file' },
      maxDepth: { type: 'number', default: 3, description: 'Max nesting depth' }
    },
    required: ['filePath']
  }
}

// Tool: analyze_semantic_structure
{
  name: 'analyze_semantic_structure',
  description: 'Analyze semantic structure of code (AST summary)',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: { type: 'string' },
      includeMetrics: { type: 'boolean', default: true }
    },
    required: ['filePath']
  }
}

// Tool: insert_after_symbol
{
  name: 'insert_after_symbol',
  description: 'Insert code after a specific symbol',
  inputSchema: {
    type: 'object',
    properties: {
      symbolPath: { type: 'string', description: 'Path to symbol' },
      code: { type: 'string', description: 'Code to insert' },
      position: {
        type: 'string',
        enum: ['after', 'before', 'inside_start', 'inside_end'],
        default: 'after'
      }
    },
    required: ['symbolPath', 'code']
  }
}
```

---

## Part 8: NanoGPT Go Proxy

### 8.1 Project Structure

```
src/services/nanogpt-proxy/
├── main.go
├── go.mod
├── go.sum
├── config/
│   ├── config.go
│   └── models.yaml
├── handlers/
│   ├── chat.go
│   ├── completions.go
│   ├── embeddings.go
│   ├── images.go
│   └── models.go
├── middleware/
│   ├── auth.go
│   ├── tier_router.go
│   ├── quota_tracker.go
│   └── logging.go
├── storage/
│   └── usage.go
├── models/
│   ├── request.go
│   ├── response.go
│   └── usage.go
└── Dockerfile
```

### 8.2 Main Entry Point

```go
// main.go
package main

import (
    "log"
    "net/http"
    "os"

    "github.com/gorilla/mux"
    "nanogpt-proxy/config"
    "nanogpt-proxy/handlers"
    "nanogpt-proxy/middleware"
    "nanogpt-proxy/storage"
)

func main() {
    // Load configuration
    cfg, err := config.Load("config/models.yaml")
    if err != nil {
        log.Fatalf("Failed to load config: %v", err)
    }

    // Initialize storage
    db, err := storage.InitDB("~/.mcp/nanogpt/usage.db")
    if err != nil {
        log.Fatalf("Failed to init database: %v", err)
    }
    defer db.Close()

    // Create router
    r := mux.NewRouter()

    // Initialize middleware
    tierRouter := middleware.NewTierRouter(cfg, db)
    quotaTracker := middleware.NewQuotaTracker(db)

    // Apply middleware
    r.Use(middleware.Logging)
    r.Use(middleware.Auth(cfg.APIKey))
    r.Use(tierRouter.Route)
    r.Use(quotaTracker.Track)

    // Register handlers
    h := handlers.New(cfg, db)

    // OpenAI-compatible endpoints
    r.HandleFunc("/v1/chat/completions", h.ChatCompletions).Methods("POST")
    r.HandleFunc("/v1/completions", h.Completions).Methods("POST")
    r.HandleFunc("/v1/embeddings", h.Embeddings).Methods("POST")
    r.HandleFunc("/v1/images/generations", h.ImageGeneration).Methods("POST")
    r.HandleFunc("/v1/models", h.ListModels).Methods("GET")

    // Proxy management endpoints
    r.HandleFunc("/proxy/usage", h.GetUsage).Methods("GET")
    r.HandleFunc("/proxy/quota", h.GetQuota).Methods("GET")
    r.HandleFunc("/proxy/budget", h.SetBudget).Methods("POST")

    port := os.Getenv("NANOGPT_PROXY_PORT")
    if port == "" {
        port = "8090"
    }

    log.Printf("NanoGPT Proxy starting on port %s", port)
    log.Fatal(http.ListenAndServe(":"+port, r))
}
```

### 8.3 Configuration

```yaml
# config/models.yaml
api:
  nanogpt_base_url: "https://nano-gpt.com/api/v1"
  timeout: 60s
  retry_attempts: 3

tiers:
  free:
    priority: 1
    models:
      - id: "gpt-4o-mini"
        monthly_quota: 1000000  # tokens
        reset_day: 1
      - id: "claude-3-haiku-20240307"
        monthly_quota: 500000
      - id: "gemini-1.5-flash"
        monthly_quota: 750000
      - id: "llama-3.1-8b-instant"
        monthly_quota: 2000000

  paid:
    priority: 2
    budget_limit: 50.00  # USD per month
    models:
      - id: "gpt-4o"
        cost_per_million_input: 2.50
        cost_per_million_output: 10.00
      - id: "claude-3.5-sonnet"
        cost_per_million_input: 3.00
        cost_per_million_output: 15.00
      - id: "gpt-4-turbo"
        cost_per_million_input: 10.00
        cost_per_million_output: 30.00

model_aliases:
  # Map generic names to specific NanoGPT model IDs
  "gpt-4": "gpt-4o"
  "gpt-3.5-turbo": "gpt-4o-mini"
  "claude-3-sonnet": "claude-3.5-sonnet"
  "claude-3-haiku": "claude-3-haiku-20240307"

fallback:
  enabled: true
  order:
    - "gpt-4o-mini"
    - "llama-3.1-8b-instant"
    - "gemini-1.5-flash"
```

### 8.4 Tier Router

```go
// middleware/tier_router.go
package middleware

import (
    "context"
    "net/http"
    "time"

    "nanogpt-proxy/config"
    "nanogpt-proxy/storage"
)

type TierRouter struct {
    config *config.Config
    db     *storage.DB
}

func NewTierRouter(cfg *config.Config, db *storage.DB) *TierRouter {
    return &TierRouter{config: cfg, db: db}
}

func (tr *TierRouter) Route(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Extract requested model from request body
        requestedModel := extractModel(r)
        if requestedModel == "" {
            next.ServeHTTP(w, r)
            return
        }

        // Resolve alias if needed
        resolvedModel := tr.resolveAlias(requestedModel)

        // Try to use free tier first
        selectedModel, tier := tr.selectModel(resolvedModel)

        // Add selected model to context
        ctx := context.WithValue(r.Context(), "selected_model", selectedModel)
        ctx = context.WithValue(ctx, "selected_tier", tier)
        ctx = context.WithValue(ctx, "original_model", requestedModel)

        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

func (tr *TierRouter) selectModel(requested string) (string, string) {
    // Check if requested model is in free tier
    for _, model := range tr.config.Tiers.Free.Models {
        if model.ID == requested {
            // Check quota
            usage := tr.db.GetMonthlyUsage(model.ID)
            if usage < model.MonthlyQuota {
                return model.ID, "free"
            }
        }
    }

    // Check paid tier
    for _, model := range tr.config.Tiers.Paid.Models {
        if model.ID == requested {
            // Check budget
            spent := tr.db.GetMonthlySpending()
            if spent < tr.config.Tiers.Paid.BudgetLimit {
                return model.ID, "paid"
            }
        }
    }

    // Fall back to alternatives
    if tr.config.Fallback.Enabled {
        for _, fallbackModel := range tr.config.Fallback.Order {
            usage := tr.db.GetMonthlyUsage(fallbackModel)
            quota := tr.getModelQuota(fallbackModel)
            if usage < quota {
                return fallbackModel, "free-fallback"
            }
        }
    }

    // No available model
    return "", "exhausted"
}

func (tr *TierRouter) resolveAlias(model string) string {
    if alias, ok := tr.config.ModelAliases[model]; ok {
        return alias
    }
    return model
}
```

### 8.5 Chat Handler

```go
// handlers/chat.go
package handlers

import (
    "bytes"
    "encoding/json"
    "io"
    "net/http"

    "nanogpt-proxy/models"
)

func (h *Handler) ChatCompletions(w http.ResponseWriter, r *http.Request) {
    // Get selected model from context
    selectedModel := r.Context().Value("selected_model").(string)
    tier := r.Context().Value("selected_tier").(string)

    if tier == "exhausted" {
        http.Error(w, "All model quotas exhausted", http.StatusTooManyRequests)
        return
    }

    // Read original request
    body, err := io.ReadAll(r.Body)
    if err != nil {
        http.Error(w, "Failed to read request", http.StatusBadRequest)
        return
    }

    // Parse and modify request with selected model
    var req models.ChatRequest
    if err := json.Unmarshal(body, &req); err != nil {
        http.Error(w, "Invalid request format", http.StatusBadRequest)
        return
    }

    originalModel := req.Model
    req.Model = selectedModel

    // Forward to NanoGPT
    modifiedBody, _ := json.Marshal(req)
    proxyReq, _ := http.NewRequest("POST", h.config.API.NanoGPTBaseURL+"/chat/completions", bytes.NewReader(modifiedBody))
    proxyReq.Header.Set("Authorization", "Bearer "+h.config.API.NanoGPTKey)
    proxyReq.Header.Set("Content-Type", "application/json")

    resp, err := h.client.Do(proxyReq)
    if err != nil {
        http.Error(w, "Upstream error", http.StatusBadGateway)
        return
    }
    defer resp.Body.Close()

    // Read response
    respBody, _ := io.ReadAll(resp.Body)

    // Track usage
    var chatResp models.ChatResponse
    if err := json.Unmarshal(respBody, &chatResp); err == nil {
        h.db.RecordUsage(models.UsageRecord{
            Model:         selectedModel,
            OriginalModel: originalModel,
            Tier:          tier,
            InputTokens:   chatResp.Usage.PromptTokens,
            OutputTokens:  chatResp.Usage.CompletionTokens,
            Cost:          h.calculateCost(selectedModel, chatResp.Usage),
        })
    }

    // Return response
    w.Header().Set("Content-Type", "application/json")
    w.Header().Set("X-NanoGPT-Model", selectedModel)
    w.Header().Set("X-NanoGPT-Tier", tier)
    w.WriteHeader(resp.StatusCode)
    w.Write(respBody)
}
```

### 8.6 Usage Tracking

```go
// storage/usage.go
package storage

import (
    "database/sql"
    "time"

    _ "github.com/mattn/go-sqlite3"
    "nanogpt-proxy/models"
)

type DB struct {
    conn *sql.DB
}

func InitDB(path string) (*DB, error) {
    conn, err := sql.Open("sqlite3", expandPath(path))
    if err != nil {
        return nil, err
    }

    // Create tables
    _, err = conn.Exec(`
        CREATE TABLE IF NOT EXISTS usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            model TEXT NOT NULL,
            original_model TEXT,
            tier TEXT NOT NULL,
            input_tokens INTEGER DEFAULT 0,
            output_tokens INTEGER DEFAULT 0,
            cost REAL DEFAULT 0.0
        );

        CREATE INDEX IF NOT EXISTS idx_usage_model ON usage(model);
        CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON usage(timestamp);

        CREATE TABLE IF NOT EXISTS budgets (
            id INTEGER PRIMARY KEY,
            monthly_limit REAL DEFAULT 50.0,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `)
    if err != nil {
        return nil, err
    }

    return &DB{conn: conn}, nil
}

func (db *DB) RecordUsage(record models.UsageRecord) error {
    _, err := db.conn.Exec(`
        INSERT INTO usage (model, original_model, tier, input_tokens, output_tokens, cost)
        VALUES (?, ?, ?, ?, ?, ?)
    `, record.Model, record.OriginalModel, record.Tier, record.InputTokens, record.OutputTokens, record.Cost)
    return err
}

func (db *DB) GetMonthlyUsage(model string) int64 {
    var total int64
    startOfMonth := time.Now().Format("2006-01") + "-01"

    db.conn.QueryRow(`
        SELECT COALESCE(SUM(input_tokens + output_tokens), 0)
        FROM usage
        WHERE model = ? AND timestamp >= ?
    `, model, startOfMonth).Scan(&total)

    return total
}

func (db *DB) GetMonthlySpending() float64 {
    var total float64
    startOfMonth := time.Now().Format("2006-01") + "-01"

    db.conn.QueryRow(`
        SELECT COALESCE(SUM(cost), 0)
        FROM usage
        WHERE tier = 'paid' AND timestamp >= ?
    `, startOfMonth).Scan(&total)

    return total
}

func (db *DB) GetUsageStats() models.UsageStats {
    stats := models.UsageStats{
        ByModel: make(map[string]models.ModelUsage),
    }

    startOfMonth := time.Now().Format("2006-01") + "-01"

    rows, _ := db.conn.Query(`
        SELECT model, tier,
               SUM(input_tokens) as input,
               SUM(output_tokens) as output,
               SUM(cost) as cost,
               COUNT(*) as requests
        FROM usage
        WHERE timestamp >= ?
        GROUP BY model, tier
    `, startOfMonth)
    defer rows.Close()

    for rows.Next() {
        var model, tier string
        var input, output, requests int64
        var cost float64
        rows.Scan(&model, &tier, &input, &output, &cost, &requests)

        stats.ByModel[model] = models.ModelUsage{
            InputTokens:  input,
            OutputTokens: output,
            Cost:         cost,
            Requests:     requests,
            Tier:         tier,
        }
        stats.TotalTokens += input + output
        stats.TotalCost += cost
        stats.TotalRequests += requests
    }

    return stats
}
```

### 8.7 MCP Integration

Add to agent-swarm for routing LLM calls through proxy:

```typescript
// src/mcp-servers/agent-swarm/src/integration/nanogpt-client.ts

interface NanoGPTConfig {
  proxyUrl: string;
  preferFree: boolean;
  maxBudget: number;
}

export class NanoGPTClient {
  private config: NanoGPTConfig;

  constructor(config: NanoGPTConfig) {
    this.config = config;
  }

  async chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse> {
    const response = await fetch(`${this.config.proxyUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options?.model || 'gpt-4o-mini',
        messages,
        temperature: options?.temperature || 0.7,
        max_tokens: options?.maxTokens || 4096,
      }),
    });

    const data = await response.json();

    // Log tier used
    const tier = response.headers.get('X-NanoGPT-Tier');
    const actualModel = response.headers.get('X-NanoGPT-Model');
    console.log(`NanoGPT: Used ${actualModel} (tier: ${tier})`);

    return data;
  }

  async getUsageStats(): Promise<UsageStats> {
    const response = await fetch(`${this.config.proxyUrl}/proxy/usage`);
    return response.json();
  }
}
```

New MCP tools:

```typescript
// Tool: nanogpt_list_models
{
  name: 'nanogpt_list_models',
  description: 'List available models with quota status',
  inputSchema: { type: 'object', properties: {} }
}

// Tool: nanogpt_get_usage
{
  name: 'nanogpt_get_usage',
  description: 'Get current usage statistics',
  inputSchema: { type: 'object', properties: {} }
}

// Tool: nanogpt_set_budget
{
  name: 'nanogpt_set_budget',
  description: 'Set monthly budget limit for paid tier',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Budget limit in USD' }
    },
    required: ['limit']
  }
}
```

---

## Appendix A: Updated Routing Keywords

```typescript
// src/mcp-servers/agent-swarm/src/integration/routing-config.ts

export const ROUTING_KEYWORDS = {
  // Existing routes
  'context7': ['doc', 'documentation', 'manual', 'spec', 'reference', 'library'],
  'mcp-code-checker': ['lint', 'pylint', 'pytest', 'mypy', 'type check', 'code quality'],
  'search-aggregator': ['search', 'web', 'lookup', 'find', 'research'],
  'task-orchestrator': ['task', 'create', 'execute', 'code', 'analyze'],

  // New routes
  'atlassian-mcp': ['jira', 'confluence', 'ticket', 'issue', 'sprint', 'board', 'backlog', 'page', 'space', 'epic', 'story'],
  'chart-generator': ['chart', 'graph', 'plot', 'visualization', 'visualize', 'bar chart', 'line chart', 'pie chart', 'gantt', 'heatmap'],
  'nanogpt-proxy': ['llm', 'model', 'generate', 'completion', 'chat']
};
```

---

## Appendix B: Environment Variables

Add to `.env.external-mcps`:

```bash
# Atlassian
ATLASSIAN_EMAIL=your-email@company.com
ATLASSIAN_API_TOKEN=your-api-token
ATLASSIAN_DOMAIN=your-domain.atlassian.net

# NanoGPT
NANOGPT_API_KEY=your-nanogpt-key
NANOGPT_PROXY_PORT=8090
NANOGPT_MONTHLY_BUDGET=50.00
```

---

## Appendix C: Testing Checklist

### Third-Party MCPs
- [ ] Atlassian submodule clones correctly
- [ ] OAuth/API token authentication works
- [ ] Jira issue CRUD operations
- [ ] Confluence page operations
- [ ] FastMCP installs and basic server works

### Chart Generator
- [ ] PNG output for all chart types
- [ ] Theme support (light/dark/presentation)
- [ ] File output to ~/.mcp/charts/
- [ ] Base64 output option

### Agent-Swarm Enhancements
- [ ] Session create/resume/checkpoint
- [ ] Topology switching
- [ ] Tiered memory operations
- [ ] Worker spawning

### Context-Persistence Enhancements
- [ ] Bi-temporal queries
- [ ] Entity extraction accuracy
- [ ] Relationship creation
- [ ] Hybrid search modes

### Task-Orchestrator Enhancements
- [ ] PRD parsing accuracy
- [ ] Complexity scoring
- [ ] Task expansion
- [ ] Next task recommendations

### Search-Aggregator Enhancements
- [ ] Deep research mode
- [ ] Parallel execution
- [ ] Report generation
- [ ] Local document search

### Code Intelligence
- [ ] Symbol finding (Python, TS, Go, Rust)
- [ ] Reference finding
- [ ] Code outline generation

### NanoGPT Proxy
- [ ] Free tier routing
- [ ] Paid tier fallback
- [ ] Usage tracking
- [ ] Budget enforcement
