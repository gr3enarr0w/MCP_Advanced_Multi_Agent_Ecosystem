# NanoGPT-Powered MCP Architecture

## Core Concept

NanoGPT is the **primary LLM interface** for the entire system. Your MCP servers are **tools** that NanoGPT can call through function calling.

```
┌─────────────────────────────────────────────────────────┐
│                         USER                            │
└─────────────────────────┬───────────────────────────────┘
                          │
                          │ "Create a task to implement auth"
                          ▼
┌─────────────────────────────────────────────────────────┐
│              NanoGPT Proxy (Go Service)                 │
│                                                         │
│  Request Routing:                                       │
│  1. Check free quota (60k requests/month)               │
│  2. Select model:                                       │
│     → Free: llama-3.1-8b, gpt-4o-mini, etc.            │
│     → Paid: gpt-4o, claude-3.5-sonnet, etc.            │
│  3. Attach MCP tools as function definitions            │
│  4. Forward to nano-gpt.com                             │
│  5. Handle function calls                               │
│  6. Track usage (requests, not tokens)                  │
└─────────────────────────┬───────────────────────────────┘
                          │
                          │ With tools available
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   nano-gpt.com API                      │
│  Models: gpt-4o-mini, claude-3.5-sonnet, llama, etc.   │
│                                                         │
│  Response: "I'll create a task using create_task"       │
│  Function Call: create_task(title="Implement auth",    │
│                             description="...")          │
└─────────────────────────┬───────────────────────────────┘
                          │
                          │ Function call execution
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   Agent-Swarm (MCP Bridge)              │
│  Receives function calls from NanoGPT                   │
│  Routes to appropriate MCP server                       │
└────────┬────────────────────────────────────┬───────────┘
         │                                    │
         │                                    │
         ▼                                    ▼
┌─────────────────────┐            ┌─────────────────────┐
│  task-orchestrator  │            │  search-aggregator  │
│  - create_task      │            │  - search           │
│  - execute_code     │            │  - deep_research    │
│  - analyze_code     │            │  - generate_report  │
└─────────────────────┘            └─────────────────────┘
         │                                    │
         ▼                                    ▼
┌─────────────────────┐            ┌─────────────────────┐
│ context-persistence │            │   chart-generator   │
│  - save_conv        │            │  - create_bar_chart │
│  - search_similar   │            │  - create_gantt     │
└─────────────────────┘            └─────────────────────┘
```

---

## Complete Architecture - All Versions

### Version 1: Basic Proxy with Tool Routing

**Goal:** NanoGPT-powered chat interface with MCP tools available

**Features:**
- Request-based quota tracking (60k requests/month for free)
- Intelligent model selection (free → paid → fallback)
- MCP tool exposure via OpenAI function calling format
- Synchronous request/response
- Usage analytics

**User Experience:**
```bash
# User types
$ chat "Create a task to implement user authentication"

# What happens internally:
1. Proxy receives request
2. Checks quota: 45,231 / 60,000 requests used (free quota OK)
3. Selects model: llama-3.1-8b-instant (free)
4. Sends to NanoGPT with tools:
   {
     "model": "llama-3.1-8b-instant",
     "messages": [...],
     "tools": [
       { "name": "create_task", "description": "...", ... },
       { "name": "search", ... },
       ...
     ]
   }
5. NanoGPT responds with function call
6. Proxy executes: task-orchestrator.create_task(...)
7. Returns result to user
```

---

### Version 2: Streaming + Multi-Turn Function Calling

**Goal:** Real-time responses with complex multi-step operations

**Features:**
- Everything from V1
- **Streaming responses** (SSE or WebSocket)
- **Multi-turn function calling** (LLM can call multiple tools sequentially)
- **Context preservation** across function calls
- **Parallel tool execution** when possible

**User Experience:**
```bash
# User types
$ chat "Research Kubernetes security, create a task for each finding, and generate a report"

# What happens (streamed to user):
🤔 Planning research...
🔍 Calling search_aggregator.deep_research("Kubernetes security")...
   → Found 15 sources
📝 Creating tasks:
   ✓ Task 1: Implement Pod Security Standards
   ✓ Task 2: Configure Network Policies
   ✓ Task 3: Enable Audit Logging
📊 Generating report...
   ✓ Report saved to /reports/k8s-security.md

Done! Created 3 tasks and generated report.
```

