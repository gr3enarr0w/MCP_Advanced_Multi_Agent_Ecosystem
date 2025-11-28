package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/gr3enarr0w/mcp-ecosystem/nanogpt-proxy/backends"
)

// ModelsHandler handles model listing requests
type ModelsHandler struct {
	nanogptBackend *backends.NanoGPTBackend
	vertexBackend  *backends.VertexBackend
}

// NewModelsHandler creates a new models handler
func NewModelsHandler(
	nanogpt *backends.NanoGPTBackend,
	vertex *backends.VertexBackend,
) *ModelsHandler {
	return &ModelsHandler{
		nanogptBackend: nanogpt,
		vertexBackend:  vertex,
	}
}

// HandleListModels returns a list of available models
func (h *ModelsHandler) HandleListModels(w http.ResponseWriter, r *http.Request) {
	var allModels []backends.Model

	// Get models from NanoGPT
	if h.nanogptBackend != nil {
		models, err := h.nanogptBackend.ListModels(r.Context())
		if err != nil {
			log.Printf("[WARN] Failed to get NanoGPT models: %v", err)
		} else {
			allModels = append(allModels, models...)
		}
	}

	// Get models from Vertex AI
	if h.vertexBackend != nil {
		models, err := h.vertexBackend.ListModels(r.Context())
		if err != nil {
			log.Printf("[WARN] Failed to get Vertex models: %v", err)
		} else {
			allModels = append(allModels, models...)
		}
	}

	// Return OpenAI-compatible response
	response := map[string]interface{}{
		"object": "list",
		"data":   allModels,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// HandleGetModel returns details about a specific model
func (h *ModelsHandler) HandleGetModel(w http.ResponseWriter, r *http.Request) {
	// Extract model ID from URL path
	// This is a placeholder - actual implementation depends on router
	modelID := r.URL.Path[len("/v1/models/"):]

	// Check if model exists in backends
	var model *backends.Model

	if h.nanogptBackend != nil && h.nanogptBackend.HasModel(modelID) {
		models, _ := h.nanogptBackend.ListModels(r.Context())
		for _, m := range models {
			if m.ID == modelID {
				model = &m
				break
			}
		}
	}

	if model == nil && h.vertexBackend != nil && h.vertexBackend.HasModel(modelID) {
		models, _ := h.vertexBackend.ListModels(r.Context())
		for _, m := range models {
			if m.ID == modelID {
				model = &m
				break
			}
		}
	}

	if model == nil {
		http.Error(w, "Model not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(model)
}
