# NanoGPT Proxy Subscription-First Routing Architecture

## Executive Summary

This document outlines the architecture for implementing a "subscription model first" routing strategy in the NanoGPT proxy. The system will always prioritize subscription-covered models until the **subscription quota limits are reached** (daily and/or monthly based on `enforceDailyLimit`), then fall back to the existing role/profile-based routing system.

## 1. Current Architecture Analysis

### Existing Components
- **ModelRouter** (`routing/router.go`): Role/profile-based model selection using `model_routing.json`
- **ModelRankings** (`routing/rankings.go`): JSON-based role-to-model mappings
- **ChatHandler** (`handlers/chat.go`): Request processing, backend selection, usage tracking
- **Backends**: NanoGPT (personal) and Vertex (work) with `HasModel()` and `ListModels()` interfaces
- **UsageTracker** (`storage/usage.go`): Persistent usage statistics

### Current Selection Flow
```
Chat Request → ChatHandler.selectBackend() → ModelRouter.SelectForRole() → Backend Selection
```

## 2. Subscription Usage Service Architecture

### 2.1 SubscriptionService Component

**New Service**: `subscription/service.go`

```go
type SubscriptionService struct {
    httpClient    *http.Client
    apiEndpoint   string  // "https://nano-gpt.com/api/subscription/v1/usage"
    apiKey        string
    cache         *SubscriptionCache
    refreshTimer  *time.Timer
    mutex         sync.RWMutex
}

type SubscriptionCache struct {
    Usage         SubscriptionUsage   `json:"usage"` // Real API response
    LastUpdated   time.Time           `json:"last_updated"`
    TTL           time.Duration       `json:"ttl"`
}

type SubscriptionUsage struct {
    Active             bool             `json:"active"`
    Limits             UsageLimits      `json:"limits"`
    EnforceDailyLimit  bool             `json:"enforceDailyLimit"`
    Daily              TimeWindow       `json:"daily"`
    Monthly            TimeWindow       `json:"monthly"`
    Period             BillingPeriod    `json:"period"`
    State              string           `json:"state"`  // "active", "grace", "inactive"
    GraceUntil         *time.Time       `json:"graceUntil"`
}

type UsageLimits struct {
    Daily   int64 `json:"daily"`   // Daily allowance
    Monthly int64 `json:"monthly"` // Monthly allowance
}

type TimeWindow struct {
    Used        int64   `json:"used"`         // Usage units consumed
    Remaining   int64   `json:"remaining"`    // Remaining allowance
    PercentUsed float64 `json:"percentUsed"`  // Decimal fraction [0,1]
    ResetAt     int64   `json:"resetAt"`      // UNIX epoch milliseconds
}

type BillingPeriod struct {
    CurrentPeriodEnd time.Time `json:"currentPeriodEnd"` // ISO timestamp
}
```

**Key Responsibilities:**
- Fetch subscription usage from real API: `GET /api/subscription/v1/usage`
- Respect both daily and monthly quota limits based on `enforceDailyLimit`
- Handle subscription states: active/grace/inactive
- Cache usage data with TTL-based refresh
- Provide usage-aware model queries to router
- Track usage in "units" (subscription-covered operations)

### 2.2 Integration Points

**Startup Hook**: Initialize subscription service in `main.go` before ModelRouter
```go
// Initialize Subscription Service
subscriptionService := subscription.NewSubscriptionService(
    cfg.SubscriptionAPIEndpoint, // "https://nano-gpt.com/api/subscription/v1/usage"
    cfg.SubscriptionAPIKey,
    cfg.SubscriptionCacheTTL,
    cfg.SubscriptionRefreshInterval,
)

// Start background refresh
subscriptionService.StartRefresh()
log.Println("✓ Subscription Service initialized")
```

**API Endpoint**: Add subscription usage endpoint for external access
```go
router.HandleFunc("/api/subscription/v1/usage", subscriptionHandler.HandleGetSubscriptionUsage).Methods("GET")
```

## 3. Caching Strategy

### 3.1 Multi-Layer Caching Architecture

**Layer 1: In-Memory Cache (Primary)**
- Fast access for subscription-aware routing
- TTL-based expiration (configurable, default 5 minutes for usage data)
- Thread-safe with read/write locks
- Automatic background refresh based on reset times

**Layer 2: Persistent Storage (Secondary)**
- SQLite database extension for usage history
- Survives service restarts
- Tracks historical usage patterns
- Audit trail for compliance

### 3.2 Cache Management