**Architecture Addition:**
```
User Browser/Terminal
    ↓ WebSocket
NanoGPT Proxy (maintains session state)
    ↓
Multiple tool calls in sequence
```

---

### Version 3: Always-On Proactive Agents

**Goal:** Agents autonomously monitor and act without explicit user requests

**Features:**
- Everything from V2
- **Persistent agent processes** (research, review, debugger agents)
- **Event subscriptions** (file changes, git commits, task updates)
- **Proactive suggestions** (agents suggest actions based on events)
- **Agent collaboration** (agents can call other agents)
- **Background processing** (agents work while user is away)

**User Experience:**
```bash
# User commits code
$ git commit -m "Add payment processing"

# Background agents activate:
🤖 [Review Agent] Analyzing commit...
   → Security issue detected: API key hardcoded in line 42
   → Created task: "Remove hardcoded API key"
   → Updated code quality score: 7.5/10

🤖 [Documentation Agent] Checking docs...
   → No documentation for new PaymentService
   → Created task: "Document PaymentService API"

🤖 [Test Agent] Checking coverage...
   → Payment processing has 0% test coverage
   → Created task: "Add tests for payment processing"

# User receives notification
💡 3 tasks created by automated agents. Run `tasks list` to see them.
```

**Architecture Addition:**
```
┌──────────────────────────────────────────────────┐
│           Agent Manager (Go Service)             │
│  Manages persistent agent lifecycles             │
└────────┬─────────────────────────────┬───────────┘
         │                             │
         ▼                             ▼
┌─────────────────┐          ┌─────────────────────┐
│  Review Agent   │          │  Research Agent     │
│  (Always On)    │          │  (Always On)        │
│                 │          │                     │
│  Subscribes:    │          │  Subscribes:        │
│  - git:commit   │          │  - task:created     │
│  - code:change  │          │  - question:asked   │
└─────────────────┘          └─────────────────────┘
```

---

## Detailed Component Breakdown

### 1. NanoGPT Proxy (Go Service)

#### Core Responsibilities
1. **Quota Management** (request-based, not token-based)
2. **Model Selection** (free → paid → fallback)
3. **Tool Registration** (expose all MCP tools to LLM)
4. **Function Call Execution** (route to correct MCP server)
5. **Session Management** (maintain conversation context)
6. **Usage Analytics** (track costs, quotas, model usage)

#### Directory Structure
```
src/services/nanogpt-proxy/
├── main.go
├── config/
│   ├── config.go
│   ├── models.yaml          # Model definitions, quotas
│   └── tools.yaml           # MCP tool mappings
├── handlers/
│   ├── chat.go              # Main chat endpoint
│   ├── streaming.go         # V2: SSE/WebSocket
│   ├── tools.go             # Tool execution
│   └── agents.go            # V3: Agent management
├── middleware/
│   ├── auth.go
│   ├── model_selector.go    # Request-based routing
│   ├── quota_tracker.go     # 60k/month enforcement
│   └── session.go           # V2: Context preservation
├── mcp/
│   ├── bridge.go            # Bridge to agent-swarm
│   ├── tool_registry.go     # Register all MCP tools
│   └── function_caller.go   # Execute function calls
├── agents/                  # V3: Always-on agents
│   ├── manager.go
│   ├── lifecycle.go
│   └── events.go
└── storage/
    ├── usage.go             # SQLite for usage tracking
    ├── sessions.go          # V2: Session state
    └── agents.go            # V3: Agent state
```

---

### 2. Configuration (models.yaml)

