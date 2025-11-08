// Core Agent Types
export type AgentType = 
  | 'research'
  | 'architect' 
  | 'implementation'
  | 'testing'
  | 'review'
  | 'documentation'
  | 'debugger';

export type AgentStatus = 
  | 'idle'
  | 'busy'
  | 'learning'
  | 'error'
  | 'maintenance';

export type TaskStatus =
  | 'pending'
  | 'assigned'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'blocked';

export type MessageType = 
  | 'task_delegation'
  | 'task_update'
  | 'task_completion'
  | 'knowledge_share'
  | 'learning_update'
  | 'pattern_discovery'
  | 'conflict_escalation'
  | 'resource_request'
  | 'coordination_request'
  | 'health_check'
  | 'status_update'
  | 'capability_announcement';

export type MessagePriority = 
  | 0  // LOW
  | 1  // NORMAL
  | 2  // HIGH
  | 3  // URGENT
  | 4; // CRITICAL

export type MemoryType = 
  | 'working'
  | 'short_term'
  | 'long_term'
  | 'shared';

export type MemoryCategory = 
  | 'task'
  | 'learning'
  | 'interaction'
  | 'context'
  | 'pattern'
  | 'knowledge';

export type LearningType = 
  | 'performance'
  | 'pattern'
  | 'feedback'
  | 'skill'
  | 'strategy';

export type ConflictType = 
  | 'resource_contention'
  | 'task_overlap'
  | 'communication_deadlock'
  | 'capability_mismatch';

export type IntegrationType = 
  | 'task_orchestrator'
  | 'context_persistence'
  | 'search_aggregator'
  | 'skills_manager';

// Core Interfaces
export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  version: string;
  status: AgentStatus;
  capabilities: string[];
  maxConcurrentTasks: number;
  resourceLimits: ResourceLimits;
  performanceMetrics: PerformanceMetrics[];
  createdAt: Date;
  lastActive: Date;
  currentTasks: string[];
  learningData: LearningData;
}

export interface Task {
  id: string;
  agentId?: string;
  teamId?: string;
  type: AgentType;
  description: string;
  inputData?: any;
  outputData?: any;
  status: TaskStatus;
  priority: number;
  dependencies: string[];
  startedAt?: Date;
  completedAt?: Date;
  executionTime?: number;
  errorMessage?: string;
  resultQuality?: number;
  createdAt: Date;
}

export interface AgentMessage {
  id: string;
  from: string;
  to?: string;
  type: MessageType;
  priority: MessagePriority;
  timestamp: Date;
  correlationId?: string;
  content: any;
  context: MessageContext;
  requiresResponse: boolean;
  timeout?: number;
  retryCount: number;
  maxRetries: number;
}

export interface MessageContext {
  taskId?: string;
  agentType?: AgentType;
  priority: number;
  timestamp: number;
}

export interface ResourceLimits {
  maxMemoryMB: number;
  maxCPUTimeMs: number;
  maxDiskSpaceMB: number;
  maxNetworkCalls: number;
  maxFileHandles: number;
  executionTimeoutMs: number;
  maxConcurrentTasks: number;
}

export interface PerformanceMetrics {
  taskType: string;
  successRate: number;
  averageExecutionTime: number;
  qualityScore: number;
  resourceUsage: ResourceUsage;
  timestamp: string;
}

export interface ResourceUsage {
  memoryMB: number;
  cpuTimeMs: number;
  diskSpaceMB: number;
  networkCalls: number;
}

export interface LearningData {
  performanceHistory: PerformanceMetric[];
  successPatterns: SuccessPattern[];
  failurePatterns: FailurePattern[];
  learnedSkills: LearnedSkill[];
  discoveredPatterns: DiscoveredPattern[];
  effectiveStrategies: EffectiveStrategy[];
  behaviorAdaptations: BehaviorAdaptation[];
  preferenceChanges: PreferenceChange[];
  capabilityEnhancements: CapabilityEnhancement[];
}

export interface PerformanceMetric {
  taskType: string;
  successRate: number;
  averageExecutionTime: number;
  qualityScore: number;
  resourceUsage: ResourceUsage;
  timestamp: string;
}

export interface SuccessPattern {
  pattern: string;
  successRate: number;
  frequency: number;
  context: any;
}

export interface FailurePattern {
  pattern: string;
  failureRate: number;
  frequency: number;
  context: any;
}

export interface LearnedSkill {
  skill: string;
  proficiency: number;
  learnedAt: Date;
  context: any;
}

export interface DiscoveredPattern {
  pattern: string;
  confidence: number;
  discoveredAt: Date;
  context: any;
}

export interface EffectiveStrategy {
  strategy: string;
  effectiveness: number;
  context: any;
  appliedAt: Date;
}

export interface BehaviorAdaptation {
  trigger: string;
  adaptation: any;
  effectiveness: number;
  appliedAt: Date;
}

export interface PreferenceChange {
  preference: string;
  oldValue: any;
  newValue: any;
  reason: string;
  changedAt: Date;
}

export interface CapabilityEnhancement {
  capability: string;
  enhancement: any;
  improvement: number;
  appliedAt: Date;
}

export interface AgentMemory {
  id: string;
  agentId: string;
  memoryType: MemoryType;
  category: MemoryCategory;
  key: string;
  value: any;
  importance: number;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  expiresAt?: Date;
}

export interface AgentTeam {
  id: string;
  name: string;
  description: string;
  teamType: 'research' | 'development' | 'review' | 'mixed';
  status: 'active' | 'completed' | 'disbanded';
  members: string[];
  coordinationRules: any;
  performanceMetrics: any;
  createdAt: Date;
  disbandedAt?: Date;
}

export interface IntegrationConfig {
  type: IntegrationType;
  enabled: boolean;
  autoDelegate: boolean;
  delegationRules: any;
  endpoint?: string;
  timeout: number;
  retryAttempts: number;
}

export interface ConflictResolution {
  type: ConflictType;
  involvedAgents: string[];
  context: any;
  resolutionStrategy: 'automatic' | 'escalate' | 'manual';
  resolution?: any;
  resolvedAt?: Date;
}

export interface KnowledgeShare {
  id: string;
  fromAgentId: string;
  toAgentId?: string;
  knowledgeType: string;
  content: any;
  context: any;
  sharedAt: Date;
  acknowledgedAt?: Date;
  appliedAt?: Date;
  effectiveness?: number;
}

export interface AgentCapabilities {
  research: string[];
  architect: string[];
  implementation: string[];
  testing: string[];
  review: string[];
  documentation: string[];
  debugger: string[];
}