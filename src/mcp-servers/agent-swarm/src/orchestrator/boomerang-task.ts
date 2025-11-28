/**
 * Boomerang Task Manager
 * 
 * Implements the boomerang pattern for task refinement and iterative improvement
 * Tasks can be sent back to previous agents for refinement based on feedback
 * 
 * Key Features:
 * - Task boomerang delegation and tracking
 * - Feedback-based refinement workflows
 * - Quality gates and validation
 * - Iterative improvement cycles
 * - Agent feedback collection and analysis
 */

import { EventEmitter } from 'eventemitter3';
import { Task, AgentType, AgentMessage, MessagePriority } from '../types/agents.js';
import { AgentStorage } from '../storage/agent-storage.js';

export interface BoomerangTask {
  id: string;
  originalTaskId: string;
  boomerangId: string;
  targetAgent: string; // Agent ID or type
  sourceAgent: string;
  feedback: string;
  refinementType: 'quality_improvement' | 'error_correction' | 'optimization' | 'feature_addition' | 'performance_tuning';
  priority: number;
  status: 'pending' | 'sent' | 'in_progress' | 'returned' | 'completed' | 'failed';
  sentAt: Date;
  returnedAt?: Date;
  expectedReturnTime: number; // milliseconds
  refinementCount: number;
  maxRefinements: number;
  boomerangMetadata: {
    originalQuality: number;
    targetQuality: number;
    improvementMetrics: Record<string, number>;
    validationResults: ValidationResult[];
  };
}

export interface ValidationResult {
  type: 'functionality' | 'performance' | 'quality' | 'compliance';
  passed: boolean;
  score: number;
  details: string;
  timestamp: Date;
}

