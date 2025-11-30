/**
 * MCP Server Management Utilities for Integration Tests
 * 
 * Provides utilities to start, stop, and communicate with MCP servers
 * during integration testing. Handles both TypeScript and Python servers.
 */

import { spawn, ChildProcess } from 'cross-spawn';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { writeFile, readFile, remove } from 'fs-extra';

export interface MCPServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
  timeout?: number;
}

export interface MCPServerProcess {
  config: MCPServerConfig;
  process: ChildProcess;
  client: Client | null;
  startTime: number;
  ready: boolean;
}

export class MCPServerManager {
  private servers: Map<string, MCPServerProcess> = new Map();
  private testDataDir: string;
  private mcpHome: string;

  constructor(testDataDir?: string) {
    this.testDataDir = testDataDir || join(process.cwd(), 'test-data');
    this.mcpHome = join(this.testDataDir, '.mcp');
    
    // Ensure test data directory exists
    if (!existsSync(this.testDataDir)) {
      mkdirSync(this.testDataDir, { recursive: true });
    }
    if (!existsSync(this.mcpHome)) {
      mkdirSync(this.mcpHome, { recursive: true });
    }
  }

  /**
   * Get server configurations for all MCP servers
   */
  getServerConfigs(): Record<string, MCPServerConfig> {
    const projectRoot = resolve(__dirname, '../../..');
    
    return {
      'search-aggregator': {
        name: 'search-aggregator',
        command: 'node',
        args: [
          join(projectRoot, 'src/mcp-servers/search-aggregator/dist/index.js')
        ],
        env: {
          ...process.env,
          NODE_ENV: 'test',
          MCP_HOME: this.mcpHome,
          TAVILY_API_KEY: 'test-key',
          PERPLEXITY_API_KEY: 'test-key',
          BRAVE_API_KEY: 'test-key'
        },
        timeout: 30000
      },
      
      'task-orchestrator': {
        name: 'task-orchestrator',
        command: 'node',
        args: [
          join(projectRoot, 'src/mcp-servers/task-orchestrator/dist/index.js')
        ],
        env: {
          ...process.env,
          NODE_ENV: 'test',
          MCP_HOME: this.mcpHome
        },
        timeout: 30000
      },
      
      'code-intelligence': {
        name: 'code-intelligence',
        command: 'node',
        args: [
          join(projectRoot, 'src/mcp-servers/code-intelligence/dist/index.js')
        ],
        env: {
          ...process.env,
          NODE_ENV: 'test'
        },
        timeout: 30000
      },
      
      'chart-generator': {
        name: 'chart-generator',
        command: 'node',
        args: [
          join(projectRoot, 'src/mcp-servers/chart-generator/dist/index.js')
        ],
        env: {
          ...process.env,
          NODE_ENV: 'test'
        },
        timeout: 30000
      },
      
      'agent-swarm': {
        name: 'agent-swarm',
        command: 'node',
        args: [
          join(projectRoot, 'src/mcp-servers/agent-swarm/dist/index.js')
        ],
        env: {
          ...process.env,
          NODE_ENV: 'test',
          MCP_HOME: this.mcpHome,
          SEARCH_MCP_CMD: 'node',
          SEARCH_MCP_ARGS: join(projectRoot, 'src/mcp-servers/search-aggregator/dist/index.js'),
          TASK_MCP_CMD: 'node',
          TASK_MCP_ARGS: join(projectRoot, 'src/mcp-servers/task-orchestrator/dist/index.js')
        },
        timeout: 30000
      },
      
      'context-persistence': {
        name: 'context-persistence',
        command: 'python3',
        args: [
          '-m',
          'context_persistence.server'
        ],
        cwd: join(projectRoot, 'src/mcp-servers/context-persistence/src'),
        env: {
          ...process.env,
          PYTHONPATH: join(projectRoot, 'src/mcp-servers/context-persistence/src'),
          MCP_HOME: this.mcpHome,
          MCP_ALLOW_MODEL_DOWNLOAD: '1'
        },
        timeout: 45000 // Python server needs more time to start
      }
    };
  }

