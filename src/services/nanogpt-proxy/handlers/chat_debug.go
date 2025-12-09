package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gr3enarr0w/mcp-ecosystem/nanogpt-proxy/backends"
	"github.com/gr3enarr0w/mcp-ecosystem/nanogpt-proxy/promptengineer"
	"github.com/gr3enarr0w/mcp-ecosystem/nanogpt-proxy/routing"
	"github.com/gr3enarr0w/mcp-ecosystem/nanogpt-proxy/storage"
)

// ChatHandlerDebug handles chat completion requests with enhanced diagnostic logging
type ChatHandlerDebug struct {
	nanogptBackend backends.Backend
	vertexBackend  backends.Backend
	activeProfile  string
	usageTracker   *storage.UsageTracker
	promptEngineer *promptengineer.PromptEngineer
	modelRouter    *routing.ModelRouter
}

// NewChatHandlerDebug creates a new chat handler with debug logging
func NewChatHandlerDebug(
	nanogpt backends.Backend,
	vertex backends.Backend,
	activeProfile string,
	tracker *storage.UsageTracker,
	engineer *promptengineer.PromptEngineer,
	modelRouter *routing.ModelRouter,
) *ChatHandlerDebug {
	return &ChatHandlerDebug{
		nanogptBackend: nanogpt,
		vertexBackend:  vertex,
		activeProfile:  activeProfile,
		usageTracker:   tracker,
		promptEngineer: engineer,
		modelRouter:    modelRouter,
	}
}

// HandleChatCompletion processes a chat completion request with enhanced diagnostics
func (h *ChatHandlerDebug) HandleChatCompletion(w http.ResponseWriter, r *http.Request) {
	startTime := time.Now()

	// Parse request
	var req backends.ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request: %v", err), http.StatusBadRequest)
		return
	}

	log.Printf("[DIAGNOSTIC] === CHAT REQUEST START ===")
	log.Printf("[DIAGNOSTIC] Request - Role: %s, Model: %s, Profile: %s", 
		req.Role, req.Model, h.activeProfile)

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

	// Select backend using enhanced diagnostic logic
	backend := h.selectBackendWithDiagnostics(r, req)

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
	log.Printf("[DIAGNOSTIC] === CHAT REQUEST END ===")
}

// selectBackendWithDiagnostics chooses which backend to use with enhanced logging
func (h *ChatHandlerDebug) selectBackendWithDiagnostics(r *http.Request, req backends.ChatRequest) backends.Backend {
	// Check for profile override in headers
	profile := h.activeProfile
	if headerProfile := r.Header.Get("X-Profile"); headerProfile != "" {
		profile = headerProfile
	}

	// Normalize profile names
	if profile == "work" {
		profile = "vertex"
	} else if profile == "personal" {
		profile = "nanogpt"
	}

	log.Printf("[DEBUG] selectBackend called - Role: %s, Profile: %s, ModelRouter available: %t",
		req.Role, profile, h.modelRouter != nil)

	// CRITICAL DIAGNOSTIC: Check if ModelRouter is actually being used
	if h.modelRouter == nil {
		log.Printf("[CRITICAL] ModelRouter is nil - subscription-first routing disabled!")
	} else {
		log.Printf("[DEBUG] ModelRouter is available - attempting subscription-first routing")
	}

	// Use ModelRouter for subscription-first routing if available
	if h.modelRouter != nil {
		log.Printf("[DEBUG] Calling ModelRouter.SelectForRole for role '%s' with profile '%s'", req.Role, profile)
		selection := h.modelRouter.SelectForRole(req.Role, profile)
		log.Printf("[INFO] ModelRouter selected backend '%s' with model '%s' for role '%s' (reason: %s, fallback: %t)",
			selection.Backend, selection.ModelID, req.Role, selection.Reason, selection.Fallback)
		
		// DIAGNOSTIC: Check if subscription routing was actually used
		if strings.Contains(selection.Reason, "subscription") {
			log.Printf("[DIAGNOSTIC] ✓ Subscription-first routing WORKING - reason: %s", selection.Reason)
		} else {
			log.Printf("[DIAGNOSTIC] ✗ Subscription-first routing NOT WORKING - fallback reason: %s", selection.Reason)
		}
		
		// Check if selected backend is available
		var selectedBackend backends.Backend
		if selection.Backend == "vertex" {
			selectedBackend = h.vertexBackend
			log.Printf("[DEBUG] Selected vertex backend, available: %t", h.vertexBackend != nil)
		} else if selection.Backend == "nanogpt" {
			selectedBackend = h.nanogptBackend
			log.Printf("[DEBUG] Selected nanogpt backend, available: %t", h.nanogptBackend != nil)
		} else {
			log.Printf("[WARN] Unknown backend '%s' selected, falling back", selection.Backend)
		}
		
		// Verify backend has the requested model
		if selectedBackend != nil {
			if selection.ModelID != "auto" {
				hasModel := selectedBackend.HasModel(selection.ModelID)
				log.Printf("[DEBUG] Backend %s has model %s: %t", selection.Backend, selection.ModelID, hasModel)
				if !hasModel {
					log.Printf("[WARN] Selected backend %s does not have model %s, falling back", selection.Backend, selection.ModelID)
				} else {
					log.Printf("[INFO] Successfully selected backend %s with model %s for role %s",
						selection.Backend, selection.ModelID, req.Role)
					return selectedBackend
				}
			} else {
				log.Printf("[INFO] Successfully selected backend %s with auto model selection for role %s",
					selection.Backend, req.Role)
				return selectedBackend
			}
		} else {
			log.Printf("[WARN] Selected backend %s is not available, falling back", selection.Backend)
		}
	} else {
		log.Printf("[DEBUG] ModelRouter not available, using fallback logic")
	}

	// Fallback to simple profile-based routing if ModelRouter fails
	log.Printf("[DEBUG] Using fallback profile-based routing for profile: %s", profile)
	if profile == "vertex" && h.vertexBackend != nil {
		log.Printf("[DEBUG] Returning vertex backend as fallback")
		return h.vertexBackend
	}

	// Default to NanoGPT (personal)
	if h.nanogptBackend != nil {
		log.Printf("[DEBUG] Returning nanogpt backend as default")
		return h.nanogptBackend
	}

	// Final fallback to Vertex if NanoGPT not available
	log.Printf("[DEBUG] Final fallback to vertex backend")
	return h.vertexBackend
}

// trackUsage records the request in the database
func (h *ChatHandlerDebug) trackUsage(
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