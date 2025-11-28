# Final Hybrid Architecture: Roo + Smart Go Proxy

## User's Vision (Documented)

**Roo Code orchestrates roles. Go Proxy optimizes and routes intelligently.**

```
User Input: "Implement OAuth2 authentication"
    ↓
┌────────────────────────────────────────────────────┐
│  Roo Code (Role Orchestrator)                      │
│  • Analyzes request                                │
│  • Decides: "Need architect role"                  │
│  • Sends API call: {prompt, role: "architect"}     │
└────────────────────────┬───────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────┐
│  Go Proxy (Smart Gateway + Prompt Engineer)        │
│                                                    │
│  Step 1: Prompt Engineering                        │
│  ┌──────────────────────────────────────────────┐ │
│  │ Fast Local Model (Qwen3-30B or Gemini 3)    │ │
│  │ Rewrites prompt for architect role           │ │
│  │ Uses monthly-updated strategies              │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  Step 2: Model Selection                          │
│  ┌──────────────────────────────────────────────┐ │
│  │ Monthly Research Database                    │ │
│  │ architect → Claude-3.5-Sonnet (best)         │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  Step 3: Execution with Context                   │
│  ┌──────────────────────────────────────────────┐ │
│  │ Context Manager (MCP)                        │ │
│  │ Injects conversation history                 │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  Step 4: LLM Call (via NanoGPT/Vertex)            │
└────────────────────────┬───────────────────────────┘
                         │
                         ▼ Optimized response
┌────────────────────────────────────────────────────┐
│  Roo Code                                          │
│  • Receives architect analysis                     │
│  • Decides: "Need implementation role next"        │
│  • Sends: {prompt, role: "implementation"}         │
└────────────────────────────────────────────────────┘
```

---

## Component 1: Prompt Engineer

### Purpose
Rewrite user/role prompts using current best practices before sending to expensive models.

### Model Selection

| Use Case | Model | Why |
|----------|-------|-----|
| Personal | Qwen3-30B (local) | Fast (34 tok/s), scores 91.0 on ArenaHard, free |
| Work | Gemini 3 Flash (Vertex) | Low latency, $0.075/1M tokens, enterprise |

### Implementation

```go
// promptengineer/engineer.go

type PromptEngineer struct {
    model      Backend  // Qwen3-30B or Gemini 3 Flash
    strategies *StrategyDB
}

type RolePromptStrategy struct {
    RoleName     string
    SystemPrompt string
    Constraints  []string
    Examples     []PromptExample
    Techniques   []string  // e.g., "chain-of-thought", "step-by-step"
}

func (pe *PromptEngineer) Optimize(userPrompt string, role string) (OptimizedPrompt, error) {
    // Get strategy for this role
    strategy := pe.strategies.GetStrategy(role)

    // Fast local model rewrites the prompt
    engineeringPrompt := fmt.Sprintf(`You are an expert prompt engineer.

Role: %s
Strategy: %s
Techniques: %s

User's original prompt:
%s

Rewrite this prompt optimally for the %s role using best practices. Make it:
1. Clear and specific
2. Include relevant constraints
3. Use appropriate tone for the role
4. Add chain-of-thought if needed

Return ONLY the optimized prompt, no explanation.`,
        role,
        strategy.SystemPrompt,
        strings.Join(strategy.Techniques, ", "),
        userPrompt,
        role,
    )

    // Call fast model (< 1 second)
    response, err := pe.model.ChatCompletion(context.Background(), OpenAIChatRequest{
        Model: "auto",  // Qwen3-30B or Gemini 3 Flash
        Messages: []ChatMessage{
            {Role: "user", Content: engineeringPrompt},
        },
        Temperature: ptr(0.3),  // Consistent rewrites
        MaxTokens:   ptr(500),
    })

    optimizedPrompt := response.Choices[0].Message.Content

    return OptimizedPrompt{
        Original:   userPrompt,
        Optimized:  optimizedPrompt,
        Role:       role,
        StrategyUsed: strategy.Name,
        EngineerTime: time.Since(start),
    }, nil
}
```

### Role-Based Strategies (from research)

