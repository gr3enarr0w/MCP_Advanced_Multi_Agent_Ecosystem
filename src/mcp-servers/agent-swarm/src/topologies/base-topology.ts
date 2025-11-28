// Base Topology Interface
// Phase 9: Define common topology operations

import { Agent, Task, AgentMessage } from '../types/agents.js';

export interface TopologyConfig {
  type: 'hierarchical' | 'mesh' | 'star' | 'dynamic';
  maxAgents: number;
  coordinatorId?: string;
  layers?: number;  // For hierarchical
  metadata?: Record<string, any>;
}

export interface CommunicationPath {
  from: string;
  to: string;
  hops: number;
  path: string[];
  latency: number;
}

export interface TopologyMetrics {
  efficiency: number;         // 0-1 how efficient the topology is
  messageLatency: number;      // Average message latency
  loadBalance: number;         // 0-1 how balanced the load is
  bottlenecks: string[];       // Agent IDs that are bottlenecks
  connectivity: number;        // 0-1 how connected the agents are
}

/**
 * Base abstract class for all topology implementations
 */
export abstract class BaseTopology {
  protected config: TopologyConfig;
  protected agents: Map<string, Agent> = new Map();
  protected communicationGraph: Map<string, Set<string>> = new Map();

  constructor(config: TopologyConfig) {
    this.config = config;
  }

  /**
   * Add an agent to the topology
   */
  abstract addAgent(agent: Agent): Promise<void>;

  /**
   * Remove an agent from the topology
   */
  abstract removeAgent(agentId: string): Promise<void>;

  /**
   * Route a message from one agent to another
   */
  abstract routeMessage(message: AgentMessage): Promise<CommunicationPath>;

  /**
   * Route a task to the appropriate agent
   */
  abstract routeTask(task: Task): Promise<string>;  // Returns agent ID

  /**
   * Get all agents that can communicate with the given agent
   */
  abstract getNeighbors(agentId: string): string[];

  /**
   * Calculate topology metrics
   */
  abstract calculateMetrics(): TopologyMetrics;

  /**
   * Reorganize the topology (for dynamic topologies)
   */
  abstract reorganize(): Promise<void>;

  /**
   * Validate if topology is properly formed
   */
  abstract validate(): boolean;

  /**
   * Get the coordinator agent (if applicable)
   */
  getCoordinator(): string | undefined {
    return this.config.coordinatorId;
  }

  /**
   * Get all agents in the topology
   */
  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get topology configuration
   */
  getConfig(): TopologyConfig {
    return { ...this.config };
  }

  /**
   * Visualize topology as a Mermaid diagram
   */
  abstract visualize(): string;

  /**
   * Helper: Calculate shortest path between two agents
   */
  protected findShortestPath(from: string, to: string): string[] {
    if (from === to) return [from];

    const queue: Array<{ node: string; path: string[] }> = [{ node: from, path: [from] }];
    const visited = new Set<string>([from]);

    while (queue.length > 0) {
      const { node, path } = queue.shift()!;

      const neighbors = this.communicationGraph.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (neighbor === to) {
          return [...path, neighbor];
        }

        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push({ node: neighbor, path: [...path, neighbor] });
        }
      }
    }

    return [];  // No path found
  }

  /**
   * Helper: Check if topology is connected
   */
  protected isConnected(): boolean {
    if (this.agents.size === 0) return true;

    const start = Array.from(this.agents.keys())[0];
    const visited = new Set<string>();
    const queue = [start];

    while (queue.length > 0) {
      const node = queue.shift()!;
      if (visited.has(node)) continue;

      visited.add(node);

      const neighbors = this.communicationGraph.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }

    return visited.size === this.agents.size;
  }

  /**
   * Helper: Calculate average path length
   */
  protected calculateAveragePathLength(): number {
    const agentIds = Array.from(this.agents.keys());
    if (agentIds.length < 2) return 0;

    let totalLength = 0;
    let pathCount = 0;

    for (let i = 0; i < agentIds.length; i++) {
      for (let j = i + 1; j < agentIds.length; j++) {
        const path = this.findShortestPath(agentIds[i], agentIds[j]);
        if (path.length > 0) {
          totalLength += path.length - 1;  // Number of hops
          pathCount++;
        }
      }
    }

    return pathCount > 0 ? totalLength / pathCount : 0;
  }
}
