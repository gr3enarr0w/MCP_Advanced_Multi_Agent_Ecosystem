// Package aggregator provides multi-provider search aggregation with fallback and caching
package aggregator

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/ceverson/mcp-advanced-multi-agent-ecosystem/pkg/search/providers"
)

// Config represents the aggregator configuration
type Config struct {
	CachePath string
	APIKeys   *APIKeys
}

// APIKeys holds API keys for various search providers
type APIKeys struct {
	Perplexity string
	Brave      string
	Google     string
	GoogleCX   string
}

// SearchResult represents the aggregated search result
type SearchResult struct {
	Query     string            `json:"query"`
	Provider  string            `json:"provider"`
	Cached    bool              `json:"cached"`
	Results   []providers.Result `json:"results"`
	Timestamp string            `json:"timestamp"`
}

// SearchAggregator coordinates multiple search providers
type SearchAggregator struct {
	providers []providers.Provider
	cache     *Cache
	mu        sync.RWMutex
}

// NewSearchAggregator creates a new search aggregator
func NewSearchAggregator(config *Config) (*SearchAggregator, error) {
	if config == nil {
		return nil, fmt.Errorf("config is required")
	}

	// Initialize cache
	cache, err := NewCache(config.CachePath)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize cache: %w", err)
	}

	// Initialize providers in order of priority
	var providerList []providers.Provider

	// Perplexity (highest priority)
	if config.APIKeys.Perplexity != "" {
		providerList = append(providerList, providers.NewPerplexityProvider(config.APIKeys.Perplexity))
	}

	// Brave Search
	if config.APIKeys.Brave != "" {
		providerList = append(providerList, providers.NewBraveProvider(config.APIKeys.Brave))
	}

	// Google Search
	if config.APIKeys.Google != "" && config.APIKeys.GoogleCX != "" {
		providerList = append(providerList, providers.NewGoogleProvider(config.APIKeys.Google, config.APIKeys.GoogleCX))
	}

	// DuckDuckGo (always available, no API key needed)
	providerList = append(providerList, providers.NewDuckDuckGoProvider())

	if len(providerList) == 0 {
		return nil, fmt.Errorf("no search providers configured")
	}

	// Sort providers by priority (lower number = higher priority)
	sort.Slice(providerList, func(i, j int) bool {
		return providerList[i].Priority() < providerList[j].Priority()
	})

	return &SearchAggregator{
		providers: providerList,
		cache:     cache,
	}, nil
}

// Search performs a search using available providers with automatic fallback
func (a *SearchAggregator) Search(ctx context.Context, query string, limit int, useCache bool) (*SearchResult, error) {
	// Check cache first
	if useCache {
		if cached := a.cache.Get(query, 24*time.Hour); cached != nil {
			return &SearchResult{
				Query:     query,
				Provider:  "cache",
				Cached:    true,
				Results:   cached.Results,
				Timestamp: cached.Timestamp,
			}, nil
		}
	}

	// Try each provider in order
	var lastErr error
	for _, provider := range a.providers {
		if !provider.IsConfigured() {
			continue
		}

		results, err := provider.Search(ctx, query, limit)
		if err != nil {
			lastErr = err
			continue // Try next provider
		}

		if len(results) > 0 {
			// Cache successful results
			a.cache.Set(query, &SearchResult{
				Query:     query,
				Provider:  provider.Name(),
				Cached:    false,
				Results:   results,
				Timestamp: time.Now().Format(time.RFC3339),
			})

			return &SearchResult{
				Query:     query,
				Provider:  provider.Name(),
				Cached:    false,
				Results:   results,
				Timestamp: time.Now().Format(time.RFC3339),
			}, nil
		}
	}

	if lastErr != nil {
		return nil, fmt.Errorf("all search providers failed, last error: %w", lastErr)
	}

	return nil, fmt.Errorf("no search results found")
}

// GetAvailableProviders returns a list of configured provider names
func (a *SearchAggregator) GetAvailableProviders() []string {
	a.mu.RLock()
	defer a.mu.RUnlock()

	var names []string
	for _, provider := range a.providers {
		if provider.IsConfigured() {
			names = append(names, provider.Name())
		}
	}
	return names
}

// ClearCache clears cache entries older than the specified duration
func (a *SearchAggregator) ClearCache(maxAge time.Duration) {
	a.cache.ClearOld(maxAge)
}

// Close closes the aggregator and its resources
func (a *SearchAggregator) Close() error {
	return a.cache.Close()
}

// HealthCheck performs health checks on all providers
func (a *SearchAggregator) HealthCheck(ctx context.Context) map[string]error {
	a.mu.RLock()
	defer a.mu.RUnlock()

	results := make(map[string]error)
	for _, provider := range a.providers {
		if provider.IsConfigured() {
			results[provider.Name()] = provider.HealthCheck(ctx)
		}
	}
	return results
}

// CachedResult represents a cached search result
type CachedResult struct {
	Results   []providers.Result `json:"results"`
	Provider  string             `json:"provider"`
	Timestamp string             `json:"timestamp"`
}