package research

import (
	"sort"
)

// ModelEvaluator ranks models for specific roles
type ModelEvaluator struct {
	roleWeights map[string]map[string]float64
}

// RankedModel represents a model with its calculated score
type RankedModel struct {
	Name       string
	Score      float64
	Reason     string
	Benchmarks map[string]float64
}

// NewModelEvaluator creates a new model evaluator
func NewModelEvaluator() *ModelEvaluator {
	return &ModelEvaluator{
		roleWeights: getRoleWeights(),
	}
}

// RankModelsForRole evaluates and ranks models for a specific role
func (me *ModelEvaluator) RankModelsForRole(models []ModelBenchmark, role string) []RankedModel {
	weights := me.roleWeights[role]
	if weights == nil {
		// Default to equal weights
		weights = map[string]float64{
			"reasoning": 1.0,
			"coding":    1.0,
			"math":      1.0,
			"language":  1.0,
		}
	}

	// Calculate scores for each model
	ranked := []RankedModel{}
	for _, model := range models {
		score := me.calculateScore(model.Benchmarks, weights)
		reason := me.generateReason(model, role, score)

		ranked = append(ranked, RankedModel{
			Name:       model.Name,
			Score:      score,
			Reason:     reason,
			Benchmarks: model.Benchmarks,
		})
	}

	// Sort by score (descending)
	sort.Slice(ranked, func(i, j int) bool {
		return ranked[i].Score > ranked[j].Score
	})

	return ranked
}

// calculateScore computes weighted score for a model
func (me *ModelEvaluator) calculateScore(benchmarks map[string]float64, weights map[string]float64) float64 {
	totalWeight := 0.0
	weightedSum := 0.0

	for metric, weight := range weights {
		if value, ok := benchmarks[metric]; ok {
			weightedSum += value * weight
			totalWeight += weight
		}
	}

	if totalWeight == 0 {
		return 0
	}

	return weightedSum / totalWeight
}

// generateReason creates a human-readable explanation for model selection
func (me *ModelEvaluator) generateReason(model ModelBenchmark, role string, score float64) string {
	// Find strongest benchmark
	maxBenchmark := ""
	maxValue := 0.0
	for metric, value := range model.Benchmarks {
		if value > maxValue {
			maxValue = value
			maxBenchmark = metric
		}
	}

	if maxBenchmark == "" {
		return "Good overall performance"
	}

	return me.formatReason(maxBenchmark, maxValue, role)
}

// formatReason creates formatted reason string
func (me *ModelEvaluator) formatReason(metric string, value float64, role string) string {
	metricDescriptions := map[string]string{
		"reasoning": "reasoning capabilities",
		"coding":    "coding performance",
		"math":      "mathematical reasoning",
		"language":  "language understanding",
		"speed":     "response speed",
		"context":   "context window",
	}

	desc := metricDescriptions[metric]
	if desc == "" {
		desc = metric
	}

	return desc
}

// getRoleWeights defines benchmark weights for each role
func getRoleWeights() map[string]map[string]float64 {
	return map[string]map[string]float64{
		"architect": {
			"reasoning": 3.0,
			"coding":    1.5,
			"math":      1.0,
			"language":  1.0,
		},
		"implementation": {
			"coding":    3.0,
			"reasoning": 1.5,
			"math":      1.0,
			"language":  0.5,
		},
		"code_review": {
			"reasoning": 2.5,
			"coding":    2.5,
			"language":  1.0,
		},
		"debugging": {
			"reasoning": 3.0,
			"coding":    2.0,
			"math":      1.0,
		},
		"testing": {
			"reasoning": 2.0,
			"coding":    2.5,
			"language":  1.0,
		},
		"documentation": {
			"language":  3.0,
			"reasoning": 1.0,
			"speed":     2.0,
		},
		"research": {
			"reasoning": 2.5,
			"language":  2.0,
			"context":   3.0, // Large context important for research
		},
		"general": {
			"reasoning": 1.5,
			"coding":    1.0,
			"language":  2.0,
			"speed":     1.5,
		},
	}
}
