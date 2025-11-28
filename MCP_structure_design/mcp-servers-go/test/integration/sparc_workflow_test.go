// Package integration provides integration tests for SPARC workflow
package integration

import (
	"context"
	"testing"
	"time"

	"github.com/ceverson/mcp-advanced-multi-agent-ecosystem/pkg/agent/swarm"
)

// TestSPARCWorkflowEndToEnd tests the complete SPARC workflow
func TestSPARCWorkflowEndToEnd(t *testing.T) {
	// Setup
	config := NewTestConfig(t)
	swarmManager := SetupSwarmManager(t, config)
	defer Cleanup(t, swarmManager)

	// Create SPARC engine
	sparcConfig := &swarm.SPARCConfig{
		EnablePseudocodePhase:   true,
		EnableArchitecturePhase: true,
		EnableRefinementPhase:   true,
		MaxIterations:          3,
		AutoAdvance:            true,
	}
	sparcEngine := swarm.NewSPARCEngine(swarmManager, sparcConfig)

	// Test data
	originalTaskID := "test-task-001"
	description := "Create a function to calculate Fibonacci numbers with memoization"

	// Create SPARC workflow
	ctx := context.Background()
	workflow, err := sparcEngine.CreateSPARCWorkflow(ctx, originalTaskID, description)
	if err != nil {
		t.Fatalf("Failed to create SPARC workflow: %v", err)
	}

	// Verify workflow creation
	if workflow.ID == "" {
		t.Error("Workflow ID should not be empty")
	}
	if workflow.OriginalTaskID != originalTaskID {
		t.Errorf("Expected original task ID %s, got %s", originalTaskID, workflow.OriginalTaskID)
	}
	if workflow.CurrentPhase != swarm.PhaseSpecification {
		t.Errorf("Expected initial phase %s, got %s", swarm.PhaseSpecification, workflow.CurrentPhase)
	}
	if workflow.Status != swarm.SPARCStatusPending {
		t.Errorf("Expected initial status %s, got %s", swarm.SPARCStatusPending, workflow.Status)
	}

	// Verify all phases are initialized
	expectedPhases := []swarm.SPARCPhase{
		swarm.PhaseSpecification,
		swarm.PhasePseudocode,
		swarm.PhaseArchitecture,
		swarm.PhaseRefinement,
		swarm.PhaseCompletion,
	}
	for _, phase := range expectedPhases {
		if _, exists := workflow.Phases[phase]; !exists {
			t.Errorf("Phase %s should be initialized", phase)
		}
	}

	t.Logf("Created SPARC workflow %s with %d phases", workflow.ID, len(workflow.Phases))
}

// TestSPARCWorkflowExecution tests workflow execution through all phases
func TestSPARCWorkflowExecution(t *testing.T) {
	// Setup
	config := NewTestConfig(t)
	swarmManager := SetupSwarmManager(t, config)
	defer Cleanup(t, swarmManager)

	// Create SPARC engine with all phases enabled
	sparcConfig := &swarm.SPARCConfig{
		EnablePseudocodePhase:   true,
		EnableArchitecturePhase: true,
		EnableRefinementPhase:   true,
		MaxIterations:          3,
		AutoAdvance:            true,
	}
	sparcEngine := swarm.NewSPARCEngine(swarmManager, sparcConfig)

	// Create and start workflow
	ctx := context.Background()
	workflow, err := sparcEngine.CreateSPARCWorkflow(ctx, "exec-task-001", "Design a caching mechanism for API responses")
	if err != nil {
		t.Fatalf("Failed to create workflow: %v", err)
	}

	// Start workflow
	if err := sparcEngine.StartWorkflow(ctx, workflow); err != nil {
		t.Fatalf("Failed to start workflow: %v", err)
	}

	// Verify workflow is in progress
	if workflow.Status != swarm.SPARCStatusInProgress {
		t.Errorf("Expected status %s after start, got %s", swarm.SPARCStatusInProgress, workflow.Status)
	}

	// Wait for workflow to complete (simulated completion)
	time.Sleep(3 * time.Second)

	// Verify workflow completed
	status := sparcEngine.GetWorkflowStatus(ctx, workflow)
	if status.Status != swarm.SPARCStatusCompleted {
		t.Errorf("Expected final status %s, got %s", swarm.SPARCStatusCompleted, status.Status)
	}

	// Verify all phases were executed
	expectedPhases := []swarm.SPARCPhase{
		swarm.PhaseSpecification,
		swarm.PhasePseudocode,
		swarm.PhaseArchitecture,
		swarm.PhaseRefinement,
		swarm.PhaseCompletion,
	}
	
	for phase, phaseData := range workflow.Phases {
		if phaseData.Status != swarm.PhaseStatusCompleted {
			t.Errorf("Phase %s should be completed, got %s", phase, phaseData.Status)
		}
		if phaseData.Result == nil {
			t.Errorf("Phase %s should have results", phase)
		}
	}

	// Verify agent assignments
	if len(workflow.AgentAssignments) != len(expectedPhases) {
		t.Errorf("Expected %d agent assignments, got %d", len(expectedPhases), len(workflow.AgentAssignments))
	}

	// Verify results compilation
	if len(workflow.Results) == 0 {
		t.Error("Workflow should have compiled results")
	}

	t.Logf("Workflow %s completed successfully with %d results", workflow.ID, len(workflow.Results))
}

