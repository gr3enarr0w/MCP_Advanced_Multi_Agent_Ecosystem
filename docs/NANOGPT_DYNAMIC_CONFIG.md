# NanoGPT Dynamic Model Configuration

## Problem: Hardcoded Models Are Wrong

Instead of hardcoding which models are subscription vs paid, the proxy should **discover them at startup** by calling NanoGPT's API endpoints.

---

## Model Discovery at Startup

```go
// config/model_discovery.go

type ModelDiscovery struct {
    apiKey  string
    baseURL string
}

type ModelTier struct {
    ID          string  `json:"id"`
    Name        string  `json:"name"`
    Description string  `json:"description"`
    MaxTokens   int     `json:"max_tokens"`
    Owner       string  `json:"owned_by"`
}

type DiscoveredModels struct {
    Subscription []ModelTier  // From /api/subscription/v1/models
    Paid         []ModelTier  // From /api/paid/v1/models
    All          []ModelTier  // From /api/v1/models
    LastFetched  time.Time
}

func (md *ModelDiscovery) DiscoverModels() (*DiscoveredModels, error) {
    discovered := &DiscoveredModels{
        LastFetched: time.Now(),
    }

    // Fetch subscription models (60k requests/month)
    subscriptionModels, err := md.fetchModels("/api/subscription/v1/models")
    if err != nil {
        return nil, fmt.Errorf("failed to fetch subscription models: %w", err)
    }
    discovered.Subscription = subscriptionModels

    // Fetch paid models
    paidModels, err := md.fetchModels("/api/paid/v1/models")
    if err != nil {
        return nil, fmt.Errorf("failed to fetch paid models: %w", err)
    }
    discovered.Paid = paidModels

    // Fetch all models (for reference)
    allModels, err := md.fetchModels("/api/v1/models")
    if err != nil {
        return nil, fmt.Errorf("failed to fetch all models: %w", err)
    }
    discovered.All = allModels

    return discovered, nil
}

func (md *ModelDiscovery) fetchModels(endpoint string) ([]ModelTier, error) {
    url := fmt.Sprintf("%s%s", md.baseURL, endpoint)

    req, _ := http.NewRequest("GET", url, nil)
    req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", md.apiKey))

    client := &http.Client{Timeout: 10 * time.Second}
    resp, err := client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    if resp.StatusCode != 200 {
        body, _ := io.ReadAll(resp.Body)
        return nil, fmt.Errorf("API returned %d: %s", resp.StatusCode, body)
    }

    var result struct {
        Data []ModelTier `json:"data"`
    }

    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, err
    }

    return result.Data, nil
}

// Refresh models periodically (e.g., daily)
func (md *ModelDiscovery) StartAutoRefresh(interval time.Duration, onUpdate func(*DiscoveredModels)) {
    ticker := time.NewTicker(interval)
    defer ticker.Stop()

    for range ticker.C {
        models, err := md.DiscoverModels()
        if err != nil {
            log.Printf("Failed to refresh models: %v", err)
            continue
        }

        onUpdate(models)
        log.Printf("Refreshed model list: %d subscription, %d paid",
            len(models.Subscription), len(models.Paid))
    }
}
```

---

## Updated Configuration (models.yaml)

```yaml
api:
  nanogpt_base_url: "https://nano-gpt.com"
  nanogpt_api_key: "${NANOGPT_API_KEY}"
  timeout: 120s
  retry_attempts: 3

# Model discovery configuration
model_discovery:
  enabled: true
  fetch_on_startup: true
  refresh_interval: "24h"  # Refresh daily
  endpoints:
    subscription: "/api/subscription/v1/models"
    paid: "/api/paid/v1/models"
    all: "/api/v1/models"

# Quota configuration
quota:
  subscription:
    requests_per_month: 60000  # 60k requests/month
    tracking_window: "rolling_30_days"
    reset_strategy: "rolling"  # or "calendar_month"

  paid:
    budget_limit: 100.00  # USD per month
    tracking_window: "rolling_30_days"

# Model selection strategy (when multiple models match)
model_selection:
  strategy: "task_based"  # or "round_robin", "least_cost", "random"

  # Task classification keywords → preferred characteristics
  task_classification:
    code:
      keywords: ["code", "function", "debug", "implement", "refactor"]
      prefer: ["gpt-4o", "claude-3.5-sonnet", "deepseek"]

    research:
      keywords: ["research", "analyze", "study", "investigate"]
      prefer: ["claude-3-haiku", "claude-3.5-sonnet"]

    long_context:
      keywords: ["document", "long", "entire", "full"]
      prefer_min_tokens: 100000
      prefer: ["claude-3.5-sonnet", "gemini-2.5-pro"]

    fast:
      keywords: ["quick", "fast", "brief", "short"]
      prefer: ["llama-3.1", "gpt-4o-mini", "gemini-flash"]

    reasoning:
      keywords: ["complex", "reason", "think", "solve", "logic"]
      prefer: ["o1", "o3", "deepseek-r1"]

    general:
      keywords: []  # Default
      prefer: []    # Use first available subscription model

# Fallback behavior when quotas exhausted
fallback:
  enabled: true

  # When subscription quota exhausted
  on_subscription_exhausted:
    - action: "use_paid"
      max_cost_per_request: 0.05  # Max $0.05 per request
    - action: "use_cheapest_paid"
    - action: "error"
      message: "All quotas exhausted. Please upgrade or wait for reset."

  # When paid budget exhausted
  on_budget_exhausted:
    - action: "error"
      message: "Monthly budget exhausted. Increase budget or wait for reset."

# Model aliases (user-friendly names → actual model IDs)
aliases:
  "gpt-4": "auto"           # Select best available GPT-4 variant
  "claude": "auto"          # Select best available Claude
  "fast": "auto"            # Select fastest available
  "smart": "auto"           # Select most capable (paid tier)
  "free": "auto"            # Force subscription tier only
```

