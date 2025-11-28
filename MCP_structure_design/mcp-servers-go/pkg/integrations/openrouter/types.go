// Package openrouter provides integration with the OpenRouter API
package openrouter

// Model represents an LLM model available through OpenRouter
type Model string

const (
	ModelClaude3Opus    Model = "anthropic/claude-3-opus"
	ModelClaude3Sonnet  Model = "anthropic/claude-3-sonnet"
	ModelClaude3Haiku   Model = "anthropic/claude-3-haiku"
	ModelGPT4           Model = "openai/gpt-4"
	ModelGPT4Turbo      Model = "openai/gpt-4-turbo"
	ModelGPT35Turbo     Model = "openai/gpt-3.5-turbo"
	ModelLlama270B      Model = "meta-llama/llama-2-70b"
	ModelLlama213B      Model = "meta-llama/llama-2-13b"
	ModelMistralLarge   Model = "mistralai/mistral-large"
	ModelMistralMedium  Model = "mistralai/mistral-medium"
)

// Message represents a chat message
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatRequest represents a chat completion request
type ChatRequest struct {
	Model       Model      `json:"model"`
	Messages    []Message  `json:"messages"`
	Temperature float64    `json:"temperature,omitempty"`
	MaxTokens   int        `json:"max_tokens,omitempty"`
	Stream      bool       `json:"stream,omitempty"`
}

// ChatResponse represents a chat completion response
type ChatResponse struct {
	ID      string `json:"id"`
	Model   string `json:"model"`
	Choices []struct {
		Message Message `json:"message"`
		Index   int     `json:"index"`
	} `json:"choices"`
	Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage"`
}

// Provider represents an LLM provider configuration
type Provider struct {
	Name     string
	APIKey   string
	Model    Model
	Enabled  bool
	Priority int
}

// ChatOptions represents options for chat completion
type ChatOptions struct {
	Temperature float64
	MaxTokens   int
	Stream      bool
}

// DefaultOptions returns default chat options
func DefaultOptions() *ChatOptions {
	return &ChatOptions{
		Temperature: 0.7,
		MaxTokens:   1000,
		Stream:      false,
	}
}