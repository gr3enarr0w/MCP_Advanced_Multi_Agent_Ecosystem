# MCP Servers Testing Guide

## Overview

This document provides comprehensive testing guidelines for the MCP (Model Context Protocol) servers ecosystem. It covers testing infrastructure, procedures, and validation criteria for all 7 interconnected MCP servers.

## Architecture Overview

### Core MCP Servers (7 Total)
1. **context-persistence** (Python 3.12) - Conversation and context storage
2. **task-orchestrator** (TypeScript) - Task management with code execution
3. **search-aggregator** (TypeScript) - Multi-provider search aggregation
4. **agent-swarm** (TypeScript) - Multi-agent AI framework
5. **skills-manager** (TypeScript) - Skills management with OpenSkills/SkillsMP
6. **git** (TypeScript) - Git operations via GitHub API
7. **external MCP integrations** - context7, mcp-code-checker

### External Dependencies
- **context7** - External MCP server (integrated as internal dependency)
- **mcp-code-checker** - External code quality checker

## Testing Infrastructure Requirements

### Critical Architecture Requirements
- **7 interconnected MCP servers** must be tested in integration
- **Agent delegation routing** with boomerang pattern validation
- **TypeScript path aliases** using strict `@/*` patterns across all TypeScript services
- **Build order**: `setup.sh` → `install-mcp-servers.sh` → `test-installation.sh` (cannot be bypassed)

### Environment Requirements
- **Python 3.12 mandatory** for context-persistence server
- **Critical environment variables** for external MCP server paths and API keys
- **Multi-client sync** for MCP configuration files across Roo/Cursor integration
- **30-second Jest timeouts** for all test suites

## Testing Framework Configuration

### TypeScript Servers Testing Standard

Based on agent-swarm reference configuration:

