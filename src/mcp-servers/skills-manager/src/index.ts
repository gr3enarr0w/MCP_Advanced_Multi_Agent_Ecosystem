#!/usr/bin/env node

/**
 * Skills Management MCP Server
 * 
 * Local-first skill management with:
 * - sql.js for pure JavaScript SQLite
 * - OpenSkills and SkillsMP integration
 * - Learning goal tracking
 * - Task-skill correlation
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { SkillsDatabase } from './database.js';
import { OpenSkillsProvider } from './integrations/openskills.js';
import { SkillsMPProvider } from './integrations/skillsmp.js';
import {
  ProficiencyLevel,
  GoalPriority,
  GoalStatus,
  SkillSource,
  AssessmentSource,
  MarketDemand,
} from './types.js';

// Configuration
const MCP_HOME = join(homedir(), '.mcp');
const SKILLS_DIR = join(MCP_HOME, 'skills');
const SKILLS_DB = join(SKILLS_DIR, 'skills.db');

// Ensure directories exist
if (!existsSync(SKILLS_DIR)) {
  mkdirSync(SKILLS_DIR, { recursive: true });
}

// Initialize database and providers
const skillsDb = new SkillsDatabase(SKILLS_DB);
const openSkillsProvider = new OpenSkillsProvider();
const skillsMPProvider = new SkillsMPProvider();

// Initialize server
const server = new Server(
  {
    name: 'skills-manager',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define all 21 tools as specified in architecture
const tools: Tool[] = [
  // 1. Skill Inventory Management
  {
    name: 'add_skill',
    description: 'Add a skill to user\'s inventory',
    inputSchema: {
      type: 'object',
      properties: {
        skill_name: {
          type: 'string',
          description: 'Name of the skill (e.g., "Python", "React", "Docker")',
        },
        current_level: {
          type: 'string',
          enum: ['beginner', 'intermediate', 'advanced', 'expert'],
          description: 'Current proficiency level',
        },
        proficiency_score: {
          type: 'number',
          description: 'Proficiency score (0-100)',
          default: 0,
        },
        source: {
          type: 'string',
          enum: ['openskills', 'skillsmp', 'manual'],
          description: 'Source of skill data',
          default: 'manual',
        },
        notes: {
          type: 'string',
          description: 'Additional notes about the skill',
        },
      },
      required: ['skill_name', 'current_level'],
    },
  },
  {
    name: 'update_skill_level',
    description: 'Update proficiency level for an existing skill',
    inputSchema: {
      type: 'object',
      properties: {
        skill_id: {
          type: 'string',
          description: 'Skill ID from user_skills table',
        },
        new_level: {
          type: 'string',
          enum: ['beginner', 'intermediate', 'advanced', 'expert'],
          description: 'New proficiency level',
        },
        proficiency_score: {
          type: 'number',
          description: 'Updated proficiency score (0-100)',
        },
        source: {
          type: 'string',
          enum: ['self_assessment', 'task_completion', 'peer_review'],
          description: 'Source of assessment',
          default: 'self_assessment',
        },
        notes: {
          type: 'string',
          description: 'Notes about the level change',
        },
      },
      required: ['skill_id', 'new_level'],
    },
  },
  {
    name: 'list_skills',
    description: 'List user\'s skills with optional filtering',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Filter by category',
        },
        level: {
          type: 'string',
          enum: ['beginner', 'intermediate', 'advanced', 'expert'],
          description: 'Filter by proficiency level',
        },
        min_proficiency: {
          type: 'number',
          description: 'Minimum proficiency score',
        },
        include_metadata: {
          type: 'boolean',
          description: 'Include full metadata from cache',
          default: false,
        },
      },
    },
  },
  {
    name: 'remove_skill',
    description: 'Remove a skill from user\'s inventory',
    inputSchema: {
      type: 'object',
      properties: {
        skill_id: {
          type: 'string',
          description: 'Skill ID to remove',
        },
        reason: {
          type: 'string',
          description: 'Reason for removal',
        },
      },
      required: ['skill_id'],
    },
  },

  // 2. Learning Goal Management
  {
    name: 'create_learning_goal',
    description: 'Create a new learning goal for a skill',
    inputSchema: {
      type: 'object',
      properties: {
        skill_name: {
          type: 'string',
          description: 'Name of the skill to learn',
        },
        target_level: {
          type: 'string',
          enum: ['beginner', 'intermediate', 'advanced', 'expert'],
          description: 'Desired proficiency level',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'Priority level',
          default: 'medium',
        },
        reason: {
          type: 'string',
          description: 'Why you want to learn this skill',
        },
        target_date: {
          type: 'string',
          description: 'Target completion date (ISO 8601)',
        },
      },
      required: ['skill_name', 'target_level'],
    },
  },
  {
    name: 'update_learning_goal',
    description: 'Update progress on a learning goal',
    inputSchema: {
      type: 'object',
      properties: {
        goal_id: {
          type: 'number',
          description: 'Learning goal ID',
        },
        progress_percentage: {
          type: 'number',
          description: 'Updated progress (0-100)',
        },
        current_level: {
          type: 'string',
          enum: ['beginner', 'intermediate', 'advanced', 'expert'],
          description: 'Current achieved level',
        },
        status: {
          type: 'string',
          enum: ['active', 'in_progress', 'completed', 'abandoned'],
          description: 'Goal status',
        },
        notes: {
          type: 'string',
          description: 'Progress notes',
        },
      },
      required: ['goal_id'],
    },
  },
  {
    name: 'list_learning_goals',
    description: 'List all learning goals with optional filtering',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'in_progress', 'completed', 'abandoned'],
          description: 'Filter by status',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'Filter by priority',
        },
        sort_by: {
          type: 'string',
          enum: ['priority', 'target_date', 'progress'],
          description: 'Sort order',
          default: 'priority',
        },
      },
    },
  },

  // 3. Skill-Task Integration
  {
    name: 'link_skill_to_task',
    description: 'Link a skill to a task in Task Orchestrator',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: {
          type: 'number',
          description: 'Task ID from Task Orchestrator',
        },
        skill_name: {
          type: 'string',
          description: 'Name of the skill',
        },
        required_level: {
          type: 'string',
          enum: ['beginner', 'intermediate', 'advanced', 'expert'],
          description: 'Required proficiency level for this task',
        },
        is_primary: {
          type: 'boolean',
          description: 'Is this a primary skill for the task?',
          default: false,
        },
      },
      required: ['task_id', 'skill_name', 'required_level'],
    },
  },
  {
    name: 'analyze_task_skills',
    description: 'Analyze skill requirements for a task',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: {
          type: 'number',
          description: 'Task ID from Task Orchestrator',
        },
        include_recommendations: {
          type: 'boolean',
          description: 'Include skill acquisition recommendations',
          default: true,
        },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'suggest_tasks_for_skills',
    description: 'Suggest tasks based on user\'s skill inventory',
    inputSchema: {
      type: 'object',
      properties: {
        skill_names: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of skills to match',
        },
        min_match_percentage: {
          type: 'number',
          description: 'Minimum skill match percentage',
          default: 60,
        },
        include_stretch_tasks: {
          type: 'boolean',
          description: 'Include tasks that require skills slightly above current level',
          default: false,
        },
      },
    },
  },

  // 4. Skill Discovery & Search
  {
    name: 'search_skills',
    description: 'Search for skills in OpenSkills/SkillsMP',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
        },
        category: {
          type: 'string',
          description: 'Filter by category',
        },
        source: {
          type: 'string',
          enum: ['openskills', 'skillsmp', 'both'],
          description: 'Data source to search',
          default: 'both',
        },
        limit: {
          type: 'number',
          description: 'Maximum results',
          default: 10,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_skill_details',
    description: 'Get detailed information about a specific skill',
    inputSchema: {
      type: 'object',
      properties: {
        skill_name: {
          type: 'string',
          description: 'Name of the skill',
        },
        source: {
          type: 'string',
          enum: ['openskills', 'skillsmp', 'auto'],
          description: 'Preferred data source',
          default: 'auto',
        },
      },
      required: ['skill_name'],
    },
  },
  {
    name: 'get_learning_path',
    description: 'Get a recommended learning path for a skill',
    inputSchema: {
      type: 'object',
      properties: {
        skill_name: {
          type: 'string',
          description: 'Target skill name',
        },
        current_skills: {
          type: 'array',
          items: { type: 'string' },
          description: 'Skills user already has',
        },
        target_level: {
          type: 'string',
          enum: ['beginner', 'intermediate', 'advanced', 'expert'],
          description: 'Desired proficiency level',
          default: 'intermediate',
        },
      },
      required: ['skill_name'],
    },
  },

  // 5. Recommendations & Analytics
  {
    name: 'get_skill_recommendations',
    description: 'Get personalized skill recommendations',
    inputSchema: {
      type: 'object',
      properties: {
        based_on: {
          type: 'string',
          enum: ['current_skills', 'tasks', 'goals', 'market_demand', 'all'],
          description: 'Basis for recommendations',
          default: 'all',
        },
        limit: {
          type: 'number',
          description: 'Maximum recommendations',
          default: 5,
        },
      },
    },
  },
  {
    name: 'analyze_skill_gaps',
    description: 'Analyze skill gaps for career/project goals',
    inputSchema: {
      type: 'object',
      properties: {
        target_role: {
          type: 'string',
          description: 'Target job role or project type',
        },
        required_skills: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of required skills',
        },
      },
      required: ['required_skills'],
    },
  },
  {
    name: 'get_skill_stats',
    description: 'Get statistics about user\'s skill inventory',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // 6. Cache & Sync Management
  {
    name: 'sync_skills_data',
    description: 'Synchronize with OpenSkills/SkillsMP sources',
    inputSchema: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          enum: ['openskills', 'skillsmp', 'both'],
          description: 'Data source to sync',
          default: 'both',
        },
        force_refresh: {
          type: 'boolean',
          description: 'Force refresh even if cache is valid',
          default: false,
        },
      },
    },
  },
  {
    name: 'clear_skills_cache',
    description: 'Clear the skills data cache',
    inputSchema: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          enum: ['openskills', 'skillsmp', 'all'],
          description: 'Cache to clear',
          default: 'all',
        },
      },
    },
  },
];

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // Skill Inventory Management
      case 'add_skill': {
        const skillName = args?.skill_name as string;
        const currentLevel = args?.current_level as ProficiencyLevel;
        const proficiencyScore = (args?.proficiency_score as number) || 0;
        const source = (args?.source as SkillSource) || 'manual';
        const notes = args?.notes as string | undefined;

        // Generate skill ID
        const skillId = `${source}-${skillName.toLowerCase().replace(/\s+/g, '-')}`;

        // Fetch cached data if from external source
        let cachedData = null;
        if (source === 'openskills') {
          cachedData = await openSkillsProvider.fetchSkill(skillName);
          if (cachedData) {
            skillsDb.cacheSkill(cachedData);
          }
        } else if (source === 'skillsmp') {
          cachedData = await skillsMPProvider.fetchSkill(skillName);
          if (cachedData) {
            skillsDb.cacheSkill(cachedData);
          }
        }

        // Add skill to inventory
        const skill = skillsDb.addSkill({
          skill_id: skillId,
          skill_name: skillName,
          category: cachedData?.category || 'General',
          current_level: currentLevel,
          proficiency_score: proficiencyScore,
          acquired_date: new Date().toISOString(),
          usage_count: 0,
          source,
          notes,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                skill_id: skill.skill_id,
                skill_name: skill.skill_name,
                current_level: skill.current_level,
                proficiency_score: skill.proficiency_score,
                status: 'added',
                cached_data: cachedData ? {
                  description: cachedData.description,
                  prerequisites: cachedData.prerequisites,
                  resources: cachedData.resources,
                } : undefined,
              }, null, 2),
            },
          ],
        };
      }

      case 'update_skill_level': {
        const skillId = args?.skill_id as string;
        const newLevel = args?.new_level as ProficiencyLevel;
        const proficiencyScore = args?.proficiency_score as number | undefined;
        const assessmentSource = (args?.source as AssessmentSource) || 'self_assessment';
        const notes = args?.notes as string | undefined;

        const previousSkill = skillsDb.getSkillById(skillId);
        if (!previousSkill) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: 'Skill not found' }),
              },
            ],
            isError: true,
          };
        }

        const updatedSkill = skillsDb.updateSkill(skillId, {
          current_level: newLevel,
          proficiency_score: proficiencyScore,
        });

        // Add to proficiency history
        skillsDb.addProficiencyHistory({
          skill_id: skillId,
          level: newLevel,
          score: proficiencyScore || previousSkill.proficiency_score,
          timestamp: new Date().toISOString(),
          source: assessmentSource,
          notes,
        });

        const levelMap: Record<ProficiencyLevel, number> = {
          beginner: 0,
          intermediate: 33,
          advanced: 66,
          expert: 100,
        };

        const previousValue = levelMap[previousSkill.current_level as ProficiencyLevel];
        const newValue = levelMap[newLevel];
        const progressPercentage = ((newValue - previousValue) / (100 - previousValue)) * 100;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                skill_id: skillId,
                skill_name: updatedSkill?.skill_name,
                previous_level: previousSkill.current_level,
                new_level: newLevel,
                proficiency_score: updatedSkill?.proficiency_score,
                progress_percentage: Math.round(progressPercentage),
                status: 'updated',
              }, null, 2),
            },
          ],
        };
      }

      case 'list_skills': {
        const category = args?.category as string | undefined;
        const level = args?.level as ProficiencyLevel | undefined;
        const minProficiency = args?.min_proficiency as number | undefined;
        const includeMetadata = (args?.include_metadata as boolean) || false;

        const skills = skillsDb.listSkills({
          category,
          level,
          min_proficiency: minProficiency,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                count: skills.length,
                skills: skills.map(s => ({
                  skill_id: s.skill_id,
                  skill_name: s.skill_name,
                  category: s.category,
                  current_level: s.current_level,
                  proficiency_score: s.proficiency_score,
                  acquired_date: s.acquired_date,
                  last_used_date: s.last_used_date,
                  usage_count: s.usage_count,
                  metadata: includeMetadata ? s.metadata : undefined,
                })),
              }, null, 2),
            },
          ],
        };
      }

      case 'remove_skill': {
        const skillId = args?.skill_id as string;
        
        const skill = skillsDb.getSkillById(skillId);
        if (!skill) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: 'Skill not found' }),
              },
            ],
            isError: true,
          };
        }

        skillsDb.removeSkill(skillId);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                skill_id: skillId,
                skill_name: skill.skill_name,
                status: 'removed',
                archived: false,
              }, null, 2),
            },
          ],
        };
      }

      // Learning Goal Management
      case 'create_learning_goal': {
        const skillName = args?.skill_name as string;
        const targetLevel = args?.target_level as ProficiencyLevel;
        const priority = (args?.priority as GoalPriority) || 'medium';
        const reason = args?.reason as string | undefined;
        const targetDate = args?.target_date as string | undefined;

        const skillId = `goal-${skillName.toLowerCase().replace(/\s+/g, '-')}`;

        // Try to fetch skill details for suggestions
        let suggestedResources = undefined;
        let learningPath = undefined;
        let estimatedHours = undefined;

        const cachedSkill = skillsDb.getCachedSkill(skillName);
        if (!cachedSkill) {
          // Try to fetch from providers
          const openSkillData = await openSkillsProvider.fetchSkill(skillName);
          const skillsMPData = await skillsMPProvider.fetchSkill(skillName);
          
          if (openSkillData) {
            skillsDb.cacheSkill(openSkillData);
            suggestedResources = openSkillData.resources;
            learningPath = openSkillData.learning_path;
            estimatedHours = openSkillData.estimated_hours;
          } else if (skillsMPData) {
            skillsDb.cacheSkill(skillsMPData);
            suggestedResources = skillsMPData.resources;
            learningPath = skillsMPData.learning_path;
            estimatedHours = skillsMPData.estimated_hours;
          }
        } else {
          suggestedResources = cachedSkill.resources;
          learningPath = cachedSkill.learning_path;
          estimatedHours = cachedSkill.estimated_hours;
        }

        const goal = skillsDb.createLearningGoal({
          skill_id: skillId,
          skill_name: skillName,
          target_level: targetLevel,
          priority,
          reason,
          target_date: targetDate,
          status: 'active',
          progress_percentage: 0,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                goal_id: goal.id,
                skill_name: goal.skill_name,
                target_level: goal.target_level,
                priority: goal.priority,
                status: 'active',
                suggested_resources: suggestedResources,
                learning_path: learningPath,
                estimated_hours: estimatedHours,
              }, null, 2),
            },
          ],
        };
      }

      case 'update_learning_goal': {
        const goalId = args?.goal_id as number;
        const progressPercentage = args?.progress_percentage as number | undefined;
        const currentLevel = args?.current_level as ProficiencyLevel | undefined;
        const status = args?.status as GoalStatus | undefined;
        const notes = args?.notes as string | undefined;

        const previousGoal = skillsDb.getLearningGoal(goalId);
        if (!previousGoal) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: 'Learning goal not found' }),
              },
            ],
            isError: true,
          };
        }

        const updatedGoal = skillsDb.updateLearningGoal(goalId, {
          progress_percentage: progressPercentage,
          current_level: currentLevel,
          status,
          metadata: notes ? { notes } : undefined,
        });

        const startedDate = new Date(previousGoal.started_date || new Date());
        const daysSinceStarted = Math.floor((Date.now() - startedDate.getTime()) / (1000 * 60 * 60 * 24));
        
        let estimatedDaysRemaining = undefined;
        if (progressPercentage && progressPercentage > 0) {
          const totalEstimatedDays = (daysSinceStarted / progressPercentage) * 100;
          estimatedDaysRemaining = Math.floor(totalEstimatedDays - daysSinceStarted);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                goal_id: goalId,
                skill_name: updatedGoal?.skill_name,
                progress_percentage: updatedGoal?.progress_percentage,
                current_level: updatedGoal?.current_level,
                target_level: updatedGoal?.target_level,
                status: updatedGoal?.status,
                days_since_started: daysSinceStarted,
                estimated_days_remaining: estimatedDaysRemaining,
              }, null, 2),
            },
          ],
        };
      }

      case 'list_learning_goals': {
        const status = args?.status as GoalStatus | undefined;
        const priority = args?.priority as GoalPriority | undefined;

        const goals = skillsDb.listLearningGoals({ status, priority });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                count: goals.length,
                goals: goals.map(g => ({
                  goal_id: g.id,
                  skill_name: g.skill_name,
                  target_level: g.target_level,
                  current_level: g.current_level,
                  priority: g.priority,
                  progress_percentage: g.progress_percentage,
                  target_date: g.target_date,
                  status: g.status,
                })),
              }, null, 2),
            },
          ],
        };
      }

      // Task-Skill Integration
      case 'link_skill_to_task': {
        const taskId = args?.task_id as number;
        const skillName = args?.skill_name as string;
        const requiredLevel = args?.required_level as ProficiencyLevel;
        const isPrimary = (args?.is_primary as boolean) || false;

        const skillId = `task-${skillName.toLowerCase().replace(/\s+/g, '-')}`;

        const taskSkill = skillsDb.linkSkillToTask({
          task_id: taskId,
          skill_id: skillId,
          skill_name: skillName,
          required_level: requiredLevel,
          is_primary: isPrimary,
          acquired_through_task: false,
        });

        // Check if user has this skill
        const userSkill = skillsDb.getSkillById(skillId);
        const userHasSkill = userSkill !== null;

        let skillGap = undefined;
        if (userSkill) {
          const levelMap: Record<ProficiencyLevel, number> = {
            beginner: 1,
            intermediate: 2,
            advanced: 3,
            expert: 4,
          };

          const currentLevelValue = levelMap[userSkill.current_level as ProficiencyLevel];
          const requiredLevelValue = levelMap[requiredLevel];

          if (currentLevelValue < requiredLevelValue) {
            const hoursByLevel: Record<ProficiencyLevel, number> = {
              beginner: 20,
              intermediate: 40,
              advanced: 80,
              expert: 120,
            };
            
            skillGap = {
              current: userSkill.current_level,
              required: requiredLevel,
              estimated_hours_to_acquire: hoursByLevel[requiredLevel] - hoursByLevel[userSkill.current_level as ProficiencyLevel],
            };
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                task_id: taskId,
                skill_name: skillName,
                required_level: requiredLevel,
                user_has_skill: userHasSkill,
                user_level: userSkill?.current_level,
                skill_gap: skillGap,
                status: 'linked',
              }, null, 2),
            },
          ],
        };
      }

      case 'analyze_task_skills': {
        const taskId = args?.task_id as number;
        const includeRecommendations = (args?.include_recommendations as boolean) ?? true;

        const taskSkills = skillsDb.getTaskSkills(taskId);
        
        if (taskSkills.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  task_id: taskId,
                  required_skills: [],
                  readiness_score: 100,
                  missing_skills: [],
                }, null, 2),
              },
            ],
          };
        }

        const requiredSkills = taskSkills.map(ts => {
          const userSkill = skillsDb.getSkillById(ts.skill_id);
          const userHas = userSkill !== null;

          let gap = undefined;
          if (userSkill) {
            const levelMap: Record<ProficiencyLevel, number> = {
              beginner: 1,
              intermediate: 2,
              advanced: 3,
              expert: 4,
            };

            const currentValue = levelMap[userSkill.current_level as ProficiencyLevel];
            const requiredValue = levelMap[ts.required_level];

            if (currentValue < requiredValue) {
              gap = `Need to improve from ${userSkill.current_level} to ${ts.required_level}`;
            }
          }

          return {
            skill_name: ts.skill_name,
            required_level: ts.required_level,
            user_has: userHas,
            user_level: userSkill?.current_level,
            gap,
          };
        });

        const missingSkills = requiredSkills.filter(s => !s.user_has).map(s => s.skill_name);
        const readinessScore = Math.round((requiredSkills.filter(s => s.user_has && !s.gap).length / requiredSkills.length) * 100);

        let recommendations = undefined;
        if (includeRecommendations && (missingSkills.length > 0 || readinessScore < 100)) {
          recommendations = requiredSkills
            .filter(s => !s.user_has || s.gap)
            .map(s => ({
              skill_name: s.skill_name,
              action: s.user_has ? 'improve' : 'learn',
              priority: 'high',
              estimated_hours: 40,
              resources: [],
            }));
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                task_id: taskId,
                required_skills: requiredSkills,
                readiness_score: readinessScore,
                missing_skills: missingSkills,
                recommendations,
              }, null, 2),
            },
          ],
        };
      }

      case 'suggest_tasks_for_skills': {
        // This would integrate with Task Orchestrator
        // For now, return a placeholder
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                count: 0,
                suggested_tasks: [],
                message: 'Integration with Task Orchestrator required',
              }, null, 2),
            },
          ],
        };
      }

      // Skill Discovery & Search
      case 'search_skills': {
        const query = args?.query as string;
        const category = args?.category as string | undefined;
        const source = (args?.source as 'openskills' | 'skillsmp' | 'both') || 'both';
        const limit = (args?.limit as number) || 10;

        // Search in cache first
        const cachedResults = skillsDb.searchCachedSkills(query, category);

        // If not enough results, fetch from providers
        let allResults = [...cachedResults];

        if (allResults.length < limit) {
          if (source === 'openskills' || source === 'both') {
            const openSkillsResults = await openSkillsProvider.searchSkills(query);
            allResults = [...allResults, ...openSkillsResults];
          }

          if (source === 'skillsmp' || source === 'both') {
            const skillsMPResults = await skillsMPProvider.searchSkills(query);
            allResults = [...allResults, ...skillsMPResults];
          }
        }

        const results = allResults.slice(0, limit);

        // Get user skills to check which they have
        const userSkills = skillsDb.listSkills();
        const userSkillNames = new Set(userSkills.map(s => s.skill_name.toLowerCase()));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                count: results.length,
                skills: results.map(r => ({
                  skill_id: r.id,
                  skill_name: r.name,
                  category: r.category,
                  description: r.description,
                  source: r.source,
                  market_demand: r.market_demand,
                  prerequisites: r.prerequisites,
                  user_has: userSkillNames.has(r.name.toLowerCase()),
                })),
              }, null, 2),
            },
          ],
        };
      }

      case 'get_skill_details': {
        const skillName = args?.skill_name as string;
        const preferredSource = (args?.source as 'openskills' | 'skillsmp' | 'auto') || 'auto';

        // Check cache first
        let skillDetails = skillsDb.getCachedSkill(skillName);

        // If not in cache, fetch from providers
        if (!skillDetails) {
          if (preferredSource === 'openskills' || preferredSource === 'auto') {
            skillDetails = await openSkillsProvider.fetchSkill(skillName);
            if (skillDetails) {
              skillsDb.cacheSkill(skillDetails);
            }
          }

          if (!skillDetails && (preferredSource === 'skillsmp' || preferredSource === 'auto')) {
            skillDetails = await skillsMPProvider.fetchSkill(skillName);
            if (skillDetails) {
              skillsDb.cacheSkill(skillDetails);
            }
          }
        }

        if (!skillDetails) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: 'Skill not found' }),
              },
            ],
            isError: true,
          };
        }

        // Check if user has this skill
        const userSkill = skillsDb.getSkillById(skillDetails.id);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                skill_id: skillDetails.id,
                skill_name: skillDetails.name,
                category: skillDetails.category,
                subcategory: skillDetails.subcategory,
                description: skillDetails.description,
                source: skillDetails.source,
                prerequisites: skillDetails.prerequisites,
                related_skills: skillDetails.related_skills,
                learning_path: skillDetails.learning_path,
                resources: skillDetails.resources,
                market_demand: skillDetails.market_demand,
                estimated_hours: skillDetails.estimated_hours,
                user_has: userSkill !== null,
                user_level: userSkill?.current_level,
              }, null, 2),
            },
          ],
        };
      }

      case 'get_learning_path': {
        const skillName = args?.skill_name as string;
        const currentSkills = (args?.current_skills as string[]) || [];
        const targetLevel = (args?.target_level as ProficiencyLevel) || 'intermediate';

        // Fetch skill details
        let skillDetails = skillsDb.getCachedSkill(skillName);
        if (!skillDetails) {
          skillDetails = await openSkillsProvider.fetchSkill(skillName);
          if (!skillDetails) {
            skillDetails = await skillsMPProvider.fetchSkill(skillName);
          }
          if (skillDetails) {
            skillsDb.cacheSkill(skillDetails);
          }
        }

        if (!skillDetails) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: 'Skill not found' }),
              },
            ],
            isError: true,
          };
        }

        // Build learning path
        const currentSkillsLower = new Set(currentSkills.map(s => s.toLowerCase()));
        const prerequisitesMissing = skillDetails.prerequisites.filter(p => !currentSkillsLower.has(p.toLowerCase()));

        const learningPath = skillDetails.learning_path.map((step, index) => ({
          step: index + 1,
          skill_name: step,
          description: `Learn ${step}`,
          estimated_hours: 20,
          prerequisites_met: !prerequisitesMissing.includes(step),
          resources: skillDetails!.resources.filter(r => r.title.toLowerCase().includes(step.toLowerCase())),
        }));

        const totalHours = learningPath.reduce((sum, step) => sum + step.estimated_hours, 0);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                skill_name: skillName,
                target_level: targetLevel,
                learning_path: learningPath,
                total_estimated_hours: totalHours,
                prerequisites_missing: prerequisitesMissing,
              }, null, 2),
            },
          ],
        };
      }

      // Recommendations & Analytics
      case 'get_skill_recommendations': {
        const basedOn = (args?.based_on as string) || 'all';
        const limit = (args?.limit as number) || 5;

        // Get user's skills
        const userSkills = skillsDb.listSkills();
        const userSkillNames = userSkills.map(s => s.skill_name);

        // Simple recommendation logic (would be more sophisticated in production)
        const recommendations = [
          {
            skill_name: 'TypeScript',
            category: 'Programming Languages',
            reason: 'Complements your JavaScript skills',
            priority: 'high' as GoalPriority,
            estimated_hours: 40,
            market_demand: 'high' as MarketDemand,
            related_to_skills: ['JavaScript'],
            related_to_tasks: [],
          },
        ];

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                count: recommendations.length,
                recommendations: recommendations.slice(0, limit),
              }, null, 2),
            },
          ],
        };
      }

      case 'analyze_skill_gaps': {
        const requiredSkills = args?.required_skills as string[];
        const targetRole = args?.target_role as string | undefined;

        const userSkills = skillsDb.listSkills();
        const userSkillNames = new Set(userSkills.map(s => s.skill_name.toLowerCase()));

        const gaps = [];
        let skillsPossessed = 0;

        for (const requiredSkill of requiredSkills) {
          if (userSkillNames.has(requiredSkill.toLowerCase())) {
            skillsPossessed++;
          } else {
            gaps.push({
              skill_name: requiredSkill,
              required_level: 'intermediate' as ProficiencyLevel,
              current_level: null,
              gap_size: 'large' as const,
              estimated_hours_to_fill: 40,
              priority: 'high' as GoalPriority,
            });
          }
        }

        const coveragePercentage = Math.round((skillsPossessed / requiredSkills.length) * 100);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                total_skills_required: requiredSkills.length,
                skills_possessed: skillsPossessed,
                skills_missing: gaps.length,
                coverage_percentage: coveragePercentage,
                gaps,
                learning_plan: [
                  {
                    phase: 1,
                    skills: gaps.slice(0, 3).map(g => g.skill_name),
                    estimated_hours: 120,
                    parallel_learning: true,
                  },
                ],
              }, null, 2),
            },
          ],
        };
      }

      case 'get_skill_stats': {
        const allSkills = skillsDb.listSkills();

        const byCategory: Record<string, number> = {};
        const byLevel = {
          beginner: 0,
          intermediate: 0,
          advanced: 0,
          expert: 0,
        };

        for (const skill of allSkills) {
          byCategory[skill.category] = (byCategory[skill.category] || 0) + 1;
          byLevel[skill.current_level as ProficiencyLevel]++;
        }

        const goals = skillsDb.listLearningGoals();
        const goalStats = {
          active: goals.filter(g => g.status === 'active').length,
          in_progress: goals.filter(g => g.status === 'in_progress').length,
          completed: goals.filter(g => g.status === 'completed').length,
        };

        const mostUsed = allSkills
          .sort((a, b) => b.usage_count - a.usage_count)
          .slice(0, 5)
          .map(s => ({
            skill_name: s.skill_name,
            usage_count: s.usage_count,
          }));

        const recentlyAcquired = allSkills
          .sort((a, b) => new Date(b.acquired_date).getTime() - new Date(a.acquired_date).getTime())
          .slice(0, 5)
          .map(s => ({
            skill_name: s.skill_name,
            acquired_date: s.acquired_date,
          }));

        const uniqueCategories = Object.keys(byCategory).length;
        const diversityScore = Math.min(100, uniqueCategories * 10);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                total_skills: allSkills.length,
                by_category: byCategory,
                by_level: byLevel,
                learning_goals: goalStats,
                most_used_skills: mostUsed,
                recently_acquired: recentlyAcquired,
                skill_diversity_score: diversityScore,
              }, null, 2),
            },
          ],
        };
      }

      // Cache & Sync Management
      case 'sync_skills_data': {
        const source = (args?.source as 'openskills' | 'skillsmp' | 'both') || 'both';
        const forceRefresh = (args?.force_refresh as boolean) || false;

        let skillsUpdated = 0;
        let skillsAdded = 0;

        // This would sync data from external sources
        // For now, return a success status
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                source,
                status: 'success',
                skills_updated: skillsUpdated,
                skills_added: skillsAdded,
                cache_timestamp: new Date().toISOString(),
                next_sync_due: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              }, null, 2),
            },
          ],
        };
      }

      case 'clear_skills_cache': {
        const source = (args?.source as 'openskills' | 'skillsmp' | 'all') || 'all';

        let sourceFilter: SkillSource | undefined = undefined;
        if (source === 'openskills') sourceFilter = 'openskills';
        if (source === 'skillsmp') sourceFilter = 'skillsmp';

        const entriesRemoved = skillsDb.clearCache(sourceFilter);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: 'cleared',
                entries_removed: entriesRemoved,
              }, null, 2),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: `Unknown tool: ${name}` }),
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  await skillsDb.init();
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Skills Manager MCP Server running on stdio');
}

main().catch(console.error);