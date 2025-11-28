// Star Topology Implementation
// Phase 9: Central coordinator with spoke agents

import { Agent, Task, AgentMessage } from '../types/agents.js';
import { BaseTopology, TopologyConfig, CommunicationPath, TopologyMetrics } from './base-topology.js';

/**
 * Star topology: One central coordinator, all other agents connect to it
 *
 * All communication goes through the coordinator.
 * Coordinator distributes tasks and collects results.
 * Simple but coordinator can become a bottleneck.
 */
export class StarTopology extends BaseTopology {
  private spokeAgents: Set<string> = new Set();

  constructor(config: TopologyConfig) {
    super(config);

    if (!config.coordinatorId) {
      throw new Error('Star topology requires a coordinator ID in config');
    }
  }

  async addAgent(agent: Agent): Promise<void> {
    if (this.agents.size >= this.config.maxAgents) {
      throw new Error(`Cannot add agent: max agents (${this.config.maxAgents}) reached`);
    }

    this.agents.set(agent.id, agent);

    // Initialize communication graph for this agent
    if (!this.communicationGraph.has(agent.id)) {
      this.communicationGraph.set(agent.id, new Set());
    }

    // If this is the coordinator
    if (agent.id === this.config.coordinatorId) {
      // Connect to all existing spoke agents
      for (const spokeId of this.spokeAgents) {
        this.communicationGraph.get(agent.id)!.add(spokeId);
        this.communicationGraph.get(spokeId)!.add(agent.id);
      }
    } else {
      // This is a spoke agent
      this.spokeAgents.add(agent.id);

      // Connect to coordinator if it exists
      if (this.config.coordinatorId && this.agents.has(this.config.coordinatorId)) {
        this.communicationGraph.get(agent.id)!.add(this.config.coordinatorId);

        if (!this.communicationGraph.has(this.config.coordinatorId)) {
          this.communicationGraph.set(this.config.coordinatorId, new Set());
        }
        this.communicationGraph.get(this.config.coordinatorId)!.add(agent.id);
      }
    }
  }

  async removeAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    // If removing coordinator, we need to elect a new one
    if (agentId === this.config.coordinatorId) {
      await this.electNewCoordinator(agentId);
    }

    this.agents.delete(agentId);
    this.spokeAgents.delete(agentId);
    this.communicationGraph.delete(agentId);

