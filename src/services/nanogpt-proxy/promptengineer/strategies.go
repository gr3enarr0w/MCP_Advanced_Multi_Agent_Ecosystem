package promptengineer

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

// Strategy defines a prompt optimization strategy for a role
type Strategy struct {
	Name         string   `yaml:"name"`
	SystemPrompt string   `yaml:"system_prompt"`
	Techniques   []string `yaml:"techniques"`
	Constraints  []string `yaml:"constraints"`
	Examples     []string `yaml:"examples"`
}

// StrategyDB holds all prompt strategies
type StrategyDB struct {
	Strategies map[string]*Strategy
}

// StrategiesConfig is the YAML structure for strategies
type StrategiesConfig struct {
	Strategies map[string]Strategy `yaml:"strategies"`
}

// LoadStrategies loads strategies from a YAML file
func LoadStrategies(path string) (*StrategyDB, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read strategies file: %w", err)
	}

	var config StrategiesConfig
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse strategies YAML: %w", err)
	}

	// Convert to map with pointers
	strategies := make(map[string]*Strategy)
	for name, strategy := range config.Strategies {
		s := strategy
		s.Name = name
		strategies[name] = &s
	}

	return &StrategyDB{
		Strategies: strategies,
	}, nil
}

// GetStrategy retrieves a strategy by role name
func (db *StrategyDB) GetStrategy(role string) *Strategy {
	return db.Strategies[role]
}

// ListRoles returns all available roles
func (db *StrategyDB) ListRoles() []string {
	roles := make([]string, 0, len(db.Strategies))
	for role := range db.Strategies {
		roles = append(roles, role)
	}
	return roles
}
