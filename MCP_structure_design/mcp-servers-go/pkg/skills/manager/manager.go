// Package manager provides skills management functionality
package manager

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/ceverson/mcp-advanced-multi-agent-ecosystem/pkg/database"
)

// ProficiencyLevel represents skill proficiency levels
type ProficiencyLevel string

const (
	ProficiencyBeginner    ProficiencyLevel = "beginner"
	ProficiencyIntermediate ProficiencyLevel = "intermediate"
	ProficiencyAdvanced    ProficiencyLevel = "advanced"
	ProficiencyExpert      ProficiencyLevel = "expert"
)

// SkillSource represents the source of skill data
type SkillSource string

const (
	SkillSourceOpenSkills SkillSource = "openskills"
	SkillSourceSkillsMP   SkillSource = "skillsmp"
	SkillSourceManual     SkillSource = "manual"
)

// AssessmentSource represents the source of skill assessment
type AssessmentSource string

const (
	AssessmentSourceSelf       AssessmentSource = "self_assessment"
	AssessmentSourceTask       AssessmentSource = "task_completion"
	AssessmentSourcePeer       AssessmentSource = "peer_review"
)

// GoalPriority represents learning goal priority
type GoalPriority string

const (
	GoalPriorityLow      GoalPriority = "low"
	GoalPriorityMedium   GoalPriority = "medium"
	GoalPriorityHigh     GoalPriority = "high"
	GoalPriorityCritical GoalPriority = "critical"
)

// GoalStatus represents learning goal status
type GoalStatus string

const (
	GoalStatusActive      GoalStatus = "active"
	GoalStatusInProgress  GoalStatus = "in_progress"
	GoalStatusCompleted   GoalStatus = "completed"
	GoalStatusAbandoned   GoalStatus = "abandoned"
)

// MarketDemand represents market demand for a skill
type MarketDemand string

const (
	MarketDemandLow    MarketDemand = "low"
	MarketDemandMedium MarketDemand = "medium"
	MarketDemandHigh   MarketDemand = "high"
)

// Skill represents a skill in the inventory
type Skill struct {
	ID              string
	Name            string
	Category        string
	Subcategory     string
	CurrentLevel    ProficiencyLevel
	ProficiencyScore float64
	AcquiredDate    time.Time
	LastUsedDate    *time.Time
	UsageCount      int
	Source          SkillSource
	Metadata        map[string]interface{}
}

// LearningGoal represents a learning goal
type LearningGoal struct {
	ID                int
	SkillID           string
	SkillName         string
	TargetLevel       ProficiencyLevel
	CurrentLevel      *ProficiencyLevel
	Priority          GoalPriority
	Reason            string
	TargetDate        *time.Time
	Status            GoalStatus
	ProgressPercentage float64
	StartedDate       time.Time
	CompletedDate     *time.Time
	Metadata          map[string]interface{}
}

// TaskSkill represents the skills required for a task
type TaskSkill struct {
	TaskID         int
	SkillID        string
	SkillName      string
	RequiredLevel  ProficiencyLevel
	IsPrimary      bool
	AcquiredThroughTask bool
}

// ExternalSkill represents skill data from external sources
type ExternalSkill struct {
	ID            string
	Name          string
	Category      string
	Subcategory   string
	Description   string
	Prerequisites []string
	RelatedSkills []string
	LearningPath  []string
	Resources     []Resource
	MarketDemand  MarketDemand
	EstimatedHours int
	Source        SkillSource
}

// Resource represents a learning resource
type Resource struct {
	Title       string `json:"title"`
	Type        string `json:"type"`
	URL         string `json:"url"`
	Description string `json:"description"`
}

// SkillsManager manages skills and learning data
type SkillsManager struct {
	db *database.DB
}

