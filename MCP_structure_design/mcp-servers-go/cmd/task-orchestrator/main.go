package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/ceverson/mcp-advanced-multi-agent-ecosystem/pkg/mcp/protocol"
	"github.com/ceverson/mcp-advanced-multi-agent-ecosystem/pkg/mcp/server"
	"github.com/ceverson/mcp-advanced-multi-agent-ecosystem/pkg/tasks/manager"
	"github.com/ceverson/mcp-advanced-multi-agent-ecosystem/pkg/tasks/executor"
)

var (
	version = "1.0.0"
)

func main() {
	var (
		showVersion = flag.Bool("version", false, "Show version information")
		dbPath      = flag.String("db", "", "Database path (default: ~/.mcp/tasks/tasks.db)")
	)
	flag.Parse()

	if *showVersion {
		fmt.Printf("Task Orchestrator MCP Server v%s\n", version)
		os.Exit(0)
	}

	// Set up database path
	if *dbPath == "" {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			log.Fatalf("Failed to get home directory: %v", err)
		}
		*dbPath = filepath.Join(homeDir, ".mcp", "tasks", "tasks.db")
	}

	// Ensure directory exists
	dbDir := filepath.Dir(*dbPath)
	if err := os.MkdirAll(dbDir, 0755); err != nil {
		log.Fatalf("Failed to create database directory: %v", err)
	}

	// Initialize task manager
	taskManager, err := manager.NewTaskManager(*dbPath)
	if err != nil {
		log.Fatalf("Failed to initialize task manager: %v", err)
	}
	defer taskManager.Close()

	// Initialize code executor
	codeExecutor := executor.NewCodeExecutor(&executor.Config{
		MaxExecutionTime: 30 * time.Second,
		MaxMemoryUsage:   512 * 1024 * 1024, // 512MB
		MaxOutputSize:    10 * 1024 * 1024,  // 10MB
		SandboxEnabled:   true,
	})

	// Create MCP server
	mcpServer := server.NewServer("task-orchestrator", version, &server.Capabilities{
		Tools: &server.ToolsCapability{
			ListChanged: false,
		},
	})

	// Register tool handlers
	registerTools(mcpServer, taskManager, codeExecutor)

	// Set up signal handling
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		sig := <-sigChan
		log.Printf("Received signal %v, shutting down...", sig)
		cancel()
	}()

	// Run server
	log.Printf("Task Orchestrator MCP Server v%s starting...", version)
	log.Printf("Database: %s", *dbPath)

	if err := mcpServer.Run(ctx, os.Stdin, os.Stdout); err != nil {
		log.Fatalf("Server error: %v", err)
	}

	log.Println("Server stopped")
}