  /**
   * Start an MCP server
   */
  async startServer(serverKey: string): Promise<MCPServerProcess> {
    const configs = this.getServerConfigs();
    const config = configs[serverKey];
    
    if (!config) {
      throw new Error(`Unknown server: ${serverKey}`);
    }

    if (this.servers.has(serverKey)) {
      throw new Error(`Server ${serverKey} is already running`);
    }

    console.log(`🚀 Starting MCP server: ${serverKey}`);
    
    const process = spawn(config.command, config.args, {
      env: config.env || process.env,
      cwd: config.cwd,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const serverProcess: MCPServerProcess = {
      config,
      process,
      client: null,
      startTime: Date.now(),
      ready: false
    };

    // Set up error handling
    process.on('error', (error) => {
      console.error(`❌ Server ${serverKey} failed to start:`, error);
      serverProcess.ready = false;
    });

    process.on('exit', (code, signal) => {
      console.log(`📴 Server ${serverKey} exited with code ${code}, signal ${signal}`);
      serverProcess.ready = false;
      this.servers.delete(serverKey);
    });

    // Capture output for debugging
    if (process.stderr) {
      process.stderr.on('data', (data) => {
        console.error(`[${serverKey}] ${data.toString()}`);
      });
    }

    if (process.stdout) {
      process.stdout.on('data', (data) => {
        console.log(`[${serverKey}] ${data.toString()}`);
      });
    }

    this.servers.set(serverKey, serverProcess);

    // Wait for server to be ready
    await this.waitForServerReady(serverProcess);
    
    // Create MCP client
    serverProcess.client = await this.createClient(serverProcess);
    
    return serverProcess;
  }

  /**
   * Stop an MCP server
   */
  async stopServer(serverKey: string): Promise<void> {
    const serverProcess = this.servers.get(serverKey);
    
    if (!serverProcess) {
      console.warn(`⚠️ Server ${serverKey} is not running`);
      return;
    }

    console.log(`🛑 Stopping MCP server: ${serverKey}`);
    
    // Close client connection if exists
    if (serverProcess.client) {
      try {
        await serverProcess.client.close();
      } catch (error) {
        console.warn(`⚠️ Error closing client for ${serverKey}:`, error);
      }
    }

    // Terminate process
    if (serverProcess.process && !serverProcess.process.killed) {
      serverProcess.process.kill('SIGTERM');
      
      // Force kill if it doesn't exit gracefully
      setTimeout(() => {
        if (serverProcess.process && !serverProcess.process.killed) {
          console.warn(`⚠️ Force killing server ${serverKey}`);
          serverProcess.process.kill('SIGKILL');
        }
      }, 5000);
    }

    this.servers.delete(serverKey);
  }

  /**
   * Stop all running servers
   */
  async stopAllServers(): Promise<void> {
    const stopPromises = Array.from(this.servers.keys()).map(serverKey => 
      this.stopServer(serverKey)
    );
    
    await Promise.all(stopPromises);
  }

  /**
   * Get a running server process
   */
  getServer(serverKey: string): MCPServerProcess | undefined {
    return this.servers.get(serverKey);
  }

  /**
   * Get MCP client for a server
   */
  getClient(serverKey: string): Client | null {
    const serverProcess = this.servers.get(serverKey);
    return serverProcess?.client || null;
  }

  /**
   * Wait for server to be ready by checking for expected output
   */
  private async waitForServerReady(serverProcess: MCPServerProcess): Promise<void> {
    const timeout = serverProcess.config.timeout || 30000;
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const checkReady = () => {
        if (serverProcess.ready) {
          resolve();
          return;
        }
        
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Server ${serverProcess.config.name} failed to start within ${timeout}ms`));
          return;
        }
        
        setTimeout(checkReady, 100);
      };
      
      // Check process stderr for ready message
      if (serverProcess.process.stderr) {
        serverProcess.process.stderr.once('data', (data) => {
          const output = data.toString();
          if (output.includes('running on stdio') || output.includes('initialized')) {
            serverProcess.ready = true;
            console.log(`✅ Server ${serverProcess.config.name} is ready`);
            resolve();
          }
        });
      }
      
      // Start checking
      checkReady();
    });
  }

  /**
   * Create MCP client for server process
   */
  private async createClient(serverProcess: MCPServerProcess): Promise<Client> {
    const client = new Client(
      {
        name: `test-client-${serverProcess.config.name}`,
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    const transport = new StdioServerTransport();
    
    try {
      await client.connect(transport);
      return client;
    } catch (error) {
      console.error(`❌ Failed to connect client to ${serverProcess.config.name}:`, error);
      throw error;
    }
  }

  /**
   * Create test data directory and files
   */
  async setupTestData(): Promise<void> {
    // Create test directories
    const dirs = [
      join(this.testDataDir, 'projects'),
      join(this.testDataDir, 'code'),
      join(this.testDataDir, 'docs'),
      join(this.mcpHome, 'context'),
      join(this.mcpHome, 'tasks'),
      join(this.mcpHome, 'cache')
    ];

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }

    // Create test environment file
    const envFile = join(this.testDataDir, '.env.test');
    await writeFile(envFile, `
NODE_ENV=test
MCP_HOME=${this.mcpHome}
TAVILY_API_KEY=test-key
PERPLEXITY_API_KEY=test-key
BRAVE_API_KEY=test-key
MCP_ALLOW_MODEL_DOWNLOAD=1
PYTHONPATH=${resolve(__dirname, '../../src/mcp-servers/context-persistence/src')}
`);
  }

  /**
   * Clean up test data
   */
  async cleanupTestData(): Promise<void> {
    try {
      if (existsSync(this.testDataDir)) {
        await remove(this.testDataDir);
      }
    } catch (error) {
      console.warn('⚠️ Error cleaning up test data:', error);
    }
  }

  /**
   * Get server health status
   */
  async getServerHealth(serverKey: string): Promise<boolean> {
    const client = this.getClient(serverKey);
    
    if (!client) {
      return false;
    }

    try {
      // Try to list tools as a health check
      await client.listTools();
      return true;
    } catch (error) {
      console.warn(`⚠️ Health check failed for ${serverKey}:`, error);
      return false;
    }
  }

  /**
   * Restart a server
   */
  async restartServer(serverKey: string): Promise<MCPServerProcess> {
    await this.stopServer(serverKey);
    await global.testUtils.wait(1000); // Brief pause
    return this.startServer(serverKey);
  }
}

// Global instance for tests
export const mcpManager = new MCPServerManager();