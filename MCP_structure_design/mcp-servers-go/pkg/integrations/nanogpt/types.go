// Package nanogpt provides integration with nanoGPT models
package nanogpt

import (
	"time"
)

// Model represents a nanoGPT model
type Model string

const (
	ModelGPT2        Model = "gpt2"
	ModelGPT2Medium  Model = "gpt2-medium"
	ModelGPT2Large   Model = "gpt2-large"
	ModelGPT2XL      Model = "gpt2-xl"
	ModelCustom      Model = "custom"
)

// Message represents a chat message
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatRequest represents a chat completion request
type ChatRequest struct {
	Model       Model     `json:"model"`
	Messages    []Message `json:"messages"`
	Temperature float64   `json:"temperature,omitempty"`
	MaxTokens   int       `json:"max_tokens,omitempty"`
	TopP        float64   `json:"top_p,omitempty"`
	Stream      bool      `json:"stream,omitempty"`
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
	Created int64 `json:"created"`
}

// Config represents nanoGPT configuration
type Config struct {
	BaseURL     string
	APIKey      string
	DefaultModel Model
	Timeout     time.Duration
}

// DefaultConfig returns default nanoGPT configuration
func DefaultConfig() *Config {
	return &Config{
		BaseURL:     "https://nano-gpt.com/api/v1",
		DefaultModel: ModelGPT2,
		Timeout:     30 * time.Second,
	}
}

// ChatOptions represents options for chat completion
type ChatOptions struct {
	Temperature float64
	MaxTokens   int
	TopP        float64
	Stream      bool
	Model       Model
}

// DefaultChatOptions returns default chat options
func DefaultChatOptions() *ChatOptions {
	return &ChatOptions{
		Temperature: 0.8,
		MaxTokens:   500,
		TopP:        0.9,
		Stream:      false,
		Model:       ModelGPT2,
	}
}