// TestSPARCWorkflowAgentAssignments tests agent assignments across phases
func TestSPARCWorkflowAgentAssignments(t *testing.T) {
	// Setup
	config := NewTestConfig(t)
	swarmManager := SetupSwarmManager(t, config)
	defer Cleanup(t, swarmManager)

	// Create SPARC engine
	sparcConfig := &swarm.SPARCConfig{
		EnablePseudocodePhase:   true,
		EnableArchitecturePhase: true,
		EnableRefinementPhase:   true,
		MaxIterations:          3,
		AutoAdvance:            true,
	}
	sparcEngine := swarm.NewSPARCEngine(swarmManager, sparcConfig)

	// Create workflow
	ctx := context.Background()
	workflow, err := sparcEngine.CreateSPARCWorkflow(ctx, "agent-test-001", "Implement a rate limiter for API endpoints")
	if err != nil {
		t.Fatalf("Failed to create workflow: %v", err)
	}

	// Start workflow
	if err := sparcEngine.StartWorkflow(ctx, workflow); err != nil {
		t.Fatalf("Failed to start workflow: %v", err)
	}

	// Wait for completion
	time.Sleep(3 * time.Second)

	// Verify agent assignments for each phase
	expectedAssignments := map[swarm.SPARCPhase]swarm.AgentType{
		swarm.PhaseSpecification:  swarm.AgentTypeResearch,
		swarm.PhasePseudocode:     swarm.AgentTypeArchitect,
		swarm.PhaseArchitecture:   swarm.AgentTypeArchitect,
		swarm.PhaseRefinement:     swarm.AgentTypeReview,
		swarm.PhaseCompletion:     swarm.AgentTypeImplementation,
	}

	for phase, expectedAgentType := range expectedAssignments {
		agentID, assigned := workflow.AgentAssignments[phase]
		if !assigned {
			t.Errorf("Phase %s should have an agent assignment", phase)
			continue
		}

		// Verify agent exists and has correct type
		agent, err := swarmManager.GetAgent(ctx, agentID)
		if err != nil {
			t.Errorf("Failed to get agent %s for phase %s: %v", agentID, phase, err)
			continue
		}

		if agent.Type != expectedAgentType {
			t.Errorf("Phase %s: expected agent type %s, got %s", phase, expectedAgentType, agent.Type)
		}

		t.Logf("Phase %s assigned to %s (%s)", phase, agent.Name, agent.Type)
	}
}

// TestSPARCWorkflowPhaseProgression tests automatic phase progression
func TestSPARCWorkflowPhaseProgression(t *testing.T) {
	// Setup
	config := NewTestConfig(t)
	swarmManager := SetupSwarmManager(t, config)
	defer Cleanup(t, swarmManager)

	// Create SPARC engine with auto-advance enabled
	sparcConfig := &swarm.SPARCConfig{
		EnablePseudocodePhase:   true,
		EnableArchitecturePhase: true,
		EnableRefinementPhase:   true,
		MaxIterations:          3,
		AutoAdvance:            true,
	}
	sparcEngine := swarm.NewSPARCEngine(swarmManager, sparcConfig)

	// Create and start workflow
	ctx := context.Background()
	workflow, err := sparcEngine.CreateSPARCWorkflow(ctx, "progression-001", "Design a distributed task queue system")
	if err != nil {
		t.Fatalf("Failed to create workflow: %v", err)
	}

	initialPhase := workflow.CurrentPhase
	if err := sparcEngine.StartWorkflow(ctx, workflow); err != nil {
		t.Fatalf("Failed to start workflow: %v", err)
	}

	// Wait and verify phase progression
	time.Sleep(1 * time.Second)
	
	// Should have progressed from initial phase
	if workflow.CurrentPhase == initialPhase && workflow.Status == swarm.SPARCStatusInProgress {
		t.Error("Workflow should have progressed from initial phase")
	}

	// Wait for completion
	time.Sleep(3 * time.Second)

	// Should be in completion phase or completed
	if workflow.Status != swarm.SPARCStatusCompleted {
		t.Errorf("Expected final status %s, got %s", swarm.SPARCStatusCompleted, workflow.Status)
	}

	t.Logf("Workflow progressed through phases: %v", workflow.CurrentPhase)
}

