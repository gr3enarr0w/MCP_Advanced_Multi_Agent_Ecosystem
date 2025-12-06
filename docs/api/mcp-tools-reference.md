# MCP Tools Reference

## Overview

This document provides a comprehensive reference to all 79 MCP tools across all 6 phases of the MCP Advanced Multi-Agent Ecosystem. Each tool is documented with its signature, parameters, return types, usage examples, and error handling information.

## Tool Categories

### [Phase 6: Context-Persistence (Python)](#phase-6-context-persistence)
- **Conversation Management**: `save_conversation`, `load_conversation_history`
- **Entity Operations**: `extract_entities`, `create_relationship`, `query_knowledge_graph`
- **Knowledge Graph**: `update_knowledge_graph`, `get_entity_history`
- **Search Operations**: `search_similar_conversations`, `search_hybrid`, `get_conversation_stats`
- **Decision Management**: `save_decision`

### [Phase 7: Task-Orchestrator (TypeScript)](#phase-7-task-orchestrator)
- **Task Management**: `create_task`, `update_task_status`, `delete_task`, `list_tasks`
- **Code Execution**: `execute_code`
- **PRD Processing**: `parse_prd`
- **Complexity Analysis**: `analyze_complexity`
- **Task Expansion**: `expand_tasks`
- **Smart Selection**: `select_tasks`

### [Phase 8: Search-Aggregator (TypeScript)](#phase-8-search-aggregator)
- **Search Operations**: `search`, `execute_parallel_search`
- **Research Planning**: `plan_research`
- **Local Search**: `local_search`
- **Parallel Execution**: `parallel_execute`
- **Report Synthesis**: `synthesize_report`
- **Provider Management**: `get_available_providers`

### [Phase 9: Agent-Swarm (TypeScript)](#phase-9-agent-swarm)
- **Session Management**: `create_session`, `get_session`, `update_session`, `delete_session`, `list_sessions`
- **Topology Management**: `create_topology`, `get_topology`, `list_topologies`
- **Worker Management**: `spawn_worker`, `get_worker_status`, `terminate_worker`, `list_workers`
- **Memory Management**: `store_memory`, `retrieve_memory`, `clear_memory`, `get_memory_stats`
- **LLM Integration**: `configure_llm`, `get_llm_providers`, `test_llm_connection`
- **Task Delegation**: `delegate_task`, `get_delegation_status`, `cancel_delegation`
- **Agent Communication**: `send_message_to_agent`, `receive_agent_message`

### [Phase 10: Code-Intelligence (TypeScript)](#phase-10-code-intelligence)
- **Code Analysis**: `analyze_repository`, `find_symbols`, `find_references`, `generate_outline`
- **Symbol Operations**: `get_symbol_details`, `get_symbol_references`
- **Reference Tracking**: `find_all_references`, `track_reference_changes`
- **Outline Generation**: `generate_code_outline`, `get_outline_structure`

### [Phase 11: Chart-Generator (TypeScript)](#phase-11-chart-generator)
- **Chart Generation**: `generate_chart`, `list_chart_types`
- **Configuration Management**: `get_chart_themes`, `create_chart_template`, `apply_chart_template`
- **Export Operations**: `export_chart_svg`, `get_chart_history`
- **Preview Operations**: `preview_chart_config`

## Tool Signatures

### Phase 6: Context-Persistence

#### `save_conversation`
```typescript
interface SaveConversationParams {
  conversation_id: string;
  messages: Array<{
    role: string;
    content: string;
    timestamp?: string;
  metadata?: Record<string, any>;
  }>;
  project_path?: string;
  mode?: string;
  metadata?: Record<string, any>;
}

interface SaveConversationResponse {
  success: boolean;
  conversation_id: string;
  message_count: number;
  status: string;
}
```

**Parameters:**
- `conversation_id` (string, required): Unique conversation identifier
- `messages` (array, required): Array of message objects with role, content, and optional timestamp
- `project_path` (string, optional): Project path for context
- `mode` (string, optional): Storage mode ('conversation', 'knowledge', 'hybrid')
- `metadata` (object, optional): Additional metadata for the conversation

**Returns:**
- `success`: Boolean indicating if conversation was saved successfully
- `conversation_id`: Unique identifier for the saved conversation
- `message_count`: Number of messages in the conversation
- `status`: Status message ("success", "error", etc.)

**Example:**
```typescript
const result = await contextClient.saveConversation({
  conversation_id: "conv-123",
  messages: [
    { role: "user", content: "Analyze this code" },
    { role: "assistant", content: "I'll analyze the code structure..." }
  ],
  metadata: {
    project: "code-analysis",
    user_id: "user-456"
  }
});
```

#### `load_conversation_history`
```typescript
interface LoadConversationHistoryParams {
  conversation_id: string;
  limit?: number;
}

interface LoadConversationHistoryResponse {
  success: boolean;
  conversation_id: string;
  messages: Array<{
    role: string;
    content: string;
    timestamp: string;
    metadata?: Record<string, any>;
  }>;
  message_count: number;
  total_messages: number;
}
```

**Parameters:**
- `conversation_id` (string, required): Conversation identifier to load
- `limit` (number, optional): Maximum number of messages to return

**Returns:**
- `success`: Boolean indicating if conversation was loaded successfully
- `conversation_id`: Conversation identifier
- `messages`: Array of message objects with role, content, timestamp, and metadata
- `message_count`: Number of messages returned
- `total_messages`: Total number of messages in the conversation

#### `extract_entities`
```typescript
interface ExtractEntitiesParams {
  text: string;
  conversation_id?: string;
  message_id?: string;
  entity_types?: string[];
  context?: Record<string, any>;
}

interface ExtractEntitiesResponse {
  success: boolean;
  entities: Array<{
    id: string;
    type: string;
    name: string;
    description: string;
    confidence: number;
    metadata?: Record<string, any>;
  }>;
  conversation_id: string;
  message_id: string;
}
```