**Cache Structure**:
```go
type CacheEntry struct {
    Usage         SubscriptionUsage   `json:"usage"`
    LastFetched   time.Time           `json:"last_fetched"`
    AccessCount   int64               `json:"access_count"`
    LastUsed      time.Time           `json:"last_used"`
    NextReset     time.Time           `json:"next_reset"`
}
```

**TTL Strategy**:
- Soft TTL: 5 minutes (for usage data freshness)
- Hard TTL: 15 minutes (force refresh)
- Smart refresh: Before reset times (daily/monthly)
- On-demand refresh: When quota warnings triggered

## 4. ModelRouter Integration

### 4.1 Enhanced ModelRouter Architecture

**Modified Interface**: Extend `ModelRouter` with subscription awareness
```go
type ModelRouter struct {
    rankings      *ModelRankings
    backends      map[string]backends.Backend
    subscription  *subscription.SubscriptionService  // New
}
```

### 4.2 New Selection Algorithm

**Updated Selection Flow**:
```go
func (mr *ModelRouter) SelectForRole(role, profile string) *ModelSelection {
    // Step 1: Check if subscription usage allows subscription models
    if mr.subscription.IsSubscriptionAvailable() {
        // Step 2: Try subscription-first selection
        if selection := mr.selectFromSubscriptionModels(role, profile); selection != nil {
            return selection
        }
    }
    
    // Step 3: Fallback to existing role/profile logic
    return mr.selectFromRankings(role, profile)
}
```

### 4.3 Subscription-First Selection Logic

```go
func (mr *ModelRouter) selectFromSubscriptionModels(role, profile string) *ModelSelection {
    mr.subscription.Lock()
    defer mr.subscription.Unlock()
    
    usage := mr.subscription.GetCurrentUsage()
    
    // Check if subscription allows usage
    if !mr.subscription.IsSubscriptionAvailable() {
        return nil
    }
    
    // Get available models from backends for this profile
    backend, ok := mr.backends[profile]
    if !ok || backend == nil {
        return nil
    }
    
    // For this example, we'll use a predefined list of subscription models
    // In production, this could come from the subscription service or configuration
    subscriptionModels := mr.getSubscriptionModelsForProfile(profile)
    
    // Select best available subscription model for the role
    for _, modelID := range subscriptionModels {
        if backend.HasModel(modelID) {
            // Track usage for quota management
            mr.trackSubscriptionUsage(modelID, 1) // 1 unit per operation
            
            return &ModelSelection{
                ModelID:  modelID,
                Backend:  profile,
                Reason:   fmt.Sprintf("subscription model (daily: %d/%d, monthly: %d/%d)", 
                    usage.Daily.Used, usage.Limits.Daily,
                    usage.Monthly.Used, usage.Limits.Monthly),
                Fallback: false,
                SubscriptionModel: true,
            }
        }
    }
    
    return nil // No subscription models available
}
```

## 5. Quota Management Logic

### 5.1 Subscription Availability Check

```go
func (ss *SubscriptionService) IsSubscriptionAvailable() bool {
    ss.Lock()
    defer ss.Unlock()
    
    usage := ss.cache.Usage
    
    // Check if subscription is active
    if !usage.Active || usage.State != "active" {
        return false
    }
    
    // Check daily and monthly limits based on enforcement policy
    if usage.EnforceDailyLimit {
        // Both daily AND monthly must have remaining quota
        return usage.Daily.Remaining > 0 && usage.Monthly.Remaining > 0
    } else {
        // Only monthly must have remaining quota
        return usage.Monthly.Remaining > 0
    }
}

func (ss *SubscriptionService) GetQuotaStatus() QuotaStatus {
    ss.Lock()
    defer ss.Unlock()
    
    usage := ss.cache.Usage
    
    return QuotaStatus{
        Daily: QuotaInfo{
            Used:     usage.Daily.Used,
            Remaining: usage.Daily.Remaining,
            Percent:  usage.Daily.PercentUsed,
            ResetAt:  time.Unix(0, usage.Daily.ResetAt*1000000), // Convert ms to nanoseconds
        },
        Monthly: QuotaInfo{
            Used:     usage.Monthly.Used,
            Remaining: usage.Monthly.Remaining,
            Percent:  usage.Monthly.PercentUsed,
            ResetAt:  time.Unix(0, usage.Monthly.ResetAt*1000000),
        },
        EnforceDaily: usage.EnforceDailyLimit,
        State:        usage.State,
    }
}
```

### 5.2 Usage Tracking

