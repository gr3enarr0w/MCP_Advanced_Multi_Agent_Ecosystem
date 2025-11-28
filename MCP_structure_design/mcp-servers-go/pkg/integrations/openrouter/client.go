// Package openrouter provides integration with the OpenRouter API
package openrouter

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// Client represents an OpenRouter API client
type Client struct {
	apiKey     string
	httpClient *http.Client
	baseURL    string
	providers  []Provider
}

// NewClient creates a new OpenRouter client
func NewClient(apiKey string) *Client {
	return &Client{
		apiKey: apiKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		baseURL: "https://openrouter.ai/api/v1",
		providers: []Provider{
			{
				Name:     "Claude 3 Opus",
				Model:    ModelClaude3Opus,
				Enabled:  true,
				Priority: 1,
			},
			{
				Name:     "Claude 3 Sonnet",
				Model:    ModelClaude3Sonnet,
				Enabled:  true,
				Priority: 2,
			},
			{
				Name:     "GPT-4",
				Model:    ModelGPT4,
				Enabled:  false, // Requires separate API key
				Priority: 3,
			},
			{
				Name:     "GPT-3.5 Turbo",
				Model:    ModelGPT35Turbo,
				Enabled:  false, // Requires separate API key
				Priority: 4,
			},
			{
				Name:     "Llama 2 70B",
				Model:    ModelLlama270B,
				Enabled:  true,
				Priority: 5,
			},
		},
	}
}

// ChatCompletion creates a chat completion
func (c *Client) ChatCompletion(ctx context.Context, messages []Message, options *ChatOptions) (*ChatResponse, error) {
	if options == nil {
		options = DefaultOptions()
	}

	// Select the highest priority enabled provider
	var selectedProvider *Provider
	for i := range c.providers {
		if c.providers[i].Enabled && (selectedProvider == nil || c.providers[i].Priority < selectedProvider.Priority) {
			selectedProvider = &c.providers[i]
		}
	}

	if selectedProvider == nil {
		return nil, fmt.Errorf("no enabled providers available")
	}

	req := ChatRequest{
		Model:       selectedProvider.Model,
		Messages:    messages,
		Temperature: options.Temperature,
		MaxTokens:   options.MaxTokens,
		Stream:      options.Stream,
	}

	return c.executeRequest(ctx, req)
}

// executeRequest executes the API request
func (c *Client) executeRequest(ctx context.Context, req ChatRequest) (*ChatResponse, error) {
	jsonData, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/chat/completions", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
	httpReq.Header.Set("HTTP-Referer", "https://github.com/ceverson/mcp-advanced-multi-agent-ecosystem")
	httpReq.Header.Set("X-Title", "MCP Advanced Multi-Agent Ecosystem")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API returned status %d", resp.StatusCode)
	}

	var chatResp ChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&chatResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &chatResp, nil
}

// HealthCheck performs a health check on the API
func (c *Client) HealthCheck(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/models", nil)
	if err != nil {
		return fmt.Errorf("failed to create health check request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("health check request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("health check returned status %d", resp.StatusCode)
	}

	return nil
}

// IsConfigured returns whether the client is properly configured
func (c *Client) IsConfigured() bool {
	return c.apiKey != ""
}

// GetAvailableModels returns a list of available models
func (c *Client) GetAvailableModels() []string {
	var models []string
	for _, provider := range c.providers {
		if provider.Enabled {
			models = append(models, string(provider.Model))
		}
	}
	return models
}

// EnableProvider enables a specific provider
func (c *Client) EnableProvider(model Model) {
	for i := range c.providers {
		if c.providers[i].Model == model {
			c.providers[i].Enabled = true
			break
		}
	}
}

// DisableProvider disables a specific provider
func (c *Client) DisableProvider(model Model) {
	for i := range c.providers {
		if c.providers[i].Model == model {
			c.providers[i].Enabled = false
			break
		}
	}
}

// SetProviderAPIKey sets the API key for a specific provider
func (c *Client) SetProviderAPIKey(providerName string, apiKey string) {
	// For now, OpenRouter uses a single API key
	// In the future, this could support provider-specific keys
	c.apiKey = apiKey
}