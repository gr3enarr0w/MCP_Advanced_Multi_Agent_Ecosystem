package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gr3enarr0w/mcp-ecosystem/nanogpt-proxy/backends"
	"github.com/gr3enarr0w/mcp-ecosystem/nanogpt-proxy/storage"
)

// ChatHandler handles chat completion requests
type ChatHandler struct {
	nanogptBackend *backends.NanoGPTBackend
	vertexBackend  *backends.VertexBackend
	activeProfile  string
	usageTracker   *storage.UsageTracker
}

// NewChatHandler creates a new chat handler
func NewChatHandler(
	nanogpt *backends.NanoGPTBackend,
	vertex *backends.VertexBackend,
	activeProfile string,
	tracker *storage.UsageTracker,
) *ChatHandler {
	return &ChatHandler{
		nanogptBackend: nanogpt,
		vertexBackend:  vertex,
		activeProfile:  activeProfile,
		usageTracker:   tracker,
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
