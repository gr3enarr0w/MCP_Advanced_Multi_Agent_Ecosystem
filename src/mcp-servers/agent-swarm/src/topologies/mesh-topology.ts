// Mesh Topology Implementation
// Phase 9: Peer-to-peer communication network

import { Agent, Task, AgentMessage } from '../types/agents.js';
import { BaseTopology, TopologyConfig, CommunicationPath, TopologyMetrics } from './base-topology.js';

/**
 * Mesh topology: All agents can communicate with all other agents
 *
 * Fully connected peer-to-peer network.
 * Every agent can directly communicate with every other agent.
 * Tasks can be distributed to any agent.
 */
export class MeshTopology extends BaseTopology {
  private taskDistribution: Map<string, number> = new Map();  // Track task distribution

  constructor(config: TopologyConfig) {
    super(config);
  }

  async addAgent(agent: Agent): Promise<void> {
    if (this.agents.size >= this.config.maxAgents) {
      throw new Error(`Cannot add agent: max agents (${this.config.maxAgents}) reached`);
    }

    this.agents.set(agent.id, agent);
    this.taskDistribution.set(agent.id, 0);

    // In mesh topology, create full connectivity
    if (!this.communicationGraph.has(agent.id)) {
      this.communicationGraph.set(agent.id, new Set());
    }

    // Connect to all existing agents
    for (const [existingId, _] of this.agents) {
      if (existingId !== agent.id) {
        // Bidirectional connection
        this.communicationGraph.get(agent.id)!.add(existingId);

        if (!this.communicationGraph.has(existingId)) {
          this.communicationGraph.set(existingId, new Set());
        }
        this.communicationGraph.get(existingId)!.add(agent.id);
      }
    }
  }

  async removeAgent(agentId: string): Promise<void> {
    this.agents.delete(agentId);
    this.taskDistribution.delete(agentId);
    this.communicationGraph.delete(agentId);

    // Remove from all other agents' neighbor lists
    for (const neighbors of this.communicationGraph.values()) {
      neighbors.delete(agentId);
    }
  }

  async routeMessage(message: AgentMessage): Promise<CommunicationPath> {
    if (!this.agents.has(message.from)) {
      throw new Error(`Agent ${message.from} not in topology`);
    }

    // Broadcast to all agents
    if (!message.to) {
      const allAgents = Array.from(this.agents.keys()).filter(id => id !== message.from);
      return {
        from: message.from,
        to: 'broadcast',
        hops: 1,  // Direct broadcast in mesh
        path: [message.from, ...allAgents],
        latency: 10  // Single hop
      };
    }

    if (!this.agents.has(message.to)) {
      throw new Error(`Agent ${message.to} not in topology`);
    }

    // Direct communication (all agents are connected)
    return {
      from: message.from,
      to: message.to,
      hops: 1,
      path: [message.from, message.to],
      latency: 10
    };
  }

  async routeTask(task: Task): Promise<string> {
    // Find agents that match the task type
    const matchingAgents = Array.from(this.agents.values()).filter(agent => {
      return agent.type === task.type;
    });

    if (matchingAgents.length === 0) {
      // No matching agents, use any available agent
      const anyAvailable = this.findAvailableAgent();
      if (anyAvailable) return anyAvailable;

      throw new Error('No available agents for task routing');
    }

    // Among matching agents, find the least loaded
    const leastLoaded = matchingAgents.reduce((min, agent) => {
      const minLoad = this.taskDistribution.get(min.id) || 0;
      const agentLoad = this.taskDistribution.get(agent.id) || 0;
      return agentLoad < minLoad ? agent : min;
    });

    // Update task distribution
    this.taskDistribution.set(leastLoaded.id, (this.taskDistribution.get(leastLoaded.id) || 0) + 1);

    return leastLoaded.id;
  }

  getNeighbors(agentId: string): string[] {
    // In mesh, all other agents are neighbors
    return Array.from(this.agents.keys()).filter(id => id !== agentId);
  }