```yaml
api:
  nanogpt_base_url: "https://nano-gpt.com/api/v1"
  nanogpt_api_key: "${NANOGPT_API_KEY}"
  timeout: 120s
  retry_attempts: 3

quota:
  type: "requests"  # Not tokens
  tracking_window: "rolling_30_days"

tiers:
  free:
    priority: 1
    quota: 60000  # 60k requests per month
    models:
      - id: "llama-3.1-8b-instant"
        max_tokens: 8192
        cost_per_request: 0.00
        use_cases: ["general", "code", "analysis"]

      - id: "gpt-4o-mini"
        max_tokens: 16384
        cost_per_request: 0.00
        use_cases: ["general", "complex_reasoning"]

      - id: "claude-3-haiku-20240307"
        max_tokens: 200000
        cost_per_request: 0.00
        use_cases: ["long_context", "document_analysis"]

      - id: "gemini-1.5-flash"
        max_tokens: 8192
        cost_per_request: 0.00
        use_cases: ["general", "fast_responses"]

  paid:
    priority: 2
    budget_limit: 100.00  # $100/month
    models:
      - id: "gpt-4o"
        max_tokens: 128000
        cost_per_request: 0.015  # Approximate
        use_cases: ["complex_reasoning", "advanced_code"]

      - id: "claude-3.5-sonnet"
        max_tokens: 200000
        cost_per_request: 0.018
        use_cases: ["very_long_context", "advanced_reasoning"]

      - id: "gpt-4-turbo"
        max_tokens: 128000
        cost_per_request: 0.020
        use_cases: ["advanced_reasoning", "multimodal"]

model_selection:
  # How to choose model for each request
  strategy: "task_based"  # or "round_robin", "least_cost"

  task_mapping:
    general: "llama-3.1-8b-instant"
    code: "gpt-4o-mini"
    research: "claude-3-haiku-20240307"
    complex: "gpt-4o"
    long_context: "claude-3.5-sonnet"

fallback:
  enabled: true
  on_quota_exceeded:
    - action: "use_paid"
      max_cost: 0.05  # Max $0.05 per request
    - action: "use_cheaper_model"
      alternative: "llama-3.1-8b-instant"
    - action: "error"
      message: "All quotas exhausted"
```

---

### 3. Tool Registration (tools.yaml)

```yaml
# Maps MCP servers/tools to OpenAI function calling format

tools:
  # Task Orchestrator
  - name: "create_task"
    mcp_server: "task-orchestrator"
    mcp_tool: "create_task"
    description: "Create a new task with title, description, and optional dependencies"
    parameters:
      type: "object"
      properties:
        title:
          type: "string"
          description: "Task title"
        description:
          type: "string"
          description: "Detailed task description"
        priority:
          type: "number"
          enum: [1, 2, 3, 4, 5]
          description: "Priority (1=highest, 5=lowest)"
        dependencies:
          type: "array"
          items:
            type: "string"
          description: "List of task IDs this depends on"
      required: ["title"]

  - name: "execute_code"
    mcp_server: "task-orchestrator"
    mcp_tool: "execute_code"
    description: "Execute code in a sandboxed environment"
    parameters:
      type: "object"
      properties:
        language:
          type: "string"
          enum: ["python", "javascript", "typescript", "bash", "sql"]
        code:
          type: "string"
          description: "Code to execute"
        timeout:
          type: "number"
          default: 30000
      required: ["language", "code"]

  - name: "parse_prd"
    mcp_server: "task-orchestrator"
    mcp_tool: "parse_prd"
    description: "Parse a PRD document and generate tasks automatically"
    parameters:
      type: "object"
      properties:
        content:
          type: "string"
          description: "PRD content (markdown or text)"
        auto_create:
          type: "boolean"
          default: false
      required: ["content"]

  # Search Aggregator
  - name: "search_web"
    mcp_server: "search-aggregator"
    mcp_tool: "search"
    description: "Search the web using multiple providers"
    parameters:
      type: "object"
      properties:
        query:
          type: "string"
          description: "Search query"
        limit:
          type: "number"
          default: 10
      required: ["query"]

  - name: "deep_research"
    mcp_server: "search-aggregator"
    mcp_tool: "deep_research"
    description: "Conduct comprehensive multi-phase research on a topic"
    parameters:
      type: "object"
      properties:
        topic:
          type: "string"
          description: "Research topic"
        depth:
          type: "number"
          minimum: 1
          maximum: 5
          default: 3
        include_local:
          type: "boolean"
          default: false
      required: ["topic"]

  # Context Persistence
  - name: "save_conversation"
    mcp_server: "context-persistence"
    mcp_tool: "save_conversation"
    description: "Save conversation history for future reference"
    # ... parameters

  - name: "search_similar_conversations"
    mcp_server: "context-persistence"
    mcp_tool: "search_similar_conversations"
    description: "Search for similar past conversations"
    # ... parameters

  # Agent Swarm
  - name: "delegate_to_agent"
    mcp_server: "agent-swarm"
    mcp_tool: "delegate_task"
    description: "Delegate task to a specialized agent"
    parameters:
      type: "object"
      properties:
        agent_type:
          type: "string"
          enum: ["research", "architect", "implementation", "testing", "review", "documentation", "debugger"]
        description:
          type: "string"
      required: ["agent_type", "description"]

  - name: "create_agent_team"
    mcp_server: "agent-swarm"
    mcp_tool: "create_agent_team"
    description: "Create a team of agents for coordinated work"
    # ... parameters

  # Chart Generator
  - name: "create_chart"
    mcp_server: "chart-generator"
    mcp_tool: "create_bar_chart"  # Can map to different chart types
    description: "Generate a PNG chart for presentations"
    # ... parameters

  # Atlassian
  - name: "jira_create_issue"
    mcp_server: "atlassian-mcp"
    mcp_tool: "jira_create_issue"
    description: "Create a Jira issue"
    # ... parameters

# Total: ~50+ tools available to NanoGPT
```

