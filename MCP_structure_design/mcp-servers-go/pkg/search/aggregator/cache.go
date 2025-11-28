// Package aggregator provides caching functionality for search results
package aggregator

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/ceverson/mcp-advanced-multi-agent-ecosystem/pkg/search/providers"
	_ "modernc.org/sqlite"
)

// Cache represents a search result cache
type Cache struct {
	db   *sql.DB
	path string
}

// NewCache creates a new cache
func NewCache(path string) (*Cache, error) {
	// Ensure directory exists
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create cache directory: %w", err)
	}

	// Open database
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("failed to open cache database: %w", err)
	}

	cache := &Cache{
		db:   db,
		path: path,
	}

	// Initialize schema
	if err := cache.initSchema(); err != nil {
		db.Close()
		return nil, err
	}

	return cache, nil
}

// initSchema creates the cache table if it doesn't exist
func (c *Cache) initSchema() error {
	_, err := c.db.Exec(`
		CREATE TABLE IF NOT EXISTS search_cache (
			query TEXT PRIMARY KEY,
			results TEXT NOT NULL,
			provider TEXT NOT NULL,
			timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create cache table: %w", err)
	}

	// Create index on timestamp for efficient cleanup
	_, err = c.db.Exec(`CREATE INDEX IF NOT EXISTS idx_timestamp ON search_cache(timestamp)`)
	if err != nil {
		return fmt.Errorf("failed to create index: %w", err)
	}

	return nil
}

// Get retrieves cached results for a query if they exist and are not expired
func (c *Cache) Get(query string, maxAge time.Duration) *CachedResult {
	var (
		resultsJSON string
		provider    string
		timestamp   time.Time
	)

	err := c.db.QueryRow(`
		SELECT results, provider, timestamp 
		FROM search_cache 
		WHERE query = ? AND timestamp > ?
	`, query, time.Now().Add(-maxAge)).Scan(&resultsJSON, &provider, &timestamp)

	if err != nil {
		if err != sql.ErrNoRows {
			// Log error but don't fail
			fmt.Printf("Cache lookup error: %v\n", err)
		}
		return nil
	}

	var results []providers.Result
	if err := json.Unmarshal([]byte(resultsJSON), &results); err != nil {
		fmt.Printf("Failed to unmarshal cached results: %v\n", err)
		return nil
	}

	return &CachedResult{
		Results:   results,
		Provider:  provider,
		Timestamp: timestamp.Format(time.RFC3339),
	}
}

// Set stores results in the cache
func (c *Cache) Set(query string, result *SearchResult) error {
	resultsJSON, err := json.Marshal(result.Results)
	if err != nil {
		return fmt.Errorf("failed to marshal results: %w", err)
	}

	_, err = c.db.Exec(`
		INSERT OR REPLACE INTO search_cache (query, results, provider, timestamp)
		VALUES (?, ?, ?, CURRENT_TIMESTAMP)
	`, query, string(resultsJSON), result.Provider)

	return err
}

// ClearOld removes cache entries older than the specified duration
func (c *Cache) ClearOld(maxAge time.Duration) error {
	_, err := c.db.Exec(`
		DELETE FROM search_cache 
		WHERE timestamp < ?
	`, time.Now().Add(-maxAge))

	return err
}

// Close closes the cache database
func (c *Cache) Close() error {
	return c.db.Close()
}

// Path returns the cache file path
func (c *Cache) Path() string {
	return c.path
}