export interface RefinementFeedback {
  taskId: string;
  agentId: string;
  feedback: string;
  qualityMetrics: {
    functionality: number;
    performance: number;
    maintainability: number;
    userExperience: number;
  };
  recommendations: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export class BoomerangTaskManager extends EventEmitter {
  private storage: AgentStorage;
  private activeBoomerangs: Map<string, BoomerangTask> = new Map();
  private boomerangHistory: BoomerangTask[] = [];
  private feedbackQueue: RefinementFeedback[] = [];
  private refinementPatterns: Map<string, RefinementPattern> = new Map();

  constructor(storage: AgentStorage) {
    super();
    this.storage = storage;
    this.initializeRefinementPatterns();
  }

  private initializeRefinementPatterns(): void {
    // Define common refinement patterns
    this.refinementPatterns.set('code_quality', {
      name: 'Code Quality Refinement',
      description: 'Improve code quality, maintainability, and best practices',
      commonFeedback: [
        'Code needs better documentation',
        'Reduce code complexity',
        'Improve variable naming',
        'Add unit tests',
        'Follow coding standards'
      ],
      validationMetrics: ['complexity_score', 'test_coverage', 'documentation_completeness'],
      typicalAgents: ['review', 'debugger'],
    });

    this.refinementPatterns.set('performance_optimization', {
      name: 'Performance Optimization',
      description: 'Optimize code performance and resource usage',
      commonFeedback: [
        'Optimize algorithm complexity',
        'Reduce memory usage',
        'Improve response time',
        'Optimize database queries',
        'Cache frequently accessed data'
      ],
      validationMetrics: ['execution_time', 'memory_usage', 'throughput'],
      typicalAgents: ['debugger', 'implementation'],
    });

    this.refinementPatterns.set('feature_enhancement', {
      name: 'Feature Enhancement',
      description: 'Add new features or enhance existing functionality',
      commonFeedback: [
        'Add error handling',
        'Improve user interface',
        'Add configuration options',
        'Enhance security features',
        'Improve accessibility'
      ],
      validationMetrics: ['feature_completeness', 'user_satisfaction', 'security_score'],
      typicalAgents: ['implementation', 'review'],
    });

    this.refinementPatterns.set('bug_fixing', {
      name: 'Bug Fixing',
      description: 'Fix identified bugs and issues',
      commonFeedback: [
        'Fix null pointer exceptions',
        'Handle edge cases',
        'Correct logical errors',
        'Fix memory leaks',
        'Resolve concurrency issues'
      ],
      validationMetrics: ['bug_count', 'test_pass_rate', 'stability_score'],
      typicalAgents: ['debugger', 'testing'],
    });
  }

  async initialize(): Promise<void> {
    try {
      // Load existing boomerang tasks from storage
      await this.loadBoomerangHistory();
      
      // Set up timeout checking for boomerang returns
      this.setupBoomerangTimeoutChecking();
      
      // Set up feedback processing
      this.setupFeedbackProcessing();
      
      console.log('Boomerang Task Manager initialized');
    } catch (error) {
      console.error('Failed to initialize Boomerang Task Manager:', error);
      throw error;
    }
  }

  async sendBoomerang(task: Task, targetAgent: string, feedback: string, options?: {
    refinementType?: BoomerangTask['refinementType'];
    priority?: number;
    expectedReturnTime?: number;
    maxRefinements?: number;
  }): Promise<BoomerangTask> {
    const boomerangId = `boomerang_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Determine the best refinement type based on feedback
    const refinementType = options?.refinementType || this.inferRefinementType(feedback);
    
    const boomerangTask: BoomerangTask = {
      id: `boomerang_${task.id}_${boomerangId}`,
      originalTaskId: task.id,
      boomerangId,
      targetAgent,
      sourceAgent: task.agentId || 'unknown',
      feedback,
      refinementType,
      priority: options?.priority || this.calculateRefinementPriority(feedback),
      status: 'pending',
      sentAt: new Date(),
      expectedReturnTime: options?.expectedReturnTime || this.calculateExpectedReturnTime(refinementType),
      refinementCount: 1,
      maxRefinements: options?.maxRefinements || 3,
      boomerangMetadata: {
        originalQuality: task.resultQuality || 0,
        targetQuality: this.calculateTargetQuality(refinementType),
        improvementMetrics: {},
        validationResults: [],
      },
    };

    // Store the boomerang task
    this.activeBoomerangs.set(boomerangTask.id, boomerangTask);
    await this.storeBoomerangTask(boomerangTask);

    // Send the boomerang task
    await this.sendBoomerangToAgent(boomerangTask);

    this.emit('boomerang:sent', task.id, targetAgent);
    console.log(`Boomerang sent: task ${task.id} to ${targetAgent} (${refinementType})`);

    return boomerangTask;
  }

  private inferRefinementType(feedback: string): BoomerangTask['refinementType'] {
    const feedbackLower = feedback.toLowerCase();
    
    if (feedbackLower.includes('bug') || feedbackLower.includes('error') || feedbackLower.includes('fix')) {
      return 'error_correction';
    } else if (feedbackLower.includes('performance') || feedbackLower.includes('speed') || feedbackLower.includes('optimize')) {
      return 'performance_tuning';
    } else if (feedbackLower.includes('feature') || feedbackLower.includes('add') || feedbackLower.includes('enhance')) {
      return 'feature_addition';
    } else if (feedbackLower.includes('quality') || feedbackLower.includes('improve') || feedbackLower.includes('refine')) {
      return 'quality_improvement';
    } else {
      return 'quality_improvement'; // Default
    }
  }

  private calculateRefinementPriority(feedback: string): number {
    const feedbackLower = feedback.toLowerCase();
    
    if (feedbackLower.includes('critical') || feedbackLower.includes('security') || feedbackLower.includes('urgent')) {
      return 4; // Critical
    } else if (feedbackLower.includes('important') || feedbackLower.includes('major') || feedbackLower.includes('high')) {
      return 3; // High
    } else if (feedbackLower.includes('moderate') || feedbackLower.includes('medium') || feedbackLower.includes('should')) {
      return 2; // Medium
    } else {
      return 1; // Low
    }
  }

  private calculateTargetQuality(refinementType: BoomerangTask['refinementType']): number {
    const qualityTargets: Record<BoomerangTask['refinementType'], number> = {
      'error_correction': 0.95,      // High target for bug fixes
      'performance_tuning': 0.90,    // High target for performance
      'feature_addition': 0.85,      // Good target for new features
      'quality_improvement': 0.88,   // Good target for quality
      'optimization': 0.92,          // High target for optimization
    };
    
    return qualityTargets[refinementType] || 0.85;
  }

  private calculateExpectedReturnTime(refinementType: BoomerangTask['refinementType']): number {
    const timeEstimates: Record<BoomerangTask['refinementType'], number> = {
      'error_correction': 600000,    // 10 minutes for bug fixes
      'performance_tuning': 900000,  // 15 minutes for performance
      'feature_addition': 1200000,   // 20 minutes for features
      'quality_improvement': 480000, // 8 minutes for quality
      'optimization': 720000,        // 12 minutes for optimization
    };
    
    return timeEstimates[refinementType] || 600000;
  }

  private async sendBoomerangToAgent(boomerangTask: BoomerangTask): Promise<void> {
    boomerangTask.status = 'sent';
    const priority = this.normalizePriority(boomerangTask.priority);
    
    // Create a message to send to the target agent
    const message: AgentMessage = {
      id: `boomerang_msg_${boomerangTask.boomerangId}`,
      from: 'boomerang_manager',
      to: boomerangTask.targetAgent,
      type: 'task_delegation',
      priority,
      timestamp: new Date(),
      content: {
        boomerangTaskId: boomerangTask.id,
        originalTaskId: boomerangTask.originalTaskId,
        feedback: boomerangTask.feedback,
        refinementType: boomerangTask.refinementType,
        originalAgent: boomerangTask.sourceAgent,
        priority,
        expectedReturnTime: boomerangTask.expectedReturnTime,
      },
      context: {
        taskId: boomerangTask.originalTaskId,
        agentType: 'boomerang' as AgentType,
        priority,
        timestamp: Date.now(),
      },
      requiresResponse: true,
      timeout: boomerangTask.expectedReturnTime,
      retryCount: 0,
      maxRetries: 2,
    };

    await this.storage.logMessage(message);
  }

  async handleBoomerangReturn(boomerangTaskId: string, refinedResult: any, qualityScore: number): Promise<void> {
    const boomerangTask = this.activeBoomerangs.get(boomerangTaskId);
    if (!boomerangTask) {
      throw new Error(`Boomerang task ${boomerangTaskId} not found`);
    }

    boomerangTask.status = 'returned';
    boomerangTask.returnedAt = new Date();

    // Update the original task with refined results
    const originalTasks = await this.storage.getAllTasks();
    const originalTask = originalTasks.find(t => t.id === boomerangTask.originalTaskId);
    
    if (originalTask) {
      originalTask.outputData = refinedResult;
      originalTask.resultQuality = qualityScore;
      originalTask.status = 'completed';
      originalTask.completedAt = new Date();
      await this.storage.saveTask(originalTask);
    }

    // Validate the refinement
    const validationResults = await this.validateRefinement(boomerangTask, qualityScore);
    boomerangTask.boomerangMetadata.validationResults = validationResults;

    // Check if further refinement is needed
    const needsMoreRefinement = this.assessRefinementNeed(boomerangTask, qualityScore, validationResults);
    
    if (needsMoreRefinement && boomerangTask.refinementCount < boomerangTask.maxRefinements) {
      boomerangTask.refinementCount++;
      boomerangTask.status = 'pending';
      boomerangTask.boomerangMetadata.originalQuality = qualityScore;
      
      // Send another boomerang with updated feedback
      const additionalFeedback = this.generateAdditionalFeedback(validationResults, qualityScore);
      await this.sendBoomerang(originalTask!, boomerangTask.targetAgent, additionalFeedback, {
        refinementType: boomerangTask.refinementType,
        priority: Math.min(4, boomerangTask.priority + 1), // Increase priority
        maxRefinements: boomerangTask.maxRefinements,
      });
    } else {
      boomerangTask.status = 'completed';
      
      // Move to history
      this.activeBoomerangs.delete(boomerangTaskId);
      this.boomerangHistory.push(boomerangTask);
    }

    await this.storeBoomerangTask(boomerangTask);
    this.emit('boomerang:returned', boomerangTaskId, refinedResult);

    console.log(`Boomerang returned: ${boomerangTaskId} (quality: ${qualityScore}, status: ${boomerangTask.status})`);
  }

  private async validateRefinement(boomerangTask: BoomerangTask, qualityScore: number): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    // Validate based on refinement type
    switch (boomerangTask.refinementType) {
      case 'error_correction':
        results.push({
          type: 'functionality',
          passed: qualityScore >= 0.9,
          score: qualityScore,
          details: 'Error correction validation',
          timestamp: new Date(),
        });
        break;
        
      case 'performance_tuning':
        results.push({
          type: 'performance',
          passed: qualityScore >= 0.85,
          score: qualityScore,
          details: 'Performance optimization validation',
          timestamp: new Date(),
        });
        break;
        
      case 'quality_improvement':
        results.push({
          type: 'quality',
          passed: qualityScore >= 0.8,
          score: qualityScore,
          details: 'Quality improvement validation',
          timestamp: new Date(),
        });
        break;
    }

    return results;
  }

  private assessRefinementNeed(boomerangTask: BoomerangTask, qualityScore: number, validationResults: ValidationResult[]): boolean {
    // Check if quality target is met
    if (qualityScore < boomerangTask.boomerangMetadata.targetQuality) {
      // Check validation results
      const failedValidations = validationResults.filter(r => !r.passed);
      if (failedValidations.length > 0) {
        return true;
      }
    }

    // Check if it's the first refinement and quality is still low
    if (boomerangTask.refinementCount === 1 && qualityScore < 0.6) {
      return true;
    }

    return false;
  }

  private generateAdditionalFeedback(validationResults: ValidationResult[], currentQuality: number): string {
    const failedValidations = validationResults.filter(r => !r.passed);
    
    if (failedValidations.length > 0) {
      const issues = failedValidations.map(v => `${v.type}: ${v.details}`).join('; ');
      return `Additional refinement needed. Current quality: ${currentQuality.toFixed(2)}. Issues: ${issues}`;
    } else {
      return `Quality target not met. Current: ${currentQuality.toFixed(2)}, Target: ${this.calculateTargetQuality('quality_improvement')}`;
    }
  }

  async handleTaskDelegation(message: AgentMessage): Promise<void> {
    const { content } = message;
    
    if (content.boomerangTaskId) {
      // This is a boomerang task response
      const { boomerangTaskId, result, qualityScore } = content;
      await this.handleBoomerangReturn(boomerangTaskId, result, qualityScore);
    }
  }

  async getActiveBoomerangs(): Promise<BoomerangTask[]> {
    return Array.from(this.activeBoomerangs.values());
  }

  async getBoomerangHistory(limit: number = 50): Promise<BoomerangTask[]> {
    return this.boomerangHistory.slice(-limit);
  }

  async getBoomerangById(id: string): Promise<BoomerangTask | null> {
    return this.activeBoomerangs.get(id) || this.boomerangHistory.find(b => b.id === id) || null;
  }

  async cancelBoomerang(boomerangId: string, reason: string): Promise<void> {
    const boomerangTask = this.activeBoomerangs.get(boomerangId);
    if (!boomerangTask) {
      throw new Error(`Boomerang task ${boomerangId} not found`);
    }

    boomerangTask.status = 'failed';
    boomerangTask.boomerangMetadata.improvementMetrics['cancellation_reason'] = 1;
    
    // Move to history
    this.activeBoomerangs.delete(boomerangId);
    this.boomerangHistory.push(boomerangTask);

    await this.storeBoomerangTask(boomerangTask);
    this.emit('boomerang:cancelled', boomerangId, reason);
  }

  private setupBoomerangTimeoutChecking(): void {
    setInterval(() => {
      const now = Date.now();
      const timeoutBoomerangs: BoomerangTask[] = [];

      for (const [id, boomerangTask] of this.activeBoomerangs) {
        if (boomerangTask.status === 'sent') {
          const timeSinceSent = now - boomerangTask.sentAt.getTime();
          if (timeSinceSent > boomerangTask.expectedReturnTime) {
            timeoutBoomerangs.push(boomerangTask);
          }
        }
      }

      // Handle timeouts
      for (const boomerangTask of timeoutBoomerangs) {
        this.handleBoomerangTimeout(boomerangTask);
      }
    }, 30000); // Check every 30 seconds
  }

  private async handleBoomerangTimeout(boomerangTask: BoomerangTask): Promise<void> {
    console.warn(`Boomerang task ${boomerangTask.id} timed out`);
    
    boomerangTask.status = 'failed';
    boomerangTask.boomerangMetadata.improvementMetrics['timeout'] = 1;
    
    // Move to history
    this.activeBoomerangs.delete(boomerangTask.id);
    this.boomerangHistory.push(boomerangTask);
    
    await this.storeBoomerangTask(boomerangTask);
    this.emit('boomerang:timeout', boomerangTask.id);
  }

  private setupFeedbackProcessing(): void {
    setInterval(async () => {
      if (this.feedbackQueue.length > 0) {
        const feedback = this.feedbackQueue.shift()!;
        await this.processFeedback(feedback);
      }
    }, 5000); // Process feedback every 5 seconds
  }

  private async processFeedback(feedback: RefinementFeedback): Promise<void> {
    // Analyze feedback and determine if boomerang is needed
    const needsBoomerang = this.assessBoomerangNeed(feedback);
    
    if (needsBoomerang) {
      const tasks = await this.storage.getAllTasks();
      const task = tasks.find(t => t.id === feedback.taskId);
      
      if (task) {
        await this.sendBoomerang(task, feedback.agentId, feedback.feedback, {
          refinementType: this.inferRefinementType(feedback.feedback),
          priority: this.mapPriorityToNumber(feedback.priority),
        });
      }
    }
  }

  private assessBoomerangNeed(feedback: RefinementFeedback): boolean {
    // Assess if the feedback indicates need for refinement
    const lowQuality = Object.values(feedback.qualityMetrics).some(score => score < 0.7);
    const criticalPriority = feedback.priority === 'critical' || feedback.priority === 'high';
    
    return lowQuality || criticalPriority;
  }

  private mapPriorityToNumber(priority: RefinementFeedback['priority']): number {
    const priorityMap: Record<RefinementFeedback['priority'], number> = {
      'low': 1,
      'medium': 2,
      'high': 3,
      'critical': 4,
    };
    
    return priorityMap[priority];
  }

  private normalizePriority(value: number): MessagePriority {
    const normalized = Math.min(4, Math.max(0, Math.round(value)));
    return normalized as MessagePriority;
  }

  private async loadBoomerangHistory(): Promise<void> {
    try {
      const storedTasks = await this.storage.getAllBoomerangTasks();
      for (const stored of storedTasks) {
        const boomerangTask: BoomerangTask = {
          id: stored.id,
          originalTaskId: stored.originalTaskId,
          boomerangId: `boomerang_${stored.id}`,
          targetAgent: stored.targetAgent,
          sourceAgent: 'agent-swarm',
          refinementType: 'quality_improvement',
          feedback: stored.feedback || '',
          priority: stored.priority || 2,
          status: stored.status as BoomerangTask['status'],
          sentAt: stored.sentAt,
          returnedAt: stored.returnedAt,
          expectedReturnTime: 300000, // 5 minutes default
          refinementCount: 1,
          maxRefinements: 5,
          boomerangMetadata: {
            originalQuality: 0,
            targetQuality: 0.8,
            improvementMetrics: {},
            validationResults: [],
          },
        };

        if (stored.status === 'completed' || stored.status === 'failed') {
          this.boomerangHistory.push(boomerangTask);
        } else {
          this.activeBoomerangs.set(boomerangTask.id, boomerangTask);
        }
      }
      console.error(`Loaded ${storedTasks.length} boomerang tasks from storage`);
    } catch (error) {
      console.error('Failed to load boomerang history:', error);
    }
  }

  private async storeBoomerangTask(boomerangTask: BoomerangTask): Promise<void> {
    try {
      await this.storage.saveBoomerangTask({
        id: boomerangTask.id,
        originalTaskId: boomerangTask.originalTaskId,
        targetAgent: boomerangTask.targetAgent,
        feedback: boomerangTask.feedback,
        priority: boomerangTask.priority,
        status: boomerangTask.status,
        sentAt: boomerangTask.sentAt,
        returnedAt: boomerangTask.returnedAt,
        result: boomerangTask.boomerangMetadata,
      });
    } catch (error) {
      console.error(`Failed to store boomerang task ${boomerangTask.id}:`, error);
    }
  }

  async getRefinementStatistics(): Promise<any> {
    const totalBoomerangs = this.boomerangHistory.length + this.activeBoomerangs.size;
    const completedBoomerangs = this.boomerangHistory.filter(b => b.status === 'completed').length;
    const failedBoomerangs = this.boomerangHistory.filter(b => b.status === 'failed').length;
    const activeBoomerangs = this.activeBoomerangs.size;

    const averageRefinements = this.boomerangHistory.length > 0 
      ? this.boomerangHistory.reduce((sum, b) => sum + b.refinementCount, 0) / this.boomerangHistory.length
      : 0;

    const successRate = totalBoomerangs > 0 ? (completedBoomerangs / totalBoomerangs) * 100 : 0;

    return {
      total: totalBoomerangs,
      active: activeBoomerangs,
      completed: completedBoomerangs,
      failed: failedBoomerangs,
      successRate: successRate.toFixed(2),
      averageRefinements: averageRefinements.toFixed(2),
      byType: this.getBoomerangStatsByType(),
    };
  }

  private getBoomerangStatsByType(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const boomerang of this.boomerangHistory) {
      const type = boomerang.refinementType;
      if (!stats[type]) {
        stats[type] = { count: 0, completed: 0, failed: 0, averageQuality: 0 };
      }
      
      stats[type].count++;
      if (boomerang.status === 'completed') {
        stats[type].completed++;
      } else if (boomerang.status === 'failed') {
        stats[type].failed++;
      }
    }

    return stats;
  }

  async shutdown(): Promise<void> {
    // Cancel all active boomerang tasks
    for (const [id, boomerangTask] of this.activeBoomerangs) {
      boomerangTask.status = 'failed';
      this.boomerangHistory.push(boomerangTask);
    }
    
    this.activeBoomerangs.clear();
    
    // Save history
    for (const boomerangTask of this.boomerangHistory) {
      await this.storeBoomerangTask(boomerangTask);
    }
  }
}

interface RefinementPattern {
  name: string;
  description: string;
  commonFeedback: string[];
  validationMetrics: string[];
  typicalAgents: AgentType[];
}