func registerTools(s *server.Server, taskManager *manager.TaskManager, codeExecutor *executor.CodeExecutor) {
	// Create task
	s.RegisterTool("create_task", &server.Tool{
		Name:        "create_task",
		Description: "Create a new task with optional dependencies and code execution environment",
		Handler: func(ctx context.Context, args map[string]interface{}) (*protocol.CallToolResult, error) {
			title, ok := args["title"].(string)
			if !ok || title == "" {
				return nil, fmt.Errorf("title is required")
			}

			description := getString(args, "description", "")
			priority := getInt(args, "priority", 0)
			dependencies := getIntSlice(args, "dependencies")
			tags := getStringSlice(args, "tags")
			executionEnv := getString(args, "execution_environment", "")
			codeLanguage := getString(args, "code_language", "")

			task := &manager.Task{
				Title:       title,
				Description: description,
				Priority:    priority,
				Dependencies: dependencies,
				Tags:        tags,
				ExecutionEnvironment: executionEnv,
				CodeLanguage: codeLanguage,
				Status:      manager.TaskStatusPending,
			}

			id, err := taskManager.CreateTask(ctx, task)
			if err != nil {
				return nil, fmt.Errorf("failed to create task: %w", err)
			}

			result := map[string]interface{}{
				"task_id":              id,
				"title":                title,
				"status":               "created",
				"execution_environment": executionEnv,
				"code_language":        codeLanguage,
			}

			return createToolResult(result), nil
		},
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"title":                map[string]interface{}{"type": "string"},
				"description":          map[string]interface{}{"type": "string"},
				"priority":             map[string]interface{}{"type": "number", "default": 0},
				"dependencies":         map[string]interface{}{"type": "array", "items": map[string]interface{}{"type": "number"}},
				"tags":                 map[string]interface{}{"type": "array", "items": map[string]interface{}{"type": "string"}},
				"execution_environment": map[string]interface{}{"type": "string"},
				"code_language":        map[string]interface{}{"type": "string"},
			},
			"required": []string{"title"},
		},
	})

	// Update task status
	s.RegisterTool("update_task_status", &server.Tool{
		Name:        "update_task_status",
		Description: "Update the status of a task",
		Handler: func(ctx context.Context, args map[string]interface{}) (*protocol.CallToolResult, error) {
			taskID := getInt(args, "task_id", 0)
			if taskID == 0 {
				return nil, fmt.Errorf("task_id is required")
			}

			statusStr := getString(args, "status", "")
			status, err := manager.ParseTaskStatus(statusStr)
			if err != nil {
				return nil, fmt.Errorf("invalid status: %w", err)
			}

			if err := taskManager.UpdateTaskStatus(ctx, taskID, status); err != nil {
				return nil, fmt.Errorf("failed to update task status: %w", err)
			}

			return createToolResult(map[string]interface{}{
				"task_id": taskID,
				"status":  statusStr,
				"updated": true,
			}), nil
		},
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"task_id": map[string]interface{}{"type": "number"},
				"status":  map[string]interface{}{"type": "string", "enum": []string{"pending", "in_progress", "blocked", "completed"}},
			},
			"required": []string{"task_id", "status"},
		},
	})

	// Get task
	s.RegisterTool("get_task", &server.Tool{
		Name:        "get_task",
		Description: "Get details of a specific task including execution history",
		Handler: func(ctx context.Context, args map[string]interface{}) (*protocol.CallToolResult, error) {
			taskID := getInt(args, "task_id", 0)
			if taskID == 0 {
				return nil, fmt.Errorf("task_id is required")
			}

			includeExecutions := getBool(args, "include_executions", false)
			includeAnalysis := getBool(args, "include_analysis", false)

			task, err := taskManager.GetTask(ctx, taskID)
			if err != nil {
				return nil, fmt.Errorf("failed to get task: %w", err)
			}

			if task == nil {
				return createErrorResult("Task not found"), nil
			}

			result := map[string]interface{}{
				"task": task,
			}

			if includeExecutions {
				executions, err := taskManager.GetTaskExecutions(ctx, taskID)
				if err != nil {
					log.Printf("Warning: failed to get executions: %v", err)
				} else {
					result["executions"] = executions
				}
			}

			if includeAnalysis {
				analysis, err := taskManager.GetTaskAnalysis(ctx, taskID)
				if err != nil {
					log.Printf("Warning: failed to get analysis: %v", err)
				} else {
					result["analysis"] = analysis
				}
			}

			return createToolResult(result), nil
		},
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"task_id":           map[string]interface{}{"type": "number"},
				"include_executions": map[string]interface{}{"type": "boolean", "default": false},
				"include_analysis":   map[string]interface{}{"type": "boolean", "default": false},
			},
			"required": []string{"task_id"},
		},
	})

	// List tasks
	s.RegisterTool("list_tasks", &server.Tool{
		Name:        "list_tasks",
		Description: "List all tasks, optionally filtered by status or language",
		Handler: func(ctx context.Context, args map[string]interface{}) (*protocol.CallToolResult, error) {
			statusStr := getString(args, "status", "")
			var status *manager.TaskStatus
			if statusStr != "" {
				s, err := manager.ParseTaskStatus(statusStr)
				if err != nil {
					return nil, fmt.Errorf("invalid status: %w", err)
				}
				status = &s
			}

			codeLanguage := getString(args, "code_language", "")
			includeMetrics := getBool(args, "include_metrics", false)

			tasks, err := taskManager.ListTasks(ctx, status, codeLanguage)
			if err != nil {
				return nil, fmt.Errorf("failed to list tasks: %w", err)
			}

			result := map[string]interface{}{
				"count": len(tasks),
				"tasks": tasks,
			}

			if includeMetrics {
				// Add execution metrics
				for _, task := range tasks {
					executions, _ := taskManager.GetTaskExecutions(ctx, task.ID)
					analysis, _ := taskManager.GetTaskAnalysis(ctx, task.ID)
					
					task.ExecutionCount = len(executions)
					if len(executions) > 0 {
						task.LastExecution = &executions[0].CreatedAt
					}
					task.AnalysisCount = len(analysis)
				}
			}

			return createToolResult(result), nil
		},
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"status":          map[string]interface{}{"type": "string", "enum": []string{"pending", "in_progress", "blocked", "completed"}},
				"code_language":   map[string]interface{}{"type": "string"},
				"include_metrics": map[string]interface{}{"type": "boolean", "default": false},
			},
		},
	})

	// Execute code
	s.RegisterTool("execute_code", &server.Tool{
		Name:        "execute_code",
		Description: "Execute code in multiple programming languages",
		Handler: func(ctx context.Context, args map[string]interface{}) (*protocol.CallToolResult, error) {
			taskID := getInt(args, "task_id", 0)
			if taskID == 0 {
				return nil, fmt.Errorf("task_id is required")
			}

			language := getString(args, "language", "")
			code := getString(args, "code", "")
			if code == "" {
				return nil, fmt.Errorf("code is required")
			}

			timeout := getDuration(args, "timeout", 30*time.Second)
			workingDir := getString(args, "working_directory", "")
			packages := getStringSlice(args, "packages")

			req := &executor.Request{
				TaskID:     taskID,
				Language:   language,
				Code:       code,
				Timeout:    timeout,
				WorkingDir: workingDir,
				Packages:   packages,
			}

			result, err := codeExecutor.Execute(ctx, req)
			if err != nil {
				return nil, fmt.Errorf("code execution failed: %w", err)
			}

			// Convert executor.Result to manager.Execution for storage
			execution := &manager.Execution{
				ID:            result.ID,
				TaskID:        result.TaskID,
				Language:      result.Language,
				Code:          req.Code,
				Status:        manager.ExecutionStatus(result.Status),
				Output:        result.Output,
				Error:         result.Error,
				ExecutionTime: result.ExecutionTime,
				MemoryUsage:   result.MemoryUsage,
				StartTime:     result.StartTime,
				Environment:   req.WorkingDir,
				Dependencies:  req.Packages,
				SecurityLevel: "medium",
				CreatedAt:     time.Now(),
			}
			if result.EndTime != nil {
				execution.EndTime = result.EndTime
			}

			// Store execution in database
			if err := taskManager.CreateExecution(ctx, taskID, execution); err != nil {
				log.Printf("Warning: failed to store execution: %v", err)
			}

			return createToolResult(map[string]interface{}{
				"execution_id":      result.ID,
				"task_id":           taskID,
				"language":          language,
				"status":            string(result.Status),
				"output":            result.Output,
				"error":             result.Error,
				"execution_time_ms": result.ExecutionTime.Milliseconds(),
				"memory_usage_mb":   result.MemoryUsage / 1024 / 1024,
			}), nil
		},
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"task_id":          map[string]interface{}{"type": "number"},
				"language":         map[string]interface{}{"type": "string", "enum": []string{"python", "javascript", "typescript", "bash", "sql"}},
				"code":             map[string]interface{}{"type": "string"},
				"timeout":          map[string]interface{}{"type": "number"},
				"working_directory": map[string]interface{}{"type": "string"},
				"packages":         map[string]interface{}{"type": "array", "items": map[string]interface{}{"type": "string"}},
			},
			"required": []string{"task_id", "language", "code"},
		},
	})
}

