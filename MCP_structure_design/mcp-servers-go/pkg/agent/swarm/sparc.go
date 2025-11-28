// Package swarm provides SPARC workflow orchestration
package swarm

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/ceverson/mcp-advanced-multi-agent-ecosystem/pkg/integrations/llm"
	"github.com/ceverson/mcp-advanced-multi-agent-ecosystem/pkg/mcp/protocol"
)

// SPARCPhase represents a phase in the SPARC workflow
type SPARCPhase string

const (
	PhaseSpecification SPARCPhase = "specification"
	PhasePseudocode    SPARCPhase = "pseudocode"
	PhaseArchitecture  SPARCPhase = "architecture"
	PhaseRefinement    SPARCPhase = "refinement"
	PhaseCompletion    SPARCPhase = "completion"
)

// SPARCWorkflow represents a SPARC workflow instance
type SPARCWorkflow struct {
	ID                string
	OriginalTaskID    string
	CurrentPhase      SPARCPhase
	Phases            map[SPARCPhase]*SPARCPhaseData
	AgentAssignments  map[SPARCPhase]string
	Results           map[SPARCPhase]*protocol.CallToolResult
	Metadata          map[string]interface{}
	CreatedAt         time.Time
	UpdatedAt         time.Time
	CompletedAt       *time.Time
	Status            SPARCStatus
	IterationCount    int
	MaxIterations     int
	mu                sync.RWMutex
}

// SPARCPhaseData represents data for a specific phase
type SPARCPhaseData struct {
	Phase       SPARCPhase
	Description string
	AgentType   AgentType
	TaskID      string
	Status      SPARCPhaseStatus
	Result      *protocol.CallToolResult
	Error       error
	StartedAt   *time.Time
	CompletedAt *time.Time
	Inputs      map[string]interface{}
	Outputs     map[string]interface{}
}

// SPARCStatus represents the overall workflow status
type SPARCStatus string

const (
	SPARCStatusPending    SPARCStatus = "pending"
	SPARCStatusInProgress SPARCStatus = "in_progress"
	SPARCStatusCompleted  SPARCStatus = "completed"
	SPARCStatusFailed     SPARCStatus = "failed"
	SPARCStatusRefining   SPARCStatus = "refining"
)

// SPARCPhaseStatus represents the status of an individual phase
type SPARCPhaseStatus string

const (
	PhaseStatusPending    SPARCPhaseStatus = "pending"
	PhaseStatusInProgress SPARCPhaseStatus = "in_progress"
	PhaseStatusCompleted  SPARCPhaseStatus = "completed"
	PhaseStatusFailed     SPARCPhaseStatus = "failed"
	PhaseStatusSkipped    SPARCPhaseStatus = "skipped"
)

// SPARCEngine orchestrates SPARC workflows
type SPARCEngine struct {
	swarmManager *SwarmManager
	config       *SPARCConfig
	llmProvider  llm.Provider
}

// SPARCConfig represents configuration for the SPARC engine
type SPARCConfig struct {
	EnablePseudocodePhase   bool
	EnableArchitecturePhase bool
	EnableRefinementPhase   bool
	MaxIterations          int
	AutoAdvance            bool
}

// NewSPARCEngine creates a new SPARC workflow engine
func NewSPARCEngine(swarmManager *SwarmManager, config *SPARCConfig, llmProvider llm.Provider) *SPARCEngine {
	if config == nil {
		config = &SPARCConfig{
			EnablePseudocodePhase:   true,
			EnableArchitecturePhase: true,
			EnableRefinementPhase:   true,
			MaxIterations:          3,
			AutoAdvance:            true,
		}
	}

	return &SPARCEngine{
		swarmManager: swarmManager,
		config:       config,
		llmProvider:  llmProvider,
	}
}

