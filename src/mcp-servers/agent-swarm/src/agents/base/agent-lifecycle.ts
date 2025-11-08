/**
 * Agent Lifecycle Manager
 * 
 * Manages the complete lifecycle of agents in the swarm:
 * - Agent creation and initialization
 * - Health monitoring and status tracking
 * - Learning and capability evolution
 * - Performance optimization
 * - Resource management and cleanup
 * - Agent retirement and replacement
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import { 
  Agent, 
  AgentType, 
  AgentStatus, 
  ResourceLimits, 
  PerformanceMetrics, 
  LearningData,
  SuccessPattern,
  FailurePattern,
  LearnedSkill,
  DiscoveredPattern,
  EffectiveStrategy,
  BehaviorAdaptation,
  PreferenceChange,
  CapabilityEnhancement
} from '../../types/agents.js';
import { AgentStorage } from '../../storage/agent-storage.js';

export interface AgentConfiguration {
  type: AgentType;
  name?: string;
  version?: string;
  capabilities?: string[];
  maxConcurrentTasks?: number;
  resourceLimits?: Partial<ResourceLimits>;
  learningEnabled?: boolean;
  autoOptimization?: boolean;
  healthCheckInterval?: number;
}

export interface HealthCheckResult {
  agentId: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'critical';
  responseTime: number;
  memoryUsage: number;
  cpuUsage: number;
  activeTasks: number;
  errorRate: number;
  lastActivity: Date;
  issues: HealthIssue[];
  recommendations: string[];
}

export interface HealthIssue {
  type: 'performance' | 'resource' | 'error' | 'stability' | 'learning';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: Date;
  resolved: boolean;
}

export interface LearningEvent {
  agentId: string;
  type: 'task_completion' | 'error_occurrence' | 'performance_improvement' | 'pattern_discovery' | 'skill_acquisition';
  data: any;
  timestamp: Date;
  impact: 'positive' | 'negative' | 'neutral';
}

export class AgentLifecycleManager extends EventEmitter {
  private storage: AgentStorage;
  private activeAgents: Map<string, Agent> = new Map();
  private healthChecks: Map<string, NodeJS.Timeout> = new Map();
  private learningQueues: Map<string, LearningEvent[]> = new Map();
  private performanceHistory: Map<string, PerformanceMetrics[]> = new Map();
  private agentTemplates: Map<AgentType, Partial<Agent>> = new Map();

  constructor(storage: AgentStorage) {
    super();
    this.storage = storage;
    this.initializeAgentTemplates();
  }

  private initializeAgentTemplates(): void {
    // Research Agent Template
    this.agentTemplates.set('research', {
      name: 'Research Agent',
      version: '1.0.0',
      capabilities: [
        'information_gathering',
        'data_analysis',
        'literature_review',
        'competitive_intelligence',
        'trend_analysis',
        'synthesis',
        'source_verification',
        'fact_checking'
      ],
      maxConcurrentTasks: 3,
      resourceLimits: {
        maxMemoryMB: 512,
        maxCPUTimeMs: 1800000, // 30 minutes
        maxDiskSpaceMB: 100,
        maxNetworkCalls: 50,
        maxFileHandles: 10,
        executionTimeoutMs: 1800000,
        maxConcurrentTasks: 3,
      },
    });

    // Architect Agent Template
    this.agentTemplates.set('architect', {
      name: 'Architect Agent',
      version: '1.0.0',
      capabilities: [
        'system_design',
        'architecture_planning',
        'technical_specification',
        'solution_optimization',
        'integration_planning',
        'scalability_modeling',
        'performance_architecture',
        'security_architecture'
      ],
      maxConcurrentTasks: 2,
      resourceLimits: {
        maxMemoryMB: 1024,
        maxCPUTimeMs: 3600000, // 1 hour
        maxDiskSpaceMB: 200,
        maxNetworkCalls: 20,
        maxFileHandles: 15,
        executionTimeoutMs: 3600000,
        maxConcurrentTasks: 2,
      },
    });

    // Implementation Agent Template
    this.agentTemplates.set('implementation', {
      name: 'Implementation Agent',
      version: '1.0.0',
      capabilities: [
        'code_development',
        'algorithm_design',
        'api_development',
        'database_design',
        'system_integration',
        'code_optimization',
        'testing_implementation',
        'deployment_preparation'
      ],
      maxConcurrentTasks: 4,
      resourceLimits: {
        maxMemoryMB: 2048,
        maxCPUTimeMs: 5400000, // 1.5 hours
        maxDiskSpaceMB: 500,
        maxNetworkCalls: 30,
        maxFileHandles: 20,
        executionTimeoutMs: 5400000,
        maxConcurrentTasks: 4,
      },
    });

    // Testing Agent Template
    this.agentTemplates.set('testing', {
      name: 'Testing Agent',
      version: '1.0.0',
      capabilities: [
        'test_strategy',
        'test_case_creation',
        'automated_testing',
        'quality_assurance',
        'performance_testing',
        'security_testing',
        'regression_testing',
        'test_coverage_analysis'
      ],
      maxConcurrentTasks: 3,
      resourceLimits: {
        maxMemoryMB: 1536,
        maxCPUTimeMs: 2700000, // 45 minutes
        maxDiskSpaceMB: 300,
        maxNetworkCalls: 25,
        maxFileHandles: 15,
        executionTimeoutMs: 2700000,
        maxConcurrentTasks: 3,
      },
    });

    // Review Agent Template
    this.agentTemplates.set('review', {
      name: 'Review Agent',
      version: '1.0.0',
      capabilities: [
        'code_review',
        'quality_assessment',
        'best_practice_enforcement',
        'compliance_checking',
        'risk_assessment',
        'security_review',
        'performance_review',
        'architecture_review'
      ],
      maxConcurrentTasks: 2,
      resourceLimits: {
        maxMemoryMB: 768,
        maxCPUTimeMs: 1800000, // 30 minutes
        maxDiskSpaceMB: 150,
        maxNetworkCalls: 15,
        maxFileHandles: 10,
        executionTimeoutMs: 1800000,
        maxConcurrentTasks: 2,
      },
    });

    // Documentation Agent Template
    this.agentTemplates.set('documentation', {
      name: 'Documentation Agent',
      version: '1.0.0',
      capabilities: [
        'technical_documentation',
        'user_guides',
        'api_documentation',
        'process_documentation',
        'knowledge_base_creation',
        'diagramming',
        'tutorial_creation',
        'maintenance_documentation'
      ],
      maxConcurrentTasks: 3,
      resourceLimits: {
        maxMemoryMB: 1024,
        maxCPUTimeMs: 2400000, // 40 minutes
        maxDiskSpaceMB: 250,
        maxNetworkCalls: 10,
        maxFileHandles: 12,
        executionTimeoutMs: 2400000,
        maxConcurrentTasks: 3,
      },
    });

    // Debugger Agent Template
    this.agentTemplates.set('debugger', {
      name: 'Debugger Agent',
      version: '1.0.0',
      capabilities: [
        'problem_diagnosis',
        'error_identification',
        'root_cause_analysis',
        'performance_optimization',
        'system_monitoring',
        'log_analysis',
        'memory_leak_detection',
        'concurrency_debugging'
      ],
      maxConcurrentTasks: 2,
      resourceLimits: {
        maxMemoryMB: 1536,
        maxCPUTimeMs: 3600000, // 1 hour
        maxDiskSpaceMB: 200,
        maxNetworkCalls: 20,
        maxFileHandles: 18,
        executionTimeoutMs: 3600000,
        maxConcurrentTasks: 2,
      },
    });
  }

  async initialize(): Promise<void> {
    try {
      // Load existing agents from storage
      await this.loadExistingAgents();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      // Start learning processing
      this.startLearningProcessing();
      
      // Start performance tracking
      this.startPerformanceTracking();
      
      console.log('Agent Lifecycle Manager initialized');
    } catch (error) {
      console.error('Failed to initialize Agent Lifecycle Manager:', error);
      throw error;
    }
  }

  private async loadExistingAgents(): Promise<void> {
    const agents = await this.storage.getAllAgents();
    
    for (const agent of agents) {
      this.activeAgents.set(agent.id, agent);
      this.performanceHistory.set(agent.id, []);
      
      // Start health monitoring for existing agents
      if (agent.status !== 'maintenance') {
        this.startAgentHealthCheck(agent.id);
      }
    }
    
    console.log(`Loaded ${agents.length} existing agents`);
  }

  async createAgent(config: AgentConfiguration): Promise<Agent> {
    const agentId = uuidv4();
    const template = this.agentTemplates.get(config.type);
    
    if (!template) {
      throw new Error(`No template found for agent type: ${config.type}`);
    }

    const now = new Date();
    const agent: Agent = {
      id: agentId,
      name: config.name || template.name || `${config.type} Agent`,
      type: config.type,
      version: config.version || template.version || '1.0.0',
      status: 'idle',
      capabilities: config.capabilities || template.capabilities || [],
      maxConcurrentTasks: config.maxConcurrentTasks || template.maxConcurrentTasks || 1,
      resourceLimits: { ...template.resourceLimits, ...config.resourceLimits } as ResourceLimits,
      performanceMetrics: [],
      createdAt: now,
      lastActive: now,
      currentTasks: [],
      learningData: {
        performanceHistory: [],
        successPatterns: [],
        failurePatterns: [],
        learnedSkills: [],
        discoveredPatterns: [],
        effectiveStrategies: [],
        behaviorAdaptations: [],
        preferenceChanges: [],
        capabilityEnhancements: [],
      },
    };

    // Store the agent
    await this.storage.saveAgent(agent);
    this.activeAgents.set(agentId, agent);
    this.performanceHistory.set(agentId, []);

    // Start health monitoring
    this.startAgentHealthCheck(agentId);

    this.emit('agent:created', agent);
    console.log(`Created agent: ${agent.name} (${agent.id})`);

    return agent;
  }

  async startAgentHealthCheck(agentId: string): Promise<void> {
    const existingCheck = this.healthChecks.get(agentId);
    if (existingCheck) {
      clearInterval(existingCheck);
    }

    const agent = this.activeAgents.get(agentId);
    if (!agent) return;

    const checkInterval = 30000; // 30 seconds
    const healthCheck = setInterval(async () => {
      try {
        const result = await this.performHealthCheck(agentId);
        
        if (result.status === 'critical' || result.status === 'unhealthy') {
          this.emit('agent:health_issue', agentId, result);
          
          // Take corrective action
          await this.handleHealthIssue(agentId, result);
        }
      } catch (error) {
        console.error(`Health check failed for agent ${agentId}:`, error);
      }
    }, checkInterval);

    this.healthChecks.set(agentId, healthCheck);
  }

  private async performHealthCheck(agentId: string): Promise<HealthCheckResult> {
    const agent = this.activeAgents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const startTime = Date.now();
    
    // Simulate health check (in real implementation, this would check actual agent status)
    const responseTime = Math.random() * 100 + 50; // 50-150ms
    const memoryUsage = Math.random() * 50 + 10; // 10-60%
    const cpuUsage = Math.random() * 40 + 5; // 5-45%
    const activeTasks = agent.currentTasks.length;
    const errorRate = Math.random() * 0.1; // 0-10%
    const lastActivity = agent.lastActive;
    
    // Determine overall status
    let status: HealthCheckResult['status'] = 'healthy';
    const issues: HealthIssue[] = [];
    const recommendations: string[] = [];

    if (errorRate > 0.05) {
      status = 'unhealthy';
      issues.push({
        type: 'error',
        severity: 'high',
        description: `High error rate: ${(errorRate * 100).toFixed(1)}%`,
        timestamp: new Date(),
        resolved: false,
      });
      recommendations.push('Investigate error patterns and implement error handling improvements');
    }

    if (memoryUsage > 80) {
      status = status === 'healthy' ? 'degraded' : status;
      issues.push({
        type: 'resource',
        severity: memoryUsage > 90 ? 'critical' : 'medium',
        description: `High memory usage: ${memoryUsage.toFixed(1)}%`,
        timestamp: new Date(),
        resolved: false,
      });
      recommendations.push('Optimize memory usage or increase resource limits');
    }

    if (cpuUsage > 70) {
      status = status === 'healthy' ? 'degraded' : status;
      issues.push({
        type: 'performance',
        severity: cpuUsage > 90 ? 'critical' : 'medium',
        description: `High CPU usage: ${cpuUsage.toFixed(1)}%`,
        timestamp: new Date(),
        resolved: false,
      });
      recommendations.push('Review task complexity and consider load balancing');
    }

    if (activeTasks >= agent.maxConcurrentTasks) {
      status = status === 'healthy' ? 'degraded' : status;
      issues.push({
        type: 'stability',
        severity: 'medium',
        description: `At maximum capacity: ${activeTasks}/${agent.maxConcurrentTasks} tasks`,
        timestamp: new Date(),
        resolved: false,
      });
      recommendations.push('Consider increasing concurrency or redistributing tasks');
    }

    // Check for inactivity
    const inactiveTime = Date.now() - lastActivity.getTime();
    if (inactiveTime > 3600000) { // 1 hour
      issues.push({
        type: 'stability',
        severity: 'low',
        description: 'Agent has been inactive for over an hour',
        timestamp: new Date(),
        resolved: false,
      });
      recommendations.push('Verify agent availability and consider restart if needed');
    }

    if (issues.length === 0) {
      recommendations.push('Agent is operating normally');
    }

    return {
      agentId,
      status,
      responseTime,
      memoryUsage,
      cpuUsage,
      activeTasks,
      errorRate,
      lastActivity,
      issues,
      recommendations,
    };
  }

  private async handleHealthIssue(agentId: string, healthResult: HealthCheckResult): Promise<void> {
    const agent = this.activeAgents.get(agentId);
    if (!agent) return;

    // Handle different types of health issues
    for (const issue of healthResult.issues) {
      switch (issue.type) {
        case 'error':
          if (issue.severity === 'critical') {
            // Restart agent
            await this.restartAgent(agentId, 'Critical error rate');
          }
          break;
          
        case 'resource':
          if (issue.severity === 'critical') {
            // Reduce load or increase resources
            await this.adjustAgentLoad(agentId, 0.5);
          }
          break;
          
        case 'performance':
          if (issue.severity === 'critical') {
            // Pause new task assignments
            await this.pauseAgent(agentId, 'Critical performance issue');
          }
          break;
      }
    }
  }

  async recordLearningEvent(agentId: string, event: Omit<LearningEvent, 'timestamp'>): Promise<void> {
    const learningEvent: LearningEvent = {
      ...event,
      timestamp: new Date(),
    };

    if (!this.learningQueues.has(agentId)) {
      this.learningQueues.set(agentId, []);
    }
    
    this.learningQueues.get(agentId)!.push(learningEvent);
    
    // Process immediate learning for high-impact events
    if (event.impact === 'positive' || event.impact === 'negative') {
      await this.processLearningEvent(agentId, learningEvent);
    }
  }

  private async processLearningEvent(agentId: string, event: LearningEvent): Promise<void> {
    const agent = this.activeAgents.get(agentId);
    if (!agent) return;

    try {
      switch (event.type) {
        case 'task_completion':
          await this.learnFromTaskCompletion(agent, event);
          break;
          
        case 'error_occurrence':
          await this.learnFromError(agent, event);
          break;
          
        case 'performance_improvement':
          await this.learnFromPerformance(agent, event);
          break;
          
        case 'pattern_discovery':
          await this.learnFromPattern(agent, event);
          break;
          
        case 'skill_acquisition':
          await this.learnNewSkill(agent, event);
          break;
      }

      // Update agent's learning data
      await this.storage.saveAgent(agent);
      
      this.emit('agent:learning_update', agentId, event);
    } catch (error) {
      console.error(`Learning processing failed for agent ${agentId}:`, error);
    }
  }

  private async learnFromTaskCompletion(agent: Agent, event: LearningEvent): Promise<void> {
    const taskData = event.data;
    const quality = taskData.quality || 0.5;
    const executionTime = taskData.executionTime || 0;
    
    // Update success patterns
    const successPattern: SuccessPattern = {
      pattern: JSON.stringify({
        taskType: taskData.taskType,
        complexity: taskData.complexity || 'medium',
        conditions: taskData.conditions || {},
      }),
      successRate: quality,
      frequency: 1,
      context: {
        executionTime,
        timestamp: event.timestamp,
      },
    };
    
    // Check if similar pattern exists
    const existingPattern = agent.learningData.successPatterns.find(p => p.pattern === successPattern.pattern);
    if (existingPattern) {
      existingPattern.frequency += 1;
      existingPattern.successRate = (existingPattern.successRate * (existingPattern.frequency - 1) + quality) / existingPattern.frequency;
    } else {
      agent.learningData.successPatterns.push(successPattern);
    }

    // Update performance metrics
    const performanceMetric: PerformanceMetrics = {
      taskType: taskData.taskType || 'unknown',
      successRate: quality,
      averageExecutionTime: executionTime,
      qualityScore: quality,
      resourceUsage: taskData.resourceUsage || {
        memoryMB: 0,
        cpuTimeMs: 0,
        diskSpaceMB: 0,
        networkCalls: 0,
      },
      timestamp: event.timestamp.toISOString(),
    };
    
    agent.performanceMetrics.push(performanceMetric);
    
    // Keep only recent metrics
    if (agent.performanceMetrics.length > 100) {
      agent.performanceMetrics = agent.performanceMetrics.slice(-100);
    }
  }

  private async learnFromError(agent: Agent, event: LearningEvent): Promise<void> {
    const errorData = event.data;
    
    const failurePattern: FailurePattern = {
      pattern: JSON.stringify({
        errorType: errorData.type,
        context: errorData.context || {},
        taskType: errorData.taskType,
      }),
      failureRate: 1.0,
      frequency: 1,
      context: {
        errorMessage: errorData.message,
        timestamp: event.timestamp,
      },
    };
    
    const existingPattern = agent.learningData.failurePatterns.find(p => p.pattern === failurePattern.pattern);
    if (existingPattern) {
      existingPattern.frequency += 1;
    } else {
      agent.learningData.failurePatterns.push(failurePattern);
    }

    // Create behavior adaptation
    const adaptation: BehaviorAdaptation = {
      trigger: errorData.type,
      adaptation: {
        action: 'error_avoidance',
        description: `Avoid pattern that leads to ${errorData.type}`,
        preventionStrategy: errorData.prevention || 'General error handling',
      },
      effectiveness: 0.8, // Estimated effectiveness
      appliedAt: event.timestamp,
    };
    
    agent.learningData.behaviorAdaptations.push(adaptation);
  }

  private async learnFromPerformance(agent: Agent, event: LearningEvent): Promise<void> {
    const performanceData = event.data;
    
    const strategy: EffectiveStrategy = {
      strategy: performanceData.strategy,
      effectiveness: performanceData.improvement || 0.1,
      context: {
        beforeMetrics: performanceData.before,
        afterMetrics: performanceData.after,
        timestamp: event.timestamp,
      },
      appliedAt: event.timestamp,
    };
    
    agent.learningData.effectiveStrategies.push(strategy);
  }

  private async learnFromPattern(agent: Agent, event: LearningEvent): Promise<void> {
    const patternData = event.data;
    
    const discoveredPattern: DiscoveredPattern = {
      pattern: patternData.pattern,
      confidence: patternData.confidence || 0.5,
      discoveredAt: event.timestamp,
      context: patternData.context || {},
    };
    
    agent.learningData.discoveredPatterns.push(discoveredPattern);
  }

  private async learnNewSkill(agent: Agent, event: LearningEvent): Promise<void> {
    const skillData = event.data;
    
    const learnedSkill: LearnedSkill = {
      skill: skillData.skill,
      proficiency: skillData.proficiency || 0.1,
      learnedAt: event.timestamp,
      context: skillData.context || {},
    };
    
    agent.learningData.learnedSkills.push(learnedSkill);
    
    // Add skill to agent capabilities
    if (!agent.capabilities.includes(skillData.skill)) {
      agent.capabilities.push(skillData.skill);
      
      // Record capability enhancement
      const enhancement: CapabilityEnhancement = {
        capability: skillData.skill,
        enhancement: {
          action: 'skill_acquisition',
          proficiency: skillData.proficiency,
        },
        improvement: skillData.proficiency,
        appliedAt: event.timestamp,
      };
      
      agent.learningData.capabilityEnhancements.push(enhancement);
    }
  }

  async updateAgentStatus(agentId: string, status: AgentStatus): Promise<void> {
    const agent = this.activeAgents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const previousStatus = agent.status;
    agent.status = status;
    agent.lastActive = new Date();
    
    await this.storage.saveAgent(agent);
    
    this.emit('agent:status_changed', agentId, status, previousStatus);
    console.log(`Agent ${agentId} status changed: ${previousStatus} → ${status}`);
  }

  async restartAgent(agentId: string, reason: string): Promise<void> {
    await this.updateAgentStatus(agentId, 'maintenance');
    
    // Simulate restart process
    setTimeout(async () => {
      await this.updateAgentStatus(agentId, 'idle');
      this.emit('agent:restarted', agentId, reason);
    }, 5000);
  }

  async pauseAgent(agentId: string, reason: string): Promise<void> {
    await this.updateAgentStatus(agentId, 'maintenance');
    this.emit('agent:paused', agentId, reason);
  }

  async resumeAgent(agentId: string): Promise<void> {
    await this.updateAgentStatus(agentId, 'idle');
    this.emit('agent:resumed', agentId);
  }

  async adjustAgentLoad(agentId: string, loadFactor: number): Promise<void> {
    const agent = this.activeAgents.get(agentId);
    if (!agent) return;

    const newMaxTasks = Math.max(1, Math.floor(agent.maxConcurrentTasks * loadFactor));
    agent.maxConcurrentTasks = newMaxTasks;
    
    await this.storage.saveAgent(agent);
    this.emit('agent:load_adjusted', agentId, newMaxTasks);
  }

  async retireAgent(agentId: string, reason: string): Promise<void> {
    const agent = this.activeAgents.get(agentId);
    if (!agent) return;

    // Stop health monitoring
    const healthCheck = this.healthChecks.get(agentId);
    if (healthCheck) {
      clearInterval(healthCheck);
      this.healthChecks.delete(agentId);
    }

    // Archive agent data
    this.emit('agent:retiring', agentId, reason);
    
    // In a real implementation, you would archive the agent data
    // and remove it from active agents
    this.activeAgents.delete(agentId);
    
    this.emit('agent:retired', agentId, reason);
    console.log(`Agent ${agentId} retired: ${reason}`);
  }

  private startHealthMonitoring(): void {
    // Periodic system-wide health check
    setInterval(async () => {
      for (const [agentId, agent] of this.activeAgents) {
        if (agent.status !== 'maintenance') {
          try {
            const healthResult = await this.performHealthCheck(agentId);
            
            // Log health metrics
            if (healthResult.status !== 'healthy') {
              console.warn(`Agent ${agentId} health: ${healthResult.status}`, healthResult.issues);
            }
          } catch (error) {
            console.error(`Health monitoring failed for agent ${agentId}:`, error);
          }
        }
      }
    }, 60000); // Every minute
  }

  private startLearningProcessing(): void {
    setInterval(async () => {
      for (const [agentId, queue] of this.learningQueues) {
        if (queue.length > 0) {
          const event = queue.shift()!;
          await this.processLearningEvent(agentId, event);
        }
      }
    }, 5000); // Every 5 seconds
  }

  private startPerformanceTracking(): void {
    setInterval(async () => {
      // Update performance history
      for (const [agentId, agent] of this.activeAgents) {
        const recentMetrics = agent.performanceMetrics.slice(-10);
        this.performanceHistory.set(agentId, recentMetrics);
      }
    }, 30000); // Every 30 seconds
  }

  async getAgentHealth(agentId: string): Promise<HealthCheckResult | null> {
    try {
      return await this.performHealthCheck(agentId);
    } catch (error) {
      console.error(`Failed to get health for agent ${agentId}:`, error);
      return null;
    }
  }

  async getAllAgentHealth(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];
    
    for (const agentId of this.activeAgents.keys()) {
      const health = await this.getAgentHealth(agentId);
      if (health) {
        results.push(health);
      }
    }
    
    return results;
  }

  async getAgentLearningStats(agentId: string): Promise<any> {
    const agent = this.activeAgents.get(agentId);
    if (!agent) return null;

    const learningData = agent.learningData;
    
    return {
      successPatterns: learningData.successPatterns.length,
      failurePatterns: learningData.failurePatterns.length,
      learnedSkills: learningData.learnedSkills.length,
      discoveredPatterns: learningData.discoveredPatterns.length,
      effectiveStrategies: learningData.effectiveStrategies.length,
      behaviorAdaptations: learningData.behaviorAdaptations.length,
      capabilityEnhancements: learningData.capabilityEnhancements.length,
      performanceMetrics: agent.performanceMetrics.length,
      recentPerformance: agent.performanceMetrics.slice(-5),
    };
  }

  async getSystemHealth(): Promise<any> {
    const totalAgents = this.activeAgents.size;
    const activeAgents = Array.from(this.activeAgents.values()).filter(a => a.status === 'idle' || a.status === 'busy');
    const healthyAgents = (await this.getAllAgentHealth()).filter(h => h.status === 'healthy').length;
    
    const statusDistribution: Record<string, number> = {};
    for (const agent of this.activeAgents.values()) {
      statusDistribution[agent.status] = (statusDistribution[agent.status] || 0) + 1;
    }

    return {
      totalAgents,
      activeAgents: activeAgents.length,
      healthyAgents,
      healthRate: totalAgents > 0 ? ((healthyAgents / totalAgents) * 100).toFixed(2) : '0',
      statusDistribution,
      learningQueues: Array.from(this.learningQueues.values()).reduce((sum, queue) => sum + queue.length, 0),
    };
  }

  async shutdown(): Promise<void> {
    // Stop all health checks
    for (const [agentId, healthCheck] of this.healthChecks) {
      clearInterval(healthCheck);
    }
    this.healthChecks.clear();

    // Save all agent data
    for (const agent of this.activeAgents.values()) {
      await this.storage.saveAgent(agent);
    }

    // Clear all data structures
    this.activeAgents.clear();
    this.learningQueues.clear();
    this.performanceHistory.clear();

    console.log('Agent Lifecycle Manager shutdown complete');
  }
}