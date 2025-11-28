package config

import (
	"os"
	"strconv"
)

// Config holds all proxy configuration
type Config struct {
	Port              string
	NanoGPTAPIKey     string
	NanoGPTBaseURL    string
	VertexProjectID   string
	VertexLocation    string
	ActiveProfile     string // "personal" or "work"
	MonthlyQuota      int    // NanoGPT monthly quota in tokens
	DBPath            string
	PromptStrategies  string
	ModelRankingsPath string
	MCPServers        map[string]MCPServerConfig
}

// MCPServerConfig defines configuration for an MCP server connection
type MCPServerConfig struct {
	Command string   `yaml:"command"`
	Args    []string `yaml:"args"`
	Env     map[string]string `yaml:"env"`
}

// Load creates a Config from environment variables
func Load() *Config {
	quota := 60000 // Default: 60k tokens/month
	if q := os.Getenv("NANOGPT_MONTHLY_QUOTA"); q != "" {
		if parsed, err := strconv.Atoi(q); err == nil {
			quota = parsed
		}
	}

	profile := os.Getenv("ACTIVE_PROFILE")
	if profile == "" {
		profile = "personal" // Default to personal (NanoGPT)
	}

	return &Config{
		Port:              getEnv("PORT", "8090"),
		NanoGPTAPIKey:     os.Getenv("NANOGPT_API_KEY"),
		NanoGPTBaseURL:    getEnv("NANOGPT_BASE_URL", "https://nano-gpt.com/api/v1"),
		VertexProjectID:   os.Getenv("VERTEX_PROJECT_ID"),
		VertexLocation:    getEnv("VERTEX_LOCATION", "us-central1"),
		ActiveProfile:     profile,
		MonthlyQuota:      quota,
		DBPath:            getEnv("DB_PATH", "~/.mcp/proxy/usage.db"),
		PromptStrategies:  getEnv("PROMPT_STRATEGIES", "config/prompt_strategies.yaml"),
		ModelRankingsPath: getEnv("MODEL_RANKINGS", "data/model_routing.json"),
		MCPServers: map[string]MCPServerConfig{
			"context-persistence": {
				Command: "python3",
				Args:    []string{"-m", "context_persistence.server"},
				Env:     map[string]string{},
			},
		},
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
