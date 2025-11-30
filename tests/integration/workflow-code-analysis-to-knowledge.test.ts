/**
 * Integration Test: Code Analysis to Knowledge Workflow
 * 
 * Tests code analysis workflow: Code-Intelligence (Phase 10) → Context-Persistence (Phase 6)
 * - Find symbols → Extract entities → Build knowledge graph → Hybrid search
 * - Validate entity extraction from code analysis results
 * - Test knowledge graph updates from code changes
 * - Test search across code entities and relationships
 */

import { mcpManager } from './utils/mcp-server-manager.js';
import { 
  SAMPLE_CODE_FILES, 
  WORKFLOW_SCENARIOS,
  ERROR_SCENARIOS 
} from './fixtures/test-data.js';
import { writeFile, remove } from 'fs-extra';
import { join } from 'path';

describe('Code Analysis to Knowledge Workflow Integration', () => {
  let codeClient: any;
  let contextClient: any;
  let codeServer: any;
  let contextServer: any;
  let testCodeFiles: string[] = [];

  beforeAll(async () => {
    // Start required MCP servers
    console.log('🔧 Starting MCP servers for code-analysis-to-knowledge workflow test');
    
    codeServer = await mcpManager.startServer('code-intelligence');
    contextServer = await mcpManager.startServer('context-persistence');
    
    codeClient = mcpManager.getClient('code-intelligence');
    contextClient = mcpManager.getClient('context-persistence');
    
    // Wait for servers to be fully ready
    await global.testUtils.wait(3000); // Python server needs more time
    
    // Verify servers are healthy
    expect(await mcpManager.getServerHealth('code-intelligence')).toBe(true);
    expect(await mcpManager.getServerHealth('context-persistence')).toBe(true);
    
    // Create test code files
    await setupTestCodeFiles();
  });

  afterAll(async () => {
    // Clean up servers and test files
    console.log('🧹 Stopping MCP servers and cleaning up test files');
    await mcpManager.stopAllServers();
    await cleanupTestCodeFiles();
  });

  describe('Complete Code Analysis Workflow', () => {
    test('should execute end-to-end code analysis workflow successfully', async () => {
      const startTime = Date.now();
      
      // Step 1: Analyze code structure and find symbols
      console.log('🔍 Step 1: Analyzing code structure');
      const outlineResults = [];
      
      for (const filePath of testCodeFiles) {
        const outlineResult = await codeClient.callTool('get_code_outline', {
          filePath: filePath
        });
        
        expect(outlineResult.content).toBeDefined();
        const outlineData = JSON.parse(outlineResult.content[0].text);
        expect(outlineData.filePath).toBe(filePath);
        expect(outlineData.symbols).toBeDefined();
        expect(outlineData.symbols.length).toBeGreaterThan(0);
        outlineResults.push(outlineData);
      }
      
      // Step 2: Extract entities from code analysis
      console.log('🧠 Step 2: Extracting entities from code');
      const conversationId = `code-analysis-${Date.now()}`;
      
      // Save conversation with code analysis results
      const messages = outlineResults.map((outline: any, index: number) => ({
        role: 'assistant',
        content: `Code analysis for ${outline.filePath}: Found ${outline.symbols.length} symbols including ${outline.symbols.map((s: any) => s.name).join(', ')}`
      }));
      
      const saveResult = await contextClient.callTool('save_conversation', {
        conversation_id: conversationId,
        messages: messages,
        project_path: join(process.cwd(), 'test-data', 'code'),
        mode: 'code-analysis'
      });
      
      expect(saveResult.content).toBeDefined();
      const saveData = JSON.parse(saveResult.content[0].text);
      expect(saveData.status).toBe('saved');
      expect(saveData.message_count).toBe(messages.length);
      
      // Step 3: Extract entities from conversation
      console.log('🔗 Step 3: Extracting entities and building relationships');
      const extractResult = await contextClient.callTool('extract_entities', {
        conversation_id: conversationId
      });
      
      expect(extractResult.content).toBeDefined();
      const extractData = JSON.parse(extractResult.content[0].text);
      expect(extractData.entities_extracted).toBeGreaterThan(0);
      expect(extractData.entity_types.length).toBeGreaterThan(0);
      
      // Step 4: Create relationships between entities
      console.log('🕸️ Step 4: Creating entity relationships');
      const entities = extractData.entities || [];
      const relationshipResults = [];
      
      for (let i = 0; i < entities.length - 1; i++) {
        const sourceEntity = entities[i];
        const targetEntity = entities[i + 1];
        
        const relationshipResult = await contextClient.callTool('create_relationship', {
          source_entity_id: sourceEntity.id || `entity_${i}`,
          target_entity_id: targetEntity.id || `entity_${i + 1}`,
          relationship_type: 'references',
          confidence: 0.8,
          properties: {
            context: 'code-analysis',
            file_path: sourceEntity.file_path || testCodeFiles[i % testCodeFiles.length]
          }
        });
        
        expect(relationshipResult.content).toBeDefined();
        const relationshipData = JSON.parse(relationshipResult.content[0].text);
        expect(relationshipData.status).toBe('created');
        relationshipResults.push(relationshipData);
      }
      
      // Step 5: Query knowledge graph
      console.log('🔍 Step 5: Querying knowledge graph');
      const graphResults = [];
      
      for (const entity of entities.slice(0, 3)) {
        const graphResult = await contextClient.callTool('query_knowledge_graph', {
          entity_id: entity.id || `entity_${entities.indexOf(entity)}`,
          depth: 2,
          operation: 'context'
        });
        
        expect(graphResult.content).toBeDefined();
        const graphData = JSON.parse(graphResult.content[0].text);
        expect(graphData).toBeDefined();
        graphResults.push(graphData);
      }
      
      // Step 6: Perform hybrid search
      console.log('🔎 Step 6: Performing hybrid search');
      const searchQueries = ['UserService', 'createUser', 'async function', 'interface User'];
      const searchResults = [];
      
      for (const query of searchQueries) {
        const searchResult = await contextClient.callTool('search_hybrid', {
          query: query,
          mode: 'hybrid',
          limit: 10
        });
        
        expect(searchResult.content).toBeDefined();
        const searchData = JSON.parse(searchResult.content[0].text);
        expect(searchData.length).toBeGreaterThanOrEqual(0);
        searchResults.push(searchData);
      }
      
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      // Performance assertion
      expect(duration).toBeLessThan(WORKFLOW_SCENARIOS.codeAnalysisToKnowledge.expectedDuration);
      
      // Validate workflow completeness
      expect(outlineResults.length).toBe(testCodeFiles.length);
      expect(extractData.entities_extracted).toBeGreaterThan(0);
      expect(relationshipResults.length).toBeGreaterThan(0);
      expect(graphResults.length).toBeGreaterThan(0);
      expect(searchResults.length).toBe(searchQueries.length);
      
      console.log(`✅ Complete workflow executed in ${duration}s`);
      console.log(`📊 Analyzed ${outlineResults.length} files, extracted ${extractData.entities_extracted} entities, created ${relationshipResults.length} relationships`);
    }, 45000);

    test('should validate entity extraction from code analysis results', async () => {
      console.log('🧪 Testing entity extraction validation');
      
      // Analyze specific code file with known entities
      const filePath = testCodeFiles[0]; // TypeScript file
      const outlineResult = await codeClient.callTool('get_code_outline', {
        filePath: filePath
      });
      
      const outlineData = JSON.parse(outlineResult.content[0].text);
      
      // Save conversation with detailed analysis
      const conversationId = `entity-extraction-${Date.now()}`;
      const messages = [{
        role: 'assistant',
        content: `Detailed code analysis for ${outlineData.filePath}: Language: ${outlineData.language}, Imports: ${outlineData.imports?.length || 0}, Classes: ${outlineData.complexity?.classes || 0}, Functions: ${outlineData.complexity?.functions || 0}`
      }];
      
      await contextClient.callTool('save_conversation', {
        conversation_id: conversationId,
        messages: messages,
        project_path: join(process.cwd(), 'test-data', 'code')
      });
      
      // Extract entities with high confidence threshold
      const extractResult = await contextClient.callTool('extract_entities', {
        conversation_id: conversationId,
        confidence_threshold: 0.8
      });
      
      const extractData = JSON.parse(extractResult.content[0].text);
      
      // Validate extracted entities
      expect(extractData.entities_extracted).toBeGreaterThan(0);
      expect(extractData.entity_types).toContain('class');
      expect(extractData.entity_types).toContain('function');
      expect(extractData.entity_types).toContain('interface');
      
      // Check for specific expected entities
      const entities = extractData.entities || [];
      const hasUserService = entities.some((e: any) => e.name === 'UserService');
      const hasUserInterface = entities.some((e: any) => e.name === 'User');
      const hasCreateUser = entities.some((e: any) => e.name === 'createUser');
      
      expect(hasUserService).toBe(true);
      expect(hasUserInterface).toBe(true);
      expect(hasCreateUser).toBe(true);
      
      console.log(`✅ Extracted ${extractData.entities_extracted} entities with types: ${extractData.entity_types.join(', ')}`);
    }, 35000);

    test('should test knowledge graph updates from code changes', async () => {
      console.log('🔄 Testing knowledge graph updates from code changes');
      
      // Initial analysis
      const filePath = testCodeFiles[1]; // Python file
      const initialOutline = await codeClient.callTool('get_code_outline', {
        filePath: filePath
      });
      
      const conversationId = `graph-update-${Date.now()}`;
      await contextClient.callTool('save_conversation', {
        conversation_id: conversationId,
        messages: [{
          role: 'assistant',
          content: `Initial analysis of ${filePath}`
        }]
      });
      
      const initialExtract = await contextClient.callTool('extract_entities', {
        conversation_id: conversationId
      });
      
      // Modify the code file
      const modifiedContent = SAMPLE_CODE_FILES.python + `

class UserManager:
    """Extended user management with additional features"""
    
    def __init__(self):
        super().__init__()
        self.admin_users = []
    
    def create_admin_user(self, name: str, email: str, permissions: list):
        """Create an admin user with specific permissions"""
        user = User(name, email)
        user.is_admin = True
        user.permissions = permissions
        return user
    
    def get_user_count(self) -> int:
        """Get total number of users"""
        return len(self.users)
`;
      
      const modifiedFilePath = filePath.replace('.py', '-modified.py');
      await writeFile(modifiedFilePath, modifiedContent);
      
      // Analyze modified file
      const modifiedOutline = await codeClient.callTool('get_code_outline', {
        filePath: modifiedFilePath
      });
      
      await contextClient.callTool('save_conversation', {
        conversation_id: `${conversationId}-modified`,
        messages: [{
          role: 'assistant',
          content: `Modified analysis of ${modifiedFilePath}`
        }]
      });
      
      const modifiedExtract = await contextClient.callTool('extract_entities', {
        conversation_id: `${conversationId}-modified`
      });
      
      const initialData = JSON.parse(initialExtract.content[0].text);
      const modifiedData = JSON.parse(modifiedExtract.content[0].text);
      
      // Validate knowledge graph updates
      expect(modifiedData.entities_extracted).toBeGreaterThan(initialData.entities_extracted);
      
      // Check for new entities
      const newEntities = ['UserManager', 'create_admin_user', 'get_user_count'];
      const hasNewEntities = newEntities.some(entity => 
        modifiedData.entities.some((e: any) => e.name === entity)
      );
      
      expect(hasNewEntities).toBe(true);
      
      // Clean up modified file
      await remove(modifiedFilePath);
      
      console.log(`✅ Knowledge graph updated: ${initialData.entities_extracted} → ${modifiedData.entities_extracted} entities`);
    }, 40000);

    test('should test search across code entities and relationships', async () => {
      console.log('🔎 Testing hybrid search across code entities');
      
      // Build comprehensive knowledge base
      const conversationId = `search-test-${Date.now()}`;
      const allEntities = [];
      
      for (let i = 0; i < testCodeFiles.length; i++) {
        const filePath = testCodeFiles[i];
        const outlineResult = await codeClient.callTool('get_code_outline', {
          filePath: filePath
        });
        
        const outlineData = JSON.parse(outlineResult.content[0].text);
        
        await contextClient.callTool('save_conversation', {
          conversation_id: `${conversationId}-file-${i}`,
          messages: [{
            role: 'assistant',
            content: `Analysis of ${filePath}: ${outlineData.symbols.length} symbols found`
          }]
        });
        
        const extractResult = await contextClient.callTool('extract_entities', {
          conversation_id: `${conversationId}-file-${i}`
        });
        
        const extractData = JSON.parse(extractResult.content[0].text);
        allEntities.push(...(extractData.entities || []));
      }
      
      // Test different search modes
      const searchTests = [
        { query: 'UserService', mode: 'semantic', expected: 'Find UserService class' },
        { query: 'async', mode: 'keyword', expected: 'Find async functions' },
        { query: 'User', mode: 'graph', expected: 'Find User-related entities' },
        { query: 'createUser', mode: 'hybrid', expected: 'Find createUser across all modes' }
      ];
      
      const searchResults = [];
      
      for (const searchTest of searchTests) {
        const searchResult = await contextClient.callTool('search_hybrid', {
          query: searchTest.query,
          mode: searchTest.mode,
          limit: 5
        });
        
        expect(searchResult.content).toBeDefined();
        const searchData = JSON.parse(searchResult.content[0].text);
        
        // Validate search results
        expect(searchData.length).toBeGreaterThanOrEqual(0);
        
        // Check relevance of results
        const hasRelevantResults = searchData.some((result: any) => {
          const content = (result.content || result.snippet || '').toLowerCase();
          return content.includes(searchTest.query.toLowerCase());
        });
        
        expect(hasRelevantResults).toBe(true);
        
        searchResults.push({
          query: searchTest.query,
          mode: searchTest.mode,
          resultCount: searchData.length,
          hasRelevantResults
        });
      }
      
      // Validate search effectiveness
      const effectiveSearches = searchResults.filter(r => r.hasRelevantResults);
      expect(effectiveSearches.length).toBeGreaterThanOrEqual(searchTests.length * 0.75); // At least 75% effective
      
      console.log(`🔊 Search effectiveness: ${effectiveSearches.length}/${searchTests.length} searches returned relevant results`);
    }, 50000);
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle non-existent code files gracefully', async () => {
      console.log('⚠️ Testing non-existent file handling');
      
      const nonExistentFile = '/path/to/non/existent/file.ts';
      
      const outlineResult = await codeClient.callTool('get_code_outline', {
        filePath: nonExistentFile
      });
      
      expect(outlineResult.isError).toBe(true);
      expect(outlineResult.content[0].text).toContain('error');
    }, 30000);

    test('should handle empty or invalid code files', async () => {
      console.log('📝 Testing empty file handling');
      
      // Create empty file
      const emptyFilePath = join(process.cwd(), 'test-data', 'code', 'empty.ts');
      await writeFile(emptyFilePath, '');
      
      const outlineResult = await codeClient.callTool('get_code_outline', {
        filePath: emptyFilePath
      });
      
      expect(outlineResult.content).toBeDefined();
      const outlineData = JSON.parse(outlineResult.content[0].text);
      expect(outlineData.symbols.length).toBe(0);
      expect(outlineData.complexity.functions).toBe(0);
      expect(outlineData.complexity.classes).toBe(0);
      
      // Clean up
      await remove(emptyFilePath);
    }, 30000);

    test('should handle knowledge graph query errors', async () => {
      console.log('🔍 Testing graph query error handling');
      
      // Query non-existent entity
      const graphResult = await contextClient.callTool('query_knowledge_graph', {
        entity_id: 'non-existent-entity-id',
        depth: 2,
        operation: 'context'
      });
      
      expect(graphResult.content).toBeDefined();
      const graphData = JSON.parse(graphResult.content[0].text);
      
      // Should handle gracefully
      expect(graphData.error || graphData.nodes || graphData.context).toBeDefined();
    }, 30000);

    test('should handle search with no results', async () => {
      console.log('🔍 Testing empty search results');
      
      const searchResult = await contextClient.callTool('search_hybrid', {
        query: 'definitely-non-existent-entity-name-12345',
        mode: 'hybrid',
        limit: 10
      });
      
      expect(searchResult.content).toBeDefined();
      const searchData = JSON.parse(searchResult.content[0].text);
      expect(searchData.length).toBe(0);
    }, 30000);
  });

  describe('Performance Benchmarks', () => {
    test('should meet performance requirements for code analysis', async () => {
      console.log('📊 Testing code analysis performance');
      
      const iterations = 3;
      const durations: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        // Analyze all test files
        for (const filePath of testCodeFiles) {
          await codeClient.callTool('get_code_outline', {
            filePath: filePath
          });
        }
        
        const endTime = Date.now();
        durations.push((endTime - startTime) / 1000);
        
        // Brief pause between iterations
        await global.testUtils.wait(500);
      }
      
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      
      // Performance assertions
      expect(avgDuration).toBeLessThan(15); // Average under 15 seconds
      expect(maxDuration).toBeLessThan(25); // Max under 25 seconds
      
      console.log(`📊 Performance: avg ${avgDuration}s, max ${maxDuration}s`);
    }, 60000);

    test('should handle large code files efficiently', async () => {
      console.log('📚 Testing large file handling');
      
      // Create a large code file
      const largeFilePath = join(process.cwd(), 'test-data', 'code', 'large-file.ts');
      const largeContent = generateLargeCodeFile();
      await writeFile(largeFilePath, largeContent);
      
      const startTime = Date.now();
      
      const outlineResult = await codeClient.callTool('get_code_outline', {
        filePath: largeFilePath
      });
      
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      expect(outlineResult.content).toBeDefined();
      const outlineData = JSON.parse(outlineResult.content[0].text);
      expect(outlineData.symbols.length).toBeGreaterThan(50);
      
      // Should handle large files within reasonable time
      expect(duration).toBeLessThan(20);
      
      // Clean up
      await remove(largeFilePath);
      
      console.log(`📚 Large file (${largeContent.length} chars) analyzed in ${duration}s`);
    }, 40000);
  });
});

