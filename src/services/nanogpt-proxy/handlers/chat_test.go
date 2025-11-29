package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/gr3enarr0w/mcp-ecosystem/nanogpt-proxy/backends"
	"github.com/gr3enarr0w/mcp-ecosystem/nanogpt-proxy/promptengineer"
)

// mockBackend records the last request and returns a static response.
type mockBackend struct {
	name    string
	lastReq backends.ChatRequest
}

func (m *mockBackend) ChatCompletion(_ context.Context, req backends.ChatRequest) (*backends.ChatResponse, error) {
	m.lastReq = req
	return &backends.ChatResponse{
		ID:      "resp_123",
		Object:  "chat.completion",
		Created: time.Now().Unix(),
		Model:   "test-model",
		Choices: []backends.Choice{{
			Index: 0,
			Message: backends.ChatMessage{
				Role:    "assistant",
				Content: "final answer",
			},
			FinishReason: "stop",
		}},
		Usage: backends.TokenUsage{
			PromptTokens:     5,
			CompletionTokens: 7,
			TotalTokens:      12,
		},
	}, nil
}

func (m *mockBackend) ListModels(_ context.Context) ([]backends.Model, error) { return nil, nil }
func (m *mockBackend) Name() string                                           { return m.name }
func (m *mockBackend) Tier() string                                           { return "test" }
func (m *mockBackend) HasModel(string) bool                                   { return true }
func (m *mockBackend) GetUsage() (*backends.Usage, error)                     { return nil, nil }

// Test prompt engineering path wires optimized prompt and metadata.
func TestHandleChatCompletion_WithPromptEngineering(t *testing.T) {
	optimizerBackend := &mockBackend{name: "optimizer"}
	tmpDir := t.TempDir()
	strategyPath := filepath.Join(tmpDir, "strategies.yaml")
	strategyFile := `
strategies:
  architect:
    system_prompt: "be a great architect"
    techniques: ["rewrite"]
    constraints: ["concise"]
`
	if err := os.WriteFile(strategyPath, []byte(strategyFile), 0644); err != nil {
		t.Fatalf("failed to write strategy file: %v", err)
	}

	promptEngineer, err := promptengineer.NewPromptEngineer(optimizerBackend, strategyPath)
	if err != nil {
		t.Fatalf("failed to create prompt engineer: %v", err)
	}

	inferenceBackend := &mockBackend{name: "nanogpt"}
	handler := NewChatHandler(inferenceBackend, nil, "personal", nil, promptEngineer)

	reqBody := backends.ChatRequest{
		Model: "auto",
		Messages: []backends.ChatMessage{
			{Role: "system", Content: "You are helpful."},
			{Role: "user", Content: "raw prompt"},
		},
		Role: "architect",
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", bytes.NewReader(body))
	w := httptest.NewRecorder()

	handler.HandleChatCompletion(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", w.Code)
	}

	if inferenceBackend.lastReq.Messages[len(inferenceBackend.lastReq.Messages)-1].Content == "raw prompt" {
		t.Fatalf("expected optimized prompt to be forwarded to backend")
	}

	var resp backends.ChatResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if resp.XProxyMetadata == nil {
		t.Fatalf("expected proxy metadata to be populated")
	}
	if resp.XProxyMetadata.OriginalPromptLength == 0 || resp.XProxyMetadata.OptimizedPromptLength == 0 {
		t.Fatalf("expected prompt lengths to be set in metadata")
	}
	if resp.XProxyMetadata.StrategyUsed != "architect" {
		t.Fatalf("unexpected strategy used: %s", resp.XProxyMetadata.StrategyUsed)
	}
	if resp.XProxyMetadata.PromptEngineerTimeMs < 0 {
		t.Fatalf("expected prompt engineer time to be non-negative")
	}
}

// Test when no role is provided: optimizer is skipped and metadata is nil.
func TestHandleChatCompletion_NoRoleSkipsOptimization(t *testing.T) {
	inferenceBackend := &mockBackend{name: "nanogpt"}
	handler := NewChatHandler(inferenceBackend, nil, "personal", nil, nil)

	reqBody := backends.ChatRequest{
		Model: "auto",
		Messages: []backends.ChatMessage{
			{Role: "user", Content: "plain prompt"},
		},
		Role: "",
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", bytes.NewReader(body))
	w := httptest.NewRecorder()

	handler.HandleChatCompletion(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", w.Code)
	}
	if inferenceBackend.lastReq.Messages[0].Content != "plain prompt" {
		t.Fatalf("expected prompt to remain unchanged when no role is provided")
	}

	var resp backends.ChatResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp.XProxyMetadata != nil && resp.XProxyMetadata.OriginalPromptLength != 0 {
		t.Fatalf("expected no prompt-engineering metadata when optimization is skipped")
	}
}

// Test when role is provided but strategy missing: prompt unchanged, metadata reflects fallback.
func TestHandleChatCompletion_MissingStrategy(t *testing.T) {
	optimizerBackend := &mockBackend{name: "optimizer"}
	tmpDir := t.TempDir()
	strategyPath := filepath.Join(tmpDir, "strategies.yaml")
	if err := os.WriteFile(strategyPath, []byte("strategies: {}"), 0644); err != nil {
		t.Fatalf("failed to write strategy file: %v", err)
	}
	promptEngineer, err := promptengineer.NewPromptEngineer(optimizerBackend, strategyPath)
	if err != nil {
		t.Fatalf("failed to create prompt engineer: %v", err)
	}
	inferenceBackend := &mockBackend{name: "nanogpt"}
	handler := NewChatHandler(inferenceBackend, nil, "personal", nil, promptEngineer)

	reqBody := backends.ChatRequest{
		Model: "auto",
		Messages: []backends.ChatMessage{
			{Role: "user", Content: "keep me"},
		},
		Role: "unknown-role",
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", bytes.NewReader(body))
	w := httptest.NewRecorder()

	handler.HandleChatCompletion(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", w.Code)
	}
	if inferenceBackend.lastReq.Messages[0].Content != "keep me" {
		t.Fatalf("expected prompt to remain unchanged when strategy is missing")
	}

	var resp backends.ChatResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp.XProxyMetadata == nil {
		t.Fatalf("expected proxy metadata even when strategy is missing")
	}
	if resp.XProxyMetadata.StrategyUsed != "none" {
		t.Fatalf("expected strategy 'none' when strategy is missing, got %s", resp.XProxyMetadata.StrategyUsed)
	}
	if resp.XProxyMetadata.OriginalPromptLength != resp.XProxyMetadata.OptimizedPromptLength {
		t.Fatalf("expected prompt lengths to match when no optimization happened")
	}
}
