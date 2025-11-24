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
import { join, dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

// Resolve project root (agent-swarm is at src/mcp-servers/agent-swarm)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..', '..', '..');

// Import types
import {
  Agent,
  Task,
  AgentMessage,
  AgentType,
  TaskStatus,
  MessageType,
  MessagePriority,
  IntegrationConfig,
  IntegrationType
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
import { MCPClient, MCPCommandConfig } from './integration/mcp-client.js';
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
    this.sparcManager = new SPARCWorkflowManager(this.storage);
    this.boomerangManager = new BoomerangTaskManager(this.storage);
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

    this.boomerangManager.on('boomerang:returned', (taskId: string, _result: any) => {
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

  async sendBoomerangTask(task: Task, targetAgent: string, feedback: string = 'auto-feedback'): Promise<void> {
    await this.boomerangManager.sendBoomerang(task, targetAgent, feedback);
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

type RouteTarget = 'search-aggregator' | 'task-orchestrator' | 'context7' | 'mcp-code-checker';

// Build paths relative to project root (external MCPs are inside src/mcp-servers/external/)
const INTERNAL_MCP_BASE = join(PROJECT_ROOT, 'src', 'mcp-servers');
const EXTERNAL_MCP_BASE = join(INTERNAL_MCP_BASE, 'external');

function getRouteConfig(target: RouteTarget): MCPCommandConfig | null {
  switch (target) {
    case 'search-aggregator':
      return {
        command: process.env.SEARCH_MCP_CMD || 'node',
        args: (process.env.SEARCH_MCP_ARGS?.split(' ')) ||
              [join(INTERNAL_MCP_BASE, 'search-aggregator', 'dist', 'index.js')],
      };
    case 'task-orchestrator':
      return {
        command: process.env.TASK_MCP_CMD || 'node',
        args: (process.env.TASK_MCP_ARGS?.split(' ')) ||
              [join(INTERNAL_MCP_BASE, 'task-orchestrator', 'dist', 'index.js')],
      };
    case 'context7': {
      const path = process.env.CONTEXT7_MCP_ARGS?.split(' ')?.[0] ||
                   join(EXTERNAL_MCP_BASE, 'context7', 'dist', 'index.js');
      if (!existsSync(path)) return null; // Not installed
      return {
        command: process.env.CONTEXT7_MCP_CMD || 'node',
        args: [path],
      };
    }
    case 'mcp-code-checker': {
      // Python MCP server for code quality checks (pylint, pytest, mypy)
      // Check if mcp-code-checker is available in PATH (installed via pip)
      const projectDir = process.env.MCP_CODE_CHECKER_PROJECT_DIR || process.cwd();
      return {
        command: process.env.MCP_CODE_CHECKER_CMD || 'mcp-code-checker',
        args: ['--project-dir', projectDir],
      };
    }
    default:
      return null;
  }
}

// Check which external MCPs are available
const EXTERNAL_MCP_STATUS = {
  'context7': existsSync(join(EXTERNAL_MCP_BASE, 'context7', 'dist', 'index.js')),
  'mcp-code-checker': true, // Installed via pip, check happens at runtime
};

// Log availability on startup
console.error('External MCP availability:', JSON.stringify(EXTERNAL_MCP_STATUS));

function pickRoute(goal: string, category?: string): RouteTarget {
  const text = `${goal} ${category || ''}`.toLowerCase();

  // Documentation lookup via context7
  if (text.includes('doc') || text.includes('manual') || text.includes('spec') || text.includes('documentation') || text.includes('reference')) {
    return 'context7';
  }

  // Code quality checks via mcp-code-checker
  if (text.includes('lint') || text.includes('pylint') || text.includes('pytest') ||
      text.includes('mypy') || text.includes('type check') || text.includes('code quality') ||
      text.includes('run tests') || text.includes('check code') || text.includes('analyze code')) {
    return 'mcp-code-checker';
  }

  // Web search via search-aggregator
  if (text.includes('search') || text.includes('web') || text.includes('lookup') || text.includes('find')) {
    return 'search-aggregator';
  }

  // Default to task orchestrator for non-search work
  return 'task-orchestrator';
}

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
    name: 'route_plan',
    description: 'Plan which MCP server will be used for a given goal',
    inputSchema: {
      type: 'object',
      properties: {
        goal: { type: 'string', description: 'User goal or task' },
        category: { type: 'string', description: 'Optional hint: search, code, task, git, etc.' },
      },
      required: ['goal'],
    },
  },
  {
    name: 'delegate',
    description: 'Delegate a goal to the appropriate MCP server (search or task) and return the result',
    inputSchema: {
      type: 'object',
      properties: {
        goal: { type: 'string', description: 'User goal or query' },
        category: { type: 'string', description: 'Optional hint for routing: search, task, code, git' },
        limit: { type: 'number', description: 'Max search results (for search routes)', default: 5 },
      },
      required: ['goal'],
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
  const { name } = request.params;
  const args = request.params.arguments as Record<string, any> | undefined;

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
        const requestedAgentType = args?.agentType as AgentType | undefined;
        if (!requestedAgentType) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: 'agentType is required' }),
              },
            ],
            isError: true,
          };
        }

        const task: Task = {
          id: args?.taskId || `task_${Date.now()}`,
          type: requestedAgentType,
          description: args?.description || 'Autogenerated task',
          status: 'pending',
          priority: args?.priority || 1,
          dependencies: args?.dependencies || [],
          createdAt: new Date(),
        };

        const delegatedTask = await agentSwarm.delegateTask(task, requestedAgentType);

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

      case 'route_plan': {
        const route = pickRoute(args?.goal as string, args?.category as string | undefined);
        const config = getRouteConfig(route);
        const toolMap: Record<RouteTarget, string> = {
          'search-aggregator': 'search',
          'task-orchestrator': 'create_task',
          'context7': 'resolve-library-id',
          'mcp-code-checker': 'run_all_checks',
        };
        const tool = toolMap[route];

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                goal: args?.goal,
                category: args?.category,
                route,
                tool,
                available: !!config,
                serverPath: config ? 'configured' : 'not found',
                externalMcpStatus: EXTERNAL_MCP_STATUS,
              }, null, 2),
            },
          ],
        };
      }

      case 'delegate': {
        const route = pickRoute(args?.goal as string, args?.category as string | undefined);
        const targetConfig = getRouteConfig(route);

        // Require proper configuration - no fallbacks
        if (!targetConfig) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: `MCP server '${route}' is not configured or not found`,
                  route,
                  suggestion: route === 'context7'
                    ? 'Run: ./scripts/setup-external-mcps.sh to install external MCP servers'
                    : 'Check server installation and rebuild agent-swarm',
                  externalMcpStatus: EXTERNAL_MCP_STATUS,
                }),
              },
            ],
            isError: true,
          };
        }

        const client = new MCPClient(targetConfig);

        try {
          if (route === 'search-aggregator') {
            const result = await client.callTool('search', {
              query: args?.goal,
              limit: args?.limit || 5,
              use_cache: true,
            });
            return { content: result.content };
          }


          if (route === 'context7') {
            // context7 tools: resolve-library-id, get-library-docs
            // First resolve the library, then get docs
            const resolveResult = await client.callTool('resolve-library-id', {
              libraryName: args?.goal,
            });
            return { content: resolveResult.content };
          }

          if (route === 'mcp-code-checker') {
            // mcp-code-checker tools: run_pylint_check, run_pytest_check, run_mypy_check, run_all_checks
            // Determine which check to run based on the goal
            const goalLower = (args?.goal as string).toLowerCase();
            let toolName = 'run_all_checks'; // Default to comprehensive check
            const toolArgs: Record<string, any> = {};

            if (goalLower.includes('pylint') || goalLower.includes('lint')) {
              toolName = 'run_pylint_check';
              toolArgs.categories = ['error', 'fatal', 'warning'];
            } else if (goalLower.includes('pytest') || goalLower.includes('test')) {
              toolName = 'run_pytest_check';
              toolArgs.verbosity = 2;
            } else if (goalLower.includes('mypy') || goalLower.includes('type')) {
              toolName = 'run_mypy_check';
              toolArgs.strict = true;
            }

            const result = await client.callTool(toolName, toolArgs);
            return { content: result.content };
          }

          // task-orchestrator fallback
          const result = await client.callTool('create_task', {
            title: args?.goal,
            description: args?.goal,
            priority: 1,
            dependencies: [],
            tags: ['swarm', 'delegated'],
          });
          return { content: result.content };

        } catch (err) {
          // Handle MCP call failures gracefully
          const errorMsg = err instanceof Error ? err.message : String(err);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  status: 'error',
                  route,
                  error: errorMsg,
                  suggestion: route === 'context7'
                    ? 'External MCP may not be running. Check installation with: ./scripts/setup-external-mcps.sh'
                    : 'Internal MCP server error. Check server logs.',
                }, null, 2),
              },
            ],
            isError: true,
          };
        }
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

        const targetAgent = args?.targetAgent;
        if (!targetAgent) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: 'targetAgent is required' }),
              },
            ],
            isError: true,
          };
        }

        await agentSwarm.sendBoomerangTask(task, targetAgent, args?.feedback || 'auto-feedback');

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
        const serverType = args?.serverType as IntegrationType | undefined;
        if (!serverType) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: 'serverType is required' }),
              },
            ],
            isError: true,
          };
        }

        const config: IntegrationConfig = {
          type: serverType,
          enabled: true,
          autoDelegate: args?.autoDelegate ?? true,
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