---

### 4. Model Selection Logic

```go
// middleware/model_selector.go

type ModelSelector struct {
    config     *Config
    usageTrack *UsageTracker
}

func (ms *ModelSelector) SelectModel(request ChatRequest) (Model, error) {
    // Determine task type from request
    taskType := ms.classifyTask(request)

    // Get preferred models for task type
    preferredModels := ms.config.ModelSelection.TaskMapping[taskType]

    // Check free tier first
    freeQuotaRemaining := ms.usageTrack.GetRemainingRequests("free")
    if freeQuotaRemaining > 0 {
        // Use free tier model
        model := ms.selectFreeModel(preferredModels, taskType)
        if model != nil {
            return model, nil
        }
    }

    // Check paid tier
    budgetRemaining := ms.usageTrack.GetRemainingBudget("paid")
    if budgetRemaining > 0 {
        model := ms.selectPaidModel(preferredModels, taskType, budgetRemaining)
        if model != nil {
            return model, nil
        }
    }

    // Try fallback
    if ms.config.Fallback.Enabled {
        return ms.selectFallback()
    }

    return nil, errors.New("all quotas exhausted")
}

func (ms *ModelSelector) classifyTask(request ChatRequest) string {
    // Analyze request to determine task type
    content := strings.ToLower(request.Messages[len(request.Messages)-1].Content)

    // Check for keywords
    if strings.Contains(content, "code") || strings.Contains(content, "function") {
        return "code"
    }
    if strings.Contains(content, "research") || strings.Contains(content, "analyze") {
        return "research"
    }
    if len(content) > 5000 {
        return "long_context"
    }
    if strings.Contains(content, "complex") || strings.Contains(content, "advanced") {
        return "complex"
    }

    return "general"
}
```

---

### 5. Function Call Execution