**Parameters:**
- `text` (string, required): Text to extract entities from
- `conversation_id` (string, optional): Conversation identifier for context
- `message_id` (string, optional): Specific message identifier
- `entity_types` (array, optional): Types of entities to extract
- `context` (object, optional): Additional context for entity extraction

**Returns:**
- `success`: Boolean indicating if entities were extracted successfully
- `entities`: Array of extracted entities with type, name, description, confidence, and metadata
- `conversation_id`: Conversation identifier
- `message_id`: Message identifier

#### `create_relationship`
```typescript
interface CreateRelationshipParams {
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: string;
  confidence?: number;
  properties?: Record<string, any>;
}

interface CreateRelationshipResponse {
  success: boolean;
  relationship_id: string;
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: string;
  confidence: number;
}
```

**Parameters:**
- `source_entity_id` (string, required): ID of source entity
- `target_entity_id` (string, required): ID of target entity
- `relationship_type` (string, required): Type of relationship
- `confidence` (number, optional): Confidence score for the relationship
- `properties` (object, optional): Additional properties

**Returns:**
- `success`: Boolean indicating if relationship was created successfully
- `relationship_id`: Unique identifier for the created relationship
- `source_entity_id`: Source entity ID
- `target_entity_id`: Target entity ID
- `relationship_type`: Type of relationship
- `confidence`: Confidence score

#### `query_knowledge_graph`
```typescript
interface QueryKnowledgeGraphParams {
  entity_id: string;
  depth?: number;
  operation: string;
}

interface QueryKnowledgeGraphResponse {
  success: boolean;
  entity_id: string;
  context: Array<{
    neighbors: Array<{
      entity_id: string;
      relationship_type: string;
      target_entity_id: string;
      confidence: number;
    }>;
    paths: Array<{
      from_entity: string;
      relationship_type: string;
      to_entity: string;
      confidence: number;
    }>;
  metadata?: Record<string, any>;
}
```

**Parameters:**
- `entity_id` (string, required): Entity ID to query
- `depth` (number, optional): Depth of graph traversal (default: 2)
- `operation` (string, required): Operation type ('context', 'neighbors', 'paths')

**Returns:**
- `success`: Boolean indicating if query was successful
- `entity_id`: Entity ID that was queried
- `context`: Array of neighboring entities and relationships
- `paths`: Array of paths in the knowledge graph
- `metadata`: Additional query metadata

#### `update_knowledge_graph`
```typescript
interface UpdateKnowledgeGraphParams {
  entities: Array<{
    id: string;
    type: string;
    name: string;
    description: string;
    metadata?: Record<string, any>;
  }>;
  relationships: Array<{
    from_entity: string;
    to_entity: string;
    relationship_type: string;
    confidence: number;
    properties?: Record<string, any>;
  }>;
  merge_strategy?: string;
}

interface UpdateKnowledgeGraphResponse {
  success: boolean;
  updated_entities: number;
  updated_relationships: number;
  merge_strategy: string;
}
```

**Parameters:**
- `entities`: Array of entities to update
- `relationships`: Array of relationships to add/update
- `merge_strategy` (string, optional): Strategy for handling conflicts ('upsert', 'merge', 'skip')

#### `get_entity_history`
```typescript
interface GetEntityHistoryParams {
  entity_id: string;
  limit?: number;
}

interface GetEntityHistoryResponse {
  success: boolean;
  entity_id: string;
  history: Array<{
    version: number;
    timestamp: string;
    changes: Record<string, any>;
    metadata?: Record<string, any>;
  }>;
  total_versions: number;
}
```

#### `search_similar_conversations`
```typescript
interface SearchSimilarConversationsParams {
  query: string;
  limit?: number;
  min_score?: number;
  filters?: Record<string, any>;
}

interface SearchSimilarConversationsResponse {
  success: boolean;
  results: Array<{
    conversation_id: string;
    messages: Array<{
      role: string;
      content: string;
      timestamp: string;
    }>;
    similarity_score: number;
    metadata?: Record<string, any>;
  }>;
  total_results: number;
}
```

#### `search_hybrid`
```typescript
interface SearchHybridParams {
  query: string;
  mode?: string;
  filters?: Record<string, any>;
  limit?: number;
  include_metadata?: boolean;
}

interface SearchHybridResponse {
  success: boolean;
  results: Array<{
    type: string;
    content: string;
    similarity_score: number;
    metadata?: Record<string, any>;
  }>;
  total_results: number;
}
```

#### `get_conversation_stats`
```typescript
interface GetConversationStatsResponse {
  success: boolean;
  stats: {
    total_conversations: number;
    total_messages: number;
    total_entities: number;
    total_relationships: number;
    storage_usage: {
      conversations_size: number;
      entities_count: number;
      relationships_count: number;
    };
  };
}
```

#### `save_decision`
```typescript
interface SaveDecisionParams {
  conversation_id: string;
  decision_type: string;
  context: string;
  outcome: string;
  confidence?: number;
}

interface SaveDecisionResponse {
  success: boolean;
  decision_id: string;
  conversation_id: string;
}
```

### Phase 7: Task-Orchestrator

#### `create_task`
```typescript
interface CreateTaskParams {
  title: string;
  description: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  estimated_hours?: number;
  tags?: string[];
  assignee?: string;
  dependencies?: string[];
  execution_environment?: string;
  code_language?: string;
  due_date?: string;
}

interface CreateTaskResponse {
  success: boolean;
  task_id: number;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  created_at: string;
}
```

#### `update_task_status`
```typescript
interface UpdateTaskStatusParams {
  task_id: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  notes?: string;
}

interface UpdateTaskStatusResponse {
  success: boolean;
  task_id: number;
  status: string;
  updated_at: string;
}
```

#### `delete_task`
```typescript
interface DeleteTaskParams {
  task_id: number;
}

interface DeleteTaskResponse {
  success: boolean;
  task_id: number;
  deleted_at: string;
}
```