```yaml
# config/prompt_strategies.yaml

strategies:
  architect:
    system_prompt: "You are a senior software architect with 15 years experience designing scalable systems."
    constraints:
      - "Consider scalability and maintainability"
      - "Provide rationale for architectural decisions"
      - "Identify tradeoffs and alternatives"
    techniques:
      - "step-by-step-reasoning"
      - "pros-and-cons-analysis"
    example:
      user: "Design authentication"
      optimized: |
        As a senior software architect, design an authentication system for a multi-tenant SaaS application.

        Consider:
        1. Scalability requirements (100k+ users)
        2. Security best practices (OAuth2, JWT)
        3. Session management strategies
        4. Integration points with existing services

        Provide:
        - High-level architecture diagram (text description)
        - Technology stack recommendations with rationale
        - Security considerations
        - Scalability approach
        - Trade-offs between different approaches

        Think step-by-step through the architectural decisions.

  implementation:
    system_prompt: "You are an expert software engineer who writes production-quality code."
    constraints:
      - "Write clean, testable code"
      - "Include error handling"
      - "Follow language best practices"
      - "Add inline documentation"
    techniques:
      - "code-with-comments"
      - "include-tests"
    example:
      user: "Write user login function"
      optimized: |
        Implement a production-quality user login function in Go.

        Requirements:
        - Accept email and password
        - Validate input (email format, password strength)
        - Check credentials against database
        - Generate JWT token on success
        - Return appropriate errors
        - Include comprehensive error handling
        - Follow Go best practices

        Provide:
        1. The main login function with full implementation
        2. Input validation logic
        3. Error types and handling
        4. Unit tests covering success and error cases
        5. Inline comments explaining key decisions

        Ensure the code is production-ready and maintainable.

  research:
    system_prompt: "You are a research analyst who synthesizes information from multiple sources."
    constraints:
      - "Cite sources when possible"
      - "Compare multiple approaches"
      - "Identify current best practices"
      - "Note any conflicting information"
    techniques:
      - "comparative-analysis"
      - "structured-research"
    example:
      user: "Research Redis vs PostgreSQL for caching"
      optimized: |
        Conduct a comprehensive analysis comparing Redis and PostgreSQL for caching in a high-traffic web application.

        Research structure:
        1. **Overview**: Brief description of each technology's caching capabilities
        2. **Performance**: Benchmark comparisons for read/write speeds
        3. **Use Cases**: When to use each (with examples)
        4. **Tradeoffs**: Pros and cons of each approach
        5. **Best Practices**: Industry standards for each
        6. **Hybrid Approaches**: Can they be used together?
        7. **Cost Considerations**: Resource usage, maintenance overhead

        For each section:
        - Provide specific metrics when available
        - Compare head-to-head
        - Note any caveats or edge cases

        Conclude with clear recommendations for different scenarios.

  review:
    system_prompt: "You are a senior code reviewer focused on quality, security, and maintainability."
    constraints:
      - "Identify security vulnerabilities"
      - "Check for code smells"
      - "Suggest improvements"
      - "Be constructive in feedback"
    techniques:
      - "security-first-review"
      - "checklist-based"
    example:
      user: "Review this payment processing code"
      optimized: |
        Perform a thorough code review of the payment processing implementation.

        Review checklist:
        1. **Security**:
           - Are payment credentials properly secured?
           - Is sensitive data encrypted?
           - Are there any injection vulnerabilities?
           - Is input validation comprehensive?

        2. **Error Handling**:
           - Are all error cases handled?
           - Are errors logged appropriately?
           - Is there proper rollback on failure?

        3. **Code Quality**:
           - Is the code readable and well-documented?
           - Are there any code smells?
           - Is it following SOLID principles?
           - Is it testable?

        4. **Performance**:
           - Are there any obvious bottlenecks?
           - Is there unnecessary database access?

        5. **Compliance**:
           - Does it follow PCI-DSS requirements?
           - Are transactions properly logged for auditing?

        Provide:
        - List of issues found (categorized by severity)
        - Specific code suggestions for each issue
        - Security concerns highlighted
        - Overall code quality assessment

  testing:
    system_prompt: "You are a QA engineer who writes comprehensive tests."
    constraints:
      - "Cover happy paths and edge cases"
      - "Include integration tests"
      - "Test error conditions"
      - "Aim for high coverage"
    techniques:
      - "test-driven"
      - "edge-case-focused"

  documentation:
    system_prompt: "You are a technical writer who creates clear, comprehensive documentation."
    constraints:
      - "Write for the target audience"
      - "Include code examples"
      - "Structure logically"
      - "Keep it maintainable"
    techniques:
      - "example-driven"
      - "structured-docs"

  debugger:
    system_prompt: "You are a senior debugger who systematically identifies and fixes issues."
    constraints:
      - "Reproduce the issue first"
      - "Identify root cause, not symptoms"
      - "Provide fix and prevention"
      - "Explain reasoning"
    techniques:
      - "hypothesis-testing"
      - "binary-search-debugging"
```

