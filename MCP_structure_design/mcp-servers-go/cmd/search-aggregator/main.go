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
	"github.com/ceverson/mcp-advanced-multi-agent-ecosystem/pkg/search/aggregator"
)

var (
	version = "1.0.0"
)

func main() {
	var (
		showVersion = flag.Bool("version", false, "Show version information")
		cachePath   = flag.String("cache", "", "Cache database path (default: ~/.mcp/cache/search/cache.db)")
	)
	flag.Parse()

	if *showVersion {
		fmt.Printf("Search Aggregator MCP Server v%s\n", version)
		os.Exit(0)
	}

	// Set up cache path
	if *cachePath == "" {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			log.Fatalf("Failed to get home directory: %v", err)
		}
		*cachePath = fmt.Sprintf("%s/.mcp/cache/search/cache.db", homeDir)
	}

	// Ensure directory exists
	if err := os.MkdirAll(filepath.Dir(*cachePath), 0755); err != nil {
		log.Fatalf("Failed to create cache directory: %v", err)
	}

	// Initialize search aggregator
	searchAgg, err := aggregator.NewSearchAggregator(&aggregator.Config{
		CachePath: *cachePath,
		APIKeys: &aggregator.APIKeys{
			Perplexity: os.Getenv("PERPLEXITY_API_KEY"),
			Brave:      os.Getenv("BRAVE_API_KEY"),
			Google:     os.Getenv("GOOGLE_API_KEY"),
			GoogleCX:   os.Getenv("GOOGLE_CX"),
		},
	})
	if err != nil {
		log.Fatalf("Failed to initialize search aggregator: %v", err)
	}
	defer searchAgg.Close()

	// Create MCP server
	mcpServer := server.NewServer("search-aggregator", version, &server.Capabilities{
		Tools: &server.ToolsCapability{
			ListChanged: false,
		},
	})

	// Register tool handlers
	registerTools(mcpServer, searchAgg)

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
	log.Printf("Search Aggregator MCP Server v%s starting...", version)
	log.Printf("Cache: %s", *cachePath)

	if err := mcpServer.Run(ctx, os.Stdin, os.Stdout); err != nil {
		log.Fatalf("Server error: %v", err)
	}

	log.Println("Server stopped")
}

func registerTools(s *server.Server, searchAgg *aggregator.SearchAggregator) {
	// Search tool
	s.RegisterTool("search", &server.Tool{
		Name:        "search",
		Description: "Search the web using multiple providers with automatic fallback",
		Handler: func(ctx context.Context, args map[string]interface{}) (*protocol.CallToolResult, error) {
			query, ok := args["query"].(string)
			if !ok || query == "" {
				return nil, fmt.Errorf("query is required")
			}

			limit := getInt(args, "limit", 5)
			useCache := getBool(args, "use_cache", true)

			result, err := searchAgg.Search(ctx, query, limit, useCache)
			if err != nil {
				return nil, fmt.Errorf("search failed: %w", err)
			}

			return createToolResult(map[string]interface{}{
				"query":     query,
				"provider":  result.Provider,
				"cached":    result.Cached,
				"count":     len(result.Results),
				"results":   result.Results,
			}), nil
		},
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"query":     map[string]interface{}{"type": "string"},
				"limit":     map[string]interface{}{"type": "number", "default": 5},
				"use_cache": map[string]interface{}{"type": "boolean", "default": true},
			},
			"required": []string{"query"},
		},
	})

	// Get available providers
	s.RegisterTool("get_available_providers", &server.Tool{
		Name:        "get_available_providers",
		Description: "Get list of configured search providers",
		Handler: func(ctx context.Context, args map[string]interface{}) (*protocol.CallToolResult, error) {
			providers := searchAgg.GetAvailableProviders()

			return createToolResult(map[string]interface{}{
				"providers": providers,
				"count":     len(providers),
			}), nil
		},
		InputSchema: map[string]interface{}{
			"type":       "object",
			"properties": map[string]interface{}{},
		},
	})

	// Clear search cache
	s.RegisterTool("clear_search_cache", &server.Tool{
		Name:        "clear_search_cache",
		Description: "Clear old search cache entries",
		Handler: func(ctx context.Context, args map[string]interface{}) (*protocol.CallToolResult, error) {
			maxAgeDays := getInt(args, "max_age_days", 7)
			maxAge := time.Duration(maxAgeDays) * 24 * time.Hour

			searchAgg.ClearCache(maxAge)

			return createToolResult(map[string]interface{}{
				"status":      "cleared",
				"max_age_days": maxAgeDays,
			}), nil
		},
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"max_age_days": map[string]interface{}{"type": "number", "default": 7},
			},
		},
	})
}

// Helper functions

func getInt(m map[string]interface{}, key string, defaultValue int) int {
	if v, ok := m[key].(float64); ok {
		return int(v)
	}
	if v, ok := m[key].(int); ok {
		return v
	}
	return defaultValue
}

func getBool(m map[string]interface{}, key string, defaultValue bool) bool {
	if v, ok := m[key].(bool); ok {
		return v
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