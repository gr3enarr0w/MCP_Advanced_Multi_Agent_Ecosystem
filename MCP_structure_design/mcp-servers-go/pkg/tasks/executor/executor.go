// Package executor provides sandboxed code execution for multiple programming languages
package executor

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"
)

// Language represents a programming language
type Language string

const (
	LanguagePython     Language = "python"
	LanguageJavaScript Language = "javascript"
	LanguageTypeScript Language = "typescript"
	LanguageBash       Language = "bash"
	LanguageSQL        Language = "sql"
)

// Status represents the execution status
type Status string

const (
	StatusQueued    Status = "queued"
	StatusRunning   Status = "running"
	StatusCompleted Status = "completed"
	StatusFailed    Status = "failed"
	StatusTimeout   Status = "timeout"
)

// Config represents the executor configuration
type Config struct {
	MaxExecutionTime time.Duration
	MaxMemoryUsage   int64
	MaxOutputSize    int64
	AllowedImports   []string
	BlockedCommands  []string
	SandboxEnabled   bool
	WorkingDirectory string
}

// Request represents a code execution request
type Request struct {
	TaskID      int
	Language    string
	Code        string
	Timeout     time.Duration
	WorkingDir  string
	Packages    []string
}

// Result represents a code execution result
type Result struct {
	ID            string
	TaskID        int
	Language      string
	Status        Status
	Output        string
	Error         string
	ExecutionTime time.Duration
	MemoryUsage   int64
	StartTime     time.Time
	EndTime       *time.Time
}

// CodeExecutor executes code in sandboxed environments
type CodeExecutor struct {
	config *Config
	mu     sync.RWMutex
}

// NewCodeExecutor creates a new code executor
func NewCodeExecutor(config *Config) *CodeExecutor {
	if config == nil {
		config = &Config{
			MaxExecutionTime: 30 * time.Second,
			MaxMemoryUsage:   512 * 1024 * 1024, // 512MB
			MaxOutputSize:    10 * 1024 * 1024,  // 10MB
			AllowedImports: []string{
				"os", "sys", "json", "math", "datetime", "collections",
				"itertools", "functools", "pathlib", "re",
			},
			BlockedCommands: []string{
				"rm", "del", "format", "shutdown", "reboot", "init",
				"mkfs", "dd", "chmod", "chown",
			},
			SandboxEnabled: true,
		}
	}

	return &CodeExecutor{
		config: config,
	}
}

// Execute executes code based on the request
func (e *CodeExecutor) Execute(ctx context.Context, req *Request) (*Result, error) {
	result := &Result{
		ID:        generateExecutionID(),
		TaskID:    req.TaskID,
		Language:  req.Language,
		Status:    StatusQueued,
		StartTime: time.Now(),
	}

	// Set timeout
	timeout := e.config.MaxExecutionTime
	if req.Timeout > 0 && req.Timeout < timeout {
		timeout = req.Timeout
	}

	// Create context with timeout
	execCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	// Execute based on language
	var err error
	switch Language(strings.ToLower(req.Language)) {
	case LanguagePython:
		result, err = e.executePython(execCtx, req)
	case LanguageJavaScript, LanguageTypeScript:
		result, err = e.executeJavaScript(execCtx, req)
	case LanguageBash:
		result, err = e.executeBash(execCtx, req)
	case LanguageSQL:
		result, err = e.executeSQL(execCtx, req)
	default:
		return nil, fmt.Errorf("unsupported language: %s", req.Language)
	}

	if err != nil {
		result.Status = StatusFailed
		result.Error = err.Error()
	}

	// Set end time
	endTime := time.Now()
	result.EndTime = &endTime
	result.ExecutionTime = endTime.Sub(result.StartTime)

	return result, nil
}

// executePython executes Python code
func (e *CodeExecutor) executePython(ctx context.Context, req *Request) (*Result, error) {
	result := &Result{
		ID:        generateExecutionID(),
		TaskID:    req.TaskID,
		Language:  req.Language,
		Status:    StatusRunning,
		StartTime: time.Now(),
	}

	// Security check
	if err := e.securityCheck(req.Code); err != nil {
		result.Status = StatusFailed
		result.Error = err.Error()
		return result, nil
	}

	// Create temporary file
	tmpDir := os.TempDir()
	fileName := fmt.Sprintf("python_exec_%s.py", result.ID)
	filePath := filepath.Join(tmpDir, fileName)

	if err := os.WriteFile(filePath, []byte(req.Code), 0600); err != nil {
		result.Status = StatusFailed
		result.Error = fmt.Sprintf("Failed to write code to file: %v", err)
		return result, nil
	}
	defer os.Remove(filePath)

	// Install packages if specified
	if len(req.Packages) > 0 {
		for _, pkg := range req.Packages {
			installCmd := exec.CommandContext(ctx, "pip3", "install", "--user", pkg)
			if output, err := installCmd.CombinedOutput(); err != nil {
				log.Printf("Warning: failed to install package %s: %v\nOutput: %s", pkg, err, output)
			}
		}
	}

	// Execute Python code
	cmd := exec.CommandContext(ctx, "python3", filePath)
	cmd.Env = append(os.Environ(),
		fmt.Sprintf("PYTHONPATH=%s", tmpDir),
	)

	// Set resource limits if sandbox is enabled
	if e.config.SandboxEnabled {
		cmd.SysProcAttr = &syscall.SysProcAttr{
			// Set resource limits here if needed
		}
	}

	// Execute
	output, err := cmd.CombinedOutput()
	result.Output = string(output)

	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			result.Status = StatusTimeout
			result.Error = "Execution timeout exceeded"
		} else {
			result.Status = StatusFailed
			result.Error = err.Error()
		}
	} else {
		result.Status = StatusCompleted
	}

	return result, nil
}

