package routing

import (
	"fmt"
	"log"
	"time"

	"github.com/gr3enarr0w/mcp-ecosystem/nanogpt-proxy/backends"
	"github.com/gr3enarr0w/mcp-ecosystem/nanogpt-proxy/subscription"
)

// ModelRouter selects the best model for each role
type ModelRouter struct {
	rankings     *ModelRankings
	backends     map[string]backends.Backend
	subscription *subscription.Manager
}

// ModelSelection represents the result of model selection
type ModelSelection struct {
	ModelID  string
	Backend  string
	Reason   string
	Fallback bool
}

// NewModelRouter creates a new model router
func NewModelRouter(rankingsPath string, backendMap map[string]backends.Backend) (*ModelRouter, error) {
	return NewModelRouterWithSubscription(rankingsPath, backendMap, "", 0)
}

// NewModelRouterWithSubscription creates a new model router with subscription service
func NewModelRouterWithSubscription(rankingsPath string, backendMap map[string]backends.Backend, subscriptionBaseURL string, subscriptionTTLSeconds int) (*ModelRouter, error) {
	rankings, err := LoadRankings(rankingsPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load rankings: %w", err)
	}

	var subMgr *subscription.Manager
	if subscriptionBaseURL != "" {
		ttl := time.Duration(subscriptionTTLSeconds) * time.Second
		if ttl <= 0 {
			ttl = 2 * time.Minute // Use same default as subscription package
		}
		subMgr = subscription.NewManager(subscriptionBaseURL, subscription.WithCacheTTL(ttl))
		log.Printf("[ROUTER] Subscription service initialized with URL: %s, TTL: %v", subscriptionBaseURL, ttl)
	} else {
		log.Println("[ROUTER] Subscription service disabled (no base URL provided)")
	}

	return &ModelRouter{
		rankings:     rankings,
		backends:     backendMap,
		subscription: subMgr,
	}, nil
}

// SelectForRole chooses the best model for a given role
func (mr *ModelRouter) SelectForRole(role, profile string) *ModelSelection {
	// First, try subscription service if available
	if mr.subscription != nil {
		if subSel, err := mr.subscription.GetNextModel(role); err == nil && subSel != nil {
			// Check if the selected subscription model is available in the requested backend
			if backend, ok := mr.backends[profile]; ok && backend != nil && backend.HasModel(subSel.Model.ID) {
				// Mark the model as exhausted immediately to prevent reuse
				mr.subscription.MarkExhausted(subSel.Model.ID)
				log.Printf("[ROUTER] Selected subscription model '%s' for role '%s' via profile '%s'", subSel.Model.ID, role, profile)
				return &ModelSelection{
					ModelID:  subSel.Model.ID,
					Backend:  profile,
					Reason:   "subscription model selected",
					Fallback: false,
				}
			}
			// If the backend doesn't have the model, mark it exhausted and continue
			mr.subscription.MarkExhausted(subSel.Model.ID)
			log.Printf("[ROUTER] Subscription model '%s' not available in backend '%s', marked exhausted", subSel.Model.ID, profile)
		} else if err != nil {
			log.Printf("[ROUTER] Subscription service error for role '%s': %v, continuing with fallback logic", role, err)
		} else {
			log.Printf("[ROUTER] No subscription models available for role '%s', continuing with fallback logic", role)
		}
	}

	// Get role preferences from rankings
	roleRanking := mr.rankings.GetRole(role)
	if roleRanking == nil {
		// Default to general role
		log.Printf("[WARN] No ranking for role '%s', using general", role)
		roleRanking = mr.rankings.GetRole("general")
	}

	if roleRanking == nil {
		// Ultimate fallback
		return &ModelSelection{
			ModelID:  "auto",
			Backend:  "nanogpt",
			Reason:   "no rankings available",
			Fallback: true,
		}
	}

	// Get backend for profile
	backend, ok := mr.backends[profile]
	if !ok {
		log.Printf("[WARN] Unknown profile '%s', defaulting to nanogpt", profile)
		backend = mr.backends["nanogpt"]
		profile = "nanogpt"
	}

	if backend == nil {
		log.Printf("[ERROR] No backend available for profile '%s'", profile)
		return &ModelSelection{
			ModelID:  "auto",
			Backend:  "nanogpt",
			Reason:   "no backend available",
			Fallback: true,
		}
	}

	// Try primary model first
	if backend.HasModel(roleRanking.Primary.Model) {
		return &ModelSelection{
			ModelID:  roleRanking.Primary.Model,
			Backend:  profile,
			Reason:   roleRanking.Primary.Reason,
			Fallback: false,
		}
	}

	// Try fallback models
	for _, fallbackModel := range roleRanking.Fallback {
		if backend.HasModel(fallbackModel) {
			return &ModelSelection{
				ModelID:  fallbackModel,
				Backend:  profile,
				Reason:   "primary unavailable, using fallback",
				Fallback: true,
			}
		}
	}

	// Use subscription alternative (for free tier)
	if roleRanking.SubscriptionAlternative != "" && backend.HasModel(roleRanking.SubscriptionAlternative) {
		return &ModelSelection{
			ModelID:  roleRanking.SubscriptionAlternative,
			Backend:  profile,
			Reason:   "using free tier alternative",
			Fallback: true,
		}
	}

	// Final fallback: let backend choose
	return &ModelSelection{
		ModelID:  "auto",
		Backend:  profile,
		Reason:   "no suitable model found, letting backend choose",
		Fallback: true,
	}
}

// GetModelInfo returns detailed information about a model
func (mr *ModelRouter) GetModelInfo(modelID string) *ModelInfo {
	for _, roleRanking := range mr.rankings.Roles {
		if roleRanking.Primary.Model == modelID {
			return &roleRanking.Primary
		}
	}
	return nil
}

// ListModelsForRole returns all models suitable for a role
func (mr *ModelRouter) ListModelsForRole(role string) []string {
	roleRanking := mr.rankings.GetRole(role)
	if roleRanking == nil {
		return []string{}
	}

	models := []string{roleRanking.Primary.Model}
	models = append(models, roleRanking.Fallback...)
	if roleRanking.SubscriptionAlternative != "" {
		models = append(models, roleRanking.SubscriptionAlternative)
	}

	return models
}
