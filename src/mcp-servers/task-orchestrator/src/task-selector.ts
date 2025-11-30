/**
 * Task Selector
 * 
 * Intelligent task selection system for optimal workflow planning
 * 
 * Features:
 * - Find next optimal task based on dependencies
 * - Consider complexity constraints and user preferences
 * - Priority-based task ranking
 * - Flow optimization for similar tasks
 * - Multi-factor scoring system
 * - Real-time task availability analysis
 */

import { analyzeComplexity, ComplexityAnalysisResult } from './complexity-analyzer';

/**
 * Task selection options
 */
export interface TaskSelectionOptions {
  /** Maximum complexity score allowed */
  maxComplexity?: number;
  /** Preferred task types */
  preferredTaskTypes?: string[];
  /** Preferred programming languages */
  preferredLanguages?: string[];
  /** Excluded task tags */
  excludedTags?: string[];
  /** Required task tags */
  requiredTags?: string[];
  /** Maximum estimated hours */
  maxEstimatedHours?: number;
  /** Minimum estimated hours */
  minEstimatedHours?: number;
  /** Priority threshold */
  priorityThreshold?: number;
  /** Flow optimization preferences */
  flowOptimization?: FlowOptimizationOptions;
  /** Working hours per day */
  workingHoursPerDay?: number;
  /** Time constraints */
  timeConstraints?: TimeConstraints;
  /** Team capacity */
  teamCapacity?: TeamCapacity;
}

/**
 * Flow optimization options
 */
export interface FlowOptimizationOptions {
  /** Enable grouping similar tasks */
  enableGrouping?: boolean;
  /** Grouping criteria */
  groupingCriteria?: 'technology' | 'domain' | 'complexity' | 'dependency' | 'priority';
  /** Enable context switching minimization */
  minimizeContextSwitching?: boolean;
  /** Enable batch processing */
  enableBatchProcessing?: boolean;
  /** Maximum batch size */
  maxBatchSize?: number;
}

/**
 * Time constraints for task selection
 */
export interface TimeConstraints {
  /** Available working hours today */
  hoursAvailableToday?: number;
  /** Available working hours this week */
  hoursAvailableThisWeek?: number;
  /** Deadline constraints */
  deadlines?: TaskDeadline[];
}

/**
 * Task deadline constraint
 */
export interface TaskDeadline {
  /** Task ID */
  taskId: number;
  /** Deadline date */
  deadline: string;
  /** Penalty for missing deadline */
  penalty?: number;
}

/**
 * Team capacity information
 */
export interface TeamCapacity {
  /** Number of available developers */
  availableDevelopers?: number;
  /** Team skill levels */
  teamSkills?: Record<string, number>;
  /** Workload distribution */
  workloadDistribution?: Record<string, number>;
}

/**
 * Selected task result
 */
export interface SelectedTaskResult {
  /** Selected task */
  selectedTask: SelectableTask;
  /** Alternative tasks */
  alternatives: SelectableTask[];
  /** Selection reasoning */
  reasoning: TaskSelectionReasoning;
  /** Scheduling suggestions */
  schedulingSuggestions: SchedulingSuggestion[];
  /** Risk assessment */
  riskAssessment: TaskSelectionRiskAssessment;
  /** Selection metadata */
  metadata: {
    selectionTime: string;
    analysisDepth: string;
    candidatesConsidered: number;
    criteria: TaskSelectionOptions;
  };
}

/**
 * Selectable task with enhanced metadata
 */
export interface SelectableTask {
  /** Task ID */
  id: number;
  /** Task title */
  title: string;
  /** Task description */
  description?: string;
  /** Current status */
  status: 'pending' | 'in_progress' | 'blocked' | 'completed';
  /** Priority level */
  priority: number;
  /** Task dependencies */
  dependencies: number[];
  /** Task tags */
  tags: string[];
  /** Programming language */
  code_language?: string;
  /** Estimated effort (hours) */
  estimatedEffort?: number;
  /** Complexity analysis */
  complexity?: ComplexityAnalysisResult;
  /** Readiness score (0-1) */
  readinessScore: number;
  /** Urgency score (0-1) */
  urgencyScore: number;
  /** Business value score (0-1) */
  businessValueScore: number;
  /** Technical complexity score (0-1) */
  technicalComplexityScore: number;
  /** Resource availability score (0-1) */
  resourceAvailabilityScore: number;
  /** Overall selection score (0-1) */
  overallScore: number;
  /** Blocking factors */
  blockingFactors: BlockingFactor[];
  /** Success probability (0-1) */
  successProbability: number;
}

