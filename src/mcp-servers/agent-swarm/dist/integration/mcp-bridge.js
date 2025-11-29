import { EventEmitter } from 'eventemitter3';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { MCPClient } from './mcp-client.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const MCP_SERVERS_DIR = join(PROJECT_ROOT, 'src', 'mcp-servers');
const GO_SERVERS_DIR = join(PROJECT_ROOT, 'MCP_structure_design', 'mcp-servers-go', 'dist');
function getServerCommandConfig(serverType) {
    const homedir = process.env.HOME || '/tmp';
    switch (serverType) {
        case 'task_orchestrator':
            return {
                command: 'node',
                args: [join(MCP_SERVERS_DIR, 'task-orchestrator', 'dist', 'index.js')],
                env: {
                    TASKS_DB: join(homedir, '.mcp', 'tasks', 'tasks.db'),
                },
            };
        case 'context_persistence':
            const venvPython = join(MCP_SERVERS_DIR, 'context-persistence', 'venv3.12', 'bin', 'python3');
            const pythonCmd = existsSync(venvPython) ? venvPython : 'python3';
            return {
                command: pythonCmd,
                args: ['-m', 'context_persistence.server'],
                env: {
                    PYTHONPATH: join(MCP_SERVERS_DIR, 'context-persistence', 'src'),
                    CONTEXT_DB: join(homedir, '.mcp', 'context', 'db', 'conversation.db'),
                    QDRANT_PATH: join(homedir, '.mcp', 'context', 'qdrant'),
                },
            };
        case 'search_aggregator':
            return {
                command: 'node',
                args: [join(MCP_SERVERS_DIR, 'search-aggregator', 'dist', 'index.js')],
                env: {
                    PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY || '',
                    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
                    BRAVE_API_KEY: process.env.BRAVE_API_KEY || '',
                },
            };
        case 'skills_manager':
            return {
                command: join(GO_SERVERS_DIR, 'skills-manager'),
                args: ['-db', join(homedir, '.mcp', 'skills', 'skills.db')],
                env: {
                    SKILLS_DB_PATH: join(homedir, '.mcp', 'skills', 'skills.db'),
                },
            };
        default:
            return null;
    }
}
export class MCPServerBridge extends EventEmitter {
    storage;
    connections = new Map();
    serverConfigs = new Map();
    healthCheckInterval = null;
    constructor(storage) {
        super();
        this.storage = storage;
        this.initializeServerConfigs();
    }
    initializeServerConfigs() {
        this.serverConfigs.set('task_orchestrator', {
            type: 'task_orchestrator',
            enabled: true,
            autoDelegate: true,
            delegationRules: {
                taskTypes: ['implementation', 'testing', 'debugger'],
                languages: ['javascript', 'typescript', 'python', 'bash', 'sql'],
                priorityThreshold: 2,
            },
            timeout: 300000,
            retryAttempts: 3,
        });
        this.serverConfigs.set('context_persistence', {
            type: 'context_persistence',
            enabled: true,
            autoDelegate: false,
            delegationRules: {
                memoryTypes: ['long_term', 'shared', 'context'],
                semanticSearch: true,
                vectorStorage: true,
            },
            timeout: 60000,
            retryAttempts: 2,
        });
        this.serverConfigs.set('search_aggregator', {
            type: 'search_aggregator',
            enabled: true,
            autoDelegate: true,
            delegationRules: {
                agentTypes: ['research', 'ask', 'deep_research'],
                providers: ['perplexity', 'brave', 'google', 'duckduckgo'],
                cacheResults: true,
            },
            timeout: 120000,
            retryAttempts: 3,
        });
        this.serverConfigs.set('skills_manager', {
            type: 'skills_manager',
            enabled: true,
            autoDelegate: false,
            delegationRules: {
                skillTracking: true,
                learningUpdate: true,
                capabilityMapping: true,
            },
            timeout: 45000,
            retryAttempts: 2,
        });
    }
    async initialize() {
        try {
            await this.discoverServers();
            this.startHealthMonitoring();
            console.error('MCP Server Bridge initialized with real connections');
        }
        catch (error) {
            console.error('Failed to initialize MCP Server Bridge:', error);
            throw error;
        }
    }
    async discoverServers() {
        const serverTypes = ['task_orchestrator', 'context_persistence', 'search_aggregator', 'skills_manager'];
        for (const serverType of serverTypes) {
            try {
                const connection = await this.createServerConnection(serverType);
                if (connection) {
                    this.connections.set(serverType, connection);
                    this.emit('server:connected', serverType);
                    console.error(`Connected to ${serverType}`);
                }
            }
            catch (error) {
                console.error(`Failed to connect to ${serverType}:`, error);
                this.emit('server:connection_failed', serverType, error);
            }
        }
    }
    async createServerConnection(serverType) {
        const config = this.serverConfigs.get(serverType);
        const commandConfig = getServerCommandConfig(serverType);
        if (!config || !commandConfig) {
            console.error(`No configuration found for server type: ${serverType}`);
            return null;
        }
        const serverPath = commandConfig.args[0];
        if (serverPath && !serverPath.startsWith('-') && !existsSync(serverPath)) {
            console.error(`Server not found at ${serverPath}`);
            return null;
        }
        const connection = {
            name: serverType,
            type: serverType,
            status: 'connecting',
            lastPing: new Date(),
            responseTime: 0,
            capabilities: this.getServerCapabilities(serverType),
            config,
            commandConfig,
            health: {
                status: 'unhealthy',
                responseTime: 0,
                errorRate: 0,
                lastCheck: new Date(),
                issues: [],
            },
        };
        try {
            const healthCheck = await this.pingServer(serverType, commandConfig);
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
            }
            else {
                connection.status = 'error';
                connection.health.issues.push(healthCheck.error || 'Connection failed');
            }
        }
        catch (error) {
            connection.status = 'error';
            connection.health.issues.push(error instanceof Error ? error.message : String(error));
        }
        return connection;
    }
    getServerCapabilities(serverType) {
        const capabilities = {
            'task_orchestrator': [
                'create_task', 'update_task_status', 'get_task', 'list_tasks',
                'execute_code', 'execute_python_code', 'execute_javascript_code',
                'analyze_code_quality', 'get_task_graph',
            ],
            'context_persistence': [
                'save_conversation', 'load_conversation_history',
                'search_similar_conversations', 'save_decision', 'get_conversation_stats',
            ],
            'search_aggregator': [
                'search', 'get_available_providers', 'clear_cache',
            ],
            'skills_manager': [
                'add_skill', 'get_skill', 'list_skills', 'update_skill_level', 'get_skill_stats',
            ],
        };
        return capabilities[serverType] || [];
    }
    async pingServer(serverType, commandConfig) {
        const startTime = Date.now();
        try {
            const client = new MCPClient(commandConfig);
            const testTool = this.getTestTool(serverType);
            await client.callTool(testTool.name, testTool.args);
            const responseTime = Date.now() - startTime;
            return { success: true, responseTime };
        }
        catch (error) {
            return {
                success: false,
                responseTime: Date.now() - startTime,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    getTestTool(serverType) {
        switch (serverType) {
            case 'task_orchestrator':
                return { name: 'list_tasks', args: { limit: 1 } };
            case 'context_persistence':
                return { name: 'get_conversation_stats', args: {} };
            case 'search_aggregator':
                return { name: 'get_available_providers', args: {} };
            case 'skills_manager':
                return { name: 'get_skill_stats', args: {} };
            default:
                return { name: 'list_tasks', args: { limit: 1 } };
        }
    }
    async callServerTool(serverType, toolName, args) {
        const connection = this.connections.get(serverType);
        if (!connection || connection.status !== 'connected') {
            throw new Error(`Server ${serverType} is not available`);
        }
        const startTime = Date.now();
        try {
            const client = new MCPClient(connection.commandConfig);
            const result = await client.callTool(toolName, args);
            const responseTime = Date.now() - startTime;
            this.updateServerHealth(serverType, true, responseTime);
            return result;
        }
        catch (error) {
            this.updateServerHealth(serverType, false, 0, error);
            throw error;
        }
    }
    async delegateTaskToServer(serverType, request) {
        const connection = this.connections.get(serverType);
        if (!connection || connection.status !== 'connected') {
            throw new Error(`Server ${serverType} is not available`);
        }
        const messageId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await this.logMessage({
            id: messageId,
            from: 'agent-swarm',
            to: serverType,
            type: 'task_delegation',
            payload: request,
            timestamp: new Date(),
            requiresResponse: true,
            correlationId: request.taskId,
            priority: request.priority,
        });
        let toolName;
        let toolArgs;
        switch (request.taskType) {
            case 'code_execution':
                toolName = 'execute_code';
                toolArgs = {
                    code: request.parameters.code,
                    language: request.parameters.language || 'javascript',
                    timeout: request.timeout,
                };
                break;
            case 'task_creation':
                toolName = 'create_task';
                toolArgs = {
                    title: request.parameters.title,
                    description: request.parameters.description,
                    priority: request.priority,
                    tags: request.parameters.tags || [],
                };
                break;
            case 'search':
                toolName = 'search';
                toolArgs = {
                    query: request.parameters.query,
                    limit: request.parameters.limit || 5,
                    use_cache: true,
                };
                break;
            default:
                toolName = 'create_task';
                toolArgs = request.parameters;
        }
        return this.callServerTool(serverType, toolName, toolArgs);
    }
    async queryServerData(serverType, request) {
        const connection = this.connections.get(serverType);
        if (!connection || connection.status !== 'connected') {
            throw new Error(`Server ${serverType} is not available`);
        }
        let toolName;
        let toolArgs;
        switch (request.resultType) {
            case 'tasks':
                toolName = 'list_tasks';
                toolArgs = { limit: request.limit, ...request.filters };
                break;
            case 'knowledge':
                toolName = 'search_similar_conversations';
                toolArgs = { query: request.query, limit: request.limit };
                break;
            default:
                toolName = 'list_tasks';
                toolArgs = { limit: request.limit };
        }
        return this.callServerTool(serverType, toolName, toolArgs);
    }
    async shareKnowledgeWithServer(serverType, knowledge) {
        const connection = this.connections.get(serverType);
        if (!connection || connection.status !== 'connected') {
            throw new Error(`Server ${serverType} is not available`);
        }
        if (serverType === 'context_persistence') {
            await this.callServerTool('context_persistence', 'save_conversation', {
                conversation_id: knowledge.conversationId || `knowledge_${Date.now()}`,
                messages: [{ role: 'system', content: JSON.stringify(knowledge.content) }],
                metadata: knowledge.metadata,
            });
        }
    }
    async handleKnowledgeShare(message) {
        const knowledgeData = message.content;
        if (this.connections.has('context_persistence')) {
            try {
                await this.shareKnowledgeWithServer('context_persistence', {
                    conversationId: `agent_knowledge_${message.from}_${Date.now()}`,
                    content: knowledgeData,
                    metadata: {
                        agentId: message.from,
                        timestamp: message.timestamp,
                        source: 'agent-swarm',
                    },
                });
            }
            catch (error) {
                console.error('Failed to share knowledge with context_persistence:', error);
            }
        }
        if (this.connections.has('skills_manager') && knowledgeData.skillUpdate) {
            try {
                await this.callServerTool('skills_manager', 'update_skill_level', {
                    skill_id: knowledgeData.skillUpdate.skillId,
                    new_level: knowledgeData.skillUpdate.level,
                });
            }
            catch (error) {
                console.error('Failed to update skill:', error);
            }
        }
    }
    async logMessage(message) {
        try {
            await this.storage.logMessage({
                id: `cross_server_${message.id}`,
                from: message.from,
                to: message.to,
                type: 'knowledge_share',
                priority: message.priority,
                timestamp: message.timestamp,
                content: message.payload,
                context: {
                    taskId: message.correlationId,
                    agentType: 'integration',
                    priority: message.priority,
                    timestamp: Date.now(),
                },
                requiresResponse: message.requiresResponse,
                retryCount: 0,
                maxRetries: 3,
            });
        }
        catch (error) {
            console.error('Failed to log cross-server message:', error);
        }
    }
    startHealthMonitoring() {
        this.healthCheckInterval = setInterval(async () => {
            for (const [serverType, connection] of this.connections) {
                try {
                    const healthCheck = await this.pingServer(serverType, connection.commandConfig);
                    connection.lastPing = new Date();
                    connection.responseTime = healthCheck.responseTime;
                    if (healthCheck.success) {
                        connection.status = 'connected';
                        this.updateServerHealth(serverType, true, healthCheck.responseTime);
                    }
                    else {
                        connection.status = 'error';
                        this.updateServerHealth(serverType, false, 0, new Error(healthCheck.error));
                    }
                }
                catch (error) {
                    connection.status = 'error';
                    this.updateServerHealth(serverType, false, 0, error);
                }
            }
        }, 60000);
    }
    updateServerHealth(serverType, success, responseTime, error) {
        const connection = this.connections.get(serverType);
        if (!connection)
            return;
        connection.health.lastCheck = new Date();
        connection.health.responseTime = responseTime;
        if (success) {
            connection.health.status = 'healthy';
            connection.health.errorRate = Math.max(0, connection.health.errorRate - 0.1);
            connection.health.issues = connection.health.issues.filter(issue => !issue.includes('connection'));
        }
        else {
            connection.health.errorRate = Math.min(1, connection.health.errorRate + 0.2);
            connection.health.status = connection.health.errorRate > 0.5 ? 'unhealthy' : 'degraded';
            if (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                if (!connection.health.issues.includes(errorMessage)) {
                    connection.health.issues.push(errorMessage);
                    if (connection.health.issues.length > 5) {
                        connection.health.issues = connection.health.issues.slice(-5);
                    }
                }
            }
        }
    }
    async getConnectedServers() {
        return Array.from(this.connections.values());
    }
    async getServerStatus(serverType) {
        return this.connections.get(serverType) || null;
    }
    async getServerHealth(serverType) {
        const connection = this.connections.get(serverType);
        return connection ? connection.health : null;
    }
    async reconnectServer(serverType) {
        try {
            const connection = await this.createServerConnection(serverType);
            if (connection && connection.status === 'connected') {
                this.connections.set(serverType, connection);
                this.emit('server:reconnected', serverType);
                return true;
            }
            return false;
        }
        catch (error) {
            console.error(`Failed to reconnect to ${serverType}:`, error);
            this.emit('server:reconnection_failed', serverType, error);
            return false;
        }
    }
    async disconnectServer(serverType) {
        const connection = this.connections.get(serverType);
        if (connection) {
            connection.status = 'disconnected';
            this.emit('server:disconnected', serverType);
        }
    }
    async getIntegrationStatistics() {
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
            serverDetails: servers.map(s => ({
                name: s.name,
                status: s.status,
                health: s.health.status,
                responseTime: s.responseTime,
                capabilities: s.capabilities,
                lastPing: s.lastPing,
            })),
        };
    }
    async close() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        for (const serverType of this.connections.keys()) {
            await this.disconnectServer(serverType);
        }
        this.connections.clear();
        console.error('MCP Server Bridge closed');
    }
}
//# sourceMappingURL=mcp-bridge.js.map
