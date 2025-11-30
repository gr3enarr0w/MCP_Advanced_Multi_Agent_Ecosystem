/**
 * Jest setup file for integration tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.MCP_HOME = './test-data/.mcp';
process.env.TAVILY_API_KEY = process.env.TAVILY_API_KEY || 'test-key';
process.env.PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || 'test-key';
process.env.BRAVE_API_KEY = process.env.BRAVE_API_KEY || 'test-key';
process.env.MCP_ALLOW_MODEL_DOWNLOAD = '1';

// Increase timeout for async operations
jest.setTimeout(30000);

// Global test utilities
global.testUtils = {
  /**
   * Wait for a specified amount of time
   */
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  /**
   * Generate random test ID
   */
  generateId: () => `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  
  /**
   * Clean up test data
   */
  cleanup: async () => {
    const fs = await import('fs-extra');
    const path = await import('path');
    
    const testDataPath = path.join(process.cwd(), 'test-data');
    if (await fs.pathExists(testDataPath)) {
      await fs.remove(testDataPath);
    }
  }
};

// Setup and teardown hooks
beforeAll(async () => {
  console.log('🧪 Setting up integration test environment');
});

afterAll(async () => {
  console.log('🧹 Cleaning up integration test environment');
  await global.testUtils.cleanup();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});