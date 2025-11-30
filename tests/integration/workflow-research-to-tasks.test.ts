/**
 * Integration Test: Research to Tasks Workflow
 * 
 * Tests complete research workflow: Search-Aggregator (Phase 8) → Task-Orchestrator (Phase 7)
 * - Generate research plan → Parse findings → Create tasks → Analyze complexity → Select next task
 * - Validate data flow between `deep_research` and `parse_prd`
 * - Test error handling and rollback mechanisms
 * - Test performance with large research results
 */

import { mcpManager } from './utils/mcp-server-manager.js';
import { 
  SAMPLE_PRD, 
  RESEARCH_TOPICS, 
  WORKFLOW_SCENARIOS,
  ERROR_SCENARIOS 
} from './fixtures/test-data.js';

describe('Research to Tasks Workflow Integration', () => {
  let searchClient: any;
  let taskClient: any;
  let searchServer: any;
  let taskServer: any;

  beforeAll(async () => {
    // Start required MCP servers
    console.log('🔧 Starting MCP servers for research-to-tasks workflow test');
    
    searchServer = await mcpManager.startServer('search-aggregator');
    taskServer = await mcpManager.startServer('task-orchestrator');
    
    searchClient = mcpManager.getClient('search-aggregator');
    taskClient = mcpManager.getClient('task-orchestrator');
    
    // Wait for servers to be fully ready
    await global.testUtils.wait(2000);
    
    // Verify servers are healthy
    expect(await mcpManager.getServerHealth('search-aggregator')).toBe(true);
    expect(await mcpManager.getServerHealth('task-orchestrator')).toBe(true);
  });

  afterAll(async () => {
    // Clean up servers
    console.log('🧹 Stopping MCP servers');
    await mcpManager.stopAllServers();
  });

  describe('Complete Research Workflow', () => {
    test('should execute end-to-end research workflow successfully', async () => {
      const topic = RESEARCH_TOPICS[0];
      const startTime = Date.now();
      
      // Step 1: Generate research plan
      console.log('📋 Step 1: Generating research plan');
      const planResult = await searchClient.callTool('generate_research_plan', {
        topic: topic.topic,
        methodology: 'exploratory',
        depth: 'standard',
        breadth: 'balanced',
        include_local: true
      });
      
      expect(planResult.content).toBeDefined();
      const planData = JSON.parse(planResult.content[0].text);
      expect(planData.plan_id).toBeDefined();
      expect(planData.topic).toBe(topic.topic);
      expect(planData.questions_count).toBeGreaterThan(0);
      expect(planData.strategies_count).toBeGreaterThan(0);
      
      // Step 2: Execute deep research
      console.log('🔍 Step 2: Executing deep research');
      const researchResult = await searchClient.callTool('deep_research', {
        topic: topic.topic,
        depth: 'standard',
        breadth: 'balanced',
        include_local: true,
        max_sources: 15
      });
      
      expect(researchResult.content).toBeDefined();
      const researchData = JSON.parse(researchResult.content[0].text);
      expect(researchData.research_id).toBeDefined();
      expect(researchData.status).toBe('completed');
      expect(researchData.total_sources).toBeGreaterThan(0);
      
      // Step 3: Parse research findings as PRD
      console.log('📝 Step 3: Parsing research findings');
      const prdContent = generatePRDFromResearch(researchData, topic);
      const parseResult = await taskClient.callTool('parse_prd', {
        content: prdContent,
        project_id: `research-${topic.topic.replace(/\s+/g, '-').toLowerCase()}`,
        generate_tasks: true,
        analyze_dependencies: true,
        extract_user_stories: true,
        parse_acceptance_criteria: true,
        confidence_threshold: 0.7
      });
      
      expect(parseResult.content).toBeDefined();
      const parseData = JSON.parse(parseResult.content[0].text);
      expect(parseData.prd).toBeDefined();
      expect(parseData.prd.title).toContain(topic.topic);
      
      // Step 4: Create tasks from parsed PRD
      console.log('📋 Step 4: Creating tasks from parsed PRD');
      const createdTasks = [];
      for (const taskData of parseData.prd.tasks || []) {
        const taskResult = await taskClient.callTool('create_task', {
          title: taskData.title,
          description: taskData.description,
          priority: taskData.priority || 1,
          tags: taskData.tags || ['research-generated'],
          code_language: taskData.language || 'typescript'
        });
        
        expect(taskResult.content).toBeDefined();
        const taskInfo = JSON.parse(taskResult.content[0].text);
        expect(taskInfo.task.id).toBeDefined();
        createdTasks.push(taskInfo.task);
      }
      
      // Step 5: Analyze complexity for each task
      console.log('📊 Step 5: Analyzing task complexity');
      const complexityResults = [];
      for (const task of createdTasks) {
        const complexityResult = await taskClient.callTool('analyze_complexity', {
          task_id: task.id,
          analyze_dependencies: true,
          estimate_code_volume: true,
          assess_risk: true,
          use_historical_data: true
        });
        
        expect(complexityResult.content).toBeDefined();
        const complexityData = JSON.parse(complexityResult.content[0].text);
        expect(complexityData.complexity).toBeDefined();
        expect(complexityData.complexity.score).toBeGreaterThan(0);
        complexityResults.push(complexityData);
      }
      
      // Step 6: Select next optimal task
      console.log('🎯 Step 6: Selecting next optimal task');
      const selectionResult = await taskClient.callTool('get_next_task', {
        project_id: `research-${topic.topic.replace(/\s+/g, '-').toLowerCase()}`,
        max_complexity: 8,
        preferred_task_types: ['implementation', 'research'],
        preferred_languages: ['typescript', 'javascript'],
        enable_grouping: true,
        minimize_context_switching: true
      });
      
      expect(selectionResult.content).toBeDefined();
      const selectionData = JSON.parse(selectionResult.content[0].text);
      expect(selectionData.selection).toBeDefined();
      expect(selectionData.selection.task_id).toBeDefined();
      
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      // Performance assertion
      expect(duration).toBeLessThan(WORKFLOW_SCENARIOS.researchToTasks.expectedDuration);
      
      console.log(`✅ Complete workflow executed in ${duration}s`);
    }, 45000);

    test('should handle large research results efficiently', async () => {
      const topic = RESEARCH_TOPICS[1]; // Advanced topic with more expected results
      const startTime = Date.now();
      
      // Execute comprehensive research
      const researchResult = await searchClient.callTool('deep_research', {
        topic: topic.topic,
        depth: 'comprehensive',
        breadth: 'extensive',
        include_local: true,
        max_sources: 50 // Large number of sources
      });
      
      const researchData = JSON.parse(researchResult.content[0].text);
      expect(researchData.total_sources).toBeGreaterThan(20);
      
      // Parse and create tasks should handle large results
      const prdContent = generatePRDFromResearch(researchData, topic);
      const parseResult = await taskClient.callTool('parse_prd', {
        content: prdContent,
        project_id: `large-research-${topic.topic.replace(/\s+/g, '-').toLowerCase()}`,
        generate_tasks: true,
        confidence_threshold: 0.6 // Lower threshold for large datasets
      });
      
      const parseData = JSON.parse(parseResult.content[0].text);
      expect(parseData.prd.tasks.length).toBeGreaterThan(10);
      
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      // Should still complete within reasonable time even with large data
      expect(duration).toBeLessThan(60);
      
      console.log(`✅ Large research workflow executed in ${duration}s`);
    }, 65000);

    test('should validate data flow between deep_research and parse_prd', async () => {
      const topic = RESEARCH_TOPICS[2];
      
      // Generate research with specific data structure
      const researchResult = await searchClient.callTool('deep_research', {
        topic: topic.topic,
        depth: 'standard',
        breadth: 'balanced',
        include_local: false,
        max_sources: 10
      });
      
      const researchData = JSON.parse(researchResult.content[0].text);
      
      // Create PRD with expected structure
      const prdContent = `
# Research Implementation: ${topic.topic}

## Executive Summary
${researchData.report_preview || 'Research completed successfully'}

## Key Findings
${researchData.total_sources} sources analyzed
${researchData.report_sections} report sections generated

## Implementation Tasks
- Task 1: Setup development environment
- Task 2: Implement core functionality  
- Task 3: Add testing and validation
- Task 4: Documentation and deployment

## Acceptance Criteria
- All research findings incorporated
- Tasks prioritized by complexity
- Implementation plan validated
      `;
      
      // Parse and validate structure
      const parseResult = await taskClient.callTool('parse_prd', {
        content: prdContent,
        project_id: `data-flow-test-${topic.topic.replace(/\s+/g, '-').toLowerCase()}`,
        generate_tasks: true,
        analyze_dependencies: true
      });
      
      const parseData = JSON.parse(parseResult.content[0].text);
      
      // Validate data flow integrity
      expect(parseData.prd).toBeDefined();
      expect(parseData.prd.title).toContain(topic.topic);
      expect(parseData.prd.tasks).toBeDefined();
      expect(parseData.prd.tasks.length).toBeGreaterThan(0);
      
      // Check that research data influenced task generation
      const hasComplexTasks = parseData.prd.tasks.some((task: any) => 
        task.priority >= 2 || task.tags?.includes('complex')
      );
      expect(hasComplexTasks).toBe(true);
    }, 40000);
  });

  describe('Error Handling and Rollback', () => {
    test('should handle server unavailability gracefully', async () => {
      // Simulate search server failure
      console.log('💥 Testing server failure scenario');
      await mcpManager.stopServer('search-aggregator');
      
      // Task orchestrator should still function
      const taskResult = await taskClient.callTool('list_tasks', {
        status: 'pending'
      });
      
      expect(taskResult.content).toBeDefined();
      const taskData = JSON.parse(taskResult.content[0].text);
      expect(taskData.tasks).toBeDefined();
      
      // Restart server and verify recovery
      await mcpManager.startServer('search-aggregator');
      await global.testUtils.wait(2000);
      
      expect(await mcpManager.getServerHealth('search-aggregator')).toBe(true);
    }, 35000);

    test('should handle invalid research topics', async () => {
      console.log('⚠️ Testing invalid topic handling');
      
      // Test with empty topic
      const emptyResult = await searchClient.callTool('generate_research_plan', {
        topic: '',
        methodology: 'exploratory'
      });
      
      expect(emptyResult.isError).toBe(true);
      expect(emptyResult.content[0].text).toContain('error');
      
      // Test with malformed topic
      const malformedResult = await searchClient.callTool('deep_research', {
        topic: '   ', // Only whitespace
        depth: 'standard'
      });
      
      expect(malformedResult.isError).toBe(true);
    }, 30000);

    test('should handle PRD parsing errors', async () => {
      console.log('📝 Testing PRD parsing error handling');
      
      // Test with invalid PRD content
      const invalidPRD = 'This is not a valid PRD document\n\nNo structure here';
      
      const parseResult = await taskClient.callTool('parse_prd', {
        content: invalidPRD,
        project_id: 'invalid-prd-test',
        generate_tasks: true,
        confidence_threshold: 0.8
      });
      
      // Should handle gracefully and return meaningful error
      expect(parseResult.content).toBeDefined();
      const parseData = JSON.parse(parseResult.content[0].text);
      
      // Either error or minimal valid parsing
      if (parseData.error) {
        expect(parseData.error).toBeDefined();
      } else {
        expect(parseData.prd.tasks.length).toBe(0);
      }
    }, 30000);
  });

  describe('Performance Benchmarks', () => {
    test('should meet performance requirements for standard workflow', async () => {
      const topic = RESEARCH_TOPICS[0];
      const iterations = 3;
      const durations: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        // Execute minimal workflow
        await searchClient.callTool('generate_research_plan', {
          topic: topic.topic,
          depth: 'quick'
        });
        
        await searchClient.callTool('deep_research', {
          topic: topic.topic,
          depth: 'quick',
          max_sources: 5
        });
        
        const endTime = Date.now();
        durations.push((endTime - startTime) / 1000);
        
        // Brief pause between iterations
        await global.testUtils.wait(500);
      }
      
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      
      // Performance assertions
      expect(avgDuration).toBeLessThan(20); // Average under 20 seconds
      expect(maxDuration).toBeLessThan(30); // Max under 30 seconds
      
      console.log(`📊 Performance: avg ${avgDuration}s, max ${maxDuration}s`);
    }, 60000);

    test('should handle concurrent requests efficiently', async () => {
      const topic = RESEARCH_TOPICS[0];
      const concurrentRequests = 3;
      
      const startTime = Date.now();
      
      // Execute multiple research requests concurrently
      const promises = Array.from({ length: concurrentRequests }, (_, i) =>
        searchClient.callTool('deep_research', {
          topic: `${topic.topic} - variant ${i + 1}`,
          depth: 'quick',
          max_sources: 3
        })
      );
      
      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      // All requests should succeed
      results.forEach((result, index) => {
        expect(result.content).toBeDefined();
        const researchData = JSON.parse(result.content[0].text);
        expect(researchData.research_id).toBeDefined();
        console.log(`✅ Concurrent request ${index + 1} completed`);
      });
      
      // Concurrent execution should be faster than sequential
      expect(duration).toBeLessThan(25);
      
      console.log(`🚀 Concurrent execution completed in ${duration}s`);
    }, 40000);
  });
});

/**
 * Helper function to generate PRD content from research data
 */
function generatePRDFromResearch(researchData: any, topic: any): string {
  return `# Product Requirements Document: ${topic.topic}

## Overview
Based on comprehensive research analysis of ${topic.topic}, this document outlines the implementation requirements.

## Research Summary
${researchData.report_preview || 'Research completed successfully'}

## Key Findings
- Total Sources Analyzed: ${researchData.total_sources}
- Report Sections Generated: ${researchData.report_sections}
- Research Status: ${researchData.status}

## Implementation Requirements

### Core Features
${topic.expectedResults.map((result: string) => `- ${result}`).join('\n')}

### Technical Requirements
- Performance: Optimized for ${topic.complexity} complexity
- Compatibility: Multi-language support
- Integration: Seamless workflow integration

### Success Criteria
${topic.expectedResults.map((result: string) => `1. ${result} implementation`).join('\n')}

## Timeline
- Phase 1: Analysis and Planning (2 weeks)
- Phase 2: Core Implementation (4 weeks)
- Phase 3: Testing and Validation (2 weeks)
- Phase 4: Documentation and Deployment (1 week)

## Dependencies
- Research findings validation
- Technical feasibility assessment
- Resource allocation and planning
`;
}