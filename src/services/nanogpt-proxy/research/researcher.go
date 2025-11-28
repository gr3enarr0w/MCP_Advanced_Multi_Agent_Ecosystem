package research

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/gr3enarr0w/mcp-ecosystem/nanogpt-proxy/routing"
)

// ResearchSystem coordinates monthly research and updates
type ResearchSystem struct {
	scraper        *BenchmarkScraper
	evaluator      *ModelEvaluator
	rankingsPath   string
	currentRankings *routing.ModelRankings
}

// NewResearchSystem creates a new research system
func NewResearchSystem(rankingsPath string) (*ResearchSystem, error) {
	// Load current rankings
	rankings, err := routing.LoadRankings(rankingsPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load current rankings: %w", err)
	}

	return &ResearchSystem{
		scraper:        NewBenchmarkScraper(),
		evaluator:      NewModelEvaluator(),
		rankingsPath:   rankingsPath,
		currentRankings: rankings,
	}, nil
}

// RunMonthlyResearch executes the full research pipeline
func (rs *ResearchSystem) RunMonthlyResearch(ctx context.Context) error {
	log.Println("[RESEARCH] Starting monthly model research...")
	startTime := time.Now()

	// Step 1: Scrape latest benchmarks
	log.Println("[RESEARCH] Step 1: Scraping benchmark data...")
	benchmarks, err := rs.scraper.FetchAllBenchmarks(ctx)
	if err != nil {
		return fmt.Errorf("failed to fetch benchmarks: %w", err)
	}
	log.Printf("[RESEARCH] ✓ Fetched benchmarks for %d models", len(benchmarks))

	// Step 2: Identify new models that haven't been evaluated
	log.Println("[RESEARCH] Step 2: Identifying new models...")
	newModels := rs.identifyNewModels(benchmarks)
	log.Printf("[RESEARCH] ✓ Found %d new models to evaluate", len(newModels))

	if len(newModels) == 0 {
		log.Println("[RESEARCH] No new models found. Rankings are up to date.")
		return nil
	}

	// Step 3: Evaluate new models for each role
	log.Println("[RESEARCH] Step 3: Evaluating models for each role...")
	updatedRankings := rs.currentRankings

	roles := []string{"architect", "implementation", "code_review", "debugging", "testing", "documentation", "research", "general"}

	for _, role := range roles {
		log.Printf("[RESEARCH] Evaluating models for role: %s", role)

		// Get all models (existing + new) for this role
		allModelsForRole := rs.getAllModelsForRole(benchmarks, role)

		// Rank models
		ranked := rs.evaluator.RankModelsForRole(allModelsForRole, role)

		if len(ranked) > 0 {
			// Update ranking for this role
			primaryModel := ranked[0]
			fallbackModels := rs.extractFallbackModels(ranked, 3)
			subscriptionAlt := rs.findSubscriptionAlternative(ranked)

			roleRanking := routing.RoleRanking{
				Primary: routing.ModelInfo{
					Model:      primaryModel.Name,
					Reason:     primaryModel.Reason,
					Benchmarks: primaryModel.Benchmarks,
				},
				Fallback:                fallbackModels,
				SubscriptionAlternative: subscriptionAlt,
			}

			updatedRankings.UpdateRoleRanking(role, roleRanking)
			log.Printf("[RESEARCH] ✓ Updated ranking for %s: primary=%s", role, primaryModel.Name)
		}
	}

	// Step 4: Save updated rankings
	log.Println("[RESEARCH] Step 4: Saving updated rankings...")
	if err := updatedRankings.Save(rs.rankingsPath); err != nil {
		return fmt.Errorf("failed to save rankings: %w", err)
	}
	log.Println("[RESEARCH] ✓ Rankings saved successfully")

	// Update current rankings
	rs.currentRankings = updatedRankings

	duration := time.Since(startTime)
	log.Printf("[RESEARCH] ✅ Monthly research completed in %v", duration)
	log.Printf("[RESEARCH] Summary: %d new models evaluated, %d roles updated", len(newModels), len(roles))

	return nil
}

// identifyNewModels finds models not in current rankings
func (rs *ResearchSystem) identifyNewModels(benchmarks map[string]*ModelBenchmark) []string {
	newModels := []string{}

	// Build set of models in current rankings
	knownModels := make(map[string]bool)
	for _, roleRanking := range rs.currentRankings.Roles {
		knownModels[roleRanking.Primary.Model] = true
		for _, fallback := range roleRanking.Fallback {
			knownModels[fallback] = true
		}
		if roleRanking.SubscriptionAlternative != "" {
			knownModels[roleRanking.SubscriptionAlternative] = true
		}
	}

	// Find models in benchmarks not in known models
	for modelName := range benchmarks {
		if !knownModels[modelName] {
			newModels = append(newModels, modelName)
		}
	}

	return newModels
}

// getAllModelsForRole combines existing and new models for evaluation
func (rs *ResearchSystem) getAllModelsForRole(benchmarks map[string]*ModelBenchmark, role string) []ModelBenchmark {
	models := []ModelBenchmark{}

	for _, benchmark := range benchmarks {
		// Create ModelBenchmark with role-specific scoring
		models = append(models, *benchmark)
	}

	return models
}

// extractFallbackModels gets top N models after the primary
func (rs *ResearchSystem) extractFallbackModels(ranked []RankedModel, count int) []string {
	fallbacks := []string{}

	// Skip first (primary) and take next N
	for i := 1; i < len(ranked) && i <= count; i++ {
		fallbacks = append(fallbacks, ranked[i].Name)
	}

	return fallbacks
}

// findSubscriptionAlternative finds best free/cheap model
func (rs *ResearchSystem) findSubscriptionAlternative(ranked []RankedModel) string {
	// Prioritize free/cheap models
	freeModels := []string{
		"gemini-2.0-flash",
		"qwen-2.5-72b",
		"deepseek-chat",
		"qwen-2.5-coder-32b",
	}

	for _, model := range ranked {
		for _, freeModel := range freeModels {
			if model.Name == freeModel {
				return model.Name
			}
		}
	}

	// Fallback: return last ranked model
	if len(ranked) > 0 {
		return ranked[len(ranked)-1].Name
	}

	return ""
}

// GetLastResearchDate returns when research was last run
func (rs *ResearchSystem) GetLastResearchDate() time.Time {
	return rs.currentRankings.Updated
}

// ForceRefresh forces a complete re-evaluation of all models
func (rs *ResearchSystem) ForceRefresh(ctx context.Context) error {
	log.Println("[RESEARCH] Forcing complete refresh of all rankings...")

	// Temporarily clear known models to force re-evaluation
	originalRankings := rs.currentRankings
	rs.currentRankings = &routing.ModelRankings{
		Roles: make(map[string]routing.RoleRanking),
	}

	// Run research
	err := rs.RunMonthlyResearch(ctx)

	if err != nil {
		// Restore original rankings on error
		rs.currentRankings = originalRankings
		return err
	}

	return nil
}
