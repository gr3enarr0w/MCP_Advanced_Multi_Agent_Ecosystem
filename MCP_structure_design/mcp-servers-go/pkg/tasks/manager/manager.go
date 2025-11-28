// Package manager provides task management functionality for the Task Orchestrator
package manager

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/ceverson/mcp-advanced-multi-agent-ecosystem/pkg/database"
	"github.com/google/uuid"
)

// TaskStatus represents the status of a task
type TaskStatus string

const (
	TaskStatusPending    TaskStatus = "pending"
	TaskStatusInProgress TaskStatus = "in_progress"
	TaskStatusBlocked    TaskStatus = "blocked"
	TaskStatusCompleted  TaskStatus = "completed"
)

// Task represents a task in the system
type Task struct {
	ID                   int
	Title                string
	Description          string
	Status               TaskStatus
	Priority             int
	CreatedAt            time.Time
	UpdatedAt            time.Time
	CompletedAt          *time.Time
	Dependencies         []int
	GitCommits           []string
	Tags                 []string
	Metadata             map[string]interface{}
	ExecutionEnvironment string
	CodeLanguage         string
	TestResults          map[string]interface{}
	QualityScore         *int
	ExecutionLogs        map[string]interface{}
	ExecutionCount       int
	LastExecution        *time.Time
	AnalysisCount        int
}

// ExecutionStatus represents the status of a code execution
type ExecutionStatus string

const (
	ExecutionStatusQueued    ExecutionStatus = "queued"
	ExecutionStatusRunning   ExecutionStatus = "running"
	ExecutionStatusCompleted ExecutionStatus = "completed"
	ExecutionStatusFailed    ExecutionStatus = "failed"
	ExecutionStatusTimeout   ExecutionStatus = "timeout"
)

// Execution represents a code execution
type Execution struct {
	ID           string
	TaskID       int
	Language     string
	Code         string
	Status       ExecutionStatus
	Output       string
	Error        string
	ExecutionTime time.Duration
	MemoryUsage  int64
	StartTime    time.Time
	EndTime      *time.Time
	Environment  string
	Dependencies []string
	SecurityLevel string
	CreatedAt    time.Time
}

// AnalysisType represents the type of code analysis
type AnalysisType string

const (
	AnalysisTypeQuality    AnalysisType = "quality"
	AnalysisTypeSecurity   AnalysisType = "security"
	AnalysisTypeComplexity AnalysisType = "complexity"
)

// Analysis represents a code analysis result
type Analysis struct {
	ID           string
	TaskID       int
	AnalysisType AnalysisType
	TargetPath   string
	Results      map[string]interface{}
	QualityScore int
	Suggestions  []string
	Issues       []string
	ScanDuration time.Duration
	CreatedAt    time.Time
}

// TaskManager manages tasks and their related data
type TaskManager struct {
	db *database.DB
}

