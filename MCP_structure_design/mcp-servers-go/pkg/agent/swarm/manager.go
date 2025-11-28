// Package swarm provides agent swarm orchestration functionality
package swarm

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/ceverson/mcp-advanced-multi-agent-ecosystem/pkg/mcp/protocol"
)

// SwarmManager manages the agent swarm
type SwarmManager struct {
	agents      map[string]*Agent
	tasks       map[string]*Task
	taskQueue   []*Task
	agentPools  map[AgentType][]*Agent
	config      *Config
	mu          sync.RWMutex
	taskCounter int
}

// NewSwarmManager creates a new swarm manager
func NewSwarmManager(config *Config) *SwarmManager {
	if config == nil {
		config = NewConfig()
	}

	sm := &SwarmManager{
		agents:      make(map[string]*Agent),
		tasks:       make(map[string]*Task),
		taskQueue:   make([]*Task, 0),
		agentPools:  make(map[AgentType][]*Agent),
		config:      config,
		taskCounter: 0,
	}

	// Initialize default agent pools
	sm.initializeDefaultAgents()

	return sm
}

// initializeDefaultAgents creates default agents for each type
func (sm *SwarmManager) initializeDefaultAgents() {
	for _, agentType := range sm.config.DefaultAgentTypes {
		agent := sm.createAgent(agentType)
		sm.agents[agent.ID] = agent
		sm.agentPools[agentType] = append(sm.agentPools[agentType], agent)
		log.Printf("Created default %s agent: %s", agentType, agent.Name)
	}
}

// createAgent creates a new agent
func (sm *SwarmManager) createAgent(agentType AgentType) *Agent {
	sm.taskCounter++
	agentID := fmt.Sprintf("%s-%d", agentType, sm.taskCounter)
	
	agent := &Agent{
		ID:          agentID,
		Type:        agentType,
		Name:        fmt.Sprintf("%s Agent %d", capitalize(string(agentType)), sm.taskCounter),
		Description: getAgentDescription(agentType),
		Status:      AgentStatusIdle,
		Capabilities: getAgentCapabilities(agentType),
		Stats: AgentStats{
			TasksCompleted: 0,
			TasksFailed:    0,
			TotalUptime:    0,
		},
		Metadata:  make(map[string]interface{}),
		createdAt: time.Now(),
		updatedAt: time.Now(),
	}

	return agent
}

// getAgentDescription returns a description for an agent type
func getAgentDescription(agentType AgentType) string {
	descriptions := map[AgentType]string{
		AgentTypeResearch:      "Conducts research, gathers information, and analyzes data",
		AgentTypeArchitect:     "Designs system architecture and creates technical specifications",
		AgentTypeImplementation: "Implements code and executes development tasks",
		AgentTypeTesting:       "Creates and executes tests, validates functionality",
		AgentTypeReview:        "Reviews code, architecture, and provides feedback",
		AgentTypeDocumentation: "Creates and maintains documentation",
		AgentTypeDebugger:      "Debugs issues and provides troubleshooting assistance",
	}

	if desc, ok := descriptions[agentType]; ok {
		return desc
	}
	return "General purpose agent"
}

// getAgentCapabilities returns capabilities for an agent type
func getAgentCapabilities(agentType AgentType) []string {
	capabilities := map[AgentType][]string{
		AgentTypeResearch: {
			"search",
			"analyze",
			"summarize",
			"compare",
		},
		AgentTypeArchitect: {
			"design",
			"plan",
			"review-architecture",
			"create-diagrams",
		},
		AgentTypeImplementation: {
			"code",
			"execute",
			"refactor",
			"integrate",
		},
		AgentTypeTesting: {
			"test",
			"validate",
			"benchmark",
			"report-issues",
		},
		AgentTypeReview: {
			"review-code",
			"review-architecture",
			"provide-feedback",
			"suggest-improvements",
		},
		AgentTypeDocumentation: {
			"write-docs",
			"update-docs",
			"create-examples",
			"explain",
		},
		AgentTypeDebugger: {
			"debug",
			"troubleshoot",
			"analyze-logs",
			"suggest-fixes",
		},
	}

	if caps, ok := capabilities[agentType]; ok {
		return caps
	}
	return []string{"general"}
}

// capitalize capitalizes the first letter of a string
func capitalize(s string) string {
	if len(s) == 0 {
		return s
	}
	return string(s[0]-32) + s[1:]
}

// CreateAgent creates a new agent
func (sm *SwarmManager) CreateAgent(ctx context.Context, agentType AgentType) (*Agent, error) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	if len(sm.agentPools[agentType]) >= sm.config.MaxAgentsPerType {
		return nil, fmt.Errorf("maximum number of %s agents reached", agentType)
	}

	agent := sm.createAgent(agentType)
	sm.agents[agent.ID] = agent
	sm.agentPools[agentType] = append(sm.agentPools[agentType], agent)

	log.Printf("Created new %s agent: %s", agentType, agent.Name)
	return agent, nil
}

