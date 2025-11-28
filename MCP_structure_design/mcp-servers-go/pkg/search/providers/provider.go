// Package providers provides search provider implementations
package providers

import (
	"context"
)

// Provider represents a search provider
type Provider interface {
	// Name returns the provider name
	Name() string

	// Priority returns the provider priority (lower = higher priority)
	Priority() int

	// IsConfigured returns whether the provider is properly configured
	IsConfigured() bool

	// Search performs a search
	Search(ctx context.Context, query string, limit int) ([]Result, error)

	// HealthCheck performs a health check on the provider
	HealthCheck(ctx context.Context) error
}

// Result represents a search result
type Result struct {
	Title     string `json:"title"`
	URL       string `json:"url"`
	Snippet   string `json:"snippet"`
	Provider  string `json:"provider"`
	Timestamp string `json:"timestamp"`
}

// BaseProvider provides common functionality for providers
type BaseProvider struct {
	name     string
	priority int
}

// Name returns the provider name
func (p *BaseProvider) Name() string {
	return p.name
}

// Priority returns the provider priority
func (p *BaseProvider) Priority() int {
	return p.priority
}