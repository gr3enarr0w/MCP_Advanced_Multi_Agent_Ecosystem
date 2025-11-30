/**
 * Integration Test: Agent Swarm Orchestration Workflow
 * 
 * Tests multi-agent workflow: Agent-Swarm (Phase 9) → Task-Orchestrator (Phase 7) → Search-Aggregator (Phase 8)
 * - Create swarm session → Spawn workers → Delegate tasks → Execute research → Generate reports
 * - Validate tiered memory usage across workflow
 * - Test worker coordination and task distribution
 * - Test session checkpoint and recovery during workflow
 */

import { mcpManager } from './utils/mcp-server-manager.js';
import { 
  RESEARCH_TOPICS, 
  AGENT_SWARM_CONFIGS,
  WORKFLOW_SCENARIOS,
  ERROR_SCENARIOS 
} from './fixtures/test-data.js';

describe('Agent Swarm Orchestration Workflow Integration', () => {
  let swarmClient: any;
  let taskClient: any;
  let searchClient: any;
  let swarmServer: any;
  let taskServer: any;
  let searchServer: any;

  beforeAll(async () => {
    // Start required MCP servers
    console.log('🔧 Starting MCP servers for agent-swarm-orchestration workflow test');
    
    swarmServer = await mcpManager.startServer('agent-swarm');
    taskServer = await mcpManager.startServer('task-orchestrator');
    searchServer = await mcpManager.startServer('search-aggregator');
    
    swarmClient = mcpManager.getClient('agent-swarm');
    taskClient = mcpManager.getClient('task-orchestrator');
    searchClient = mcpManager.getClient('search-aggregator');
    
    // Wait for servers to be fully ready
    await global.testUtils.wait(3000);
    
    // Verify servers are healthy
    expect(await mcpManager.getServerHealth('agent-swarm')).toBe(true);
    expect(await mcpManager.getServerHealth('task-orchestrator')).toBe(true);
    expect(await mcpManager.getServerHealth('search-aggregator')).toBe(true);
  });

  afterAll(async () => {
    // Clean up servers
    console.log('🧹 Stopping MCP servers');
    await mcpManager.stopAllServers();
  });

  describe('Complete Agent Swarm Workflow', () => {
    test('should execute end-to-end multi-agent workflow successfully', async () => {
      const startTime = Date.now();
      const projectId = `swarm-test-${Date.now()}`;
      
      // Step 1: Create swarm session
      console.log('🐝 Step 1: Creating swarm session');
      const sessionResult = await swarmClient.callTool('swarm_session_create', {
        projectId: projectId,
        name: 'Test Swarm Session',
        topology: 'hierarchical',
        description: 'Integration test session for multi-agent coordination',
        maxAgents: 10
      });
      
      expect(sessionResult.content).toBeDefined();
      const sessionData = JSON.parse(sessionResult.content[0].text);
      expect(sessionData.session.id).toBeDefined();
      expect(sessionData.session.topology).toBe('hierarchical');
      expect(sessionData.session.status).toBe('initializing');
      
      const sessionId = sessionData.session.id;
      
      // Step 2: Spawn worker agents
      console.log('👥 Step 2: Spawning worker agents');
      const workerTypes = ['research', 'implementation', 'testing'];
      const workerResults = [];
      
      for (const agentType of workerTypes) {
        const workerResult = await swarmClient.callTool('spawn_worker_agents', {
          agentType: agentType,
          count: 2,
          poolId: `${projectId}-${agentType}-pool`
        });
        
        expect(workerResult.content).toBeDefined();
        const workerData = JSON.parse(workerResult.content[0].text);
        expect(workerData.workers.length).toBe(2);
        workerResults.push(workerData);
      }
      
      // Step 3: Delegate tasks to agents
      console.log('📋 Step 3: Delegating tasks to agents');
      const topic = RESEARCH_TOPICS[0];
      const delegatedTasks = [];
      
      for (let i = 0; i < 3; i++) {
        const taskResult = await swarmClient.callTool('delegate_task', {
          taskId: `${projectId}-task-${i}`,
          description: `Research task ${i + 1}: ${topic.topic} - ${topic.expectedResults[i] || 'aspect'}`,
          agentType: workerTypes[i % workerTypes.length],
          priority: 2 - i, // Varying priorities
          dependencies: i > 0 ? [`${projectId}-task-${i-1}`] : []
        });
        
        expect(taskResult.content).toBeDefined();
        const taskData = JSON.parse(taskResult.content[0].text);
        expect(taskData.task.id).toBeDefined();
        expect(taskData.task.agentId).toBeDefined();
        delegatedTasks.push(taskData.task);
      }
      
      // Step 4: Execute research through agent delegation
      console.log('🔍 Step 4: Executing research through agents');
      const researchResults = [];
      
      for (const task of delegatedTasks.slice(0, 2)) { // Execute first 2 tasks
        const delegateResult = await swarmClient.callTool('delegate', {
          goal: task.description,
          category: 'research',
          limit: 5
        });
        
        expect(delegateResult.content).toBeDefined();
        const delegateData = JSON.parse(delegateResult.content[0].text);
        researchResults.push(delegateData);
      }
      
      // Step 5: Generate comprehensive reports
      console.log('📊 Step 5: Generating reports');
      const reportData = {
        sessionId,
        totalWorkers: workerResults.reduce((sum, r) => sum + r.workers.length, 0),
        delegatedTasks: delegatedTasks.length,
        completedResearch: researchResults.length,
        workflowDuration: (Date.now() - startTime) / 1000
      };
      
      // Store workflow results in tiered memory
      const memoryResult = await swarmClient.callTool('memory_store_tiered', {
        key: `workflow-report-${sessionId}`,
        value: reportData,
        tier: 'persistent',
        category: 'knowledge',
        importance: 0.9,
        tags: ['workflow', 'swarm', 'test']
      });
      
      expect(memoryResult.content).toBeDefined();
      const memoryData = JSON.parse(memoryResult.content[0].text);
      expect(memoryData.entry.key).toBe(`workflow-report-${sessionId}`);
      
      // Step 6: Create checkpoint
      console.log('💾 Step 6: Creating checkpoint');
      const checkpointResult = await swarmClient.callTool('swarm_checkpoint', {
        sessionId: sessionId,
        reason: 'workflow-completion'
      });
      
      expect(checkpointResult.content).toBeDefined();
      const checkpointData = JSON.parse(checkpointResult.content[0].text);
      expect(checkpointData.checkpoint.sessionId).toBe(sessionId);
      
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      // Performance assertion
      expect(duration).toBeLessThan(WORKFLOW_SCENARIOS.agentSwarmOrchestration.expectedDuration);
      
      // Validate workflow completeness
      expect(sessionData.session.id).toBeDefined();
      expect(workerResults.length).toBe(workerTypes.length);
      expect(delegatedTasks.length).toBe(3);
      expect(researchResults.length).toBeGreaterThan(0);
      expect(memoryData.entry.tier).toBe('persistent');
      expect(checkpointData.checkpoint.reason).toBe('workflow-completion');
      
      console.log(`✅ Complete swarm workflow executed in ${duration}s`);
      console.log(`📊 Session: ${sessionId}, Workers: ${reportData.totalWorkers}, Tasks: ${reportData.delegatedTasks}`);
    }, 65000);

    test('should validate tiered memory usage across workflow', async () => {
      console.log('🧠 Testing tiered memory usage');
      
      const sessionId = `memory-test-${Date.now()}`;
      
      // Create session
      const sessionResult = await swarmClient.callTool('swarm_session_create', {
        projectId: sessionId,
        name: 'Memory Test Session',
        topology: 'mesh',
        description: 'Test tiered memory functionality'
      });
      
      const sessionData = JSON.parse(sessionResult.content[0].text);
      
      // Store data in different memory tiers
      const memoryTests = [
        {
          tier: 'working',
          key: 'current-task',
          value: { taskId: 'task-1', status: 'in-progress' },
          importance: 0.5
        },
        {
          tier: 'episodic',
          key: 'research-findings',
          value: { topic: 'test', findings: ['result1', 'result2'] },
          importance: 0.7
        },
        {
          tier: 'persistent',
          key: 'agent-capabilities',
          value: { agents: ['research', 'implementation'], skills: ['analysis', 'coding'] },
          importance: 0.9
        }
      ];
      
      const storedMemories = [];
      
      for (const memoryTest of memoryTests) {
        const storeResult = await swarmClient.callTool('memory_store_tiered', {
          key: memoryTest.key,
          value: memoryTest.value,
          tier: memoryTest.tier,
          category: 'context',
          importance: memoryTest.importance
        });
        
        expect(storeResult.content).toBeDefined();
        const storeData = JSON.parse(storeResult.content[0].text);
        expect(storeData.entry.tier).toBe(memoryTest.tier);
        storedMemories.push(storeData.entry);
      }
      
      // Test memory retrieval
      const retrievedMemories = [];
      
      for (const memoryTest of memoryTests) {
        const retrieveResult = await swarmClient.callTool('memory_retrieve', {
          key: memoryTest.key
        });
        
        expect(retrieveResult.content).toBeDefined();
        const retrieveData = JSON.parse(retrieveResult.content[0].text);
        expect(retrieveData.value).toEqual(memoryTest.value);
        retrievedMemories.push(retrieveData);
      }
      
      // Test memory search
      const searchResult = await swarmClient.callTool('memory_search', {
        category: 'context',
        limit: 10
      });
      
      expect(searchResult.content).toBeDefined();
      const searchData = JSON.parse(searchResult.content[0].text);
      expect(searchData.results.length).toBe(memoryTests.length);
      
      // Test memory statistics
      const statsResult = await swarmClient.callTool('memory_stats');
      
      expect(statsResult.content).toBeDefined();
      const statsData = JSON.parse(statsResult.content[0].text);
      expect(statsData.stats).toBeDefined();
      expect(statsData.stats.total_entries).toBe(memoryTests.length);
      
      console.log(`✅ Memory test completed: ${storedMemories.length} stored, ${retrievedMemories.length} retrieved`);
    }, 45000);

    test('should test worker coordination and task distribution', async () => {
      console.log('👥 Testing worker coordination');
      
      const sessionId = `coordination-test-${Date.now()}`;
      
      // Create session with mesh topology for better coordination
      const sessionResult = await swarmClient.callTool('swarm_session_create', {
        projectId: sessionId,
        name: 'Coordination Test Session',
        topology: 'mesh',
        description: 'Test worker coordination and load balancing'
      });
      
      const sessionData = JSON.parse(sessionResult.content[0].text);
      
      // Create worker pool with load balancing
      const poolResult = await swarmClient.callTool('worker_pool_create', {
        name: 'test-pool',
        agentType: 'research',
        minWorkers: 2,
        maxWorkers: 5,
        loadBalanceStrategy: 'least-loaded'
      });
      
      expect(poolResult.content).toBeDefined();
      const poolData = JSON.parse(poolResult.content[0].text);
      expect(poolData.pool.loadBalanceStrategy).toBe('least-loaded');
      
      // Spawn multiple workers
      const spawnResult = await swarmClient.callTool('spawn_worker_agents', {
        agentType: 'research',
        count: 4,
        poolId: poolData.pool.id
      });
      
      const spawnData = JSON.parse(spawnResult.content[0].text);
      expect(spawnData.workers.length).toBe(4);
      
      // Get pool statistics to verify load balancing
      const statsResult = await swarmClient.callTool('worker_pool_stats', {
        poolId: poolData.pool.id
      });
      
      expect(statsResult.content).toBeDefined();
      const statsData = JSON.parse(statsResult.content[0].text);
      expect(statsData.stats).toBeDefined();
      expect(statsData.stats.total_workers).toBe(4);
      expect(statsData.stats.active_workers).toBeGreaterThanOrEqual(0);
      
      // Delegate tasks to test distribution
      const tasks = [
        'Research topic A: microservices',
        'Research topic B: machine learning',
        'Research topic C: cloud architecture'
      ];
      
      const delegationResults = [];
      
      for (const task of tasks) {
        const delegateResult = await swarmClient.callTool('delegate', {
          goal: task,
          category: 'research'
        });
        
        expect(delegateResult.content).toBeDefined();
        delegationResults.push(delegateResult);
      }
      
      // Verify task distribution
      const successfulDelegations = delegationResults.filter(r => !r.isError);
      expect(successfulDelegations.length).toBe(tasks.length);
      
      console.log(`✅ Coordination test: ${spawnData.workers.length} workers, ${successfulDelegations.length} tasks delegated`);
    }, 50000);

    test('should test session checkpoint and recovery during workflow', async () => {
      console.log('💾 Testing checkpoint and recovery');
      
      const sessionId = `recovery-test-${Date.now()}`;
      
      // Create initial session
      const sessionResult = await swarmClient.callTool('swarm_session_create', {
        projectId: sessionId,
        name: 'Recovery Test Session',
        topology: 'hierarchical',
        description: 'Test checkpoint and recovery functionality'
      });
      
      const sessionData = JSON.parse(sessionResult.content[0].text);
      
      // Store some initial state
      await swarmClient.callTool('memory_store_tiered', {
        key: 'initial-state',
        value: { phase: 'initial', timestamp: Date.now() },
        tier: 'persistent',
        category: 'context'
      });
      
      // Create checkpoint
      const checkpoint1Result = await swarmClient.callTool('swarm_checkpoint', {
        sessionId: sessionData.session.id,
        reason: 'initial-checkpoint'
      });
      
      const checkpoint1Data = JSON.parse(checkpoint1Result.content[0].text);
      const checkpoint1Id = checkpoint1Data.checkpoint.id;
      
      // Simulate workflow progress
      await global.testUtils.wait(1000);
      
      await swarmClient.callTool('memory_store_tiered', {
        key: 'progress-state',
        value: { phase: 'in-progress', tasksCompleted: 2 },
        tier: 'persistent',
        category: 'context'
      });
      
      // Create second checkpoint
      const checkpoint2Result = await swarmClient.callTool('swarm_checkpoint', {
        sessionId: sessionData.session.id,
        reason: 'progress-checkpoint'
      });
      
      const checkpoint2Data = JSON.parse(checkpoint2Result.content[0].text);
      const checkpoint2Id = checkpoint2Data.checkpoint.id;
      
      // Simulate session termination
      await mcpManager.stopServer('agent-swarm');
      await global.testUtils.wait(1000);
      
      // Restart server and resume session
      await mcpManager.startServer('agent-swarm');
      await global.testUtils.wait(2000);
      
      const resumeResult = await swarmClient.callTool('swarm_session_resume', {
        sessionId: sessionData.session.id,
        checkpointId: checkpoint1Id // Resume from first checkpoint
      });
      
      expect(resumeResult.content).toBeDefined();
      const resumeData = JSON.parse(resumeResult.content[0].text);
      expect(resumeData.session.id).toBe(sessionData.session.id);
      expect(resumeData.session.status).toBe('active');
      
      // Verify restored state
      const memoryResult = await swarmClient.callTool('memory_retrieve', {
        key: 'initial-state'
      });
      
      expect(memoryResult.content).toBeDefined();
      const memoryData = JSON.parse(memoryResult.content[0].text);
      expect(memoryData.value.phase).toBe('initial');
      
      console.log(`✅ Recovery test: resumed from checkpoint ${checkpoint1Id}`);
    }, 60000);
  });

  describe('SPARC Workflow Execution', () => {
    test('should execute complete SPARC workflow', async () => {
      console.log('🔄 Testing SPARC workflow execution');
      
      const projectDescription = `
Build a comprehensive e-commerce platform with the following features:
1. User authentication and authorization
2. Product catalog with search and filtering
3. Shopping cart and checkout process
4. Order management and tracking
5. Payment integration with multiple providers
6. Admin dashboard for inventory management
      `;
      
      const startTime = Date.now();
      
      // Execute SPARC workflow
      const sparcResult = await swarmClient.callTool('execute_sparc_workflow', {
        projectDescription: projectDescription.trim(),
        requirements: [
          'Scalable architecture',
          'Secure payment processing',
          'Responsive design',
          'Real-time inventory updates'
        ],
        constraints: [
          'Budget constraints',
          'Timeline: 6 months',
          'Team size: 5-8 developers'
        ]
      });
      
      expect(sparcResult.content).toBeDefined();
      const sparcData = JSON.parse(sparcResult.content[0].text);
      expect(sparcData.workflow).toBeDefined();
      expect(sparcData.message).toBe('SPARC workflow initiated');
      
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      // SPARC workflow should complete in reasonable time
      expect(duration).toBeLessThan(30);
      
      console.log(`✅ SPARC workflow executed in ${duration}s`);
    }, 35000);

    test('should handle boomerang task delegation pattern', async () => {
      console.log('🪃 Testing boomerang task delegation');
      
      // Create a task
      const taskResult = await swarmClient.callTool('delegate_task', {
        taskId: `boomerang-test-${Date.now()}`,
        description: 'Initial task requiring refinement',
        agentType: 'research',
        priority: 2
      });
      
      const taskData = JSON.parse(taskResult.content[0].text);
      const taskId = taskData.task.id;
      
      // Wait a moment to simulate task processing
      await global.testUtils.wait(1000);
      
      // Send boomerang task back for refinement
      const boomerangResult = await swarmClient.callTool('send_boomerang_task', {
        taskId: taskId,
        targetAgent: 'architect',
        feedback: 'Need more detailed architectural analysis and better requirement clarification',
        priority: 3
      });
      
      expect(boomerangResult.content).toBeDefined();
      const boomerangData = JSON.parse(boomerangResult.content[0].text);
      expect(boomerangData.message).toBe('Boomerang task sent successfully');
      expect(boomerangData.targetAgent).toBe('architect');
      
      console.log(`✅ Boomerang task sent: ${taskId} → architect`);
    }, 30000);
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle invalid session configurations', async () => {
      console.log('⚠️ Testing invalid session handling');
      
      // Test with invalid topology
      const invalidSessionResult = await swarmClient.callTool('swarm_session_create', {
        projectId: 'invalid-test',
        name: 'Invalid Session',
        topology: 'invalid-topology', // Invalid topology
        description: 'Test invalid topology handling'
      });
      
      expect(invalidSessionResult.isError).toBe(true);
      
      // Test with missing required fields
      const missingFieldsResult = await swarmClient.callTool('swarm_session_create', {
        // Missing projectId
        name: 'Missing Fields Test',
        topology: 'hierarchical'
      });
      
      expect(missingFieldsResult.isError).toBe(true);
    }, 30000);

    test('should handle worker spawn failures gracefully', async () => {
      console.log('👥 Testing worker spawn failure handling');
      
      // Test with invalid agent type
      const invalidWorkerResult = await swarmClient.callTool('spawn_worker_agents', {
        agentType: 'invalid-agent-type',
        count: 2
      });
      
      expect(invalidWorkerResult.content).toBeDefined();
      const workerData = JSON.parse(invalidWorkerResult.content[0].text);
      
      // Should handle gracefully
      expect(workerData.workers.length).toBe(0);
    }, 30000);

    test('should handle memory operation errors', async () => {
      console.log('🧠 Testing memory operation error handling');
      
      // Test retrieving non-existent key
      const retrieveResult = await swarmClient.callTool('memory_retrieve', {
        key: 'non-existent-key-12345'
      });
      
      expect(retrieveResult.content).toBeDefined();
      const retrieveData = JSON.parse(retrieveResult.content[0].text);
      expect(retrieveData.message).toContain('No value found');
      
      // Test storing invalid data
      const storeResult = await swarmClient.callTool('memory_store_tiered', {
        key: '', // Empty key
        value: { test: 'data' },
        tier: 'working'
      });
      
      expect(storeResult.isError).toBe(true);
    }, 30000);
  });

  describe('Performance Benchmarks', () => {
    test('should meet performance requirements for swarm operations', async () => {
      console.log('📊 Testing swarm performance');
      
      const iterations = 3;
      const durations: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        // Create session
        await swarmClient.callTool('swarm_session_create', {
          projectId: `perf-test-${i}`,
          name: `Performance Test ${i}`,
          topology: 'star',
          description: 'Performance testing iteration'
        });
        
        // Spawn workers
        await swarmClient.callTool('spawn_worker_agents', {
          agentType: 'research',
          count: 2
        });
        
        const endTime = Date.now();
        durations.push((endTime - startTime) / 1000);
        
        // Brief pause between iterations
        await global.testUtils.wait(500);
      }
      
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      
      // Performance assertions
      expect(avgDuration).toBeLessThan(10); // Average under 10 seconds
      expect(maxDuration).toBeLessThan(15); // Max under 15 seconds
      
      console.log(`📊 Swarm performance: avg ${avgDuration}s, max ${maxDuration}s`);
    }, 60000);

    test('should handle concurrent swarm operations efficiently', async () => {
      console.log('🚀 Testing concurrent swarm operations');
      
      const startTime = Date.now();
      
      // Execute multiple operations concurrently
      const promises = [
        swarmClient.callTool('swarm_session_create', {
          projectId: 'concurrent-test-1',
          name: 'Concurrent Test 1',
          topology: 'mesh'
        }),
        swarmClient.callTool('swarm_session_create', {
          projectId: 'concurrent-test-2',
          name: 'Concurrent Test 2',
          topology: 'hierarchical'
        }),
        swarmClient.callTool('spawn_worker_agents', {
          agentType: 'implementation',
          count: 2
        })
      ];
      
      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      // All operations should succeed
      results.forEach((result, index) => {
        expect(result.content).toBeDefined();
        expect(result.isError).toBeFalsy();
        console.log(`✅ Concurrent operation ${index + 1} completed`);
      });
      
      // Concurrent execution should be efficient
      expect(duration).toBeLessThan(20);
      
      console.log(`🚀 Concurrent operations completed in ${duration}s`);
    }, 40000);
  });
});