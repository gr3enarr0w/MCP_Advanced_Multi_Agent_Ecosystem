/**
 * MCP Server Bridge
 * 
 * Communication bridge for integrating with existing MCP servers
 * Handles inter-server communication, tool delegation, and data exchange
 * 
 * Integrated Servers:
 * - Task Orchestrator: Code execution and task management
 * - Context Persistence: Vector storage and knowledge management
 * - Search Aggregator: Multi-provider search capabilities
 * - Skills Manager: Dynamic skill tracking and management
 * - GitHub OAuth2: Repository integration and authentication
 */

import { EventEmitter } from 'eventemitter3';
import { AgentMessage, IntegrationConfig, IntegrationType } from '../types/agents.js';
import { AgentStorage } from '../storage/agent-storage.js';

export interface MCPServerConnection {
  name: string;
  type: IntegrationType;
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
  lastPing: Date;
  responseTime: number;
  capabilities: string[];
  config: IntegrationConfig;
  endpoint?: string;
  health: ServerHealth;
}

export interface ServerHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  errorRate: number;
  lastCheck: Date;
  issues: string[];
}

export interface CrossServerMessage {
  id: string;
  from: string;
  to: string;
  type: 'task_delegation' | 'data_request' | 'data_response' | 'knowledge_share' | 'sync_request' | 'sync_response';
  payload: any;
  timestamp: Date;
  requiresResponse: boolean;
  correlationId?: string;
  priority: number;
  responseTime?: number;
}

export interface TaskDelegationRequest {
  taskId: string;
  taskType: string;
  parameters: any;
  priority: number;
  timeout: number;
  expectedCapabilities: string[];
}

export interface DataQueryRequest {
  query: string;
  filters: Record<string, any>;
  resultType: 'agents' | 'tasks' | 'messages' | 'knowledge' | 'metrics';
  limit: number;
  offset: number;
}

export class MCPServerBridge extends EventEmitter {
  private storage: AgentStorage;
  private connections: Map<string, MCPServerConnection> = new Map();
  private messageQueue: CrossServerMessage[] = [];
  private activeRequests: Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map();
  private serverConfigs: Map<IntegrationType, IntegrationConfig> = new Map();

  constructor(storage: AgentStorage) {
    super();
    this.storage = storage;
    this.initializeServerConfigs();
  }

  private initializeServerConfigs(): void {
    // Task Orchestrator integration
    this.serverConfigs.set('task_orchestrator', {
      type: 'task_orchestrator',
      enabled: true,
      autoDelegate: true,
      delegationRules: {
        taskTypes: ['implementation', 'testing', 'debugger'],
        languages: ['javascript', 'typescript', 'python', 'bash', 'sql'],
        priorityThreshold: 2,
      },
      timeout: 300000, // 5 minutes
      retryAttempts: 3,
    });

    // Context Persistence integration
    this.serverConfigs.set('context_persistence', {
      type: 'context_persistence',
      enabled: true,
      autoDelegate: false,
      delegationRules: {
        memoryTypes: ['long_term', 'shared', 'context'],
        semanticSearch: true,
        vectorStorage: true,
      },
      timeout: 60000, // 1 minute
      retryAttempts: 2,
    });

    // Search Aggregator integration
    this.serverConfigs.set('search_aggregator', {
      type: 'search_aggregator',
      enabled: true,
      autoDelegate: true,
      delegationRules: {
        agentTypes: ['research', 'ask', 'deep_research'],
        providers: ['perplexity', 'brave', 'google', 'duckduckgo'],
        cacheResults: true,
      },
      timeout: 120000, // 2 minutes
      retryAttempts: 3,
    });

    // Skills Manager integration
    this.serverConfigs.set('skills_manager', {
      type: 'skills_manager',
      enabled: true,
      autoDelegate: false,
      delegationRules: {
        skillTracking: true,
        learningUpdate: true,
        capabilityMapping: true,
      },
      timeout: 45000, // 45 seconds
      retryAttempts: 2,
    });
  }

  async initialize(): Promise<void> {
    try {
      // Discover and connect to existing MCP servers
      await this.discoverServers();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      // Start message processing
      this.startMessageProcessing();
      
      console.log('MCP Server Bridge initialized');
    } catch (error) {
      console.error('Failed to initialize MCP Server Bridge:', error);
      throw error;
    }
  }

