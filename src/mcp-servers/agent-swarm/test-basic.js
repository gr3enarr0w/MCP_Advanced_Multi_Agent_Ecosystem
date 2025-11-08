/**
 * Basic test script for Agent Swarm MCP Server
 * Tests core functionality without complex dependencies
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test configuration
const serverPath = join(__dirname, 'src', 'index.ts');
const testTimeout = 5000;

console.log('🧪 Testing Agent Swarm MCP Server...\n');

// Test 1: Server startup
function testServerStartup() {
  return new Promise((resolve, reject) => {
    console.log('Test 1: Server startup...');
    
    const proc = spawn('npx', ['tsx', serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: testTimeout
    });

    let output = '';
    let errorOutput = '';

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0 || code === null) {
        console.log('✅ Server started successfully');
        console.log('Output:', output.trim());
        resolve({ success: true, output, errorOutput });
      } else {
        console.log('❌ Server startup failed');
        console.log('Error output:', errorOutput);
        reject(new Error(`Server exited with code ${code}`));
      }
    });

    proc.on('error', (error) => {
      console.log('❌ Server process error:', error.message);
      reject(error);
    });

    // Stop the server after a short delay
    setTimeout(() => {
      proc.kill('SIGTERM');
    }, 2000);
  });
}

// Test 2: MCP Protocol Communication
function testMCPProtocol() {
  return new Promise((resolve, reject) => {
    console.log('\nTest 2: MCP Protocol Communication...');
    
    const proc = spawn('npx', ['tsx', serverPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Send a simple MCP request
    const request = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list"
    }) + '\n';

    let response = '';

    proc.stdout.on('data', (data) => {
      response += data.toString();
    });

    proc.stderr.on('data', (data) => {
      console.log('Server stderr:', data.toString());
    });

    proc.stdin.write(request);
    proc.stdin.end();

    setTimeout(() => {
      if (response.includes('tools')) {
        console.log('✅ MCP protocol communication working');
        console.log('Response preview:', response.substring(0, 200) + '...');
        resolve({ success: true, response });
      } else {
        console.log('❌ MCP protocol communication failed');
        console.log('Response:', response);
        reject(new Error('No tools response received'));
      }
      proc.kill('SIGTERM');
    }, 3000);

    proc.on('error', (error) => {
      console.log('❌ MCP communication error:', error.message);
      reject(error);
    });
  });
}

// Run all tests
async function runTests() {
  try {
    await testServerStartup();
    await testMCPProtocol();
    
    console.log('\n🎉 All tests passed! Agent Swarm MCP Server is working correctly.');
    
  } catch (error) {
    console.log('\n💥 Test failed:', error.message);
    process.exit(1);
  }
}

runTests();