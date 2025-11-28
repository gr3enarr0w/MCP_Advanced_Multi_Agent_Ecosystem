# Skills Management MCP Server Architecture

## Executive Summary

This document provides a comprehensive architecture for integrating OpenSkills (https://github.com/numman-ali/openskills) and SkillsMP (https://skillsmp.com/categories) into the existing MCP server ecosystem. The Skills Management MCP server will provide local-first skill tracking, learning path management, and intelligent skill-task correlation.

## Table of Contents

1. [Overview](#overview)
2. [OpenSkills & SkillsMP Analysis](#openskills--skillsmp-analysis)
3. [Architecture Design](#architecture-design)
4. [Database Schema](#database-schema)
5. [MCP Tools Specification](#mcp-tools-specification)
6. [Integration Strategy](#integration-strategy)
7. [Implementation Roadmap](#implementation-roadmap)
8. [Technical Specifications](#technical-specifications)

---

## Overview

### Purpose

The Skills Management MCP server will:
- Track skills you want to learn (learning goals)
- Maintain an inventory of skills you currently have
- Link skills to specific projects and tasks
- Provide skill recommendations based on tasks
- Integrate with Task Orchestrator and Context Persistence
- Use hybrid caching for OpenSkills and SkillsMP data

### Design Principles

Following the existing MCP server architecture:
- **Local-first**: All data stored in `~/.mcp/skills/`
- **SQLite + Caching**: Same pattern as other servers
- **TypeScript**: Consistent with Task Orchestrator and Search Aggregator
- **MCP SDK**: Using official `@modelcontextprotocol/sdk`

---

## OpenSkills & SkillsMP Analysis

### OpenSkills Repository Analysis

**Repository**: https://github.com/numman-ali/openskills

**Key Components**:
1. **Skill Taxonomy**: Hierarchical classification of technical skills
2. **Competency Levels**: Beginner, Intermediate, Advanced, Expert
3. **Skill Relationships**: Prerequisites, related skills, learning paths
4. **Metadata**: Descriptions, resources, typical time to proficiency

**Data Structure** (Inferred):
```typescript
interface OpenSkill {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  description: string;
  prerequisites: string[];  // Skill IDs
  relatedSkills: string[];  // Skill IDs
  resources: Resource[];
  estimatedHours: number;
}

interface Resource {
  type: 'documentation' | 'tutorial' | 'course' | 'book';
  title: string;
  url: string;
  difficulty: string;
}
```

### SkillsMP Platform Analysis

**Website**: https://skillsmp.com/categories

**Key Features**:
1. **Categorized Skills**: Programming, DevOps, Data Science, etc.
2. **Industry-Standard Classifications**: Based on job market demands
3. **Skill Badges**: Visual representation of skill levels
4. **Learning Paths**: Curated progressions through related skills
5. **Market Demand**: Indicates how in-demand each skill is

**Categories** (Sampling):
- Programming Languages (Python, JavaScript, TypeScript, Go, Rust, etc.)
- Frameworks (React, Vue, Django, FastAPI, etc.)
- Databases (PostgreSQL, MongoDB, Redis, etc.)
- Cloud Platforms (AWS, Azure, GCP)
- DevOps Tools (Docker, Kubernetes, Terraform, etc.)
- Data Science (ML, AI, Data Analysis, Visualization)
- Software Engineering (Architecture, Design Patterns, Testing)

**Data Structure** (API Integration):
```typescript
interface SkillsMPSkill {
  id: string;
  name: string;
  category: string;
  subcategories: string[];
  description: string;
  marketDemand: 'low' | 'medium' | 'high' | 'critical';
  averageSalaryImpact: number;  // Percentage
  learningPath: string[];  // Skill IDs in recommended order
  certifications: Certification[];
}

interface Certification {
  name: string;
  provider: string;
  url: string;
  difficulty: string;
}
```

---

## Architecture Design

### Technology Stack Decision: TypeScript

**Rationale**:
- Task Orchestrator and Search Aggregator are TypeScript
- Better for API integrations (OpenSkills/SkillsMP)
- Excellent JSON handling and type safety
- sql.js for pure JavaScript SQLite (no native compilation)

### Server Structure

```
mcp-servers/
└── skills-manager/
    ├── package.json
    ├── tsconfig.json
    ├── src/
    │   ├── index.ts              # Main server entry point
    │   ├── database.ts           # SQLite database management
    │   ├── cache.ts              # Skills data caching
    │   ├── providers/
    │   │   ├── openskills.ts     # OpenSkills integration
    │   │   └── skillsmp.ts       # SkillsMP integration
    │   ├── skills-manager.ts     # Core skills management logic
    │   ├── recommendations.ts    # Recommendation engine
    │   ├── integration.ts        # Integration with other MCP servers
    │   └── types.ts              # TypeScript interfaces
    └── tests/
        ├── database.test.ts
        ├── cache.test.ts
        └── skills-manager.test.ts
```

### Component Overview

#### 1. **Database Layer** (`database.ts`)
- SQLite database management using sql.js
- Schema creation and migrations
- CRUD operations for skills, goals, proficiency levels
- Query optimization for skill lookups

#### 2. **Cache Layer** (`cache.ts`)
- Local caching of OpenSkills/SkillsMP data
- TTL-based cache invalidation
- Cache warming strategies
- Hybrid approach: cache frequently accessed, fetch on-demand

#### 3. **Provider Integrations** (`providers/`)
- **OpenSkills Provider**: Fetch and parse OpenSkills data
- **SkillsMP Provider**: API integration with SkillsMP
- Fallback mechanisms for API failures
- Data normalization to unified format

#### 4. **Skills Manager** (`skills-manager.ts`)
- Core business logic for skill management
- Proficiency tracking and assessment
- Learning goal management
- Progress calculation

#### 5. **Recommendation Engine** (`recommendations.ts`)
- Skill gap analysis
- Learning path generation
- Task-skill matching
- Resource recommendations

#### 6. **Integration Layer** (`integration.ts`)
- Task Orchestrator integration
- Context Persistence integration
- Cross-server communication protocols

---

## Database Schema

### SQLite Schema

```sql
-- User's skill inventory
CREATE TABLE user_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    skill_id TEXT NOT NULL,              -- References cached_skills.id
    skill_name TEXT NOT NULL,
    category TEXT,
    current_level TEXT NOT NULL,         -- beginner, intermediate, advanced, expert
    proficiency_score INTEGER DEFAULT 0, -- 0-100
    acquired_date TEXT,
    last_used_date TEXT,
    usage_count INTEGER DEFAULT 0,
    source TEXT,                         -- openskills, skillsmp, manual
    notes TEXT,
    metadata TEXT                        -- JSON
);

-- Learning goals
CREATE TABLE learning_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    skill_id TEXT NOT NULL,
    skill_name TEXT NOT NULL,
    target_level TEXT NOT NULL,
    current_level TEXT,
    priority TEXT DEFAULT 'medium',      -- low, medium, high, critical
    reason TEXT,
    target_date TEXT,
    started_date TEXT,
    completed_date TEXT,
    status TEXT DEFAULT 'active',        -- active, in_progress, completed, abandoned
    progress_percentage INTEGER DEFAULT 0,
    metadata TEXT                        -- JSON
);

-- Skill-task relationships
CREATE TABLE task_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,            -- References Task Orchestrator
    skill_id TEXT NOT NULL,
    skill_name TEXT NOT NULL,
    required_level TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT 0,        -- Is this a primary skill for the task?
    acquired_through_task BOOLEAN DEFAULT 0,
    notes TEXT
);

-- Project-skill mapping
CREATE TABLE project_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_path TEXT NOT NULL,
    skill_id TEXT NOT NULL,
    skill_name TEXT NOT NULL,
    usage_frequency TEXT DEFAULT 'occasional', -- rare, occasional, frequent, primary
    last_used TEXT,
    metadata TEXT                        -- JSON
);

-- Cached skills from OpenSkills/SkillsMP
CREATE TABLE cached_skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    subcategory TEXT,
    description TEXT,
    source TEXT NOT NULL,                -- openskills, skillsmp
    prerequisites TEXT,                  -- JSON array
    related_skills TEXT,                 -- JSON array
    learning_path TEXT,                  -- JSON array
    resources TEXT,                      -- JSON array
    market_demand TEXT,
    estimated_hours INTEGER,
    cached_at TEXT NOT NULL,
    last_updated TEXT
);

-- Learning resources
CREATE TABLE learning_resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    skill_id TEXT NOT NULL,
    type TEXT NOT NULL,                  -- documentation, tutorial, course, book, video
    title TEXT NOT NULL,
    url TEXT,
    difficulty TEXT,
    estimated_hours INTEGER,
    completed BOOLEAN DEFAULT 0,
    rating INTEGER,                      -- User rating 1-5
    notes TEXT
);

-- Skill proficiency history
CREATE TABLE proficiency_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    skill_id TEXT NOT NULL,
    level TEXT NOT NULL,
    score INTEGER NOT NULL,
    timestamp TEXT NOT NULL,
    source TEXT,                         -- self_assessment, task_completion, peer_review
    notes TEXT
);

-- Indexes for performance
CREATE INDEX idx_user_skills_skill_id ON user_skills(skill_id);
CREATE INDEX idx_user_skills_category ON user_skills(category);
CREATE INDEX idx_learning_goals_status ON learning_goals(status);
CREATE INDEX idx_task_skills_task_id ON task_skills(task_id);
CREATE INDEX idx_task_skills_skill_id ON task_skills(skill_id);
CREATE INDEX idx_project_skills_project_path ON project_skills(project_path);
CREATE INDEX idx_cached_skills_category ON cached_skills(category);
CREATE INDEX idx_cached_skills_source ON cached_skills(source);
```

---

## MCP Tools Specification

### 1. Skill Inventory Management

#### `add_skill`
Add a skill to user's inventory.

**Input Schema**:
```typescript
{
  type: 'object',
  properties: {
    skill_name: {
      type: 'string',
      description: 'Name of the skill (e.g., "Python", "React", "Docker")'
    },
    current_level: {
      type: 'string',
      enum: ['beginner', 'intermediate', 'advanced', 'expert'],
      description: 'Current proficiency level'
    },
    proficiency_score: {
      type: 'number',
      description: 'Proficiency score (0-100)',
      default: 0
    },
    source: {
      type: 'string',
      enum: ['openskills', 'skillsmp', 'manual'],
      description: 'Source of skill data',
      default: 'manual'
    },
    notes: {
      type: 'string',
      description: 'Additional notes about the skill'
    }
  },
  required: ['skill_name', 'current_level']
}
```

**Output**:
```typescript
{
  skill_id: string;
  skill_name: string;
  current_level: string;
  proficiency_score: number;
  status: 'added' | 'updated';
  cached_data?: {
    description: string;
    prerequisites: string[];
    resources: Resource[];
  };
}
```

#### `update_skill_level`
Update proficiency level for an existing skill.

**Input Schema**:
```typescript
{
  type: 'object',
  properties: {
    skill_id: {
      type: 'string',
      description: 'Skill ID from user_skills table'
    },
    new_level: {
      type: 'string',
      enum: ['beginner', 'intermediate', 'advanced', 'expert'],
      description: 'New proficiency level'
    },
    proficiency_score: {
      type: 'number',
      description: 'Updated proficiency score (0-100)'
    },
    source: {
      type: 'string',
      enum: ['self_assessment', 'task_completion', 'peer_review'],
      description: 'Source of assessment',
      default: 'self_assessment'
    },
    notes: {
      type: 'string',
      description: 'Notes about the level change'
    }
  },
  required: ['skill_id', 'new_level']
}
```

**Output**:
```typescript
{
  skill_id: string;
  skill_name: string;
  previous_level: string;
  new_level: string;
  proficiency_score: number;
  progress_percentage: number;
  status: 'updated';
}
```

#### `list_skills`
List user's skills with optional filtering.

**Input Schema**:
```typescript
{
  type: 'object',
  properties: {
    category: {
      type: 'string',
      description: 'Filter by category'
    },
    level: {
      type: 'string',
      enum: ['beginner', 'intermediate', 'advanced', 'expert'],
      description: 'Filter by proficiency level'
    },
    min_proficiency: {
      type: 'number',
      description: 'Minimum proficiency score'
    },
    include_metadata: {
      type: 'boolean',
      description: 'Include full metadata from cache',
      default: false
    }
  }
}
```

**Output**:
```typescript
{
  count: number;
  skills: Array<{
    skill_id: string;
    skill_name: string;
    category: string;
    current_level: string;
    proficiency_score: number;
    acquired_date: string;
    last_used_date: string;
    usage_count: number;
    metadata?: any;
  }>;
}
```

#### `remove_skill`
Remove a skill from user's inventory.

**Input Schema**:
```typescript
{
  type: 'object',
  properties: {
    skill_id: {
      type: 'string',
      description: 'Skill ID to remove'
    },
    reason: {
      type: 'string',
      description: 'Reason for removal'
    }
  },
  required: ['skill_id']
}
```

**Output**:
```typescript
{
  skill_id: string;
  skill_name: string;
  status: 'removed';
  archived: boolean;
}
```

### 2. Learning Goal Management

#### `create_learning_goal`
Create a new learning goal for a skill.

**Input Schema**:
```typescript
{
  type: 'object',
  properties: {
    skill_name: {
      type: 'string',
      description: 'Name of the skill to learn'
    },
    target_level: {
      type: 'string',
      enum: ['beginner', 'intermediate', 'advanced', 'expert'],
      description: 'Desired proficiency level'
    },
    priority: {
      type: 'string',
      enum: ['low', 'medium', 'high', 'critical'],
      description: 'Priority level',
      default: 'medium'
    },
    reason: {
      type: 'string',
      description: 'Why you want to learn this skill'
    },
    target_date: {
      type: 'string',
      description: 'Target completion date (ISO 8601)'
    }
  },
  required: ['skill_name', 'target_level']
}
```

**Output**:
```typescript
{
  goal_id: number;
  skill_name: string;
  target_level: string;
  priority: string;
  status: 'active';
  suggested_resources?: Resource[];
  learning_path?: string[];
  estimated_hours?: number;
}
```

#### `update_learning_goal`
Update progress on a learning goal.

**Input Schema**:
```typescript
{
  type: 'object',
  properties: {
    goal_id: {
      type: 'number',
      description: 'Learning goal ID'
    },
    progress_percentage: {
      type: 'number',
      description: 'Updated progress (0-100)'
    },
    current_level: {
      type: 'string',
      enum: ['beginner', 'intermediate', 'advanced', 'expert'],
      description: 'Current achieved level'
    },
    status: {
      type: 'string',
      enum: ['active', 'in_progress', 'completed', 'abandoned'],
      description: 'Goal status'
    },
    notes: {
      type: 'string',
      description: 'Progress notes'
    }
  },
  required: ['goal_id']
}
```

**Output**:
```typescript
{
  goal_id: number;
  skill_name: string;
  progress_percentage: number;
  current_level: string;
  target_level: string;
  status: string;
  days_since_started: number;
  estimated_days_remaining?: number;
}
```

#### `list_learning_goals`
List all learning goals with optional filtering.

**Input Schema**:
```typescript
{
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['active', 'in_progress', 'completed', 'abandoned'],
      description: 'Filter by status'
    },
    priority: {
      type: 'string',
      enum: ['low', 'medium', 'high', 'critical'],
      description: 'Filter by priority'
    },
    sort_by: {
      type: 'string',
      enum: ['priority', 'target_date', 'progress'],
      description: 'Sort order',
      default: 'priority'
    }
  }
}
```

**Output**:
```typescript
{
  count: number;
  goals: Array<{
    goal_id: number;
    skill_name: string;
    target_level: string;
    current_level: string;
    priority: string;
    progress_percentage: number;
    target_date: string;
    status: string;
  }>;
}
```

### 3. Skill-Task Integration

#### `link_skill_to_task`
Link a skill to a task in Task Orchestrator.

**Input Schema**:
```typescript
{
  type: 'object',
  properties: {
    task_id: {
      type: 'number',
      description: 'Task ID from Task Orchestrator'
    },
    skill_name: {
      type: 'string',
      description: 'Name of the skill'
    },
    required_level: {
      type: 'string',
      enum: ['beginner', 'intermediate', 'advanced', 'expert'],
      description: 'Required proficiency level for this task'
    },
    is_primary: {
      type: 'boolean',
      description: 'Is this a primary skill for the task?',
      default: false
    }
  },
  required: ['task_id', 'skill_name', 'required_level']
}
```

**Output**:
```typescript
{
  task_id: number;
  skill_name: string;
  required_level: string;
  user_has_skill: boolean;
  user_level?: string;
  skill_gap?: {
    current: string;
    required: string;
    estimated_hours_to_acquire: number;
  };
  status: 'linked';
}
```

#### `analyze_task_skills`
Analyze skill requirements for a task.

**Input Schema**:
```typescript
{
  type: 'object',
  properties: {
    task_id: {
      type: 'number',
      description: 'Task ID from Task Orchestrator'
    },
    include_recommendations: {
      type: 'boolean',
      description: 'Include skill acquisition recommendations',
      default: true
    }
  },
  required: ['task_id']
}
```

**Output**:
```typescript
{
  task_id: number;
  required_skills: Array<{
    skill_name: string;
    required_level: string;
    user_has: boolean;
    user_level?: string;
    gap?: string;
  }>;
  readiness_score: number;  // 0-100
  missing_skills: string[];
  recommendations?: Array<{
    skill_name: string;
    action: 'learn' | 'improve';
    priority: string;
    estimated_hours: number;
    resources: Resource[];
  }>;
}
```

#### `suggest_tasks_for_skills`
Suggest tasks based on user's skill inventory.

**Input Schema**:
```typescript
{
  type: 'object',
  properties: {
    skill_names: {
      type: 'array',
      items: { type: 'string' },
      description: 'List of skills to match'
    },
    min_match_percentage: {
      type: 'number',
      description: 'Minimum skill match percentage',
      default: 60
    },
    include_stretch_tasks: {
      type: 'boolean',
      description: 'Include tasks that require skills slightly above current level',
      default: false
    }
  }
}
```

**Output**:
```typescript
{
  count: number;
  suggested_tasks: Array<{
    task_id: number;
    task_title: string;
    match_percentage: number;
    matching_skills: string[];
    missing_skills: string[];
    difficulty_assessment: 'easy' | 'moderate' | 'challenging';
  }>;
}
```

### 4. Skill Discovery & Search

#### `search_skills`
Search for skills in OpenSkills/SkillsMP.

**Input Schema**:
```typescript
{
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description: 'Search query'
    },
    category: {
      type: 'string',
      description: 'Filter by category'
    },
    source: {
      type: 'string',
      enum: ['openskills', 'skillsmp', 'both'],
      description: 'Data source to search',
      default: 'both'
    },
    limit: {
      type: 'number',
      description: 'Maximum results',
      default: 10
    }
  },
  required: ['query']
}
```

**Output**:
```typescript
{
  count: number;
  skills: Array<{
    skill_id: string;
    skill_name: string;
    category: string;
    description: string;
    source: string;
    market_demand?: string;
    prerequisites: string[];
    user_has: boolean;
  }>;
}
```

#### `get_skill_details`
Get detailed information about a specific skill.

**Input Schema**:
```typescript
{
  type: 'object',
  properties: {
    skill_name: {
      type: 'string',
      description: 'Name of the skill'
    },
    source: {
      type: 'string',
      enum: ['openskills', 'skillsmp', 'auto'],
      description: 'Preferred data source',
      default: 'auto'
    }
  },
  required: ['skill_name']
}
```

**Output**:
```typescript
{
  skill_id: string;
  skill_name: string;
  category: string;
  subcategory: string;
  description: string;
  source: string;
  prerequisites: string[];
  related_skills: string[];
  learning_path: string[];
  resources: Resource[];
  market_demand?: string;
  estimated_hours: number;
  user_has: boolean;
  user_level?: string;
}
```

#### `get_learning_path`
Get a recommended learning path for a skill.

**Input Schema**:
```typescript
{
  type: 'object',
  properties: {
    skill_name: {
      type: 'string',
      description: 'Target skill name'
    },
    current_skills: {
      type: 'array',
      items: { type: 'string' },
      description: 'Skills user already has'
    },
    target_level: {
      type: 'string',
      enum: ['beginner', 'intermediate', 'advanced', 'expert'],
      description: 'Desired proficiency level',
      default: 'intermediate'
    }
  },
  required: ['skill_name']
}
```

**Output**:
```typescript
{
  skill_name: string;
  target_level: string;
  learning_path: Array<{
    step: number;
    skill_name: string;
    description: string;
    estimated_hours: number;
    prerequisites_met: boolean;
    resources: Resource[];
  }>;
  total_estimated_hours: number;
  prerequisites_missing: string[];
}
```

### 5. Recommendations & Analytics

#### `get_skill_recommendations`
Get personalized skill recommendations.

**Input Schema**:
```typescript
{
  type: 'object',
  properties: {
    based_on: {
      type: 'string',
      enum: ['current_skills', 'tasks', 'goals', 'market_demand', 'all'],
      description: 'Basis for recommendations',
      default: 'all'
    },
    limit: {
      type: 'number',
      description: 'Maximum recommendations',
      default: 5
    }
  }
}
```

**Output**:
```typescript
{
  count: number;
  recommendations: Array<{
    skill_name: string;
    category: string;
    reason: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    estimated_hours: number;
    market_demand?: string;
    related_to_skills: string[];
    related_to_tasks: number[];
  }>;
}
```

#### `analyze_skill_gaps`
Analyze skill gaps for career/project goals.

**Input Schema**:
```typescript
{
  type: 'object',
  properties: {
    target_role: {
      type: 'string',
      description: 'Target job role or project type'
    },
    required_skills: {
      type: 'array',
      items: { type: 'string' },
      description: 'List of required skills'
    }
  },
  required: ['required_skills']
}
```

**Output**:
```typescript
{
  total_skills_required: number;
  skills_possessed: number;
  skills_missing: number;
  coverage_percentage: number;
  gaps: Array<{
    skill_name: string;
    required_level: string;
    current_level: string | null;
    gap_size: 'small' | 'medium' | 'large';
    estimated_hours_to_fill: number;
    priority: string;
  }>;
  learning_plan: Array<{
    phase: number;
    skills: string[];
    estimated_hours: number;
    parallel_learning: boolean;
  }>;
}
```

#### `get_skill_stats`
Get statistics about user's skill inventory.

**Input Schema**:
```typescript
{
  type: 'object',
  properties: {}
}
```

**Output**:
```typescript
{
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
  skill_diversity_score: number;  // 0-100
}
```

### 6. Cache & Sync Management

#### `sync_skills_data`
Synchronize with OpenSkills/SkillsMP sources.

**Input Schema**:
```typescript
{
  type: 'object',
  properties: {
    source: {
      type: 'string',
      enum: ['openskills', 'skillsmp', 'both'],
      description: 'Data source to sync',
      default: 'both'
    },
    force_refresh: {
      type: 'boolean',
      description: 'Force refresh even if cache is valid',
      default: false
    }
  }
}
```

**Output**:
```typescript
{
  source: string;
  status: 'success' | 'partial' | 'failed';
  skills_updated: number;
  skills_added: number;
  cache_timestamp: string;
  next_sync_due: string;
}
```

#### `clear_skills_cache`
Clear the skills data cache.

**Input Schema**:
```typescript
{
  type: 'object',
  properties: {
    source: {
      type: 'string',
      enum: ['openskills', 'skillsmp', 'all'],
      description: 'Cache to clear',
      default: 'all'
    }
  }
}
```

**Output**:
```typescript
{
  status: 'cleared';
  entries_removed: number;
}
```

---

## Integration Strategy

### Integration with Task Orchestrator

**Purpose**: Link skills to tasks for readiness assessment and skill tracking.

**Integration Points**:

1. **Task Creation Hook**:
   - When a task is created, optionally specify required skills
   - Automatically analyze task description for skill keywords
   - Link skills to task in `task_skills` table

2. **Task Completion Hook**:
   - On task completion, update skill usage counts
   - Track which skills were used
   - Optionally increase proficiency scores

3. **Task Status Changes**:
   - When task becomes "blocked", check if skill gaps are the cause
   - Suggest learning goals to unblock tasks

**Implementation**:
```typescript
// In Task Orchestrator
async function onTaskCreated(task: Task) {
  // Extract skills from task description
  const detectedSkills = await skillsManager.detectSkills(task.description);
  
  // Link skills to task
  for (const skill of detectedSkills) {
    await skillsManager.linkSkillToTask(task.id, skill.name, skill.required_level);
  }
  
  // Analyze readiness
  const readiness = await skillsManager.analyzeTaskSkills(task.id);
  
  if (readiness.readiness_score < 60) {
    console.warn(`Task ${task.id} may require skill development`);
  }
}

async function onTaskCompleted(task: Task) {
  // Update skill usage
  const taskSkills = await skillsManager.getTaskSkills(task.id);
  
  for (const skill of taskSkills) {
    await skillsManager.incrementSkillUsage(skill.skill_id);
    
    // Optionally improve proficiency
    if (task.was_successful) {
      await skillsManager.updateSkillLevel(skill.skill_id, {
        source: 'task_completion',
        notes: `Completed task: ${task.title}`
      });
    }
  }
}
```

### Integration with Context Persistence

**Purpose**: Track skill development over time and provide historical context.

**Integration Points**:

1. **Conversation Context**:
   - Save skill-related decisions and learnings
   - Track when skills were discussed or used in conversations
   - Provide historical context for skill assessments

2. **Decision Logging**:
   - Log decisions related to skill acquisition
   - Track reasoning behind learning goal priorities
   - Maintain audit trail of skill level changes

3. **Semantic Search**:
   - Search past conversations for skill-related insights
   - Find previous learning attempts
   - Retrieve historical context for skill recommendations

**Implementation**:
```typescript
// In Skills Manager
async function updateSkillLevel(skillId: string, update: SkillUpdate) {
  // Update skill level
  const result = await database.updateSkill(skillId, update);
  
  // Log to Context Persistence
  await contextPersistence.saveDecision({
    conversation_id: currentConversationId,
    decision_type: 'skill_level_update',
    context: `Updated ${result.skill_name} from ${result.previous_level} to ${result.new_level}`,
    outcome: update.notes || 'Skill level updated'
  });
  
  return result;
}

async function createLearningGoal(goal: LearningGoal) {
  // Create goal
  const result = await database.insertLearningGoal(goal);
  
  // Log to Context Persistence
  await contextPersistence.saveDecision({
    conversation_id: currentConversationId,
    decision_type: 'learning_goal_created',
    context: `New learning goal: ${goal.skill_name} (target: ${goal.target_level})`,
    outcome: goal.reason || 'Learning goal established'
  });
  
  return result;
}
```

### Cross-Server Communication Protocol

**Shared Event Bus** (Future Enhancement):
```typescript
// Event types
type SkillEvent =
  | { type: 'skill_added'; skill: UserSkill }
  | { type: 'skill_level_updated'; skill_id: string; new_level: string }
  | { type: 'learning_goal_completed'; goal_id: number; skill: string }
  | { type: 'task_skills_analyzed'; task_id: number; readiness: number };

// Event emitter in Skills Manager
class SkillsEventEmitter {
  async emit(event: SkillEvent) {
    // Broadcast to other MCP servers
    // Implementation depends on MCP inter-server communication
  }
}

// Event listeners in other servers
class TaskOrchestrator {
  async handleSkillEvent(event: SkillEvent) {
    if (event.type === 'skill_level_updated') {
      // Re-analyze tasks that require this skill
      const affectedTasks = await this.getTasksBySkill(event.skill_id);
      for (const task of affectedTasks) {
        await this.reanalyzeTaskReadiness(task.id);
      }
    }
  }
}
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

**Goal**: Basic Skills Manager with local storage

#### Week 1: Core Infrastructure
- [ ] Set up project structure and dependencies
- [ ] Implement SQLite database layer with sql.js
- [ ] Create TypeScript types and interfaces
- [ ] Build basic MCP server scaffold
- [ ] Implement skill inventory CRUD operations

**Deliverables**:
- Working MCP server with `add_skill`, `update_skill_level`, `list_skills`, `remove_skill` tools
- SQLite database with core tables
- Basic tests for database operations

#### Week 2: Learning Goals & Proficiency Tracking
- [ ] Implement learning goals system
- [ ] Add proficiency history tracking
- [ ] Create skill search and filtering
- [ ] Add basic statistics and reporting

**Deliverables**:
- Learning goal management tools
- Proficiency tracking with history
- Basic skill statistics

**Testing Criteria**:
- Can add/update/remove skills
- Can create/update learning goals
- Proficiency history is tracked accurately
- Statistics are calculated correctly

### Phase 2: External Integrations (Week 3-4)

**Goal**: Integrate OpenSkills and SkillsMP data

#### Week 3: Provider Integrations
- [ ] Implement OpenSkills provider (GitHub repo integration)
- [ ] Implement SkillsMP provider (web scraping or API)
- [ ] Build cache layer with TTL management
- [ ] Add data normalization logic
- [ ] Implement hybrid caching strategy

**Deliverables**:
- OpenSkills integration with local caching
- SkillsMP integration with local caching
- `search_skills`, `get_skill_details`, `get_learning_path` tools
- Cache sync and management tools

#### Week 4: Recommendations Engine
- [ ] Implement skill recommendation algorithm
- [ ] Build learning path generator
- [ ] Add skill gap analysis
- [ ] Create resource recommendation system

**Deliverables**:
- `get_skill_recommendations` tool
- `analyze_skill_gaps` tool
- Intelligent learning path generation

**Testing Criteria**:
- Can fetch and cache OpenSkills data
- Can fetch and cache SkillsMP data
- Cache invalidation works correctly
- Recommendations are relevant and actionable

### Phase 3: MCP Server Integration (Week 5-6)

**Goal**: Integrate with Task Orchestrator and Context Persistence

#### Week 5: Task Orchestrator Integration
- [ ] Implement task-skill linking
- [ ] Add skill-based task analysis
- [ ] Build task suggestion engine
- [ ] Create automatic skill tracking on task completion

**Deliverables**:
- `link_skill_to_task`, `analyze_task_skills`, `suggest_tasks_for_skills` tools
- Hooks for Task Orchestrator events
- Automatic skill usage tracking

#### Week 6: Context Persistence Integration
- [ ] Implement skill decision logging
- [ ] Add conversation context tracking
- [ ] Build historical skill analysis
- [ ] Create cross-server event system (if supported)

**Deliverables**:
- Integration with Context Persistence for decision logging
- Historical skill development tracking
- Semantic search for skill-related conversations

**Testing Criteria**:
- Skills are correctly linked to tasks
- Task readiness is accurately calculated
- Skill usage is tracked on task completion
- Decisions are logged to Context Persistence

### Phase 4: Polish & Deployment (Week 7-8)

**Goal**: Production-ready Skills Manager

#### Week 7: UI & UX Improvements
- [ ] Add comprehensive error handling
- [ ] Implement data validation
- [ ] Create migration scripts
- [ ] Add logging and monitoring
- [ ] Optimize database queries

#### Week 8: Documentation & Deployment
- [ ] Write comprehensive documentation
- [ ] Create usage examples
- [ ] Build deployment scripts
- [ ] Add to MCP configuration
- [ ] End-to-end testing

**Deliverables**:
- Complete documentation (README, API docs, examples)
- Deployment scripts for all platforms
- Integration guide for Roo/Cursor/Claude Code
- Performance benchmarks

**Testing Criteria**:
- All tools work correctly
- Error handling is comprehensive
- Performance meets requirements
- Documentation is clear and complete

---

## Technical Specifications

### Dependencies

**package.json**:
```json
{
  "name": "mcp-skills-manager",
  "version": "0.1.0",
  "type": "module",
  "description": "Skills Management MCP Server with OpenSkills and SkillsMP integration",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc && node -e \"require('fs').chmodSync('dist/index.js', '755')\"",
    "dev": "tsc --watch",
    "test": "jest",
    "lint": "eslint src/**/*.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "sql.js": "^1.10.3",
    "axios": "^1.7.0",
    "cheerio": "^1.0.0-rc.12",
    "date-fns": "^3.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.3.0",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.0",
    "eslint": "^8.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0"
  }
}
```

### TypeScript Configuration

**tsconfig.json**:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### Core Type Definitions

**src/types.ts**:
```typescript
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
  type: 'documentation' | 'tutorial' | 'course' | 'book' | 'video';
  title: string;
  url?: string;
  difficulty: string;
  estimated_hours?: number;
  completed: boolean;
  rating?: number;
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
```

### Database Access Layer

**src/database.ts** (Excerpt):
```typescript
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { UserSkill, LearningGoal, CachedSkill } from './types.js';

export class SkillsDatabase {
  private db: SqlJsDatabase | null = null;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async init() {
    const SQL = await initSqlJs();
    
    if (existsSync(this.dbPath)) {
      const buffer = readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
      this.initSchema();
      this.save();
    }
  }

  private initSchema() {
    if (!this.db) return;
    
    // Execute schema creation from the SQL above
    // ... (schema SQL statements)
  }

  private save() {
    if (!this.db) return;
    const data = this.db.export();
    writeFileSync(this.dbPath, data);
  }

  // CRUD operations
  async addSkill(skill: Omit<UserSkill, 'id'>): Promise<UserSkill> {
    // Implementation
  }

  async updateSkill(skillId: string, updates: Partial<UserSkill>): Promise<UserSkill> {
    // Implementation
  }

  async getSkill(skillId: string): Promise<UserSkill | null> {
    // Implementation
  }

  async listSkills(filters?: any): Promise<UserSkill[]> {
    // Implementation
  }

  async removeSkill(skillId: string): Promise<void> {
    // Implementation
  }

  // Learning goals
  async createLearningGoal(goal: Omit<LearningGoal, 'id'>): Promise<LearningGoal> {
    // Implementation
  }

  async updateLearningGoal(goalId: number, updates: Partial<LearningGoal>): Promise<LearningGoal> {
    // Implementation
  }

  async listLearningGoals(filters?: any): Promise<LearningGoal[]> {
    // Implementation
  }

  // Cache management
  async getCachedSkill(skillName: string): Promise<CachedSkill | null> {
    // Implementation
  }

  async cacheskill(skill: CachedSkill): Promise<void> {
    // Implementation
  }

  async clearCache(source?: SkillSource): Promise<number> {
    // Implementation
  }
}
```

### Configuration

**Local Storage Location**:
```
~/.mcp/
└── skills/
    ├── skills.db          # SQLite database
    ├── cache/
    │   ├── openskills/    # Cached OpenSkills data
    │   └── skillsmp/      # Cached SkillsMP data
    └── logs/
        └── skills.log     # Server logs
```

**Environment Variables**:
```bash
# Optional API keys (if SkillsMP provides API)
SKILLSMP_API_KEY=

# Cache settings
SKILLS_CACHE_TTL=86400  # 24 hours
SKILLS_CACHE_MAX_SIZE=100  # MB

# Integration
TASK_ORCHESTRATOR_URL=
CONTEXT_PERSISTENCE_URL=

# Logging
SKILLS_LOG_LEVEL=info
```

### MCP Configuration

**Roo Configuration** (`mcp_settings.json`):
```json
{
  "mcpServers": {
    "skills-manager": {
      "command": "node",
      "args": ["/Users/ceverson/MCP_structure_design/mcp-servers/skills-manager/dist/index.js"],
      "env": {
        "SKILLS_DB_PATH": "/Users/ceverson/.mcp/skills/skills.db",
        "SKILLS_CACHE_DIR": "/Users/ceverson/.mcp/skills/cache",
        "SKILLS_LOG_LEVEL": "info"
      }
    }
  }
}
```

### Performance Considerations

**Optimization Strategies**:

1. **Database Indexing**:
   - Indexes on frequently queried columns
   - Compound indexes for multi-column queries
   - Regular VACUUM operations

2. **Caching Strategy**:
   - TTL-based invalidation (24 hours default)
   - LRU cache for frequently accessed skills
   - Batch fetching for external APIs

3. **Query Optimization**:
   - Prepared statements for repeated queries
   - Pagination for large result sets
   - Lazy loading of related data

4. **Memory Management**:
   - Stream large datasets
   - Limit cache size
   - Regular garbage collection

**Expected Performance**:
- Skill lookup: < 10ms
- Learning goal creation: < 20ms
- Task-skill analysis: < 50ms
- External API fetch (with cache): < 100ms
- External API fetch (no cache): < 2s

---

## Summary for Code Mode Implementation

### Quick Start Guide

**1. Project Setup**:
```bash
cd /Users/ceverson/MCP_structure_design/mcp-servers
mkdir -p skills-manager/src/providers
cd skills-manager
npm init -y
npm install @modelcontextprotocol/sdk sql.js axios cheerio date-fns
npm install -D typescript @types/node jest @types/jest
```

**2. Core Files to Create**:
- `src/index.ts` - Main MCP server entry point
- `src/database.ts` - SQLite database layer
- `src/cache.ts` - Caching logic
- `src/skills-manager.ts` - Core business logic
- `src/recommendations.ts` - Recommendation engine
- `src/integration.ts` - Integration with other servers
- `src/types.ts` - TypeScript interfaces
- `src/providers/openskills.ts` - OpenSkills integration
- `src/providers/skillsmp.ts` - SkillsMP integration

**3. Implementation Priority**:
1. Database layer with core schema
2. Basic MCP tools (add_skill, list_skills, etc.)
3. Learning goal management
4. Cache layer and provider integrations
5. Task-skill integration
6. Recommendation engine
7. Context persistence integration

**4. Testing Strategy**:
- Unit tests for database operations
- Integration tests for MCP tools
- E2E tests with Task Orchestrator
- Mock external API calls

**5. Deployment**:
```bash
npm run build
# Add to MCP configuration
# Test with: node dist/index.js
```

### Key Implementation Notes

1. **Follow Existing Patterns**: Use the same structure as Task Orchestrator and Search Aggregator
2. **Local-First**: All data in `~/.mcp/skills/`
3. **Error Handling**: Comprehensive try-catch with meaningful errors
4. **Logging**: Use console.error for server logs (stdio constraint)
5. **Type Safety**: Leverage TypeScript for all interfaces
6. **Async Operations**: Use async/await throughout
7. **Tool Responses**: Return JSON stringified objects in MCP response format

### Integration Points

**With Task Orchestrator**:
- Link skills to tasks via `task_id`
- Listen for task completion events
- Provide readiness assessments

**With Context Persistence**:
- Log skill decisions
- Track learning progress
- Provide historical context

**With Search Aggregator**:
- Use for external skill research
- Cache search results
- Enhance skill descriptions

---

## Conclusion

This architecture provides a comprehensive blueprint for implementing a Skills Management MCP server that:

1. ✅ **Integrates OpenSkills and SkillsMP** for comprehensive skill data
2. ✅ **Follows local-first principles** consistent with existing servers
3. ✅ **Provides rich MCP tools** for skill tracking, learning goals, and recommendations
4. ✅ **Integrates tightly** with Task Orchestrator and Context Persistence
5. ✅ **Uses hybrid caching** for optimal performance
6. ✅ **Includes complete specifications** ready for immediate implementation

The system is designed to be implemented in **8 weeks** with clear phases, deliverables, and testing criteria. All technical decisions are specific and actionable, following the proven patterns from the existing MCP server ecosystem.

**Ready for Code Mode Implementation** 🚀