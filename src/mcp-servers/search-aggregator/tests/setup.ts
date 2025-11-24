/**
 * Jest Test Setup for Search Aggregator MCP Server
 */
import { jest, beforeAll, afterAll, beforeEach } from '@jest/globals';

// Set test environment variables
process.env.NODE_ENV = 'test';

// Mock environment variables for tests
process.env.PERPLEXITY_API_KEY = 'test-perplexity-key';
process.env.BRAVE_API_KEY = 'test-brave-key';
process.env.GOOGLE_API_KEY = 'test-google-key';
process.env.GOOGLE_CX = 'test-google-cx';

// Increase timeout for async operations
jest.setTimeout(30000);

// Global test utilities
beforeAll(() => {
  console.log('Search Aggregator Tests Starting...');
});

afterAll(() => {
  console.log('Search Aggregator Tests Complete.');
});

// Clear mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});
