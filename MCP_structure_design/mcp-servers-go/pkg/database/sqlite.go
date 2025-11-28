// Package database provides SQLite database utilities for MCP servers
package database

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	_ "modernc.org/sqlite"
)

// DB represents a SQLite database connection
type DB struct {
	conn   *sql.DB
	path   string
	mu     sync.RWMutex
	closed bool
}

// Config represents database configuration
type Config struct {
	Path string
}

// NewDB creates a new database connection
func NewDB(config *Config) (*DB, error) {
	if config.Path == "" {
		return nil, fmt.Errorf("database path is required")
	}

	// Ensure directory exists
	dbDir := filepath.Dir(config.Path)
	if err := os.MkdirAll(dbDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create database directory: %w", err)
	}

	// Open database connection
	conn, err := sql.Open("sqlite", config.Path)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Configure connection
	conn.SetMaxOpenConns(1) // SQLite works best with single connection
	conn.SetMaxIdleConns(1)

	// Test connection
	if err := conn.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	db := &DB{
		conn: conn,
		path: config.Path,
	}

	return db, nil
}

// Close closes the database connection
func (db *DB) Close() error {
	db.mu.Lock()
	defer db.mu.Unlock()

	if db.closed {
		return nil
	}

	db.closed = true
	return db.conn.Close()
}

// Conn returns the raw database connection
func (db *DB) Conn() *sql.DB {
	db.mu.RLock()
	defer db.mu.RUnlock()
	return db.conn
}

// Exec executes a query without returning rows
func (db *DB) Exec(query string, args ...interface{}) (sql.Result, error) {
	db.mu.Lock()
	defer db.mu.Unlock()

	if db.closed {
		return nil, fmt.Errorf("database is closed")
	}

	return db.conn.Exec(query, args...)
}

// ExecContext executes a query without returning rows with context
func (db *DB) ExecContext(ctx context.Context, query string, args ...interface{}) (sql.Result, error) {
	db.mu.Lock()
	defer db.mu.Unlock()

	if db.closed {
		return nil, fmt.Errorf("database is closed")
	}

	return db.conn.ExecContext(ctx, query, args...)
}

// Query executes a query that returns rows
func (db *DB) Query(query string, args ...interface{}) (*sql.Rows, error) {
	db.mu.RLock()
	defer db.mu.RUnlock()

	if db.closed {
		return nil, fmt.Errorf("database is closed")
	}

	return db.conn.Query(query, args...)
}

// QueryContext executes a query that returns rows with context
func (db *DB) QueryContext(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error) {
	db.mu.RLock()
	defer db.mu.RUnlock()

	if db.closed {
		return nil, fmt.Errorf("database is closed")
	}

	return db.conn.QueryContext(ctx, query, args...)
}

// QueryRow executes a query that returns a single row
func (db *DB) QueryRow(query string, args ...interface{}) *sql.Row {
	db.mu.RLock()
	defer db.mu.RUnlock()

	return db.conn.QueryRow(query, args...)
}

// QueryRowContext executes a query that returns a single row with context
func (db *DB) QueryRowContext(ctx context.Context, query string, args ...interface{}) *sql.Row {
	db.mu.RLock()
	defer db.mu.RUnlock()

	return db.conn.QueryRowContext(ctx, query, args...)
}

// Begin starts a transaction
func (db *DB) Begin() (*sql.Tx, error) {
	db.mu.Lock()
	defer db.mu.Unlock()

	if db.closed {
		return nil, fmt.Errorf("database is closed")
	}

	return db.conn.Begin()
}

// InTransaction executes a function within a transaction
func (db *DB) InTransaction(fn func(*sql.Tx) error) error {
	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}

	if err := fn(tx); err != nil {
		tx.Rollback()
		return err
	}

	return tx.Commit()
}