#### `list_tasks`
```typescript
interface ListTasksParams {
  status?: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  assignee?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
  due_date?: string;
}

interface ListTasksResponse {
  success: boolean;
  tasks: Array<{
    id: number;
    title: string;
    description: string;
    status: string;
    priority: string;
    assignee: string;
    tags: string[];
    estimated_hours: number;
    created_at: string;
    updated_at: string;
    due_date: string;
    completion_percentage?: number;
  }>;
  total_tasks: number;
}
```

#### `execute_code`
```typescript
interface ExecuteCodeParams {
  task_id: number;
  code: string;
  language?: string;
  environment?: string;
  timeout?: number;
  working_directory?: string;
  packages?: string[];
}

interface ExecuteCodeResponse {
  success: boolean;
  task_id: number;
  execution_id: string;
  status: 'running' | 'completed' | 'failed' | 'timeout' | 'cancelled';
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  execution_time?: number;
  started_at: string;
  completed_at?: string;
}
```

#### `parse_prd`
```typescript
interface ParsePRDParams {
  content: string;
  source?: string;
  format?: 'markdown' | 'json' | 'structured';
  extract_requirements?: boolean;
  extract_dependencies?: boolean;
  extract_timeline?: boolean;
}

interface ParsePRDResponse {
  success: boolean;
  prd: {
    title: string;
    description: string;
    requirements: Array<{
      id: string;
      title: string;
      description: string;
      priority: string;
      acceptance_criteria: string[];
      dependencies: string[];
    estimated_hours: number;
    assignee?: string;
      due_date?: string;
    timeline?: Array<{
        phase: string;
        title: string;
        description: string;
        start_date: string;
        end_date: string;
        deliverables: string[];
      }>;
    tasks: Array<{
      id: string;
      title: string;
      description: string;
      priority: string;
      estimated_hours: number;
      dependencies: string[];
      assignee?: string;
      due_date: string;
      tags: string[];
      acceptance_criteria: string[];
    }>;
  metadata?: Record<string, any>;
  }
}
```

#### `analyze_complexity`
```typescript
interface AnalyzeComplexityParams {
  tasks: Array<{
    id: number;
    title: string;
    description: string;
    estimated_hours?: number;
    dependencies?: string[];
    assignee?: string;
  }>;
  factors?: Array<'effort' | 'risk' | 'dependencies' | 'resources' | 'uncertainty'>;
  weights?: Record<string, number>;
}

interface AnalyzeComplexityResponse {
  success: boolean;
  analysis: {
    overall_score: number;
    complexity_level: 'low' | 'medium' | 'high' | 'critical';
    factors: Record<string, number>;
    recommendations: string[];
    estimated_total_hours: number;
    confidence: number;
  };
  task_complexity: Array<{
    task_id: number;
    title: string;
    complexity_score: number;
    complexity_level: string;
    factors: Record<string, number>;
    estimated_hours: number;
    recommendations: string[];
  }>;
}
```

#### `expand_tasks`
```typescript
interface ExpandTasksParams {
  tasks: Array<{
    id: number;
    title: string;
    description: string;
  }>;
  expansion_level?: 'minimal' | 'detailed' | 'comprehensive';
  include_dependencies?: boolean;
  include_subtasks?: boolean;
  max_depth?: number;
  context?: Record<string, any>;
}

interface ExpandTasksResponse {
  success: boolean;
  expanded_tasks: Array<{
    id: number;
    title: string;
    description: string;
    priority: string;
    assignee?: string;
    dependencies: string[];
    estimated_hours: number;
    tags: string[];
    parent_task_id?: number;
    expansion_type: string;
    depth: number;
    created_at: string;
  }>;
  total_expanded: number;
  expansion_summary: {
    original_tasks: number;
    expanded_tasks: number;
    expansion_level: string;
    total_estimated_hours: number;
  };
}
```

#### `select_tasks`
```typescript
interface SelectTasksParams {
  criteria?: Record<string, any>;
  limit?: number;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  skills?: string[];
  availability?: Record<string, any>;
  context?: Record<string, any>;
}

interface SelectTasksResponse {
  success: boolean;
  selected_tasks: Array<{
    id: number;
    title: string;
    description: string;
    priority: string;
    assignee: string;
    estimated_hours: number;
    match_score: number;
    selection_reason: string;
  }>;
  selection_summary: {
    total_considered: number;
    total_selected: number;
    selection_criteria: Record<string, any>;
  };
}
```

### Phase 8: Search-Aggregator

#### `search`
```typescript
interface SearchParams {
  query: string;
  providers?: string[];
  max_results?: number;
  timeout?: number;
  include_local?: boolean;
  filters?: Record<string, any>;
}

interface SearchResponse {
  success: boolean;
  query: string;
  results: Array<{
    provider: string;
    title: string;
    url: string;
    snippet: string;
    relevance_score: number;
    metadata?: Record<string, any>;
  }>;
  total_results: number;
  providers_used: string[];
  execution_time: number;
}
```

#### `execute_parallel_search`
```typescript
interface ExecuteParallelSearchParams {
  query: string;
  providers: string[];
  max_results_per_provider?: number;
  timeout?: number;
  parallel_limit?: number;
  filters?: Record<string, any>;
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
      relevance_score: number;
      metadata?: Record<string, any>;
    }>;
  total_results: number;
  execution_time: number;
  parallel_efficiency: number;
}
```

#### `plan_research`
```typescript
interface PlanResearchParams {
  query: string;
  research_type?: 'comprehensive' | 'targeted' | 'exploratory' | 'comparative';
  depth?: 'shallow' | 'medium' | 'deep';
  sources?: string[];
  timeline?: string;
  budget_hours?: number;
  deliverables?: string[];
}

interface PlanResearchResponse {
  success: boolean;
  query: string;
  research_plan: {
    phases: Array<{
      name: string;
      description: string;
      duration_hours: number;
      deliverables: string[];
      sources: string[];
    }>;
  timeline: string;
  estimated_cost: number;
  confidence: number;
}
```

