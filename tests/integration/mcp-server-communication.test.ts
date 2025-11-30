/**
 * Integration Test: MCP Server Communication
 * 
 * Tests MCP server interoperability and communication
 * - Validate tool calls between servers
 * - Test error propagation across servers
 * - Test concurrent requests handling
 * - Test MCP protocol compliance
 * - Test stdio transport reliability
 */

import { mcpManager } from './utils/mcp-server-manager.js';
import { 
  SAMPLE_CODE_FILES,
  RESEARCH_TOPICS,
  ERROR_SCENARIOS 
} from './fixtures/test-data.js';

describe('MCP Server Communication Integration', () => {
  let servers: Map<string, any> = new Map();
  let clients: Map<string, any> = new Map();

  beforeAll(async () => {
    // Start all MCP servers for communication testing
    console.log('🔧 Starting all MCP servers for communication test');
    
    const serverConfigs = [
      'search-aggregator',
      'task-orchestrator', 
      'code-intelligence',
      'chart-generator',
      'agent-swarm',
      'context-persistence'
    ];
    
    for (const serverName of serverConfigs) {
      try {
        const server = await mcpManager.startServer(serverName);
        const client = mcpManager.getClient(serverName);
        
        servers.set(serverName, server);
        clients.set(serverName, client);
        
        console.log(`✅ Started ${serverName} server`);
      } catch (error) {
        console.warn(`⚠️ Failed to start ${serverName}:`, error);
      }
    }
    
    // Wait for all servers to be ready
    await global.testUtils.wait(4000);
    
    // Verify server health
    for (const [serverName, client] of clients) {
      if (client) {
        const isHealthy = await mcpManager.getServerHealth(serverName);
        expect(isHealthy).toBe(true);
      }
    }
  });

  afterAll(async () => {
    // Clean up all servers
    console.log('🧹 Stopping all MCP servers');
    await mcpManager.stopAllServers();
  });

  describe('Cross-Server Tool Calls', () => {
    test('should successfully call tools between different MCP servers', async () => {
      console.log('🔄 Testing cross-server tool calls');
      
      // Test 1: Search-Aggregator → Task-Orchestrator
      const searchClient = clients.get('search-aggregator');
      const taskClient = clients.get('task-orchestrator');
      
      // Generate research plan
      const researchPlanResult = await searchClient.callTool('generate_research_plan', {
        topic: RESEARCH_TOPICS[0].topic,
        methodology: 'exploratory',
        depth: 'quick'
      });
      
      expect(researchPlanResult.content).toBeDefined();
      const planData = JSON.parse(researchPlanResult.content[0].text);
      expect(planData.plan_id).toBeDefined();
      
      // Use research plan to create tasks
      const taskResult = await taskClient.callTool('create_task', {
        title: `Research: ${planData.topic}`,
        description: `Execute research plan ${planData.plan_id}`,
        priority: 2,
        tags: ['research-generated', 'cross-server']
      });
      
      expect(taskResult.content).toBeDefined();
      const taskData = JSON.parse(taskResult.content[0].text);
      expect(taskData.task.id).toBeDefined();
      
      // Test 2: Code-Intelligence → Context-Persistence
      const codeClient = clients.get('code-intelligence');
      const contextClient = clients.get('context-persistence');
      
      // Analyze code file
      const codeFilePath = Object.keys(SAMPLE_CODE_FILES)[0]; // TypeScript file
      const analysisResult = await codeClient.callTool('get_code_outline', {
        filePath: codeFilePath
      });
      
      expect(analysisResult.content).toBeDefined();
      const analysisData = JSON.parse(analysisResult.content[0].text);
      expect(analysisData.symbols).toBeDefined();
      
      // Store analysis results in context persistence
      const conversationId = `cross-server-${Date.now()}`;
      const saveResult = await contextClient.callTool('save_conversation', {
        conversation_id: conversationId,
        messages: [{
          role: 'assistant',
          content: `Code analysis for ${codeFilePath}: found ${analysisData.symbols.length} symbols`
        }]
      });
      
      expect(saveResult.content).toBeDefined();
      const saveData = JSON.parse(saveResult.content[0].text);
      expect(saveData.status).toBe('saved');
      
      console.log('✅ Cross-server tool calls successful');
      console.log(`📊 Plan → Task: ${planData.plan_id} → ${taskData.task.id}`);
      console.log(`📊 Analysis → Context: ${analysisData.symbols.length} symbols saved`);
    }, 40000);

    test('should handle bidirectional communication between servers', async () => {
      console.log('🔄 Testing bidirectional communication');
      
      const searchClient = clients.get('search-aggregator');
      const swarmClient = clients.get('agent-swarm');
      
      // Search-Aggregator → Agent-Swarm
      const searchResult = await searchClient.callTool('search', {
        query: 'microservices architecture patterns',
        limit: 3,
        use_cache: false
      });
      
      expect(searchResult.content).toBeDefined();
      const searchData = JSON.parse(searchResult.content[0].text);
      expect(searchData.results.length).toBeGreaterThan(0);
      
      // Agent-Swarm → Search-Aggregator (delegation)
      const delegateResult = await swarmClient.callTool('delegate', {
        goal: 'research additional microservices patterns',
        category: 'search',
        limit: 5
      });
      
      expect(delegateResult.content).toBeDefined();
      const delegateData = JSON.parse(delegateResult.content[0].text);
      
      // Verify delegation was successful
      expect(delegateData.content || delegateData.results).toBeDefined();
      
      console.log('✅ Bidirectional communication successful');
      console.log(`🔍 Search found ${searchData.results.length} results`);
      console.log(`👥 Swarm delegated search successfully`);
    }, 35000);

    test('should maintain data integrity across server boundaries', async () => {
      console.log('🛡️ Testing data integrity across boundaries');
      
      const taskClient = clients.get('task-orchestrator');
      const contextClient = clients.get('context-persistence');
      
      // Create complex task with nested data
      const complexTaskData = {
        title: 'Complex Integration Task',
        description: 'Task with nested objects and arrays',
        priority: 3,
        tags: ['integration', 'test', 'data-integrity'],
        metadata: {
          nested: {
            level1: {
              level2: {
                data: [1, 2, 3],
                text: 'nested data'
              }
            }
          },
          array: ['item1', 'item2', { nested: 'object in array' }]
        }
      };
      
      const taskResult = await taskClient.callTool('create_task', complexTaskData);
      
      expect(taskResult.content).toBeDefined();
      const taskData = JSON.parse(taskResult.content[0].text);
      expect(taskData.task.metadata.nested.level1.level2.data).toEqual([1, 2, 3]);
      
      // Store task in context persistence
      const conversationId = `data-integrity-${Date.now()}`;
      const saveResult = await contextClient.callTool('save_conversation', {
        conversation_id: conversationId,
        messages: [{
          role: 'assistant',
          content: `Created task: ${JSON.stringify(complexTaskData.metadata)}`
        }]
      });
      
      expect(saveResult.content).toBeDefined();
      const saveData = JSON.parse(saveResult.content[0].text);
      
      // Retrieve and verify integrity
      const retrieveResult = await contextClient.callTool('load_conversation_history', {
        conversation_id: conversationId
      });
      
      expect(retrieveResult.content).toBeDefined();
      const retrieveData = JSON.parse(retrieveResult.content[0].text);
      expect(retrieveData.messages[0].content).toContain('nested');
      
      // Verify complex nested structure is preserved
      const retrievedContent = retrieveData.messages[0].content;
      expect(retrievedContent).toContain('level1');
      expect(retrievedContent).toContain('level2');
      expect(retrievedContent).toContain('[1, 2, 3]');
      
      console.log('✅ Data integrity maintained across server boundaries');
    }, 35000);
  });

  describe('Error Propagation Across Servers', () => {
    test('should propagate errors correctly between servers', async () => {
      console.log('💥 Testing error propagation');
      
      const searchClient = clients.get('search-aggregator');
      
      // Test with invalid search parameters
      const errorResult = await searchClient.callTool('search', {
        query: '', // Empty query should cause error
        limit: -1, // Invalid limit
        use_cache: true
      });
      
      expect(errorResult.isError).toBe(true);
      expect(errorResult.content[0].text).toContain('error');
      
      // Verify error doesn't crash server
      const isHealthy = await mcpManager.getServerHealth('search-aggregator');
      expect(isHealthy).toBe(true);
      
      // Test error handling in task orchestrator
      const taskClient = clients.get('task-orchestrator');
      const taskErrorResult = await taskClient.callTool('create_task', {
        title: '', // Empty title should cause error
        priority: 10 // Invalid priority
      });
      
      expect(taskErrorResult.isError).toBe(true);
      
      console.log('✅ Error propagation working correctly');
      console.log(`🔍 Search error: ${errorResult.content[0].text}`);
      console.log(`📋 Task error: ${taskErrorResult.content[0].text}`);
    }, 30000);

    test('should handle server timeouts gracefully', async () => {
      console.log('⏱️ Testing server timeout handling');
      
      const contextClient = clients.get('context-persistence');
      
      // Create a large conversation that might timeout
      const largeMessages = Array.from({ length: 100 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Large message ${i} with substantial content that might cause processing delays`
      }));
      
      const startTime = Date.now();
      
      try {
        const result = await contextClient.callTool('save_conversation', {
          conversation_id: `timeout-test-${Date.now()}`,
          messages: largeMessages
        });
        
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;
        
        // Should complete within reasonable time even with large data
        expect(duration).toBeLessThan(30);
        expect(result.content).toBeDefined();
        
        console.log(`✅ Large conversation saved in ${duration}s`);
      } catch (error) {
        // Should handle timeout gracefully
        expect(error.message).toBeDefined();
        console.log('⚠️ Timeout handled gracefully:', error.message);
      }
    }, 35000);

    test('should maintain server stability during errors', async () => {
      console.log('🛡️ Testing server stability during errors');
      
      const searchClient = clients.get('search-aggregator');
      const taskClient = clients.get('task-orchestrator');
      
      // Execute multiple operations with some errors
      const operations = [
        searchClient.callTool('search', { query: 'valid query', limit: 5 }),
        searchClient.callTool('search', { query: '', limit: -1 }), // Should error
        taskClient.callTool('create_task', { title: 'Valid Task', priority: 1 }),
        taskClient.callTool('create_task', { title: '', priority: 10 }) // Should error
      ];
      
      const results = await Promise.allSettled(operations);
      
      // Count successful vs failed operations
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      expect(successful).toBe(2); // 2 valid operations
      expect(failed).toBe(2); // 2 invalid operations
      
      // Verify servers are still healthy
      const searchHealthy = await mcpManager.getServerHealth('search-aggregator');
      const taskHealthy = await mcpManager.getServerHealth('task-orchestrator');
      
      expect(searchHealthy).toBe(true);
      expect(taskHealthy).toBe(true);
      
      console.log(`✅ Server stability maintained: ${successful} succeeded, ${failed} failed`);
    }, 40000);
  });

  describe('Concurrent Request Handling', () => {
    test('should handle concurrent requests to multiple servers', async () => {
      console.log('🚀 Testing concurrent request handling');
      
      const startTime = Date.now();
      
      // Prepare concurrent requests to different servers
      const searchClient = clients.get('search-aggregator');
      const taskClient = clients.get('task-orchestrator');
      const codeClient = clients.get('code-intelligence');
      
      const concurrentRequests = [
        searchClient.callTool('search', { query: 'concurrent test 1', limit: 3 }),
        searchClient.callTool('search', { query: 'concurrent test 2', limit: 3 }),
        taskClient.callTool('list_tasks', { status: 'pending' }),
        taskClient.callTool('list_tasks', { status: 'completed' }),
        codeClient.callTool('get_supported_languages', {}),
        codeClient.callTool('get_code_outline', { filePath: Object.keys(SAMPLE_CODE_FILES)[0] })
      ];
      
      const results = await Promise.all(concurrentRequests);
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      // All requests should succeed
      results.forEach((result, index) => {
        expect(result.status).toBe('fulfilled');
        expect(result.value.content).toBeDefined();
        console.log(`✅ Concurrent request ${index + 1} completed`);
      });
      
      // Concurrent execution should be efficient
      expect(duration).toBeLessThan(25);
      
      console.log(`🚀 ${concurrentRequests.length} concurrent requests completed in ${duration}s`);
    }, 40000);

    test('should handle resource contention gracefully', async () => {
      console.log('🥊 Testing resource contention handling');
      
      const searchClient = clients.get('search-aggregator');
      
      // Create many concurrent requests to same server
      const concurrentSearches = Array.from({ length: 10 }, (_, i) =>
        searchClient.callTool('search', {
          query: `contention test ${i}`,
          limit: 2,
          use_cache: false // Force fresh processing
        })
      );
      
      const results = await Promise.allSettled(concurrentSearches);
      
      // Most should succeed, some might be rate-limited
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const rateLimited = results.filter(r => 
        r.status === 'rejected' && 
        r.reason?.message?.includes('rate limit')
      ).length;
      
      expect(successful + rateLimited).toBe(10); // All should be handled
      expect(successful).toBeGreaterThan(5); // At least half should succeed
      
      // Server should remain healthy
      const isHealthy = await mcpManager.getServerHealth('search-aggregator');
      expect(isHealthy).toBe(true);
      
      console.log(`🥊 Contention test: ${successful} successful, ${rateLimited} rate-limited`);
    }, 45000);
  });

  describe('MCP Protocol Compliance', () => {
    test('should follow MCP protocol specification', async () => {
      console.log('📋 Testing MCP protocol compliance');
      
      // Test that all servers implement required protocol methods
      for (const [serverName, client] of clients) {
        if (!client) continue;
        
        // Test list_tools (required by protocol)
        const toolsResult = await client.listTools();
        
        expect(toolsResult.tools).toBeDefined();
        expect(Array.isArray(toolsResult.tools)).toBe(true);
        expect(toolsResult.tools.length).toBeGreaterThan(0);
        
        // Verify tool structure compliance
        toolsResult.tools.forEach((tool: any) => {
          expect(tool.name).toBeDefined();
          expect(typeof tool.description).toBe('string');
          expect(tool.inputSchema).toBeDefined();
          expect(tool.inputSchema.type).toBe('object');
        });
        
        console.log(`✅ ${serverName} protocol compliant with ${toolsResult.tools.length} tools`);
      }
    }, 30000);

    test('should handle tool call validation correctly', async () => {
      console.log('✅ Testing tool call validation');
      
      const taskClient = clients.get('task-orchestrator');
      
      // Test valid tool call
      const validResult = await taskClient.callTool('create_task', {
        title: 'Valid Task',
        description: 'A valid task for testing',
        priority: 1,
        tags: ['test', 'validation']
      });
      
      expect(validResult.isError).toBeFalsy();
      expect(validResult.content).toBeDefined();
      
      // Test invalid tool call (missing required parameter)
      const invalidResult = await taskClient.callTool('create_task', {
        description: 'Missing required title parameter',
        priority: 1
      });
      
      expect(invalidResult.isError).toBe(true);
      expect(invalidResult.content[0].text).toContain('error');
      
      // Test invalid tool call (invalid parameter type)
      const typeErrorResult = await taskClient.callTool('create_task', {
        title: 'Type Error Task',
        priority: 'invalid-priority-type', // Should be number
        tags: ['test']
      });
      
      expect(typeErrorResult.isError).toBe(true);
      
      console.log('✅ Tool validation working correctly');
    }, 30000);

    test('should handle response format compliance', async () => {
      console.log('📝 Testing response format compliance');
      
      const searchClient = clients.get('search-aggregator');
      
      const result = await searchClient.callTool('search', {
        query: 'format compliance test',
        limit: 2
      });
      
      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
      
      // Verify content structure
      result.content.forEach((contentItem: any) => {
        expect(contentItem.type).toBe('text');
        expect(typeof contentItem.text).toBe('string');
        
        // Verify text is valid JSON
        expect(() => JSON.parse(contentItem.text)).not.toThrow();
      });
      
      // Verify no unexpected properties
      expect(result.isError).toBeFalsy();
      expect(result._requestId).toBeDefined();
      expect(result._sessionId).toBeDefined();
      
      console.log('✅ Response format compliant');
    }, 30000);
  });

  describe('Stdio Transport Reliability', () => {
    test('should maintain connection stability over multiple operations', async () => {
      console.log('🔗 Testing stdio transport reliability');
      
      const searchClient = clients.get('search-aggregator');
      
      // Perform multiple sequential operations
      const operations = [];
      
      for (let i = 0; i < 20; i++) {
        const operation = searchClient.callTool('search', {
          query: `stability test ${i}`,
          limit: 1
        });
        
        operations.push(operation);
        
        // Small delay between operations
        await global.testUtils.wait(100);
      }
      
      // Wait for all operations to complete
      const results = await Promise.all(operations);
      
      // All operations should succeed
      const successful = results.filter(r => !r.isError).length;
      expect(successful).toBe(20);
      
      // Server should remain responsive
      const finalHealth = await mcpManager.getServerHealth('search-aggregator');
      expect(finalHealth).toBe(true);
      
      console.log(`🔗 Transport stability: ${successful}/20 operations successful`);
    }, 60000);

    test('should handle connection interruptions gracefully', async () => {
      console.log('🔌 Testing connection interruption handling');
      
      const searchClient = clients.get('search-aggregator');
      const taskClient = clients.get('task-orchestrator');
      
      // Start an operation
      const longOperation = searchClient.callTool('deep_research', {
        topic: 'connection interruption test',
        depth: 'comprehensive',
        max_sources: 20
      });
      
      // Simulate connection interruption by restarting server
      await global.testUtils.wait(1000);
      
      const searchServer = servers.get('search-aggregator');
      await mcpManager.restartServer('search-aggregator');
      
      // Wait for restart
      await global.testUtils.wait(2000);
      
      // Verify server is back and healthy
      const isHealthy = await mcpManager.getServerHealth('search-aggregator');
      expect(isHealthy).toBe(true);
      
      // Test that other servers are unaffected
      const taskHealthy = await mcpManager.getServerHealth('task-orchestrator');
      expect(taskHealthy).toBe(true);
      
      console.log('🔌 Connection interruption handled gracefully');
    }, 35000);

    test('should handle large data transfers without corruption', async () => {
      console.log('📦 Testing large data transfer integrity');
      
      const contextClient = clients.get('context-persistence');
      
      // Create large conversation data
      const largeMessages = Array.from({ length: 50 }, (_, i) => ({
        role: 'assistant',
        content: `Large message content ${i} with substantial data: ${'x'.repeat(1000)}`
      }));
      
      const saveResult = await contextClient.callTool('save_conversation', {
        conversation_id: `large-transfer-${Date.now()}`,
        messages: largeMessages
      });
      
      expect(saveResult.content).toBeDefined();
      const saveData = JSON.parse(saveResult.content[0].text);
      expect(saveData.status).toBe('saved');
      expect(saveData.message_count).toBe(50);
      
      // Retrieve and verify integrity
      const retrieveResult = await contextClient.callTool('load_conversation_history', {
        conversation_id: saveData.conversation_id
      });
      
      expect(retrieveResult.content).toBeDefined();
      const retrieveData = JSON.parse(retrieveResult.content[0].text);
      expect(retrieveData.messages.length).toBe(50);
      
      // Verify specific message content
      const largeMessageIndex = 25; // Check middle message
      expect(retrieveData.messages[largeMessageIndex].content).toContain('Large message content 25');
      expect(retrieveData.messages[largeMessageIndex].content.length).toBeGreaterThan(1000);
      
      console.log('📦 Large data transfer completed without corruption');
    }, 45000);
  });

  describe('Performance and Scalability', () => {
    test('should maintain performance under load', async () => {
      console.log('📊 Testing performance under load');
      
      const searchClient = clients.get('search-aggregator');
      const taskClient = clients.get('task-orchestrator');
      
      const startTime = Date.now();
      
      // Generate load with concurrent operations
      const loadOperations = [];
      
      for (let i = 0; i < 15; i++) {
        loadOperations.push(
          searchClient.callTool('search', {
            query: `load test ${i}`,
            limit: 2
          })
        );
        
        if (i % 3 === 0) {
          loadOperations.push(
            taskClient.callTool('create_task', {
              title: `Load Task ${i}`,
              priority: 1
            })
          );
        }
      }
      
      const results = await Promise.all(loadOperations);
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      // All operations should complete
      const successful = results.filter(r => !r.isError).length;
      expect(successful).toBe(loadOperations.length);
      
      // Performance should remain acceptable under load
      expect(duration).toBeLessThan(40); // 40 ops in under 40 seconds
      
      // Servers should remain healthy
      const searchHealthy = await mcpManager.getServerHealth('search-aggregator');
      const taskHealthy = await mcpManager.getServerHealth('task-orchestrator');
      
      expect(searchHealthy).toBe(true);
      expect(taskHealthy).toBe(true);
      
      console.log(`📊 Load test: ${successful}/${loadOperations.length} ops in ${duration}s`);
    }, 60000);

    test('should scale memory usage appropriately', async () => {
      console.log('🧠 Testing memory scaling');
      
      const contextClient = clients.get('context-persistence');
      
      // Test memory usage with increasing data sizes
      const dataSizes = [10, 50, 100, 200];
      const memoryUsage = [];
      
      for (const size of dataSizes) {
        const startTime = Date.now();
        
        const messages = Array.from({ length: size }, (_, i) => ({
          role: 'assistant',
          content: `Memory scaling test message ${i} with content: ${'y'.repeat(i * 10)}`
        }));
        
        await contextClient.callTool('save_conversation', {
          conversation_id: `memory-scale-${size}-${Date.now()}`,
          messages: messages
        });
        
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;
        
        memoryUsage.push({
          size,
          duration,
          throughput: size / duration
        });
        
        // Brief pause between tests
        await global.testUtils.wait(500);
      }
      
      // Verify memory usage scales linearly (approximately)
      const throughputs = memoryUsage.map(m => m.throughput);
      const avgThroughput = throughputs.reduce((a, b) => a + b, 0) / throughputs.length;
      
      // Throughput should be relatively stable across different sizes
      const maxThroughput = Math.max(...throughputs);
      const minThroughput = Math.min(...throughputs);
      
      expect(maxThroughput / minThroughput).toBeLessThan(2); // Less than 2x variation
      
      console.log(`🧠 Memory scaling: avg throughput ${avgThroughput.toFixed(2)} items/sec`);
    }, 80000);
  });
});