// Helper functions

func getString(m map[string]interface{}, key, defaultValue string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return defaultValue
}

func getInt(m map[string]interface{}, key string, defaultValue int) int {
	if v, ok := m[key].(float64); ok {
		return int(v)
	}
	if v, ok := m[key].(int); ok {
		return v
	}
	return defaultValue
}

func getIntSlice(m map[string]interface{}, key string) []int {
	if v, ok := m[key].([]interface{}); ok {
		result := make([]int, len(v))
		for i, item := range v {
			if num, ok := item.(float64); ok {
				result[i] = int(num)
			} else if num, ok := item.(int); ok {
				result[i] = num
			}
		}
		return result
	}
	return nil
}

func getStringSlice(m map[string]interface{}, key string) []string {
	if v, ok := m[key].([]interface{}); ok {
		result := make([]string, len(v))
		for i, item := range v {
			if str, ok := item.(string); ok {
				result[i] = str
			}
		}
		return result
	}
	return nil
}

func getBool(m map[string]interface{}, key string, defaultValue bool) bool {
	if v, ok := m[key].(bool); ok {
		return v
	}
	return defaultValue
}

func getDuration(m map[string]interface{}, key string, defaultValue time.Duration) time.Duration {
	if v, ok := m[key].(float64); ok {
		return time.Duration(v) * time.Millisecond
	}
	return defaultValue
}

func createToolResult(data interface{}) *protocol.CallToolResult {
	jsonData, _ := json.MarshalIndent(data, "", "  ")
	return &protocol.CallToolResult{
		Content: []protocol.Content{
			{
				Type: "text",
				Text: string(jsonData),
			},
		},
		IsError: false,
	}
}

func createErrorResult(message string) *protocol.CallToolResult {
	return &protocol.CallToolResult{
		Content: []protocol.Content{
			{
				Type: "text",
				Text: fmt.Sprintf(`{"error": %q}`, message),
			},
		},
		IsError: true,
	}
}