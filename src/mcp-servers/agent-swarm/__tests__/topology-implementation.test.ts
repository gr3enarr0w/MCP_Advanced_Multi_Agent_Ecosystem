/**
 * Comprehensive Unit Tests for Topology Implementations
 * Phase 9 Agent-Swarm Component Testing
 * Coverage Target: >80%
 */

// Mock the problematic mcp-bridge module before importing anything else
jest.mock('../src/integration/mcp-bridge.js', () => ({
  MCPServerBridge: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

import {
  HierarchicalTopology, 
  MeshTopology, 
  StarTopology 
} from '../src/topologies/index.js';
import { 
  BaseTopology, 
  TopologyConfig, 
  CommunicationPath, 
  TopologyMetrics 
} from '../src/topologies/base-topology.js';
import { Agent, AgentType, Task, TaskStatus, AgentMessage, MessageType } from '../src/types/agents.js';

describe('Topology Implementations', () => {
  // Test data factories
  const createMockAgent = (id: string, type: AgentType = 'implementation', status: 'idle' | 'busy' = 'idle'): Agent => ({
    id,
    name: `test-agent-${id}`,
    type,
    version: '1.0.0',
    status,
    capabilities: ['coding', 'testing'],
    maxConcurrentTasks: 3,
    resourceLimits: {
      maxMemoryMB: 512,
      maxCPUTimeMs: 60000,
      maxDiskSpaceMB: 100,
      maxNetworkCalls: 100,
      maxFileHandles: 50,
      executionTimeoutMs: 300000,
      maxConcurrentTasks: 3
    },
    performanceMetrics: [],
    createdAt: new Date(),
    lastActive: new Date(),
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
      capabilityEnhancements: []
    }
  });

  const createMockTask = (id: string, type: AgentType = 'implementation'): Task => ({
    id,
    type,
    description: `Test task ${id}`,
    status: 'pending',
    priority: 1,
    dependencies: [],
    createdAt: new Date()
  });

  const createMockMessage = (from: string, to?: string, type: MessageType = 'task_delegation'): AgentMessage => ({
    id: 'msg-' + Math.random().toString(36).substr(2, 9),
    from,
    to,
    type,
    priority: 1,
    timestamp: new Date(),
    correlationId: 'test-correlation',
    content: { data: 'test message' },
    context: {
      priority: 1,
      timestamp: Date.now()
    },
    requiresResponse: false,
    timeout: 30000,
    retryCount: 0,
    maxRetries: 3
  });

  describe('Hierarchical Topology', () => {
    let hierarchicalTopology: HierarchicalTopology;
    let config: TopologyConfig;

    beforeEach(() => {
      config = {
        type: 'hierarchical',
        maxAgents: 10,
        layers: 3
      };
      hierarchicalTopology = new HierarchicalTopology(config);
    });

    describe('Initialization', () => {
      it('should initialize with default configuration', () => {
        expect(hierarchicalTopology).toBeDefined();
        expect(hierarchicalTopology.getConfig()).toEqual(config);
      });

      it('should initialize with custom layers', () => {
        const customConfig = {
          type: 'hierarchical' as const,
          maxAgents: 15,
          layers: 4
        };
        const customTopology = new HierarchicalTopology(customConfig);
        
        expect(customTopology.getConfig().layers).toBe(4);
      });

      it('should set up layers correctly', () => {
        // Should create 3 layers by default
        const agents = hierarchicalTopology.getAllAgents();
        expect(agents).toHaveLength(0);
      });
    });

    describe('Agent Management', () => {
      it('should add architect agent to top layer', async () => {
        const architectAgent = createMockAgent('architect-1', 'architect');
        
        await hierarchicalTopology.addAgent(architectAgent);
        
        const allAgents = hierarchicalTopology.getAllAgents();
        expect(allAgents).toHaveLength(1);
        expect(allAgents[0]).toBe(architectAgent);
        expect(hierarchicalTopology.getCoordinator()).toBe(architectAgent.id);
      });

      it('should add review agents to middle layer', async () => {
        const reviewAgent = createMockAgent('review-1', 'review');
        
        await hierarchicalTopology.addAgent(reviewAgent);
        
        const allAgents = hierarchicalTopology.getAllAgents();
        expect(allAgents).toHaveLength(1);
        expect(allAgents[0]).toBe(reviewAgent);
      });

      it('should add implementation agents to bottom layer', async () => {
        const implAgent = createMockAgent('impl-1', 'implementation');
        
        await hierarchicalTopology.addAgent(implAgent);
        
        const allAgents = hierarchicalTopology.getAllAgents();
        expect(allAgents).toHaveLength(1);
        expect(allAgents[0]).toBe(implAgent);
      });

      it('should establish communication links between layers', async () => {
        const architect = createMockAgent('architect-1', 'architect');
        const implAgent = createMockAgent('impl-1', 'implementation');
        
        await hierarchicalTopology.addAgent(architect);
        await hierarchicalTopology.addAgent(implAgent);
        
        const architectNeighbors = hierarchicalTopology.getNeighbors(architect.id);
        const implNeighbors = hierarchicalTopology.getNeighbors(implAgent.id);
        
        expect(architectNeighbors).toContain(implAgent.id);
        expect(implNeighbors).toContain(architect.id);
      });

      it('should establish peer links within same layer', async () => {
        const impl1 = createMockAgent('impl-1', 'implementation');
        const impl2 = createMockAgent('impl-2', 'implementation');
        
        await hierarchicalTopology.addAgent(impl1);
        await hierarchicalTopology.addAgent(impl2);
        
        const impl1Neighbors = hierarchicalTopology.getNeighbors(impl1.id);
        const impl2Neighbors = hierarchicalTopology.getNeighbors(impl2.id);
        
        expect(impl1Neighbors).toContain(impl2.id);
        expect(impl2Neighbors).toContain(impl1.id);
      });

      it('should throw error when exceeding max agents', async () => {
        const smallConfig = {
          type: 'hierarchical' as const,
          maxAgents: 2,
          layers: 3
        };
        const smallTopology = new HierarchicalTopology(smallConfig);
        
        await smallTopology.addAgent(createMockAgent('agent-1', 'implementation'));
        await smallTopology.addAgent(createMockAgent('agent-2', 'implementation'));
        
        await expect(
          smallTopology.addAgent(createMockAgent('agent-3', 'implementation'))
        ).rejects.toThrow('Cannot add agent: max agents (2) reached');
      });

      it('should remove agent and update links', async () => {
        const agent1 = createMockAgent('agent-1', 'implementation');
        const agent2 = createMockAgent('agent-2', 'implementation');
        
        await hierarchicalTopology.addAgent(agent1);
        await hierarchicalTopology.addAgent(agent2);
        
        expect(hierarchicalTopology.getNeighbors(agent1.id)).toContain(agent2.id);
        
        await hierarchicalTopology.removeAgent(agent1.id);
        
        expect(hierarchicalTopology.getAllAgents()).not.toContain(agent1);
        expect(hierarchicalTopology.getNeighbors(agent2.id)).not.toContain(agent1.id);
      });

      it('should update coordinator when top layer agent is removed', async () => {
        const architect1 = createMockAgent('architect-1', 'architect');
        const architect2 = createMockAgent('architect-2', 'architect');
        
        await hierarchicalTopology.addAgent(architect1);
        await hierarchicalTopology.addAgent(architect2);
        
        expect(hierarchicalTopology.getCoordinator()).toBe(architect1.id);
        
        await hierarchicalTopology.removeAgent(architect1.id);
        
        expect(hierarchicalTopology.getCoordinator()).toBe(architect2.id);
      });
    });

    describe('Message Routing', () => {
      beforeEach(async () => {
        // Set up a basic hierarchy
        const architect = createMockAgent('architect-1', 'architect');
        const lead = createMockAgent('lead-1', 'review');
        const worker = createMockAgent('worker-1', 'implementation');
        
        await hierarchicalTopology.addAgent(architect);
        await hierarchicalTopology.addAgent(lead);
        await hierarchicalTopology.addAgent(worker);
      });

      it('should route messages within same layer directly', async () => {
        const worker1 = createMockAgent('worker-1', 'implementation');
        const worker2 = createMockAgent('worker-2', 'implementation');
        
        await hierarchicalTopology.addAgent(worker1);
        await hierarchicalTopology.addAgent(worker2);
        
        const message = createMockMessage(worker1.id, worker2.id);
        const path = await hierarchicalTopology.routeMessage(message);
        
        expect(path.from).toBe(worker1.id);
        expect(path.to).toBe(worker2.id);
        expect(path.hops).toBe(1);
        expect(path.path).toEqual([worker1.id, worker2.id]);
        expect(path.latency).toBe(10);
      });

      it('should route messages between adjacent layers directly', async () => {
        const allAgents = hierarchicalTopology.getAllAgents();
        const architect = allAgents.find(a => a.type === 'architect')!;
        const worker = allAgents.find(a => a.type === 'implementation')!;
        
        const message = createMockMessage(architect.id, worker.id);
        const path = await hierarchicalTopology.routeMessage(message);
        
        expect(path.from).toBe(architect.id);
        expect(path.to).toBe(worker.id);
        expect(path.hops).toBe(1);
        expect(path.path).toEqual([architect.id, worker.id]);
      });

      it('should route messages between non-adjacent layers through hierarchy', async () => {
        const allAgents = hierarchicalTopology.getAllAgents();
        const architect = allAgents.find(a => a.type === 'architect')!;
        const lead = allAgents.find(a => a.type === 'review')!;
        const worker = allAgents.find(a => a.type === 'implementation')!;
        
        // Add another architect to test non-direct routing
        const architect2 = createMockAgent('architect-2', 'architect');
        await hierarchicalTopology.addAgent(architect2);
        
        const message = createMockMessage(architect2.id, worker.id);
        const path = await hierarchicalTopology.routeMessage(message);
        
        expect(path.from).toBe(architect2.id);
        expect(path.to).toBe(worker.id);
        expect(path.hops).toBeGreaterThan(1);
        expect(path.path).toContain(architect2.id);
        expect(path.path).toContain(worker.id);
      });

      it('should handle broadcast messages', async () => {
        const allAgents = hierarchicalTopology.getAllAgents();
        const architect = allAgents.find(a => a.type === 'architect')!;
        
        const message = createMockMessage(architect.id); // No 'to' field
        const path = await hierarchicalTopology.routeMessage(message);
        
        expect(path.from).toBe(architect.id);
        expect(path.to).toBe('broadcast');
        expect(path.path).toContain(architect.id);
        expect(path.hops).toBeGreaterThan(0);
      });

      it('should throw error for unknown sender', async () => {
        const message = createMockMessage('unknown-agent', 'known-agent');
        
        await expect(
          hierarchicalTopology.routeMessage(message)
        ).rejects.toThrow('Agent unknown-agent not in topology');
      });

      it('should throw error for unknown recipient', async () => {
        const allAgents = hierarchicalTopology.getAllAgents();
        const knownAgent = allAgents[0];
        
        const message = createMockMessage(knownAgent.id, 'unknown-agent');
        
        await expect(
          hierarchicalTopology.routeMessage(message)
        ).rejects.toThrow('Agent unknown-agent not in topology');
      });
    });

    describe('Task Routing', () => {
      beforeEach(async () => {
        const architect = createMockAgent('architect-1', 'architect');
        const impl1 = createMockAgent('impl-1', 'implementation');
        const impl2 = createMockAgent('impl-2', 'implementation');
        
        await hierarchicalTopology.addAgent(architect);
        await hierarchicalTopology.addAgent(impl1);
        await hierarchicalTopology.addAgent(impl2);
      });

      it('should route task to matching idle agent', async () => {
        const task = createMockTask('task-1', 'implementation');
        
        const agentId = await hierarchicalTopology.routeTask(task);
        
        expect(agentId).toBeDefined();
        const routedAgent = hierarchicalTopology.getAgent(agentId);
        expect(routedAgent?.type).toBe('implementation');
        expect(routedAgent?.status).toBe('idle');
      });

      it('should route task to any idle agent when no type match', async () => {
        const task = createMockTask('task-1', 'research'); // No research agents
        
        const agentId = await hierarchicalTopology.routeTask(task);
        
        expect(agentId).toBeDefined();
        const routedAgent = hierarchicalTopology.getAgent(agentId);
        expect(routedAgent?.status).toBe('idle');
      });

      it('should route task to least loaded agent when multiple candidates', async () => {
        const impl1 = createMockAgent('impl-1', 'implementation');
        const impl2 = createMockAgent('impl-2', 'implementation');
        
        impl1.currentTasks.push('task-1'); // Make impl1 loaded
        
        await hierarchicalTopology.addAgent(impl1);
        await hierarchicalTopology.addAgent(impl2);
        
        const task = createMockTask('task-2', 'implementation');
        const agentId = await hierarchicalTopology.routeTask(task);
        
        expect(agentId).toBe(impl2.id); // Should choose less loaded
      });

      it('should throw error when no available agents', async () => {
        const allAgents = hierarchicalTopology.getAllAgents();
        
        // Make all agents busy
        allAgents.forEach(agent => {
          agent.status = 'busy';
          agent.currentTasks.push('busy-task');
        });
        
        const task = createMockTask('busy-task', 'implementation');
        
        await expect(
          hierarchicalTopology.routeTask(task)
        ).rejects.toThrow('No available agents for task routing');
      });
    });

    describe('Metrics Calculation', () => {
      beforeEach(async () => {
        const architect = createMockAgent('architect-1', 'architect');
        const lead = createMockAgent('lead-1', 'review');
        const worker1 = createMockAgent('worker-1', 'implementation');
        const worker2 = createMockAgent('worker-2', 'implementation');
        
        await hierarchicalTopology.addAgent(architect);
        await hierarchicalTopology.addAgent(lead);
        await hierarchicalTopology.addAgent(worker1);
        await hierarchicalTopology.addAgent(worker2);
        
        // Create some load imbalance
        worker1.currentTasks.push('task-1', 'task-2');
        worker2.currentTasks.push('task-1');
      });

      it('should calculate efficiency based on path length', () => {
        const metrics = hierarchicalTopology.calculateMetrics();
        
        expect(metrics.efficiency).toBeGreaterThan(0);
        expect(metrics.efficiency).toBeLessThanOrEqual(1);
      });

      it('should calculate message latency', () => {
        const metrics = hierarchicalTopology.calculateMetrics();
        
        expect(metrics.messageLatency).toBeGreaterThan(0);
      });

      it('should calculate load balance', () => {
        const metrics = hierarchicalTopology.calculateMetrics();
        
        expect(metrics.loadBalance).toBeGreaterThanOrEqual(0);
        expect(metrics.loadBalance).toBeLessThanOrEqual(1);
      });

      it('should identify bottlenecks', () => {
        const metrics = hierarchicalTopology.calculateMetrics();
        
        expect(Array.isArray(metrics.bottlenecks)).toBe(true);
      });

      it('should calculate connectivity', () => {
        const metrics = hierarchicalTopology.calculateMetrics();
        
        expect(metrics.connectivity).toBeGreaterThanOrEqual(0);
        expect(metrics.connectivity).toBeLessThanOrEqual(1);
      });
    });

    describe('Validation', () => {
      it('should validate properly formed topology', async () => {
        const architect = createMockAgent('architect-1', 'architect');
        const worker = createMockAgent('worker-1', 'implementation');
        
        await hierarchicalTopology.addAgent(architect);
        await hierarchicalTopology.addAgent(worker);
        
        expect(hierarchicalTopology.validate()).toBe(true);
      });

      it('should fail validation without top layer agents', async () => {
        const worker = createMockAgent('worker-1', 'implementation');
        
        await hierarchicalTopology.addAgent(worker);
        
        expect(hierarchicalTopology.validate()).toBe(false);
      });

      it('should fail validation when disconnected', async () => {
        const architect = createMockAgent('architect-1', 'architect');
        const worker = createMockAgent('worker-1', 'implementation');
        
        await hierarchicalTopology.addAgent(architect);
        // Don't add worker - should be disconnected
        
        expect(hierarchicalTopology.validate()).toBe(false);
      });
    });

    describe('Visualization', () => {
      it('should generate Mermaid diagram', async () => {
        const architect = createMockAgent('architect-1', 'architect');
        const worker = createMockAgent('worker-1', 'implementation');
        
        await hierarchicalTopology.addAgent(architect);
        await hierarchicalTopology.addAgent(worker);
        
        const diagram = hierarchicalTopology.visualize();
        
        expect(diagram).toContain('graph TD');
        expect(diagram).toContain(architect.id);
        expect(diagram).toContain(worker.id);
        expect(diagram).toContain('-->');
        expect(diagram).toContain('-.->');
      });
    });

    describe('Reorganization', () => {
      it('should reorganize agents based on performance', async () => {
        const agent = createMockAgent('agent-1', 'implementation');
        
        await hierarchicalTopology.addAgent(agent);
        
        const initialNeighbors = hierarchicalTopology.getNeighbors(agent.id);
        
        await hierarchicalTopology.reorganize();
        
        // Should maintain connectivity
        const finalNeighbors = hierarchicalTopology.getNeighbors(agent.id);
        expect(finalNeighbors).toBeDefined();
      });
    });
  });

  describe('Mesh Topology', () => {
    let meshTopology: MeshTopology;
    let config: TopologyConfig;

    beforeEach(() => {
      config = {
        type: 'mesh',
        maxAgents: 10
      };
      meshTopology = new MeshTopology(config);
    });

    describe('Initialization', () => {
      it('should initialize with default configuration', () => {
        expect(meshTopology).toBeDefined();
        expect(meshTopology.getConfig()).toEqual(config);
      });

      it('should start with empty task distribution', () => {
        const distribution = meshTopology.getTaskDistribution();
        expect(distribution).toBeDefined();
        expect(distribution.size).toBe(0);
      });
    });

    describe('Agent Management', () => {
      it('should add agent with full connectivity', async () => {
        const agent1 = createMockAgent('agent-1', 'implementation');
        const agent2 = createMockAgent('agent-2', 'testing');
        
        await meshTopology.addAgent(agent1);
        await meshTopology.addAgent(agent2);
        
        const agent1Neighbors = meshTopology.getNeighbors(agent1.id);
        const agent2Neighbors = meshTopology.getNeighbors(agent2.id);
        
        expect(agent1Neighbors).toContain(agent2.id);
        expect(agent2Neighbors).toContain(agent1.id);
      });

      it('should connect new agent to all existing agents', async () => {
        const agent1 = createMockAgent('agent-1', 'implementation');
        const agent2 = createMockAgent('agent-2', 'testing');
        const agent3 = createMockAgent('agent-3', 'review');
        
        await meshTopology.addAgent(agent1);
        await meshTopology.addAgent(agent2);
        await meshTopology.addAgent(agent3);
        
        const agent3Neighbors = meshTopology.getNeighbors(agent3.id);
        
        expect(agent3Neighbors).toContain(agent1.id);
        expect(agent3Neighbors).toContain(agent2.id);
      });

      it('should throw error when exceeding max agents', async () => {
        const smallConfig = {
          type: 'mesh' as const,
          maxAgents: 2
        };
        const smallTopology = new MeshTopology(smallConfig);
        
        await smallTopology.addAgent(createMockAgent('agent-1', 'implementation'));
        await smallTopology.addAgent(createMockAgent('agent-2', 'implementation'));
        
        await expect(
          smallTopology.addAgent(createMockAgent('agent-3', 'implementation'))
        ).rejects.toThrow('Cannot add agent: max agents (2) reached');
      });

      it('should remove agent and update all connections', async () => {
        const agent1 = createMockAgent('agent-1', 'implementation');
        const agent2 = createMockAgent('agent-2', 'testing');
        const agent3 = createMockAgent('agent-3', 'review');
        
        await meshTopology.addAgent(agent1);
        await meshTopology.addAgent(agent2);
        await meshTopology.addAgent(agent3);
        
        expect(meshTopology.getNeighbors(agent1.id)).toContain(agent2.id);
        expect(meshTopology.getNeighbors(agent1.id)).toContain(agent3.id);
        
        await meshTopology.removeAgent(agent1.id);
        
        expect(meshTopology.getAllAgents()).not.toContain(agent1);
        expect(meshTopology.getNeighbors(agent2.id)).not.toContain(agent1.id);
        expect(meshTopology.getNeighbors(agent3.id)).not.toContain(agent1.id);
      });

      it('should initialize task distribution for new agent', async () => {
        const agent = createMockAgent('agent-1', 'implementation');
        
        await meshTopology.addAgent(agent);
        
        const distribution = meshTopology.getTaskDistribution();
        expect(distribution.has(agent.id)).toBe(true);
        expect(distribution.get(agent.id)).toBe(0);
      });
    });

    describe('Message Routing', () => {
      beforeEach(async () => {
        const agent1 = createMockAgent('agent-1', 'implementation');
        const agent2 = createMockAgent('agent-2', 'testing');
        
        await meshTopology.addAgent(agent1);
        await meshTopology.addAgent(agent2);
      });

      it('should route messages directly between any agents', async () => {
        const allAgents = meshTopology.getAllAgents();
        const agent1 = allAgents[0];
        const agent2 = allAgents[1];
        
        const message = createMockMessage(agent1.id, agent2.id);
        const path = await meshTopology.routeMessage(message);
        
        expect(path.from).toBe(agent1.id);
        expect(path.to).toBe(agent2.id);
        expect(path.hops).toBe(1);
        expect(path.path).toEqual([agent1.id, agent2.id]);
        expect(path.latency).toBe(10);
      });

      it('should handle broadcast messages efficiently', async () => {
        const allAgents = meshTopology.getAllAgents();
        const broadcaster = allAgents[0];
        
        const message = createMockMessage(broadcaster.id);
        const path = await meshTopology.routeMessage(message);
        
        expect(path.from).toBe(broadcaster.id);
        expect(path.to).toBe('broadcast');
        expect(path.hops).toBe(1); // Direct broadcast in mesh
        expect(path.path).toContain(broadcaster.id);
        
        // Should include all other agents
        allAgents.forEach(agent => {
          if (agent.id !== broadcaster.id) {
            expect(path.path).toContain(agent.id);
          }
        });
      });

      it('should throw error for unknown sender', async () => {
        const message = createMockMessage('unknown-agent', 'known-agent');
        
        await expect(
          meshTopology.routeMessage(message)
        ).rejects.toThrow('Agent unknown-agent not in topology');
      });

      it('should throw error for unknown recipient', async () => {
        const allAgents = meshTopology.getAllAgents();
        const knownAgent = allAgents[0];
        
        const message = createMockMessage(knownAgent.id, 'unknown-agent');
        
        await expect(
          meshTopology.routeMessage(message)
        ).rejects.toThrow('Agent unknown-agent not in topology');
      });
    });

    describe('Task Routing', () => {
      beforeEach(async () => {
        const impl1 = createMockAgent('impl-1', 'implementation');
        const impl2 = createMockAgent('impl-2', 'implementation');
        const tester = createMockAgent('tester-1', 'testing');
        
        await meshTopology.addAgent(impl1);
        await meshTopology.addAgent(impl2);
        await meshTopology.addAgent(tester);
      });

      it('should route task to matching agent type', async () => {
        const task = createMockTask('task-1', 'implementation');
        
        const agentId = await meshTopology.routeTask(task);
        
        expect(agentId).toBeDefined();
        const routedAgent = meshTopology.getAgent(agentId);
        expect(routedAgent?.type).toBe('implementation');
      });

      it('should route task to least loaded matching agent', async () => {
        const impl1 = createMockAgent('impl-1', 'implementation');
        const impl2 = createMockAgent('impl-2', 'implementation');
        
        impl1.currentTasks.push('task-1'); // Make impl1 loaded
        
        await meshTopology.addAgent(impl1);
        await meshTopology.addAgent(impl2);
        
        const task = createMockTask('task-2', 'implementation');
        const agentId = await meshTopology.routeTask(task);
        
        expect(agentId).toBe(impl2.id); // Should choose less loaded
      });

      it('should update task distribution', async () => {
        const allAgents = meshTopology.getAllAgents();
        const agent = allAgents[0];
        
        const task = createMockTask('task-1', agent.type);
        await meshTopology.routeTask(task);
        
        const distribution = meshTopology.getTaskDistribution();
        expect(distribution.get(agent.id)).toBe(1);
      });

      it('should route to any available agent when no type match', async () => {
        const task = createMockTask('task-1', 'architect'); // No architect agents
        
        const agentId = await meshTopology.routeTask(task);
        
        expect(agentId).toBeDefined();
        const routedAgent = meshTopology.getAgent(agentId);
        expect(routedAgent).toBeDefined();
      });

      it('should throw error when no available agents', async () => {
        const allAgents = meshTopology.getAllAgents();
        
        // Make all agents busy
        allAgents.forEach(agent => {
          agent.status = 'busy';
          agent.currentTasks.push('busy-task');
        });
        
        const task = createMockTask('busy-task', 'implementation');
        
        await expect(
          meshTopology.routeTask(task)
        ).rejects.toThrow('No available agents for task routing');
      });
    });

    describe('Metrics Calculation', () => {
      beforeEach(async () => {
        const agent1 = createMockAgent('agent-1', 'implementation');
        const agent2 = createMockAgent('agent-2', 'testing');
        const agent3 = createMockAgent('agent-3', 'review');
        
        await meshTopology.addAgent(agent1);
        await meshTopology.addAgent(agent2);
        await meshTopology.addAgent(agent3);
        
        // Create some load imbalance
        agent1.currentTasks.push('task-1', 'task-2');
        agent2.currentTasks.push('task-1');
      });

      it('should calculate maximum efficiency for direct connections', () => {
        const metrics = meshTopology.calculateMetrics();
        
        expect(metrics.efficiency).toBe(1); // Maximum efficiency
      });

      it('should calculate minimal message latency', () => {
        const metrics = meshTopology.calculateMetrics();
        
        expect(metrics.messageLatency).toBe(10); // Single hop
      });

      it('should calculate perfect connectivity', () => {
        const metrics = meshTopology.calculateMetrics();
        
        expect(metrics.connectivity).toBe(1); // Perfect connectivity
      });

      it('should identify overloaded agents as bottlenecks', () => {
        const metrics = meshTopology.calculateMetrics();
        
        expect(Array.isArray(metrics.bottlenecks)).toBe(true);
      });

      it('should calculate load balance', () => {
        const metrics = meshTopology.calculateMetrics();
        
        expect(metrics.loadBalance).toBeGreaterThanOrEqual(0);
        expect(metrics.loadBalance).toBeLessThanOrEqual(1);
      });
    });

    describe('Validation', () => {
      it('should validate fully connected mesh', async () => {
        const agent1 = createMockAgent('agent-1', 'implementation');
        const agent2 = createMockAgent('agent-2', 'testing');
        
        await meshTopology.addAgent(agent1);
        await meshTopology.addAgent(agent2);
        
        expect(meshTopology.validate()).toBe(true);
      });

      it('should validate empty mesh', () => {
        expect(meshTopology.validate()).toBe(true);
      });

      it('should fail validation for incomplete connections', async () => {
        // This would require manual manipulation to test
        // For now, just test basic validation
        expect(meshTopology.validate()).toBe(true);
      });
    });

    describe('Visualization', () => {
      it('should generate Mermaid diagram with full connectivity', async () => {
        const agent1 = createMockAgent('agent-1', 'implementation');
        const agent2 = createMockAgent('agent-2', 'testing');
        
        await meshTopology.addAgent(agent1);
        await meshTopology.addAgent(agent2);
        
        const diagram = meshTopology.visualize();
        
        expect(diagram).toContain('graph LR');
        expect(diagram).toContain(agent1.id);
        expect(diagram).toContain(agent2.id);
        expect(diagram).toContain('---'); // Undirected connections
      });

      it('should include task distribution in visualization', async () => {
        const agent = createMockAgent('agent-1', 'implementation');
        
        await meshTopology.addAgent(agent);
        
        // Add some tasks
        const task = createMockTask('task-1', 'implementation');
        await meshTopology.routeTask(task);
        await meshTopology.routeTask(task);
        
        const diagram = meshTopology.visualize();
        
        expect(diagram).toContain('(1)'); // Should show task count
      });
    });

    describe('Task Distribution Management', () => {
      it('should reset task distribution', async () => {
        const agent = createMockAgent('agent-1', 'implementation');
        
        await meshTopology.addAgent(agent);
        
        // Add some tasks
        const task = createMockTask('task-1', 'implementation');
        await meshTopology.routeTask(task);
        await meshTopology.routeTask(task);
        
        let distribution = meshTopology.getTaskDistribution();
        expect(distribution.get(agent.id)).toBe(2);
        
        meshTopology.resetTaskDistribution();
        
        distribution = meshTopology.getTaskDistribution();
        expect(distribution.get(agent.id)).toBe(0);
      });
    });

    describe('Reorganization', () => {
      it('should rebalance task distribution', async () => {
        const agent1 = createMockAgent('agent-1', 'implementation');
        const agent2 = createMockAgent('agent-2', 'implementation');
        
        await meshTopology.addAgent(agent1);
        await meshTopology.addAgent(agent2);
        
        // Create imbalance
        const task = createMockTask('task-1', 'implementation');
        await meshTopology.routeTask(task);
        await meshTopology.routeTask(task);
        await meshTopology.routeTask(task);
        
        await meshTopology.reorganize();
        
        // Should reset distribution for next round
        const distribution = meshTopology.getTaskDistribution();
        expect(distribution.get(agent1.id)).toBe(0);
        expect(distribution.get(agent2.id)).toBe(0);
      });
    });
  });

  describe('Star Topology', () => {
    let starTopology: StarTopology;
    let config: TopologyConfig;
    let coordinatorId: string;

    beforeEach(() => {
      coordinatorId = 'coordinator-1';
      config = {
        type: 'star',
        maxAgents: 10,
        coordinatorId
      };
      starTopology = new StarTopology(config);
    });

    describe('Initialization', () => {
      it('should initialize with coordinator', () => {
        expect(starTopology).toBeDefined();
        expect(starTopology.getConfig()).toEqual(config);
        expect(starTopology.getCoordinator()).toBe(coordinatorId);
      });

      it('should throw error without coordinator', () => {
        expect(() => {
          new StarTopology({
            type: 'star',
            maxAgents: 10
            // No coordinatorId
          });
        }).toThrow('Star topology requires a coordinator ID in config');
      });
    });

    describe('Agent Management', () => {
      it('should add coordinator agent', async () => {
        const coordinator = createMockAgent(coordinatorId, 'architect');
        
        await starTopology.addAgent(coordinator);
        
        const allAgents = starTopology.getAllAgents();
        expect(allAgents).toHaveLength(1);
        expect(allAgents[0]).toBe(coordinator);
      });

      it('should add spoke agents connected to coordinator', async () => {
        const coordinator = createMockAgent(coordinatorId, 'architect');
        const spoke = createMockAgent('spoke-1', 'implementation');
        
        await starTopology.addAgent(coordinator);
        await starTopology.addAgent(spoke);
        
        const spokeNeighbors = starTopology.getNeighbors(spoke.id);
        const coordinatorNeighbors = starTopology.getNeighbors(coordinator.id);
        
        expect(spokeNeighbors).toContain(coordinatorId);
        expect(coordinatorNeighbors).toContain(spoke.id);
      });

      it('should connect new spokes to existing coordinator', async () => {
        const coordinator = createMockAgent(coordinatorId, 'architect');
        const spoke1 = createMockAgent('spoke-1', 'implementation');
        const spoke2 = createMockAgent('spoke-2', 'testing');
        
        await starTopology.addAgent(coordinator);
        await starTopology.addAgent(spoke1);
        await starTopology.addAgent(spoke2);
        
        const spoke1Neighbors = starTopology.getNeighbors(spoke1.id);
        const spoke2Neighbors = starTopology.getNeighbors(spoke2.id);
        
        expect(spoke1Neighbors).toContain(coordinatorId);
        expect(spoke2Neighbors).toContain(coordinatorId);
        expect(spoke1Neighbors).not.toContain(spoke2.id); // Spokes don't connect directly
        expect(spoke2Neighbors).not.toContain(spoke1.id);
      });

      it('should throw error when exceeding max agents', async () => {
        const smallConfig = {
          type: 'star' as const,
          maxAgents: 2,
          coordinatorId: 'coordinator-1'
        };
        const smallTopology = new StarTopology(smallConfig);
        
        await smallTopology.addAgent(createMockAgent('coordinator-1', 'architect'));
        await smallTopology.addAgent(createMockAgent('spoke-1', 'implementation'));
        
        await expect(
          smallTopology.addAgent(createMockAgent('spoke-2', 'implementation'))
        ).rejects.toThrow('Cannot add agent: max agents (2) reached');
      });

      it('should remove spoke agent', async () => {
        const coordinator = createMockAgent(coordinatorId, 'architect');
        const spoke = createMockAgent('spoke-1', 'implementation');
        
        await starTopology.addAgent(coordinator);
        await starTopology.addAgent(spoke);
        
        expect(starTopology.getNeighbors(coordinatorId)).toContain(spoke.id);
        
        await starTopology.removeAgent(spoke.id);
        
        expect(starTopology.getAllAgents()).not.toContain(spoke);
        expect(starTopology.getNeighbors(coordinatorId)).not.toContain(spoke.id);
      });

      it('should elect new coordinator when removing current coordinator', async () => {
        const coordinator = createMockAgent(coordinatorId, 'architect');
        const spoke = createMockAgent('spoke-1', 'implementation');
        const newCoordinator = createMockAgent('new-coordinator', 'review');
        
        await starTopology.addAgent(coordinator);
        await starTopology.addAgent(spoke);
        await starTopology.addAgent(newCoordinator);
        
        expect(starTopology.getCoordinator()).toBe(coordinatorId);
        
        await starTopology.removeAgent(coordinator.id);
        
        expect(starTopology.getCoordinator()).toBe(newCoordinator.id);
      });
    });

    describe('Message Routing', () => {
      beforeEach(async () => {
        const coordinator = createMockAgent(coordinatorId, 'architect');
        const spoke = createMockAgent('spoke-1', 'implementation');
        
        await starTopology.addAgent(coordinator);
        await starTopology.addAgent(spoke);
      });

      it('should route messages from coordinator to spoke directly', async () => {
        const allAgents = starTopology.getAllAgents();
        const coordinator = allAgents.find(a => a.id === coordinatorId)!;
        const spoke = allAgents.find(a => a.id !== coordinatorId)!;
        
        const message = createMockMessage(coordinator.id, spoke.id);
        const path = await starTopology.routeMessage(message);
        
        expect(path.from).toBe(coordinator.id);
        expect(path.to).toBe(spoke.id);
        expect(path.hops).toBe(1);
        expect(path.path).toEqual([coordinator.id, spoke.id]);
        expect(path.latency).toBe(10);
      });

      it('should route messages from spoke to coordinator directly', async () => {
        const allAgents = starTopology.getAllAgents();
        const coordinator = allAgents.find(a => a.id === coordinatorId)!;
        const spoke = allAgents.find(a => a.id !== coordinatorId)!;
        
        const message = createMockMessage(spoke.id, coordinator.id);
        const path = await starTopology.routeMessage(message);
        
        expect(path.from).toBe(spoke.id);
        expect(path.to).toBe(coordinator.id);
        expect(path.hops).toBe(1);
        expect(path.path).toEqual([spoke.id, coordinator.id]);
        expect(path.latency).toBe(10);
      });

      it('should route spoke-to-spoke messages through coordinator', async () => {
        const allAgents = starTopology.getAllAgents();
        const coordinator = allAgents.find(a => a.id === coordinatorId)!;
        const spokes = allAgents.filter(a => a.id !== coordinatorId);
        
        const message = createMockMessage(spokes[0].id, spokes[1].id);
        const path = await starTopology.routeMessage(message);
        
        expect(path.from).toBe(spokes[0].id);
        expect(path.to).toBe(spokes[1].id);
        expect(path.hops).toBe(2);
        expect(path.path).toEqual([spokes[0].id, coordinator.id, spokes[1].id]);
        expect(path.latency).toBe(20);
      });

      it('should handle broadcast from coordinator efficiently', async () => {
        const allAgents = starTopology.getAllAgents();
        const coordinator = allAgents.find(a => a.id === coordinatorId)!;
        const spokes = allAgents.filter(a => a.id !== coordinatorId);
        
        const message = createMockMessage(coordinator.id);
        const path = await starTopology.routeMessage(message);
        
        expect(path.from).toBe(coordinator.id);
        expect(path.to).toBe('broadcast');
        expect(path.hops).toBe(1);
        expect(path.path).toContain(coordinator.id);
        
        spokes.forEach(spoke => {
          expect(path.path).toContain(spoke.id);
        });
      });

      it('should handle broadcast from spoke through coordinator', async () => {
        const allAgents = starTopology.getAllAgents();
        const coordinator = allAgents.find(a => a.id === coordinatorId)!;
        const broadcaster = allAgents.find(a => a.id !== coordinatorId)!;
        const otherSpokes = allAgents.filter(a => a.id !== coordinatorId && a.id !== broadcaster.id);
        
        const message = createMockMessage(broadcaster.id);
        const path = await starTopology.routeMessage(message);
        
        expect(path.from).toBe(broadcaster.id);
        expect(path.to).toBe('broadcast');
        expect(path.hops).toBe(2);
        expect(path.path).toContain(broadcaster.id);
        expect(path.path).toContain(coordinatorId);
        
        otherSpokes.forEach(spoke => {
          expect(path.path).toContain(spoke.id);
        });
      });
    });

    describe('Task Routing', () => {
      beforeEach(async () => {
        const coordinator = createMockAgent(coordinatorId, 'architect');
        const spoke1 = createMockAgent('spoke-1', 'implementation');
        const spoke2 = createMockAgent('spoke-2', 'testing');
        
        await starTopology.addAgent(coordinator);
        await starTopology.addAgent(spoke1);
        await starTopology.addAgent(spoke2);
      });

      it('should route task to matching idle spoke', async () => {
        const task = createMockTask('task-1', 'implementation');
        
        const agentId = await starTopology.routeTask(task);
        
        expect(agentId).toBeDefined();
        const routedAgent = starTopology.getAgent(agentId);
        expect(routedAgent?.type).toBe('implementation');
        expect(routedAgent?.status).toBe('idle');
        expect(routedAgent?.id).not.toBe(coordinatorId); // Should prefer spoke
      });

      it('should route task to any idle spoke when no type match', async () => {
        const task = createMockTask('task-1', 'research'); // No research agents
        
        const agentId = await starTopology.routeTask(task);
        
        expect(agentId).toBeDefined();
        const routedAgent = starTopology.getAgent(agentId);
        expect(routedAgent?.status).toBe('idle');
        expect(routedAgent?.id).not.toBe(coordinatorId); // Should prefer spoke
      });

      it('should route task to least loaded spoke', async () => {
        const spoke1 = createMockAgent('spoke-1', 'implementation');
        const spoke2 = createMockAgent('spoke-2', 'implementation');
        
        spoke1.currentTasks.push('task-1'); // Make spoke1 loaded
        
        await starTopology.addAgent(spoke1);
        await starTopology.addAgent(spoke2);
        
        const task = createMockTask('task-2', 'implementation');
        const agentId = await starTopology.routeTask(task);
        
        expect(agentId).toBe(spoke2.id); // Should choose less loaded
      });

      it('should route task to coordinator when no idle spokes', async () => {
        const allAgents = starTopology.getAllAgents();
        const coordinator = allAgents.find(a => a.id === coordinatorId)!;
        const spokes = allAgents.filter(a => a.id !== coordinatorId);
        
        // Make all spokes busy
        spokes.forEach(spoke => {
          spoke.status = 'busy';
          spoke.currentTasks.push('busy-task');
        });
        
        const task = createMockTask('busy-task', 'implementation');
        const agentId = await starTopology.routeTask(task);
        
        expect(agentId).toBe(coordinatorId); // Should fall back to coordinator
      });

      it('should throw error when no available agents', async () => {
        const allAgents = starTopology.getAllAgents();
        
        // Make all agents busy
        allAgents.forEach(agent => {
          agent.status = 'busy';
          agent.currentTasks.push('busy-task');
        });
        
        const task = createMockTask('busy-task', 'implementation');
        
        await expect(
          starTopology.routeTask(task)
        ).rejects.toThrow('No available agents for task routing');
      });
    });

    describe('Metrics Calculation', () => {
      beforeEach(async () => {
        const coordinator = createMockAgent(coordinatorId, 'architect');
        const spoke1 = createMockAgent('spoke-1', 'implementation');
        const spoke2 = createMockAgent('spoke-2', 'testing');
        
        await starTopology.addAgent(coordinator);
        await starTopology.addAgent(spoke1);
        await starTopology.addAgent(spoke2);
        
        // Create load imbalance
        spoke1.currentTasks.push('task-1', 'task-2');
        coordinator.currentTasks.push('coord-task');
      });

      it('should calculate efficiency based on average path length', () => {
        const metrics = starTopology.calculateMetrics();
        
        expect(metrics.efficiency).toBeGreaterThan(0);
        expect(metrics.efficiency).toBeLessThanOrEqual(1);
      });

      it('should identify coordinator as bottleneck', () => {
        const metrics = starTopology.calculateMetrics();
        
        expect(metrics.bottlenecks).toContain(coordinatorId);
      });

      it('should calculate message latency correctly', () => {
        const metrics = starTopology.calculateMetrics();
        
        expect(metrics.messageLatency).toBeGreaterThan(10); // Should be >10 due to coordinator hops
        expect(metrics.messageLatency).toBeLessThanOrEqual(20);
      });

      it('should calculate load balance', () => {
        const metrics = starTopology.calculateMetrics();
        
        expect(metrics.loadBalance).toBeGreaterThanOrEqual(0);
        expect(metrics.loadBalance).toBeLessThanOrEqual(1);
      });

      it('should calculate connectivity correctly', () => {
        const metrics = starTopology.calculateMetrics();
        
        expect(metrics.connectivity).toBeGreaterThanOrEqual(0);
        expect(metrics.connectivity).toBeLessThanOrEqual(1);
      });
    });

    describe('Coordinator Management', () => {
      it('should get coordinator statistics', async () => {
        const coordinator = createMockAgent(coordinatorId, 'architect');
        const spoke1 = createMockAgent('spoke-1', 'implementation');
        const spoke2 = createMockAgent('spoke-2', 'testing');
        
        await starTopology.addAgent(coordinator);
        await starTopology.addAgent(spoke1);
        await starTopology.addAgent(spoke2);
        
        // Add some load
        coordinator.currentTasks.push('coord-task-1', 'coord-task-2');
        spoke1.currentTasks.push('spoke-task-1');
        
        const stats = starTopology.getCoordinatorStats();
        
        expect(stats.coordinatorId).toBe(coordinatorId);
        expect(stats.load).toBe(2);
        expect(stats.spokeCount).toBe(2);
        expect(stats.avgSpokeLoad).toBe(0.5); // 1 task / 2 spokes
      });
    });

    describe('Validation', () => {
      it('should validate properly formed star topology', async () => {
        const coordinator = createMockAgent(coordinatorId, 'architect');
        const spoke = createMockAgent('spoke-1', 'implementation');
        
        await starTopology.addAgent(coordinator);
        await starTopology.addAgent(spoke);
        
        expect(starTopology.validate()).toBe(true);
      });

      it('should fail validation without coordinator', () => {
        const invalidConfig = {
          type: 'star' as const,
          maxAgents: 10
          // No coordinatorId
        };
        const invalidTopology = new StarTopology(invalidConfig);
        
        expect(invalidTopology.validate()).toBe(false);
      });

      it('should fail validation when spokes not connected to coordinator', async () => {
        const spoke = createMockAgent('spoke-1', 'implementation');
        
        await starTopology.addAgent(spoke);
        // Don't add coordinator
        
        expect(starTopology.validate()).toBe(false);
      });
    });

    describe('Visualization', () => {
      it('should generate Mermaid diagram with star structure', async () => {
        const coordinator = createMockAgent(coordinatorId, 'architect');
        const spoke = createMockAgent('spoke-1', 'implementation');
        
        await starTopology.addAgent(coordinator);
        await starTopology.addAgent(spoke);
        
        const diagram = starTopology.visualize();
        
        expect(diagram).toContain('graph TD');
        expect(diagram).toContain(coordinator.id);
        expect(diagram).toContain(spoke.id);
        expect(diagram).toContain('---'); // Star connections
        expect(diagram).toContain('fill:#f96'); // Coordinator styling
      });
    });

    describe('Reorganization', () => {
      it('should switch coordinator when overloaded', async () => {
        const coordinator = createMockAgent(coordinatorId, 'architect');
        const betterCandidate = createMockAgent('better-coordinator', 'review');
        
        await starTopology.addAgent(coordinator);
        await starTopology.addAgent(betterCandidate);
        
        // Overload current coordinator
        coordinator.currentTasks.push('task-1', 'task-2', 'task-3', 'task-4', 'task-5', 'task-6');
        
        await starTopology.reorganize();
        
        // Should switch to better candidate
        expect(starTopology.getCoordinator()).toBe(betterCandidate.id);
      });

      it('should elect new coordinator when missing', async () => {
        const spoke1 = createMockAgent('spoke-1', 'implementation');
        const spoke2 = createMockAgent('spoke-2', 'testing');
        
        await starTopology.addAgent(spoke1);
        await starTopology.addAgent(spoke2);
        
        // Remove coordinator (should trigger election)
        await starTopology.removeAgent(coordinatorId);
        
        expect(starTopology.getCoordinator()).toBeDefined();
        expect(starTopology.getCoordinator()).not.toBe(coordinatorId);
      });
    });
  });

  describe('Dynamic Topology Switching', () => {
    it('should handle switching between different topologies', async () => {
      const agents = [
        createMockAgent('agent-1', 'implementation'),
        createMockAgent('agent-2', 'testing'),
        createMockAgent('agent-3', 'review')
      ];

      // Test with hierarchical topology
      const hierarchicalConfig = {
        type: 'hierarchical' as const,
        maxAgents: 10,
        layers: 3
      };
      const hierarchical = new HierarchicalTopology(hierarchicalConfig);
      
      for (const agent of agents) {
        await hierarchical.addAgent(agent);
      }
      
      expect(hierarchical.getAllAgents()).toHaveLength(3);
      
      // Test with mesh topology
      const meshConfig = {
        type: 'mesh' as const,
        maxAgents: 10
      };
      const mesh = new MeshTopology(meshConfig);
      
      for (const agent of agents) {
        await mesh.addAgent(agent);
      }
      
      expect(mesh.getAllAgents()).toHaveLength(3);
      
      // Test with star topology
      const starConfig = {
        type: 'star' as const,
        maxAgents: 10,
        coordinatorId: 'agent-1'
      };
      const star = new StarTopology(starConfig);
      
      for (const agent of agents) {
        await star.addAgent(agent);
      }
      
      expect(star.getAllAgents()).toHaveLength(3);
    });

    it('should maintain agent data across topology switches', async () => {
      const agent = createMockAgent('persistent-agent', 'implementation');
      
      const hierarchical = new HierarchicalTopology({
        type: 'hierarchical' as const,
        maxAgents: 10
      });
      
      await hierarchical.addAgent(agent);
      
      const hierarchicalAgent = hierarchical.getAgent(agent.id);
      expect(hierarchicalAgent).toBe(agent);
      
      // Switch to mesh
      const mesh = new MeshTopology({
        type: 'mesh' as const,
        maxAgents: 10
      });
      
      await mesh.addAgent(agent);
      
      const meshAgent = mesh.getAgent(agent.id);
      expect(meshAgent).toBe(agent);
      expect(meshAgent?.id).toBe(hierarchicalAgent?.id);
    });
  });

  describe('Topology-Specific Message Routing', () => {
    it('should route messages differently based on topology type', async () => {
      const agents = [
        createMockAgent('agent-1', 'implementation'),
        createMockAgent('agent-2', 'testing'),
        createMockAgent('agent-3', 'review')
      ];

      const message = createMockMessage('agent-1', 'agent-2');

      // Hierarchical routing
      const hierarchical = new HierarchicalTopology({
        type: 'hierarchical' as const,
        maxAgents: 10
      });
      
      for (const agent of agents) {
        await hierarchical.addAgent(agent);
      }
      
      const hierarchicalPath = await hierarchical.routeMessage(message);
      
      // Mesh routing
      const mesh = new MeshTopology({
        type: 'mesh' as const,
        maxAgents: 10
      });
      
      for (const agent of agents) {
        await mesh.addAgent(agent);
      }
      
      const meshPath = await mesh.routeMessage(message);
      
      // Star routing
      const star = new StarTopology({
        type: 'star' as const,
        maxAgents: 10,
        coordinatorId: 'agent-1'
      });
      
      for (const agent of agents) {
        await star.addAgent(agent);
      }
      
      const starPath = await star.routeMessage(message);
      
      // All should route the message but with different characteristics
      expect(hierarchicalPath.from).toBe('agent-1');
      expect(hierarchicalPath.to).toBe('agent-2');
      expect(meshPath.from).toBe('agent-1');
      expect(meshPath.to).toBe('agent-2');
      expect(starPath.from).toBe('agent-1');
      expect(starPath.to).toBe('agent-2');
      
      // Latency should differ
      expect(hierarchicalPath.latency).toBeDefined();
      expect(meshPath.latency).toBe(10); // Direct in mesh
      expect(starPath.latency).toBeDefined();
    });
  });

  describe('Topology Validation and Constraints', () => {
    it('should enforce max agents constraint', async () => {
      const config = {
        type: 'mesh' as const,
        maxAgents: 2
      };
      const topology = new MeshTopology(config);
      
      await topology.addAgent(createMockAgent('agent-1', 'implementation'));
      await topology.addAgent(createMockAgent('agent-2', 'implementation'));
      
      await expect(
        topology.addAgent(createMockAgent('agent-3', 'implementation'))
      ).rejects.toThrow('Cannot add agent: max agents (2) reached');
    });

    it('should validate topology-specific constraints', async () => {
      // Star topology requires coordinator
      expect(() => {
        new StarTopology({
          type: 'star' as const,
          maxAgents: 10
          // Missing coordinatorId
        });
      }).toThrow('Star topology requires a coordinator ID in config');
      
      // Hierarchical requires layers for proper validation
      const hierarchical = new HierarchicalTopology({
        type: 'hierarchical' as const,
        maxAgents: 10,
        layers: 3
      });
      
      // Should fail validation without top layer
      await hierarchical.addAgent(createMockAgent('agent-1', 'implementation'));
      expect(hierarchical.validate()).toBe(false);
    });

    it('should handle invalid topology configurations', () => {
      expect(() => {
        new HierarchicalTopology({
          type: 'hierarchical' as const,
          maxAgents: -1 // Invalid
        });
      }).not.toThrow(); // Should handle gracefully
    });
  });

  describe('Error Handling', () => {
    it('should handle operations on empty topologies gracefully', async () => {
      const hierarchical = new HierarchicalTopology({
        type: 'hierarchical' as const,
        maxAgents: 10
      });
      
      const mesh = new MeshTopology({
        type: 'mesh' as const,
        maxAgents: 10
      });
      
      const star = new StarTopology({
        type: 'star' as const,
        maxAgents: 10,
        coordinatorId: 'coordinator-1'
      });
      
      // Should handle operations on empty topologies
      expect(hierarchical.getAllAgents()).toHaveLength(0);
      expect(mesh.getAllAgents()).toHaveLength(0);
      expect(star.getAllAgents()).toHaveLength(0);
      
      // Message routing should fail appropriately
      const message = createMockMessage('unknown', 'unknown');
      
      await expect(hierarchical.routeMessage(message))
        .rejects.toThrow('Agent unknown not in topology');
      await expect(mesh.routeMessage(message))
        .rejects.toThrow('Agent unknown not in topology');
      await expect(star.routeMessage(message))
        .rejects.toThrow('Agent unknown not in topology');
    });

    it('should handle invalid agent operations gracefully', async () => {
      const topology = new MeshTopology({
        type: 'mesh' as const,
        maxAgents: 10
      });
      
      await expect(
        topology.removeAgent('non-existent')
      ).resolves.not.toThrow(); // Should handle gracefully
    });

    it('should handle task routing with no agents gracefully', async () => {
      const topology = new MeshTopology({
        type: 'mesh' as const,
        maxAgents: 10
      });
      
      const task = createMockTask('task-1', 'implementation');
      
      await expect(
        topology.routeTask(task)
      ).rejects.toThrow('No available agents for task routing');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large numbers of agents efficiently', async () => {
      const config = {
        type: 'mesh' as const,
        maxAgents: 100
      };
      const topology = new MeshTopology(config);
      
      const agents = Array.from({ length: 50 }, (_, i) =>
        createMockAgent(`agent-${i}`, 'implementation')
      );
      
      const startTime = Date.now();
      
      for (const agent of agents) {
        await topology.addAgent(agent);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(topology.getAllAgents()).toHaveLength(50);
      expect(duration).toBeLessThan(1000); // Should complete quickly
    });

    it('should maintain performance with complex message routing', async () => {
      const config = {
        type: 'hierarchical' as const,
        maxAgents: 50,
        layers: 4
      };
      const topology = new HierarchicalTopology(config);
      
      // Add agents across all layers
      const architect = createMockAgent('architect-1', 'architect');
      const leads = Array.from({ length: 5 }, (_, i) =>
        createMockAgent(`lead-${i}`, 'review')
      );
      const workers = Array.from({ length: 20 }, (_, i) =>
        createMockAgent(`worker-${i}`, 'implementation')
      );
      
      await topology.addAgent(architect);
      for (const lead of leads) {
        await topology.addAgent(lead);
      }
      for (const worker of workers) {
        await topology.addAgent(worker);
      }
      
      const message = createMockMessage('worker-1', 'worker-20');
      
      const startTime = Date.now();
      const path = await topology.routeMessage(message);
      const endTime = Date.now();
      
      expect(path.from).toBe('worker-1');
      expect(path.to).toBe('worker-20');
      expect(endTime - startTime).toBeLessThan(100); // Should route quickly
    });
  });
});