#### `local_search`
```typescript
interface LocalSearchParams {
  query: string;
  directories?: string[];
  file_types?: string[];
  max_results?: number;
  filters?: Record<string, any>;
}

interface LocalSearchResponse {
  success: boolean;
  query: string;
  results: Array<{
    file_path: string;
    file_name: string;
    file_type: string;
    content_snippet: string;
    relevance_score: number;
    line_numbers: number[];
    metadata?: Record<string, any>;
  }>;
  total_results: number;
  search_time: number;
}
```

#### `parallel_execute`
```typescript
interface ParallelExecuteParams {
  operations: Array<{
    operation: string;
    parameters: Record<string, any>;
    timeout?: number;
  }>;
  max_concurrent?: number;
}

interface ParallelExecuteResponse {
  success: boolean;
  results: Array<{
    operation: string;
    success: boolean;
    result?: any;
    error?: string;
    execution_time: number;
  }>;
  total_operations: number;
  execution_time: number;
}
```

#### `synthesize_report`
```typescript
interface SynthesizeReportParams {
  research_results: Array<{
    provider: string;
    results: any;
    metadata?: Record<string, any>;
  }>;
  report_type: 'executive_summary' | 'detailed' | 'technical' | 'comparative';
  format?: 'markdown' | 'html' | 'pdf';
  include_sources?: boolean;
  include_recommendations?: boolean;
  audience?: 'executive' | 'technical' | 'general';
}

interface SynthesizeReportResponse {
  success: boolean;
  report: {
    title: string;
    summary: string;
    key_findings: string[];
    recommendations: string[];
    sources: Array<{
      name: string;
      reliability: string;
      contribution: string;
    }>;
    format: string;
    content: string;
    metadata?: Record<string, any>;
  };
}
```

#### `get_available_providers`
```typescript
interface GetAvailableProvidersResponse {
  success: boolean;
  providers: Array<{
    name: string;
    type: 'web' | 'academic' | 'local' | 'api';
    capabilities: string[];
    rate_limits?: Record<string, any>;
    authentication_required: boolean;
    status: 'active' | 'inactive' | 'error';
  }>;
}
```

### Phase 9: Agent-Swarm

#### `create_session`
```typescript
interface CreateSessionParams {
  name: string;
  topology: 'hierarchical' | 'mesh' | 'star' | 'dynamic';
  memory_tier?: 'working' | 'episodic' | 'persistent';
  llm_config?: Record<string, any>;
  worker_config?: Record<string, any>;
  session_config?: Record<string, any>;
}

interface CreateSessionResponse {
  success: boolean;
  session_id: string;
  name: string;
  topology: string;
  status: 'initializing' | 'active' | 'paused' | 'completed' | 'error';
  created_at: string;
  workers_spawned: number;
}
```

#### `get_session`
```typescript
interface GetSessionParams {
  session_id: string;
  include_workers?: boolean;
  include_memory?: boolean;
  include_messages?: boolean;
}

interface GetSessionResponse {
  success: boolean;
  session: {
    id: string;
    name: string;
    topology: string;
    status: string;
    created_at: string;
    updated_at: string;
    workers: Array<{
      id: string;
      name: string;
      type: string;
      status: string;
      capabilities: string[];
      created_at: string;
      last_activity: string;
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
  };
}
```

#### `update_session`
```typescript
interface UpdateSessionParams {
  session_id: string;
  status?: string;
  name?: string;
  add_message?: string;
  metadata?: Record<string, any>;
}

interface UpdateSessionResponse {
  success: boolean;
  session_id: string;
  status: string;
  updated_at: string;
}
```

#### `delete_session`
```typescript
interface DeleteSessionParams {
  session_id: string;
}

interface DeleteSessionResponse {
  success: boolean;
  session_id: string;
  deleted_at: string;
}
```

#### `list_sessions`
```typescript
interface ListSessionsParams {
  status?: string;
  topology?: string;
  limit?: number;
  offset?: number;
}

interface ListSessionsResponse {
  success: boolean;
  sessions: Array<{
    id: string;
    name: string;
    topology: string;
    status: string;
    created_at: string;
    updated_at: string;
    workers_count: number;
    message_count: number;
  }>;
  total_sessions: number;
}
```

#### `create_topology`
```typescript
interface CreateTopologyParams {
  name: string;
  type: 'hierarchical' | 'mesh' | 'star' | 'dynamic';
  description?: string;
  config?: Record<string, any>;
}

interface CreateTopologyResponse {
  success: boolean;
  topology_id: string;
  name: string;
  type: string;
  created_at: string;
}
```

#### `get_topology`
```typescript
interface GetTopologyParams {
  topology_id: string;
}

interface GetTopologyResponse {
  success: boolean;
  topology: {
    id: string;
    name: string;
    type: string;
    description: string;
    config: Record<string, any>;
    created_at: string;
    updated_at: string;
  };
}
```

#### `list_topologies`
```typescript
interface ListTopologiesResponse {
  success: boolean;
  topologies: Array<{
    id: string;
    name: string;
    type: string;
    description: string;
    created_at: string;
    updated_at: string;
  }>;
  total_topologies: number;
}
```

#### `spawn_worker`
```typescript
interface SpawnWorkerParams {
  session_id: string;
  worker_type: string;
  capabilities?: string[];
  llm_config?: Record<string, any>;
  task?: {
    title: string;
    description: string;
    priority?: string;
  };
  memory_config?: Record<string, any>;
}

interface SpawnWorkerResponse {
  success: boolean;
  worker_id: string;
  session_id: string;
  worker_type: string;
  capabilities: string[];
  status: 'initializing' | 'idle' | 'busy' | 'error' | 'completed' | 'terminated';
  created_at: string;
}
```

