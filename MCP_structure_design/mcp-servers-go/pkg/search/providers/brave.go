package providers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// BraveProvider implements the Brave Search provider
type BraveProvider struct {
	BaseProvider
	apiKey     string
	httpClient *http.Client
}

// NewBraveProvider creates a new Brave Search provider
func NewBraveProvider(apiKey string) Provider {
	return &BraveProvider{
		BaseProvider: BaseProvider{
			name:     "brave",
			priority: 2,
		},
		apiKey: apiKey,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// IsConfigured returns whether the provider is configured
func (p *BraveProvider) IsConfigured() bool {
	return p.apiKey != ""
}

// Search performs a search using Brave Search
func (p *BraveProvider) Search(ctx context.Context, query string, limit int) ([]Result, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://api.search.brave.com/res/v1/web/search", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	q := req.URL.Query()
	q.Add("q", query)
	q.Add("count", fmt.Sprintf("%d", limit))
	req.URL.RawQuery = q.Encode()

	req.Header.Set("X-Subscription-Token", p.apiKey)
	req.Header.Set("Accept", "application/json")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API returned status %d", resp.StatusCode)
	}

	var apiResponse struct {
		Web struct {
			Results []struct {
				Title       string `json:"title"`
				URL         string `json:"url"`
				Description string `json:"description"`
			} `json:"results"`
		} `json:"web"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&apiResponse); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	results := make([]Result, 0, len(apiResponse.Web.Results))
	for _, item := range apiResponse.Web.Results {
		results = append(results, Result{
			Title:     item.Title,
			URL:       item.URL,
			Snippet:   item.Description,
			Provider:  p.name,
			Timestamp: time.Now().Format(time.RFC3339),
		})
	}

	return results, nil
}

// HealthCheck performs a health check on the Brave Search API
func (p *BraveProvider) HealthCheck(ctx context.Context) error {
	if !p.IsConfigured() {
		return fmt.Errorf("not configured")
	}

	req, err := http.NewRequestWithContext(ctx, "GET", "https://api.search.brave.com/res/v1/web/search", nil)
	if err != nil {
		return fmt.Errorf("failed to create health check request: %w", err)
	}

	q := req.URL.Query()
	q.Add("q", "test")
	q.Add("count", "1")
	req.URL.RawQuery = q.Encode()

	req.Header.Set("X-Subscription-Token", p.apiKey)
	req.Header.Set("Accept", "application/json")

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