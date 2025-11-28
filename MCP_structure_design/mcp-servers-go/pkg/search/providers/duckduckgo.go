package providers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// DuckDuckGoProvider implements the DuckDuckGo search provider
type DuckDuckGoProvider struct {
	BaseProvider
	client *http.Client
}

// NewDuckDuckGoProvider creates a new DuckDuckGo provider
func NewDuckDuckGoProvider() Provider {
	return &DuckDuckGoProvider{
		BaseProvider: BaseProvider{
			name:     "duckduckgo",
			priority: 4, // Lowest priority (fallback)
		},
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// IsConfigured returns whether the provider is configured (always true for DuckDuckGo)
func (p *DuckDuckGoProvider) IsConfigured() bool {
	return true // No API key required
}

// Search performs a search using DuckDuckGo Instant Answer API
func (p *DuckDuckGoProvider) Search(ctx context.Context, query string, limit int) ([]Result, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://api.duckduckgo.com/", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	q := req.URL.Query()
	q.Add("q", query)
	q.Add("format", "json")
	q.Add("no_html", "1")
	q.Add("skip_disambig", "1")
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
		AbstractText string `json:"AbstractText"`
		AbstractURL  string `json:"AbstractURL"`
		Heading      string `json:"Heading"`
		RelatedTopics []struct {
			Text      string `json:"Text"`
			FirstURL  string `json:"FirstURL"`
		} `json:"RelatedTopics"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&apiResponse); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	var results []Result

	// Add abstract result if available
	if apiResponse.AbstractText != "" && apiResponse.AbstractURL != "" {
		results = append(results, Result{
			Title:     apiResponse.Heading,
			URL:       apiResponse.AbstractURL,
			Snippet:   apiResponse.AbstractText,
			Provider:  p.name,
			Timestamp: time.Now().Format(time.RFC3339),
		})
	}

	// Add related topics
	for i, topic := range apiResponse.RelatedTopics {
		if i >= limit-len(results) {
			break
		}
		if topic.Text != "" && topic.FirstURL != "" {
			// Extract title from text (before hyphen if present)
			title := topic.Text
			if idx := strings.Index(topic.Text, " - "); idx > 0 {
				title = topic.Text[:idx]
			}

			results = append(results, Result{
				Title:     title,
				URL:       topic.FirstURL,
				Snippet:   topic.Text,
				Provider:  p.name,
				Timestamp: time.Now().Format(time.RFC3339),
			})
		}
	}

	return results, nil
}

// HealthCheck performs a health check on the DuckDuckGo API
func (p *DuckDuckGoProvider) HealthCheck(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://api.duckduckgo.com/", nil)
	if err != nil {
		return fmt.Errorf("failed to create health check request: %w", err)
	}

	q := req.URL.Query()
	q.Add("q", "test")
	q.Add("format", "json")
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