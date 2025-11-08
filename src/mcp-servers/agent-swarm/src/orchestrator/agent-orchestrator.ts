/**
 * Agent Orchestrator
 * 
 * Core coordination logic for agent task delegation and management
 * Handles agent selection, task assignment, and workflow coordination
 */

import { EventEmitter } from 'eventemitter3';
import { Agent, Task, AgentType, AgentMessage } from '../types/agents.js';
import { AgentStorage } from '../storage/agent-storage.js';

export interface AgentSelectionCriteria {
  type?: AgentType;
  status?: 'idle' | 'busy' | 'learning';
  capabilities?: string[];
  maxLoad?: number;
  performanceScore?: number;
  lastActive?: Date;
}

export interface TaskAssignment {
  task: Task;
  agent: Agent;
  assignmentReason: string;
  estimatedCompletionTime: number;
  priority: number;
}

export class AgentOrchestrator extends EventEmitter {
  private storage: AgentStorage;
  private activeAssignments: Map<string, TaskAssignment> = new Map();
  private agentPools: Map<AgentType, Agent[]> = new Map();

  constructor(storage: AgentStorage) {
    super();
    this.storage = storage;
  }

  async initialize(): Promise<void> {
    try {
      // Load existing agents and categorize them
      await this.refreshAgentPools();
      
      // Set up periodic refresh of agent pools
      setInterval(() => this.refreshAgentPools(), 30000); // 30 seconds
      
      console.log('Agent Orchestrator initialized');
    } catch (error) {
      console.error('Failed to initialize Agent Orchestrator:', error);
      throw error;
    }
  }

  async refreshAgentPools(): Promise<void> {
    const agents = await this.storage.getAllAgents();
    
    // Clear existing pools
    this.agentPools.clear();
    
    // Categorize agents by type
    for (const agent of agents) {
      if (!this.agentPools.has(agent.type)) {
        this.agentPools.set(agent.type, []);
      }
      this.agentPools.get(agent.type)!.push(agent);
    }
  }

  async findAvailableAgent(agentType: AgentType, criteria?: AgentSelectionCriteria): Promise<Agent | null> {
    await this.refreshAgentPools();
    
    const pool = this.agentPools.get(agentType) || [];
    const availableAgents = pool.filter(agent => this.isAgentAvailable(agent, criteria));
    
    if (availableAgents.length === 0) {
      return null;
    }

    // Select the best agent based on performance and load
    return this.selectBestAgent(availableAgents);
  }

  private isAgentAvailable(agent: Agent, criteria?: AgentSelectionCriteria): boolean {
    // Check basic availability
    if (agent.status !== 'idle' && agent.status !== 'learning') {
      return false;
    }

    // Check if agent is not overloaded
    if (agent.currentTasks.length >= agent.maxConcurrentTasks) {
      return false;
    }

    // Check capabilities if specified
    if (criteria?.capabilities) {
      const hasRequiredCapabilities = criteria.capabilities.every(cap => 
        agent.capabilities.includes(cap)
      );
      if (!hasRequiredCapabilities) {
        return false;
      }
    }

    // Check load if specified
    if (criteria?.maxLoad) {
      const currentLoad = agent.currentTasks.length / agent.maxConcurrentTasks;
      if (currentLoad > criteria.maxLoad) {
        return false;
      }
    }

    // Check performance score if specified
    if (criteria?.performanceScore) {
      const avgPerformance = this.calculateAgentPerformance(agent);
      if (avgPerformance < criteria.performanceScore) {
        return false;
      }
    }

    // Check last active if specified
    if (criteria?.lastActive) {
      if (agent.lastActive < criteria.lastActive) {
        return false;
      }
    }

    return true;
  }

  private selectBestAgent(agents: Agent[]): Agent {
    // Score agents based on multiple factors
    const scoredAgents = agents.map(agent => ({
      agent,
      score: this.calculateAgentScore(agent)
    }));

    // Sort by score (highest first)
    scoredAgents.sort((a, b) => b.score - a.score);

    return scoredAgents[0].agent;
  }

  private calculateAgentScore(agent: Agent): number {
    let score = 0;

    // Performance score (0-50 points)
    const performance = this.calculateAgentPerformance(agent);
    score += performance * 50;

    // Availability score (0-30 points)
    const availabilityScore = (agent.maxConcurrentTasks - agent.currentTasks.length) / agent.maxConcurrentTasks;
    score += availabilityScore * 30;

    // Recency score (0-20 points)
    const lastActiveHours = (Date.now() - agent.lastActive.getTime()) / (1000 * 60 * 60);
    const recencyScore = Math.max(0, 20 - lastActiveHours);
    score += recencyScore;

    return score;
  }