// NewTaskManager creates a new task manager
func NewTaskManager(dbPath string) (*TaskManager, error) {
	db, err := database.NewDB(&database.Config{
		Path: dbPath,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create database: %w", err)
	}

	// Run migrations
	migrations := []database.Migration{
		{
			Version:     1,
			Description: "Create tasks table",
			SQL:         database.CreateTableTasks(),
		},
		{
			Version:     2,
			Description: "Create code_executions table",
			SQL:         database.CreateTableCodeExecutions(),
		},
		{
			Version:     3,
			Description: "Create code_analysis table",
			SQL:         database.CreateTableCodeAnalysis(),
		},
	}

	// Add indexes
	for _, idxSQL := range database.CreateIndexes() {
		migrations = append(migrations, database.Migration{
			Version:     len(migrations) + 1,
			Description: "Create indexes",
			SQL:         idxSQL,
		})
	}

	if err := db.Migrate(migrations); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return &TaskManager{
		db: db,
	}, nil
}

// Close closes the task manager and its database connection
func (tm *TaskManager) Close() error {
	return tm.db.Close()
}

// CreateTask creates a new task
func (tm *TaskManager) CreateTask(ctx context.Context, task *Task) (int, error) {
	dependenciesJSON, _ := json.Marshal(task.Dependencies)
	gitCommitsJSON, _ := json.Marshal(task.GitCommits)
	tagsJSON, _ := json.Marshal(task.Tags)
	metadataJSON, _ := json.Marshal(task.Metadata)

	var executionEnv, codeLang sql.NullString
	if task.ExecutionEnvironment != "" {
		executionEnv = sql.NullString{String: task.ExecutionEnvironment, Valid: true}
	}
	if task.CodeLanguage != "" {
		codeLang = sql.NullString{String: task.CodeLanguage, Valid: true}
	}

	result, err := tm.db.ExecContext(ctx, `
		INSERT INTO tasks (
			title, description, status, priority, dependencies, git_commits, tags, metadata,
			execution_environment, code_language
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, task.Title, task.Description, task.Status, task.Priority,
		string(dependenciesJSON), string(gitCommitsJSON), string(tagsJSON), string(metadataJSON),
		executionEnv, codeLang)

	if err != nil {
		return 0, fmt.Errorf("failed to create task: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("failed to get task ID: %w", err)
	}

	return int(id), nil
}

// GetTask retrieves a task by ID
func (tm *TaskManager) GetTask(ctx context.Context, id int) (*Task, error) {
	row := tm.db.QueryRowContext(ctx, `
		SELECT id, title, description, status, priority, created_at, updated_at, completed_at,
			   dependencies, git_commits, tags, metadata, execution_environment, code_language,
			   test_results, quality_score, execution_logs
		FROM tasks WHERE id = ?
	`, id)

	return tm.scanTask(row)
}

// UpdateTaskStatus updates the status of a task
func (tm *TaskManager) UpdateTaskStatus(ctx context.Context, id int, status TaskStatus) error {
	var completedAt sql.NullTime
	if status == TaskStatusCompleted {
		completedAt = sql.NullTime{Time: time.Now(), Valid: true}
	}

	_, err := tm.db.ExecContext(ctx, `
		UPDATE tasks 
		SET status = ?, updated_at = CURRENT_TIMESTAMP, completed_at = ?
		WHERE id = ?
	`, status, completedAt, id)

	return err
}

// ListTasks lists all tasks with optional filtering
func (tm *TaskManager) ListTasks(ctx context.Context, status *TaskStatus, codeLanguage string) ([]*Task, error) {
	query := `SELECT id, title, description, status, priority, created_at, updated_at, completed_at,
			  dependencies, git_commits, tags, metadata, execution_environment, code_language,
			  test_results, quality_score, execution_logs FROM tasks WHERE 1=1`
	args := []interface{}{}

	if status != nil {
		query += " AND status = ?"
		args = append(args, *status)
	}

	if codeLanguage != "" {
		query += " AND code_language = ?"
		args = append(args, codeLanguage)
	}

	query += " ORDER BY priority DESC, created_at ASC"

	rows, err := tm.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list tasks: %w", err)
	}
	defer rows.Close()

	var tasks []*Task
	for rows.Next() {
		task, err := tm.scanTask(rows)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, task)
	}

	return tasks, rows.Err()
}

// DeleteTask deletes a task
func (tm *TaskManager) DeleteTask(ctx context.Context, id int) error {
	_, err := tm.db.ExecContext(ctx, "DELETE FROM tasks WHERE id = ?", id)
	return err
}

// AddGitCommit adds a git commit to a task
func (tm *TaskManager) AddGitCommit(ctx context.Context, taskID int, commitSHA string) error {
	// Get current commits
	var commitsJSON string
	err := tm.db.QueryRowContext(ctx, "SELECT git_commits FROM tasks WHERE id = ?", taskID).Scan(&commitsJSON)
	if err != nil {
		return fmt.Errorf("failed to get task: %w", err)
	}

	var commits []string
	if err := json.Unmarshal([]byte(commitsJSON), &commits); err != nil {
		return fmt.Errorf("failed to parse commits: %w", err)
	}

	// Add new commit
	commits = append(commits, commitSHA)
	newCommitsJSON, _ := json.Marshal(commits)

	_, err = tm.db.ExecContext(ctx, "UPDATE tasks SET git_commits = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
		string(newCommitsJSON), taskID)
	return err
}

// CreateExecution creates a code execution record
func (tm *TaskManager) CreateExecution(ctx context.Context, taskID int, execution *Execution) error {
	dependenciesJSON, _ := json.Marshal(execution.Dependencies)

	_, err := tm.db.ExecContext(ctx, `
		INSERT INTO code_executions (
			id, task_id, language, code, status, output, error, execution_time_ms,
			memory_usage_bytes, start_time, end_time, environment, dependencies, security_level
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, execution.ID, execution.TaskID, execution.Language, execution.Code, execution.Status,
		execution.Output, execution.Error, execution.ExecutionTime.Milliseconds(), execution.MemoryUsage,
		execution.StartTime, execution.EndTime, execution.Environment, string(dependenciesJSON), execution.SecurityLevel)

	return err
}

// GetTaskExecutions retrieves all executions for a task
func (tm *TaskManager) GetTaskExecutions(ctx context.Context, taskID int) ([]*Execution, error) {
	rows, err := tm.db.QueryContext(ctx, `
		SELECT id, task_id, language, code, status, output, error, execution_time_ms,
			   memory_usage_bytes, start_time, end_time, environment, dependencies, security_level, created_at
		FROM code_executions WHERE task_id = ? ORDER BY created_at DESC
	`, taskID)
	if err != nil {
		return nil, fmt.Errorf("failed to get executions: %w", err)
	}
	defer rows.Close()

	var executions []*Execution
	for rows.Next() {
		execution, err := tm.scanExecution(rows)
		if err != nil {
			return nil, err
		}
		executions = append(executions, execution)
	}

	return executions, rows.Err()
}

// CreateAnalysis creates a code analysis record
func (tm *TaskManager) CreateAnalysis(ctx context.Context, analysis *Analysis) error {
	resultsJSON, _ := json.Marshal(analysis.Results)
	suggestionsJSON, _ := json.Marshal(analysis.Suggestions)
	issuesJSON, _ := json.Marshal(analysis.Issues)

	_, err := tm.db.ExecContext(ctx, `
		INSERT INTO code_analysis (
			id, task_id, analysis_type, target_path, results, quality_score, suggestions, issues, scan_duration_ms
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, analysis.ID, analysis.TaskID, analysis.AnalysisType, analysis.TargetPath,
		string(resultsJSON), analysis.QualityScore, string(suggestionsJSON), string(issuesJSON),
		analysis.ScanDuration.Milliseconds())

	return err
}

// GetTaskAnalysis retrieves all analysis for a task
func (tm *TaskManager) GetTaskAnalysis(ctx context.Context, taskID int) ([]*Analysis, error) {
	rows, err := tm.db.QueryContext(ctx, `
		SELECT id, task_id, analysis_type, target_path, results, quality_score, suggestions, issues, scan_duration_ms, created_at
		FROM code_analysis WHERE task_id = ? ORDER BY created_at DESC
	`, taskID)
	if err != nil {
		return nil, fmt.Errorf("failed to get analysis: %w", err)
	}
	defer rows.Close()

	var analyses []*Analysis
	for rows.Next() {
		analysis, err := tm.scanAnalysis(rows)
		if err != nil {
			return nil, err
		}
		analyses = append(analyses, analysis)
	}

	return analyses, rows.Err()
}

// Helper methods

func (tm *TaskManager) scanTask(scanner interface{ Scan(...interface{}) error }) (*Task, error) {
	var (
		id, priority, qualityScore                                   int
		title, description, status, dependenciesJSON, gitCommitsJSON, tagsJSON, metadataJSON string
		createdAt, updatedAt                                         time.Time
		completedAt                                                  sql.NullTime
		executionEnv, codeLang, testResultsJSON, executionLogsJSON  sql.NullString
	)

	err := scanner.Scan(
		&id, &title, &description, &status, &priority, &createdAt, &updatedAt, &completedAt,
		&dependenciesJSON, &gitCommitsJSON, &tagsJSON, &metadataJSON,
		&executionEnv, &codeLang, &testResultsJSON, &qualityScore, &executionLogsJSON,
	)
	if err != nil {
		return nil, err
	}

	task := &Task{
		ID:          id,
		Title:       title,
		Description: description,
		Status:      TaskStatus(status),
		Priority:    priority,
		CreatedAt:   createdAt,
		UpdatedAt:   updatedAt,
	}

	if completedAt.Valid {
		task.CompletedAt = &completedAt.Time
	}

	// Parse JSON fields
	if err := json.Unmarshal([]byte(dependenciesJSON), &task.Dependencies); err != nil {
		task.Dependencies = []int{}
	}
	if err := json.Unmarshal([]byte(gitCommitsJSON), &task.GitCommits); err != nil {
		task.GitCommits = []string{}
	}
	if err := json.Unmarshal([]byte(tagsJSON), &task.Tags); err != nil {
		task.Tags = []string{}
	}
	if err := json.Unmarshal([]byte(metadataJSON), &task.Metadata); err != nil {
		task.Metadata = make(map[string]interface{})
	}

	if executionEnv.Valid {
		task.ExecutionEnvironment = executionEnv.String
	}
	if codeLang.Valid {
		task.CodeLanguage = codeLang.String
	}
	if testResultsJSON.Valid {
		json.Unmarshal([]byte(testResultsJSON.String), &task.TestResults)
	}
	if qualityScore > 0 {
		task.QualityScore = &qualityScore
	}
	if executionLogsJSON.Valid {
		json.Unmarshal([]byte(executionLogsJSON.String), &task.ExecutionLogs)
	}

	return task, nil
}

func (tm *TaskManager) scanExecution(scanner interface{ Scan(...interface{}) error }) (*Execution, error) {
	var (
		id, language, code, status, output, errorMsg, environment, securityLevel string
		taskID, executionTimeMs, memoryUsageBytes                                 int
		startTime, createdAt                                                       time.Time
		endTime                                                                    sql.NullTime
		dependenciesJSON                                                           string
	)

	err := scanner.Scan(
		&id, &taskID, &language, &code, &status, &output, &errorMsg, &executionTimeMs,
		&memoryUsageBytes, &startTime, &endTime, &environment, &dependenciesJSON, &securityLevel, &createdAt,
	)
	if err != nil {
		return nil, err
	}

	execution := &Execution{
		ID:            id,
		TaskID:        taskID,
		Language:      language,
		Code:          code,
		Status:        ExecutionStatus(status),
		Output:        output,
		Error:         errorMsg,
		ExecutionTime: time.Duration(executionTimeMs) * time.Millisecond,
		MemoryUsage:   int64(memoryUsageBytes),
		StartTime:     startTime,
		Environment:   environment,
		SecurityLevel: securityLevel,
		CreatedAt:     createdAt,
	}

	if endTime.Valid {
		execution.EndTime = &endTime.Time
	}

	json.Unmarshal([]byte(dependenciesJSON), &execution.Dependencies)

	return execution, nil
}

func (tm *TaskManager) scanAnalysis(scanner interface{ Scan(...interface{}) error }) (*Analysis, error) {
	var (
		id, analysisType, targetPath, resultsJSON, suggestionsJSON, issuesJSON string
		taskID, qualityScore, scanDurationMs                                    int
		createdAt                                                               time.Time
	)

	err := scanner.Scan(
		&id, &taskID, &analysisType, &targetPath, &resultsJSON, &qualityScore, &suggestionsJSON, &issuesJSON,
		&scanDurationMs, &createdAt,
	)
	if err != nil {
		return nil, err
	}

	analysis := &Analysis{
		ID:           id,
		TaskID:       taskID,
		AnalysisType: AnalysisType(analysisType),
		TargetPath:   targetPath,
		QualityScore: qualityScore,
		ScanDuration: time.Duration(scanDurationMs) * time.Millisecond,
		CreatedAt:    createdAt,
	}

	json.Unmarshal([]byte(resultsJSON), &analysis.Results)
	json.Unmarshal([]byte(suggestionsJSON), &analysis.Suggestions)
	json.Unmarshal([]byte(issuesJSON), &analysis.Issues)

	return analysis, nil
}

// ParseTaskStatus parses a string into a TaskStatus
func ParseTaskStatus(s string) (TaskStatus, error) {
	switch TaskStatus(strings.ToLower(s)) {
	case TaskStatusPending, TaskStatusInProgress, TaskStatusBlocked, TaskStatusCompleted:
		return TaskStatus(strings.ToLower(s)), nil
	default:
		return "", fmt.Errorf("invalid task status: %s", s)
	}
}

// GenerateExecutionID generates a unique execution ID
func GenerateExecutionID() string {
	return uuid.New().String()
}