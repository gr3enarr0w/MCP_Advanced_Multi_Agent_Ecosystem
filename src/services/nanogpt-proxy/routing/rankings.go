package routing

import (
	"encoding/json"
	"fmt"
	"os"
	"time"
)

// ModelInfo contains detailed information about a model
type ModelInfo struct {
	Model      string             `json:"model"`
	Reason     string             `json:"reason"`
	Benchmarks map[string]float64 `json:"benchmarks"`
}

// RoleRanking defines model preferences for a specific role
type RoleRanking struct {
	Primary                  ModelInfo `json:"primary"`
	Fallback                 []string  `json:"fallback"`
	SubscriptionAlternative  string    `json:"subscription_alternative"`
}

// ModelRankings holds all role-to-model mappings
type ModelRankings struct {
	Updated time.Time              `json:"updated"`
	Roles   map[string]RoleRanking `json:"roles"`
}

// LoadRankings loads model rankings from JSON file
func LoadRankings(path string) (*ModelRankings, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read rankings file: %w", err)
	}

	var rankings ModelRankings
	if err := json.Unmarshal(data, &rankings); err != nil {
		return nil, fmt.Errorf("failed to parse rankings JSON: %w", err)
	}

	return &rankings, nil
}

// GetRole retrieves ranking for a specific role
func (mr *ModelRankings) GetRole(role string) *RoleRanking {
	if ranking, ok := mr.Roles[role]; ok {
		return &ranking
	}
	return nil
}

// Save writes rankings to JSON file
func (mr *ModelRankings) Save(path string) error {
	mr.Updated = time.Now()

	data, err := json.MarshalIndent(mr, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal rankings: %w", err)
	}

	if err := os.WriteFile(path, data, 0644); err != nil {
		return fmt.Errorf("failed to write rankings file: %w", err)
	}

	return nil
}

// UpdateRoleRanking updates the ranking for a specific role
func (mr *ModelRankings) UpdateRoleRanking(role string, ranking RoleRanking) {
	if mr.Roles == nil {
		mr.Roles = make(map[string]RoleRanking)
	}
	mr.Roles[role] = ranking
	mr.Updated = time.Now()
}