    // Remove from other agents' neighbor lists
    for (const neighbors of this.communicationGraph.values()) {
      neighbors.delete(agentId);
    }
  }

  async routeMessage(message: AgentMessage): Promise<CommunicationPath> {
    const coordinatorId = this.config.coordinatorId!;

    if (!this.agents.has(message.from)) {
      throw new Error(`Agent ${message.from} not in topology`);
    }

    // Broadcast through coordinator
    if (!message.to) {
      if (message.from === coordinatorId) {
        // Coordinator broadcasts directly to all spokes
        const spokes = Array.from(this.spokeAgents);
        return {
          from: message.from,
          to: 'broadcast',
          hops: 1,
          path: [message.from, ...spokes],
          latency: 10
        };
      } else {
        // Spoke agent broadcasts through coordinator
        const spokes = Array.from(this.spokeAgents).filter(id => id !== message.from);
        return {
          from: message.from,
          to: 'broadcast',
          hops: 2,
          path: [message.from, coordinatorId, ...spokes],
          latency: 20
        };
      }
    }

    if (!this.agents.has(message.to)) {
      throw new Error(`Agent ${message.to} not in topology`);
    }

    // Direct message
    if (message.from === coordinatorId || message.to === coordinatorId) {
      // Direct connection to/from coordinator
      return {
        from: message.from,
        to: message.to,
        hops: 1,
        path: [message.from, message.to],
        latency: 10
      };
    } else {
      // Spoke to spoke goes through coordinator
      return {
        from: message.from,
        to: message.to,
        hops: 2,
        path: [message.from, coordinatorId, message.to],
        latency: 20
      };
    }
  }

  async routeTask(task: Task): Promise<string> {
    const coordinatorId = this.config.coordinatorId!;

    // Find suitable spoke agents
    const candidates = Array.from(this.spokeAgents)
      .map(id => this.agents.get(id)!)
      .filter(agent => {
        return agent.type === task.type && agent.status === 'idle';
      });

    if (candidates.length === 0) {
      // No idle agents of preferred type
      const anyIdle = Array.from(this.spokeAgents)
        .map(id => this.agents.get(id)!)
        .find(a => a.status === 'idle');

      if (anyIdle) return anyIdle.id;

      // No idle spokes, find least loaded spoke
      const leastLoaded = this.findLeastLoadedSpoke();
      if (leastLoaded) return leastLoaded;

      // Last resort: assign to coordinator
      return coordinatorId;
    }

    // Find least loaded among candidates
    const leastLoaded = candidates.reduce((min, agent) => {
      return agent.currentTasks.length < min.currentTasks.length ? agent : min;
    });

    return leastLoaded.id;
  }

  getNeighbors(agentId: string): string[] {
    const coordinatorId = this.config.coordinatorId!;

    if (agentId === coordinatorId) {
      // Coordinator is connected to all spokes
      return Array.from(this.spokeAgents);
    } else {
      // Spoke agent is only connected to coordinator
      return [coordinatorId];
    }
  }

  calculateMetrics(): TopologyMetrics {
    const coordinatorId = this.config.coordinatorId!;
    const coordinator = this.agents.get(coordinatorId);

    if (!coordinator) {
      return {
        efficiency: 0,
        messageLatency: Infinity,
        loadBalance: 0,
        bottlenecks: [],
        connectivity: 0
      };
    }

    // Average path length is 1 for coordinator, 2 for spoke-to-spoke
    const avgPathLength = this.spokeAgents.size > 0 ? 1.5 : 1;

    // Calculate load balance
    const loadBalance = this.calculateLoadBalance();

    // Coordinator is always a potential bottleneck in star topology
    const bottlenecks = [coordinatorId];

    // Check if coordinator is overloaded
    const coordinatorLoad = coordinator.currentTasks.length;
    const avgSpokeLoad = this.calculateAverageSpokeLoad();
    if (coordinatorLoad > avgSpokeLoad * 2) {
      // Coordinator is significantly more loaded
    }

    return {
      efficiency: 1 / avgPathLength,
      messageLatency: avgPathLength * 10,
      loadBalance,
      bottlenecks,
      connectivity: this.isConnected() ? 1 : 0
    };
  }

  async reorganize(): Promise<void> {
    // In star topology, reorganization means checking if coordinator should be changed
    const coordinatorId = this.config.coordinatorId!;
    const coordinator = this.agents.get(coordinatorId);

    if (!coordinator) {
      await this.electNewCoordinator();
      return;
    }

    // Check if coordinator is overloaded
    const coordinatorLoad = coordinator.currentTasks.length;
    const avgSpokeLoad = this.calculateAverageSpokeLoad();

    if (coordinatorLoad > avgSpokeLoad * 3) {
      // Coordinator is severely overloaded, consider switching
      const betterCandidate = this.findBestCoordinatorCandidate();
      if (betterCandidate && betterCandidate.id !== coordinatorId) {
        await this.switchCoordinator(betterCandidate.id);
      }
    }
  }

  validate(): boolean {
    const coordinatorId = this.config.coordinatorId;

    if (!coordinatorId || !this.agents.has(coordinatorId)) {
      return false;
    }

    // Check that all spoke agents are connected to coordinator
    for (const spokeId of this.spokeAgents) {
      const neighbors = this.communicationGraph.get(spokeId);
      if (!neighbors || !neighbors.has(coordinatorId)) {
        return false;
      }
    }

    // Check that coordinator is connected to all spokes
    const coordinatorNeighbors = this.communicationGraph.get(coordinatorId);
    if (!coordinatorNeighbors) return false;

    for (const spokeId of this.spokeAgents) {
      if (!coordinatorNeighbors.has(spokeId)) {
        return false;
      }
    }

    return true;
  }

  visualize(): string {
    const coordinatorId = this.config.coordinatorId!;
    const coordinator = this.agents.get(coordinatorId);

    let mermaid = 'graph TD\n';

    // Add coordinator node (center)
    if (coordinator) {
      const label = `COORD:${coordinator.type}:${coordinatorId.slice(0, 8)}`;
      mermaid += `  ${coordinatorId}[["${label}"]]\n`;
    }

    // Add spoke nodes and connections
    for (const spokeId of this.spokeAgents) {
      const spoke = this.agents.get(spokeId)!;
      const label = `${spoke.type}:${spokeId.slice(0, 8)}`;
      mermaid += `  ${spokeId}["${label}"]\n`;
      mermaid += `  ${coordinatorId} --- ${spokeId}\n`;
    }

    // Style coordinator node
    mermaid += `\n  style ${coordinatorId} fill:#f96,stroke:#333,stroke-width:4px\n`;

    return mermaid;
  }

  // Private helper methods

  private async electNewCoordinator(excludeId?: string): Promise<void> {
    const candidate = this.findBestCoordinatorCandidate(excludeId);

    if (!candidate) {
      throw new Error('No suitable coordinator candidate found');
    }

    await this.switchCoordinator(candidate.id);
  }

  private findBestCoordinatorCandidate(excludeId?: string): Agent | null {
    // Find agent with highest capacity and lowest current load
    let bestAgent: Agent | null = null;
    let bestScore = -Infinity;

    for (const [agentId, agent] of this.agents) {
      if (agentId === excludeId) continue;

      // Score based on capacity and current load
      const capacityScore = agent.maxConcurrentTasks;
      const loadPenalty = agent.currentTasks.length;
      const score = capacityScore - loadPenalty;

      if (score > bestScore) {
        bestScore = score;
        bestAgent = agent;
      }
    }

    return bestAgent;
  }

  private async switchCoordinator(newCoordinatorId: string): Promise<void> {
    const oldCoordinatorId = this.config.coordinatorId;

    // Update config
    this.config.coordinatorId = newCoordinatorId;

    // Move old coordinator to spokes if it exists
    if (oldCoordinatorId && this.agents.has(oldCoordinatorId)) {
      this.spokeAgents.add(oldCoordinatorId);
    }

    // Remove new coordinator from spokes
    this.spokeAgents.delete(newCoordinatorId);

    // Rebuild communication graph
    this.communicationGraph.clear();

    // Re-add all agents to rebuild connections
    const agents = Array.from(this.agents.values());
    this.agents.clear();
    this.spokeAgents.clear();

    for (const agent of agents) {
      await this.addAgent(agent);
    }
  }

  private findLeastLoadedSpoke(): string | null {
    let minLoad = Infinity;
    let leastLoaded: string | null = null;

    for (const spokeId of this.spokeAgents) {
      const agent = this.agents.get(spokeId);
      if (!agent) continue;

      if (agent.currentTasks.length < minLoad) {
        minLoad = agent.currentTasks.length;
        leastLoaded = spokeId;
      }
    }

    return leastLoaded;
  }

  private calculateLoadBalance(): number {
    if (this.agents.size === 0) return 1;

    const loads = Array.from(this.agents.values()).map(a => a.currentTasks.length);
    const avgLoad = loads.reduce((sum, l) => sum + l, 0) / loads.length;

    if (avgLoad === 0) return 1;

    const variance = loads.reduce((sum, l) => sum + Math.pow(l - avgLoad, 2), 0) / loads.length;
    const stdDev = Math.sqrt(variance);

    return Math.max(0, 1 - stdDev / (avgLoad + 1));
  }

  private calculateAverageSpokeLoad(): number {
    if (this.spokeAgents.size === 0) return 0;

    let totalLoad = 0;
    for (const spokeId of this.spokeAgents) {
      const agent = this.agents.get(spokeId);
      if (agent) {
        totalLoad += agent.currentTasks.length;
      }
    }

    return totalLoad / this.spokeAgents.size;
  }

  /**
   * Get coordinator load statistics
   */
  getCoordinatorStats(): {
    coordinatorId: string;
    load: number;
    spokeCount: number;
    avgSpokeLoad: number;
  } {
    const coordinatorId = this.config.coordinatorId!;
    const coordinator = this.agents.get(coordinatorId);

    return {
      coordinatorId,
      load: coordinator ? coordinator.currentTasks.length : 0,
      spokeCount: this.spokeAgents.size,
      avgSpokeLoad: this.calculateAverageSpokeLoad()
    };
  }
}