// GetAgent retrieves an agent by ID
func (sm *SwarmManager) GetAgent(ctx context.Context, agentID string) (*Agent, error) {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	agent, exists := sm.agents[agentID]
	if !exists {
		return nil, fmt.Errorf("agent not found: %s", agentID)
	}

	return agent, nil
}

// ListAgents lists all agents with optional filtering
func (sm *SwarmManager) ListAgents(ctx context.Context, agentType AgentType, status AgentStatus) ([]*Agent, error) {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	var agents []*Agent
	for _, agent := range sm.agents {
		if agentType != "" && agent.Type != agentType {
			continue
		}
		if status != "" && agent.Status != status {
			continue
		}
		agents = append(agents, agent)
	}

	return agents, nil
}

// CreateTask creates a new task
func (sm *SwarmManager) CreateTask(ctx context.Context, description string, agentType AgentType, priority int, dependencies []string) (*Task, error) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	sm.taskCounter++
	taskID := fmt.Sprintf("task-%d", sm.taskCounter)

	task := &Task{
		ID:          taskID,
		Description: description,
		AgentType:   agentType,
		Priority:    priority,
		Status:      TaskStatusPending,
		Dependencies: dependencies,
		Metadata:    make(map[string]interface{}),
		CreatedAt:   time.Now(),
	}

	sm.tasks[taskID] = task
	sm.taskQueue = append(sm.taskQueue, task)

	log.Printf("Created task %s: %s (type: %s, priority: %d)", taskID, description, agentType, priority)
	return task, nil
}

// GetTask retrieves a task by ID
func (sm *SwarmManager) GetTask(ctx context.Context, taskID string) (*Task, error) {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	task, exists := sm.tasks[taskID]
	if !exists {
		return nil, fmt.Errorf("task not found: %s", taskID)
	}

	return task, nil
}

// ListTasks lists tasks with optional filtering
func (sm *SwarmManager) ListTasks(ctx context.Context, status TaskStatus, agentType AgentType) ([]*Task, error) {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	var tasks []*Task
	for _, task := range sm.tasks {
		if status != "" && task.Status != status {
			continue
		}
		if agentType != "" && task.AgentType != agentType {
			continue
		}
		tasks = append(tasks, task)
	}

	return tasks, nil
}

// AssignTask assigns a task to an available agent
func (sm *SwarmManager) AssignTask(ctx context.Context, taskID string) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	task, exists := sm.tasks[taskID]
	if !exists {
		return fmt.Errorf("task not found: %s", taskID)
	}

	if task.Status != TaskStatusPending {
		return fmt.Errorf("task %s is not pending (status: %s)", taskID, task.Status)
	}

	// Find available agent
	agent := sm.findAvailableAgent(task.AgentType)
	if agent == nil {
		log.Printf("No available %s agent for task %s, keeping in queue", task.AgentType, taskID)
		return nil // Keep in queue
	}

	// Assign task to agent
	task.AgentID = agent.ID
	task.Status = TaskStatusAssigned
	agent.CurrentTask = task
	agent.Status = AgentStatusBusy
	agent.updatedAt = time.Now()

	log.Printf("Assigned task %s to agent %s (%s)", taskID, agent.ID, agent.Name)
	return nil
}

// findAvailableAgent finds an available agent of the specified type
func (sm *SwarmManager) findAvailableAgent(agentType AgentType) *Agent {
	agents := sm.agentPools[agentType]
	if len(agents) == 0 {
		return nil
	}

	// Use load balancing strategy
	switch sm.config.LoadBalanceStrategy {
	case "round-robin":
		return sm.findAgentRoundRobin(agents)
	case "least-loaded":
		return sm.findAgentLeastLoaded(agents)
	case "random":
		return sm.findAgentRandom(agents)
	default:
		return sm.findAgentLeastLoaded(agents)
	}
}

// findAgentRoundRobin finds an agent using round-robin strategy
func (sm *SwarmManager) findAgentRoundRobin(agents []*Agent) *Agent {
	for _, agent := range agents {
		if agent.Status == AgentStatusIdle {
			return agent
		}
	}
	return nil
}

// findAgentLeastLoaded finds the least loaded agent
func (sm *SwarmManager) findAgentLeastLoaded(agents []*Agent) *Agent {
	var bestAgent *Agent
	minTasks := -1

	for _, agent := range agents {
		if agent.Status == AgentStatusIdle {
			if minTasks == -1 || agent.Stats.TasksCompleted < minTasks {
				bestAgent = agent
				minTasks = agent.Stats.TasksCompleted
			}
		}
	}

	return bestAgent
}

// findAgentRandom finds a random available agent
func (sm *SwarmManager) findAgentRandom(agents []*Agent) *Agent {
	available := make([]*Agent, 0)
	for _, agent := range agents {
		if agent.Status == AgentStatusIdle {
			available = append(available, agent)
		}
	}

	if len(available) == 0 {
		return nil
	}

	// Simple random selection (could use math/rand in real implementation)
	return available[0]
}