---

## Component 2: Monthly Research System

### Purpose
Automatically update:
1. **Best model for each role** (from benchmarks)
2. **Prompt engineering strategies** (from research)

### Research Schedule

```yaml
# config/research_schedule.yaml

research:
  frequency: monthly  # 1st of each month
  tasks:
    - name: "LLM Benchmarks"
      sources:
        - https://www.vellum.ai/llm-leaderboard
        - https://github.com/confident-ai/deepeval
        - https://huggingface.co/spaces/open-llm-leaderboard/open_llm_leaderboard
      output: "model_rankings.json"

    - name: "Prompt Engineering Research"
      sources:
        - https://www.lakera.ai/blog/prompt-engineering-guide
        - https://help.openai.com/en/articles/6654000-best-practices-for-prompt-engineering
      output: "prompt_strategies.yaml"
```

### Implementation

```go
// research/monthly_research.go

type ResearchSystem struct {
    evaluator *LLMEvaluator
    scraper   *BenchmarkScraper
    storage   *ResearchDB
}

func (rs *ResearchSystem) RunMonthlyResearch() error {
    log.Println("Starting monthly research cycle...")

    // 1. Scrape latest benchmarks
    benchmarks := rs.scraper.FetchLatestBenchmarks()

    // 2. Evaluate models per role
    roleRankings := map[string][]ModelRanking{
        "architect": rs.evaluateForRole(benchmarks, "reasoning", "architecture"),
        "implementation": rs.evaluateForRole(benchmarks, "coding", "code-generation"),
        "research": rs.evaluateForRole(benchmarks, "reasoning", "information-synthesis"),
        "review": rs.evaluateForRole(benchmarks, "code-review", "security"),
        "testing": rs.evaluateForRole(benchmarks, "code-generation", "test-writing"),
        "documentation": rs.evaluateForRole(benchmarks, "general", "documentation"),
        "debugger": rs.evaluateForRole(benchmarks, "coding", "debugging"),
    }

    // 3. Update model routing database
    rs.storage.UpdateModelRoutingTable(roleRankings)

    // 4. Scrape prompt engineering research
    promptStrategies := rs.scraper.FetchPromptStrategies()
    rs.storage.UpdatePromptStrategies(promptStrategies)

    log.Println("✓ Monthly research complete")
    return nil
}

func (rs *ResearchSystem) evaluateForRole(benchmarks []Benchmark, primaryTask, secondaryTask string) []ModelRanking {
    rankings := []ModelRanking{}

    for _, model := range benchmarks {
        score := 0.0

        // Weight primary task heavily (70%)
        if result, ok := model.Results[primaryTask]; ok {
            score += result.Score * 0.7
        }

        // Weight secondary task (30%)
        if result, ok := model.Results[secondaryTask]; ok {
            score += result.Score * 0.3
        }

        // Consider cost efficiency
        costFactor := rs.calculateCostFactor(model.PricePerMillionTokens)
        score *= costFactor

        rankings = append(rankings, ModelRanking{
            ModelID:   model.ID,
            Score:     score,
            Available: rs.isAvailableInBackends(model.ID),
        })
    }

    // Sort by score descending
    sort.Slice(rankings, func(i, j int) bool {
        return rankings[i].Score > rankings[j].Score
    })

    return rankings
}
```

### Model Routing Database (from research)

