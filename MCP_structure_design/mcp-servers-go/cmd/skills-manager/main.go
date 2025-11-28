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
	"github.com/ceverson/mcp-advanced-multi-agent-ecosystem/pkg/skills/manager"
	"github.com/ceverson/mcp-advanced-multi-agent-ecosystem/pkg/skills/openskills"
)

var (
	version = "1.0.0"
)

func main() {
	var (
		showVersion = flag.Bool("version", false, "Show version information")
		dbPath      = flag.String("db", "", "Database path (default: ~/.mcp/skills/skills.db)")
	)
	flag.Parse()

	if *showVersion {
		fmt.Printf("Skills Manager MCP Server v%s\n", version)
		os.Exit(0)
	}

	// Set up database path
	if *dbPath == "" {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			log.Fatalf("Failed to get home directory: %v", err)
		}
		*dbPath = filepath.Join(homeDir, ".mcp", "skills", "skills.db")
	}

	// Ensure directory exists
	if err := os.MkdirAll(filepath.Dir(*dbPath), 0755); err != nil {
		log.Fatalf("Failed to create database directory: %v", err)
	}

	// Initialize skills manager
	skillsManager, err := manager.NewSkillsManager(*dbPath)
	if err != nil {
		log.Fatalf("Failed to initialize skills manager: %v", err)
	}
	defer skillsManager.Close()

	// Initialize OpenSkills client
	openSkillsClient := openskills.NewClient(os.Getenv("OPENSKILLS_API_KEY"))

	// Create MCP server
	mcpServer := server.NewServer("skills-manager", version, &server.Capabilities{
		Tools: &server.ToolsCapability{
			ListChanged: false,
		},
	})

	// Register tool handlers
	registerTools(mcpServer, skillsManager, openSkillsClient)

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
	log.Printf("Skills Manager MCP Server v%s starting...", version)
	log.Printf("Database: %s", *dbPath)

	if err := mcpServer.Run(ctx, os.Stdin, os.Stdout); err != nil {
		log.Fatalf("Server error: %v", err)
	}

	log.Println("Server stopped")
}