---

## Model Selection Logic (Updated)

```go
// middleware/model_selector.go

type ModelSelector struct {
    config         *Config
    discoveredModels *DiscoveredModels
    usageTracker   *UsageTracker
}

func (ms *ModelSelector) SelectModel(request ChatRequest) (*ModelTier, string, error) {
    // Handle aliases
    requestedModel := ms.resolveAlias(request.Model)

    // Classify task type
    taskType := ms.classifyTask(request)

    // Check subscription quota (60k/month)
    subscriptionQuotaRemaining := ms.usageTracker.GetRemainingRequests("subscription")

    if subscriptionQuotaRemaining > 0 {
        // Try to use subscription model
        model := ms.selectFromTier(
            ms.discoveredModels.Subscription,
            requestedModel,
            taskType,
        )

        if model != nil {
            return model, "subscription", nil
        }
    }

    // Check paid budget
    budgetRemaining := ms.usageTracker.GetRemainingBudget("paid")

    if budgetRemaining > 0 {
        model := ms.selectFromTier(
            ms.discoveredModels.Paid,
            requestedModel,
            taskType,
        )

        if model != nil {
            // Check if cost is within per-request limit
            estimatedCost := ms.estimateCost(model, request)
            if estimatedCost <= ms.config.Fallback.MaxCostPerRequest {
                return model, "paid", nil
            }
        }
    }

    // Try fallback
    return ms.handleFallback(requestedModel, taskType)
}

func (ms *ModelSelector) selectFromTier(
    availableModels []ModelTier,
    requestedModel string,
    taskType string,
) *ModelTier {
    // If specific model requested, try to find it
    if requestedModel != "" && requestedModel != "auto" {
        for _, model := range availableModels {
            if model.ID == requestedModel ||
               strings.Contains(model.ID, requestedModel) {
                return &model
            }
        }
    }

    // Get task preferences
    prefs := ms.config.ModelSelection.TaskClassification[taskType]

    // Try preferred models for this task type
    for _, preferred := range prefs.Prefer {
        for _, model := range availableModels {
            if strings.Contains(model.ID, preferred) {
                // Check token requirements
                if prefs.PreferMinTokens > 0 && model.MaxTokens < prefs.PreferMinTokens {
                    continue
                }
                return &model
            }
        }
    }

    // No preference match, return first available
    if len(availableModels) > 0 {
        return &availableModels[0]
    }

    return nil
}

func (ms *ModelSelector) classifyTask(request ChatRequest) string {
    lastMessage := request.Messages[len(request.Messages)-1].Content
    content := strings.ToLower(lastMessage)

    // Check each task type
    for taskType, classification := range ms.config.ModelSelection.TaskClassification {
        for _, keyword := range classification.Keywords {
            if strings.Contains(content, keyword) {
                return taskType
            }
        }
    }

    return "general"
}
```

---

## Startup Sequence