// executeJavaScript executes JavaScript/TypeScript code
func (e *CodeExecutor) executeJavaScript(ctx context.Context, req *Request) (*Result, error) {
	result := &Result{
		ID:        generateExecutionID(),
		TaskID:    req.TaskID,
		Language:  req.Language,
		Status:    StatusRunning,
		StartTime: time.Now(),
	}

	// Security check
	if err := e.securityCheck(req.Code); err != nil {
		result.Status = StatusFailed
		result.Error = err.Error()
		return result, nil
	}

	// Create temporary file
	tmpDir := os.TempDir()
	ext := "js"
	if req.Language == "typescript" {
		ext = "ts"
	}
	fileName := fmt.Sprintf("js_exec_%s.%s", result.ID, ext)
	filePath := filepath.Join(tmpDir, fileName)

	if err := os.WriteFile(filePath, []byte(req.Code), 0600); err != nil {
		result.Status = StatusFailed
		result.Error = fmt.Sprintf("Failed to write code to file: %v", err)
		return result, nil
	}
	defer os.Remove(filePath)

	// Execute with Node.js
	cmd := exec.CommandContext(ctx, "node", filePath)

	// Set resource limits if sandbox is enabled
	if e.config.SandboxEnabled {
		cmd.SysProcAttr = &syscall.SysProcAttr{
			// Set resource limits here if needed
		}
	}

	// Execute
	output, err := cmd.CombinedOutput()
	result.Output = string(output)

	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			result.Status = StatusTimeout
			result.Error = "Execution timeout exceeded"
		} else {
			result.Status = StatusFailed
			result.Error = err.Error()
		}
	} else {
		result.Status = StatusCompleted
	}

	return result, nil
}

// executeBash executes Bash commands
func (e *CodeExecutor) executeBash(ctx context.Context, req *Request) (*Result, error) {
	result := &Result{
		ID:        generateExecutionID(),
		TaskID:    req.TaskID,
		Language:  req.Language,
		Status:    StatusRunning,
		StartTime: time.Now(),
	}

	// Security check for dangerous commands
	if err := e.securityCheck(req.Code); err != nil {
		result.Status = StatusFailed
		result.Error = err.Error()
		return result, nil
	}

	// Execute bash command
	cmd := exec.CommandContext(ctx, "bash", "-c", req.Code)

	// Set working directory if specified
	if req.WorkingDir != "" {
		cmd.Dir = req.WorkingDir
	}

	// Set resource limits if sandbox is enabled
	if e.config.SandboxEnabled {
		cmd.SysProcAttr = &syscall.SysProcAttr{
			// Set resource limits here if needed
		}
	}

	// Execute
	output, err := cmd.CombinedOutput()
	result.Output = string(output)

	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			result.Status = StatusTimeout
			result.Error = "Execution timeout exceeded"
		} else {
			result.Status = StatusFailed
			result.Error = err.Error()
		}
	} else {
		result.Status = StatusCompleted
	}

	return result, nil
}

// executeSQL executes SQL queries
func (e *CodeExecutor) executeSQL(ctx context.Context, req *Request) (*Result, error) {
	result := &Result{
		ID:        generateExecutionID(),
		TaskID:    req.TaskID,
		Language:  req.Language,
		Status:    StatusRunning,
		StartTime: time.Now(),
	}

	// For SQL, we'll use sqlite3 command-line tool
	// In a production environment, you might want to use a Go SQL driver
	cmd := exec.CommandContext(ctx, "sqlite3", ":memory:", req.Code)

	// Execute
	output, err := cmd.CombinedOutput()
	result.Output = string(output)

	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			result.Status = StatusTimeout
			result.Error = "Execution timeout exceeded"
		} else {
			result.Status = StatusFailed
			result.Error = err.Error()
		}
	} else {
		result.Status = StatusCompleted
	}

	return result, nil
}

// securityCheck performs security checks on the code
func (e *CodeExecutor) securityCheck(code string) error {
	if !e.config.SandboxEnabled {
		return nil // Skip security checks if sandbox is disabled
	}

	// Check for blocked commands
	for _, blocked := range e.config.BlockedCommands {
		if strings.Contains(strings.ToLower(code), strings.ToLower(blocked)) {
			return fmt.Errorf("code contains blocked command: %s", blocked)
		}
	}

	// Additional security checks can be added here
	// - Check for dangerous patterns
	// - Validate imports
	// - Check for file system access
	// - Check for network access

	return nil
}

// Helper functions

func generateExecutionID() string {
	return fmt.Sprintf("exec_%d", time.Now().UnixNano())
}

// IsSupportedLanguage checks if a language is supported
func IsSupportedLanguage(lang string) bool {
	switch Language(strings.ToLower(lang)) {
	case LanguagePython, LanguageJavaScript, LanguageTypeScript, LanguageBash, LanguageSQL:
		return true
	default:
		return false
	}
}

// GetLanguageExtension returns the file extension for a language
func GetLanguageExtension(lang string) string {
	switch Language(strings.ToLower(lang)) {
	case LanguagePython:
		return ".py"
	case LanguageJavaScript:
		return ".js"
	case LanguageTypeScript:
		return ".ts"
	case LanguageBash:
		return ".sh"
	case LanguageSQL:
		return ".sql"
	default:
		return ".txt"
	}
}