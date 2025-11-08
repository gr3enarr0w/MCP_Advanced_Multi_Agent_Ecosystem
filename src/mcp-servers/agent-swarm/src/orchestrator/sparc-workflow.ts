/**
 * SPARC Workflow Manager
 * 
 * Implements the SPARC methodology (Specification → Pseudocode → Architecture → Refinement → Completion)
 * for comprehensive project development workflows across multiple agents
 * 
 * Key Features:
 * - Phase-based task orchestration
 * - Inter-agent coordination for each SPARC phase
 * - Quality gates and validation
 * - Boomerang feedback loops
 * - Progress tracking and reporting
 */

import { EventEmitter } from 'eventemitter3';
import { Task, AgentType, Agent, AgentMessage } from '../types/agents.js';
import { AgentStorage } from '../storage/agent-storage.js';

export type SPARCPhase = 'specification' | 'pseudocode' | 'architecture' | 'refinement' | 'completion';

export interface SPARCTask {
  id: string;
  workflowId: string;
  phase: SPARCPhase;
  title: string;
  description: string;
  agentType: AgentType;
  status: 'pending' | 'assigned' | 'running' | 'completed' | 'failed' | 'blocked';
  priority: number;
  dependencies: string[];
  inputData: any;
  outputData: any;
  qualityScore?: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  timeoutMs: number;
  retryCount: number;
  maxRetries: number;
}

export interface SPARCWorkflow {
  id: string;
  projectDescription: string;
  requirements: string[];
  constraints: string[];
  currentPhase: SPARCPhase;
  phases: SPARCPhaseTask[];
  status: 'active' | 'completed' | 'failed' | 'paused';
  createdAt: Date;
  updatedAt: Date;
  metadata: {
    totalTasks: number;
    completedTasks: number;
    currentPhaseProgress: number;
    estimatedTimeRemaining: number;
    qualityScore: number;
  };
}

export interface SPARCPhaseTask {
  phase: SPARCPhase;
  title: string;
  agentType: AgentType;
  tasks: SPARCTask[];
  completed: boolean;
  qualityGate: QualityGate;
}

export interface QualityGate {
  minQualityScore: number;
  requiredArtifacts: string[];
  validationRules: ValidationRule[];
  autoPass: boolean;
}

export interface ValidationRule {
  type: 'output_format' | 'content_completeness' | 'code_quality' | 'documentation' | 'test_coverage';
  criteria: any;
  required: boolean;
}

export class SPARCWorkflowManager extends EventEmitter {
  private storage: AgentStorage;
  private workflows: Map<string, SPARCWorkflow> = new Map();
  private activeTasks: Map<string, SPARCTask> = new Map();
  private phaseDefinitions: Map<SPARCPhase, PhaseDefinition> = new Map();

  constructor(storage: AgentStorage) {
    super();
    this.storage = storage;
    this.initializePhaseDefinitions();
  }

  private initializePhaseDefinitions(): void {
    // Specification Phase
    this.phaseDefinitions.set('specification', {
      name: 'Specification',
      description: 'Define requirements, constraints, and success criteria',
      primaryAgent: 'research',
      supportingAgents: ['architect', 'review'],
      qualityMetrics: ['requirements_completeness', 'clarity_score', 'feasibility_assessment'],
      defaultTimeout: 1800000, // 30 minutes
      deliverables: ['requirements_document', 'constraint_analysis', 'success_criteria'],
    });

    // Pseudocode Phase
    this.phaseDefinitions.set('pseudocode', {
      name: 'Pseudocode',
      description: 'Create detailed algorithmic pseudocode and flow designs',
      primaryAgent: 'implementation',
      supportingAgents: ['architect', 'review'],
      qualityMetrics: ['algorithm_correctness', 'complexity_analysis', 'pseudocode_clarity'],
      defaultTimeout: 3600000, // 1 hour
      deliverables: ['algorithm_pseudocode', 'flow_diagrams', 'complexity_analysis'],
    });

    // Architecture Phase
    this.phaseDefinitions.set('architecture', {
      name: 'Architecture',
      description: 'Design system architecture and technical specifications',
      primaryAgent: 'architect',
      supportingAgents: ['implementation', 'testing', 'review'],
      qualityMetrics: ['architecture_soundness', 'scalability_score', 'maintainability_index'],
      defaultTimeout: 2700000, // 45 minutes
      deliverables: ['system_architecture', 'technical_specs', 'integration_plan'],
    });

    // Refinement Phase
    this.phaseDefinitions.set('refinement', {
      name: 'Refinement',
      description: 'Iterate and improve based on feedback and testing',
      primaryAgent: 'review',
      supportingAgents: ['implementation', 'testing', 'debugger'],
      qualityMetrics: ['improvement_score', 'bug_reduction', 'performance_gain'],
      defaultTimeout: 2400000, // 40 minutes
      deliverables: ['refined_solution', 'improvement_report', 'optimization_notes'],
    });

    // Completion Phase
    this.phaseDefinitions.set('completion', {
      name: 'Completion',
      description: 'Finalize, document, and deliver the complete solution',
      primaryAgent: 'documentation',
      supportingAgents: ['testing', 'review', 'implementation'],
      qualityMetrics: ['documentation_completeness', 'final_quality_score', 'delivery_readiness'],
      defaultTimeout: 1800000, // 30 minutes
      deliverables: ['final_solution', 'documentation', 'deployment_guide'],
    });
  }

