/**
 * Jest Test Setup for Skills Manager MCP Server
 */
import { jest, beforeAll, afterAll, beforeEach } from '@jest/globals';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.SKILLS_DB_PATH = ':memory:';

// Increase timeout for async operations
jest.setTimeout(30000);

// Global test utilities
beforeAll(() => {
  console.log('Skills Manager Tests Starting...');
});

afterAll(() => {
  console.log('Skills Manager Tests Complete.');
});

// Clear mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});