func registerTools(s *server.Server, skillsManager *manager.SkillsManager, openSkillsClient *openskills.Client) {
	// Add skill
	s.RegisterTool("add_skill", &server.Tool{
		Name:        "add_skill",
		Description: "Add a skill to user's inventory",
		Handler: func(ctx context.Context, args map[string]interface{}) (*protocol.CallToolResult, error) {
			name, ok := args["skill_name"].(string)
			if !ok || name == "" {
				return nil, fmt.Errorf("skill_name is required")
			}

			levelStr := getString(args, "current_level", "")
			level, err := manager.ParseProficiencyLevel(levelStr)
			if err != nil {
				return nil, fmt.Errorf("invalid current_level: %w", err)
			}

			score := getFloat(args, "proficiency_score", 0)
			sourceStr := getString(args, "source", "manual")
			source := manager.SkillSource(sourceStr)
			notes := getString(args, "notes", "")

			// Generate skill ID
			skillID := manager.GenerateSkillID(source, name)

			// Try to fetch from OpenSkills if configured
			var externalSkill *manager.ExternalSkill
			if openSkillsClient.IsConfigured() && source == manager.SkillSourceOpenSkills {
				if skills, err := openSkillsClient.Search(ctx, name, 1); err == nil && len(skills) > 0 {
					// Convert to external skill format
					externalSkill = &manager.ExternalSkill{
						ID:            skills[0].ID,
						Name:          skills[0].Name,
						Category:      skills[0].Category,
						Subcategory:   skills[0].Subcategory,
						Description:   skills[0].Description,
						Prerequisites: skills[0].Prerequisites,
						RelatedSkills: skills[0].RelatedSkills,
						LearningPath:  skills[0].LearningPath,
						MarketDemand:  manager.MarketDemand(skills[0].MarketDemand),
						EstimatedHours: skills[0].EstimatedHours,
						Source:        manager.SkillSourceOpenSkills,
					}
					
					// Cache the external skill data
					if err := skillsManager.CacheExternalSkill(ctx, externalSkill); err != nil {
						log.Printf("Warning: failed to cache external skill: %v", err)
					}
				}
			}

			skill := &manager.Skill{
				ID:              skillID,
				Name:            name,
				Category:        getString(args, "category", "General"),
				CurrentLevel:    level,
				ProficiencyScore: score,
				AcquiredDate:    time.Now(),
				UsageCount:      0,
				Source:          source,
				Metadata: map[string]interface{}{
					"notes": notes,
				},
			}

			if externalSkill != nil {
				skill.Category = externalSkill.Category
				skill.Metadata["external_id"] = externalSkill.ID
				skill.Metadata["description"] = externalSkill.Description
				skill.Metadata["prerequisites"] = externalSkill.Prerequisites
				skill.Metadata["resources"] = externalSkill.Resources
			}

			if err := skillsManager.AddSkill(ctx, skill); err != nil {
				return nil, fmt.Errorf("failed to add skill: %w", err)
			}

			result := map[string]interface{}{
				"skill_id":           skillID,
				"skill_name":         name,
				"current_level":      level,
				"proficiency_score":  score,
				"status":             "added",
			}

			if externalSkill != nil {
				result["external_data"] = map[string]interface{}{
					"description":   externalSkill.Description,
					"prerequisites": externalSkill.Prerequisites,
					"resources":     externalSkill.Resources,
				}
			}

			return createToolResult(result), nil
		},
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"skill_name":        map[string]interface{}{"type": "string"},
				"current_level":     map[string]interface{}{"type": "string", "enum": []string{"beginner", "intermediate", "advanced", "expert"}},
				"proficiency_score": map[string]interface{}{"type": "number", "default": 0},
				"source":            map[string]interface{}{"type": "string", "enum": []string{"openskills", "skillsmp", "manual"}, "default": "manual"},
				"category":          map[string]interface{}{"type": "string"},
				"notes":             map[string]interface{}{"type": "string"},
			},
			"required": []string{"skill_name", "current_level"},
		},
	})

	// List skills
	s.RegisterTool("list_skills", &server.Tool{
		Name:        "list_skills",
		Description: "List user's skills with optional filtering",
		Handler: func(ctx context.Context, args map[string]interface{}) (*protocol.CallToolResult, error) {
			category := getString(args, "category", "")
			levelStr := getString(args, "level", "")
			var level manager.ProficiencyLevel
			if levelStr != "" {
				var err error
				level, err = manager.ParseProficiencyLevel(levelStr)
				if err != nil {
					return nil, fmt.Errorf("invalid level: %w", err)
				}
			}

			skills, err := skillsManager.ListSkills(ctx, category, level)
			if err != nil {
				return nil, fmt.Errorf("failed to list skills: %w", err)
			}

			return createToolResult(map[string]interface{}{
				"count": len(skills),
				"skills": skills,
			}), nil
		},
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"category": map[string]interface{}{"type": "string"},
				"level":    map[string]interface{}{"type": "string", "enum": []string{"beginner", "intermediate", "advanced", "expert"}},
			},
		},
	})

	// Create learning goal
	s.RegisterTool("create_learning_goal", &server.Tool{
		Name:        "create_learning_goal",
		Description: "Create a new learning goal for a skill",
		Handler: func(ctx context.Context, args map[string]interface{}) (*protocol.CallToolResult, error) {
			skillName := getString(args, "skill_name", "")
			if skillName == "" {
				return nil, fmt.Errorf("skill_name is required")
			}

			targetLevelStr := getString(args, "target_level", "")
			targetLevel, err := manager.ParseProficiencyLevel(targetLevelStr)
			if err != nil {
				return nil, fmt.Errorf("invalid target_level: %w", err)
			}

			priorityStr := getString(args, "priority", "medium")
			priority, err := manager.ParseGoalPriority(priorityStr)
			if err != nil {
				return nil, fmt.Errorf("invalid priority: %w", err)
			}

			reason := getString(args, "reason", "")
			var targetDate *time.Time
			if dateStr := getString(args, "target_date", ""); dateStr != "" {
				if t, err := time.Parse(time.RFC3339, dateStr); err == nil {
					targetDate = &t
				}
			}

			// Try to fetch skill details for suggestions
			var suggestedResources []manager.Resource
			var learningPath []string
			var estimatedHours int

			if openSkillsClient.IsConfigured() {
				if skills, err := openSkillsClient.Search(ctx, skillName, 1); err == nil && len(skills) > 0 {
					skill := skills[0]
					suggestedResources = make([]manager.Resource, len(skill.Resources))
					for i, res := range skill.Resources {
						suggestedResources[i] = manager.Resource{
							Title:       res.Title,
							Type:        res.Type,
							URL:         res.URL,
							Description: res.Description,
						}
					}
					learningPath = skill.LearningPath
					estimatedHours = skill.EstimatedHours
				}
			}

			goal := &manager.LearningGoal{
				SkillID:           manager.GenerateSkillID(manager.SkillSourceManual, skillName),
				SkillName:         skillName,
				TargetLevel:       targetLevel,
				Priority:          priority,
				Reason:            reason,
				TargetDate:        targetDate,
				Status:            manager.GoalStatusActive,
				ProgressPercentage: 0,
				StartedDate:       time.Now(),
			}

			id, err := skillsManager.CreateLearningGoal(ctx, goal)
			if err != nil {
				return nil, fmt.Errorf("failed to create learning goal: %w", err)
			}

			result := map[string]interface{}{
				"goal_id":      id,
				"skill_name":   skillName,
				"target_level": targetLevel,
				"priority":     priority,
				"status":       "active",
			}

			if len(suggestedResources) > 0 {
				result["suggested_resources"] = suggestedResources
			}
			if len(learningPath) > 0 {
				result["learning_path"] = learningPath
			}
			if estimatedHours > 0 {
				result["estimated_hours"] = estimatedHours
			}

			return createToolResult(result), nil
		},
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"skill_name":     map[string]interface{}{"type": "string"},
				"target_level":   map[string]interface{}{"type": "string", "enum": []string{"beginner", "intermediate", "advanced", "expert"}},
				"priority":       map[string]interface{}{"type": "string", "enum": []string{"low", "medium", "high", "critical"}, "default": "medium"},
				"reason":         map[string]interface{}{"type": "string"},
				"target_date":    map[string]interface{}{"type": "string"},
			},
			"required": []string{"skill_name", "target_level"},
		},
	})

	// Analyze skill gaps
	s.RegisterTool("analyze_skill_gaps", &server.Tool{
		Name:        "analyze_skill_gaps",
		Description: "Analyze skill gaps for career/project goals",
		Handler: func(ctx context.Context, args map[string]interface{}) (*protocol.CallToolResult, error) {
			requiredSkills := getStringSlice(args, "required_skills")
			if len(requiredSkills) == 0 {
				return nil, fmt.Errorf("required_skills is required")
			}

			analysis, err := skillsManager.AnalyzeSkillGap(ctx, requiredSkills)
			if err != nil {
				return nil, fmt.Errorf("failed to analyze skill gaps: %w", err)
			}

			return createToolResult(map[string]interface{}{
				"total_skills_required": analysis.TotalSkillsRequired,
				"skills_possessed":      analysis.SkillsPossessed,
				"skills_missing":        analysis.SkillsMissing,
				"coverage_percentage":   analysis.CoveragePercentage,
				"gaps":                  analysis.Gaps,
			}), nil
		},
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"required_skills": map[string]interface{}{"type": "array", "items": map[string]interface{}{"type": "string"}},
			},
			"required": []string{"required_skills"},
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

func getFloat(m map[string]interface{}, key string, defaultValue float64) float64 {
	if v, ok := m[key].(float64); ok {
		return v
	}
	return defaultValue
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