  private async discoverServers(): Promise<void> {
    const serverTypes: IntegrationType[] = ['task_orchestrator', 'context_persistence', 'search_aggregator', 'skills_manager'];
    
    for (const serverType of serverTypes) {
      try {
        const connection = await this.connectToServer(serverType);
        if (connection) {
          this.connections.set(connection.name, connection);
          this.emit('server:connected', connection.name);
        }
      } catch (error) {
        console.warn(`Failed to connect to ${serverType}:`, error);
        this.emit('server:connection_failed', serverType, error);
      }
    }
  }

  private async connectToServer(serverType: IntegrationType): Promise<MCPServerConnection | null> {
    const config = this.serverConfigs.get(serverType);
    if (!config) {
      throw new Error(`No configuration found for server type: ${serverType}`);
    }

    const connection: MCPServerConnection = {
      name: serverType,
      type: serverType,
      status: 'connecting',
      lastPing: new Date(),
      responseTime: 0,
      capabilities: await this.discoverServerCapabilities(serverType),
      config,
      health: {
        status: 'unhealthy',
        responseTime: 0,
        errorRate: 0,
        lastCheck: new Date(),
        issues: [],
      },
    };

    try {
      // Test connection
      const healthCheck = await this.pingServer(serverType);
      if (healthCheck.success) {
        connection.status = 'connected';
        connection.responseTime = healthCheck.responseTime;
        connection.health = {
          status: 'healthy',
          responseTime: healthCheck.responseTime,
          errorRate: 0,
          lastCheck: new Date(),
          issues: [],
        };
      } else {
        connection.status = 'error';
        connection.health.issues.push(healthCheck.error || 'Connection failed');
      }
    } catch (error) {
      connection.status = 'error';
      connection.health.issues.push(error instanceof Error ? error.message : String(error));
    }

    return connection;
  }

  private async discoverServerCapabilities(serverType: IntegrationType): Promise<string[]> {
    const capabilities: Record<IntegrationType, string[]> = {
      'task_orchestrator': [
        'code_execution',
        'task_management',
        'language_support',
        'environment_management',
        'result_capture',
      ],
      'context_persistence': [
        'vector_storage',
        'semantic_search',
        'conversation_history',
        'knowledge_retrieval',
        'similarity_matching',
      ],
      'search_aggregator': [
        'multi_provider_search',
        'web_search',
        'search_caching',
        'result_aggregation',
        'fallback_support',
      ],
      'skills_manager': [
        'skill_tracking',
        'learning_management',
        'capability_assessment',
        'skill_recommendation',
        'performance_analytics',
      ],
    };

    return capabilities[serverType] || [];
  }

  private async pingServer(serverType: IntegrationType): Promise<{ success: boolean; responseTime: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      // Simulate ping to MCP server
      // In real implementation, this would make actual HTTP/stdio calls
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
      
      const responseTime = Date.now() - startTime;
      return { success: true, responseTime };
    } catch (error) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async delegateTaskToServer(serverType: IntegrationType, request: TaskDelegationRequest): Promise<any> {
    const connection = this.connections.get(serverType);
    if (!connection || connection.status !== 'connected') {
      throw new Error(`Server ${serverType} is not available`);
    }

    const messageId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const message: CrossServerMessage = {
      id: messageId,
      from: 'agent-swarm',
      to: serverType,
      type: 'task_delegation',
      payload: request,
      timestamp: new Date(),
      requiresResponse: true,
      correlationId: request.taskId,
      priority: request.priority,
    };

    try {
      // Send message and wait for response
      const response = await this.sendMessageWithTimeout(message, connection.config.timeout);
      
      // Update server health
      this.updateServerHealth(serverType, true, response.responseTime);
      
      return response.payload;
    } catch (error) {
      // Update server health
      this.updateServerHealth(serverType, false, 0, error);
      throw error;
    }
  }

  async queryServerData(serverType: IntegrationType, request: DataQueryRequest): Promise<any> {
    const connection = this.connections.get(serverType);
    if (!connection || connection.status !== 'connected') {
      throw new Error(`Server ${serverType} is not available`);
    }

    const messageId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const message: CrossServerMessage = {
      id: messageId,
      from: 'agent-swarm',
      to: serverType,
      type: 'data_request',
      payload: request,
      timestamp: new Date(),
      requiresResponse: true,
      priority: 1,
    };

    try {
      const response = await this.sendMessageWithTimeout(message, connection.config.timeout);
      this.updateServerHealth(serverType, true, response.responseTime);
      return response.payload;
    } catch (error) {
      this.updateServerHealth(serverType, false, 0, error);
      throw error;
    }
  }