```json
// data/model_routing_2025_01.json

{
  "updated": "2025-01-01T00:00:00Z",
  "roles": {
    "architect": {
      "primary": {
        "model": "claude-3.5-sonnet",
        "reason": "Top reasoning (GPQA 91.9%), excellent architectural thinking",
        "benchmark_scores": {
          "reasoning": 91.9,
          "mmlu": 89.0
        }
      },
      "fallback": ["gemini-2.5-pro", "gpt-4o"],
      "subscription_alternative": "qwen-2.5-72b"
    },
    "implementation": {
      "primary": {
        "model": "claude-sonnet-4.5",
        "reason": "SWE-Bench 77.2%, best coding performance",
        "benchmark_scores": {
          "swe_bench": 77.2,
          "humaneval": 86.0
        }
      },
      "fallback": ["gpt-4o", "gemini-2.5-pro"],
      "subscription_alternative": "deepseek-v3"
    },
    "research": {
      "primary": {
        "model": "perplexity-large",
        "reason": "Specialized for research with citations",
        "benchmark_scores": {
          "information_synthesis": 88.0
        }
      },
      "fallback": ["claude-3.5-sonnet", "gemini-2.5-pro"],
      "subscription_alternative": "qwen-2.5-72b"
    },
    "review": {
      "primary": {
        "model": "gpt-4o",
        "reason": "Strong code review, security analysis",
        "benchmark_scores": {
          "code_review": 85.0,
          "security": 89.0
        }
      },
      "fallback": ["claude-3.5-sonnet"],
      "subscription_alternative": "deepseek-v3"
    },
    "testing": {
      "primary": {
        "model": "gemini-2.5-pro",
        "reason": "99% HumanEval, excellent test generation",
        "benchmark_scores": {
          "humaneval": 99.0,
          "test_generation": 92.0
        }
      },
      "fallback": ["claude-sonnet-4.5", "gpt-4o"],
      "subscription_alternative": "qwen-coder-30b"
    },
    "documentation": {
      "primary": {
        "model": "claude-3-haiku",
        "reason": "Fast, clear writing, good for docs",
        "benchmark_scores": {
          "general": 85.0
        }
      },
      "fallback": ["gemini-1.5-flash"],
      "subscription_alternative": "llama-3.3-70b"
    },
    "debugger": {
      "primary": {
        "model": "o3-mini",
        "reason": "Reasoning-focused, excellent for debugging",
        "benchmark_scores": {
          "reasoning": 90.0,
          "debugging": 87.0
        }
      },
      "fallback": ["deepseek-r1", "claude-3.5-sonnet"],
      "subscription_alternative": "qwen3-30b-thinking"
    }
  }
}
```

---

## Component 3: Context Manager

### Purpose
Inject relevant conversation history and state into every request.

### Implementation

```go
// context/manager.go

type ContextManager struct {
    mcpBridge *MCPBridge  // Connects to context-persistence MCP
    sessionID string
}

func (cm *ContextManager) EnrichRequest(
    optimizedPrompt string,
    role string,
    conversationID string,
) (EnrichedRequest, error) {
    // Load conversation history from context-persistence MCP
    history, err := cm.mcpBridge.CallTool("context-persistence", "load_conversation_history", map[string]interface{}{
        "conversation_id": conversationID,
        "limit":           10,  // Last 10 messages
    })

    // Search for similar past interactions with this role
    similar, err := cm.mcpBridge.CallTool("context-persistence", "search_similar_conversations", map[string]interface{}{
        "query":     optimizedPrompt,
        "limit":     3,
        "min_score": 0.7,
    })

    // Build enriched context
    contextMessages := []ChatMessage{}

    // Add relevant history
    for _, msg := range history.Messages {
        contextMessages = append(contextMessages, ChatMessage{
            Role:    msg.Role,
            Content: msg.Content,
        })
    }

    // Add similar conversations (as examples)
    if len(similar) > 0 {
        examplesText := "Similar past interactions:\n"
        for _, s := range similar {
            examplesText += fmt.Sprintf("- %s\n", s.Summary)
        }
        contextMessages = append(contextMessages, ChatMessage{
            Role:    "system",
            Content: examplesText,
        })
    }

    // Add the optimized prompt
    contextMessages = append(contextMessages, ChatMessage{
        Role:    "user",
        Content: optimizedPrompt,
    })

    return EnrichedRequest{
        Messages:       contextMessages,
        Role:           role,
        ConversationID: conversationID,
    }, nil
}

func (cm *ContextManager) SaveResponse(
    conversationID string,
    role string,
    prompt string,
    response string,
) error {
    // Save to context-persistence MCP
    return cm.mcpBridge.CallTool("context-persistence", "save_conversation", map[string]interface{}{
        "conversation_id": conversationID,
        "messages": []map[string]string{
            {"role": "user", "content": prompt},
            {"role": "assistant", "content": response},
        },
        "metadata": map[string]string{
            "role": role,
        },
    })
}
```

---

## Complete Flow

### API Contract (Roo ↔ Proxy)

