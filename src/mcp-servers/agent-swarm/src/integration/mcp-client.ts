import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export type MCPCommandConfig = {
  command: string;
  args: string[];
  env?: Record<string, string | undefined>;
};

/**
 * Lightweight MCP client wrapper that spawns a server over stdio,
 * connects, calls one tool, and disconnects.
 */
export class MCPClient {
  private config: MCPCommandConfig;

  constructor(config: MCPCommandConfig) {
    this.config = config;
  }

  async callTool(name: string, args: Record<string, any>) {
    const client = new Client({
      name: 'agent-swarm',
      version: '1.0.0',
    });

    const transport = new StdioClientTransport({
      command: this.config.command,
      args: this.config.args,
      env: this.config.env,
      stderr: 'inherit',
    });

    try {
      await client.connect(transport);
      const result = await client.callTool({
        name,
        arguments: args,
      });
      await client.close();
      await transport.close();
      return result;
    } catch (error) {
      await client.close().catch(() => {});
      await transport.close().catch(() => {});
      throw error;
    }
  }
}
