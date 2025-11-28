// Hierarchical Topology Implementation
// Phase 9: architect → team leads → workers

import { Agent, Task, AgentMessage, AgentType } from '../types/agents.js';
import { BaseTopology, TopologyConfig, CommunicationPath, TopologyMetrics } from './base-topology.js';

interface HierarchyLayer {
  level: number;
  agents: string[];
  parentLayer?: number;
  childLayer?: number;
}

/**
 * Hierarchical topology: architect at top → team leads → workers
 *
 * Communication flows up and down the hierarchy.
 * Tasks are delegated down, results flow up.
 */
export class HierarchicalTopology extends BaseTopology {
  private layers: Map<number, HierarchyLayer> = new Map();
  private agentLayers: Map<string, number> = new Map();  // agentId -> layer level

  constructor(config: TopologyConfig) {
    super(config);
    this.initializeLayers();
  }

  private initializeLayers(): void {
    const numLayers = this.config.layers || 3;  // Default: architect, leads, workers

    for (let i = 0; i < numLayers; i++) {
      this.layers.set(i, {
        level: i,
        agents: [],
        parentLayer: i > 0 ? i - 1 : undefined,
        childLayer: i < numLayers - 1 ? i + 1 : undefined
      });
    }
  }

  async addAgent(agent: Agent): Promise<void> {
    if (this.agents.size >= this.config.maxAgents) {
      throw new Error(`Cannot add agent: max agents (${this.config.maxAgents}) reached`);
    }

    this.agents.set(agent.id, agent);

    // Determine layer based on agent type
    const layer = this.determineLayer(agent);
    this.agentLayers.set(agent.id, layer);

    const layerData = this.layers.get(layer)!;
    layerData.agents.push(agent.id);

    // Set as coordinator if this is the top layer and no coordinator exists
    if (layer === 0 && !this.config.coordinatorId) {
      this.config.coordinatorId = agent.id;
    }

    // Establish communication links
    await this.establishLinks(agent.id, layer);
  }

  async removeAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    const layer = this.agentLayers.get(agentId);
    if (layer !== undefined) {
      const layerData = this.layers.get(layer)!;
      layerData.agents = layerData.agents.filter(id => id !== agentId);
      this.agentLayers.delete(agentId);
    }

    this.agents.delete(agentId);
    this.communicationGraph.delete(agentId);

    // Remove from other agents' communication lists
    for (const neighbors of this.communicationGraph.values()) {
      neighbors.delete(agentId);
    }