```typescript
// Request from Roo Code
POST http://localhost:8090/v1/chat/completions
Authorization: Bearer your-key
Content-Type: application/json

{
  "messages": [
    {
      "role": "user",
      "content": "Design an authentication system"
    }
  ],
  "role": "architect",  // NEW: Role for this request
  "conversation_id": "conv-abc123",  // NEW: For context tracking
  "profile": "personal"  // or "work"
}

// Response to Roo Code
{
  "id": "chatcmpl-xyz",
  "model": "claude-3.5-sonnet",  // Actual model used
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "Here's a comprehensive architecture for your authentication system..."
    }
  }],
  "usage": {
    "prompt_tokens": 245,
    "completion_tokens": 1523
  },
  "x_proxy_metadata": {
    "original_prompt_length": 45,
    "optimized_prompt_length": 245,
    "prompt_engineer_time_ms": 850,
    "model_selection_reason": "Top reasoning (91.9% GPQA), best for architect role",
    "context_added": true,
    "tier_used": "subscription"
  }
}
```

### Go Proxy Handler

```go
// handlers/smart_chat.go

type SmartChatHandler struct {
    promptEngineer *PromptEngineer
    modelRouter    *ModelRouter
    contextManager *ContextManager
    backends       map[string]Backend
}

func (h *SmartChatHandler) HandleSmartChat(w http.ResponseWriter, r *http.Request) {
    start := time.Now()

    // Parse request
    var req SmartChatRequest
    json.NewDecoder(r.Body).Decode(&req)

    role := req.Role
    if role == "" {
        role = "general"
    }

    userPrompt := req.Messages[len(req.Messages)-1].Content
    conversationID := req.ConversationID
    profile := req.Profile
    if profile == "" {
        profile = "personal"
    }

    log.Printf("Smart chat request: role=%s, profile=%s", role, profile)

    // Step 1: Prompt Engineering (fast local model)
    optimized, err := h.promptEngineer.Optimize(userPrompt, role)
    if err != nil {
        http.Error(w, "Prompt optimization failed", 500)
        return
    }
    log.Printf("  ✓ Prompt optimized in %dms", optimized.EngineerTime.Milliseconds())

    // Step 2: Model Selection (based on role + monthly research)
    selectedModel, reason := h.modelRouter.SelectForRole(role, profile)
    log.Printf("  ✓ Selected %s: %s", selectedModel.ID, reason)

    // Step 3: Context Enrichment (from MCP)
    enriched, err := h.contextManager.EnrichRequest(
        optimized.Optimized,
        role,
        conversationID,
    )
    log.Printf("  ✓ Context added: %d messages", len(enriched.Messages))

    // Step 4: Execute with selected backend
    backend := h.backends[profile]  // personal or work

    response, err := backend.ChatCompletion(r.Context(), OpenAIChatRequest{
        Model:    selectedModel.ID,
        Messages: enriched.Messages,
    })

    // Step 5: Save to context
    h.contextManager.SaveResponse(
        conversationID,
        role,
        optimized.Optimized,
        response.Choices[0].Message.Content,
    )

    // Add metadata for transparency
    response.XProxyMetadata = ProxyMetadata{
        OriginalPromptLength:  len(userPrompt),
        OptimizedPromptLength: len(optimized.Optimized),
        PromptEngineerTimeMs:  optimized.EngineerTime.Milliseconds(),
        ModelSelectionReason:  reason,
        ContextAdded:          true,
        TierUsed:              backend.Tier(),
        TotalTimeMs:           time.Since(start).Milliseconds(),
    }

    log.Printf("  ✓ Complete in %dms", time.Since(start).Milliseconds())

    json.NewEncoder(w).Encode(response)
}
```

---

## Roo Code Integration

### Configuration

```json
// Roo Code settings
{
  "api": {
    "provider": "openai-compatible",
    "baseURL": "http://localhost:8090/v1",
    "apiKey": "your-proxy-key",
    "model": "auto"  // Proxy decides
  },
  "proxy": {
    "profile": "personal",  // or "work"
    "enable_smart_routing": true
  }
}
```

### Roo Code Behavior

Roo Code continues to:
- Analyze user requests
- Decide which role/agent to use
- Manage overall workflow
- Handle tool calls to other MCP servers

The proxy just makes each individual LLM call smarter.

---

## Summary

| Component | Purpose | Model |
|-----------|---------|-------|
| **Prompt Engineer** | Rewrite prompts per role | Qwen3-30B (personal) / Gemini 3 Flash (work) |
| **Model Router** | Select best model per role | Monthly research database |
| **Context Manager** | Add conversation history | context-persistence MCP |
| **LLM Backend** | Execute optimized request | NanoGPT (personal) / Vertex AI (work) |

**Roo Code: Orchestrates roles → Go Proxy: Optimizes each call → Response: Back to Roo**

This gives you maximum automation while keeping Roo Code in control of the high-level workflow.