#### `get_worker_status`
```typescript
interface GetWorkerStatusParams {
  worker_id: string;
  session_id?: string;
}

interface GetWorkerStatusResponse {
  success: boolean;
  worker: {
    id: string;
    session_id: string;
    worker_type: string;
    capabilities: string[];
    status: string;
    current_task?: {
      id: string;
      title: string;
      status: string;
      progress: number;
    };
    memory_usage: {
      working: Record<string, any>;
      episodic: Record<string, any>;
      persistent: Record<string, any>;
    };
    performance: {
      tasks_completed: number;
      average_task_time: number;
      error_rate: number;
    };
    created_at: string;
    last_activity: string;
  };
}
```

#### `terminate_worker`
```typescript
interface TerminateWorkerParams {
  worker_id: string;
  session_id?: string;
  reason?: string;
}

interface TerminateWorkerResponse {
  success: boolean;
  worker_id: string;
  session_id: string;
  terminated_at: string;
  reason?: string;
}
```

#### `list_workers`
```typescript
interface ListWorkersParams {
  session_id?: string;
  status?: string;
  worker_type?: string;
  limit?: number;
  offset?: number;
}

interface ListWorkersResponse {
  success: boolean;
  workers: Array<{
    id: string;
    session_id: string;
    worker_type: string;
    capabilities: string[];
    status: string;
    current_task?: {
      id: string;
      title: string;
      status: string;
      progress: number;
    };
    performance: {
      tasks_completed: number;
      average_task_time: number;
      error_rate: number;
    };
    created_at: string;
    last_activity: string;
  }>;
  total_workers: number;
}
```

#### `store_memory`
```typescript
interface StoreMemoryParams {
  session_id: string;
  worker_id?: string;
  memory_type: 'working' | 'episodic' | 'persistent';
  data: Record<string, any>;
  tags?: string[];
  expiration?: string;
}

interface StoreMemoryResponse {
  success: boolean;
  memory_id: string;
  session_id: string;
  worker_id?: string;
  memory_type: string;
  size: number;
  tags: string[];
  expires_at: string;
}
```

#### `retrieve_memory`
```typescript
interface RetrieveMemoryParams {
  session_id: string;
  worker_id?: string;
  memory_type?: 'working' | 'episodic' | 'persistent';
  tags?: string[];
  limit?: number;
}

interface RetrieveMemoryResponse {
  success: boolean;
  memory: {
    id: string;
    session_id: string;
    worker_id?: string;
    memory_type: string;
    data: Record<string, any>;
    tags: string[];
    size: number;
    created_at: string;
    expires_at?: string;
  };
}
```

#### `clear_memory`
```typescript
interface ClearMemoryParams {
  session_id: string;
  worker_id?: string;
  memory_type?: 'working' | 'episodic' | 'persistent';
  tags?: string[];
}

interface ClearMemoryResponse {
  success: boolean;
  memory_id: string;
  session_id: string;
  worker_id?: string;
  memory_type: string;
  cleared_at: string;
}
```

#### `get_memory_stats`
```typescript
interface GetMemoryStatsParams {
  session_id: string;
  worker_id?: string;
  memory_type?: 'working' | 'episodic' | 'persistent';
}

interface GetMemoryStatsResponse {
  success: boolean;
  stats: {
    working: {
      total_size: number;
      usage_count: number;
      oldest_entry: string;
      newest_entry: string;
    };
    episodic: {
      total_size: number;
      entry_count: number;
      oldest_entry: string;
      newest_entry: string;
    };
    persistent: {
      total_size: number;
      entry_count: number;
      oldest_entry: string;
      newest_entry: string;
    };
  };
}
```

#### `configure_llm`
```typescript
interface ConfigureLLMParams {
  session_id: string;
  provider: string;
  model?: string;
  api_key?: string;
  api_base_url?: string;
  temperature?: number;
  max_tokens?: number;
  system_prompt?: string;
  timeout?: number;
}

interface ConfigureLLMResponse {
  success: boolean;
  session_id: string;
  provider: string;
  model: string;
  configured_at: string;
}
```

#### `get_llm_providers`
```typescript
interface GetLLMProvidersResponse {
  success: boolean;
  providers: Array<{
    name: string;
    type: 'openai' | 'anthropic' | 'local' | 'ollama' | 'perplexity';
    capabilities: string[];
    models?: string[];
    status: 'available' | 'unavailable' | 'error';
    authentication_required: boolean;
    rate_limits?: Record<string, any>;
    api_info?: Record<string, any>;
  }>;
}
```

#### `test_llm_connection`
```typescript
interface TestLLMConnectionParams {
  session_id: string;
  provider: string;
  model?: string;
  test_prompt?: string;
}

interface TestLLMConnectionResponse {
  success: boolean;
  provider: string;
  model: string;
  test_result: {
    success: boolean;
    response_time: number;
    model_response: string;
    error?: string;
  };
  connection_quality: {
    latency: number;
    throughput: number;
    reliability: number;
  };
  tested_at: string;
}
```

#### `delegate_task`
```typescript
interface DelegateTaskParams {
  session_id: string;
  task: {
    id: number;
    title: string;
    description: string;
    priority: string;
    estimated_hours?: number;
  };
  target_worker_type?: string;
  required_capabilities?: string[];
  context?: Record<string, any>;
  timeout?: number;
}

interface DelegateTaskResponse {
  success: boolean;
  delegation_id: string;
  session_id: string;
  task_id: number;
  worker_id: string;
  status: 'delegated' | 'accepted' | 'started' | 'completed' | 'failed' | 'cancelled';
  delegated_at: string;
  timeout?: number;
}
```

#### `get_delegation_status`
```typescript
interface GetDelegationStatusParams {
  delegation_id: string;
  session_id?: string;
}

interface GetDelegationStatusResponse {
  success: boolean;
  delegation: {
    id: string;
    session_id: string;
    task_id: number;
    worker_id: string;
    status: string;
    progress: number;
    created_at: string;
    updated_at: string;
    timeout?: number;
  };
}
```

#### `cancel_delegation`
```typescript
interface CancelDelegationParams {
  delegation_id: string;
  session_id?: string;
  reason?: string;
}

interface CancelDelegationResponse {
  success: boolean;
  delegation_id: string;
  session_id: string;
  status: 'cancelled';
  cancelled_at: string;
  reason?: string;
}
```

