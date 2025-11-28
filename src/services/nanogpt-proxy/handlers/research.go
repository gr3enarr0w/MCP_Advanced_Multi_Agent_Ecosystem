package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/gr3enarr0w/mcp-ecosystem/nanogpt-proxy/research"
)

// ResearchHandler handles research-related API endpoints
type ResearchHandler struct {
	scheduler *research.Scheduler
	system    *research.ResearchSystem
}

// NewResearchHandler creates a new research handler
func NewResearchHandler(scheduler *research.Scheduler, system *research.ResearchSystem) *ResearchHandler {
	return &ResearchHandler{
		scheduler: scheduler,
		system:    system,
	}
}

// HandleTriggerResearch manually triggers research
func (h *ResearchHandler) HandleTriggerResearch(w http.ResponseWriter, r *http.Request) {
	log.Println("[API] Manual research trigger requested")

	// Run in background
	go func() {
		if err := h.scheduler.TriggerNow(); err != nil {
			log.Printf("[ERROR] Manual research failed: %v", err)
		}
	}()

	response := map[string]interface{}{
		"status":  "triggered",
		"message": "Monthly research started in background",
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(response)
}

// HandleResearchStatus returns current research status
func (h *ResearchHandler) HandleResearchStatus(w http.ResponseWriter, r *http.Request) {
	lastUpdate := h.system.GetLastResearchDate()

	response := map[string]interface{}{
		"last_update":    lastUpdate,
		"status":         "active",
		"next_scheduled": "1st of next month at 2 AM",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// HandleForceRefresh forces complete re-evaluation
func (h *ResearchHandler) HandleForceRefresh(w http.ResponseWriter, r *http.Request) {
	log.Println("[API] Force refresh requested")

	// Run in background
	go func() {
		if err := h.system.ForceRefresh(r.Context()); err != nil {
			log.Printf("[ERROR] Force refresh failed: %v", err)
		}
	}()

	response := map[string]interface{}{
		"status":  "triggered",
		"message": "Complete refresh started in background (re-evaluating all models)",
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(response)
}
