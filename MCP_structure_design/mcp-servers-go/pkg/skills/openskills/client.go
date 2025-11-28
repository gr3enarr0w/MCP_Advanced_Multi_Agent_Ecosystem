// Package openskills provides integration with the OpenSkills API
package openskills

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// Client represents an OpenSkills API client
type Client struct {
	apiKey     string
	httpClient *http.Client
	baseURL    string
}

// NewClient creates a new OpenSkills client
func NewClient(apiKey string) *Client {
	return &Client{
		apiKey: apiKey,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		baseURL: "https://api.openskills.org/v1",
	}
}

// Skill represents an OpenSkills skill
type Skill struct {
	ID            string   `json:"id"`
	Name          string   `json:"name"`
	Category      string   `json:"category"`
	Subcategory   string   `json:"subcategory"`
	Description   string   `json:"description"`
	Prerequisites []string `json:"prerequisites"`
	RelatedSkills []string `json:"related_skills"`
	LearningPath  []string `json:"learning_path"`
	Resources     []Resource `json:"resources"`
	MarketDemand  string   `json:"market_demand"`
	EstimatedHours int      `json:"estimated_hours"`
}

// Resource represents a learning resource
type Resource struct {
	Title       string `json:"title"`
	Type        string `json:"type"`
	URL         string `json:"url"`
	Description string `json:"description"`
}

// SearchResult represents search results
type SearchResult struct {
	Skills []Skill `json:"skills"`
	Total  int     `json:"total"`
}

// Search searches for skills
func (c *Client) Search(ctx context.Context, query string, limit int) ([]Skill, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", fmt.Sprintf("%s/skills/search", c.baseURL), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	q := req.URL.Query()
	q.Add("q", query)
	q.Add("limit", fmt.Sprintf("%d", limit))
	req.URL.RawQuery = q.Encode()

	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API returned status %d", resp.StatusCode)
	}

	var result SearchResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return result.Skills, nil
}

// GetSkill retrieves a specific skill
func (c *Client) GetSkill(ctx context.Context, skillID string) (*Skill, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", fmt.Sprintf("%s/skills/%s", c.baseURL, skillID), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil // Skill not found
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API returned status %d", resp.StatusCode)
	}

	var skill Skill
	if err := json.NewDecoder(resp.Body).Decode(&skill); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &skill, nil
}

// GetLearningPath retrieves a recommended learning path for a skill
func (c *Client) GetLearningPath(ctx context.Context, skillID string, currentSkills []string) ([]string, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", fmt.Sprintf("%s/skills/%s/learning-path", c.baseURL, skillID), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	q := req.URL.Query()
	for _, skill := range currentSkills {
		q.Add("current_skill", skill)
	}
	req.URL.RawQuery = q.Encode()

	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API returned status %d", resp.StatusCode)
	}

	var path struct {
		Steps []string `json:"steps"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&path); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return path.Steps, nil
}

// HealthCheck performs a health check on the API
func (c *Client) HealthCheck(ctx context.Context) error {
	if c.apiKey == "" {
		return fmt.Errorf("API key not configured")
	}

	req, err := http.NewRequestWithContext(ctx, "GET", fmt.Sprintf("%s/health", c.baseURL), nil)
	if err != nil {
		return fmt.Errorf("failed to create health check request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Accept", "application/json")

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