/**
 * Task selection reasoning
 */
export interface TaskSelectionReasoning {
  /** Primary selection reason */
  primaryReason: string;
  /** Decision factors */
  decisionFactors: DecisionFactor[];
  /** Alternative considerations */
  alternativesConsidered: string[];
  /** Risk trade-offs */
  riskTradeOffs: string[];
  /** Expected benefits */
  expectedBenefits: string[];
}

/**
 * Decision factor for task selection
 */
export interface DecisionFactor {
  /** Factor name */
  name: string;
  /** Factor weight (0-1) */
  weight: number;
  /** Factor score (0-1) */
  score: number;
  /** Contribution to overall score */
  contribution: number;
  /** Factor description */
  description: string;
}

/**
 * Blocking factor
 */
export interface BlockingFactor {
  /** Blocking type */
  type: 'dependency' | 'resource' | 'technical' | 'business' | 'deadline';
  /** Description */
  description: string;
  /** Impact level (0-1) */
  impact: number;
  /** Mitigation suggestion */
  mitigation?: string;
}

/**
 * Scheduling suggestion
 */
export interface SchedulingSuggestion {
  /** Suggested start time */
  suggestedStartTime: string;
  /** Estimated completion time */
  estimatedCompletionTime: string;
  /** Recommended duration */
  recommendedDuration: number;
  /** Resource requirements */
  resourceRequirements: string[];
  /** Scheduling rationale */
  rationale: string;
}

/**
 * Task selection risk assessment
 */
export interface TaskSelectionRiskAssessment {
  /** Overall risk level */
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  /** Risk factors */
  riskFactors: TaskSelectionRiskFactor[];
  /** Mitigation strategies */
  mitigationStrategies: string[];
  /** Contingency plans */
  contingencyPlans: ContingencyPlan[];
}

/**
 * Task selection risk factor
 */
export interface TaskSelectionRiskFactor {
  /** Risk category */
  category: 'schedule' | 'quality' | 'resource' | 'technical' | 'business';
  /** Risk description */
  description: string;
  /** Probability (0-1) */
  probability: number;
  /** Impact (0-1) */
  impact: number;
  /** Risk score */
  riskScore: number;
  /** Mitigation priority */
  priority: 'low' | 'medium' | 'high';
}

/**
 * Contingency plan
 */
export interface ContingencyPlan {
  /** Scenario description */
  scenario: string;
  /** Response actions */
  responseActions: string[];
  /** Resource requirements */
  resourceRequirements: string[];
  /** Expected resolution time */
  expectedResolutionTime: number;
}

/**
 * Task query interface for selection
 */
export interface TaskQuery {
  /** Project ID to filter tasks */
  projectId?: string;
  /** Task status filter */
  statusFilter?: ('pending' | 'in_progress' | 'blocked')[];
  /** Date range filter */
  dateRange?: {
    createdAfter?: string;
    createdBefore?: string;
    updatedAfter?: string;
    updatedBefore?: string;
  };
  /** Custom filters */
  customFilters?: Record<string, any>;
}

/**
 * Default selection weights
 */
const DEFAULT_SELECTION_WEIGHTS = {
  readinessScore: 0.25,      // How ready the task is to start
  urgencyScore: 0.20,        // How urgent the task is
  priorityScore: 0.20,       // Task priority normalized
  businessValueScore: 0.15,  // Business value assessment
  complexityScore: 0.10,     // How well complexity matches constraints
  resourceAvailabilityScore: 0.10, // Resource availability
};