  async initialize(): Promise<void> {
    try {
      // Load any existing workflows from storage
      await this.loadWorkflows();
      
      // Set up periodic cleanup of expired tasks
      this.setupTaskCleanup();
      
      console.log('SPARC Workflow Manager initialized');
    } catch (error) {
      console.error('Failed to initialize SPARC Workflow Manager:', error);
      throw error;
    }
  }

  async createWorkflow(projectDescription: string, requirements?: string[], constraints?: string[]): Promise<SPARCWorkflow> {
    const workflowId = `sparc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const workflow: SPARCWorkflow = {
      id: workflowId,
      projectDescription,
      requirements: requirements || [],
      constraints: constraints || [],
      currentPhase: 'specification',
      phases: this.createPhaseTasks(workflowId, projectDescription, requirements || [], constraints || []),
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        totalTasks: 0,
        completedTasks: 0,
        currentPhaseProgress: 0,
        estimatedTimeRemaining: 0,
        qualityScore: 0,
      },
    };

    // Calculate total tasks
    workflow.metadata.totalTasks = workflow.phases.reduce((sum, phase) => sum + phase.tasks.length, 0);
    workflow.metadata.estimatedTimeRemaining = workflow.phases.reduce((sum, phase) => {
      return sum + phase.tasks.reduce((phaseSum, task) => phaseSum + task.timeoutMs, 0);
    }, 0);

    this.workflows.set(workflowId, workflow);
    await this.saveWorkflow(workflow);

    // Start the specification phase
    await this.startPhase(workflowId, 'specification');

    return workflow;
  }

  private createPhaseTasks(workflowId: string, projectDescription: string, requirements: string[], constraints: string[]): SPARCPhaseTask[] {
    const phases: SPARCPhaseTask[] = [];

    for (const [phaseKey, phaseDef] of this.phaseDefinitions) {
      const tasks = this.generatePhaseTasks(workflowId, phaseKey, phaseDef, projectDescription, requirements, constraints);
      
      phases.push({
        phase: phaseKey,
        title: phaseDef.name,
        agentType: phaseDef.primaryAgent,
        tasks,
        completed: false,
        qualityGate: {
          minQualityScore: 0.7,
          requiredArtifacts: phaseDef.deliverables,
          validationRules: this.createValidationRules(phaseKey),
          autoPass: false,
        },
      });
    }

    return phases;
  }

  private generatePhaseTasks(
    workflowId: string,
    phase: SPARCPhase,
    phaseDef: PhaseDefinition,
    projectDescription: string,
    requirements: string[],
    constraints: string[]
  ): SPARCTask[] {
    const tasks: SPARCTask[] = [];
    const baseTaskId = `${workflowId}_${phase}`;

    switch (phase) {
      case 'specification':
        tasks.push(
          {
            id: `${baseTaskId}_analyze_requirements`,
            workflowId,
            phase,
            title: 'Analyze and Document Requirements',
            description: 'Comprehensive analysis of project requirements and constraints',
            agentType: 'research',
            status: 'pending',
            priority: 1,
            dependencies: [],
            inputData: { projectDescription, requirements, constraints },
            outputData: {},
            timeoutMs: phaseDef.defaultTimeout,
            retryCount: 0,
            maxRetries: 3,
            createdAt: new Date(),
          },
          {
            id: `${baseTaskId}_define_success_criteria`,
            workflowId,
            phase,
            title: 'Define Success Criteria',
            description: 'Establish measurable success criteria and acceptance tests',
            agentType: 'architect',
            status: 'pending',
            priority: 2,
            dependencies: [`${baseTaskId}_analyze_requirements`],
            inputData: { projectDescription, requirements },
            outputData: {},
            timeoutMs: phaseDef.defaultTimeout * 0.6,
            retryCount: 0,
            maxRetries: 2,
            createdAt: new Date(),
          }
        );
        break;

      case 'pseudocode':
        tasks.push(
          {
            id: `${baseTaskId}_create_algorithms`,
            workflowId,
            phase,
            title: 'Create Algorithm Pseudocode',
            description: 'Develop detailed algorithmic pseudocode for core functionality',
            agentType: 'implementation',
            status: 'pending',
            priority: 1,
            dependencies: [],
            inputData: { workflowId, phase: 'specification' },
            outputData: {},
            timeoutMs: phaseDef.defaultTimeout,
            retryCount: 0,
            maxRetries: 3,
            createdAt: new Date(),
          },
          {
            id: `${baseTaskId}_analyze_complexity`,
            workflowId,
            phase,
            title: 'Analyze Algorithm Complexity',
            description: 'Time and space complexity analysis of proposed algorithms',
            agentType: 'architect',
            status: 'pending',
            priority: 2,
            dependencies: [`${baseTaskId}_create_algorithms`],
            inputData: { workflowId },
            outputData: {},
            timeoutMs: phaseDef.defaultTimeout * 0.7,
            retryCount: 0,
            maxRetries: 2,
            createdAt: new Date(),
          }
        );
        break;

      case 'architecture':
        tasks.push(
          {
            id: `${baseTaskId}_design_system`,
            workflowId,
            phase,
            title: 'Design System Architecture',
            description: 'Create comprehensive system architecture design',
            agentType: 'architect',
            status: 'pending',
            priority: 1,
            dependencies: [],
            inputData: { workflowId, phase: 'pseudocode' },
            outputData: {},
            timeoutMs: phaseDef.defaultTimeout,
            retryCount: 0,
            maxRetries: 3,
            createdAt: new Date(),
          },
          {
            id: `${baseTaskId}_define_interfaces`,
            workflowId,
            phase,
            title: 'Define Component Interfaces',
            description: 'Define APIs, data structures, and component interfaces',
            agentType: 'implementation',
            status: 'pending',
            priority: 2,
            dependencies: [`${baseTaskId}_design_system`],
            inputData: { workflowId },
            outputData: {},
            timeoutMs: phaseDef.defaultTimeout * 0.8,
            retryCount: 0,
            maxRetries: 2,
            createdAt: new Date(),
          }
        );
        break;

      case 'refinement':
        tasks.push(
          {
            id: `${baseTaskId}_review_solution`,
            workflowId,
            phase,
            title: 'Comprehensive Solution Review',
            description: 'Review and analyze the proposed solution for improvements',
            agentType: 'review',
            status: 'pending',
            priority: 1,
            dependencies: [],
            inputData: { workflowId, phase: 'architecture' },
            outputData: {},
            timeoutMs: phaseDef.defaultTimeout,
            retryCount: 0,
            maxRetries: 3,
            createdAt: new Date(),
          },
          {
            id: `${baseTaskId}_identify_improvements`,
            workflowId,
            phase,
            title: 'Identify Optimization Opportunities',
            description: 'Identify areas for optimization and improvement',
            agentType: 'debugger',
            status: 'pending',
            priority: 2,
            dependencies: [`${baseTaskId}_review_solution`],
            inputData: { workflowId },
            outputData: {},
            timeoutMs: phaseDef.defaultTimeout * 0.7,
            retryCount: 0,
            maxRetries: 2,
            createdAt: new Date(),
          }
        );
        break;

      case 'completion':
        tasks.push(
          {
            id: `${baseTaskId}_finalize_documentation`,
            workflowId,
            phase,
            title: 'Finalize Documentation',
            description: 'Create comprehensive documentation for the solution',
            agentType: 'documentation',
            status: 'pending',
            priority: 1,
            dependencies: [],
            inputData: { workflowId, phase: 'refinement' },
            outputData: {},
            timeoutMs: phaseDef.defaultTimeout,
            retryCount: 0,
            maxRetries: 3,
            createdAt: new Date(),
          },
          {
            id: `${baseTaskId}_create_delivery_package`,
            workflowId,
            phase,
            title: 'Create Delivery Package',
            description: 'Package the complete solution for delivery',
            agentType: 'implementation',
            status: 'pending',
            priority: 2,
            dependencies: [`${baseTaskId}_finalize_documentation`],
            inputData: { workflowId },
            outputData: {},
            timeoutMs: phaseDef.defaultTimeout * 0.6,
            retryCount: 0,
            maxRetries: 2,
            createdAt: new Date(),
          }
        );
        break;
    }

    return tasks;
  }

  private createValidationRules(phase: SPARCPhase): ValidationRule[] {
    const rules: ValidationRule[] = [];

    switch (phase) {
      case 'specification':
        rules.push(
          {
            type: 'content_completeness',
            criteria: { required_sections: ['requirements', 'constraints', 'success_criteria'] },
            required: true,
          },
          {
            type: 'output_format',
            criteria: { format: 'structured_document' },
            required: true,
          }
        );
        break;

      case 'pseudocode':
        rules.push(
          {
            type: 'code_quality',
            criteria: { complexity_limit: 'O(n^3)', clarity_score: 0.8 },
            required: true,
          },
          {
            type: 'content_completeness',
            criteria: { includes_flow_control: true, includes_data_structures: true },
            required: true,
          }
        );
        break;

      case 'architecture':
        rules.push(
          {
            type: 'output_format',
            criteria: { includes_diagrams: true, includes_specifications: true },
            required: true,
          },
          {
            type: 'content_completeness',
            criteria: { includes_scalability: true, includes_security: true },
            required: true,
          }
        );
        break;

      case 'refinement':
        rules.push(
          {
            type: 'content_completeness',
            criteria: { improvement_areas: 3, performance_metrics: true },
            required: true,
          }
        );
        break;

      case 'completion':
        rules.push(
          {
            type: 'documentation',
            criteria: { user_guide: true, technical_docs: true, api_docs: true },
            required: true,
          },
          {
            type: 'test_coverage',
            criteria: { min_coverage: 0.8, test_types: ['unit', 'integration', 'e2e'] },
            required: true,
          }
        );
        break;
    }

    return rules;
  }

  async startPhase(workflowId: string, phase: SPARCPhase): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const phaseTask = workflow.phases.find(p => p.phase === phase);
    if (!phaseTask) {
      throw new Error(`Phase ${phase} not found in workflow ${workflowId}`);
    }

    this.emit('phase:started', workflowId, phase);

    // Start the first pending task in this phase
    const firstTask = phaseTask.tasks.find(t => t.status === 'pending');
    if (firstTask) {
      await this.assignTask(firstTask);
    }
  }

  async assignTask(task: SPARCTask): Promise<void> {
    // Check dependencies
    const unmetDependencies = task.dependencies.filter(depId => {
      const depTask = this.findTaskById(depId);
      return !depTask || depTask.status !== 'completed';
    });

    if (unmetDependencies.length > 0) {
      task.status = 'blocked';
      return;
    }

    task.status = 'assigned';
    task.startedAt = new Date();
    this.activeTasks.set(task.id, task);

    // Find an available agent of the required type
    const availableAgent = await this.findAvailableAgent(task.agentType);
    if (!availableAgent) {
      throw new Error(`No available agent of type ${task.agentType} for task ${task.id}`);
    }

    // Create the actual task for the agent
    const agentTask: Task = {
      id: task.id,
      agentId: availableAgent.id,
      type: task.agentType,
      description: task.description,
      status: 'running',
      priority: task.priority,
      dependencies: task.dependencies,
      startedAt: new Date(),
    };

    // Store the task
    await this.storage.saveTask(agentTask);

    this.emit('task:assigned', task);
  }

  async completeTask(taskId: string, outputData: any, qualityScore: number): Promise<void> {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      throw new Error(`Active task ${taskId} not found`);
    }

    task.outputData = outputData;
    task.qualityScore = qualityScore;
    task.status = 'completed';
    task.completedAt = new Date();

    // Update workflow progress
    const workflow = this.workflows.get(task.workflowId);
    if (workflow) {
      await this.updateWorkflowProgress(workflow, task);
    }

    this.activeTasks.delete(taskId);
    this.emit('task:completed', task);

    // Check if this completes the phase
    await this.checkPhaseCompletion(task.workflowId, task.phase);

    // Start next task in phase or next phase
    await this.continueWorkflow(task.workflowId);
  }

  private async updateWorkflowProgress(workflow: SPARCWorkflow, completedTask: SPARCTask): Promise<void> {
    workflow.metadata.completedTasks += 1;
    workflow.updatedAt = new Date();

    // Update current phase progress
    const currentPhaseTask = workflow.phases.find(p => p.phase === workflow.currentPhase);
    if (currentPhaseTask) {
      const completedInPhase = currentPhaseTask.tasks.filter(t => t.status === 'completed').length;
      currentPhaseTask.completed = completedInPhase === currentPhaseTask.tasks.length;
      workflow.metadata.currentPhaseProgress = (completedInPhase / currentPhaseTask.tasks.length) * 100;
    }

    // Update quality score
    const allCompletedTasks = workflow.phases.flatMap(p => p.tasks).filter(t => t.status === 'completed');
    if (allCompletedTasks.length > 0) {
      const totalQuality = allCompletedTasks.reduce((sum, t) => sum + (t.qualityScore || 0), 0);
      workflow.metadata.qualityScore = totalQuality / allCompletedTasks.length;
    }

    await this.saveWorkflow(workflow);
  }

  private async checkPhaseCompletion(workflowId: string, phase: SPARCPhase): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;

    const phaseTask = workflow.phases.find(p => p.phase === phase);
    if (!phaseTask) return;

    const allCompleted = phaseTask.tasks.every(t => t.status === 'completed');
    if (allCompleted) {
      // Check quality gate
      const qualityScore = this.calculatePhaseQualityScore(phaseTask);
      if (qualityScore >= phaseTask.qualityGate.minQualityScore || phaseTask.qualityGate.autoPass) {
        phaseTask.completed = true;
        workflow.updatedAt = new Date();
        await this.saveWorkflow(workflow);
        
        this.emit('phase:completed', workflowId, phase);
      } else {
        // Quality gate failed - trigger boomerang for refinement
        await this.triggerPhaseRefinement(workflowId, phase, qualityScore);
      }
    }
  }

  private calculatePhaseQualityScore(phaseTask: SPARCPhaseTask): number {
    const completedTasks = phaseTask.tasks.filter(t => t.status === 'completed');
    if (completedTasks.length === 0) return 0;

    const totalScore = completedTasks.reduce((sum, t) => sum + (t.qualityScore || 0), 0);
    return totalScore / completedTasks.length;
  }

  private async triggerPhaseRefinement(workflowId: string, phase: SPARCPhase, currentScore: number): Promise<void> {
    // Create boomerang tasks for refinement
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;

    const phaseTask = workflow.phases.find(p => p.phase === phase);
    if (!phaseTask) return;

    // Mark phase for refinement and start boomerang process
    for (const task of phaseTask.tasks) {
      if (task.status === 'completed' && (task.qualityScore || 0) < 0.7) {
        // Create refinement boomerang task
        const refinementTask: SPARCTask = {
          ...task,
          id: `${task.id}_refinement`,
          phase: 'refinement' as SPARCPhase, // Temporary refinement phase
          title: `Refine: ${task.title}`,
          description: `Refine task based on quality score ${task.qualityScore}`,
          status: 'pending',
          priority: 3, // High priority for refinement
          inputData: {
            ...task.inputData,
            feedback: `Quality score ${task.qualityScore} below threshold. Please refine.`,
            originalTaskId: task.id,
          },
          outputData: {},
          timeoutMs: task.timeoutMs * 0.7, // Shorter timeout for refinement
          retryCount: task.retryCount + 1,
        };

        phaseTask.tasks.push(refinementTask);
      }
    }

    await this.saveWorkflow(workflow);
    this.emit('phase:refinement_needed', workflowId, phase, currentScore);
  }

  private async continueWorkflow(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || workflow.status !== 'active') return;

    // Find next task to execute
    for (const phaseTask of workflow.phases) {
      if (!phaseTask.completed) {
        // Look for pending tasks in this phase
        const nextTask = phaseTask.tasks.find(t => t.status === 'pending');
        if (nextTask) {
          // Check if dependencies are met
          const unmetDependencies = nextTask.dependencies.filter(depId => {
            const depTask = this.findTaskById(depId);
            return !depTask || depTask.status !== 'completed';
          });

          if (unmetDependencies.length === 0) {
            await this.assignTask(nextTask);
            return; // Assigned a task, exit loop
          }
        } else if (phaseTask.tasks.every(t => t.status === 'completed' || t.status === 'blocked')) {
          // Phase completed, move to next phase
          const nextPhaseIndex = workflow.phases.findIndex(p => p.phase === phaseTask.phase) + 1;
          if (nextPhaseIndex < workflow.phases.length) {
            const nextPhase = workflow.phases[nextPhaseIndex].phase;
            workflow.currentPhase = nextPhase;
            await this.saveWorkflow(workflow);
            await this.startPhase(workflowId, nextPhase);
            return;
          } else {
            // All phases completed
            workflow.status = 'completed';
            await this.saveWorkflow(workflow);
            this.emit('workflow:completed', workflowId);
            return;
          }
        }
      }
    }
  }

  async getWorkflow(workflowId: string): Promise<SPARCWorkflow | null> {
    return this.workflows.get(workflowId) || null;
  }

  async getAllWorkflows(): Promise<SPARCWorkflow[]> {
    return Array.from(this.workflows.values());
  }

  async pauseWorkflow(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (workflow) {
      workflow.status = 'paused';
      await this.saveWorkflow(workflow);
    }
  }

  async resumeWorkflow(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (workflow && workflow.status === 'paused') {
      workflow.status = 'active';
      await this.saveWorkflow(workflow);
      await this.continueWorkflow(workflowId);
    }
  }

  private findTaskById(taskId: string): SPARCTask | null {
    for (const workflow of this.workflows.values()) {
      for (const phaseTask of workflow.phases) {
        const task = phaseTask.tasks.find(t => t.id === taskId);
        if (task) return task;
      }
    }
    return this.activeTasks.get(taskId) || null;
  }

  private async findAvailableAgent(agentType: AgentType): Promise<Agent | null> {
    // Get agents from storage and find available one
    const agents = await this.storage.getAllAgents();
    return agents.find(agent => agent.type === agentType && agent.status === 'idle') || null;
  }

  private async loadWorkflows(): Promise<void> {
    // Load workflows from storage (if implementing persistence)
    // For now, workflows are kept in memory
  }

  private async saveWorkflow(workflow: SPARCWorkflow): Promise<void> {
    // Save workflow to storage (if implementing persistence)
    // For now, workflows are kept in memory
  }

  private setupTaskCleanup(): void {
    // Clean up expired tasks periodically
    setInterval(() => {
      const now = Date.now();
      for (const [taskId, task] of this.activeTasks) {
        if (task.startedAt && (now - task.startedAt.getTime()) > task.timeoutMs) {
          // Task timed out
          task.status = 'failed';
          this.activeTasks.delete(taskId);
          this.emit('task:failed', task, 'timeout');
        }
      }
    }, 60000); // Check every minute
  }

  async shutdown(): Promise<void> {
    // Cancel all active tasks
    for (const [taskId, task] of this.activeTasks) {
      task.status = 'cancelled';
    }
    this.activeTasks.clear();
    
    // Save all workflows
    for (const workflow of this.workflows.values()) {
      await this.saveWorkflow(workflow);
    }
  }
}

interface PhaseDefinition {
  name: string;
  description: string;
  primaryAgent: AgentType;
  supportingAgents: AgentType[];
  qualityMetrics: string[];
  defaultTimeout: number;
  deliverables: string[];
}