```go
func (ss *SubscriptionService) TrackUsage(modelID string, units int) error {
    ss.Lock()
    defer ss.Lock()
    
    // In a real implementation, you might track usage locally
    // The subscription API will be the source of truth for actual limits
    
    // Log usage for monitoring
    log.Info("subscription_usage_tracked").
        Str("model_id", modelID).
        Int("units", units).
        Time("timestamp", time.Now())
    
    // Trigger refresh if approaching limits
    usage := ss.cache.Usage
    if usage.Daily.PercentUsed > 0.9 || usage.Monthly.PercentUsed > 0.9 {
        go ss.ForceRefresh() // Non-blocking refresh
    }
    
    return nil
}
```

## 6. Data Structures

### 6.1 Subscription Management Types

**subscription/models.go**:
```go
type SubscriptionUsage struct {
    Active             bool             `json:"active"`
    Limits             UsageLimits      `json:"limits"`
    EnforceDailyLimit  bool             `json:"enforceDailyLimit"`
    Daily              TimeWindow       `json:"daily"`
    Monthly            TimeWindow       `json:"monthly"`
    Period             BillingPeriod    `json:"period"`
    State              string           `json:"state"`
    GraceUntil         *time.Time       `json:"graceUntil"`
}

type UsageLimits struct {
    Daily   int64 `json:"daily"`
    Monthly int64 `json:"monthly"`
}

type TimeWindow struct {
    Used        int64   `json:"used"`
    Remaining   int64   `json:"remaining"`
    PercentUsed float64 `json:"percentUsed"`
    ResetAt     int64   `json:"resetAt"`
}

type BillingPeriod struct {
    CurrentPeriodEnd time.Time `json:"currentPeriodEnd"`
}

type QuotaStatus struct {
    Daily       QuotaInfo `json:"daily"`
    Monthly     QuotaInfo `json:"monthly"`
    EnforceDaily bool     `json:"enforce_daily"`
    State       string    `json:"state"`
}

type QuotaInfo struct {
    Used      int64     `json:"used"`
    Remaining int64     `json:"remaining"`
    Percent   float64   `json:"percent"`
    ResetAt   time.Time `json:"reset_at"`
}
```

### 6.2 Router Extensions

**routing/subscription.go**:
```go
type SubscriptionAwareRouter struct {
    *ModelRouter
    subscriptionService *subscription.SubscriptionService
}

type ModelSelection struct {
    ModelID           string `json:"model_id"`
    Backend           string `json:"backend"`
    Reason            string `json:"reason"`
    Fallback          bool   `json:"fallback"`
    SubscriptionModel bool   `json:"subscription_model"`
    DailyUsed         int64  `json:"daily_used,omitempty"`
    MonthlyUsed       int64  `json:"monthly_used,omitempty"`
}
```

## 7. Database Schema

### 7.1 Usage Tracking Tables

```sql
-- Subscription usage cache
CREATE TABLE subscription_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    active BOOLEAN NOT NULL,
    daily_limit INTEGER NOT NULL,
    daily_used INTEGER DEFAULT 0,
    daily_remaining INTEGER NOT NULL,
    daily_percent_used REAL DEFAULT 0.0,
    daily_reset_at INTEGER NOT NULL, -- UNIX epoch milliseconds
    monthly_limit INTEGER NOT NULL,
    monthly_used INTEGER DEFAULT 0,
    monthly_remaining INTEGER NOT NULL,
    monthly_percent_used REAL DEFAULT 0.0,
    monthly_reset_at INTEGER NOT NULL, -- UNIX epoch milliseconds
    enforce_daily_limit BOOLEAN DEFAULT FALSE,
    state TEXT NOT NULL,
    grace_until INTEGER, -- UNIX epoch milliseconds
    current_period_end TEXT NOT NULL, -- ISO timestamp
    cached_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Usage tracking for monitoring
CREATE TABLE subscription_tracking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id TEXT NOT NULL,
    units_used INTEGER DEFAULT 1,
    role TEXT,
    profile TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    daily_usage_at_time INTEGER, -- Daily used at time of request
    monthly_usage_at_time INTEGER -- Monthly used at time of request
);

-- API refresh log
CREATE TABLE subscription_refresh_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    refresh_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    response_time_ms INTEGER,
    daily_used INTEGER,
    monthly_used INTEGER
);
```

## 8. API Client Implementation

### 8.1 Subscription API Client