/**
 * Task Selector Class
 */
export class TaskSelector {
  private selectionWeights: typeof DEFAULT_SELECTION_WEIGHTS;

  constructor(weights?: Partial<typeof DEFAULT_SELECTION_WEIGHTS>) {
    this.selectionWeights = { ...DEFAULT_SELECTION_WEIGHTS, ...weights };
  }

  /**
   * Get next optimal task for project
   * 
   * @param projectId Project ID to select tasks for
   * @param maxComplexity Maximum complexity threshold
   * @param options Selection options
   * @returns Selected task result
   */
  async getNextTask(
    projectId: string, 
    maxComplexity: number = 8, 
    options: TaskSelectionOptions = {}
  ): Promise<SelectedTaskResult> {
    const startTime = Date.now();
    
    try {
      // Get all pending and blocked tasks for project
      const allTasks = await this.getTasksForProject(projectId, {
        statusFilter: ['pending', 'blocked'],
        ...options,
      });

      if (allTasks.length === 0) {
        throw new Error('No available tasks found for the specified criteria');
      }

      // Analyze complexity and calculate scores for each task
      const analyzedTasks = await this.analyzeTasks(allTasks, maxComplexity, options);
      
      // Filter tasks based on options
      const filteredTasks = this.filterTasks(analyzedTasks, options);
      
      if (filteredTasks.length === 0) {
        throw new Error('No tasks match the specified selection criteria');
      }

      // Rank tasks by overall score
      const rankedTasks = this.rankTasks(filteredTasks, options);
      
      // Select the best task
      const selectedTask = rankedTasks[0];
      const alternatives = rankedTasks.slice(1, 6); // Top 5 alternatives
      
      // Generate selection reasoning
      const reasoning = this.generateSelectionReasoning(selectedTask, alternatives, options);
      
      // Generate scheduling suggestions
      const schedulingSuggestions = this.generateSchedulingSuggestions(selectedTask, options);
      
      // Perform risk assessment
      const riskAssessment = this.assessSelectionRisks(selectedTask, alternatives, options);

      const result: SelectedTaskResult = {
        selectedTask,
        alternatives,
        reasoning,
        schedulingSuggestions,
        riskAssessment,
        metadata: {
          selectionTime: new Date().toISOString(),
          analysisDepth: this.determineAnalysisDepth(options),
          candidatesConsidered: allTasks.length,
          criteria: options,
        },
      };

      return result;
    } catch (error) {
      throw new Error(`Task selection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get tasks for project (placeholder - integrate with your database)
   */
  private async getTasksForProject(
    projectId: string, 
    query: TaskQuery
  ): Promise<any[]> {
    // This is a placeholder - in real implementation, this would fetch from your database
    // For demo purposes, return mock tasks
    return [
      {
        id: 1,
        title: 'Implement user authentication',
        description: 'Add JWT-based authentication system',
        status: 'pending',
        priority: 4,
        dependencies: [],
        tags: ['security', 'backend'],
        code_language: 'typescript',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      },
      {
        id: 2,
        title: 'Create user profile API',
        description: 'REST API for user profile management',
        status: 'pending',
        priority: 3,
        dependencies: [1],
        tags: ['api', 'backend'],
        code_language: 'typescript',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      },
      {
        id: 3,
        title: 'Design user dashboard UI',
        description: 'Create responsive dashboard interface',
        status: 'pending',
        priority: 3,
        dependencies: [2],
        tags: ['frontend', 'ui'],
        code_language: 'typescript',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      },
    ];
  }

  /**
   * Analyze tasks with complexity and scoring
   */
  private async analyzeTasks(
    tasks: any[], 
    maxComplexity: number, 
    options: TaskSelectionOptions
  ): Promise<SelectableTask[]> {
    const analyzedTasks: SelectableTask[] = [];

    for (const task of tasks) {
      try {
        // Perform complexity analysis
        const complexity = await analyzeComplexity(task.id, {
          estimateCodeVolume: true,
          analyzeDependencies: true,
          assessRisk: true,
          useHistoricalData: true,
        });

        // Calculate scores
        const readinessScore = this.calculateReadinessScore(task, complexity);
        const urgencyScore = this.calculateUrgencyScore(task, complexity, options);
        const businessValueScore = this.calculateBusinessValueScore(task, complexity);
        const technicalComplexityScore = this.calculateTechnicalComplexityScore(complexity, maxComplexity);
        const resourceAvailabilityScore = this.calculateResourceAvailabilityScore(task, options);
        
        // Calculate overall score
        const overallScore = this.calculateOverallScore({
          readinessScore,
          urgencyScore,
          priorityScore: this.normalizePriority(task.priority),
          businessValueScore,
          technicalComplexityScore,
          resourceAvailabilityScore,
        });

        // Assess blocking factors
        const blockingFactors = this.assessBlockingFactors(task, complexity);

        // Calculate success probability
        const successProbability = this.calculateSuccessProbability(task, complexity, blockingFactors);

        analyzedTasks.push({
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          dependencies: task.dependencies || [],
          tags: task.tags || [],
          code_language: task.code_language,
          estimatedEffort: complexity.estimatedHours,
          complexity,
          readinessScore,
          urgencyScore,
          businessValueScore,
          technicalComplexityScore,
          resourceAvailabilityScore,
          overallScore,
          blockingFactors,
          successProbability,
        });
      } catch (error) {
        // Log error but continue with other tasks
        console.warn(`Failed to analyze task ${task.id}:`, error);
      }
    }

    return analyzedTasks;
  }

  /**
   * Calculate readiness score for a task
   */
  private calculateReadinessScore(task: any, complexity: ComplexityAnalysisResult): number {
    let score = 1.0; // Start with full readiness

    // Reduce readiness based on dependencies
    if (task.dependencies && task.dependencies.length > 0) {
      const dependencyPenalty = Math.min(task.dependencies.length * 0.1, 0.5);
      score -= dependencyPenalty;
    }

    // Reduce readiness based on complexity risk
    if (complexity.riskAssessment.level === 'critical') {
      score -= 0.3;
    } else if (complexity.riskAssessment.level === 'high') {
      score -= 0.2;
    } else if (complexity.riskAssessment.level === 'medium') {
      score -= 0.1;
    }

    // Adjust based on confidence
    score *= complexity.confidence;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate urgency score for a task
   */
  private calculateUrgencyScore(
    task: any, 
    complexity: ComplexityAnalysisResult, 
    options: TaskSelectionOptions
  ): number {
    let score = 0.5; // Base urgency

    // Priority contribution
    const priorityWeight = task.priority / 5; // Normalize to 0-1
    score += priorityWeight * 0.4;

    // Deadline pressure (if available)
    if (options.timeConstraints?.deadlines) {
      const taskDeadline = options.timeConstraints.deadlines.find(d => d.taskId === task.id);
      if (taskDeadline) {
        const daysUntilDeadline = this.getDaysUntilDeadline(taskDeadline.deadline);
        if (daysUntilDeadline <= 1) {
          score += 0.3; // Very urgent
        } else if (daysUntilDeadline <= 7) {
          score += 0.2; // Urgent
        } else if (daysUntilDeadline <= 30) {
          score += 0.1; // Moderately urgent
        }
      }
    }

    // Technical debt urgency
    if (complexity.riskAssessment.technicalDebt.length > 0) {
      const criticalDebt = complexity.riskAssessment.technicalDebt.filter(d => d.priority === 'critical');
      if (criticalDebt.length > 0) {
        score += 0.1;
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate business value score
   */
  private calculateBusinessValueScore(task: any, complexity: ComplexityAnalysisResult): number {
    let score = 0.5; // Base business value

    // High-priority tasks likely have higher business value
    if (task.priority >= 4) {
      score += 0.2;
    } else if (task.priority <= 2) {
      score -= 0.1;
    }

    // New feature tasks typically have higher business value than maintenance
    if (task.tags?.some((tag: string) => ['feature', 'enhancement', 'new'].includes(tag))) {
      score += 0.2;
    }

    // Tasks with clear descriptions likely have clearer business value
    if (task.description && task.description.length > 50) {
      score += 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate technical complexity score
   */
  private calculateTechnicalComplexityScore(
    complexity: ComplexityAnalysisResult, 
    maxComplexity: number
  ): number {
    const complexityRatio = complexity.score / maxComplexity;
    
    // Tasks with optimal complexity (not too simple, not too complex) get higher scores
    if (complexityRatio <= 0.3) {
      return 0.3; // Too simple, might not be worth the context switch
    } else if (complexityRatio >= 0.8 && complexityRatio <= 1.0) {
      return 0.8; // Complex but manageable
    } else if (complexityRatio > 1.0) {
      return 0.1; // Too complex for current constraints
    } else {
      return 0.9; // Optimal complexity range
    }
  }

  /**
   * Calculate resource availability score
   */
  private calculateResourceAvailabilityScore(task: any, options: TaskSelectionOptions): number {
    let score = 1.0; // Assume full availability

    // Check language preferences
    if (options.preferredLanguages && task.code_language) {
      if (!options.preferredLanguages.includes(task.code_language)) {
        score -= 0.3; // Penalty for non-preferred languages
      }
    }

    // Check task type preferences
    if (options.preferredTaskTypes && task.tags) {
      const hasPreferredType = task.tags.some((tag: string) => 
        options.preferredTaskTypes!.includes(tag)
      );
      if (!hasPreferredType) {
        score -= 0.2;
      }
    }

    // Check excluded tags
    if (options.excludedTags && task.tags) {
      const hasExcludedTag = task.tags.some((tag: string) => 
        options.excludedTags!.includes(tag)
      );
      if (hasExcludedTag) {
        score = 0; // Completely exclude
      }
    }

    // Check team capacity
    if (options.teamCapacity?.availableDevelopers !== undefined) {
      if (options.teamCapacity.availableDevelopers === 0) {
        score = 0; // No available developers
      } else if (options.teamCapacity.availableDevelopers === 1) {
        score *= 0.8; // Limited capacity
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate overall selection score
   */
  private calculateOverallScore(scores: {
    readinessScore: number;
    urgencyScore: number;
    priorityScore: number;
    businessValueScore: number;
    technicalComplexityScore: number;
    resourceAvailabilityScore: number;
  }): number {
    return (
      scores.readinessScore * this.selectionWeights.readinessScore +
      scores.urgencyScore * this.selectionWeights.urgencyScore +
      scores.priorityScore * this.selectionWeights.priorityScore +
      scores.businessValueScore * this.selectionWeights.businessValueScore +
      scores.technicalComplexityScore * this.selectionWeights.complexityScore +
      scores.resourceAvailabilityScore * this.selectionWeights.resourceAvailabilityScore
    );
  }

  /**
   * Normalize priority to 0-1 scale
   */
  private normalizePriority(priority: number): number {
    return Math.max(0, Math.min(1, priority / 5));
  }

  /**
   * Assess blocking factors for a task
   */
  private assessBlockingFactors(task: any, complexity: ComplexityAnalysisResult): BlockingFactor[] {
    const blockingFactors: BlockingFactor[] = [];

    // Dependency blocking
    if (task.dependencies && task.dependencies.length > 0) {
      blockingFactors.push({
        type: 'dependency',
        description: `Blocked by ${task.dependencies.length} dependencies`,
        impact: Math.min(task.dependencies.length * 0.1, 0.5),
      });
    }

    // High risk blocking
    if (complexity.riskAssessment.level === 'critical') {
      blockingFactors.push({
        type: 'technical',
        description: 'Critical technical risk identified',
        impact: 0.4,
        mitigation: 'Review technical approach and consider breaking into smaller tasks',
      });
    }

    // Resource blocking (example)
    if (complexity.estimatedHours > 40) {
      blockingFactors.push({
        type: 'resource',
        description: 'High effort requirement may strain resources',
        impact: 0.2,
        mitigation: 'Consider breaking into smaller tasks or extending timeline',
      });
    }

    return blockingFactors;
  }

  /**
   * Calculate success probability
   */
  private calculateSuccessProbability(
    task: any, 
    complexity: ComplexityAnalysisResult, 
    blockingFactors: BlockingFactor[]
  ): number {
    let probability = 0.8; // Base success rate

    // Adjust for complexity
    if (complexity.score > 8) {
      probability -= 0.2;
    } else if (complexity.score < 3) {
      probability -= 0.1; // Too simple might indicate unclear requirements
    }

    // Adjust for blocking factors
    blockingFactors.forEach(factor => {
      probability -= factor.impact * 0.3;
    });

    // Adjust for confidence
    probability *= complexity.confidence;

    return Math.max(0.1, Math.min(0.95, probability));
  }

  /**
   * Filter tasks based on options
   */
  private filterTasks(tasks: SelectableTask[], options: TaskSelectionOptions): SelectableTask[] {
    return tasks.filter(task => {
      // Complexity filter
      if (options.maxComplexity && task.complexity && task.complexity.score > options.maxComplexity) {
        return false;
      }

      // Estimated hours filter
      if (options.maxEstimatedHours && task.estimatedEffort && task.estimatedEffort > options.maxEstimatedHours) {
        return false;
      }

      if (options.minEstimatedHours && task.estimatedEffort && task.estimatedEffort < options.minEstimatedHours) {
        return false;
      }

      // Priority threshold
      if (options.priorityThreshold && task.priority < options.priorityThreshold) {
        return false;
      }

      // Required tags filter
      if (options.requiredTags && options.requiredTags.length > 0) {
        const hasRequiredTag = options.requiredTags.every(tag => task.tags.includes(tag));
        if (!hasRequiredTag) {
          return false;
        }
      }

      // Excluded tags filter (additional safety check)
      if (options.excludedTags && task.tags.some(tag => options.excludedTags!.includes(tag))) {
        return false;
      }

      // Language preferences
      if (options.preferredLanguages && task.code_language) {
        if (!options.preferredLanguages.includes(task.code_language)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Rank tasks by overall score
   */
  private rankTasks(tasks: SelectableTask[], options: TaskSelectionOptions): SelectableTask[] {
    return tasks.sort((a, b) => {
      // Primary sort by overall score
      const scoreDiff = b.overallScore - a.overallScore;
      if (Math.abs(scoreDiff) > 0.01) {
        return scoreDiff;
      }

      // Secondary sort by readiness (prefer ready tasks)
      const readinessDiff = b.readinessScore - a.readinessScore;
      if (Math.abs(readinessDiff) > 0.01) {
        return readinessDiff;
      }

      // Tertiary sort by priority
      return b.priority - a.priority;
    });
  }

  /**
   * Generate selection reasoning
   */
  private generateSelectionReasoning(
    selectedTask: SelectableTask,
    alternatives: SelectableTask[],
    options: TaskSelectionOptions
  ): TaskSelectionReasoning {
    const decisionFactors: DecisionFactor[] = [
      {
        name: 'Task Readiness',
        weight: this.selectionWeights.readinessScore,
        score: selectedTask.readinessScore,
        contribution: selectedTask.readinessScore * this.selectionWeights.readinessScore,
        description: 'How ready the task is to start (dependencies, risk, etc.)',
      },
      {
        name: 'Business Urgency',
        weight: this.selectionWeights.urgencyScore,
        score: selectedTask.urgencyScore,
        contribution: selectedTask.urgencyScore * this.selectionWeights.urgencyScore,
        description: 'Business urgency and deadline pressure',
      },
      {
        name: 'Priority Level',
        weight: this.selectionWeights.priorityScore,
        score: this.normalizePriority(selectedTask.priority),
        contribution: this.normalizePriority(selectedTask.priority) * this.selectionWeights.priorityScore,
        description: 'Task priority level',
      },
      {
        name: 'Resource Match',
        weight: this.selectionWeights.resourceAvailabilityScore,
        score: selectedTask.resourceAvailabilityScore,
        contribution: selectedTask.resourceAvailabilityScore * this.selectionWeights.resourceAvailabilityScore,
        description: 'How well task matches available resources and preferences',
      },
    ];

    return {
      primaryReason: `Selected "${selectedTask.title}" due to high readiness score (${selectedTask.readinessScore.toFixed(2)}) and optimal complexity match`,
      decisionFactors,
      alternativesConsidered: alternatives.slice(0, 3).map(task => 
        `"${task.title}" (score: ${task.overallScore.toFixed(2)})`
      ),
      riskTradeOffs: this.identifyRiskTradeoffs(selectedTask, alternatives),
      expectedBenefits: this.identifyExpectedBenefits(selectedTask),
    };
  }

  /**
   * Generate scheduling suggestions
   */
  private generateSchedulingSuggestions(
    selectedTask: SelectableTask, 
    options: TaskSelectionOptions
  ): SchedulingSuggestion[] {
    const suggestions: SchedulingSuggestion[] = [];
    const estimatedHours = selectedTask.estimatedEffort || 8;

    // Suggest scheduling based on time constraints
    if (options.timeConstraints?.hoursAvailableToday) {
      if (estimatedHours <= options.timeConstraints.hoursAvailableToday) {
        suggestions.push({
          suggestedStartTime: new Date().toISOString(),
          estimatedCompletionTime: new Date(Date.now() + estimatedHours * 60 * 60 * 1000).toISOString(),
          recommendedDuration: estimatedHours,
          resourceRequirements: ['1 developer', 'development environment'],
          rationale: 'Can be completed within today\'s available hours',
        });
      } else {
        suggestions.push({
          suggestedStartTime: new Date().toISOString(),
          estimatedCompletionTime: new Date(Date.now() + estimatedHours * 60 * 60 * 1000).toISOString(),
          recommendedDuration: estimatedHours,
          resourceRequirements: ['1 developer', 'development environment', 'extended timeline'],
          rationale: `Requires ${estimatedHours} hours but only ${options.timeConstraints.hoursAvailableToday} hours available today - plan for multi-day execution`,
        });
      }
    }

    // Flow optimization suggestion
    if (options.flowOptimization?.enableGrouping) {
      suggestions.push({
        suggestedStartTime: new Date().toISOString(),
        estimatedCompletionTime: new Date(Date.now() + estimatedHours * 60 * 60 * 1000).toISOString(),
        recommendedDuration: estimatedHours,
        resourceRequirements: [`1 ${selectedTask.code_language || 'developer'}`],
        rationale: `Consider grouping with other ${selectedTask.code_language || 'similar'} tasks for better flow`,
      });
    }

    return suggestions;
  }

  /**
   * Assess selection risks
   */
  private assessSelectionRisks(
    selectedTask: SelectableTask,
    alternatives: SelectableTask[],
    options: TaskSelectionOptions
  ): TaskSelectionRiskAssessment {
    const riskFactors: TaskSelectionRiskFactor[] = [];

    // Complexity risk
    if (selectedTask.complexity && selectedTask.complexity.score > 7) {
      riskFactors.push({
        category: 'technical',
        description: 'High complexity task may face implementation challenges',
        probability: 0.6,
        impact: 0.7,
        riskScore: 0.42,
        priority: 'high',
      });
    }

    // Dependency risk
    if (selectedTask.dependencies.length > 0) {
      riskFactors.push({
        category: 'schedule',
        description: `Task depends on ${selectedTask.dependencies.length} other tasks`,
        probability: 0.4,
        impact: selectedTask.dependencies.length > 3 ? 0.6 : 0.3,
        riskScore: 0.24,
        priority: 'medium',
      });
    }

    // Resource risk
    if (selectedTask.estimatedEffort && selectedTask.estimatedEffort > 20) {
      riskFactors.push({
        category: 'resource',
        description: 'Long-duration task may impact team velocity',
        probability: 0.5,
        impact: 0.4,
        riskScore: 0.20,
        priority: 'medium',
      });
    }

    const overallRisk = this.calculateOverallRisk(riskFactors);

    return {
      overallRisk,
      riskFactors,
      mitigationStrategies: this.generateRiskMitigationStrategies(selectedTask),
      contingencyPlans: this.generateContingencyPlans(selectedTask),
    };
  }

  /**
   * Helper methods
   */
  private getDaysUntilDeadline(deadline: string): number {
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const diffTime = deadlineDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private determineAnalysisDepth(options: TaskSelectionOptions): string {
    if (options.flowOptimization?.enableGrouping) {
      return 'deep';
    } else if (options.timeConstraints || options.teamCapacity) {
      return 'comprehensive';
    }
    return 'standard';
  }

  private identifyRiskTradeoffs(selectedTask: SelectableTask, alternatives: SelectableTask[]): string[] {
    const tradeoffs: string[] = [];
    
    if (selectedTask.complexity && selectedTask.complexity.score > 7) {
      tradeoffs.push('High complexity chosen over simpler alternatives for greater business value');
    }

    if (selectedTask.dependencies.length > alternatives[0]?.dependencies.length) {
      tradeoffs.push('More dependencies accepted for higher priority/business value');
    }

    return tradeoffs;
  }

  private identifyExpectedBenefits(selectedTask: SelectableTask): string[] {
    const benefits: string[] = [];
    
    if (selectedTask.businessValueScore > 0.7) {
      benefits.push('High business value delivery');
    }
    
    if (selectedTask.readinessScore > 0.8) {
      benefits.push('Quick start due to high readiness');
    }
    
    if (selectedTask.successProbability > 0.8) {
      benefits.push('High probability of successful completion');
    }

    return benefits;
  }

  private calculateOverallRisk(riskFactors: TaskSelectionRiskFactor[]): 'low' | 'medium' | 'high' | 'critical' {
    const maxRiskScore = Math.max(...riskFactors.map(rf => rf.riskScore), 0);
    
    if (maxRiskScore > 0.6) return 'critical';
    if (maxRiskScore > 0.4) return 'high';
    if (maxRiskScore > 0.2) return 'medium';
    return 'low';
  }

  private generateRiskMitigationStrategies(selectedTask: SelectableTask): string[] {
    const strategies: string[] = [];
    
    if (selectedTask.blockingFactors.some(bf => bf.type === 'dependency')) {
      strategies.push('Monitor dependency completion closely and have backup plans');
    }
    
    if (selectedTask.complexity && selectedTask.complexity.score > 7) {
      strategies.push('Break down complex tasks into smaller, manageable subtasks');
      strategies.push('Allocate additional review and testing time');
    }
    
    strategies.push('Regular progress check-ins and risk reassessment');
    
    return strategies;
  }

  private generateContingencyPlans(selectedTask: SelectableTask): ContingencyPlan[] {
    const plans: ContingencyPlan[] = [];
    
    plans.push({
      scenario: 'Dependencies are delayed',
      responseActions: ['Reassess priority', 'Consider working on independent subtasks', 'Update timeline'],
      resourceRequirements: ['Project manager availability', 'Stakeholder communication'],
      expectedResolutionTime: 2,
    });
    
    if (selectedTask.estimatedEffort && selectedTask.estimatedEffort > 16) {
      plans.push({
        scenario: 'Task takes significantly longer than estimated',
        responseActions: ['Re-estimate remaining work', 'Consider scope reduction', 'Allocate additional resources'],
        resourceRequirements: ['Additional developer', 'Extended timeline approval'],
        expectedResolutionTime: 4,
      });
    }

    return plans;
  }
}

/**
 * Get next optimal task for project
 * 
 * @param projectId Project ID to select tasks for
 * @param maxComplexity Maximum complexity threshold
 * @param options Selection options
 * @returns Selected task result
 */
export async function getNextTask(
  projectId: string,
  maxComplexity: number = 8,
  options: TaskSelectionOptions = {}
): Promise<SelectedTaskResult> {
  const selector = new TaskSelector();
  return selector.getNextTask(projectId, maxComplexity, options);
}