// TestSPARCWorkflowConfigurablePhases tests workflow with configurable phases
func TestSPARCWorkflowConfigurablePhases(t *testing.T) {
	tests := []struct {
		name                    string
		enablePseudocode        bool
		enableArchitecture      bool
		enableRefinement        bool
		expectedPhaseCount      int
	}{
		{
			name:               "All phases enabled",
			enablePseudocode:   true,
			enableArchitecture: true,
			enableRefinement:   true,
			expectedPhaseCount: 5, // spec + pseudo + arch + refine + completion
		},
		{
			name:               "Only specification and completion",
			enablePseudocode:   false,
			enableArchitecture: false,
			enableRefinement:   false,
			expectedPhaseCount: 2, // spec + completion
		},
		{
			name:               "Specification, architecture, completion",
			enablePseudocode:   false,
			enableArchitecture: true,
			enableRefinement:   false,
			expectedPhaseCount: 3, // spec + arch + completion
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			config := NewTestConfig(t)
			swarmManager := SetupSwarmManager(t, config)
			defer Cleanup(t, swarmManager)

			// Create SPARC engine with specific phase configuration
			sparcConfig := &swarm.SPARCConfig{
				EnablePseudocodePhase:   tt.enablePseudocode,
				EnableArchitecturePhase: tt.enableArchitecture,
				EnableRefinementPhase:   tt.enableRefinement,
				MaxIterations:          3,
				AutoAdvance:            true,
			}
			sparcEngine := swarm.NewSPARCEngine(swarmManager, sparcConfig)

			// Create workflow
			ctx := context.Background()
			workflow, err := sparcEngine.CreateSPARCWorkflow(ctx, "config-test-001", "Test phase configuration")
			if err != nil {
				t.Fatalf("Failed to create workflow: %v", err)
			}

			// Count enabled phases
			enabledCount := 0
			for _, phaseData := range workflow.Phases {
				if phaseData.Status != swarm.PhaseStatusSkipped {
					enabledCount++
				}
			}

			if enabledCount != tt.expectedPhaseCount {
				t.Errorf("Expected %d enabled phases, got %d", tt.expectedPhaseCount, enabledCount)
			}

			t.Logf("Configuration test '%s' passed with %d phases", tt.name, enabledCount)
		})
	}
}

// TestSPARCWorkflowResultCompilation tests result compilation across phases
func TestSPARCWorkflowResultCompilation(t *testing.T) {
	// Setup
	config := NewTestConfig(t)
	swarmManager := SetupSwarmManager(t, config)
	defer Cleanup(t, swarmManager)

	// Create SPARC engine
	sparcConfig := &swarm.SPARCConfig{
		EnablePseudocodePhase:   true,
		EnableArchitecturePhase: true,
		EnableRefinementPhase:   true,
		MaxIterations:          3,
		AutoAdvance:            true,
	}
	sparcEngine := swarm.NewSPARCEngine(swarmManager, sparcConfig)

	// Create and execute workflow
	ctx := context.Background()
	workflow, err := sparcEngine.CreateSPARCWorkflow(ctx, "results-001", "Design a configuration management system")
	if err != nil {
		t.Fatalf("Failed to create workflow: %v", err)
	}

	if err := sparcEngine.StartWorkflow(ctx, workflow); err != nil {
		t.Fatalf("Failed to start workflow: %v", err)
	}

	// Wait for completion
	time.Sleep(3 * time.Second)

	// Verify results from all phases
	expectedPhases := []swarm.SPARCPhase{
		swarm.PhaseSpecification,
		swarm.PhasePseudocode,
		swarm.PhaseArchitecture,
		swarm.PhaseRefinement,
		swarm.PhaseCompletion,
	}

	for _, phase := range expectedPhases {
		result, exists := workflow.Results[phase]
		if !exists {
			t.Errorf("Expected results for phase %s", phase)
			continue
		}

		if result.IsError {
			t.Errorf("Phase %s result should not be an error", phase)
		}

		if len(result.Content) == 0 {
			t.Errorf("Phase %s should have content in results", phase)
		}

		t.Logf("Phase %s has %d content items", phase, len(result.Content))
	}

	// Verify final compiled result
	if len(workflow.Results) != len(expectedPhases) {
		t.Errorf("Expected %d results, got %d", len(expectedPhases), len(workflow.Results))
	}
}

