package providers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// GoogleProvider implements the Google Custom Search provider
type GoogleProvider struct {
	BaseProvider
	apiKey string
	cx     string
	client *http.Client
}

// NewGoogleProvider creates a new Google Search provider
func NewGoogleProvider(apiKey, cx string) Provider {
	return &GoogleProvider{
		BaseProvider: BaseProvider{
			name:     "google",
			priority: 3,
		},
		apiKey: apiKey,
		cx:     cx,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// IsConfigured returns whether the provider is configured
func (p *GoogleProvider) IsConfigured() bool {
	return p.apiKey != "" && p.cx != ""
}

// Search performs a search using Google Custom Search API
func (p *GoogleProvider) Search(ctx context.Context, query string, limit int) ([]Result, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://www.googleapis.com/customsearch/v1", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	q := req.URL.Query()
	q.Add("key", p.apiKey)
	q.Add("cx", p.cx)
	q.Add("q", query)
	q.Add("num", fmt.Sprintf("%d", limit))
	req.URL.RawQuery = q.Encode()

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API returned status %d", resp.StatusCode)
	}

	var apiResponse struct {
		Items []struct {
			Title   string `json:"title"`
			Link    string `json:"link"`
			Snippet string `json:"snippet"`
		} `json:"items"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&apiResponse); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	results := make([]Result, 0, len(apiResponse.Items))
	for _, item := range apiResponse.Items {
		results = append(results, Result{
			Title:     item.Title,
			URL:       item.Link,
			Snippet:   item.Snippet,
			Provider:  p.name,
			Timestamp: time.Now().Format(time.RFC3339),
		})
	}

	return results, nil
}

// HealthCheck performs a health check on the Google Search API
func (p *GoogleProvider) HealthCheck(ctx context.Context) error {
	if !p.IsConfigured() {
		return fmt.Errorf("not configured")
	}

	req, err := http.NewRequestWithContext(ctx, "GET", "https://www.googleapis.com/customsearch/v1", nil)
	if err != nil {
		return fmt.Errorf("failed to create health check request: %w", err)
	}

	q := req.URL.Query()
	q.Add("key", p.apiKey)
	q.Add("cx", p.cx)
	q.Add("q", "test")
	q.Add("num", "1")
	req.URL.RawQuery = q.Encode()

	resp, err := p.client.Do(req)
	if err != nil {
		return fmt.Errorf("health check request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("health check returned status %d", resp.StatusCode)
	}

	return nil
}