```go
// main.go

func main() {
    // Load configuration
    config := config.Load("config/models.yaml")

    // Initialize model discovery
    discovery := &ModelDiscovery{
        apiKey:  config.API.NanoGPTAPIKey,
        baseURL: config.API.NanoGPTBaseURL,
    }

    // Discover models on startup
    log.Println("Discovering available models...")
    discoveredModels, err := discovery.DiscoverModels()
    if err != nil {
        log.Fatalf("Failed to discover models: %v", err)
    }

    log.Printf("✓ Discovered %d subscription models", len(discoveredModels.Subscription))
    log.Printf("✓ Discovered %d paid models", len(discoveredModels.Paid))

    // Log available subscription models
    log.Println("\nSubscription Models (60k requests/month):")
    for _, model := range discoveredModels.Subscription {
        log.Printf("  - %s (%s)", model.ID, model.Name)
    }

    // Log available paid models
    log.Println("\nPaid Models:")
    for _, model := range discoveredModels.Paid {
        log.Printf("  - %s (%s)", model.ID, model.Name)
    }

    // Start auto-refresh (daily)
    if config.ModelDiscovery.Enabled && config.ModelDiscovery.RefreshInterval > 0 {
        go discovery.StartAutoRefresh(
            config.ModelDiscovery.RefreshInterval,
            func(updated *DiscoveredModels) {
                // Update model selector with new models
                modelSelector.UpdateModels(updated)
            },
        )
    }

    // Initialize storage
    db := storage.InitDB("~/.mcp/nanogpt/usage.db")
    defer db.Close()

    // Initialize MCP bridge
    mcpBridge := mcp.NewBridge(config.MCPServers)
    mcpBridge.RegisterAllTools()

    // Create model selector with discovered models
    modelSelector := middleware.NewModelSelector(config, discoveredModels, db)

    // Create router
    r := mux.NewRouter()

    // Middleware
    r.Use(middleware.Auth)
    r.Use(modelSelector.Route)
    r.Use(middleware.QuotaChecker(db))

    // Handlers
    handler := handlers.NewChatHandler(config, db, mcpBridge, discoveredModels)
    r.HandleFunc("/v1/chat/completions", handler.HandleChat).Methods("POST")
    r.HandleFunc("/v1/models", handler.ListModels).Methods("GET")
    r.HandleFunc("/v1/usage", handler.GetUsage).Methods("GET")

    log.Println("\n✓ NanoGPT Proxy started on :8090")
    http.ListenAndServe(":8090", r)
}
```

---

## Example: User Request Flow

```
1. User: "Write a function to validate email addresses"
   ↓
2. Proxy classifies: taskType = "code"
   ↓
3. Check subscription quota: 45,231 / 60,000 used (OK)
   ↓
4. Look for subscription models matching task preferences:
   - Preferences for "code": ["gpt-4o", "claude-3.5-sonnet", "deepseek"]
   - Available subscription models: [discovered list from API]
   - Match found: "gpt-4o-mini" (in subscription tier)
   ↓
5. Select: "gpt-4o-mini" (subscription)
   ↓
6. Forward to NanoGPT with MCP tools
   ↓
7. Track usage: increment subscription request count
   ↓
8. Return response with headers:
   - X-NanoGPT-Model: gpt-4o-mini
   - X-NanoGPT-Tier: subscription
   - X-Quota-Remaining: 14769
```

---

## Management Endpoints

```go
// GET /v1/models
// Returns discovered models with tier information
{
  "subscription": [
    {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "max_tokens": 16384},
    {"id": "llama-3.1-8b", "name": "Llama 3.1 8B", "max_tokens": 8192},
    // ... all subscription models
  ],
  "paid": [
    {"id": "gpt-4o", "name": "GPT-4o", "max_tokens": 128000},
    {"id": "claude-3.5-sonnet", "name": "Claude 3.5 Sonnet", "max_tokens": 200000},
    // ... all paid models
  ],
  "last_updated": "2025-01-15T10:30:00Z"
}

// GET /v1/usage
{
  "subscription": {
    "requests_used": 45231,
    "requests_remaining": 14769,
    "quota": 60000,
    "resets_at": "2025-02-14T00:00:00Z"  // Rolling 30 days
  },
  "paid": {
    "spent": 12.45,
    "budget_remaining": 87.55,
    "budget_limit": 100.00
  },
  "by_model": {
    "gpt-4o-mini": {
      "requests": 23000,
      "tier": "subscription"
    },
    "claude-3.5-sonnet": {
      "requests": 50,
      "cost": 12.45,
      "tier": "paid"
    }
  }
}

// POST /v1/admin/refresh-models
// Manually trigger model discovery refresh
{
  "success": true,
  "subscription_models": 25,
  "paid_models": 150,
  "updated_at": "2025-01-15T14:30:00Z"
}
```

---

## Benefits of Dynamic Discovery

1. **No Hardcoding** - Models discovered from NanoGPT's API
2. **Always Current** - Auto-refresh keeps model list up-to-date
3. **Flexible** - Works with any NanoGPT subscription plan
4. **Self-Documenting** - Proxy knows exactly what's available
5. **Testable** - Can verify subscription vs paid classification

---

## Summary

Instead of hardcoding model lists, the proxy:
- Calls `/api/subscription/v1/models` at startup to get subscription models (60k/month)
- Calls `/api/paid/v1/models` to get paid models
- Uses this information for intelligent routing
- Refreshes daily to stay current
- Exposes discovered models via `/v1/models` endpoint

This makes the proxy self-configuring and accurate to your actual NanoGPT subscription.