```go
// mcp/function_caller.go

type FunctionCaller struct {
    bridge *MCPBridge
}

func (fc *FunctionCaller) ExecuteFunction(call FunctionCall) (FunctionResult, error) {
    // Look up tool mapping
    tool := fc.bridge.GetTool(call.Name)
    if tool == nil {
        return nil, fmt.Errorf("unknown tool: %s", call.Name)
    }

    // Route to correct MCP server
    result, err := fc.bridge.CallMCPServer(
        tool.MCPServer,
        tool.MCPTool,
        call.Arguments,
    )

    if err != nil {
        return FunctionResult{
            Name: call.Name,
            Error: err.Error(),
        }, err
    }

    return FunctionResult{
        Name:   call.Name,
        Result: result,
    }, nil
}

// Handle multi-turn function calling
func (fc *FunctionCaller) HandleConversation(request ChatRequest) (ChatResponse, error) {
    messages := request.Messages
    maxTurns := 10  // Prevent infinite loops

    for turn := 0; turn < maxTurns; turn++ {
        // Send to NanoGPT with tools available
        response, err := fc.callNanoGPT(messages, fc.bridge.GetAllTools())
        if err != nil {
            return nil, err
        }

        // Check if LLM wants to call functions
        if response.ToolCalls == nil || len(response.ToolCalls) == 0 {
            // No more function calls, return final response
            return response, nil
        }

        // Execute function calls
        for _, toolCall := range response.ToolCalls {
            result, err := fc.ExecuteFunction(toolCall)

            // Add function result to conversation
            messages = append(messages, Message{
                Role:       "tool",
                ToolCallID: toolCall.ID,
                Content:    result.String(),
            })
        }

        // Continue conversation with function results
    }

    return nil, errors.New("max turns exceeded")
}
```

---

### 6. Usage Tracking (Request-Based)

```go
// storage/usage.go

type UsageRecord struct {
    ID              int
    Timestamp       time.Time
    Model           string
    Tier            string  // "free" or "paid"
    RequestType     string  // "chat", "completion", "embedding"
    TokensInput     int
    TokensOutput    int
    Cost            float64
    FunctionCalls   int     // Number of tool calls in this request
}

func (db *DB) RecordUsage(record UsageRecord) error {
    _, err := db.conn.Exec(`
        INSERT INTO usage (
            timestamp, model, tier, request_type,
            tokens_input, tokens_output, cost, function_calls
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, record.Timestamp, record.Model, record.Tier, record.RequestType,
       record.TokensInput, record.TokensOutput, record.Cost, record.FunctionCalls)
    return err
}

// Get remaining free tier requests (rolling 30 days)
func (db *DB) GetRemainingRequests(tier string) int {
    var used int
    thirtyDaysAgo := time.Now().AddDate(0, 0, -30)

    db.conn.QueryRow(`
        SELECT COUNT(*)
        FROM usage
        WHERE tier = ? AND timestamp >= ?
    `, tier, thirtyDaysAgo).Scan(&used)

    if tier == "free" {
        return 60000 - used  // 60k free requests/month
    }

    return 0  // Paid tier has no request limit
}

// Get usage statistics
func (db *DB) GetUsageStats() UsageStats {
    stats := UsageStats{
        ByModel: make(map[string]ModelUsage),
    }

    thirtyDaysAgo := time.Now().AddDate(0, 0, -30)

    rows, _ := db.conn.Query(`
        SELECT
            model,
            tier,
            COUNT(*) as requests,
            SUM(tokens_input) as input_tokens,
            SUM(tokens_output) as output_tokens,
            SUM(cost) as total_cost,
            SUM(function_calls) as total_function_calls
        FROM usage
        WHERE timestamp >= ?
        GROUP BY model, tier
    `, thirtyDaysAgo)
    defer rows.Close()

    for rows.Next() {
        var model, tier string
        var requests, inputTokens, outputTokens, functionCalls int
        var cost float64

        rows.Scan(&model, &tier, &requests, &inputTokens, &outputTokens, &cost, &functionCalls)

        stats.ByModel[model] = ModelUsage{
            Requests:      requests,
            InputTokens:   inputTokens,
            OutputTokens:  outputTokens,
            Cost:          cost,
            FunctionCalls: functionCalls,
            Tier:          tier,
        }

        stats.TotalRequests += requests
        stats.TotalCost += cost
    }

    // Calculate quota usage
    stats.FreeQuotaUsed = 60000 - db.GetRemainingRequests("free")
    stats.FreeQuotaRemaining = db.GetRemainingRequests("free")

    return stats
}
```

---

## Version-Specific Features

### Version 1: Foundation

**HTTP API only** (no streaming, no WebSocket)

```go
// main.go (V1)