// NewSkillsManager creates a new skills manager
func NewSkillsManager(dbPath string) (*SkillsManager, error) {
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
			Description: "Create skills table",
			SQL: `CREATE TABLE IF NOT EXISTS skills (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				category TEXT NOT NULL,
				subcategory TEXT,
				current_level TEXT NOT NULL,
				proficiency_score REAL DEFAULT 0,
				acquired_date DATETIME DEFAULT CURRENT_TIMESTAMP,
				last_used_date DATETIME,
				usage_count INTEGER DEFAULT 0,
				source TEXT NOT NULL,
				metadata TEXT DEFAULT '{}'
			)`,
		},
		{
			Version:     2,
			Description: "Create learning_goals table",
			SQL: `CREATE TABLE IF NOT EXISTS learning_goals (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				skill_id TEXT NOT NULL,
				skill_name TEXT NOT NULL,
				target_level TEXT NOT NULL,
				current_level TEXT,
				priority TEXT NOT NULL,
				reason TEXT,
				target_date DATETIME,
				status TEXT NOT NULL DEFAULT 'active',
				progress_percentage REAL DEFAULT 0,
				started_date DATETIME DEFAULT CURRENT_TIMESTAMP,
				completed_date DATETIME,
				metadata TEXT DEFAULT '{}',
				FOREIGN KEY (skill_id) REFERENCES skills(id)
			)`,
		},
		{
			Version:     3,
			Description: "Create task_skills table",
			SQL: `CREATE TABLE IF NOT EXISTS task_skills (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				task_id INTEGER NOT NULL,
				skill_id TEXT NOT NULL,
				skill_name TEXT NOT NULL,
				required_level TEXT NOT NULL,
				is_primary BOOLEAN DEFAULT 0,
				acquired_through_task BOOLEAN DEFAULT 0,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP
			)`,
		},
		{
			Version:     4,
			Description: "Create external_skills cache table",
			SQL: `CREATE TABLE IF NOT EXISTS external_skills_cache (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				category TEXT NOT NULL,
				subcategory TEXT,
				description TEXT,
				prerequisites TEXT DEFAULT '[]',
				related_skills TEXT DEFAULT '[]',
				learning_path TEXT DEFAULT '[]',
				resources TEXT DEFAULT '[]',
				market_demand TEXT,
				estimated_hours INTEGER,
				source TEXT NOT NULL,
				cached_at DATETIME DEFAULT CURRENT_TIMESTAMP
			)`,
		},
		{
			Version:     5,
			Description: "Create proficiency_history table",
			SQL: `CREATE TABLE IF NOT EXISTS proficiency_history (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				skill_id TEXT NOT NULL,
				level TEXT NOT NULL,
				score REAL NOT NULL,
				timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
				source TEXT NOT NULL,
				notes TEXT,
				FOREIGN KEY (skill_id) REFERENCES skills(id)
			)`,
		},
	}

	// Add indexes
	migrations = append(migrations, database.Migration{
		Version:     6,
		Description: "Create indexes",
		SQL: `CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);
			   CREATE INDEX IF NOT EXISTS idx_skills_level ON skills(current_level);
			   CREATE INDEX IF NOT EXISTS idx_learning_goals_status ON learning_goals(status);
			   CREATE INDEX IF NOT EXISTS idx_learning_goals_priority ON learning_goals(priority);
			   CREATE INDEX IF NOT EXISTS idx_task_skills_task ON task_skills(task_id);
			   CREATE INDEX IF NOT EXISTS idx_external_skills_source ON external_skills_cache(source);`,
	})

	if err := db.Migrate(migrations); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return &SkillsManager{
		db: db,
	}, nil
}

// Close closes the skills manager
func (sm *SkillsManager) Close() error {
	return sm.db.Close()
}

