/**
 * Agent Swarm MCP Server
 * 
 * Multi-Agent AI Framework Integration Layer
 * 
 * Core Capabilities:
 * - Agent coordination and task delegation
 * - SPARC methodology workflow management
 * - Boomerang task delegation patterns
 * - Integration with existing MCP servers
 * - Agent lifecycle management and learning
 * - Multi-agent communication orchestration
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { EventEmitter } from 'eventemitter3';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

// Import types
import {
  Agent,
  Task,
  AgentMessage,
  AgentType,
  TaskStatus,
  MessageType,
  MessagePriority,
  IntegrationConfig
} from './types/agents.js';

// Configuration
const MCP_HOME = join(homedir(), '.mcp');
const AGENT_DB = join(MCP_HOME, 'context', 'db', 'agent-swarm.db');
const LOG_DIR = join(MCP_HOME, 'logs');

// Ensure directories exist
if (!existsSync(MCP_HOME)) {
  mkdirSync(MCP_HOME, { recursive: true });
}
if (!existsSync(join(MCP_HOME, 'context', 'db'))) {
  mkdirSync(join(MCP_HOME, 'context', 'db'), { recursive: true });
}
if (!existsSync(LOG_DIR)) {
  mkdirSync(LOG_DIR, { recursive: true });
}

import { AgentStorage } from './storage/agent-storage.js';
import { AgentOrchestrator } from './orchestrator/agent-orchestrator.js';
import { MCPServerBridge } from './integration/mcp-bridge.js';
import { AgentLifecycleManager } from './agents/base/agent-lifecycle.js';
import { SPARCWorkflowManager } from './orchestrator/sparc-workflow.js';
import { BoomerangTaskManager } from './orchestrator/boomerang-task.js';

// Core Agent Swarm Server
class AgentSwarmServer extends EventEmitter {
  private orchestrator: AgentOrchestrator;
  private storage: AgentStorage;
  private mcpBridge: MCPServerBridge;
  private lifecycleManager: AgentLifecycleManager;
  private sparcManager: SPARCWorkflowManager;
  private boomerangManager: BoomerangTaskManager;
  private initialized: boolean = false;

  constructor() {
    super();
    this.storage = new AgentStorage(AGENT_DB);
    this.orchestrator = new AgentOrchestrator(this.storage);
    this.mcpBridge = new MCPServerBridge(this.storage);
    this.lifecycleManager = new AgentLifecycleManager(this.storage);
    this.sparcManager = new SPARCWorkflowManager(this.storage, this.orchestrator);
    this.boomerangManager = new BoomerangTaskManager(this.storage, this.orchestrator);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize storage
      await this.storage.initialize();
      
      // Initialize core components
      await this.orchestrator.initialize();
      await this.mcpBridge.initialize();
      await this.lifecycleManager.initialize();
      await this.sparcManager.initialize();
      await this.boomerangManager.initialize();

      // Set up event handlers
      this.setupEventHandlers();

      this.initialized = true;
      console.error('Agent Swarm Server initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Agent Swarm Server:', error);
      throw error;
    }
  }

  private setupEventHandlers(): void {
    // Handle agent lifecycle events
    this.lifecycleManager.on('agent:created', (agent: Agent) => {
      console.log(`Agent created: ${agent.name} (${agent.type})`);
    });

    this.lifecycleManager.on('agent:status_changed', (agentId: string, status: string) => {
      console.log(`Agent ${agentId} status changed to: ${status}`);
    });

    // Handle task delegation events
    this.orchestrator.on('task:delegated', (task: Task) => {
      console.log(`Task delegated: ${task.id} to agent ${task.agentId}`);
    });

    this.orchestrator.on('task:completed', (task: Task) => {
      console.log(`Task completed: ${task.id}`);
    });

    // Handle SPARC workflow events
    this.sparcManager.on('phase:started', (taskId: string, phase: string) => {
      console.log(`SPARC phase started: ${phase} for task ${taskId}`);
    });

    this.sparcManager.on('phase:completed', (taskId: string, phase: string) => {
      console.log(`SPARC phase completed: ${phase} for task ${taskId}`);
    });

    // Handle boomerang task events
    this.boomerangManager.on('boomerang:sent', (taskId: string, targetAgent: string) => {
      console.log(`Boomerang sent: task ${taskId} to ${targetAgent}`);
    });

    this.boomerangManager.on('boomerang:returned', (taskId: string, result: any) => {
      console.log(`Boomerang returned: task ${taskId} with result`);
    });

    // Handle MCP integration events
    this.mcpBridge.on('server:connected', (serverName: string) => {
      console.log(`MCP server connected: ${serverName}`);
    });

    this.mcpBridge.on('server:disconnected', (serverName: string) => {
      console.log(`MCP server disconnected: ${serverName}`);
    });
  }

  async getAgents(): Promise<Agent[]> {
    return this.storage.getAllAgents();
  }

  async getTasks(): Promise<Task[]> {
    return this.storage.getAllTasks();
  }

  async delegateTask(task: Task, agentType: AgentType): Promise<Task> {
    const agent = await this.orchestrator.findAvailableAgent(agentType);
    if (!agent) {
      throw new Error(`No available agent of type ${agentType}`);
    }

    task.agentId = agent.id;
    task.status = 'assigned';
    task.startedAt = new Date();

    // Store the task
    await this.storage.saveTask(task);

    // Send to agent
    await this.orchestrator.delegateTask(agent.id, task);

    return task;
  }

  async handleMessage(message: AgentMessage): Promise<void> {
    // Route message through appropriate components
    if (message.type === 'task_delegation') {
      await this.boomerangManager.handleTaskDelegation(message);
    } else if (message.type === 'task_completion') {
      await this.orchestrator.handleTaskCompletion(message);
    } else if (message.type === 'knowledge_share') {
      await this.mcpBridge.handleKnowledgeShare(message);
    }

    // Log the message
    await this.storage.logMessage(message);
  }

  async executeSPARCWorkflow(projectDescription: string): Promise<any> {
    return this.sparcManager.createWorkflow(projectDescription);
  }

  async sendBoomerangTask(task: Task, targetAgent: string): Promise<void> {
    await this.boomerangManager.sendBoomerang(task, targetAgent);
  }

  async shutdown(): Promise<void> {
    console.log('Shutting down Agent Swarm Server...');
    
    // Clean up resources
    await this.storage.close();
    await this.mcpBridge.close();
    await this.lifecycleManager.shutdown();
    await this.sparcManager.shutdown();
    await this.boomerangManager.shutdown();
    
    this.initialized = false;
    console.log('Agent Swarm Server shutdown complete');
  }
}

// Initialize server
const server = new Server(
  {
    name: 'agent-swarm',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

const agentSwarm = new AgentSwarmServer();

// Define MCP tools
const tools: Tool[] = [
  {
    name: 'list_agents',
    description: 'List all available agents in the swarm',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['idle', 'busy', 'learning', 'error', 'maintenance'],
          description: 'Filter agents by status',
        },
        type: {
          type: 'string',
          enum: ['research', 'architect', 'implementation', 'testing', 'review', 'documentation', 'debugger'],
          description: 'Filter agents by type',
        },
      },
    },
  },
  {
    name: 'get_agent_status',
    description: 'Get detailed status information for a specific agent',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description: 'Agent ID to get status for',
        },
      },
      required: ['agentId'],
    },
  },
  {
    name: 'delegate_task',
    description: 'Delegate a task to a specialized agent',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Unique task identifier',
        },
        description: {
          type: 'string',
          description: 'Task description',
        },
        agentType: {
          type: 'string',
          enum: ['research', 'architect', 'implementation', 'testing', 'review', 'documentation', 'debugger'],
          description: 'Target agent type for this task',
        },
        priority: {
          type: 'number',
          description: 'Task priority (0-4)',
          default: 1,
        },
        dependencies: {
          type: 'array',
          items: { type: 'string' },
          description: 'Task dependencies',
          default: [],
        },
      },
      required: ['taskId', 'description', 'agentType'],
    },
  },
  {
    name: 'get_task_status',
    description: 'Get the status of a specific task',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Task ID to get status for',
        },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'list_tasks',
    description: 'List all tasks with optional filtering',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'assigned', 'running', 'completed', 'failed', 'cancelled'],
          description: 'Filter tasks by status',
        },
        agentType: {
          type: 'string',
          enum: ['research', 'architect', 'implementation', 'testing', 'review', 'documentation', 'debugger'],
          description: 'Filter tasks by agent type',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of tasks to return',
          default: 50,
        },
      },
    },
  },
  {
    name: 'create_agent_team',
    description: 'Create a team of agents for coordinated work',
    inputSchema: {
      type: 'object',
      properties: {
        teamName: {
          type: 'string',
          description: 'Name of the agent team',
        },
        teamType: {
          type: 'string',
          enum: ['research', 'development', 'review', 'mixed'],
          description: 'Type of team',
        },
        agentTypes: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['research', 'architect', 'implementation', 'testing', 'review', 'documentation', 'debugger'],
          },
          description: 'Types of agents to include in team',
        },
        description: {
          type: 'string',
          description: 'Team description',
        },
      },
      required: ['teamName', 'teamType', 'agentTypes'],
    },
  },
  {
    name: 'execute_sparc_workflow',
    description: 'Execute a complete SPARC workflow (Specification → Pseudocode → Architecture → Refinement → Completion)',
    inputSchema: {
      type: 'object',
      properties: {
        projectDescription: {
          type: 'string',
          description: 'High-level project description',
        },
        requirements: {
          type: 'array',
          items: { type: 'string' },
          description: 'Project requirements',
        },
        constraints: {
          type: 'array',
          items: { type: 'string' },
          description: 'Project constraints',
        },
      },
      required: ['projectDescription'],
    },
  },
  {
    name: 'send_boomerang_task',
    description: 'Send a task back to a previous agent for refinement (boomerang pattern)',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Task ID to send back',
        },
        targetAgent: {
          type: 'string',
          description: 'Target agent ID or type',
        },
        feedback: {
          type: 'string',
          description: 'Feedback for refinement',
        },
        priority: {
          type: 'number',
          description: 'Priority for the boomerang task',
          default: 2,
        },
      },
      required: ['taskId', 'targetAgent', 'feedback'],
    },
  },
  {
    name: 'integrate_with_mcp_server',
    description: 'Integrate with an existing MCP server for enhanced capabilities',
    inputSchema: {
      type: 'object',
      properties: {
        serverName: {
          type: 'string',
          description: 'Name of the MCP server to integrate with',
        },
        serverType: {
          type: 'string',
          enum: ['task_orchestrator', 'context_persistence', 'search_aggregator', 'skills_manager'],
          description: 'Type of MCP server',
        },
        autoDelegate: {
          type: 'boolean',
          description: 'Whether to automatically delegate appropriate tasks',
          default: true,
        },
      },
      required: ['serverName', 'serverType'],
    },
  },
  {
    name: 'get_agent_capabilities',
    description: 'Get the capabilities and specializations of a specific agent type',
    inputSchema: {
      type: 'object',
      properties: {
        agentType: {
          type: 'string',
          enum: ['research', 'architect', 'implementation', 'testing', 'review', 'documentation', 'debugger'],
          description: 'Agent type to get capabilities for',
        },
      },
      required: ['agentType'],
    },
  },
  {
    name: 'share_knowledge',
    description: 'Share knowledge between agents in the swarm',
    inputSchema: {
      type: 'object',
      properties: {
        fromAgentId: {
          type: 'string',
          description: 'Source agent ID',
        },
        toAgentId: {
          type: 'string',
          description: 'Target agent ID (optional, for broadcast leave empty)',
        },
        knowledgeType: {
          type: 'string',
          description: 'Type of knowledge being shared',
        },
        content: {
          type: 'object',
          description: 'Knowledge content',
        },
        context: {
          type: 'object',
          description: 'Context information',
        },
      },
      required: ['fromAgentId', 'knowledgeType', 'content'],
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
    // Ensure agent swarm is initialized
    if (!agentSwarm) {
      throw new Error('Agent Swarm Server not initialized');
    }

    switch (name) {
      case 'list_agents': {
        const agents = await agentSwarm.getAgents();
        const filteredAgents = agents.filter(agent => {
          if (args?.status && agent.status !== args.status) return false;
          if (args?.type && agent.type !== args.type) return false;
          return true;
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                agents: filteredAgents.map(agent => ({
                  id: agent.id,
                  name: agent.name,
                  type: agent.type,
                  status: agent.status,
                  capabilities: agent.capabilities,
                  currentTasks: agent.currentTasks.length,
                  lastActive: agent.lastActive,
                })),
                count: filteredAgents.length,
              }, null, 2),
            },
          ],
        };
      }

      case 'get_agent_status': {
        const agents = await agentSwarm.getAgents();
        const agent = agents.find(a => a.id === args?.agentId);
        
        if (!agent) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: `Agent ${args?.agentId} not found` }),
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                agent: {
                  id: agent.id,
                  name: agent.name,
                  type: agent.type,
                  status: agent.status,
                  capabilities: agent.capabilities,
                  currentTasks: agent.currentTasks,
                  performanceMetrics: agent.performanceMetrics,
                  learningData: agent.learningData,
                  createdAt: agent.createdAt,
                  lastActive: agent.lastActive,
                },
              }, null, 2),
            },
          ],
        };
      }

      case 'delegate_task': {
        const task: Task = {
          id: args?.taskId,
          type: args?.agentType,
          description: args?.description,
          status: 'pending',
          priority: args?.priority || 1,
          dependencies: args?.dependencies || [],
        };

        const delegatedTask = await agentSwarm.delegateTask(task, args?.agentType);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                task: {
                  id: delegatedTask.id,
                  status: delegatedTask.status,
                  agentId: delegatedTask.agentId,
                  startedAt: delegatedTask.startedAt,
                },
                message: `Task delegated to agent successfully`,
              }, null, 2),
            },
          ],
        };
      }

      case 'get_task_status': {
        const tasks = await agentSwarm.getTasks();
        const task = tasks.find(t => t.id === args?.taskId);
        
        if (!task) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: `Task ${args?.taskId} not found` }),
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                task: {
                  id: task.id,
                  status: task.status,
                  agentId: task.agentId,
                  type: task.type,
                  description: task.description,
                  priority: task.priority,
                  startedAt: task.startedAt,
                  completedAt: task.completedAt,
                  executionTime: task.executionTime,
                  errorMessage: task.errorMessage,
                  resultQuality: task.resultQuality,
                },
              }, null, 2),
            },
          ],
        };
      }

      case 'list_tasks': {
        const tasks = await agentSwarm.getTasks();
        const filteredTasks = tasks.filter(task => {
          if (args?.status && task.status !== args.status) return false;
          if (args?.agentType && task.type !== args.agentType) return false;
          return true;
        }).slice(0, args?.limit || 50);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                tasks: filteredTasks.map(task => ({
                  id: task.id,
                  status: task.status,
                  agentId: task.agentId,
                  type: task.type,
                  description: task.description,
                  priority: task.priority,
                  startedAt: task.startedAt,
                  completedAt: task.completedAt,
                })),
                count: filteredTasks.length,
              }, null, 2),
            },
          ],
        };
      }

      case 'create_agent_team': {
        // Implementation for creating agent teams
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                message: 'Agent team creation not yet implemented',
                teamName: args?.teamName,
                teamType: args?.teamType,
                agentTypes: args?.agentTypes,
              }, null, 2),
            },
          ],
        };
      }

      case 'execute_sparc_workflow': {
        const result = await agentSwarm.executeSPARCWorkflow(args?.projectDescription);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                workflow: result,
                message: 'SPARC workflow initiated',
              }, null, 2),
            },
          ],
        };
      }

      case 'send_boomerang_task': {
        const tasks = await agentSwarm.getTasks();
        const task = tasks.find(t => t.id === args?.taskId);
        
        if (!task) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: `Task ${args?.taskId} not found` }),
              },
            ],
            isError: true,
          };
        }

        await agentSwarm.sendBoomerangTask(task, args?.targetAgent);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                message: 'Boomerang task sent successfully',
                taskId: args?.taskId,
                targetAgent: args?.targetAgent,
              }, null, 2),
            },
          ],
        };
      }

      case 'integrate_with_mcp_server': {
        const config: IntegrationConfig = {
          type: args?.serverType,
          enabled: true,
          autoDelegate: args?.autoDelegate || true,
          delegationRules: {},
          timeout: 30000,
          retryAttempts: 3,
        };

        // Implementation for MCP server integration
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                message: 'MCP server integration not yet fully implemented',
                serverName: args?.serverName,
                serverType: args?.serverType,
                config,
              }, null, 2),
            },
          ],
        };
      }

      case 'get_agent_capabilities': {
        // Return capabilities for the specified agent type
        const capabilities = {
          research: [
            'Information gathering and analysis',
            'Literature review and synthesis',
            'Data collection and processing',
            'Competitive intelligence',
            'Trend analysis',
          ],
          architect: [
            'System design and architecture',
            'Technical specification creation',
            'Solution planning and optimization',
            'Integration planning',
            'Performance modeling',
          ],
          implementation: [
            'Code development and implementation',
            'Algorithm design and optimization',
            'System integration',
            'API development',
            'Database design and optimization',
          ],
          testing: [
            'Test strategy development',
            'Test case creation and execution',
            'Quality assurance',
            'Performance testing',
            'Security testing',
          ],
          review: [
            'Code review and analysis',
            'Quality assessment',
            'Best practice enforcement',
            'Compliance checking',
            'Risk assessment',
          ],
          documentation: [
            'Technical documentation creation',
            'User guide development',
            'API documentation',
            'Process documentation',
            'Knowledge base creation',
          ],
          debugger: [
            'Problem diagnosis and analysis',
            'Error identification and resolution',
            'Performance optimization',
            'System monitoring',
            'Root cause analysis',
          ],
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                agentType: args?.agentType,
                capabilities: capabilities[args?.agentType] || [],
                description: `${args?.agentType} agent specialized capabilities`,
              }, null, 2),
            },
          ],
        };
      }

      case 'share_knowledge': {
        const message: AgentMessage = {
          id: `msg_${Date.now()}`,
          from: args?.fromAgentId,
          to: args?.toAgentId,
          type: 'knowledge_share',
          priority: 1,
          timestamp: new Date(),
          content: {
            knowledgeType: args?.knowledgeType,
            content: args?.content,
            context: args?.context,
          },
          context: {
            priority: 1,
            timestamp: Date.now(),
          },
          requiresResponse: false,
          retryCount: 0,
          maxRetries: 3,
        };

        await agentSwarm.handleMessage(message);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                message: 'Knowledge shared successfully',
                fromAgent: args?.fromAgentId,
                toAgent: args?.toAgentId || 'broadcast',
                knowledgeType: args?.knowledgeType,
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

// Cleanup on exit
process.on('SIGINT', () => {
  agentSwarm.shutdown().catch(console.error);
  process.exit(0);
});

process.on('SIGTERM', () => {
  agentSwarm.shutdown().catch(console.error);
  process.exit(0);
});

// Start server
async function main() {
  try {
    // Initialize agent swarm
    await agentSwarm.initialize();
    
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Agent Swarm MCP Server running on stdio');
  } catch (error) {
    console.error('Failed to start Agent Swarm MCP Server:', error);
    process.exit(1);
  }
}

main().catch(console.error);