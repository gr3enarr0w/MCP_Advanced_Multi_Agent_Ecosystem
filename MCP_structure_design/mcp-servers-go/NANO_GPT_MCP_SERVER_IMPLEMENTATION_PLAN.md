# 🎯 NanoGPT MCP Server - Implementation Plan

## 📋 Executive Summary

**Purpose**: Create an MCP server that wraps NanoGPT API calls with automated model selection, usage tracking, and cost management.

**Timeline**: 3-4 days (8-10 hours total)

**Deliverables**: 
- Complete Go-based MCP server
- 4 MCP tools for NanoGPT management
- Usage tracking database
- Model selection algorithms
- Integration with existing ecosystem

---

## 🎯 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Client (Roo/Cursor)                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              NanoGPT MCP Server (NEW - Go)                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Core Components:                                      │ │
│  │  • API Client (NanoGPT integration)                   │ │
│  │  • Model Selection Engine                             │ │
│  │  • Usage Tracker (SQLite)                             │ │
│  │  • Cost Calculator                                    │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              NanoGPT API (https://nano-gpt.com)             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Task Breakdown

### **Phase 1: Core API Client** (Day 1 - 2 hours)

#### **Task 1.1: API Client Implementation**
**File**: `pkg/integrations/nanogpt/client.go`

**Deliverables**:
- [ ] HTTP client with timeout and retry logic
- [ ] Authentication handling (API key)
- [ ] Error handling and rate limit management
- [ ] Request/response serialization

**Code Structure**:
```go
type Client struct {
    apiKey      string
    baseURL     string
    httpClient  *http.Client
    rateLimiter *rate.Limiter
}

func (c *Client) GetPersonalizedModels(ctx context.Context) ([]Model, error)
func (c *Client) CreateChatCompletion(ctx context.Context, req ChatRequest) (*ChatResponse, error)
func (c *Client) GetUsageStats(ctx context.Context) (*UsageStats, error)
```

**Test Requirements**:
- [ ] Mock NanoGPT API responses
- [ ] Test authentication failures
- [ ] Test rate limiting
- [ ] Test network errors and retries

---

#### **Task 1.2: Data Models**
**File**: `pkg/integrations/nanogpt/types.go`

**Deliverables**:
- [ ] Model struct (with pricing, capabilities)
- [ ] ChatRequest/ChatResponse structs
- [ ] UsageStats struct
- [ ] Error types

**Key Fields**:
```go
type Model struct {
    ID            string
    Name          string
    Description   string
    ContextLength int
    Capabilities  map[string]bool
    Pricing       Pricing
}

type Pricing struct {
    Prompt     float64 // per 1M tokens
    Completion float64 // per 1M tokens
}
```

---

### **Phase 2: Model Selection Engine** (Day 1-2 - 3 hours)

#### **Task 2.1: Selection Algorithm**
**File**: `pkg/integrations/nanogpt/selector.go`

**Deliverables**:
- [ ] Task type classification (coding, research, creative, quick)
- [ ] Complexity assessment (low, medium, high)
- [ ] Cost-based optimization
- [ ] Performance-based selection
- [ ] Context-aware selection (personal vs work)

**Selection Logic**:
```go
func SelectModel(taskType, complexity, context string, models []Model) string {
    // Priority: Free tier → Cost → Speed → Quality
    
    switch taskType {
    case "coding":
        if complexity == "high" {
            return "deepseek/deepseek-chat-v3-0324" // Best for complex code
        }
        return "claude-3-haiku" // Fast & cheap for simple code
        
    case "research":
        return "claude-3-haiku" // Good balance
        
    case "creative":
        return "claude-3-haiku" // Creative writing
        
    case "quick":
        return "claude-3-haiku" // Fastest response
    }
}
```

**Test Requirements**:
- [ ] Test all task type combinations
- [ ] Test free tier exhaustion
- [ ] Test cost optimization
- [ ] Test fallback logic

---

#### **Task 2.2: Provider Integration**
**File**: `pkg/integrations/nanogpt/provider.go`

**Deliverables**:
- [ ] Provider interface implementation
- [ ] Multi-provider support (NanoGPT, OpenRouter, Vertex)
- [ ] Health checks and failover
- [ ] Configuration management

---

### **Phase 3: Usage Tracking System** (Day 2 - 2 hours)

#### **Task 3.1: Database Schema**
**File**: `pkg/integrations/nanogpt/storage.go`

**Deliverables**:
- [ ] SQLite database for usage tracking
- [ ] Usage records table
- [ ] Cost aggregation views
- [ ] Free tier tracking

**Schema**:
```sql
CREATE TABLE usage (
    id INTEGER PRIMARY KEY,
    timestamp DATETIME,
    provider TEXT,
    model TEXT,
    tokens_prompt INTEGER,
    tokens_completion INTEGER,
    cost_usd REAL,
    context TEXT,  -- 'personal' or 'work'
    task_type TEXT,
    free_tier BOOLEAN
);

CREATE TABLE free_tier_status (
    provider TEXT PRIMARY KEY,
    used INTEGER,
    limit INTEGER,
    reset_date DATETIME
);
```

---

#### **Task 3.2: Tracking Logic**
**File**: `pkg/integrations/nanogpt/tracker.go`

**Deliverables**:
- [ ] Automatic usage recording
- [ ] Free tier exhaustion detection
- [ ] Cost calculation per request
- [ ] Daily/weekly/monthly aggregation

**Functions**:
```go
func RecordUsage(ctx context.Context, req UsageRecord) error
func GetFreeTierStatus(provider string) (*FreeTierStatus, error)
func GetDailyCost(ctx context.Context, date time.Time) (float64, error)
func GetMonthlyCost(ctx context.Context, month time.Time) (float64, error)
```

---

### **Phase 4: MCP Tool Implementation** (Day 3 - 2 hours)

#### **Task 4.1: Main Server**
**File**: `cmd/nanogpt-api/main.go`

**Deliverables**:
- [ ] MCP server setup
- [ ] Tool registration
- [ ] Request routing
- [ ] Error handling

**Tools to Implement**:
1. **`get_personalized_models`**
   - Input: None
   - Output: List of available models with metadata
   - Always allow: Yes

2. **`create_chat_completion`**
   - Input: task_type, complexity, prompt, context
   - Output: Response + usage stats + cost
   - Always allow: Yes

3. **`get_usage_stats`**
   - Input: timeframe (optional)
   - Output: Usage statistics, free tier status, costs
   - Always allow: Yes

4. **`select_optimal_model`**
   - Input: task_type, complexity, context
   - Output: Recommended model with reasoning
   - Always allow: Yes

---

#### **Task 4.2: Tool Handlers**
**File**: `cmd/nanogpt-api/tools.go`

**Deliverables**:
- [ ] Tool handler implementations
- [ ] Input validation
- [ ] Response formatting
- [ ] Error messages

**Example Handler**:
```go
func handleCreateChatCompletion(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
    // Validate inputs
    taskType := request.Params.Arguments["task_type"].(string)
    prompt := request.Params.Arguments["prompt"].(string)
    
    // Select model
    model := selector.SelectModel(taskType, complexity, context)
    
    // Create completion
    resp, err := client.CreateChatCompletion(ctx, model, prompt)
    if err != nil {
        return mcp.NewToolResultError(err.Error()), nil
    }
    
    // Track usage
    tracker.RecordUsage(ctx, UsageRecord{
        Model: resp.Model,
        TokensPrompt: resp.Usage.PromptTokens,
        TokensCompletion: resp.Usage.CompletionTokens,
        Cost: calculateCost(resp.Usage, model),
    })
    
    // Return result
    return mcp.NewToolResultText(formatResponse(resp)), nil
}
```

---

### **Phase 5: Integration & Testing** (Day 3-4 - 2 hours)

#### **Task 5.1: Build System**
**File**: `Makefile` (update)

**Deliverables**:
- [ ] Add nanogpt-api build target
- [ ] Update dependencies
- [ ] Create build script

```makefile
build-nanogpt:
	go build -o dist/nanogpt-api ./cmd/nanogpt-api

run-nanogpt:
	./dist/nanogpt-api
```

---

#### **Task 5.2: Integration Tests**
**File**: `test/nanogpt_integration_test.go`

**Deliverables**:
- [ ] Mock NanoGPT API server
- [ ] Test all 4 tools
- [ ] Test model selection logic
- [ ] Test usage tracking
- [ ] Test error handling

**Test Cases**:
```go
func TestGetPersonalizedModels(t *testing.T)
func TestCreateChatCompletion(t *testing.T)
func TestGetUsageStats(t *testing.T)
func TestSelectOptimalModel(t *testing.T)
func TestFreeTierExhaustion(t *testing.T)
func TestCostCalculation(t *testing.T)
```

---

### **Phase 6: Configuration & Deployment** (Day 4 - 1 hour)

#### **Task 6.1: MCP Configuration**
**File**: `config/mcp-servers.json` (update)

**Deliverables**:
- [ ] Add nanogpt-api server config
- [ ] Set environment variables
- [ ] Configure alwaysAllow tools

```json
{
  "mcpServers": {
    "nanogpt-api": {
      "command": "/path/to/mcp-servers-go/dist/nanogpt-api",
      "args": [],
      "env": {
        "NANOGPT_API_KEY": "${NANOGPT_API_KEY}",
        "MCP_DATABASE_DIR": "/Users/ceverson/.mcp/nanogpt"
      },
      "alwaysAllow": [
        "get_personalized_models",
        "create_chat_completion", 
        "get_usage_stats",
        "select_optimal_model"
      ]
    }
  }
}
```

---

#### **Task 6.2: Documentation**
**File**: `NANOGPT_MCP_SERVER.md`

**Deliverables**:
- [ ] Setup instructions
- [ ] Tool usage examples
- [ ] Configuration guide
- [ ] Troubleshooting section

---

## 📊 Implementation Timeline

| Phase | Tasks | Duration | Status |
|-------|-------|----------|--------|
| 1 | Core API Client | 2 hours | ⏳ Pending |
| 2 | Model Selection Engine | 3 hours | ⏳ Pending |
| 3 | Usage Tracking System | 2 hours | ⏳ Pending |
| 4 | MCP Tool Implementation | 2 hours | ⏳ Pending |
| 5 | Integration & Testing | 2 hours | ⏳ Pending |
| 6 | Configuration & Deployment | 1 hour | ⏳ Pending |
| **Total** | **6 tasks** | **12 hours** | **⏳ Not Started** |

---

## 🎯 Success Criteria

- [ ] All 4 MCP tools functional and tested
- [ ] Model selection working with 90%+ accuracy
- [ ] Usage tracking accurate to within 1% of actual
- [ ] Free tier exhaustion detected automatically
- [ ] Cost calculation accurate for all models
- [ ] Integration with existing MCP ecosystem
- [ ] Documentation complete and accurate
- [ ] No security vulnerabilities
- [ ] Performance: <100ms overhead per call

---

## 🔒 Security Considerations

- [ ] API key stored in environment variables only
- [ ] No logging of sensitive data
- [ ] Rate limiting to prevent abuse
- [ ] Input validation on all parameters
- [ ] Secure SQLite database (file permissions)
- [ ] No external dependencies beyond NanoGPT API

---

## 📈 Performance Targets

- **API Call Overhead**: <100ms
- **Model Selection**: <10ms
- **Usage Tracking**: <5ms per call
- **Memory Usage**: <50MB total
- **Binary Size**: <10MB

---

## 🚀 Next Steps

1. **Review and approve this plan**
2. **Begin Phase 1: Core API Client** (2 hours)
3. **Set up development environment** (if not already done)
4. **Create feature branch** for implementation
5. **Implement tasks sequentially** with testing

---

## ❓ Questions to Address

1. **Model selection priorities**: Should cost always be prioritized over quality for personal use?
2. **Free tier tracking**: Should we track by calls (60k) or tokens (estimate)?
3. **Work vs personal**: How to detect context automatically vs manual selection?
4. **Fallback providers**: Should OpenRouter/Vertex be integrated into same server or separate?
5. **Caching**: Should we cache model lists and usage stats?

---

**Status**: ✅ **Plan Complete - Ready for Implementation**