// AddSkill adds a new skill to the inventory
func (sm *SkillsManager) AddSkill(ctx context.Context, skill *Skill) error {
	metadataJSON, _ := json.Marshal(skill.Metadata)

	_, err := sm.db.ExecContext(ctx, `
		INSERT INTO skills (id, name, category, subcategory, current_level, proficiency_score, 
						   acquired_date, last_used_date, usage_count, source, metadata)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, skill.ID, skill.Name, skill.Category, skill.Subcategory, skill.CurrentLevel,
		skill.ProficiencyScore, skill.AcquiredDate, skill.LastUsedDate, skill.UsageCount,
		skill.Source, string(metadataJSON))

	return err
}

// GetSkill retrieves a skill by ID
func (sm *SkillsManager) GetSkill(ctx context.Context, id string) (*Skill, error) {
	var skill Skill
	var metadataJSON string

	err := sm.db.QueryRowContext(ctx, `
		SELECT id, name, category, subcategory, current_level, proficiency_score,
			   acquired_date, last_used_date, usage_count, source, metadata
		FROM skills WHERE id = ?
	`, id).Scan(&skill.ID, &skill.Name, &skill.Category, &skill.Subcategory,
		&skill.CurrentLevel, &skill.ProficiencyScore, &skill.AcquiredDate,
		&skill.LastUsedDate, &skill.UsageCount, &skill.Source, &metadataJSON)

	if err != nil {
		return nil, err
	}

	json.Unmarshal([]byte(metadataJSON), &skill.Metadata)
	return &skill, nil
}

// ListSkills lists skills with optional filtering
func (sm *SkillsManager) ListSkills(ctx context.Context, category string, level ProficiencyLevel) ([]*Skill, error) {
	query := `SELECT id, name, category, subcategory, current_level, proficiency_score,
			  acquired_date, last_used_date, usage_count, source, metadata FROM skills WHERE 1=1`
	args := []interface{}{}

	if category != "" {
		query += " AND category = ?"
		args = append(args, category)
	}

	if level != "" {
		query += " AND current_level = ?"
		args = append(args, level)
	}

	query += " ORDER BY name"

	rows, err := sm.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var skills []*Skill
	for rows.Next() {
		var skill Skill
		var metadataJSON string

		err := rows.Scan(&skill.ID, &skill.Name, &skill.Category, &skill.Subcategory,
			&skill.CurrentLevel, &skill.ProficiencyScore, &skill.AcquiredDate,
			&skill.LastUsedDate, &skill.UsageCount, &skill.Source, &metadataJSON)
		if err != nil {
			return nil, err
		}

		json.Unmarshal([]byte(metadataJSON), &skill.Metadata)
		skills = append(skills, &skill)
	}

	return skills, rows.Err()
}

// UpdateSkillLevel updates a skill's proficiency level
func (sm *SkillsManager) UpdateSkillLevel(ctx context.Context, skillID string, newLevel ProficiencyLevel, 
	source AssessmentSource, notes string) error {
	// Update skill
	_, err := sm.db.ExecContext(ctx, `
		UPDATE skills SET current_level = ?, last_used_date = CURRENT_TIMESTAMP
		WHERE id = ?
	`, newLevel, skillID)
	if err != nil {
		return err
	}

	// Record in history
	_, err = sm.db.ExecContext(ctx, `
		INSERT INTO proficiency_history (skill_id, level, score, source, notes)
		VALUES (?, ?, ?, ?, ?)
	`, skillID, newLevel, 0.0, source, notes)

	return err
}

// CreateLearningGoal creates a new learning goal
func (sm *SkillsManager) CreateLearningGoal(ctx context.Context, goal *LearningGoal) (int, error) {
	metadataJSON, _ := json.Marshal(goal.Metadata)

	var currentLevel sql.NullString
	if goal.CurrentLevel != nil {
		currentLevel = sql.NullString{String: string(*goal.CurrentLevel), Valid: true}
	}

	var targetDate sql.NullTime
	if goal.TargetDate != nil {
		targetDate = sql.NullTime{Time: *goal.TargetDate, Valid: true}
	}

	result, err := sm.db.ExecContext(ctx, `
		INSERT INTO learning_goals (skill_id, skill_name, target_level, current_level, 
									priority, reason, target_date, status, progress_percentage, metadata)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, goal.SkillID, goal.SkillName, goal.TargetLevel, currentLevel, goal.Priority,
		goal.Reason, targetDate, goal.Status, goal.ProgressPercentage, string(metadataJSON))

	if err != nil {
		return 0, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}

	return int(id), nil
}

// GetLearningGoal retrieves a learning goal by ID
func (sm *SkillsManager) GetLearningGoal(ctx context.Context, id int) (*LearningGoal, error) {
	var goal LearningGoal
	var currentLevel, targetDate, completedDate, metadataJSON sql.NullString

	err := sm.db.QueryRowContext(ctx, `
		SELECT id, skill_id, skill_name, target_level, current_level, priority, reason,
			   target_date, status, progress_percentage, started_date, completed_date, metadata
		FROM learning_goals WHERE id = ?
	`, id).Scan(&goal.ID, &goal.SkillID, &goal.SkillName, &goal.TargetLevel,
		&currentLevel, &goal.Priority, &goal.Reason, &targetDate, &goal.Status,
		&goal.ProgressPercentage, &goal.StartedDate, &completedDate, &metadataJSON)

	if err != nil {
		return nil, err
	}

	if currentLevel.Valid {
		level := ProficiencyLevel(currentLevel.String)
		goal.CurrentLevel = &level
	}

	if targetDate.Valid {
		if t, err := time.Parse(time.RFC3339, targetDate.String); err == nil {
			goal.TargetDate = &t
		}
	}

	if completedDate.Valid {
		if t, err := time.Parse(time.RFC3339, completedDate.String); err == nil {
			goal.CompletedDate = &t
		}
	}

	json.Unmarshal([]byte(metadataJSON.String), &goal.Metadata)
	return &goal, nil
}