#### `send_message_to_agent`
```typescript
interface SendMessageToAgentParams {
  session_id: string;
  worker_id: string;
  message: string;
  message_type?: 'task' | 'coordination' | 'status_update';
  priority?: 'low' | 'medium' | 'high';
}

interface SendMessageToAgentResponse {
  success: boolean;
  message_id: string;
  session_id: string;
  worker_id: string;
  sent_at: string;
}
```

#### `receive_agent_message`
```typescript
interface ReceiveAgentMessageParams {
  session_id: string;
  worker_id?: string;
  message_type?: 'task' | 'coordination' | 'status_update' | 'error';
}

interface ReceiveAgentMessageResponse {
  success: boolean;
  message: {
    id: string;
    session_id: string;
    worker_id?: string;
    message_type: string;
    content: string;
    timestamp: string;
    metadata?: Record<string, any>;
  };
  received_at: string;
}
```

### Phase 10: Code-Intelligence

#### `analyze_repository`
```typescript
interface AnalyzeRepositoryParams {
  path: string;
  languages?: string[];
  include_tests?: boolean;
  max_depth?: number;
  exclude_patterns?: string[];
  output_format?: 'json' | 'markdown' | 'tree';
}

interface AnalyzeRepositoryResponse {
  success: boolean;
  repository_path: string;
  analysis: {
    languages: Array<{
      language: string;
      file_count: number;
      line_count: number;
      complexity_score: number;
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
      file_count: number;
      total_size: number;
    }>;
    metrics: {
      total_files: number;
      total_lines: number;
      analysis_time: number;
    };
  analyzed_at: string;
}
```

#### `find_symbols`
```typescript
interface FindSymbolsParams {
  repository_path: string;
  languages?: string[];
  symbol_types?: string[];
  query?: string;
  file_patterns?: string[];
  max_results?: number;
  include_definitions?: boolean;
  include_references?: boolean;
}

interface FindSymbolsResponse {
  success: boolean;
  repository_path: string;
  symbols: Array<{
    id: string;
    name: string;
    type: string;
    language: string;
    file_path: string;
    line_number: number;
    column_number: number;
    definition?: {
      signature: string;
      parameters: Array<{
        name: string;
        type: string;
        optional: boolean;
        default_value?: any;
      }>;
    };
    references: Array<{
      file_path: string;
      line_number: number;
      context: string;
      type: 'definition' | 'call' | 'implementation';
    }>;
  }>;
  total_symbols: number;
  search_time: number;
}
```

#### `find_references`
```typescript
interface FindReferencesParams {
  repository_path: string;
  symbol_id: string;
  max_results?: number;
  include_definitions?: boolean;
}

interface FindReferencesResponse {
  success: boolean;
  repository_path: string;
  symbol_id: string;
  references: Array<{
    file_path: string;
    line_number: number;
    context: string;
      type: 'call' | 'implementation' | 'definition' | 'assignment' | 'import' | 'documentation';
      snippet: string;
    }>;
  total_references: number;
  search_time: number;
}
```

#### `generate_outline`
```typescript
interface GenerateOutlineParams {
  repository_path: string;
  languages?: string[];
  format?: 'json' | 'markdown' | 'tree';
  include_bodies?: boolean;
  max_depth?: number;
  file_patterns?: string[];
  exclude_patterns?: string[];
}

interface GenerateOutlineResponse {
  success: boolean;
  repository_path: string;
  outline: {
    format: string;
    languages: Array<{
      language: string;
      structure: {
        name: string;
        type: 'file' | 'directory' | 'class' | 'function' | 'interface' | 'enum' | 'namespace';
        children: Array<{
          name: string;
          type: string;
          line_number?: number;
          children?: any;
          signature?: string;
          documentation?: string;
          metadata?: Record<string, any>;
        }>;
      }>;
    }>;
  generation_time: number;
}
```

#### `get_symbol_details`
```typescript
interface GetSymbolDetailsParams {
  repository_path: string;
  symbol_id: string;
  include_references?: boolean;
  include_definition?: boolean;
}

interface GetSymbolDetailsResponse {
  success: boolean;
  symbol: {
    id: string;
    name: string;
    type: string;
    language: string;
    file_path: string;
    line_number: number;
    column_number: number;
    definition?: {
      signature: string;
      parameters: Array<{
        name: string;
        type: string;
        optional: boolean;
        default_value?: any;
      }>;
    };
    references: Array<{
      file_path: string;
      line_number: number;
      context: string;
      type: 'call' | 'implementation' | 'definition' | 'assignment' | 'import' | 'documentation';
      snippet: string;
    }>;
  };
}
```

#### `get_symbol_references`
```typescript
interface GetSymbolReferencesParams {
  repository_path: string;
  symbol_id: string;
  max_results?: number;
}

interface GetSymbolReferencesResponse {
  success: boolean;
  symbol_id: string;
  references: Array<{
    file_path: string;
    line_number: number;
    context: string;
      type: 'call' | 'implementation' | 'definition' | 'assignment' | 'import' | 'documentation';
      snippet: string;
  }>;
  total_references: number;
}
```

#### `get_outline_structure`
```typescript
interface GetOutlineStructureParams {
  repository_path: string;
  language?: string;
  format?: 'json' | 'markdown' | 'tree';
  max_depth?: number;
}

interface GetOutlineStructureResponse {
  success: boolean;
  repository_path: string;
  structure: {
    format: string;
    languages: Array<{
      language: string;
      root: any;
    }>;
  };
}
```

### Phase 11: Chart-Generator