  private calculateAgentPerformance(agent: Agent): number {
    if (!agent.performanceMetrics || agent.performanceMetrics.length === 0) {
      return 0.5; // Default neutral performance
    }

    // Calculate weighted performance score
    const recentMetrics = agent.performanceMetrics
      .slice(-10) // Last 10 metrics
      .filter(m => m.timestamp);

    if (recentMetrics.length === 0) {
      return 0.5;
    }

    const totalScore = recentMetrics.reduce((sum, metric) => {
      return sum + (metric.successRate * 0.4 + metric.qualityScore * 0.6);
    }, 0);

    return totalScore / recentMetrics.length;
  }

  async delegateTask(agentId: string, task: Task): Promise<void> {
    try {
      // Update agent's current tasks
      const agent = await this.storage.getAgent(agentId);
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }

      // Add task to agent's current tasks
      agent.currentTasks.push(task.id);
      agent.status = 'busy';
      agent.lastActive = new Date();
      await this.storage.saveAgent(agent);

      // Create assignment record
      const assignment: TaskAssignment = {
        task,
        agent,
        assignmentReason: `Task delegated based on agent type: ${agent.type}`,
        estimatedCompletionTime: this.estimateTaskCompletionTime(task, agent),
        priority: task.priority
      };

      this.activeAssignments.set(task.id, assignment);
      this.emit('task:delegated', task);

      // Simulate task execution (in real implementation, this would be async)
      this.simulateTaskExecution(task.id, agent);

    } catch (error) {
      console.error('Failed to delegate task:', error);
      this.emit('task:delegation_failed', task, error);
      throw error;
    }
  }

  private async simulateTaskExecution(taskId: string, agent: Agent): Promise<void> {
    // This is a simplified simulation
    // In real implementation, this would involve actual agent processing
    
    try {
      const task = (await this.storage.getAllTasks()).find(t => t.id === taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      // Simulate processing time
      const processingTime = Math.random() * 5000 + 2000; // 2-7 seconds
      
      setTimeout(async () => {
        // Mark task as completed
        task.status = 'completed';
        task.completedAt = new Date();
        task.executionTime = processingTime;
        task.resultQuality = Math.random() * 0.3 + 0.7; // 0.7-1.0 quality score

        await this.storage.saveTask(task);

        // Update agent status
        agent.status = 'idle';
        agent.currentTasks = agent.currentTasks.filter(id => id !== taskId);
        agent.lastActive = new Date();
        await this.storage.saveAgent(agent);

        // Clean up assignment
        this.activeAssignments.delete(taskId);
        this.emit('task:completed', task);

        // Send completion message
        await this.sendTaskCompletionMessage(task, agent);

      }, processingTime);

    } catch (error) {
      console.error('Task execution failed:', error);
      
      // Handle failure
      const task = (await this.storage.getAllTasks()).find(t => t.id === taskId);
      if (task) {
        task.status = 'failed';
        task.errorMessage = error instanceof Error ? error.message : String(error);
        await this.storage.saveTask(task);
      }

      // Update agent status
      agent.status = 'error';
      agent.currentTasks = agent.currentTasks.filter(id => id !== taskId);
      await this.storage.saveAgent(agent);

      this.activeAssignments.delete(taskId);
      this.emit('task:failed', task, error);
    }
  }

  private async sendTaskCompletionMessage(task: Task, agent: Agent): Promise<void> {
    const message: AgentMessage = {
      id: `completion_${task.id}_${Date.now()}`,
      from: agent.id,
      to: 'orchestrator',
      type: 'task_completion',
      priority: 1,
      timestamp: new Date(),
      content: {
        taskId: task.id,
        status: task.status,
        qualityScore: task.resultQuality,
        executionTime: task.executionTime,
        outputData: task.outputData,
      },
      context: {
        taskId: task.id,
        agentType: agent.type,
        priority: task.priority,
        timestamp: Date.now(),
      },
      requiresResponse: false,
      retryCount: 0,
      maxRetries: 3,
    };

    await this.storage.logMessage(message);
  }

  private estimateTaskCompletionTime(task: Task, agent: Agent): number {
    // Base time estimate based on task type and agent performance
    const baseTimeByType: Record<AgentType, number> = {
      'research': 300000,    // 5 minutes
      'architect': 600000,   // 10 minutes
      'implementation': 900000, // 15 minutes
      'testing': 450000,     // 7.5 minutes
      'review': 300000,      // 5 minutes
      'documentation': 360000, // 6 minutes
      'debugger': 240000,    // 4 minutes
    };

    let baseTime = baseTimeByType[task.type] || 300000;

    // Adjust based on agent performance
    const performance = this.calculateAgentPerformance(agent);
    const performanceMultiplier = 2 - performance; // Better performance = faster completion

    // Adjust based on task priority
    const priorityMultiplier = 1 + (task.priority * 0.2);

    return baseTime * performanceMultiplier * priorityMultiplier;
  }

  async handleTaskCompletion(message: AgentMessage): Promise<void> {
    try {
      const { taskId, status, qualityScore } = message.content;
      
      // Update task status
      const tasks = await this.storage.getAllTasks();
      const task = tasks.find(t => t.id === taskId);
      
      if (task) {
        task.status = status;
        task.completedAt = new Date();
        if (qualityScore) {
          task.resultQuality = qualityScore;
        }
        await this.storage.saveTask(task);
      }

      this.emit('task:completion_handled', task);
    } catch (error) {
      console.error('Failed to handle task completion:', error);
    }
  }

  async reassignTask(taskId: string, reason: string): Promise<void> {
    const assignment = this.activeAssignments.get(taskId);
    if (!assignment) {
      throw new Error(`Active assignment for task ${taskId} not found`);
    }

    const task = assignment.task;
    const currentAgent = assignment.agent;

    // Find a new agent
    const newAgent = await this.findAvailableAgent(task.type);
    if (!newAgent) {
      throw new Error(`No alternative agent available for task ${taskId}`);
    }

    // Update current agent
    currentAgent.currentTasks = currentAgent.currentTasks.filter(id => id !== taskId);
    currentAgent.status = 'idle';
    await this.storage.saveAgent(currentAgent);

    // Reassign to new agent
    await this.delegateTask(newAgent.id, task);

    this.emit('task:reassigned', task, currentAgent, newAgent, reason);
  }

  async getAgentLoad(agentId: string): Promise<number> {
    const agent = await this.storage.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    return agent.currentTasks.length / agent.maxConcurrentTasks;
  }

  async getActiveAssignments(): Promise<TaskAssignment[]> {
    return Array.from(this.activeAssignments.values());
  }

  async getAgentUtilization(agentType?: AgentType): Promise<Record<string, number>> {
    await this.refreshAgentPools();
    
    const utilization: Record<string, number> = {};
    
    const agents = agentType 
      ? this.agentPools.get(agentType) || []
      : Array.from(this.agentPools.values()).flat();

    for (const agent of agents) {
      const load = agent.currentTasks.length / agent.maxConcurrentTasks;
      utilization[agent.id] = load;
    }

    return utilization;
  }

  async balanceAgentLoad(): Promise<void> {
    // Identify overloaded agents
    const overloadedAgents: Agent[] = [];
    const underutilizedAgents: Agent[] = [];

    for (const [agentType, agents] of this.agentPools) {
      for (const agent of agents) {
        const load = agent.currentTasks.length / agent.maxConcurrentTasks;
        
        if (load > 0.8) {
          overloadedAgents.push(agent);
        } else if (load < 0.3) {
          underutilizedAgents.push(agent);
        }
      }
    }

    // Rebalance tasks from overloaded to underutilized agents
    for (const overloaded of overloadedAgents) {
      for (const underutilized of underutilizedAgents) {
        if (overloaded.type === underutilized.type && overloaded.currentTasks.length > 0) {
          // Find a task to move
          const taskToMove = overloaded.currentTasks[0];
          const task = (await this.storage.getAllTasks()).find(t => t.id === taskToMove);
          
          if (task) {
            await this.reassignTask(taskToMove, 'Load balancing');
          }
        }
      }
    }
  }

  async shutdown(): Promise<void> {
    // Cancel all active assignments
    for (const [taskId, assignment] of this.activeAssignments) {
      const task = assignment.task;
      task.status = 'cancelled';
      await this.storage.saveTask(task);
    }

    this.activeAssignments.clear();
    this.agentPools.clear();
  }
}