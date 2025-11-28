# MCP Servers Testing Documentation

## Overview

This directory contains comprehensive testing documentation for the MCP (Model Context Protocol) servers ecosystem. The documentation addresses critical testing infrastructure issues and provides detailed procedures for validating all 7 interconnected MCP servers.

## 🚨 Critical Issues Identified

**6 out of 7 TypeScript servers violate architecture requirements and lack proper testing setup:**

- ❌ Missing Jest configurations (4 servers)
- ❌ Missing TypeScript path aliases (4 servers) 
- ❌ Incomplete test scripts (4 servers)
- ❌ Missing 30-second Jest timeout configuration (4 servers)
- ❌ GitHub MCP server lacks any testing infrastructure

## Documentation Structure

### 📋 [MCP_SERVERS_TESTING_GUIDE.md](./MCP_SERVERS_TESTING_GUIDE.md)
**Comprehensive testing framework documentation**

- Architecture overview and requirements
- Testing infrastructure standards
- Server-specific testing requirements
- Reference configurations (Jest, TypeScript, package.json)
- GitHub MCP server security constraints
- Test execution procedures
- Validation criteria and success metrics

### 📊 [MCP_SERVERS_TESTING_STATUS.md](./MCP_SERVERS_TESTING_STATUS.md)
**Current state analysis and gap identification**

- Server-by-server configuration status
- Critical infrastructure issues summary
- Required fixes for each server
- Immediate action items
- Success metrics and blockers

### 🔒 [GITHUB_MCP_TESTING_CONSTRAINTS.md](./GITHUB_MCP_TESTING_CONSTRAINTS.md)
**GitHub security constraints implementation**

- Write operation restrictions (user repos only)
- Read operation permissions (any public repo)
- Security validation functions
- Test data management
- Emergency procedures and rollback

### 🚀 [MCP_TESTING_EXECUTION_GUIDE.md](./MCP_TESTING_EXECUTION_GUIDE.md)
**Step-by-step testing procedures**

- Environment setup and prerequisites
- Phase-by-phase testing execution
- Infrastructure validation scripts
- Cross-server integration testing
- Performance and security testing
- CI/CD pipeline integration

## Quick Reference

### Architecture Requirements

| Component | Requirement | Status |
|------------|-------------|---------|
| **7 MCP Servers** | Interconnected with agent delegation | ⚠️ 1 missing (git) |
| **TypeScript Path Aliases** | Strict `@/*` patterns | ❌ 4/6 servers missing |
| **Jest Configuration** | 30-second timeouts | ❌ 4/6 servers missing |
| **Test Scripts** | Comprehensive test suites | ❌ 4/6 servers incomplete |
| **GitHub Security** | Write ops only on user repos | ⚠️ Needs implementation |

### Server Status Summary

| Server | Language | Jest Config | TS Aliases | Test Scripts | Status |
|--------|----------|--------------|-------------|--------------|---------|
| **agent-swarm** | TypeScript | ✅ Complete | ✅ Complete | ✅ Complete | **REFERENCE STANDARD** |
| **task-orchestrator** | TypeScript | ❌ Missing | ❌ Missing | ❌ Incomplete | **CRITICAL ISSUES** |
| **search-aggregator** | TypeScript | ❌ Missing | ❌ Missing | ❌ Incomplete | **CRITICAL ISSUES** |
| **skills-manager** | TypeScript | ❌ Missing | ❌ Missing | ❌ Incomplete | **CRITICAL ISSUES** |
| **context-persistence** | Python 3.12 | ⚠️ pytest needed | N/A | ⚠️ Python setup | **SEPARATE REQUIREMENTS** |
| **github-oauth** | JavaScript | ❌ Missing | N/A | ❌ Missing | **NO INFRASTRUCTURE** |
| **git** | TypeScript | ❌ Server missing | ❌ Server missing | ❌ Server missing | **MISSING SERVER** |

### Immediate Action Items

#### Phase 1: Infrastructure Fixes (Critical)
1. **Create jest.config.js** for 4 TypeScript servers
2. **Add TypeScript path aliases** to 4 TypeScript servers  
3. **Standardize test scripts** across all servers
4. **Configure 30-second timeouts** in all Jest configs

#### Phase 2: Server-Specific Implementation
1. **Task-Orchestrator**: Complete testing infrastructure
2. **Search-Aggregator**: Complete testing infrastructure
3. **Skills-Manager**: Complete testing infrastructure
4. **GitHub-OAuth**: Add JavaScript testing infrastructure
5. **Context-Persistence**: Add Python pytest configuration
6. **Git Server**: Locate or create missing server