**subscription/client.go**:
```go
func (ss *SubscriptionService) fetchUsage() (*SubscriptionUsage, error) {
    req, err := http.NewRequest("GET", ss.apiEndpoint, nil)
    if err != nil {
        return nil, fmt.Errorf("failed to create request: %w", err)
    }
    
    // Add authentication header
    req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", ss.apiKey))
    // Alternative: req.Header.Set("x-api-key", ss.apiKey)
    
    resp, err := ss.httpClient.Do(req)
    if err != nil {
        return nil, fmt.Errorf("failed to fetch subscription usage: %w", err)
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        body, _ := io.ReadAll(resp.Body)
        return nil, fmt.Errorf("API returned status %d: %s", resp.StatusCode, string(body))
    }
    
    var usage SubscriptionUsage
    if err := json.NewDecoder(resp.Body).Decode(&usage); err != nil {
        return nil, fmt.Errorf("failed to decode usage response: %w", err)
    }
    
    return &usage, nil
}

func (ss *SubscriptionService) StartRefresh() {
    // Initial fetch
    if err := ss.refresh(); err != nil {
        log.Printf("[WARN] Initial subscription usage fetch failed: %v", err)
    }
    
    // Start periodic refresh
    ss.refreshTimer = time.NewTimer(ss.cache.TTL)
    go func() {
        for range ss.refreshTimer.C {
            if err := ss.refresh(); err != nil {
                log.Printf("[WARN] Subscription usage refresh failed: %v", err)
            }
            
            // Calculate next refresh based on reset times
            nextRefresh := ss.calculateNextRefreshTime()
            ss.refreshTimer.Reset(nextRefresh)
        }
    }()
}

func (ss *SubscriptionService) calculateNextRefreshTime() time.Duration {
    usage := ss.cache.Usage
    
    // Refresh before the earliest reset time
    now := time.Now()
    dailyReset := time.Unix(0, usage.Daily.ResetAt*1000000)
    monthlyReset := time.Unix(0, usage.Monthly.ResetAt*1000000)
    
    var nextReset time.Time
    if dailyReset.Before(monthlyReset) {
        nextReset = dailyReset
    } else {
        nextReset = monthlyReset
    }
    
    // Refresh 5 minutes before reset, or use default TTL if too far
    refreshTime := nextReset.Add(-5 * time.Minute)
    if refreshTime.Before(now) {
        return ss.cache.TTL
    }
    
    return refreshTime.Sub(now)
}
```

## 9. Configuration

### 9.1 Configuration Structure

**config/subscription.go**:
```go
type SubscriptionConfig struct {
    APIEndpoint        string        `json:"api_endpoint"`
    APIKey             string        `json:"api_key"`
    CacheTTL           time.Duration `json:"cache_ttl"`
    RefreshInterval    time.Duration `json:"refresh_interval"`
    MaxRetries         int           `json:"max_retries"`
    RetryDelay         time.Duration `json:"retry_delay"`
    EnablePersistence  bool          `json:"enable_persistence"`
    DBPath             string        `json:"db_path"`
    
    // Subscription models configuration
    SubscriptionModels map[string][]string `json:"subscription_models"` // profile -> model IDs
    
    // Quota warning thresholds
    WarningThreshold   float64 `json:"warning_threshold"` // 0.0-1.0
}
```

### 9.2 Environment Variables

```bash
# Subscription API Configuration
SUBSCRIPTION_API_ENDPOINT="https://nano-gpt.com/api/subscription/v1/usage"
SUBSCRIPTION_API_KEY="your-api-key-here"

# Cache Configuration
SUBSCRIPTION_CACHE_TTL="5m"
SUBSCRIPTION_REFRESH_INTERVAL="5m"

# Persistence Configuration
SUBSCRIPTION_ENABLE_PERSISTENCE="true"
SUBSCRIPTION_DB_PATH="./data/subscription.db"

# Warning Configuration
SUBSCRIPTION_WARNING_THRESHOLD="0.90" # Warn at 90% usage

# Subscription Models (optional - can be configured via file)
# SUBSCRIPTION_MODELS_NANOGPT="claude-3.5-sonnet,gpt-4o"
# SUBSCRIPTION_MODELS_VERTEX="claude-3.5-sonnet,gemini-2.5-pro"
```

## 10. Metrics and Logging

### 10.1 Subscription Metrics

