// Package integration provides test helpers for integration testing
package integration

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/ceverson/mcp-advanced-multi-agent-ecosystem/pkg/agent/swarm"
	skillsManager "github.com/ceverson/mcp-advanced-multi-agent-ecosystem/pkg/skills/manager"
	tasksManager "github.com/ceverson/mcp-advanced-multi-agent-ecosystem/pkg/tasks/manager"
)

// TestConfig holds configuration for integration tests
type TestConfig struct {
	DatabaseDir string
	CleanUp     bool
}

// NewTestConfig creates a test configuration
func NewTestConfig(t *testing.T) *TestConfig {
	tmpDir := t.TempDir()
	return &TestConfig{
		DatabaseDir: tmpDir,
		CleanUp:     true,
	}
}

// SetupSwarmManager creates a swarm manager for testing
func SetupSwarmManager(t *testing.T, config *TestConfig) *swarm.SwarmManager {
	if config == nil {
		config = NewTestConfig(t)
	}

	swarmConfig := swarm.NewConfig()
	swarmConfig.MaxAgentsPerType = 5
	
	swarmManager := swarm.NewSwarmManager(swarmConfig)
	if swarmManager == nil {
		t.Fatal("Failed to create swarm manager")
	}

	return swarmManager
}

// SetupTaskManager creates a task manager for testing
func SetupTaskManager(t *testing.T, config *TestConfig) *tasksManager.TaskManager {
	if config == nil {
		config = NewTestConfig(t)
	}

	dbPath := filepath.Join(config.DatabaseDir, "test-tasks.db")
	taskManager, err := tasksManager.NewTaskManager(dbPath)
	if err != nil {
		t.Fatalf("Failed to create task manager: %v", err)
	}

	return taskManager
}

// SetupSkillsManager creates a skills manager for testing
func SetupSkillsManager(t *testing.T, config *TestConfig) *skillsManager.SkillsManager {
	if config == nil {
		config = NewTestConfig(t)
	}

	dbPath := filepath.Join(config.DatabaseDir, "test-skills.db")
	skillsManager, err := skillsManager.NewSkillsManager(dbPath)
	if err != nil {
		t.Fatalf("Failed to create skills manager: %v", err)
	}

	return skillsManager
}

// Cleanup cleans up test resources
func Cleanup(t *testing.T, managers ...interface{}) {
	if t.Failed() {
		t.Log("Test failed, preserving resources for inspection")
		return
	}

	for _, mgr := range managers {
		switch m := mgr.(type) {
		case *swarm.SwarmManager:
			// Nothing to clean up for swarm manager
		case *tasksManager.TaskManager:
			if err := m.Close(); err != nil {
				t.Logf("Error closing task manager: %v", err)
			}
		case *skillsManager.SkillsManager:
			if err := m.Close(); err != nil {
				t.Logf("Error closing skills manager: %v", err)
			}
		}
	}
}

// WaitForCondition waits for a condition to be met with timeout
func WaitForCondition(t *testing.T, timeout time.Duration, condition func() bool) {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if condition() {
			return
		}
		time.Sleep(50 * time.Millisecond)
	}
	t.Fatalf("Condition not met within timeout: %v", timeout)
}

// AssertAgentCount asserts the number of agents in the swarm
func AssertAgentCount(t *testing.T, swarmManager *swarm.SwarmManager, expectedCount int) {
	ctx := context.Background()
	agents, err := swarmManager.ListAgents(ctx, "", "")
	if err != nil {
		t.Fatalf("Failed to list agents: %v", err)
	}
	if len(agents) != expectedCount {
		t.Errorf("Expected %d agents, got %d", expectedCount, len(agents))
	}
}

// AssertTaskCount asserts the number of tasks with a specific status
func AssertTaskCount(t *testing.T, swarmManager *swarm.SwarmManager, status swarm.TaskStatus, expectedCount int) {
	ctx := context.Background()
	tasks, err := swarmManager.ListTasks(ctx, status, "")
	if err != nil {
		t.Fatalf("Failed to list tasks: %v", err)
	}
	if len(tasks) != expectedCount {
		t.Errorf("Expected %d tasks with status %s, got %d", expectedCount, status, len(tasks))
	}
}

// AssertAgentStatus asserts an agent's status
func AssertAgentStatus(t *testing.T, swarmManager *swarm.SwarmManager, agentID string, expectedStatus swarm.AgentStatus) {
	ctx := context.Background()
	agent, err := swarmManager.GetAgent(ctx, agentID)
	if err != nil {
		t.Fatalf("Failed to get agent %s: %v", agentID, err)
	}
	if agent.Status != expectedStatus {
		t.Errorf("Agent %s: expected status %s, got %s", agentID, expectedStatus, agent.Status)
	}
}

// AssertTaskStatus asserts a task's status
func AssertTaskStatus(t *testing.T, swarmManager *swarm.SwarmManager, taskID string, expectedStatus swarm.TaskStatus) {
	ctx := context.Background()
	task, err := swarmManager.GetTask(ctx, taskID)
	if err != nil {
		t.Fatalf("Failed to get task %s: %v", taskID, err)
	}
	if task.Status != expectedStatus {
		t.Errorf("Task %s: expected status %s, got %s", taskID, expectedStatus, task.Status)
	}
}

// CreateTestTask creates a test task
func CreateTestTask(t *testing.T, swarmManager *swarm.SwarmManager, description string, agentType swarm.AgentType) *swarm.Task {
	ctx := context.Background()
	task, err := swarmManager.CreateTask(ctx, description, agentType, 1, nil)
	if err != nil {
		t.Fatalf("Failed to create test task: %v", err)
	}
	return task
}

// CreateTestAgent creates a test agent
func CreateTestAgent(t *testing.T, swarmManager *swarm.SwarmManager, agentType swarm.AgentType) *swarm.Agent {
	ctx := context.Background()
	agent, err := swarmManager.CreateAgent(ctx, agentType)
	if err != nil {
		t.Fatalf("Failed to create test agent: %v", err)
	}
	return agent
}