// CreateSPARCWorkflow creates a new SPARC workflow for a task
func (e *SPARCEngine) CreateSPARCWorkflow(ctx context.Context, originalTaskID string, description string) (*SPARCWorkflow, error) {
	workflow := &SPARCWorkflow{
		ID:             fmt.Sprintf("sparc-%s", originalTaskID),
		OriginalTaskID: originalTaskID,
		CurrentPhase:   PhaseSpecification,
		Phases:         make(map[SPARCPhase]*SPARCPhaseData),
		AgentAssignments: make(map[SPARCPhase]string),
		Results:        make(map[SPARCPhase]*protocol.CallToolResult),
		Metadata:       make(map[string]interface{}),
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
		Status:         SPARCStatusPending,
		IterationCount: 0,
		MaxIterations:  e.config.MaxIterations,
	}

	// Initialize phases
	e.initializePhases(workflow, description)

	log.Printf("Created SPARC workflow %s for task %s", workflow.ID, originalTaskID)
	return workflow, nil
}

// initializePhases sets up the phases for the workflow
func (e *SPARCEngine) initializePhases(workflow *SPARCWorkflow, description string) {
	// Specification Phase - Always enabled
	workflow.Phases[PhaseSpecification] = &SPARCPhaseData{
		Phase:       PhaseSpecification,
		Description: "Analyze requirements and create detailed specification",
		AgentType:   AgentTypeResearch,
		Status:      PhaseStatusPending,
		Inputs: map[string]interface{}{
			"original_description": description,
		},
		Outputs: make(map[string]interface{}),
	}

	// Pseudocode Phase - Optional
	if e.config.EnablePseudocodePhase {
		workflow.Phases[PhasePseudocode] = &SPARCPhaseData{
			Phase:       PhasePseudocode,
			Description: "Generate pseudocode for the solution",
			AgentType:   AgentTypeArchitect,
			Status:      PhaseStatusPending,
			Inputs:      make(map[string]interface{}),
			Outputs:     make(map[string]interface{}),
		}
	}

	// Architecture Phase - Optional
	if e.config.EnableArchitecturePhase {
		workflow.Phases[PhaseArchitecture] = &SPARCPhaseData{
			Phase:       PhaseArchitecture,
			Description: "Design system architecture and components",
			AgentType:   AgentTypeArchitect,
			Status:      PhaseStatusPending,
			Inputs:      make(map[string]interface{}),
			Outputs:     make(map[string]interface{}),
		}
	}

	// Refinement Phase - Optional
	if e.config.EnableRefinementPhase {
		workflow.Phases[PhaseRefinement] = &SPARCPhaseData{
			Phase:       PhaseRefinement,
			Description: "Refine and optimize the solution",
			AgentType:   AgentTypeReview,
			Status:      PhaseStatusPending,
			Inputs:      make(map[string]interface{}),
			Outputs:     make(map[string]interface{}),
		}
	}

	// Completion Phase - Always enabled
	workflow.Phases[PhaseCompletion] = &SPARCPhaseData{
		Phase:       PhaseCompletion,
		Description: "Final validation and completion",
		AgentType:   AgentTypeImplementation,
		Status:      PhaseStatusPending,
		Inputs:      make(map[string]interface{}),
		Outputs:     make(map[string]interface{}),
	}
}

// StartWorkflow starts the SPARC workflow
func (e *SPARCEngine) StartWorkflow(ctx context.Context, workflow *SPARCWorkflow) error {
	if workflow.Status != SPARCStatusPending {
		return fmt.Errorf("workflow cannot be started from status: %s", workflow.Status)
	}

	log.Printf("Starting SPARC workflow %s", workflow.ID)
	workflow.Status = SPARCStatusInProgress
	workflow.UpdatedAt = time.Now()

	// Start with specification phase
	return e.executePhase(ctx, workflow, PhaseSpecification)
}

