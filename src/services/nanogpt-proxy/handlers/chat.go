package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gr3enarr0w/mcp-ecosystem/nanogpt-proxy/backends"
	"github.com/gr3enarr0w/mcp-ecosystem/nanogpt-proxy/promptengineer"
	"github.com/gr3enarr0w/mcp-ecosystem/nanogpt-proxy/storage"
)

// ChatHandler handles chat completion requests
type ChatHandler struct {
	nanogptBackend backends.Backend
	vertexBackend  backends.Backend
	activeProfile  string
	usageTracker   *storage.UsageTracker
	promptEngineer *promptengineer.PromptEngineer
}

// NewChatHandler creates a new chat handler
func NewChatHandler(
	nanogpt backends.Backend,
	vertex backends.Backend,
	activeProfile string,
	tracker *storage.UsageTracker,
	engineer *promptengineer.PromptEngineer,
) *ChatHandler {
	return &ChatHandler{
		nanogptBackend: nanogpt,
		vertexBackend:  vertex,
		activeProfile:  activeProfile,
		usageTracker:   tracker,
		promptEngineer: engineer,
	}
}

// HandleChatCompletion processes a chat completion request
func (h *ChatHandler) HandleChatCompletion(w http.ResponseWriter, r *http.Request) {
	startTime := time.Now()

	// Parse request
	var req backends.ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request: %v", err), http.StatusBadRequest)
		return
	}

	// Run prompt engineering when enabled and we have a role + user content
	var optimized *promptengineer.OptimizedPrompt
	if h.promptEngineer != nil && h.promptEngineer.IsEnabled() && req.Role != "" {
		// Find latest user message to optimize
		for i := len(req.Messages) - 1; i >= 0; i-- {
			if req.Messages[i].Role == "user" {
				result, err := h.promptEngineer.Optimize(r.Context(), req.Messages[i].Content, req.Role)
				if err != nil {
					log.Printf("[WARN] Prompt engineering failed (role=%s): %v", req.Role, err)
					break
				}
				optimized = result
				req.Messages[i].Content = result.Optimized
				log.Printf("[INFO] Prompt optimized for role=%s using strategy=%s", req.Role, result.StrategyUsed)
				break
			}
		}
	}

	// Select backend based on profile
	backend := h.selectBackend(r, req)

	log.Printf("[INFO] Processing chat request - Backend: %s, Model: %s, Role: %s",
		backend.Name(), req.Model, req.Role)

	// Forward request to backend
	resp, err := backend.ChatCompletion(r.Context(), req)
	if err != nil {
		log.Printf("[ERROR] Backend request failed: %v", err)
		http.Error(w, fmt.Sprintf("Backend error: %v", err), http.StatusInternalServerError)
		return
	}

	// Add proxy metadata
	resp.XProxyMetadata = &backends.ProxyMetadata{
		Backend:       backend.Name(),
		ModelSelected: resp.Model,
	}
	if optimized != nil {
		resp.XProxyMetadata.OriginalPromptLength = len(optimized.Original)
		resp.XProxyMetadata.OptimizedPromptLength = len(optimized.Optimized)
		resp.XProxyMetadata.PromptEngineerTimeMs = optimized.OptimizationTime.Milliseconds()
		resp.XProxyMetadata.StrategyUsed = optimized.StrategyUsed
	}

	// Track usage
	responseTime := time.Since(startTime).Milliseconds()
	if err := h.trackUsage(backend.Name(), req, resp, responseTime); err != nil {
		log.Printf("[WARN] Failed to track usage: %v", err)
	}

	// Send response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)

	log.Printf("[INFO] Request completed in %dms - Tokens: %d",
		responseTime, resp.Usage.TotalTokens)
}

// selectBackend chooses which backend to use
func (h *ChatHandler) selectBackend(r *http.Request, req backends.ChatRequest) backends.Backend {
	// Check for profile override in headers
	if profile := r.Header.Get("X-Profile"); profile != "" {
		if profile == "work" && h.vertexBackend != nil {
			return h.vertexBackend
		}
		if profile == "personal" && h.nanogptBackend != nil {
			return h.nanogptBackend
		}
	}

	// Use configured active profile
	if h.activeProfile == "work" && h.vertexBackend != nil {
		return h.vertexBackend
	}

	// Default to NanoGPT (personal)
	if h.nanogptBackend != nil {
		return h.nanogptBackend
	}

	// Fallback to Vertex if NanoGPT not available
	return h.vertexBackend
}

// trackUsage records the request in the database
func (h *ChatHandler) trackUsage(
	backend string,
	req backends.ChatRequest,
	resp *backends.ChatResponse,
	responseTimeMs int64,
) error {
	if h.usageTracker == nil {
		return nil
	}

	record := storage.UsageRecord{
		Timestamp:        time.Now(),
		Backend:          backend,
		Model:            resp.Model,
		Role:             req.Role,
		ConversationID:   req.ConversationID,
		PromptTokens:     resp.Usage.PromptTokens,
		CompletionTokens: resp.Usage.CompletionTokens,
		TotalTokens:      resp.Usage.TotalTokens,
		ResponseTimeMs:   responseTimeMs,
	}

	return h.usageTracker.RecordUsage(record)
}