    // Update coordinator if needed
    if (this.config.coordinatorId === agentId) {
      const topLayer = this.layers.get(0)!;
      this.config.coordinatorId = topLayer.agents[0];
    }
  }

  async routeMessage(message: AgentMessage): Promise<CommunicationPath> {
    const fromLayer = this.agentLayers.get(message.from);
    const toLayer = message.to ? this.agentLayers.get(message.to) : undefined;

    if (fromLayer === undefined) {
      throw new Error(`Agent ${message.from} not in topology`);
    }

    // Broadcast message (no specific recipient)
    if (!message.to) {
      const path = this.broadcastPath(message.from, fromLayer);
      return {
        from: message.from,
        to: 'broadcast',
        hops: path.length - 1,
        path,
        latency: (path.length - 1) * 10  // Assume 10ms per hop
      };
    }

    if (toLayer === undefined) {
      throw new Error(`Agent ${message.to} not in topology`);
    }

    // Direct communication (same layer or adjacent layers)
    const canDirectCommunicate = Math.abs(fromLayer - toLayer) <= 1;

    if (canDirectCommunicate) {
      return {
        from: message.from,
        to: message.to,
        hops: 1,
        path: [message.from, message.to],
        latency: 10
      };
    }

    // Need to route through hierarchy
    const path = this.findShortestPath(message.from, message.to);
    return {
      from: message.from,
      to: message.to,
      hops: path.length - 1,
      path,
      latency: (path.length - 1) * 10
    };
  }

  async routeTask(task: Task): Promise<string> {
    // Tasks are routed based on type and current load

    // If task has preferred agent type, find agent of that type
    const candidates = Array.from(this.agents.values()).filter(agent => {
      return agent.type === task.type && agent.status === 'idle';
    });

    if (candidates.length === 0) {
      // No idle agents of preferred type, find any idle agent
      const anyIdle = Array.from(this.agents.values()).find(a => a.status === 'idle');
      if (anyIdle) return anyIdle.id;

      // No idle agents, find least loaded
      const leastLoaded = this.findLeastLoadedAgent();
      if (leastLoaded) return leastLoaded;

      throw new Error('No available agents for task routing');
    }

    // Among candidates, find least loaded
    const leastLoaded = candidates.reduce((min, agent) => {
      return agent.currentTasks.length < min.currentTasks.length ? agent : min;
    });

    return leastLoaded.id;
  }

  getNeighbors(agentId: string): string[] {
    const neighbors = this.communicationGraph.get(agentId);
    return neighbors ? Array.from(neighbors) : [];
  }

  calculateMetrics(): TopologyMetrics {
    const avgPathLength = this.calculateAveragePathLength();
    const isConnected = this.isConnected();

    // Calculate load balance
    const loadBalance = this.calculateLoadBalance();

    // Find bottlenecks (agents with many connections)
    const bottlenecks = this.findBottlenecks();

    return {
      efficiency: isConnected ? 1 / (1 + avgPathLength) : 0,
      messageLatency: avgPathLength * 10,  // 10ms per hop
      loadBalance,
      bottlenecks,
      connectivity: isConnected ? 1 : 0
    };
  }

  async reorganize(): Promise<void> {
    // Re-evaluate agent layers based on current performance
    for (const [agentId, agent] of this.agents) {
      const currentLayer = this.agentLayers.get(agentId)!;
      const optimalLayer = this.determineLayer(agent);

      if (currentLayer !== optimalLayer) {
        // Move agent to new layer
        const oldLayerData = this.layers.get(currentLayer)!;
        oldLayerData.agents = oldLayerData.agents.filter(id => id !== agentId);

        const newLayerData = this.layers.get(optimalLayer)!;
        newLayerData.agents.push(agentId);

        this.agentLayers.set(agentId, optimalLayer);

        // Re-establish links
        await this.establishLinks(agentId, optimalLayer);
      }
    }
  }

  validate(): boolean {
    // Check that all layers have at least one agent (except possibly bottom layers)
    const topLayer = this.layers.get(0);
    if (!topLayer || topLayer.agents.length === 0) {
      return false;
    }

    // Check connectivity
    return this.isConnected();
  }

  visualize(): string {
    let mermaid = 'graph TD\n';

    // Add nodes by layer
    for (const [level, layer] of this.layers) {
      for (const agentId of layer.agents) {
        const agent = this.agents.get(agentId)!;
        const label = `${agent.type}:${agentId.slice(0, 8)}`;
        mermaid += `  ${agentId}["${label}"]\n`;
      }
    }

    // Add edges
    for (const [from, neighbors] of this.communicationGraph) {
      for (const to of neighbors) {
        const fromLayer = this.agentLayers.get(from)!;
        const toLayer = this.agentLayers.get(to)!;

        if (fromLayer < toLayer) {
          // Downward delegation
          mermaid += `  ${from} -->|delegate| ${to}\n`;
        } else if (fromLayer > toLayer) {
          // Upward reporting
          mermaid += `  ${from} -.->|report| ${to}\n`;
        } else {
          // Peer communication
          mermaid += `  ${from} ---|peer| ${to}\n`;
        }
      }
    }

    return mermaid;
  }

  // Private helper methods

  private determineLayer(agent: Agent): number {
    // Architect at top (layer 0)
    if (agent.type === 'architect') return 0;

    // Review and documentation as team leads (layer 1)
    if (agent.type === 'review' || agent.type === 'documentation') {
      return Math.min(1, (this.config.layers || 3) - 1);
    }

    // Workers at bottom layer
    const bottomLayer = (this.config.layers || 3) - 1;
    return bottomLayer;
  }

  private async establishLinks(agentId: string, layer: number): Promise<void> {
    if (!this.communicationGraph.has(agentId)) {
      this.communicationGraph.set(agentId, new Set());
    }

    const layerData = this.layers.get(layer)!;

    // Link to parent layer (upward)
    if (layerData.parentLayer !== undefined) {
      const parentLayer = this.layers.get(layerData.parentLayer)!;
      for (const parentId of parentLayer.agents) {
        this.communicationGraph.get(agentId)!.add(parentId);
        this.communicationGraph.get(parentId)!.add(agentId);
      }
    }

    // Link to child layer (downward)
    if (layerData.childLayer !== undefined) {
      const childLayer = this.layers.get(layerData.childLayer)!;
      for (const childId of childLayer.agents) {
        this.communicationGraph.get(agentId)!.add(childId);
        this.communicationGraph.get(childId)!.add(agentId);
      }
    }

    // Link to peers in same layer
    for (const peerId of layerData.agents) {
      if (peerId !== agentId) {
        this.communicationGraph.get(agentId)!.add(peerId);
        if (!this.communicationGraph.has(peerId)) {
          this.communicationGraph.set(peerId, new Set());
        }
        this.communicationGraph.get(peerId)!.add(agentId);
      }
    }
  }

  private broadcastPath(from: string, fromLayer: number): string[] {
    const path: string[] = [from];

    // Broadcast to peers in same layer
    const layerData = this.layers.get(fromLayer)!;
    path.push(...layerData.agents.filter(id => id !== from));

    // Broadcast down to child layers
    if (layerData.childLayer !== undefined) {
      const childLayer = this.layers.get(layerData.childLayer)!;
      path.push(...childLayer.agents);
    }

    return path;
  }

  private calculateLoadBalance(): number {
    if (this.agents.size === 0) return 1;

    const loads = Array.from(this.agents.values()).map(a => a.currentTasks.length);
    const avgLoad = loads.reduce((sum, l) => sum + l, 0) / loads.length;

    if (avgLoad === 0) return 1;

    const variance = loads.reduce((sum, l) => sum + Math.pow(l - avgLoad, 2), 0) / loads.length;
    const stdDev = Math.sqrt(variance);

    // Lower std dev = better balance
    return Math.max(0, 1 - stdDev / (avgLoad + 1));
  }

  private findBottlenecks(): string[] {
    const bottlenecks: string[] = [];
    const avgConnections = Array.from(this.communicationGraph.values())
      .reduce((sum, neighbors) => sum + neighbors.size, 0) / this.agents.size;

    for (const [agentId, neighbors] of this.communicationGraph) {
      if (neighbors.size > avgConnections * 1.5) {
        bottlenecks.push(agentId);
      }
    }

    return bottlenecks;
  }

  private findLeastLoadedAgent(): string | null {
    let minLoad = Infinity;
    let leastLoaded: string | null = null;

    for (const [agentId, agent] of this.agents) {
      if (agent.currentTasks.length < minLoad) {
        minLoad = agent.currentTasks.length;
        leastLoaded = agentId;
      }
    }

    return leastLoaded;
  }
}
