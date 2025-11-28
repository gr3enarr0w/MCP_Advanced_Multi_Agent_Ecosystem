// Package llm provides a unified interface for LLM providers
package llm

import (
	"context"
	"fmt"

	"github.com/ceverson/mcp-advanced-multi-agent-ecosystem/pkg/integrations/openrouter"
)

// Provider represents an LLM provider interface
type Provider interface {
	// Name returns the provider name
	Name() string

	// GenerateResponse generates a response from the LLM
	GenerateResponse(ctx context.Context, prompt string, options *GenerationOptions) (string, error)

	// IsConfigured returns whether the provider is properly configured
	IsConfigured() bool

	// HealthCheck performs a health check on the provider
	HealthCheck(ctx context.Context) error

	// GetAvailableModels returns available models
	GetAvailableModels() []string
}

// GenerationOptions represents options for text generation
type GenerationOptions struct {
	Temperature float64
	MaxTokens   int
	Model       string
}

// DefaultGenerationOptions returns default generation options
func DefaultGenerationOptions() *GenerationOptions {
	return &GenerationOptions{
		Temperature: 0.7,
		MaxTokens:   1000,
		Model:       "",
	}
}

// OpenRouterProvider implements the Provider interface using OpenRouter
type OpenRouterProvider struct {
	client *openrouter.Client
	name   string
}

// NewOpenRouterProvider creates a new OpenRouter provider
func NewOpenRouterProvider(apiKey string) *OpenRouterProvider {
	return &OpenRouterProvider{
		client: openrouter.NewClient(apiKey),
		name:   "OpenRouter",
	}
}

// Name returns the provider name
func (p *OpenRouterProvider) Name() string {
	return p.name
}

// GenerateResponse generates a response using OpenRouter
func (p *OpenRouterProvider) GenerateResponse(ctx context.Context, prompt string, options *GenerationOptions) (string, error) {
	if options == nil {
		options = DefaultGenerationOptions()
	}

	messages := []openrouter.Message{
		{
			Role:    "user",
			Content: prompt,
		},
	}

	chatOptions := &openrouter.ChatOptions{
		Temperature: options.Temperature,
		MaxTokens:   options.MaxTokens,
		Stream:      false,
	}

	response, err := p.client.ChatCompletion(ctx, messages, chatOptions)
	if err != nil {
		return "", err
	}

	if len(response.Choices) == 0 {
		return "", fmt.Errorf("no response choices returned")
	}

	return response.Choices[0].Message.Content, nil
}

// IsConfigured returns whether the provider is configured
func (p *OpenRouterProvider) IsConfigured() bool {
	return p.client.IsConfigured()
}

// HealthCheck performs a health check
func (p *OpenRouterProvider) HealthCheck(ctx context.Context) error {
	return p.client.HealthCheck(ctx)
}

// GetAvailableModels returns available models
func (p *OpenRouterProvider) GetAvailableModels() []string {
	return p.client.GetAvailableModels()
}

// MultiProvider manages multiple LLM providers with fallback
type MultiProvider struct {
	providers []Provider
}

// NewMultiProvider creates a new multi-provider instance
func NewMultiProvider(providers ...Provider) *MultiProvider {
	return &MultiProvider{
		providers: providers,
	}
}

// GenerateResponse generates a response using the first available provider
func (m *MultiProvider) GenerateResponse(ctx context.Context, prompt string, options *GenerationOptions) (string, error) {
	var lastErr error
	
	for _, provider := range m.providers {
		if !provider.IsConfigured() {
			continue
		}

		if err := provider.HealthCheck(ctx); err != nil {
			lastErr = err
			continue
		}

		response, err := provider.GenerateResponse(ctx, prompt, options)
		if err != nil {
			lastErr = err
			continue
		}

		return response, nil
	}

	if lastErr != nil {
		return "", fmt.Errorf("all providers failed, last error: %w", lastErr)
	}

	return "", fmt.Errorf("no configured providers available")
}

// AddProvider adds a provider to the multi-provider
func (m *MultiProvider) AddProvider(provider Provider) {
	m.providers = append(m.providers, provider)
}

// GetProviders returns all providers
func (m *MultiProvider) GetProviders() []Provider {
	return m.providers
}