func main() {
    config := config.Load("config/models.yaml")
    db := storage.InitDB("~/.mcp/nanogpt/usage.db")

    // Initialize MCP bridge
    mcpBridge := mcp.NewBridge(config.MCPServers)
    mcpBridge.RegisterAllTools()  // From tools.yaml

    // Create router
    r := mux.NewRouter()

    // Middleware
    r.Use(middleware.Auth)
    r.Use(middleware.ModelSelector(config, db))
    r.Use(middleware.QuotaChecker(db))

    // Main chat endpoint
    handler := handlers.NewChatHandler(config, db, mcpBridge)
    r.HandleFunc("/v1/chat/completions", handler.HandleChat).Methods("POST")

    // Management endpoints
    r.HandleFunc("/v1/usage", handler.GetUsage).Methods("GET")
    r.HandleFunc("/v1/models", handler.ListModels).Methods("GET")
    r.HandleFunc("/v1/quota", handler.GetQuota).Methods("GET")

    http.ListenAndServe(":8090", r)
}

// handlers/chat.go (V1)
func (h *ChatHandler) HandleChat(w http.ResponseWriter, r *http.Request) {
    var req ChatRequest
    json.NewDecoder(r.Body).Decode(&req)

    // Model already selected by middleware
    selectedModel := r.Context().Value("selected_model").(Model)

    // Get all available tools
    tools := h.mcpBridge.GetAllTools()

    // Call NanoGPT with tools
    resp, err := h.callNanoGPTWithTools(req, selectedModel, tools)

    // Execute function calls if present
    if resp.ToolCalls != nil {
        for _, call := range resp.ToolCalls {
            result := h.mcpBridge.ExecuteFunction(call)
            // ... add to conversation and continue
        }
    }

    // Track usage
    h.db.RecordUsage(UsageRecord{
        Model: selectedModel.ID,
        Tier:  selectedModel.Tier,
        // ...
    })

    json.NewEncoder(w).Encode(resp)
}
```

---

### Version 2: Streaming + Multi-Turn

**Add SSE/WebSocket support**

```go
// handlers/streaming.go (V2)

func (h *ChatHandler) HandleChatStream(w http.ResponseWriter, r *http.Request) {
    // Set SSE headers
    w.Header().Set("Content-Type", "text/event-stream")
    w.Header().Set("Cache-Control", "no-cache")
    w.Header().Set("Connection", "keep-alive")

    flusher, _ := w.(http.Flusher)

    var req ChatRequest
    json.NewDecoder(r.Body).Decode(&req)

    selectedModel := r.Context().Value("selected_model").(Model)
    tools := h.mcpBridge.GetAllTools()

    // Create streaming request to NanoGPT
    stream, err := h.streamNanoGPT(req, selectedModel, tools)
    if err != nil {
        // ... error handling
    }

    // Stream tokens to client
    for chunk := range stream {
        // Check if function call detected
        if chunk.IsToolCall {
            // Pause streaming
            fmt.Fprintf(w, "event: function_call\ndata: %s\n\n", chunk.Data)
            flusher.Flush()

            // Execute function
            result := h.mcpBridge.ExecuteFunction(chunk.ToolCall)

            // Send result back
            fmt.Fprintf(w, "event: function_result\ndata: %s\n\n", result)
            flusher.Flush()

            // Continue streaming with updated context
            continue
        }

        // Stream content token
        fmt.Fprintf(w, "data: %s\n\n", chunk.Content)
        flusher.Flush()
    }
}
```

---

### Version 3: Always-On Agents

**Add persistent agent processes**

```go
// agents/manager.go (V3)

type AgentManager struct {
    agents map[string]*PersistentAgent
    events *EventBus
}

type PersistentAgent struct {
    ID          string
    Type        string  // "review", "research", "documentation", etc.
    Model       string  // Which NanoGPT model powers this agent
    Context     []Message
    Subscriptions []string
    State       AgentState
}

