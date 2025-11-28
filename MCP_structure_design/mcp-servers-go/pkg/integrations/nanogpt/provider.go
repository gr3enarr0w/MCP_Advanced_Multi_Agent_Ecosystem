// Package nanogpt provides a nanoGPT provider implementation for the LLM interface
package nanogpt

import (
	"context"

	"github.com/ceverson/mcp-advanced-multi-agent-ecosystem/pkg/integrations/llm"
)

// Provider implements the LLM Provider interface for nanoGPT
type Provider struct {
	client *Client
	name   string
}

// NewProvider creates a new nanoGPT provider
func NewProvider(apiKey string) *Provider {
	return &Provider{
		client: NewClientWithAPIKey(apiKey),
		name:   "nanoGPT",
	}
}

// NewProviderWithConfig creates a new nanoGPT provider with custom config
func NewProviderWithConfig(config *Config) *Provider {
	return &Provider{
		client: NewClient(config),
		name:   "nanoGPT",
	}
}

// Name returns the provider name
func (p *Provider) Name() string {
	return p.name
}

// GenerateResponse generates a response using nanoGPT
func (p *Provider) GenerateResponse(ctx context.Context, prompt string, options *llm.GenerationOptions) (string, error) {
	if options == nil {
		options = llm.DefaultGenerationOptions()
	}

	chatOptions := &ChatOptions{
		Temperature: options.Temperature,
		MaxTokens:   options.MaxTokens,
		TopP:        0.9,
		Stream:      false,
		Model:       ModelGPT2, // Default to GPT-2
	}

	return p.client.GenerateText(ctx, prompt, chatOptions)
}

// IsConfigured returns whether the provider is configured
func (p *Provider) IsConfigured() bool {
	return p.client.IsConfigured()
}

// HealthCheck performs a health check
func (p *Provider) HealthCheck(ctx context.Context) error {
	return p.client.HealthCheck(ctx)
}

// GetAvailableModels returns available models
func (p *Provider) GetAvailableModels() []string {
	models, err := p.client.ListModels(context.Background())
	if err != nil {
		return []string{string(ModelGPT2)} // Return default on error
	}

	var modelStrings []string
	for _, model := range models {
		modelStrings = append(modelStrings, string(model))
	}
	return modelStrings
}

// SetAPIKey sets the API key
func (p *Provider) SetAPIKey(apiKey string) {
	p.client.SetAPIKey(apiKey)
}

// SetBaseURL sets the base URL (useful for local instances)
func (p *Provider) SetBaseURL(baseURL string) {
	p.client.SetBaseURL(baseURL)
}