// TestSPARCWorkflowErrorHandling tests error handling in workflow
func TestSPARCWorkflowErrorHandling(t *testing.T) {
	// Setup
	config := NewTestConfig(t)
	swarmManager := SetupSwarmManager(t, config)
	defer Cleanup(t, swarmManager)

	// Create SPARC engine
	sparcConfig := &swarm.SPARCConfig{
		EnablePseudocodePhase:   true,
		EnableArchitecturePhase: true,
		EnableRefinementPhase:   true,
		MaxIterations:          3,
		AutoAdvance:            true,
	}
	sparcEngine := swarm.NewSPARCEngine(swarmManager, sparcConfig)

	// Test invalid workflow start (already started)
	ctx := context.Background()
	workflow, err := sparcEngine.CreateSPARCWorkflow(ctx, "error-test-001", "Test error handling")
	if err != nil {
		t.Fatalf("Failed to create workflow: %v", err)
	}

	// Start workflow first time
	if err := sparcEngine.StartWorkflow(ctx, workflow); err != nil {
		t.Fatalf("Failed to start workflow: %v", err)
	}

	// Try to start again (should fail)
	err = sparcEngine.StartWorkflow(ctx, workflow)
	if err == nil {
		t.Error("Expected error when starting already started workflow")
	}

	t.Logf("Correctly handled error: %v", err)
}

// TestSPARCWorkflowStatusTracking tests workflow status tracking
func TestSPARCWorkflowStatusTracking(t *testing.T) {
	// Setup
	config := NewTestConfig(t)
	swarmManager := SetupSwarmManager(t, config)
	defer Cleanup(t, swarmManager)

	// Create SPARC engine
	sparcConfig := &swarm.SPARCConfig{
		EnablePseudocodePhase:   true,
		EnableArchitecturePhase: true,
		EnableRefinementPhase:   true,
		MaxIterations:          3,
		AutoAdvance:            true,
	}
	sparcEngine := swarm.NewSPARCEngine(swarmManager, sparcConfig)

	// Create workflow
	ctx := context.Background()
	workflow, err := sparcEngine.CreateSPARCWorkflow(ctx, "status-test-001", "Test status tracking")
	if err != nil {
		t.Fatalf("Failed to create workflow: %v", err)
	}

	// Check initial status
	status := sparcEngine.GetWorkflowStatus(ctx, workflow)
	if status.Status != swarm.SPARCStatusPending {
		t.Errorf("Expected initial status %s, got %s", swarm.SPARCStatusPending, status.Status)
	}

	// Start workflow
	if err := sparcEngine.StartWorkflow(ctx, workflow); err != nil {
		t.Fatalf("Failed to start workflow: %v", err)
	}

	// Check in-progress status
	status = sparcEngine.GetWorkflowStatus(ctx, workflow)
	if status.Status != swarm.SPARCStatusInProgress {
		t.Errorf("Expected in-progress status %s, got %s", swarm.SPARCStatusInProgress, status.Status)
	}

	// Wait for completion
	time.Sleep(3 * time.Second)

	// Check final status
	status = sparcEngine.GetWorkflowStatus(ctx, workflow)
	if status.Status != swarm.SPARCStatusCompleted {
		t.Errorf("Expected final status %s, got %s", swarm.SPARCStatusCompleted, status.Status)
	}

	// Verify phase statuses
	for phase, phaseStatus := range status.PhaseStatuses {
		if phaseStatus != swarm.PhaseStatusCompleted {
			t.Errorf("Phase %s should be completed, got %s", phase, phaseStatus)
		}
	}

	t.Logf("Status tracking verified for workflow %s", workflow.ID)
}