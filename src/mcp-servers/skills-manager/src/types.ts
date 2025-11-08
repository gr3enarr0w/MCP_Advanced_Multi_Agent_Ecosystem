/**
 * Type definitions for Skills Management MCP Server
 */

// Skill proficiency levels
export type ProficiencyLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

// Goal priorities
export type GoalPriority = 'low' | 'medium' | 'high' | 'critical';

// Goal statuses
export type GoalStatus = 'active' | 'in_progress' | 'completed' | 'abandoned';

// Data sources
export type SkillSource = 'openskills' | 'skillsmp' | 'manual';

// Market demand levels
export type MarketDemand = 'low' | 'medium' | 'high' | 'critical';

// Assessment sources
export type AssessmentSource = 'self_assessment' | 'task_completion' | 'peer_review';

// Resource types
export type ResourceType = 'documentation' | 'tutorial' | 'course' | 'book' | 'video';

// Usage frequency
export type UsageFrequency = 'rare' | 'occasional' | 'frequent' | 'primary';

// User skill
export interface UserSkill {
  id: number;
  skill_id: string;
  skill_name: string;
  category: string;
  current_level: ProficiencyLevel;
  proficiency_score: number;
  acquired_date: string;
  last_used_date?: string;
  usage_count: number;
  source: SkillSource;
  notes?: string;
  metadata?: any;
}

// Learning goal
export interface LearningGoal {
  id: number;
  skill_id: string;
  skill_name: string;
  target_level: ProficiencyLevel;
  current_level?: ProficiencyLevel;
  priority: GoalPriority;
  reason?: string;
  target_date?: string;
  started_date?: string;
  completed_date?: string;
  status: GoalStatus;
  progress_percentage: number;
  metadata?: any;
}

// Task-skill relationship
export interface TaskSkill {
  id: number;
  task_id: number;
  skill_id: string;
  skill_name: string;
  required_level: ProficiencyLevel;
  is_primary: boolean;
  acquired_through_task: boolean;
  notes?: string;
}

// Project-skill mapping
export interface ProjectSkill {
  id: number;
  project_path: string;
  skill_id: string;
  skill_name: string;
  usage_frequency: UsageFrequency;
  last_used?: string;
  metadata?: any;
}

// Cached skill from external sources
export interface CachedSkill {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  description: string;
  source: SkillSource;
  prerequisites: string[];
  related_skills: string[];
  learning_path: string[];
  resources: Resource[];
  market_demand?: MarketDemand;
  estimated_hours?: number;
  cached_at: string;
  last_updated: string;
}

// Learning resource
export interface Resource {
  id?: number;
  skill_id?: string;
  type: ResourceType;
  title: string;
  url?: string;
  difficulty?: string;
  estimated_hours?: number;
  completed: boolean;
  rating?: number;
  notes?: string;
}

// Proficiency history entry
export interface ProficiencyHistory {
  id: number;
  skill_id: string;
  level: ProficiencyLevel;
  score: number;
  timestamp: string;
  source?: AssessmentSource;
  notes?: string;
}

// Skill recommendation
export interface SkillRecommendation {
  skill_name: string;
  category: string;
  reason: string;
  priority: GoalPriority;
  estimated_hours: number;
  market_demand?: MarketDemand;
  related_to_skills: string[];
  related_to_tasks: number[];
}

// Skill gap
export interface SkillGap {
  skill_name: string;
  required_level: ProficiencyLevel;
  current_level: ProficiencyLevel | null;
  gap_size: 'small' | 'medium' | 'large';
  estimated_hours_to_fill: number;
  priority: GoalPriority;
}

// Learning path step
export interface LearningPathStep {
  step: number;
  skill_name: string;
  description: string;
  estimated_hours: number;
  prerequisites_met: boolean;
  resources: Resource[];
}

// Task readiness analysis
export interface TaskReadinessAnalysis {
  task_id: number;
  required_skills: Array<{
    skill_name: string;
    required_level: ProficiencyLevel;
    user_has: boolean;
    user_level?: ProficiencyLevel;
    gap?: string;
  }>;
  readiness_score: number;
  missing_skills: string[];
  recommendations?: SkillRecommendation[];
}

// Skill statistics
export interface SkillStats {
  total_skills: number;
  by_category: Record<string, number>;
  by_level: {
    beginner: number;
    intermediate: number;
    advanced: number;
    expert: number;
  };
  learning_goals: {
    active: number;
    in_progress: number;
    completed: number;
  };
  most_used_skills: Array<{
    skill_name: string;
    usage_count: number;
  }>;
  recently_acquired: Array<{
    skill_name: string;
    acquired_date: string;
  }>;
  skill_diversity_score: number;
}

// OpenSkills data structure
export interface OpenSkill {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  level: ProficiencyLevel;
  description: string;
  prerequisites: string[];
  related_skills: string[];
  resources: Resource[];
  estimated_hours: number;
}

// SkillsMP data structure
export interface SkillsMPSkill {
  id: string;
  name: string;
  category: string;
  subcategories: string[];
  description: string;
  market_demand: MarketDemand;
  average_salary_impact: number;
  learning_path: string[];
  certifications: Certification[];
}

// Certification
export interface Certification {
  name: string;
  provider: string;
  url: string;
  difficulty: string;
}