// Package swarm provides enhanced agents with LLM capabilities
package swarm

import (
	"context"
	"fmt"
	"log"

	"github.com/ceverson/mcp-advanced-multi-agent-ecosystem/pkg/integrations/llm"
	"github.com/ceverson/mcp-advanced-multi-agent-ecosystem/pkg/mcp/protocol"
)

// EnhancedAgent represents an agent with LLM capabilities
type EnhancedAgent struct {
	*Agent
	LLMProvider llm.Provider
}

// NewEnhancedAgent creates an enhanced agent with LLM capabilities
func NewEnhancedAgent(baseAgent *Agent, llmProvider llm.Provider) *EnhancedAgent {
	return &EnhancedAgent{
		Agent:       baseAgent,
		LLMProvider: llmProvider,
	}
}

// ExecuteTaskWithLLM executes a task using LLM capabilities
func (a *EnhancedAgent) ExecuteTaskWithLLM(ctx context.Context, task *Task) (*protocol.CallToolResult, error) {
	log.Printf("Agent %s (%s) executing task with LLM: %s", a.ID, a.Type, task.Description)

	// Generate prompt based on agent type and task
	prompt := a.generatePrompt(task)

	// Use LLM to generate response
	options := &llm.GenerationOptions{
		Temperature: 0.7,
		MaxTokens:   1500,
		Model:       "",
	}

	response, err := a.LLMProvider.GenerateResponse(ctx, prompt, options)
	if err != nil {
		log.Printf("LLM generation failed for agent %s: %v", a.ID, err)
		return nil, fmt.Errorf("LLM generation failed: %w", err)
	}

	// Create result from LLM response
	result := &protocol.CallToolResult{
		Content: []protocol.Content{
			{
				Type: "text",
				Text: response,
			},
		},
		IsError: false,
	}

	log.Printf("Agent %s completed task with LLM", a.ID)
	return result, nil
}

// generatePrompt generates a prompt based on agent type and task
func (a *EnhancedAgent) generatePrompt(task *Task) string {
	basePrompt := fmt.Sprintf("You are a %s agent. %s\n\nTask: %s\n\nPlease provide a detailed response.",
		a.Type, a.Description, task.Description)

	// Add agent-specific instructions
	switch a.Type {
	case AgentTypeResearch:
		return fmt.Sprintf("%s\n\nFocus on: Research, analysis, information gathering, and providing comprehensive findings.", basePrompt)
	
	case AgentTypeArchitect:
		return fmt.Sprintf("%s\n\nFocus on: System design, architecture, component relationships, and technical specifications.", basePrompt)
	
	case AgentTypeImplementation:
		return fmt.Sprintf("%s\n\nFocus on: Code implementation, technical details, algorithms, and practical solutions.", basePrompt)
	
	case AgentTypeTesting:
		return fmt.Sprintf("%s\n\nFocus on: Test strategies, validation approaches, edge cases, and quality assurance.", basePrompt)
	
	case AgentTypeReview:
		return fmt.Sprintf("%s\n\nFocus on: Code review, best practices, potential issues, and improvement suggestions.", basePrompt)
	
	case AgentTypeDocumentation:
		return fmt.Sprintf("%s\n\nFocus on: Clear documentation, examples, explanations, and user-friendly content.", basePrompt)
	
	case AgentTypeDebugger:
		return fmt.Sprintf("%s\n\nFocus on: Debugging strategies, problem analysis, root cause identification, and solutions.", basePrompt)
	
	default:
		return basePrompt
	}
}

// EnhancedSwarmManager manages enhanced agents with LLM capabilities
type EnhancedSwarmManager struct {
	*SwarmManager
	LLMProvider llm.Provider
}

// NewEnhancedSwarmManager creates an enhanced swarm manager with LLM capabilities
func NewEnhancedSwarmManager(baseManager *SwarmManager, llmProvider llm.Provider) *EnhancedSwarmManager {
	return &EnhancedSwarmManager{
		SwarmManager: baseManager,
		LLMProvider:  llmProvider,
	}
}

// CreateEnhancedAgent creates a new enhanced agent
func (esm *EnhancedSwarmManager) CreateEnhancedAgent(ctx context.Context, agentType AgentType) (*EnhancedAgent, error) {
	agent, err := esm.CreateAgent(ctx, agentType)
	if err != nil {
		return nil, err
	}

	return NewEnhancedAgent(agent, esm.LLMProvider), nil
}

// GetEnhancedAgent retrieves an enhanced agent by ID
func (esm *EnhancedSwarmManager) GetEnhancedAgent(ctx context.Context, agentID string) (*EnhancedAgent, error) {
	agent, err := esm.GetAgent(ctx, agentID)
	if err != nil {
		return nil, err
	}

	return NewEnhancedAgent(agent, esm.LLMProvider), nil
}