#### Phase 3: Security Implementation
1. **Implement repository validation** for GitHub write operations
2. **Create test data isolation** for user repos
3. **Add security tests** for write operation constraints
4. **Document testing procedures** for GitHub operations

## Testing Framework Standards

### Jest Configuration Reference
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: { '^.+\\.ts$': 'ts-jest' },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000  // ⚠️ CRITICAL: 30-second timeout required
};
```

### TypeScript Path Aliases Reference
```json
{
  "compilerOptions": {
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
  }
}
```

### Test Scripts Reference
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

## GitHub Security Constraints

### 🚨 NON-NEGOTIABLE REQUIREMENT
**Write operations MUST only be tested against user-owned repositories**

#### Write Operations (User Repos Only)
- `create_or_update_file` - File creation/modification
- `push_files` - Multi-file operations
- `create_issue` - Issue creation
- `create_pull_request` - PR creation
- `add_issue_comment` - Comment addition
- `create_branch` - Branch creation
- `merge_pull_request` - PR merging
- `create_pull_request_review` - Review creation
- `update_issue` - Issue updates

#### Read Operations (Any Public Repo)
- `get_file_contents` - File reading
- `search_repositories` - Repository search
- `search_code` - Code search
- All other read-only operations

### User Repository Configuration
```javascript
const USER_REPOS = [
  'ceverson/MCP_Advanced_Multi_Agent_Ecosystem'
  // Add additional user repositories as needed
];
```

## Validation Criteria

### Success Metrics
- ✅ **7/7 servers** have proper test configurations
- ✅ **100% TypeScript servers** have @/* path aliases
- ✅ **100% Jest configs** have 30-second timeouts
- ✅ **GitHub write operations** only affect user repositories
- ✅ **All test suites** can run successfully
- ✅ **>80% code coverage** across all servers

### Blockers
- ❌ **Any server** missing Jest configuration
- ❌ **TypeScript server** missing path aliases
- ❌ **Jest timeout** not set to 30 seconds
- ❌ **GitHub write operations** on non-user repos
- ❌ **Coverage below 80%** threshold
- ❌ **Performance below** response time requirements

## Getting Started

### 1. Environment Setup
```bash
# Execute build order (cannot be bypassed)
./scripts/setup.sh
./scripts/install-mcp-servers.sh
./scripts/test-installation.sh

# Set environment variables
export MCP_SERVER_PATHS="./src/mcp-servers"
export GITHUB_TOKEN="your_github_token"
export SEARCH_PROVIDER_KEYS="your_api_keys"
```

### 2. Infrastructure Validation
```bash
# Validate Jest configurations
./scripts/validate-jest-configs.sh

# Validate TypeScript aliases
./scripts/validate-ts-aliases.sh

# Validate test scripts
./scripts/validate-test-scripts.sh
```

### 3. Execute Testing
```bash
# Run comprehensive test suite
./docs/MCP_TESTING_EXECUTION_GUIDE.md

# Focus on specific server
cd src/mcp-servers/server-name
npm run test:unit
npm run test:integration
npm run test:security
npm run test:coverage
```

## Support and Troubleshooting

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
```

## Conclusion

This testing documentation provides the foundation for establishing robust testing infrastructure across the MCP servers ecosystem. The critical issues identified must be resolved before individual server testing can proceed.

**Priority Order:**
1. **Fix TypeScript infrastructure** (4 servers)
2. **Add JavaScript testing** (1 server)
3. **Configure Python testing** (1 server)
4. **Locate/create missing Git server**
5. **Implement GitHub security constraints**

Following this documentation ensures the MCP servers ecosystem meets all architecture requirements and security constraints before deployment.

---

**Next Steps:**
1. Review the detailed status report in [`MCP_SERVERS_TESTING_STATUS.md`](./MCP_SERVERS_TESTING_STATUS.md)
2. Follow the execution guide in [`MCP_TESTING_EXECUTION_GUIDE.md`](./MCP_TESTING_EXECUTION_GUIDE.md)
3. Implement GitHub security constraints from [`GITHUB_MCP_TESTING_CONSTRAINTS.md`](./GITHUB_MCP_TESTING_CONSTRAINTS.md)
4. Reference the comprehensive guide in [`MCP_SERVERS_TESTING_GUIDE.md`](./MCP_SERVERS_TESTING_GUIDE.md)

This infrastructure work is **critical for the subsequent individual server testing phase**.