// LinkSkillToTask links a skill to a task
func (sm *SkillsManager) LinkSkillToTask(ctx context.Context, taskSkill *TaskSkill) error {
	_, err := sm.db.ExecContext(ctx, `
		INSERT INTO task_skills (task_id, skill_id, skill_name, required_level, is_primary, acquired_through_task)
		VALUES (?, ?, ?, ?, ?, ?)
	`, taskSkill.TaskID, taskSkill.SkillID, taskSkill.SkillName, taskSkill.RequiredLevel,
		taskSkill.IsPrimary, taskSkill.AcquiredThroughTask)

	return err
}

// GetTaskSkills retrieves skills required for a task
func (sm *SkillsManager) GetTaskSkills(ctx context.Context, taskID int) ([]*TaskSkill, error) {
	rows, err := sm.db.QueryContext(ctx, `
		SELECT task_id, skill_id, skill_name, required_level, is_primary, acquired_through_task
		FROM task_skills WHERE task_id = ?
	`, taskID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var taskSkills []*TaskSkill
	for rows.Next() {
		var ts TaskSkill
		err := rows.Scan(&ts.TaskID, &ts.SkillID, &ts.SkillName, &ts.RequiredLevel,
			&ts.IsPrimary, &ts.AcquiredThroughTask)
		if err != nil {
			return nil, err
		}
		taskSkills = append(taskSkills, &ts)
	}

	return taskSkills, rows.Err()
}

// CacheExternalSkill caches external skill data
func (sm *SkillsManager) CacheExternalSkill(ctx context.Context, skill *ExternalSkill) error {
	prereqJSON, _ := json.Marshal(skill.Prerequisites)
	relatedJSON, _ := json.Marshal(skill.RelatedSkills)
	pathJSON, _ := json.Marshal(skill.LearningPath)
	resourcesJSON, _ := json.Marshal(skill.Resources)

	_, err := sm.db.ExecContext(ctx, `
		INSERT OR REPLACE INTO external_skills_cache 
		(id, name, category, subcategory, description, prerequisites, related_skills, 
		 learning_path, resources, market_demand, estimated_hours, source, cached_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
	`, skill.ID, skill.Name, skill.Category, skill.Subcategory, skill.Description,
		string(prereqJSON), string(relatedJSON), string(pathJSON), string(resourcesJSON),
		skill.MarketDemand, skill.EstimatedHours, skill.Source)

	return err
}

// GetCachedExternalSkill retrieves cached external skill data
func (sm *SkillsManager) GetCachedExternalSkill(ctx context.Context, id string) (*ExternalSkill, error) {
	var skill ExternalSkill
	var prereqJSON, relatedJSON, pathJSON, resourcesJSON string

	err := sm.db.QueryRowContext(ctx, `
		SELECT id, name, category, subcategory, description, prerequisites, related_skills,
			   learning_path, resources, market_demand, estimated_hours, source
		FROM external_skills_cache WHERE id = ?
	`, id).Scan(&skill.ID, &skill.Name, &skill.Category, &skill.Subcategory,
		&skill.Description, &prereqJSON, &relatedJSON, &pathJSON, &resourcesJSON,
		&skill.MarketDemand, &skill.EstimatedHours, &skill.Source)

	if err != nil {
		return nil, err
	}

	json.Unmarshal([]byte(prereqJSON), &skill.Prerequisites)
	json.Unmarshal([]byte(relatedJSON), &skill.RelatedSkills)
	json.Unmarshal([]byte(pathJSON), &skill.LearningPath)
	json.Unmarshal([]byte(resourcesJSON), &skill.Resources)

	return &skill, nil
}

// ClearCache clears cached external skills older than the specified duration
func (sm *SkillsManager) ClearCache(ctx context.Context, maxAge time.Duration) error {
	_, err := sm.db.ExecContext(ctx, `
		DELETE FROM external_skills_cache 
		WHERE cached_at < ?
	`, time.Now().Add(-maxAge))

	return err
}

// AnalyzeSkillGap analyzes skill gaps for a target role or project
func (sm *SkillsManager) AnalyzeSkillGap(ctx context.Context, requiredSkills []string) (*SkillGapAnalysis, error) {
	analysis := &SkillGapAnalysis{
		TotalSkillsRequired: len(requiredSkills),
		SkillsPossessed:     0,
		SkillsMissing:       []string{},
		Gaps:                []SkillGap{},
	}

	// Check each required skill
	for _, requiredSkill := range requiredSkills {
		// Normalize skill name for comparison
		normalizedRequired := normalizeSkillName(requiredSkill)
		
		// Look for matching skill in inventory
		found := false
		skills, _ := sm.ListSkills(ctx, "", "")
		
		for _, skill := range skills {
			normalizedHave := normalizeSkillName(skill.Name)
			if normalizedHave == normalizedRequired {
				found = true
				analysis.SkillsPossessed++
				break
			}
		}

		if !found {
			analysis.SkillsMissing = append(analysis.SkillsMissing, requiredSkill)
			analysis.Gaps = append(analysis.Gaps, SkillGap{
				SkillName:     requiredSkill,
				RequiredLevel: ProficiencyIntermediate,
				CurrentLevel:  nil,
				GapSize:       "large",
			})
		}
	}

	analysis.CoveragePercentage = float64(analysis.SkillsPossessed) / float64(analysis.TotalSkillsRequired) * 100
	return analysis, nil
}

// SkillGapAnalysis represents a skill gap analysis
type SkillGapAnalysis struct {
	TotalSkillsRequired int
	SkillsPossessed     int
	SkillsMissing       []string
	CoveragePercentage  float64
	Gaps                []SkillGap
}

// SkillGap represents an individual skill gap
type SkillGap struct {
	SkillName     string
	RequiredLevel ProficiencyLevel
	CurrentLevel  *ProficiencyLevel
	GapSize       string
}

// normalizeSkillName normalizes a skill name for comparison
func normalizeSkillName(name string) string {
	// Convert to lowercase, remove special characters, trim spaces
	normalized := strings.ToLower(name)
	normalized = strings.ReplaceAll(normalized, "-", " ")
	normalized = strings.ReplaceAll(normalized, "_", " ")
	normalized = strings.Join(strings.Fields(normalized), " ") // Remove extra spaces
	return normalized
}

// ParseProficiencyLevel parses a string into a ProficiencyLevel
func ParseProficiencyLevel(s string) (ProficiencyLevel, error) {
	switch ProficiencyLevel(strings.ToLower(s)) {
	case ProficiencyBeginner, ProficiencyIntermediate, ProficiencyAdvanced, ProficiencyExpert:
		return ProficiencyLevel(strings.ToLower(s)), nil
	default:
		return "", fmt.Errorf("invalid proficiency level: %s", s)
	}
}

// ParseGoalPriority parses a string into a GoalPriority
func ParseGoalPriority(s string) (GoalPriority, error) {
	switch GoalPriority(strings.ToLower(s)) {
	case GoalPriorityLow, GoalPriorityMedium, GoalPriorityHigh, GoalPriorityCritical:
		return GoalPriority(strings.ToLower(s)), nil
	default:
		return "", fmt.Errorf("invalid goal priority: %s", s)
	}
}

// ParseGoalStatus parses a string into a GoalStatus
func ParseGoalStatus(s string) (GoalStatus, error) {
	switch GoalStatus(strings.ToLower(s)) {
	case GoalStatusActive, GoalStatusInProgress, GoalStatusCompleted, GoalStatusAbandoned:
		return GoalStatus(strings.ToLower(s)), nil
	default:
		return "", fmt.Errorf("invalid goal status: %s", s)
	}
}

// GenerateSkillID generates a unique skill ID
func GenerateSkillID(source SkillSource, name string) string {
	normalized := strings.ToLower(name)
	normalized = strings.ReplaceAll(normalized, " ", "-")
	normalized = strings.ReplaceAll(normalized, "_", "-")
	return fmt.Sprintf("%s-%s", source, normalized)
}

// Default categories for skills
var DefaultCategories = []string{
	"Programming Languages",
	"Frameworks & Libraries",
	"Databases",
	"DevOps & Tools",
	"Cloud Platforms",
	"AI & Machine Learning",
	"Data Science",
	"Web Development",
	"Mobile Development",
	"Security",
	"Project Management",
	"Soft Skills",
}