#### Jest Configuration (jest.config.js)
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000
};
```

#### TypeScript Configuration (tsconfig.json)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "node",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": false,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": true,
    "noImplicitAny": false,
    "noImplicitReturns": false,
    "noImplicitThis": false,
    "noUnusedLocals": false,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": false,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/types/*": ["src/types/*"],
      "@/agents/*": ["src/agents/*"],
      "@/orchestrator/*": ["src/orchestrator/*"],
      "@/storage/*": ["src/storage/*"],
      "@/integration/*": ["src/integration/*"],
      "@/learning/*": ["src/learning/*"],
      "@/security/*": ["src/security/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

#### Package.json Test Scripts
```json
{
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "start": "node dist/index.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:unit": "jest --testPathPattern=unit",
    "test:integration": "jest --testPathPattern=integration",
    "test:performance": "jest --testPathPattern=performance",
    "test:security": "jest --testPathPattern=security",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix",
    "type-check": "tsc --noEmit"
  }
}
```

## Server-Specific Testing Requirements

### 1. Context-Persistence Server (Python 3.12)

#### Current State Analysis
- **Language**: Python 3.12
- **Configuration**: Uses `pyproject.toml`
- **Virtual Environment**: Complex handling required
- **Testing Framework**: pytest (recommended)

#### Testing Requirements
- **Unit Tests**: Database operations, conversation storage, embedding generation
- **Integration Tests**: MCP protocol compliance, API endpoints
- **Performance Tests**: Large conversation handling, embedding performance
- **Security Tests**: Data encryption, access controls, SQL injection prevention

#### Test Configuration
```python
# pytest.ini
[tool:pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts = 
    --strict-markers
    --strict-config
    --timeout=30
    --cov=context_persistence
    --cov-report=html
    --cov-report=term-missing
markers =
    unit: Unit tests
    integration: Integration tests
    performance: Performance tests
    security: Security tests
```

### 2. Task-Orchestrator Server (TypeScript)

#### Current State Analysis
- **Status**: ❌ Missing jest.config.js
- **TypeScript Config**: ❌ Missing path aliases
- **Test Scripts**: ❌ Incomplete (only basic "test" script)
- **Dependencies**: Complex code execution environment

#### Testing Requirements
- **Unit Tests**: Task management, code execution, dependency resolution
- **Integration Tests**: MCP bridge, agent coordination, git integration
- **Performance Tests**: Concurrent task execution, resource usage
- **Security Tests**: Code sandboxing, command injection prevention

#### Required Fixes
1. **Create jest.config.js** with 30-second timeout
2. **Add TypeScript path aliases** to tsconfig.json
3. **Standardize test scripts** in package.json
4. **Add ts-jest dependency** for TypeScript support

### 3. Search-Aggregator Server (TypeScript)

#### Current State Analysis
- **Status**: ❌ Missing jest.config.js
- **TypeScript Config**: ❌ Missing path aliases
- **Test Scripts**: ❌ Incomplete (only basic "test" script)
- **Dependencies**: Search provider integrations

#### Testing Requirements
- **Unit Tests**: Search provider logic, result aggregation, caching
- **Integration Tests**: Multiple provider coordination, MCP protocol
- **Performance Tests**: Search response times, cache efficiency
- **Security Tests**: API key management, request validation

#### Required Fixes
1. **Create jest.config.js** with 30-second timeout
2. **Add TypeScript path aliases** to tsconfig.json
3. **Standardize test scripts** in package.json
4. **Add ts-jest dependency** for TypeScript support

### 4. Agent-Swarm Server (TypeScript) ✅ REFERENCE STANDARD

#### Current State Analysis
- **Status**: ✅ Complete configuration
- **Jest Config**: ✅ Properly configured with 30s timeout
- **TypeScript Config**: ✅ Complete path aliases
- **Test Scripts**: ✅ Comprehensive test suite
- **Dependencies**: ✅ All required dev dependencies

#### Testing Requirements
- **Unit Tests**: Agent lifecycle, orchestration, storage
- **Integration Tests**: MCP bridge, agent coordination, SPARC workflow
- **Performance Tests**: Multi-agent execution, memory usage
- **Security Tests**: Agent isolation, communication security

### 5. Skills-Manager Server (TypeScript)

#### Current State Analysis
- **Status**: ❌ Missing jest.config.js
- **TypeScript Config**: ❌ Missing path aliases
- **Test Scripts**: ❌ Incomplete (only basic "test" script)
- **Dependencies**: OpenSkills/SkillsMP integration

#### Testing Requirements
- **Unit Tests**: Skills database, learning goals, recommendations
- **Integration Tests**: External API integration, MCP protocol
- **Performance Tests**: Large skills dataset handling, API response times
- **Security Tests**: Data validation, API authentication

#### Required Fixes
1. **Create jest.config.js** with 30-second timeout
2. **Add TypeScript path aliases** to tsconfig.json
3. **Standardize test scripts** in package.json
4. **Add ts-jest dependency** for TypeScript support

### 6. Git Server (TypeScript)

#### Current State Analysis
- **Status**: ❌ Missing jest.config.js
- **TypeScript Config**: ❌ Missing path aliases
- **Test Scripts**: ❌ Incomplete (only basic "test" script)
- **Dependencies**: GitHub API integration

#### Testing Requirements
- **Unit Tests**: Git operations, API client, repository management
- **Integration Tests**: GitHub API integration, MCP protocol
- **Performance Tests**: Large repository operations, API rate limiting
- **Security Tests**: Authentication, repository access controls

#### Required Fixes
1. **Create jest.config.js** with 30-second timeout
2. **Add TypeScript path aliases** to tsconfig.json
3. **Standardize test scripts** in package.json
4. **Add ts-jest dependency** for TypeScript support

### 7. GitHub OAuth Server (JavaScript)

#### Current State Analysis
- **Status**: JavaScript server (not TypeScript)
- **Configuration**: Basic package.json, no TypeScript config
- **Test Scripts**: ❌ Missing completely
- **Dependencies**: Express.js, OAuth2 flow

#### Testing Requirements
- **Unit Tests**: OAuth flow, token management, API endpoints
- **Integration Tests**: GitHub OAuth integration, MCP protocol
- **Performance Tests**: Token refresh, concurrent sessions
- **Security Tests**: OAuth security, token validation, CSRF protection

#### Required Fixes
1. **Create jest.config.js** for JavaScript testing
2. **Add comprehensive test scripts** to package.json
3. **Add Jest dependencies** for JavaScript testing

## GitHub MCP Server Testing Constraints

### Critical Security Requirement
**Write commands MUST only be tested against user-owned repositories**

#### Allowed Write Operations (User Repos Only)
- `create_or_update_file` - Create/update files in user repos
- `push_files` - Push multiple files to user repos
- `create_issue` - Create issues in user repos
- `create_pull_request` - Create PRs in user repos
- `add_issue_comment` - Add comments to issues in user repos
- `create_branch` - Create branches in user repos
- `merge_pull_request` - Merge PRs in user repos
- `create_pull_request_review` - Create reviews in user repos
- `update_issue` - Update issues in user repos

#### Allowed Read Operations (Any Public Repo)
- `get_file_contents` - Read files from any public repo
- `search_repositories` - Search any repositories
- `search_code` - Search code in any public repo
- `search_issues` - Search issues in any public repo
- `search_users` - Search users
- `list_commits` - List commits in any public repo
- `list_issues` - List issues in any public repo
- `list_pull_requests` - List PRs in any public repo
- `get_issue` - Get issue details from any public repo
- `get_pull_request` - Get PR details from any public repo
- `get_pull_request_files` - Get PR files from any public repo
- `get_pull_request_status` - Get PR status from any public repo
- `update_pull_request_branch` - Update PR branch in user repos only
- `get_pull_request_comments` - Get PR comments from any public repo
- `get_pull_request_reviews` - Get PR reviews from any public repo

#### Test Implementation Strategy
```javascript
// Test configuration for GitHub MCP server
const GITHUB_TEST_CONFIG = {
  // User repositories for write operations
  userRepos: [
    'ceverson/MCP_Advanced_Multi_Agent_Ecosystem',
    // Add other user repos here
  ],
  
  // Public repositories for read operations
  publicTestRepos: [
    'microsoft/vscode',
    'facebook/react',
    'torvalds/linux'
  ],
  
  // Test constraints
  constraints: {
    writeOperations: 'userReposOnly',
    readOperations: 'anyPublicRepo',
    requireAuthentication: true,
    rateLimiting: true
  }
};
```

## Test Execution Procedures

### Phase 1: Infrastructure Setup
1. **Run setup.sh** - Base environment setup
2. **Run install-mcp-servers.sh** - Install all MCP servers
3. **Run test-installation.sh** - Verify installation
4. **Configure environment variables** - Set API keys and paths

### Phase 2: Individual Server Testing
1. **Unit Tests** - Test individual components
2. **Integration Tests** - Test MCP protocol compliance
3. **Performance Tests** - Test under load
4. **Security Tests** - Test security controls

### Phase 3: Cross-Server Integration Testing
1. **Agent Delegation** - Test routing between servers
2. **Boomerang Pattern** - Test refinement loops
3. **Data Flow** - Test data exchange between servers
4. **Error Handling** - Test failure scenarios

### Phase 4: End-to-End Testing
1. **Complete Workflows** - Test full user scenarios
2. **Multi-Agent Coordination** - Test complex agent interactions
3. **Resource Management** - Test resource allocation
4. **Scalability** - Test system limits

## Validation Criteria

### Success Metrics
- **All unit tests pass** with >80% code coverage
- **All integration tests pass** with MCP protocol compliance
- **Performance tests meet** response time requirements (<5s for most operations)
- **Security tests pass** with no critical vulnerabilities
- **Cross-server integration** works seamlessly
- **GitHub write operations** only affect user repositories

### Failure Criteria
- **Any unit test fails** - Block deployment
- **Integration test failures** - Block deployment
- **Performance degradation** - Block deployment
- **Security vulnerabilities** - Block deployment
- **GitHub write operations** on non-user repos - Critical failure
- **Missing TypeScript path aliases** - Block deployment
- **Jest timeout configuration** not set to 30s - Block deployment

## Test Data Management

### Test Repositories
- **User Test Repos**: Dedicated repositories for write operation testing
- **Public Test Data**: Curated set of public repositories for read testing
- **Mock Data**: Synthetic data for unit testing
- **Performance Data**: Large datasets for performance testing

### Data Cleanup
- **Automatic cleanup** after each test run
- **Isolation** between test runs
- **Backup** of critical test data
- **Version control** of test data changes

## Continuous Integration

### CI/CD Pipeline
1. **Infrastructure Tests** - Run on every commit
2. **Unit Tests** - Run on every commit
3. **Integration Tests** - Run on PR creation
4. **Performance Tests** - Run on merge to main
5. **Security Tests** - Run on release candidates
6. **End-to-End Tests** - Run before deployment

### Test Reporting
- **Coverage reports** for all servers
- **Performance metrics** tracking
- **Security scan results**
- **Integration test results**
- **Cross-server coordination metrics**

## Troubleshooting Guide

### Common Issues
1. **Missing Jest configurations** - Copy from agent-swarm reference
2. **TypeScript path aliases** - Add @/* patterns to tsconfig.json
3. **Test timeouts** - Ensure 30-second timeout in Jest config
4. **GitHub write operations** - Verify user repository constraints
5. **Python environment** - Ensure Python 3.12 for context-persistence

### Debug Commands
```bash
# Check Jest configuration
npx jest --showConfig

# Verify TypeScript compilation
npx tsc --noEmit

# Test individual server
cd src/mcp-servers/server-name && npm test

# Check coverage
npm run test:coverage

# Run specific test suite
npm run test:unit
npm run test:integration
npm run test:performance
npm run test:security
```

## Conclusion

This testing guide ensures comprehensive validation of the MCP servers ecosystem while maintaining strict security controls for GitHub operations. All servers must meet the infrastructure requirements before individual testing can proceed.

The 30-second Jest timeout requirement, TypeScript path aliases, and GitHub write operation constraints are critical for system stability and security.