// StartTask starts a task execution
func (sm *SwarmManager) StartTask(ctx context.Context, taskID string) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	task, exists := sm.tasks[taskID]
	if !exists {
		return fmt.Errorf("task not found: %s", taskID)
	}

	if task.Status != TaskStatusAssigned {
		return fmt.Errorf("task %s is not assigned (status: %s)", taskID, task.Status)
	}

	task.Status = TaskStatusRunning
	now := time.Now()
	task.StartedAt = &now

	agent, exists := sm.agents[task.AgentID]
	if exists {
		agent.updatedAt = time.Now()
	}

	log.Printf("Started task %s", taskID)
	return nil
}

// CompleteTask completes a task
func (sm *SwarmManager) CompleteTask(ctx context.Context, taskID string, result *protocol.CallToolResult) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	task, exists := sm.tasks[taskID]
	if !exists {
		return fmt.Errorf("task not found: %s", taskID)
	}

	if task.Status != TaskStatusRunning {
		return fmt.Errorf("task %s is not running (status: %s)", taskID, task.Status)
	}

	task.Status = TaskStatusCompleted
	task.Results = result
	now := time.Now()
	task.CompletedAt = &now

	// Update agent stats
	agent, exists := sm.agents[task.AgentID]
	if exists {
		agent.Stats.TasksCompleted++
		agent.Stats.LastActive = time.Now()
		if task.StartedAt != nil {
			duration := now.Sub(*task.StartedAt)
			agent.Stats.AverageDuration = calculateAverageDuration(
				agent.Stats.AverageDuration,
				agent.Stats.TasksCompleted,
				duration,
			)
		}
		agent.CurrentTask = nil
		agent.Status = AgentStatusIdle
		agent.updatedAt = time.Now()
	}

	log.Printf("Completed task %s", taskID)
	return nil
}

// calculateAverageDuration calculates the new average duration
func calculateAverageDuration(currentAvg time.Duration, count int, newDuration time.Duration) time.Duration {
	if count == 1 {
		return newDuration
	}
	total := currentAvg*time.Duration(count-1) + newDuration
	return total / time.Duration(count)
}

// FailTask marks a task as failed
func (sm *SwarmManager) FailTask(ctx context.Context, taskID string, err error) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	task, exists := sm.tasks[taskID]
	if !exists {
		return fmt.Errorf("task not found: %s", taskID)
	}

	task.Status = TaskStatusFailed
	task.Error = err
	now := time.Now()
	task.CompletedAt = &now

	// Update agent stats
	agent, exists := sm.agents[task.AgentID]
	if exists {
		agent.Stats.TasksFailed++
		agent.Stats.LastActive = time.Now()
		agent.CurrentTask = nil
		agent.Status = AgentStatusIdle
		agent.updatedAt = time.Now()
	}

	log.Printf("Failed task %s: %v", taskID, err)
	return nil
}

// ProcessQueue processes pending tasks in the queue
func (sm *SwarmManager) ProcessQueue(ctx context.Context) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	log.Printf("Processing task queue with %d pending tasks", len(sm.taskQueue))

	assigned := 0
	for _, task := range sm.taskQueue {
		if task.Status != TaskStatusPending {
			continue
		}

		agent := sm.findAvailableAgent(task.AgentType)
		if agent != nil {
			task.AgentID = agent.ID
			task.Status = TaskStatusAssigned
			agent.CurrentTask = task
			agent.Status = AgentStatusBusy
			agent.updatedAt = time.Now()
			assigned++
		}
	}

	// Clear assigned tasks from queue
	newQueue := make([]*Task, 0)
	for _, task := range sm.taskQueue {
		if task.Status == TaskStatusPending {
			newQueue = append(newQueue, task)
		}
	}
	sm.taskQueue = newQueue

	log.Printf("Assigned %d tasks from queue, %d remaining", assigned, len(sm.taskQueue))
	return nil
}

// GetStats returns swarm statistics
func (sm *SwarmManager) GetStats(ctx context.Context) (*SwarmStats, error) {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	stats := &SwarmStats{
		TotalAgents:     len(sm.agents),
		TotalTasks:      len(sm.tasks),
		PendingTasks:    0,
		RunningTasks:    0,
		CompletedTasks:  0,
		FailedTasks:     0,
		IdleAgents:      0,
		BusyAgents:      0,
		TaskQueueLength: len(sm.taskQueue),
	}

	for _, task := range sm.tasks {
		switch task.Status {
		case TaskStatusPending:
			stats.PendingTasks++
		case TaskStatusRunning:
			stats.RunningTasks++
		case TaskStatusCompleted:
			stats.CompletedTasks++
		case TaskStatusFailed:
			stats.FailedTasks++
		}
	}

	for _, agent := range sm.agents {
		switch agent.Status {
		case AgentStatusIdle:
			stats.IdleAgents++
		case AgentStatusBusy:
			stats.BusyAgents++
		}
	}

	return stats, nil
}

// SwarmStats represents swarm statistics
type SwarmStats struct {
	TotalAgents     int
	TotalTasks      int
	PendingTasks    int
	RunningTasks    int
	CompletedTasks  int
	FailedTasks     int
	IdleAgents      int
	BusyAgents      int
	TaskQueueLength int
}