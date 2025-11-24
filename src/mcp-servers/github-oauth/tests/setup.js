/**
 * Jest Test Setup for GitHub OAuth MCP Server
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.GITHUB_CLIENT_ID = 'test-client-id';
process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
process.env.HOST = 'http://localhost:3001';
process.env.GITHUB_SCOPES = 'repo,user';

// Increase timeout for async operations
jest.setTimeout(30000);

// Global test utilities
beforeAll(() => {
  console.log('GitHub OAuth Tests Starting...');
});

afterAll(() => {
  console.log('GitHub OAuth Tests Complete.');
});

// Clear mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});
