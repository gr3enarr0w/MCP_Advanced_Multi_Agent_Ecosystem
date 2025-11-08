#!/usr/bin/env node

/**
 * Test script for enhanced Task Orchestrator
 * Tests basic functionality without requiring full MCP server setup
 */

const { spawn } = require('child_process');
const path = require('path');

// Test configuration
const ORCHESTRATOR_PATH = path.join(__dirname, 'dist', 'index.js');
const TEST_TIMEOUT = 30000;

// Test results storage
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

function recordTest(name, passed, details = '') {
  const result = { name, passed, details };
  testResults.tests.push(result);
  if (passed) {
    testResults.passed++;
    log(`${name}: PASSED ${details}`, 'success');
  } else {
    testResults.failed++;
    log(`${name}: FAILED ${details}`, 'error');
  }
}

async function testServerStartup() {
  log('Testing server startup...');
  
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [ORCHESTRATOR_PATH], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    let errorOutput = '';
    
    proc.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    // Give it time to start
    setTimeout(() => {
      proc.kill();
      
      if (errorOutput.includes('Enhanced Task Orchestrator MCP Server running on stdio')) {
        recordTest('Server Startup', true, 'Server started successfully');
        resolve(true);
      } else {
        recordTest('Server Startup', false, `Expected startup message, got: ${errorOutput}`);
        resolve(false);
      }
    }, 2000);
    
    proc.on('error', (error) => {
      recordTest('Server Startup', false, `Process error: ${error.message}`);
      resolve(false);
    });
    
    // Timeout safety
    setTimeout(() => {
      proc.kill();
      recordTest('Server Startup', false, 'Timeout waiting for server startup');
      resolve(false);
    }, 5000);
  });
}

async function testDatabaseCreation() {
  log('Testing database creation...');
  
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  
  try {
    // Check if directories are created
    const homeDir = os.homedir();
    const mcpDir = path.join(homeDir, '.mcp');
    const tasksDir = path.join(mcpDir, 'tasks');
    const cacheDir = path.join(mcpDir, 'cache', 'code');
    const logsDir = path.join(mcpDir, 'logs');
    
    if (fs.existsSync(mcpDir) && fs.existsSync(tasksDir) && 
        fs.existsSync(cacheDir) && fs.existsSync(logsDir)) {
      recordTest('Database Directory Creation', true, 'All required directories created');
    } else {
      recordTest('Database Directory Creation', false, 'Some directories missing');
    }
    
    // Test basic database operations
    const { initSqlJs } = require('sql.js');
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    
    // Test table creation
    db.run('CREATE TABLE test (id INTEGER, name TEXT)');
    db.run('INSERT INTO test VALUES (1, "test")');
    
    const result = db.exec('SELECT * FROM test');
    if (result.length > 0 && result[0].values[0][0] === 1) {
      recordTest('Database Operations', true, 'Basic SQL operations work');
    } else {
      recordTest('Database Operations', false, 'SQL operations failed');
    }
    
    db.close();
    
  } catch (error) {
    recordTest('Database Creation', false, `Database error: ${error.message}`);
  }
}

async function testCodeExecutionModules() {
  log('Testing code execution modules...');
  
  try {
    // Test VM2 availability
    const { VM } = require('vm2');
    const vm = new VM({ timeout: 1000 });
    const result = vm.run('2 + 2');
    
    if (result === 4) {
      recordTest('JavaScript VM Execution', true, 'VM2 sandbox working');
    } else {
      recordTest('JavaScript VM Execution', false, 'VM2 returned unexpected result');
    }
    
    // Test UUID generation
    const { v4: uuidv4 } = require('uuid');
    const uuid = uuidv4();
    if (uuid && uuid.length === 36 && uuid.includes('-')) {
      recordTest('UUID Generation', true, 'UUID v4 generation working');
    } else {
      recordTest('UUID Generation', false, 'Invalid UUID format');
    }
    
    // Test Winston logging
    const winston = require('winston');
    const logger = winston.createLogger({
      level: 'info',
      format: winston.format.simple(),
      transports: [new winston.transports.Console()]
    });
    
    // This will throw an error if Winston is not properly configured
    logger.info('Test message');
    recordTest('Logging System', true, 'Winston logger configured');
    
  } catch (error) {
    recordTest('Code Execution Modules', false, `Module error: ${error.message}`);
  }
}

async function testPackageDependencies() {
  log('Testing package dependencies...');
  
  const packageJson = require('./package.json');
  const requiredDeps = [
    '@modelcontextprotocol/sdk',
    'sql.js',
    'simple-git',
    'graphology',
    'execa',
    'uuid',
    'vm2',
    'chokidar',
    'winston',
    'zod'
  ];
  
  const missingDeps = [];
  const availableDeps = [];
  
  for (const dep of requiredDeps) {
    if (packageJson.dependencies[dep]) {
      availableDeps.push(dep);
    } else {
      missingDeps.push(dep);
    }
  }
  
  if (missingDeps.length === 0) {
    recordTest('Package Dependencies', true, `All ${requiredDeps.length} dependencies available`);
  } else {
    recordTest('Package Dependencies', false, `Missing: ${missingDeps.join(', ')}`);
  }
}

async function testFileStructure() {
  log('Testing file structure...');
  
  const fs = require('fs');
  const path = require('path');
  
  const requiredFiles = [
    'dist/index.js',
    'package.json',
    'tsconfig.json',
    'README.md'
  ];
  
  const missingFiles = [];
  const existingFiles = [];
  
  for (const file of requiredFiles) {
    if (fs.existsSync(path.join(__dirname, file))) {
      existingFiles.push(file);
    } else {
      missingFiles.push(file);
    }
  }
  
  if (missingFiles.length === 0) {
    recordTest('File Structure', true, `All ${requiredFiles.length} required files present`);
  } else {
    recordTest('File Structure', false, `Missing: ${missingFiles.join(', ')}`);
  }
}

async function runAllTests() {
  log('Starting Enhanced Task Orchestrator Tests', 'info');
  log('=====================================', 'info');
  
  try {
    await testPackageDependencies();
    await testFileStructure();
    await testDatabaseCreation();
    await testCodeExecutionModules();
    await testServerStartup();
    
    log('\n=====================================', 'info');
    log('Test Summary', 'info');
    log('=====================================', 'info');
    log(`Total Tests: ${testResults.passed + testResults.failed}`, 'info');
    log(`Passed: ${testResults.passed}`, 'success');
    log(`Failed: ${testResults.failed}`, testResults.failed > 0 ? 'error' : 'success');
    
    if (testResults.failed === 0) {
      log('\n🎉 All tests passed! Enhanced Task Orchestrator is ready.', 'success');
      process.exit(0);
    } else {
      log('\n❌ Some tests failed. Please check the issues above.', 'error');
      process.exit(1);
    }
    
  } catch (error) {
    log(`Test suite error: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Run tests
runAllTests();