// Package swarm provides agent swarm orchestration functionality
package swarm

import (
	"sync"
	"time"

	"github.com/ceverson/mcp-advanced-multi-agent-ecosystem/pkg/mcp/protocol"
)

// AgentType represents the type of agent
type AgentType string

const (
	AgentTypeResearch      AgentType = "research"
	AgentTypeArchitect     AgentType = "architect"
	AgentTypeImplementation AgentType = "implementation"
	AgentTypeTesting       AgentType = "testing"
	AgentTypeReview        AgentType = "review"
	AgentTypeDocumentation AgentType = "documentation"
	AgentTypeDebugger      AgentType = "debugger"
)

// AgentStatus represents the status of an agent
type AgentStatus string

const (
	AgentStatusIdle       AgentStatus = "idle"
	AgentStatusBusy       AgentStatus = "busy"
	AgentStatusLearning   AgentStatus = "learning"
	AgentStatusError      AgentStatus = "error"
	AgentStatusMaintenance AgentStatus = "maintenance"
)

// TaskStatus represents the status of a task
type TaskStatus string

const (
	TaskStatusPending    TaskStatus = "pending"
	TaskStatusAssigned   TaskStatus = "assigned"
	TaskStatusRunning    TaskStatus = "running"
	TaskStatusCompleted  TaskStatus = "completed"
	TaskStatusFailed     TaskStatus = "failed"
	TaskStatusCancelled  TaskStatus = "cancelled"
)

// Agent represents an agent in the swarm
type Agent struct {
	ID          string
	Type        AgentType
	Name        string
	Description string
	Status      AgentStatus
	Capabilities []string
	CurrentTask *Task
	Stats       AgentStats
	Metadata    map[string]interface{}
	createdAt   time.Time
	updatedAt   time.Time
	mu          sync.RWMutex
}

// AgentStats represents agent statistics
type AgentStats struct {
	TasksCompleted int
	TasksFailed    int
	AverageDuration time.Duration
	TotalUptime    time.Duration
	LastActive     time.Time
}

// Task represents a task in the swarm
type Task struct {
	ID          string
	Description string
	AgentType   AgentType
	Priority    int
	Status      TaskStatus
	AgentID     string
	Dependencies []string
	Results     *protocol.CallToolResult
	Error       error
	CreatedAt   time.Time
	StartedAt   *time.Time
	CompletedAt *time.Time
	Metadata    map[string]interface{}
}


// Config represents swarm configuration
type Config struct {
	MaxAgentsPerType int
	DefaultAgentTypes []AgentType
	LoadBalanceStrategy string
	EnableBoomerang bool
	EnableSPARC bool
}

// NewConfig creates a default configuration
func NewConfig() *Config {
	return &Config{
		MaxAgentsPerType: 10,
		DefaultAgentTypes: []AgentType{
			AgentTypeResearch,
			AgentTypeArchitect,
			AgentTypeImplementation,
			AgentTypeTesting,
			AgentTypeReview,
		},
		LoadBalanceStrategy: "least-loaded",
		EnableBoomerang: true,
		EnableSPARC: true,
	}
}


// BoomerangTask represents a task that can be sent back for refinement
type BoomerangTask struct {
	OriginalTaskID string
	Feedback       string
	TargetAgent    AgentType
	Priority       int
	Iterations     int
	MaxIterations  int
	History        []BoomerangIteration
}

// BoomerangIteration represents one iteration of a boomerang task
type BoomerangIteration struct {
	Iteration int
	AgentID   string
	Result    *protocol.CallToolResult
	Error     error
	Timestamp time.Time
}

// WorkerPool represents a pool of worker agents
type WorkerPool struct {
	ID        string
	AgentType AgentType
	MinWorkers int
	MaxWorkers int
	Workers   []*Agent
	Queue     []*Task
	Strategy  string
	mu        sync.RWMutex
}