func (am *AgentManager) SpawnAgent(agentType string, model string) (*PersistentAgent, error) {
    agent := &PersistentAgent{
        ID:    uuid.New().String(),
        Type:  agentType,
        Model: model,
        Context: []Message{
            {
                Role: "system",
                Content: am.getSystemPrompt(agentType),
            },
        },
    }

    // Subscribe to relevant events
    switch agentType {
    case "review":
        agent.Subscriptions = []string{"git:commit", "code:change"}
    case "research":
        agent.Subscriptions = []string{"task:created", "question:asked"}
    case "documentation":
        agent.Subscriptions = []string{"code:change", "api:created"}
    case "test":
        agent.Subscriptions = []string{"code:change", "feature:added"}
    }

    // Register event handlers
    for _, event := range agent.Subscriptions {
        am.events.Subscribe(event, agent.HandleEvent)
    }

    am.agents[agent.ID] = agent

    // Agent starts listening
    go agent.Run()

    return agent, nil
}

func (pa *PersistentAgent) HandleEvent(event Event) {
    // Add event to context
    pa.Context = append(pa.Context, Message{
        Role: "user",
        Content: fmt.Sprintf("Event: %s\nData: %s", event.Type, event.Data),
    })

    // Ask agent what to do
    response := pa.callNanoGPT(pa.Context, pa.Model)

    // Execute any function calls
    if response.ToolCalls != nil {
        for _, call := range response.ToolCalls {
            result := pa.executeFunction(call)
            pa.Context = append(pa.Context, Message{
                Role: "tool",
                Content: result,
            })
        }
    }

    // Add agent response to context
    pa.Context = append(pa.Context, Message{
        Role: "assistant",
        Content: response.Content,
    })

    // Trim context if too long (keep last N messages)
    if len(pa.Context) > 50 {
        pa.Context = pa.Context[len(pa.Context)-50:]
    }
}

// Event bus
type EventBus struct {
    subscribers map[string][]EventHandler
}

func (eb *EventBus) Subscribe(eventType string, handler EventHandler) {
    if eb.subscribers[eventType] == nil {
        eb.subscribers[eventType] = []EventHandler{}
    }
    eb.subscribers[eventType] = append(eb.subscribers[eventType], handler)
}

func (eb *EventBus) Publish(event Event) {
    handlers := eb.subscribers[event.Type]
    for _, handler := range handlers {
        go handler(event)  // Handle async
    }
}
```

**Example: Review Agent Watching Git Commits**

```go
// Example usage (V3)

func main() {
    // ... V1/V2 setup ...

    // Initialize agent manager
    agentManager := agents.NewManager(mcpBridge, config)

    // Spawn always-on agents
    reviewAgent, _ := agentManager.SpawnAgent("review", "gpt-4o-mini")
    testAgent, _ := agentManager.SpawnAgent("test", "gpt-4o-mini")
    docAgent, _ := agentManager.SpawnAgent("documentation", "llama-3.1-8b-instant")

    // Set up git watcher
    gitWatcher := watchers.NewGitWatcher()
    gitWatcher.OnCommit(func(commit GitCommit) {
        agentManager.PublishEvent(Event{
            Type: "git:commit",
            Data: commit,
        })
    })

    // Set up file watcher
    fileWatcher := watchers.NewFileWatcher()
    fileWatcher.OnChange(func(change FileChange) {
        agentManager.PublishEvent(Event{
            Type: "code:change",
            Data: change,
        })
    })

    // Keep running
    select {}
}
```

---

## API Examples

### Version 1: Basic Chat

```bash
# Request
curl -X POST http://localhost:8090/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Create a task to implement user authentication"}
    ]
  }'

# Response
{
  "id": "chatcmpl-123",
  "model": "llama-3.1-8b-instant",
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "I'll create a task for implementing user authentication.",
      "tool_calls": [{
        "id": "call_abc",
        "type": "function",
        "function": {
          "name": "create_task",
          "arguments": "{\"title\":\"Implement user authentication\",\"description\":\"Set up authentication system with JWT tokens\",\"priority\":2}"
        }
      }]
    }
  }],
  "usage": {
    "prompt_tokens": 45,
    "completion_tokens": 78,
    "total_tokens": 123
  },
  "x_nanogpt_tier": "free",
  "x_quota_remaining": 59847
}