// Migrate runs database migrations
func (db *DB) Migrate(migrations []Migration) error {
	// Create migrations table if it doesn't exist
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version INTEGER PRIMARY KEY,
			applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create migrations table: %w", err)
	}

	// Get applied migrations
	applied, err := db.getAppliedMigrations()
	if err != nil {
		return fmt.Errorf("failed to get applied migrations: %w", err)
	}

	// Apply pending migrations
	for _, migration := range migrations {
		if _, exists := applied[migration.Version]; exists {
			continue // Already applied
		}

		fmt.Printf("Applying migration %d: %s\n", migration.Version, migration.Description)

		if err := db.InTransaction(func(tx *sql.Tx) error {
			// Run migration
			if _, err := tx.Exec(migration.SQL); err != nil {
				return fmt.Errorf("failed to execute migration: %w", err)
			}

			// Record migration
			_, err := tx.Exec(
				"INSERT INTO schema_migrations (version) VALUES (?)",
				migration.Version,
			)
			return err
		}); err != nil {
			return fmt.Errorf("failed to apply migration %d: %w", migration.Version, err)
		}
	}

	return nil
}

// getAppliedMigrations returns a map of applied migration versions
func (db *DB) getAppliedMigrations() (map[int]bool, error) {
	rows, err := db.Query("SELECT version FROM schema_migrations ORDER BY version")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	applied := make(map[int]bool)
	for rows.Next() {
		var version int
		if err := rows.Scan(&version); err != nil {
			return nil, err
		}
		applied[version] = true
	}

	return applied, rows.Err()
}

// Path returns the database file path
func (db *DB) Path() string {
	db.mu.RLock()
	defer db.mu.RUnlock()
	return db.path
}

// IsClosed returns whether the database is closed
func (db *DB) IsClosed() bool {
	db.mu.RLock()
	defer db.mu.RUnlock()
	return db.closed
}

// Migration represents a database migration
type Migration struct {
	Version     int
	Description string
	SQL         string
}

// Common table creation helpers

// CreateTableTasks creates the tasks table
func CreateTableTasks() string {
	return `
		CREATE TABLE IF NOT EXISTS tasks (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			title TEXT NOT NULL,
			description TEXT,
			status TEXT NOT NULL DEFAULT 'pending',
			priority INTEGER DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			completed_at DATETIME,
			dependencies TEXT DEFAULT '[]',
			git_commits TEXT DEFAULT '[]',
			tags TEXT DEFAULT '[]',
			metadata TEXT DEFAULT '{}',
			execution_environment TEXT,
			code_language TEXT,
			test_results TEXT,
			quality_score INTEGER,
			execution_logs TEXT
		)
	`
}

// CreateTableCodeExecutions creates the code_executions table
func CreateTableCodeExecutions() string {
	return `
		CREATE TABLE IF NOT EXISTS code_executions (
			id TEXT PRIMARY KEY,
			task_id INTEGER,
			language TEXT NOT NULL,
			code TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'queued',
			output TEXT DEFAULT '',
			error TEXT DEFAULT '',
			execution_time_ms INTEGER DEFAULT 0,
			memory_usage_bytes INTEGER DEFAULT 0,
			start_time DATETIME,
			end_time DATETIME,
			environment TEXT DEFAULT 'default',
			dependencies TEXT DEFAULT '[]',
			security_level TEXT DEFAULT 'medium',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
		)
	`
}

// CreateTableCodeAnalysis creates the code_analysis table
func CreateTableCodeAnalysis() string {
	return `
		CREATE TABLE IF NOT EXISTS code_analysis (
			id TEXT PRIMARY KEY,
			task_id INTEGER,
			analysis_type TEXT NOT NULL,
			target_path TEXT NOT NULL,
			results TEXT DEFAULT '{}',
			quality_score INTEGER DEFAULT 0,
			suggestions TEXT DEFAULT '[]',
			issues TEXT DEFAULT '[]',
			scan_duration_ms INTEGER DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
		)
	`
}

// CreateIndexes creates common indexes
func CreateIndexes() []string {
	return []string{
		"CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)",
		"CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority)",
		"CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at)",
		"CREATE INDEX IF NOT EXISTS idx_tasks_code_language ON tasks(code_language)",
		"CREATE INDEX IF NOT EXISTS idx_executions_task ON code_executions(task_id)",
		"CREATE INDEX IF NOT EXISTS idx_executions_status ON code_executions(status)",
		"CREATE INDEX IF NOT EXISTS idx_executions_language ON code_executions(language)",
		"CREATE INDEX IF NOT EXISTS idx_analysis_task ON code_analysis(task_id)",
		"CREATE INDEX IF NOT EXISTS idx_analysis_type ON code_analysis(analysis_type)",
	}
}