/**
 * Setup test code files
 */
async function setupTestCodeFiles(): Promise<void> {
  const testCodeDir = join(process.cwd(), 'test-data', 'code');
  
  // Create test files for each language
  const files = [
    { name: 'user-service.ts', content: SAMPLE_CODE_FILES.typescript },
    { name: 'user-service.py', content: SAMPLE_CODE_FILES.python },
    { name: 'user-service.js', content: SAMPLE_CODE_FILES.javascript }
  ];
  
  for (const file of files) {
    const filePath = join(testCodeDir, file.name);
    await writeFile(filePath, file.content);
    testCodeFiles.push(filePath);
  }
}

/**
 * Clean up test code files
 */
async function cleanupTestCodeFiles(): Promise<void> {
  const testCodeDir = join(process.cwd(), 'test-data', 'code');
  try {
    await remove(testCodeDir);
  } catch (error) {
    console.warn('⚠️ Error cleaning up test code files:', error);
  }
}

/**
 * Generate a large code file for performance testing
 */
function generateLargeCodeFile(): string {
  const classes = [];
  const functions = [];
  
  // Generate multiple classes and functions
  for (let i = 0; i < 10; i++) {
    classes.push(`
export class LargeClass${i} {
  private id: string;
  private name: string;
  private data: any[];
  
  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    this.data = [];
  }
  
  public getData(): any[] {
    return this.data;
  }
  
  public addData(item: any): void {
    this.data.push(item);
  }
  
  public processData(): Promise<any[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(this.data.map(item => ({ ...item, processed: true })));
      }, 100);
    });
  }
  
  public static createInstance(name: string): LargeClass${i} {
    return new LargeClass${i}(\`id-\${Math.random()}\`, name);
  }
}`);
    
    functions.push(`
export function largeFunction${i}(param1: string, param2: number): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const result = \`\${param1}-\${param2}-\${Math.random()}\`;
      setTimeout(() => resolve(result), 50);
    } catch (error) {
      reject(error);
    }
  });
}

export function utilityFunction${i}(items: any[]): any[] {
  return items
    .filter(item => item !== null && item !== undefined)
    .map((item, index) => ({ ...item, index, order: index + 1 }))
    .sort((a, b) => a.order - b.order);
}

export async function asyncFunction${i}(data: any): Promise<{ success: boolean; data: any }> {
  try {
    const processed = await largeFunction${i}(data.toString(), data.length || 0);
    return { success: true, data: processed };
  } catch (error) {
    return { success: false, error: error.message };
  }
}`);
  }
  
  return `
// Auto-generated large code file for performance testing
${classes.join('\n\n')}

${functions.join('\n\n')}

// Export everything
export { ${classes.map((_, i) => \`LargeClass${i}\`).join(', ')} };
export { ${functions.map((_, i) => \`largeFunction${i}, utilityFunction${i}, asyncFunction${i}\`).join(', ')} };

// Additional utility code
export const LARGE_CONSTANTS = {
  MAX_ITEMS: 1000,
  TIMEOUT: 5000,
  RETRY_ATTEMPTS: 3
};

export interface LargeInterface {
  id: string;
  name: string;
  data: any[];
  timestamp: Date;
}

export type LargeType = string | number | boolean | LargeInterface | any[];

export enum LargeEnum {
  FIRST = 'first',
  SECOND = 'second', 
  THIRD = 'third'
}
`;
}