// executePhase executes a specific phase of the workflow
func (e *SPARCEngine) executePhase(ctx context.Context, workflow *SPARCWorkflow, phase SPARCPhase) error {
	phaseData, exists := workflow.Phases[phase]
	if !exists {
		log.Printf("Phase %s not found in workflow, skipping", phase)
		return e.advanceToNextPhase(ctx, workflow, phase)
	}

	log.Printf("Executing SPARC phase: %s", phase)
	phaseData.Status = PhaseStatusInProgress
	now := time.Now()
	phaseData.StartedAt = &now

	// Assign agent for this phase
	agent, err := e.assignAgent(ctx, phaseData.AgentType)
	if err != nil {
		phaseData.Status = PhaseStatusFailed
		phaseData.Error = err
		workflow.Status = SPARCStatusFailed
		return fmt.Errorf("failed to assign agent for phase %s: %w", phase, err)
	}

	workflow.AgentAssignments[phase] = agent.ID
	log.Printf("Assigned agent %s (%s) to phase %s", agent.ID, agent.Name, phase)

	// Create task for this phase
	taskDescription := e.generatePhaseTaskDescription(workflow, phaseData)
	task, err := e.swarmManager.CreateTask(ctx, taskDescription, phaseData.AgentType, 3, nil)
	if err != nil {
		phaseData.Status = PhaseStatusFailed
		phaseData.Error = err
		workflow.Status = SPARCStatusFailed
		return fmt.Errorf("failed to create task for phase %s: %w", phase, err)
	}

	phaseData.TaskID = task.ID

	// Assign and start the task
	if err := e.swarmManager.AssignTask(ctx, task.ID); err != nil {
		phaseData.Status = PhaseStatusFailed
		phaseData.Error = err
		workflow.Status = SPARCStatusFailed
		return fmt.Errorf("failed to assign task for phase %s: %w", phase, err)
	}

	if err := e.swarmManager.StartTask(ctx, task.ID); err != nil {
		phaseData.Status = PhaseStatusFailed
		phaseData.Error = err
		workflow.Status = SPARCStatusFailed
		return fmt.Errorf("failed to start task for phase %s: %w", phase, err)
	}

	log.Printf("Started task %s for phase %s", task.ID, phase)

	// In a real implementation, we would wait for task completion
	// For now, we'll simulate completion and store results
	go e.monitorPhaseCompletion(ctx, workflow, phase)

	return nil
}

// assignAgent finds an available agent of the specified type
func (e *SPARCEngine) assignAgent(ctx context.Context, agentType AgentType) (*Agent, error) {
	agents, err := e.swarmManager.ListAgents(ctx, agentType, AgentStatusIdle)
	if err != nil {
		return nil, err
	}

	if len(agents) == 0 {
		// Create a new agent if none available
		return e.swarmManager.CreateAgent(ctx, agentType)
	}

	return agents[0], nil
}

// generatePhaseTaskDescription generates a task description for a phase
func (e *SPARCEngine) generatePhaseTaskDescription(workflow *SPARCWorkflow, phaseData *SPARCPhaseData) string {
	baseDescription := fmt.Sprintf("SPARC %s phase for task %s: %s",
		phaseData.Phase, workflow.OriginalTaskID, phaseData.Description)

	// Add context from previous phases
	if phaseData.Phase != PhaseSpecification {
		if specResult, exists := workflow.Results[PhaseSpecification]; exists && specResult != nil {
			baseDescription += fmt.Sprintf("\n\nPrevious specification result: %s", specResult.Content)
		}
	}

	return baseDescription
}

// monitorPhaseCompletion monitors a phase task for completion
func (e *SPARCEngine) monitorPhaseCompletion(ctx context.Context, workflow *SPARCWorkflow, phase SPARCPhase) {
	// In a real implementation, this would wait for the actual task completion
	// For now, we'll simulate a delay and then complete the phase
	time.Sleep(2 * time.Second)


	phaseData := workflow.Phases[phase]
	if phaseData == nil {
		return
	}

	// Simulate successful completion
	phaseData.Status = PhaseStatusCompleted
	now := time.Now()
	phaseData.CompletedAt = &now

	// Store mock results
	mockResult := &protocol.CallToolResult{
		Content: []protocol.Content{
			{
				Type: "text",
				Text: fmt.Sprintf("Completed %s phase successfully", phase),
			},
		},
		IsError: false,
	}

	phaseData.Result = mockResult
	workflow.Results[phase] = mockResult

	log.Printf("Completed SPARC phase: %s", phase)

	// Advance to next phase
	if e.config.AutoAdvance {
		if err := e.advanceToNextPhase(ctx, workflow, phase); err != nil {
			log.Printf("Failed to advance to next phase: %v", err)
		}
	}
}

