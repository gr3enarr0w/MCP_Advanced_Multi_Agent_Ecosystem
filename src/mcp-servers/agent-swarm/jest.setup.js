/**
 * Jest setup file for Agent Swarm testing
 * Handles global test configuration and mocks
 */

// Global test utilities
global.testUtils = {
  createMockAgent: (id = 'test-agent', type = 'worker') => ({
    id,
    type,
    status: 'idle',
    capabilities: ['test'],
    lastPing: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  }),
  
  createMockTask: (id = 'test-task') => ({
    id,
    type: 'test',
    priority: 1,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  }),
  
  createMockSession: (id = 'test-session') => ({
    id,
    topology: 'hierarchical',
    status: 'active',
    agents: [],
    createdAt: new Date(),
    updatedAt: new Date()
  })
};

// Increase timeout for async operations
jest.setTimeout(30000);

// Suppress console errors in tests unless debugging
if (!process.env.DEBUG_TESTS) {
  console.error = jest.fn();
  console.warn = jest.fn();
}