```go
type SubscriptionMetrics struct {
    TotalRequests              int64       `json:"total_requests"`
    SubscriptionSelections     int64       `json:"subscription_selections"`
    FallbackSelections         int64       `json:"fallback_selections"`
    CurrentQuotaStatus         QuotaStatus `json:"current_quota_status"`
    SubscriptionHitRate        float64     `json:"subscription_hit_rate"`
    AverageSelectionTimeMs     int64       `json:"average_selection_time_ms"`
    APIResponseTimeMs          int64       `json:"api_response_time_ms"`
    CacheHitRate               float64     `json:"cache_hit_rate"`
    QuotaWarningEvents         int64       `json:"quota_warning_events"`
}
```

### 10.2 Enhanced Logging

```go
// Subscription model selection
log.Info("subscription_model_selected").
    Str("model_id", selection.ModelID).
    Str("backend", selection.Backend).
    Str("role", role).
    Str("profile", profile).
    Int64("daily_used", usage.Daily.Used).
    Int64("daily_limit", usage.Limits.Daily).
    Int64("monthly_used", usage.Monthly.Used).
    Int64("monthly_limit", usage.Limits.Monthly).
    Float64("daily_percent", usage.Daily.PercentUsed).
    Float64("monthly_percent", usage.Monthly.PercentUsed)

// Quota exhaustion
log.Warn("subscription_quota_exhausted").
    Str("reason", exhaustionReason).
    Int64("daily_used", usage.Daily.Used).
    Int64("monthly_used", usage.Monthly.Used).
    Bool("enforce_daily", usage.EnforceDailyLimit).
    Str("state", usage.State)

// API errors
log.Error("subscription_api_error").
    Str("endpoint", ss.apiEndpoint).
    Int("status_code", statusCode).
    Str("error", errorMessage).
    Dur("response_time", responseTime)
```

## 11. Testing Strategy

### 11.1 Unit Tests

**subscription/service_test.go**:
- API client with mocked responses
- Cache TTL expiration
- Quota availability logic
- Daily/monthly limit enforcement

**routing/subscription_router_test.go**:
- Subscription availability checks
- Fallback behavior when quota exhausted
- Integration with existing ModelRouter

### 11.2 Integration Tests

**Test Scenarios**:
1. **Happy Path**: Subscription active, quota available, subscription models selected
2. **Daily Exhausted**: Daily limit hit, monthly available (if enforceDailyLimit=false)
3. **Monthly Exhausted**: Monthly limit hit, fallback triggered
4. **API Unavailable**: Use cached data, degrade gracefully
5. **State Changes**: Grace period handling, reactivation

### 11.3 Load Tests

**Performance Benchmarks**:
- Selection latency with subscription checks
- API response time impact
- Cache hit rate optimization
- Memory usage with usage tracking

## 12. Security Considerations

### 12.1 API Security

- Secure API key storage and rotation
- Request timeout and retry logic
- Rate limiting for API calls
- Error handling without information leakage

### 12.2 Data Protection

- Encrypted storage of usage data
- Secure database connections
- Audit logging for quota usage
- Privacy-compliant tracking

## 13. Monitoring and Alerting

### 13.1 Key Metrics

- Subscription state transitions (active/grace/inactive)
- Daily and monthly quota utilization
- API response times and error rates
- Cache performance metrics
- Fallback trigger rates

### 13.2 Alerting Rules

- Quota thresholds (>80%, >90%, >95%)
- API failures or timeouts
- State changes to grace/inactive
- Cache miss spikes
- Database connectivity issues

## Implementation Priority

1. **Phase 1**: Subscription API client and usage caching
2. **Phase 2**: ModelRouter integration with quota gates
3. **Phase 3**: Usage tracking and monitoring
4. **Phase 4**: Persistence, metrics, and alerting
5. **Phase 5**: Testing and optimization

## Key Design Decisions: Real API Integration

**Architecture Changes Based on Real API**:
- ✅ Uses actual `/api/subscription/v1/usage` endpoint
- ✅ Respects `enforceDailyLimit` policy (daily AND monthly vs monthly only)
- ✅ Tracks usage in "units" (operations) not tokens
- ✅ Handles subscription states: active/grace/inactive
- ✅ Uses API-provided reset times (UNIX epoch milliseconds)
- ✅ Implements smart refresh based on reset schedules

**Benefits of Real API Integration**:
- ✅ Single source of truth for quota limits
- ✅ Automatic handling of billing cycles
- ✅ Accurate state management
- ✅ Simplified quota calculations
- ✅ Reduced local tracking complexity

The system now prioritizes subscription models within the real API quota limits and gracefully falls back to role/profile-based routing when subscription limits are reached or the subscription becomes inactive.

This architecture ensures that subscription models are always prioritized within the real subscription quota limits while maintaining the robustness and reliability of the existing routing system.