package providers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// PerplexityProvider implements the Perplexity AI search provider
type PerplexityProvider struct {
	BaseProvider
	apiKey     string
	httpClient *http.Client
}

// NewPerplexityProvider creates a new Perplexity provider
func NewPerplexityProvider(apiKey string) Provider {
	return &PerplexityProvider{
		BaseProvider: BaseProvider{
			name:     "perplexity",
			priority: 1, // Highest priority
		},
		apiKey: apiKey,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// IsConfigured returns whether the provider is configured
func (p *PerplexityProvider) IsConfigured() bool {
	return p.apiKey != ""
}

// Search performs a search using Perplexity AI
func (p *PerplexityProvider) Search(ctx context.Context, query string, limit int) ([]Result, error) {
	requestBody := map[string]interface{}{
		"model": "llama-3.1-sonar-small-128k-online",
		"messages": []map[string]string{
			{
				"role":    "system",
				"content": "You are a helpful search assistant. Provide concise, accurate information.",
			},
			{
				"role":    "user",
				"content": query,
			},
		},
		"max_tokens": 1000,
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.perplexity.ai/chat/completions", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+p.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API returned status %d", resp.StatusCode)
	}

	var apiResponse struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&apiResponse); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if len(apiResponse.Choices) == 0 {
		return nil, fmt.Errorf("no results returned")
	}

	// Parse Perplexity response into our Result format
	results := []Result{
		{
			Title:     "Perplexity AI Response",
			URL:       "https://perplexity.ai",
			Snippet:   apiResponse.Choices[0].Message.Content,
			Provider:  p.name,
			Timestamp: time.Now().Format(time.RFC3339),
		},
	}

	return results, nil
}

// HealthCheck performs a health check on the Perplexity API
func (p *PerplexityProvider) HealthCheck(ctx context.Context) error {
	if !p.IsConfigured() {
		return fmt.Errorf("not configured")
	}

	// Simple health check with minimal request
	requestBody := map[string]interface{}{
		"model": "llama-3.1-sonar-small-128k-online",
		"messages": []map[string]string{
			{
				"role":    "user",
				"content": "test",
			},
		},
		"max_tokens": 10,
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return fmt.Errorf("failed to marshal health check request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.perplexity.ai/chat/completions", bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create health check request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+p.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("health check request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("health check returned status %d", resp.StatusCode)
	}

	return nil
}