  calculateMetrics(): TopologyMetrics {
    // Mesh topology has optimal connectivity but can have overhead
    const agentCount = this.agents.size;

    // Calculate load balance
    const loadBalance = this.calculateLoadBalance();

    // Mesh topology has no bottlenecks by design (unless overloaded agents)
    const bottlenecks = this.findOverloadedAgents();

    return {
      efficiency: 1,  // Maximum efficiency (direct connections)
      messageLatency: 10,  // Single hop for all messages
      loadBalance,
      bottlenecks,
      connectivity: agentCount > 1 ? 1 : 0  // Perfect connectivity
    };
  }

  async reorganize(): Promise<void> {
    // Mesh topology doesn't need reorganization
    // But we can rebalance task distribution
    this.rebalanceTasks();
  }

  validate(): boolean {
    // Check that all agents are fully connected
    if (this.agents.size === 0) return true;

    for (const [agentId, neighbors] of this.communicationGraph) {
      // Each agent should be connected to all others
      if (neighbors.size !== this.agents.size - 1) {
        return false;
      }
    }

    return this.isConnected();
  }

  visualize(): string {
    let mermaid = 'graph LR\n';

    // Add all nodes
    for (const [agentId, agent] of this.agents) {
      const label = `${agent.type}:${agentId.slice(0, 8)}`;
      const load = this.taskDistribution.get(agentId) || 0;
      mermaid += `  ${agentId}["${label} (${load})"]\n`;
    }

    // Add edges (only show one direction to avoid clutter)
    const agentIds = Array.from(this.agents.keys());
    for (let i = 0; i < agentIds.length; i++) {
      for (let j = i + 1; j < agentIds.length; j++) {
        mermaid += `  ${agentIds[i]} --- ${agentIds[j]}\n`;
      }
    }

    mermaid += '\n  style graph fill:#f9f,stroke:#333,stroke-width:2px\n';
    return mermaid;
  }

  // Private helper methods

  private findAvailableAgent(): string | null {
    // Find agent with minimum load
    let minLoad = Infinity;
    let bestAgent: string | null = null;

    for (const [agentId, load] of this.taskDistribution) {
      if (load < minLoad) {
        minLoad = load;
        bestAgent = agentId;
      }
    }

    return bestAgent;
  }

  private calculateLoadBalance(): number {
    if (this.taskDistribution.size === 0) return 1;

    const loads = Array.from(this.taskDistribution.values());
    const avgLoad = loads.reduce((sum, l) => sum + l, 0) / loads.length;

    if (avgLoad === 0) return 1;

    const variance = loads.reduce((sum, l) => sum + Math.pow(l - avgLoad, 2), 0) / loads.length;
    const stdDev = Math.sqrt(variance);

    // Lower std dev = better balance
    return Math.max(0, 1 - stdDev / (avgLoad + 1));
  }

  private findOverloadedAgents(): string[] {
    const overloaded: string[] = [];
    const avgLoad = Array.from(this.taskDistribution.values())
      .reduce((sum, l) => sum + l, 0) / this.taskDistribution.size;

    for (const [agentId, load] of this.taskDistribution) {
      if (load > avgLoad * 1.5) {
        overloaded.push(agentId);
      }
    }

    return overloaded;
  }

  private rebalanceTasks(): void {
    // Reset task distribution for next round
    // This is a simplified rebalancing - in practice, would reassign tasks
    for (const agentId of this.taskDistribution.keys()) {
      this.taskDistribution.set(agentId, 0);
    }
  }

  /**
   * Get task distribution statistics
   */
  getTaskDistribution(): Map<string, number> {
    return new Map(this.taskDistribution);
  }

  /**
   * Reset task distribution counters
   */
  resetTaskDistribution(): void {
    for (const agentId of this.taskDistribution.keys()) {
      this.taskDistribution.set(agentId, 0);
    }
  }
}