#### `generate_chart`
```typescript
interface GenerateChartParams {
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'gantt' | 'heatmap';
  data: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      backgroundColor?: string;
      borderColor?: string;
      borderWidth?: number;
      fill?: boolean;
      tension?: number;
      pointRadius?: number;
      pointHoverRadius?: number;
      pointStyle?: string;
      steppedLine?: boolean;
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
        type: 'linear' | 'logarithmic' | 'category' | 'time';
        min?: number;
        max?: number;
        title?: string;
      };
      y?: {
        type: 'linear' | 'logarithmic' | 'category';
        min?: number;
        max?: number;
        title?: string;
        stacked?: boolean;
        position?: 'left' | 'right' | 'top' | 'bottom';
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
}

interface GenerateChartResponse {
  success: boolean;
  chart_id: string;
  image_path?: string;
  image_base64?: string;
  metadata: {
    width: number;
    height: number;
    format: string;
    file_size: number;
    generation_time: number;
  };
}
```

#### `list_chart_types`
```typescript
interface ListChartTypesResponse {
  success: boolean;
  chart_types: Array<{
    type: string;
    description: string;
    data_format: string;
    example_options: Record<string, any>;
    supported_options: string[];
  }>;
}
```

#### `preview_chart_config`
```typescript
interface PreviewChartConfigParams {
  type: string;
  data: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
    }>;
  };
  options?: {
    title?: string;
    width?: number;
    height?: number;
    theme?: 'light' | 'dark' | 'colorblind';
  };
}

interface PreviewChartConfigResponse {
  success: boolean;
  valid: boolean;
  errors?: string[];
  warnings?: string[];
  chart_config: any;
  preview_url?: string;
}
```

#### `get_chart_themes`
```typescript
interface GetChartThemesResponse {
  success: boolean;
  themes: Array<{
    name: string;
    colors: Record<string, string>;
    background_color?: string;
    text_color?: string;
    grid_color?: string;
    border_color?: string;
    description: string;
  }>;
}
```

#### `create_chart_template`
```typescript
interface CreateChartTemplateParams {
  template_name: string;
  chart_type: string;
  default_options: Record<string, any>;
  styling?: Record<string, any>;
}

interface CreateChartTemplateResponse {
  success: boolean;
  template_id: string;
  template_name: string;
  chart_type: string;
  created_at: string;
}
```

#### `apply_chart_template`
```typescript
interface ApplyChartTemplateParams {
  template_id: string;
  data: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
    }>;
  };
  override_options?: Record<string, any>;
}

interface ApplyChartTemplateResponse {
  success: boolean;
  template_id: string;
  chart_id: string;
  applied_at: string;
}
```

#### `export_chart_svg`
```typescript
interface ExportChartSVGParams {
  chart_id: string;
  options?: {
    responsive?: boolean;
    width?: number;
    height?: number;
  };
}

interface ExportChartSVGResponse {
  success: boolean;
  chart_id: string;
  svg_content: string;
  metadata: {
    width: number;
    height: number;
    format: string;
    file_size: number;
  };
}
```

#### `get_chart_history`
```typescript
interface GetChartHistoryParams {
  limit?: number;
  chart_type?: string;
  date_range?: string;
  tags?: string[];
}

interface GetChartHistoryResponse {
  success: boolean;
  charts: Array<{
    id: string;
    type: string;
    title: string;
    created_at: string;
    metadata: Record<string, any>;
    file_size: number;
    format: string;
    generation_time: number;
  }>;
  total_charts: number;
}
```

## Error Codes

All MCP tools follow consistent error code patterns:

### Common Error Codes

| Code | Description | Typical Cause |
|------|-------------|-------------|
| -32001 | Authentication Failed | Invalid API key, expired token, missing permissions |
| -32002 | Resource Not Found | Requested resource doesn't exist |
| -32003 | Tool Not Found | Requested tool is not available |
| -32004 | Invalid Parameters | Required parameter missing or invalid |
| -32005 | Internal Error | Server-side processing error |
| -32006 | Timeout | Operation took too long to complete |
| -32007 | Rate Limit Exceeded | Too many requests in time period |
| -32008 | Server Overloaded | Server temporarily unavailable |
| -32009 | Conflict | Merge conflict or data inconsistency |

### Phase-Specific Error Codes

#### Context-Persistence (Python)
| Code | Description |
|------|-------------|-------------|
| CP_001 | Database Error | SQLite database operation failed |
| CP_002 | Entity Extraction Error | NLP processing failed |
| CP_003 | Vector Database Error | Qdrant vector operation failed |
| CP_004 | Knowledge Graph Error | NetworkX graph operation failed |
| CP_005 | Search Index Error | Search index operation failed |
| CP_006 | Memory Error | Memory management operation failed |

#### Task-Orchestrator (TypeScript)
| Code | Description |
|------|-------------|-------------|
| TO_001 | Task Creation Failed | Unable to create task |
| TO_002 | Task Update Failed | Unable to update task |
| TO_003 | Task Deletion Failed | Unable to delete task |
| TO_004 | Task Execution Failed | Code execution failed |
| TO_005 | PRD Parsing Failed | Unable to parse PRD |
| TO_006 | Complexity Analysis Failed | Analysis algorithm failed |
| TO_007 | Task Expansion Failed | Task expansion failed |
| TO_008 | Task Selection Failed | Task selection algorithm failed |

#### Search-Aggregator (TypeScript)
| Code | Description |
|------|-------------|-------------|
| SA_001 | Search Failed | Search operation failed |
| SA_002 | Provider Error | Search provider unavailable |
| SA_003 | Research Planning Failed | Research planning failed |
| SA_004 | Local Search Failed | Local file search failed |
| SA_005 | Parallel Execution Failed | Parallel operation failed |
| SA_006 | Report Synthesis Failed | Report generation failed |
| SA_007 | Provider Management Failed | Provider operation failed |

#### Agent-Swarm (TypeScript)
| Code | Description |
|------|-------------|-------------|
| AS_001 | Session Management Failed | Session operation failed |
| AS_002 | Topology Management Failed | Topology operation failed |
| AS_003 | Worker Management Failed | Worker operation failed |
| AS_004 | Memory Management Failed | Memory operation failed |
| AS_005 | LLM Integration Failed | LLM provider operation failed |
| AS_006 | Task Delegation Failed | Task delegation failed |
| AS_007 | Agent Communication Failed | Inter-agent communication failed |