// advanceToNextPhase advances the workflow to the next phase
func (e *SPARCEngine) advanceToNextPhase(ctx context.Context, workflow *SPARCWorkflow, currentPhase SPARCPhase) error {
	phases := e.getPhaseOrder()
	
	var nextPhase SPARCPhase
	found := false
	for _, phase := range phases {
		if found {
			nextPhase = phase
			break
		}
		if phase == currentPhase {
			found = true
		}
	}

	if !found || nextPhase == "" {
		// No more phases, workflow is complete
		return e.completeWorkflow(ctx, workflow)
	}

	workflow.CurrentPhase = nextPhase
	workflow.UpdatedAt = time.Now()

	log.Printf("Advancing to next SPARC phase: %s", nextPhase)
	return e.executePhase(ctx, workflow, nextPhase)
}

// getPhaseOrder returns the order of phases to execute
func (e *SPARCEngine) getPhaseOrder() []SPARCPhase {
	phases := []SPARCPhase{PhaseSpecification}
	
	if e.config.EnablePseudocodePhase {
		phases = append(phases, PhasePseudocode)
	}
	
	if e.config.EnableArchitecturePhase {
		phases = append(phases, PhaseArchitecture)
	}
	
	if e.config.EnableRefinementPhase {
		phases = append(phases, PhaseRefinement)
	}
	
	phases = append(phases, PhaseCompletion)
	
	return phases
}

// completeWorkflow marks the workflow as completed
func (e *SPARCEngine) completeWorkflow(ctx context.Context, workflow *SPARCWorkflow) error {
	log.Printf("Completing SPARC workflow %s", workflow.ID)
	
	workflow.Status = SPARCStatusCompleted
	now := time.Now()
	workflow.CompletedAt = &now
	workflow.UpdatedAt = now

	// Compile final results
	finalResult := e.compileFinalResults(workflow)
	workflow.Results[PhaseCompletion] = finalResult

	log.Printf("SPARC workflow %s completed successfully", workflow.ID)
	return nil
}

// compileFinalResults compiles results from all phases
func (e *SPARCEngine) compileFinalResults(workflow *SPARCWorkflow) *protocol.CallToolResult {
	var content strings.Builder
	
	content.WriteString("SPARC Workflow Results\n")
	content.WriteString("=====================\n\n")
	
	for _, phase := range e.getPhaseOrder() {
		if phaseData, exists := workflow.Phases[phase]; exists && phaseData.Result != nil {
			content.WriteString(fmt.Sprintf("%s Phase:\n", capitalize(string(phase))))
			for _, c := range phaseData.Result.Content {
				content.WriteString(fmt.Sprintf("  %s\n", c.Text))
			}
			content.WriteString("\n")
		}
	}
	
	return &protocol.CallToolResult{
		Content: []protocol.Content{
			{
				Type: "text",
				Text: content.String(),
			},
		},
		IsError: false,
	}
}

// GetWorkflowStatus returns the current status of a workflow
func (e *SPARCEngine) GetWorkflowStatus(ctx context.Context, workflow *SPARCWorkflow) *SPARCWorkflowStatus {
	status := &SPARCWorkflowStatus{
		ID:           workflow.ID,
		CurrentPhase: workflow.CurrentPhase,
		Status:       workflow.Status,
		IterationCount: workflow.IterationCount,
		PhaseStatuses: make(map[SPARCPhase]SPARCPhaseStatus),
	}

	for phase, phaseData := range workflow.Phases {
		status.PhaseStatuses[phase] = phaseData.Status
	}

	return status
}

// SPARCWorkflowStatus represents the status of a SPARC workflow
type SPARCWorkflowStatus struct {
	ID             string
	CurrentPhase   SPARCPhase
	Status         SPARCStatus
	IterationCount int
	PhaseStatuses  map[SPARCPhase]SPARCPhaseStatus
}
