package backends

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// NanoGPTBackend implements the Backend interface for NanoGPT API
type NanoGPTBackend struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client
	quota      int
	used       int
}

// NewNanoGPTBackend creates a new NanoGPT backend
func NewNanoGPTBackend(apiKey, baseURL string, quota int) *NanoGPTBackend {
	return &NanoGPTBackend{
		apiKey:  apiKey,
		baseURL: baseURL,
		quota:   quota,
		used:    0,
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

// ChatCompletion sends a chat completion request to NanoGPT
func (n *NanoGPTBackend) ChatCompletion(ctx context.Context, req ChatRequest) (*ChatResponse, error) {
	// Build request body
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Create HTTP request
	httpReq, err := http.NewRequestWithContext(ctx, "POST", n.baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Authorization", "Bearer "+n.apiKey)
	httpReq.Header.Set("Content-Type", "application/json")

	// Send request
	resp, err := n.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	// Check status code
	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("nanogpt returned status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	// Parse response
	var chatResp ChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&chatResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	// Track usage
	n.used += chatResp.Usage.TotalTokens

	return &chatResp, nil
}

// ListModels returns available models from NanoGPT
func (n *NanoGPTBackend) ListModels(ctx context.Context) ([]Model, error) {
	httpReq, err := http.NewRequestWithContext(ctx, "GET", n.baseURL+"/models", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Authorization", "Bearer "+n.apiKey)

	resp, err := n.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("nanogpt returned status %d", resp.StatusCode)
	}

	var result struct {
		Data []Model `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return result.Data, nil
}

// Name returns the backend name
func (n *NanoGPTBackend) Name() string {
	return "nanogpt"
}

// Tier returns the backend tier
func (n *NanoGPTBackend) Tier() string {
	return "free"
}

// HasModel checks if a model is available
func (n *NanoGPTBackend) HasModel(modelID string) bool {
	// NanoGPT supports multiple models - check via API or cache
	// For now, assume common models are available
	supportedModels := map[string]bool{
		"claude-3.5-sonnet":   true,
		"claude-3-opus":       true,
		"gpt-4o":              true,
		"gpt-4-turbo":         true,
		"gemini-2.0-flash":    true,
		"gemini-2.5-pro":      true,
		"qwen-2.5-72b":        true,
		"deepseek-chat":       true,
		"auto":                true, // Let NanoGPT choose
	}
	return supportedModels[modelID]
}

// GetUsage returns current usage statistics
func (n *NanoGPTBackend) GetUsage() (*Usage, error) {
	now := time.Now()
	// Reset on the 1st of each month
	resetDate := time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, now.Location())

	return &Usage{
		TokensUsed:      n.used,
		TokensRemaining: n.quota - n.used,
		TokensLimit:     n.quota,
		ResetDate:       resetDate,
	}, nil
}
