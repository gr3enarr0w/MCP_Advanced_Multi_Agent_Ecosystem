package promptengineer

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/gr3enarr0w/mcp-ecosystem/nanogpt-proxy/backends"
)

// PromptEngineer optimizes prompts based on role and strategies
type PromptEngineer struct {
	fastModel  backends.Backend
	strategies *StrategyDB
}

// OptimizedPrompt contains the result of prompt optimization
type OptimizedPrompt struct {
	Original         string
	Optimized        string
	Role             string
	StrategyUsed     string
	OptimizationTime time.Duration
}

// NewPromptEngineer creates a new prompt engineer
func NewPromptEngineer(fastModel backends.Backend, strategiesPath string) (*PromptEngineer, error) {
	strategies, err := LoadStrategies(strategiesPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load strategies: %w", err)
	}

	return &PromptEngineer{
		fastModel:  fastModel,
		strategies: strategies,
	}, nil
}

// Optimize improves a user prompt based on the role
func (pe *PromptEngineer) Optimize(ctx context.Context, userPrompt, role string) (*OptimizedPrompt, error) {
	startTime := time.Now()

	// Get strategy for role
	strategy := pe.strategies.GetStrategy(role)
	if strategy == nil {
		// No strategy found, return original prompt
		log.Printf("[WARN] No prompt strategy found for role: %s", role)
		return &OptimizedPrompt{
			Original:         userPrompt,
			Optimized:        userPrompt,
			Role:             role,
			StrategyUsed:     "none",
			OptimizationTime: time.Since(startTime),
		}, nil
	}

	// Build optimization prompt
	optimizationPrompt := pe.buildOptimizationPrompt(userPrompt, strategy)

	// Call fast model to optimize
	req := backends.ChatRequest{
		Model: "auto", // Let backend choose fast model
		Messages: []backends.ChatMessage{
			{
				Role:    "system",
				Content: strategy.SystemPrompt,
			},
			{
				Role:    "user",
				Content: optimizationPrompt,
			},
		},
		Temperature: 0.3, // Low temperature for consistent optimization
		MaxTokens:   1000,
	}

	resp, err := pe.fastModel.ChatCompletion(ctx, req)
	if err != nil {
		log.Printf("[ERROR] Prompt optimization failed: %v", err)
		// Return original prompt on error
		return &OptimizedPrompt{
			Original:         userPrompt,
			Optimized:        userPrompt,
			Role:             role,
			StrategyUsed:     "error",
			OptimizationTime: time.Since(startTime),
		}, nil
	}

	optimizedContent := ""
	if len(resp.Choices) > 0 {
		optimizedContent = resp.Choices[0].Message.Content
	}

	return &OptimizedPrompt{
		Original:         userPrompt,
		Optimized:        optimizedContent,
		Role:             role,
		StrategyUsed:     strategy.Name,
		OptimizationTime: time.Since(startTime),
	}, nil
}

// buildOptimizationPrompt creates the meta-prompt for optimization
func (pe *PromptEngineer) buildOptimizationPrompt(userPrompt string, strategy *Strategy) string {
	prompt := fmt.Sprintf(`You are a prompt engineering expert. Optimize the following user prompt for a %s role.

User's original prompt:
%s

Apply these techniques:
%v

Follow these constraints:
%v

Output ONLY the optimized prompt, without any explanation or meta-commentary.
`,
		strategy.Name,
		userPrompt,
		strategy.Techniques,
		strategy.Constraints,
	)

	// Add examples if available
	if len(strategy.Examples) > 0 {
		prompt += "\nExamples of good prompts for this role:\n"
		for i, example := range strategy.Examples {
			prompt += fmt.Sprintf("%d. %s\n", i+1, example)
		}
	}

	return prompt
}

// IsEnabled checks if prompt engineering is enabled
func (pe *PromptEngineer) IsEnabled() bool {
	return pe.fastModel != nil && pe.strategies != nil
}