  async shareKnowledgeWithServer(serverType: IntegrationType, knowledge: any): Promise<void> {
    const connection = this.connections.get(serverType);
    if (!connection || connection.status !== 'connected') {
      throw new Error(`Server ${serverType} is not available`);
    }

    const messageId = `knowledge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const message: CrossServerMessage = {
      id: messageId,
      from: 'agent-swarm',
      to: serverType,
      type: 'knowledge_share',
      payload: knowledge,
      timestamp: new Date(),
      requiresResponse: false,
      priority: 1,
    };

    await this.sendMessage(message);
  }

  async syncWithServer(serverType: IntegrationType, syncData: any): Promise<any> {
    const connection = this.connections.get(serverType);
    if (!connection || connection.status !== 'connected') {
      throw new Error(`Server ${serverType} is not available`);
    }

    const messageId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const message: CrossServerMessage = {
      id: messageId,
      from: 'agent-swarm',
      to: serverType,
      type: 'sync_request',
      payload: syncData,
      timestamp: new Date(),
      requiresResponse: true,
      priority: 2,
    };

    try {
      const response = await this.sendMessageWithTimeout(message, connection.config.timeout);
      this.updateServerHealth(serverType, true, response.responseTime);
      return response.payload;
    } catch (error) {
      this.updateServerHealth(serverType, false, 0, error);
      throw error;
    }
  }

  async handleKnowledgeShare(message: AgentMessage): Promise<void> {
    // Forward knowledge to relevant MCP servers
    const knowledgeData = message.content;
    
    // Share with context persistence for long-term storage
    if (this.connections.has('context_persistence')) {
      await this.shareKnowledgeWithServer('context_persistence', {
        type: 'agent_knowledge',
        content: knowledgeData,
        metadata: {
          agentId: message.from,
          timestamp: message.timestamp,
          source: 'agent-swarm',
        },
      });
    }

    // Share with skills manager for capability updates
    if (this.connections.has('skills_manager')) {
      await this.shareKnowledgeWithServer('skills_manager', {
        type: 'learning_update',
        content: knowledgeData,
        metadata: {
          agentId: message.from,
          timestamp: message.timestamp,
        },
      });
    }
  }

  private async sendMessageWithTimeout(message: CrossServerMessage, timeout: number): Promise<CrossServerMessage> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.activeRequests.delete(message.id);
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);

      this.activeRequests.set(message.id, {
        resolve,
        reject,
        timeout: timer,
      });

      this.sendMessage(message);
    });
  }

  private async sendMessage(message: CrossServerMessage): Promise<void> {
    // Add to queue for processing
    this.messageQueue.push(message);
    
    // Log the message
    await this.storage.logMessage({
      id: `cross_server_${message.id}`,
      from: message.from,
      to: message.to,
      type: 'knowledge_share', // Map to existing message type
      priority: message.priority,
      timestamp: message.timestamp,
      content: message.payload,
      context: {
        taskId: message.correlationId,
        agentType: 'integration' as any,
        priority: message.priority,
        timestamp: Date.now(),
      },
      requiresResponse: message.requiresResponse,
      retryCount: 0,
      maxRetries: 3,
    } as AgentMessage);
  }

  private startMessageProcessing(): void {
    setInterval(async () => {
      if (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift()!;
        await this.processMessage(message);
      }
    }, 100); // Process messages every 100ms
  }

  private async processMessage(message: CrossServerMessage): Promise<void> {
    try {
      // Simulate message processing
      // In real implementation, this would send actual MCP requests
      const processingTime = Math.random() * 50 + 10;
      await new Promise(resolve => setTimeout(resolve, processingTime));

      if (message.requiresResponse && this.activeRequests.has(message.id)) {
        const request = this.activeRequests.get(message.id)!;
        
        // Simulate response
        const response: CrossServerMessage = {
          ...message,
          type: message.type === 'task_delegation' ? 'data_response' : 'sync_response',
          payload: { status: 'success', result: 'Processed successfully' },
          timestamp: new Date(),
        };

        clearTimeout(request.timeout);
        request.resolve(response);
        this.activeRequests.delete(message.id);
      }
    } catch (error) {
      if (message.requiresResponse && this.activeRequests.has(message.id)) {
        const request = this.activeRequests.get(message.id)!;
        clearTimeout(request.timeout);
        request.reject(error);
        this.activeRequests.delete(message.id);
      }
    }
  }

  private startHealthMonitoring(): void {
    setInterval(async () => {
      for (const [serverName, connection] of this.connections) {
        try {
          const healthCheck = await this.pingServer(connection.type);
          connection.lastPing = new Date();
          connection.responseTime = healthCheck.responseTime;
          
          if (healthCheck.success) {
            connection.status = 'connected';
            this.updateServerHealth(connection.type, true, healthCheck.responseTime);
          } else {
            connection.status = 'error';
            this.updateServerHealth(connection.type, false, 0, new Error(healthCheck.error));
          }
        } catch (error) {
          connection.status = 'error';
          this.updateServerHealth(connection.type, false, 0, error);
        }
      }
    }, 30000); // Health check every 30 seconds
  }

  private updateServerHealth(serverType: IntegrationType, success: boolean, responseTime: number, error?: any): void {
    const connection = this.connections.get(serverType);
    if (!connection) return;

    connection.health.lastCheck = new Date();
    connection.health.responseTime = responseTime;

    if (success) {
      connection.health.status = 'healthy';
      connection.health.errorRate = Math.max(0, connection.health.errorRate - 0.01);
      if (connection.health.issues.length > 0) {
        connection.health.issues = connection.health.issues.filter(issue => !issue.includes('connection'));
      }
    } else {
      connection.health.errorRate = Math.min(1, connection.health.errorRate + 0.1);
      connection.health.status = connection.health.errorRate > 0.5 ? 'unhealthy' : 'degraded';
      
      if (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!connection.health.issues.includes(errorMessage)) {
          connection.health.issues.push(errorMessage);
        }
      }
    }
  }

  async getConnectedServers(): Promise<MCPServerConnection[]> {
    return Array.from(this.connections.values());
  }

  async getServerStatus(serverType: IntegrationType): Promise<MCPServerConnection | null> {
    return this.connections.get(serverType) || null;
  }

  async getServerHealth(serverType: IntegrationType): Promise<ServerHealth | null> {
    const connection = this.connections.get(serverType);
    return connection ? connection.health : null;
  }

  async reconnectServer(serverType: IntegrationType): Promise<boolean> {
    try {
      const connection = await this.connectToServer(serverType);
      if (connection) {
        this.connections.set(serverType, connection);
        this.emit('server:reconnected', serverType);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Failed to reconnect to ${serverType}:`, error);
      this.emit('server:reconnection_failed', serverType, error);
      return false;
    }
  }

  async disconnectServer(serverType: IntegrationType): Promise<void> {
    const connection = this.connections.get(serverType);
    if (connection) {
      connection.status = 'disconnected';
      this.emit('server:disconnected', serverType);
    }
  }

  async updateServerConfig(serverType: IntegrationType, config: Partial<IntegrationConfig>): Promise<void> {
    const existingConfig = this.serverConfigs.get(serverType);
    if (existingConfig) {
      this.serverConfigs.set(serverType, { ...existingConfig, ...config });
      
      // Update connection config if server is connected
      const connection = this.connections.get(serverType);
      if (connection) {
        connection.config = { ...connection.config, ...config };
      }
    }
  }

  async getIntegrationStatistics(): Promise<any> {
    const servers = Array.from(this.connections.values());
    const connected = servers.filter(s => s.status === 'connected').length;
    const total = servers.length;
    
    const averageResponseTime = servers.length > 0 
      ? servers.reduce((sum, s) => sum + s.responseTime, 0) / servers.length 
      : 0;
    
    const healthStats = {
      healthy: servers.filter(s => s.health.status === 'healthy').length,
      degraded: servers.filter(s => s.health.status === 'degraded').length,
      unhealthy: servers.filter(s => s.health.status === 'unhealthy').length,
    };

    return {
      totalServers: total,
      connectedServers: connected,
      connectionRate: total > 0 ? ((connected / total) * 100).toFixed(2) : '0',
      averageResponseTime: averageResponseTime.toFixed(2),
      healthDistribution: healthStats,
      totalMessagesProcessed: this.messageQueue.length,
      activeRequests: this.activeRequests.size,
      serverDetails: servers.map(s => ({
        name: s.name,
        status: s.status,
        health: s.health.status,
        responseTime: s.responseTime,
        capabilities: s.capabilities.length,
      })),
    };
  }

  async close(): Promise<void> {
    // Disconnect from all servers
    for (const serverType of this.connections.keys()) {
      await this.disconnectServer(serverType);
    }

    // Clear all queues and requests
    this.messageQueue = [];
    this.activeRequests.clear();
    this.connections.clear();

    console.log('MCP Server Bridge closed');
  }
}