#### Code-Intelligence (TypeScript)
| Code | Description |
|------|-------------|-------------|
| CI_001 | Repository Analysis Failed | Repository analysis failed |
| CI_002 | Symbol Finding Failed | Symbol search failed |
| CI_003 | Reference Tracking Failed | Reference search failed |
| CI_004 | Outline Generation Failed | Outline generation failed |

#### Chart-Generator (TypeScript)
| Code | Description |
|------|-------------|-------------|
| CG_001 | Chart Generation Failed | Chart generation failed |
| CG_002 | Configuration Failed | Template operation failed |
| CG_003 | Export Failed | Chart export failed |
| CG_004 | Preview Failed | Chart preview failed |

## Usage Examples

### Cross-Phase Workflow Examples

#### Research → Tasks Workflow
```typescript
// Research market trends and create actionable tasks
const workflow = new ResearchToTasksWorkflow(
  searchClient,
  taskClient
);

const result = await workflow.executeResearchToTasks({
  query: "AI market trends 2024",
  researchDepth: 'comprehensive',
  maxTasksPerCategory: 5
});

console.log(`Created ${result.createdTasks.tasks.length} tasks from research`);
```

#### Code Analysis → Knowledge Workflow
```typescript
// Analyze codebase and store insights in knowledge graph
const workflow = new CodeAnalysisToKnowledgeWorkflow(
  codeClient,
  contextClient
);

const result = await workflow.executeCodeAnalysisToKnowledge({
  repositoryPath: './src',
  languages: ['typescript', 'javascript'],
  extractDesignPatterns: true,
  storeRelationships: true
});

console.log(`Analyzed ${result.entitiesExtracted} entities and ${result.relationshipsCreated} relationships`);
```

#### Agent Swarm Orchestration Workflow
```typescript
// Coordinate multiple agents for complex problem solving
const workflow = new AgentSwarmOrchestrationWorkflow(
  swarmClient,
  taskClient,
  searchClient
);

const result = await workflow.executeAgentSwarmOrchestration({
  problem: "Design and implement microservices architecture",
  topology: 'hierarchical',
  workerTypes: ['researcher', 'developer', 'tester'],
  maxWorkers: 10
});

console.log(`Orchestrated ${result.workersSpawned} workers for ${result.sessionId}`);
```

#### Visualization Pipeline Workflow
```typescript
// Create comprehensive visualizations from data and insights
const workflow = new VisualizationPipelineWorkflow(
  chartClient,
  contextClient,
  taskClient
);

const result = await workflow.executeVisualizationPipeline({
  data: {
    labels: ['Q1', 'Q2', 'Q3', 'Q4'],
    datasets: [{
      label: 'Revenue',
      data: [1000000, 1200000, 1300000, 1600000],
      backgroundColor: 'rgba(54, 162, 235, 0.2)'
    }, {
      label: 'Costs',
      data: [800000, 750000, 900000, 850000],
      backgroundColor: 'rgba(255, 99, 132, 0.2)'
    }]
  },
  chartTypes: ['bar', 'line', 'pie'],
  theme: 'light'
});

console.log(`Generated ${result.charts.length} visualization charts`);
```

## Performance Considerations

### Tool Performance Guidelines

#### Response Time Targets
- **Simple Operations**: < 100ms
- **Complex Analysis**: < 5000ms
- **Large Data Processing**: < 2000ms
- **Chart Generation**: < 3000ms
- **Search Operations**: < 2000ms

#### Rate Limiting
- **Search Operations**: 10 requests per minute per provider
- **Chart Generation**: 20 charts per minute
- **Code Analysis**: 5 repositories per minute

#### Memory Management
- **Context Persistence**: Automatic cleanup of old data (30 days)
- **Agent Swarm**: Session timeout after 1 hour of inactivity
- **Task Orchestration**: Task result retention for 30 days

#### Caching Strategies
- **Entity Cache**: LRU with 1000 entry limit
- **Search Results**: Cache for 1 hour with TTL
- **Chart Templates**: Persistent storage for frequently used templates

## Security Considerations

### Authentication
- All MCP servers use JWT-based authentication
- Tokens expire after 24 hours
- API keys are stored securely in environment variables
- Rate limiting implemented per provider

### Data Privacy
- No sensitive data logged in plain text
- PII (Personally Identifiable Information) is anonymized
- User consent is required for data collection
- Data retention policies comply with GDPR requirements

### Error Handling
- All errors are logged with context
- Sensitive information is masked in logs
- Graceful degradation for overloaded conditions
- Automatic retry with exponential backoff for transient errors

## Integration Patterns

### Tool Chaining
```typescript
// Example of chaining multiple tools
const searchResults = await searchClient.search({
  query: "TypeScript performance patterns"
});

const prd = await taskClient.parsePRD({
  content: searchResults.results.map(r => r.snippet).join('\n\n')
});

const tasks = await taskClient.expandTasks({
  tasks: prd.tasks
});

const charts = await Promise.all(
  tasks.map(task => 
    chartClient.generateChart({
      type: 'bar',
      data: {
        labels: task.estimated_hours.map(h => h.toString()),
        datasets: [{
          label: 'Estimated Hours',
          data: task.estimated_hours
        }]
      }
    })
  )
);
```

### Error Recovery
```typescript
// Example of error recovery in cross-phase workflow
try {
  const result = await workflow.executeComplexOperation();
} catch (error) {
  // Log error and attempt recovery
  console.error(`Workflow failed: ${error.message}`);
  
  // Fallback to simpler approach
  const fallbackResult = await workflow.executeSimpleFallback();
  
  console.log(`Recovered with fallback: ${fallbackResult.success}`);
}
```

This comprehensive reference provides complete documentation for all 79 MCP tools across the ecosystem, enabling developers to understand capabilities, integrate functionality, and build sophisticated multi-agent applications.