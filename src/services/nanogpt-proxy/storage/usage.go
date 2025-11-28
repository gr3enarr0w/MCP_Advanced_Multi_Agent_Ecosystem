package storage

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

// UsageTracker tracks API usage in SQLite
type UsageTracker struct {
	db *sql.DB
}

// UsageRecord represents a single API request record
type UsageRecord struct {
	ID               int64
	Timestamp        time.Time
	Backend          string
	Model            string
	Role             string
	ConversationID   string
	PromptTokens     int
	CompletionTokens int
	TotalTokens      int
	ResponseTimeMs   int64
}

// NewUsageTracker creates a new usage tracker
func NewUsageTracker(dbPath string) (*UsageTracker, error) {
	// Expand home directory
	if dbPath[:2] == "~/" {
		home, err := os.UserHomeDir()
		if err != nil {
			return nil, fmt.Errorf("failed to get home dir: %w", err)
		}
		dbPath = filepath.Join(home, dbPath[2:])
	}

	// Ensure directory exists
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create directory: %w", err)
	}

	// Open database
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	tracker := &UsageTracker{db: db}

	// Initialize schema
	if err := tracker.initSchema(); err != nil {
		return nil, err
	}

	return tracker, nil
}

// initSchema creates the necessary tables
func (u *UsageTracker) initSchema() error {
	schema := `
	CREATE TABLE IF NOT EXISTS usage (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		timestamp DATETIME NOT NULL,
		backend TEXT NOT NULL,
		model TEXT NOT NULL,
		role TEXT,
		conversation_id TEXT,
		prompt_tokens INTEGER,
		completion_tokens INTEGER,
		total_tokens INTEGER,
		response_time_ms INTEGER
	);

	CREATE INDEX IF NOT EXISTS idx_timestamp ON usage(timestamp);
	CREATE INDEX IF NOT EXISTS idx_backend ON usage(backend);
	CREATE INDEX IF NOT EXISTS idx_conversation ON usage(conversation_id);
	`

	_, err := u.db.Exec(schema)
	return err
}

// RecordUsage logs a single API request
func (u *UsageTracker) RecordUsage(record UsageRecord) error {
	query := `
	INSERT INTO usage (
		timestamp, backend, model, role, conversation_id,
		prompt_tokens, completion_tokens, total_tokens, response_time_ms
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	result, err := u.db.Exec(query,
		record.Timestamp,
		record.Backend,
		record.Model,
		record.Role,
		record.ConversationID,
		record.PromptTokens,
		record.CompletionTokens,
		record.TotalTokens,
		record.ResponseTimeMs,
	)

	if err != nil {
		return fmt.Errorf("failed to insert usage: %w", err)
	}

	id, _ := result.LastInsertId()
	record.ID = id

	return nil
}

// GetMonthlyUsage returns token usage for the current month
func (u *UsageTracker) GetMonthlyUsage(backend string) (int, error) {
	now := time.Now()
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

	query := `
	SELECT COALESCE(SUM(total_tokens), 0)
	FROM usage
	WHERE backend = ? AND timestamp >= ?
	`

	var total int
	err := u.db.QueryRow(query, backend, startOfMonth).Scan(&total)
	if err != nil {
		return 0, fmt.Errorf("failed to get monthly usage: %w", err)
	}

	return total, nil
}

// GetUsageByRole returns token usage grouped by role
func (u *UsageTracker) GetUsageByRole(backend string, since time.Time) (map[string]int, error) {
	query := `
	SELECT role, SUM(total_tokens)
	FROM usage
	WHERE backend = ? AND timestamp >= ?
	GROUP BY role
	`

	rows, err := u.db.Query(query, backend, since)
	if err != nil {
		return nil, fmt.Errorf("failed to query usage by role: %w", err)
	}
	defer rows.Close()

	result := make(map[string]int)
	for rows.Next() {
		var role string
		var total int
		if err := rows.Scan(&role, &total); err != nil {
			return nil, err
		}
		result[role] = total
	}

	return result, nil
}

// GetAverageResponseTime calculates average response time by backend
func (u *UsageTracker) GetAverageResponseTime(backend string, since time.Time) (int64, error) {
	query := `
	SELECT AVG(response_time_ms)
	FROM usage
	WHERE backend = ? AND timestamp >= ?
	`

	var avg sql.NullInt64
	err := u.db.QueryRow(query, backend, since).Scan(&avg)
	if err != nil {
		return 0, fmt.Errorf("failed to get average response time: %w", err)
	}

	if !avg.Valid {
		return 0, nil
	}

	return avg.Int64, nil
}

// Close closes the database connection
func (u *UsageTracker) Close() error {
	return u.db.Close()
}
