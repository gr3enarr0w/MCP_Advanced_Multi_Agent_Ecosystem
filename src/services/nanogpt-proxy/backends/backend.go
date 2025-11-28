package backends

import (
	"context"
	"time"
)

// Backend defines the interface for LLM backends (NanoGPT, Vertex AI)
type Backend interface {
	ChatCompletion(ctx context.Context, req ChatRequest) (*ChatResponse, error)
	ListModels(ctx context.Context) ([]Model, error)
	Name() string
	Tier() string // "free", "paid", "enterprise"
	HasModel(modelID string) bool
	GetUsage() (*Usage, error)
}

// ChatRequest represents an OpenAI-compatible chat completion request
type ChatRequest struct {
	Model            string         `json:"model"`
	Messages         []ChatMessage  `json:"messages"`
	Temperature      float64        `json:"temperature,omitempty"`
	MaxTokens        int            `json:"max_tokens,omitempty"`
	TopP             float64        `json:"top_p,omitempty"`
	Stream           bool           `json:"stream,omitempty"`
	// Custom fields for our proxy
	Role             string         `json:"role,omitempty"`              // architect, implementation, etc.
	ConversationID   string         `json:"conversation_id,omitempty"`
}

// ChatMessage represents a message in the conversation
type ChatMessage struct {
	Role    string `json:"role"`    // system, user, assistant
	Content string `json:"content"`
}

// ChatResponse represents an OpenAI-compatible chat completion response
type ChatResponse struct {
	ID      string   `json:"id"`
	Object  string   `json:"object"`
	Created int64    `json:"created"`
	Model   string   `json:"model"`
	Choices []Choice `json:"choices"`
	Usage   TokenUsage `json:"usage"`
	// Custom metadata
	XProxyMetadata *ProxyMetadata `json:"x_proxy_metadata,omitempty"`
}

// Choice represents a single completion choice
type Choice struct {
	Index        int         `json:"index"`
	Message      ChatMessage `json:"message"`
	FinishReason string      `json:"finish_reason"`
}

// TokenUsage tracks token consumption
type TokenUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// ProxyMetadata contains custom proxy information
type ProxyMetadata struct {
	Backend                 string `json:"backend"`
	OriginalPromptLength    int    `json:"original_prompt_length"`
	OptimizedPromptLength   int    `json:"optimized_prompt_length"`
	PromptEngineerTimeMs    int64  `json:"prompt_engineer_time_ms"`
	StrategyUsed            string `json:"strategy_used"`
	ModelSelected           string `json:"model_selected"`
	SelectionReason         string `json:"selection_reason"`
}

// Model represents an available LLM model
type Model struct {
	ID          string   `json:"id"`
	Object      string   `json:"object"`
	Created     int64    `json:"created"`
	OwnedBy     string   `json:"owned_by"`
	Benchmarks  map[string]float64 `json:"benchmarks,omitempty"`
	Reason      string   `json:"reason,omitempty"`
}

// Usage tracks backend usage statistics
type Usage struct {
	TokensUsed      int
	TokensRemaining int
	TokensLimit     int
	ResetDate       time.Time
}