# Function executed automatically, final response:
{
  "id": "chatcmpl-124",
  "model": "llama-3.1-8b-instant",
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "✓ Task created successfully with ID: task-7a9c2b4d\n\nThe task 'Implement user authentication' has been added with priority 2. It includes setting up JWT token-based authentication."
    }
  }],
  "function_results": [{
    "function": "create_task",
    "result": {"task_id": "task-7a9c2b4d", "status": "pending"}
  }]
}
```

### Version 2: Streaming

```bash
# Request with streaming
curl -X POST http://localhost:8090/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Research Kubernetes security and create tasks"}
    ],
    "stream": true
  }'

# Response (SSE stream)
data: {"delta": {"content": "I'll"}}

data: {"delta": {"content": " research"}}

data: {"delta": {"content": " Kubernetes"}}

event: function_call
data: {"function": "deep_research", "arguments": {"topic": "Kubernetes security"}}

event: function_result
data: {"findings": [...], "sources": 15}

data: {"delta": {"content": "Based"}}

data: {"delta": {"content": " on"}}

event: function_call
data: {"function": "create_task", "arguments": {"title": "Implement Pod Security Standards"}}

event: function_result
data: {"task_id": "task-xyz"}

data: {"delta": {"content": "✓"}}

data: {"delta": {"content": " Created"}}

data: [DONE]
```

### Version 3: Agent Event

```bash
# User commits code
$ git commit -m "Add payment processing"

# Agent automatically activates (shown in logs/notifications)
[2025-01-15 10:30:15] Review Agent: Analyzing commit abc123...
[2025-01-15 10:30:17] Review Agent: Function call: analyze_code_quality(file="payment.go")
[2025-01-15 10:30:19] Review Agent: Security issue detected
[2025-01-15 10:30:20] Review Agent: Function call: create_task(title="Remove hardcoded API key")
[2025-01-15 10:30:21] Review Agent: ✓ Task created: task-security-001

# User sees notification
💡 Review Agent created 1 task from your commit
   → task-security-001: Remove hardcoded API key in payment.go:42
```

---

## File Structure Summary

```
MCP_Advanced_Multi_Agent_Ecosystem/
├── src/
│   ├── services/
│   │   └── nanogpt-proxy/          # NEW: Go service
│   │       ├── main.go
│   │       ├── config/
│   │       ├── handlers/
│   │       ├── middleware/
│   │       ├── mcp/
│   │       ├── agents/             # V3
│   │       ├── storage/
│   │       └── watchers/           # V3
│   │
│   └── mcp-servers/
│       ├── agent-swarm/            # MODIFIED: MCP bridge integration
│       ├── task-orchestrator/      # Used as tool
│       ├── search-aggregator/      # Used as tool
│       ├── context-persistence/    # Used as tool
│       ├── chart-generator/        # NEW: Used as tool
│       └── external/
│           ├── atlassian-mcp/      # NEW: Used as tool
│           └── fastmcp/            # NEW: Framework reference
│
├── configs/
│   └── nanogpt/
│       ├── models.yaml             # Model configuration
│       └── tools.yaml              # Tool mappings
│
└── docs/
    ├── ENHANCEMENT_PLAN.md
    ├── IMPLEMENTATION_ROADMAP.md
    ├── ENHANCEMENT_QUICK_REFERENCE.md
    └── NANOGPT_ARCHITECTURE_PLAN.md  # This file
```

---

## Implementation Priority

| Version | Duration | Complexity | Value |
|---------|----------|------------|-------|
| V1: Basic Proxy + Tools | 2-3 weeks | Medium | High (core functionality) |
| V2: Streaming + Multi-Turn | 1-2 weeks | Medium | Medium (better UX) |
| V3: Always-On Agents | 2-3 weeks | High | High (autonomous behavior) |

**Total:** 5-8 weeks for all versions

---

## Summary

The NanoGPT proxy is **the brain** of your system:
- **V1:** Request/response with intelligent model selection and MCP tool access
- **V2:** Streaming responses with complex multi-step operations
- **V3:** Always-on agents that proactively monitor and act

All your MCP servers become **tools** that NanoGPT can use through function calling, giving you a powerful AI-first development environment.
