# GitHub MCP Server Testing Constraints

## Critical Security Requirement

**🚨 WRITE OPERATIONS MUST ONLY BE TESTED AGAINST USER-OWNED REPOSITORIES**

This is a non-negotiable security constraint to prevent accidental modifications to public repositories.

## Repository Classification

### User Repositories (Write Operations Allowed)
Repositories owned by the authenticated user where write operations are permitted for testing:

```bash
# Primary user repository
ceverson/MCP_Advanced_Multi_Agent_Ecosystem

# Additional user repositories (add as needed)
# ceverson/your-other-repo-1
# ceverson/your-other-repo-2
```

### Public Repositories (Read Operations Only)
Any public repository where only read operations are permitted:

```bash
# Example public test repositories
microsoft/vscode
facebook/react
torvalds/linux
apple/swift
google/go
```

## Operation Classification

### Write Operations (User Repos Only) 🔒

| Operation | Tool Name | Description | Test Constraint |
|-----------|-------------|-------------|-----------------|
| Create/Update File | `create_or_update_file` | Create or modify files in a repository | **User repos only** |
| Push Multiple Files | `push_files` | Push multiple files in a single commit | **User repos only** |
| Create Issue | `create_issue` | Create a new issue in a repository | **User repos only** |
| Create Pull Request | `create_pull_request` | Create a new pull request | **User repos only** |
| Add Issue Comment | `add_issue_comment` | Add comment to an existing issue | **User repos only** |
| Create Branch | `create_branch` | Create a new branch in a repository | **User repos only** |
| Merge Pull Request | `merge_pull_request` | Merge an existing pull request | **User repos only** |
| Create PR Review | `create_pull_request_review` | Create a review on a pull request | **User repos only** |
| Update Issue | `update_issue` | Update an existing issue | **User repos only** |
| Update PR Branch | `update_pull_request_branch` | Update PR branch with latest changes | **User repos only** |

### Read Operations (Any Public Repo) 📖

| Operation | Tool Name | Description | Test Constraint |
|-----------|-------------|-------------|-----------------|
| Get File Contents | `get_file_contents` | Read file or directory contents | Any public repo |
| Search Repositories | `search_repositories` | Search for repositories | Any public repo |
| Search Code | `search_code` | Search for code across repositories | Any public repo |
| Search Issues | `search_issues` | Search for issues and pull requests | Any public repo |
| Search Users | `search_users` | Search for GitHub users | Any public repo |
| List Commits | `list_commits` | List commits in a repository | Any public repo |
| List Issues | `list_issues` | List issues in a repository | Any public repo |
| List Pull Requests | `list_pull_requests` | List pull requests in a repository | Any public repo |
| Get Issue Details | `get_issue` | Get details of a specific issue | Any public repo |
| Get Pull Request | `get_pull_request` | Get details of a specific pull request | Any public repo |
| Get PR Files | `get_pull_request_files` | Get files changed in a pull request | Any public repo |
| Get PR Status | `get_pull_request_status` | Get combined status of PR checks | Any public repo |
| Get PR Comments | `get_pull_request_comments` | Get review comments on a pull request | Any public repo |
| Get PR Reviews | `get_pull_request_reviews` | Get reviews on a pull request | Any public repo |

## Test Implementation Strategy

### Configuration Setup

```javascript
// Test configuration for GitHub MCP server
const GITHUB_TEST_CONFIG = {
  // User repositories where write operations are allowed
  userRepos: [
    'ceverson/MCP_Advanced_Multi_Agent_Ecosystem',
    // Add additional user repositories as needed
  ],
  
  // Public repositories for read-only testing
  publicTestRepos: [
    'microsoft/vscode',
    'facebook/react', 
    'torvalds/linux',
    'apple/swift',
    'google/go'
  ],
  
  // Test constraints and validation
  constraints: {
    writeOperations: 'userReposOnly',
    readOperations: 'anyPublicRepo',
    requireAuthentication: true,
    enforceRateLimiting: true,
    logAllOperations: true
  },
  
  // Safety checks
  safetyChecks: {
    validateRepositoryOwnership: true,
    preventPublicRepoWrites: true,
    requireExplicitConfirmation: true,
    auditLogRetention: '90d'
  }
};
```

### Repository Validation Function

```javascript
/**
 * Validates if a write operation is allowed on a repository
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name  
 * @param {string} operation - Operation type ('write' or 'read')
 * @returns {boolean} - Whether operation is allowed
 */
function validateRepositoryOperation(owner, repo, operation) {
  const repoFullName = `${owner}/${repo}`;
  
  if (operation === 'write') {
    // Only allow write operations on user repositories
    return GITHUB_TEST_CONFIG.userRepos.includes(repoFullName);
  }
  
  if (operation === 'read') {
    // Allow read operations on any repository
    return true;
  }
  
  return false;
}

/**
 * Intercepts and validates GitHub MCP tool calls
 */
function interceptGitHubToolCall(toolName, args) {
  const writeOperations = [
    'create_or_update_file',
    'push_files', 
    'create_issue',
    'create_pull_request',
    'add_issue_comment',
    'create_branch',
    'merge_pull_request',
    'create_pull_request_review',
    'update_issue',
    'update_pull_request_branch'
  ];
  
  const isWriteOperation = writeOperations.includes(toolName);
  
  if (isWriteOperation && args.owner && args.repo) {
    const isAllowed = validateRepositoryOperation(args.owner, args.repo, 'write');
    
    if (!isAllowed) {
      throw new Error(
        `Write operation '${toolName}' not allowed on repository '${args.owner}/${args.repo}'. ` +
        'Write operations are only permitted on user-owned repositories for testing.'
      );
    }
    
    console.log(`✅ Write operation '${toolName}' approved for user repo: ${args.owner}/${args.repo}`);
  } else {
    console.log(`📖 Read operation '${toolName}' allowed for: ${args.owner}/${args.repo}`);
  }
  
  return true;
}
```

## Test Data Management

### Test Repository Structure

```
ceverson/MCP_Advanced_Multi_Agent_Ecosystem/
├── .github/
│   └── testing/
│       ├── test-data/
│       ├── test-issues/
│       └── test-prs/
├── test-files/
│   ├── sample-code/
│   ├── documentation/
│   └── configurations/
└── testing-logs/
    ├── write-operations.log
    ├── read-operations.log
    └── security-audit.log
```

### Test Data Cleanup

```javascript
/**
 * Cleanup test data after test runs
 */
async function cleanupTestData() {
  const cleanupOperations = [
    // Delete test branches
    'git branch -D test-*',
    
    // Close test issues
    'gh issue list --label "test" --limit 100 --json | jq ".[].number" | xargs -I {} gh issue close {}',
    
    // Close test PRs  
    'gh pr list --label "test" --limit 100 --json | jq ".[].number" | xargs -I {} gh pr close {}',
    
    // Remove test files
    'find . -name "*.test.*" -delete',
    'find . -name "test-*" -delete'
  ];
  
  for (const operation of cleanupOperations) {
    try {
      await executeCommand(operation);
      console.log(`✅ Cleanup completed: ${operation}`);
    } catch (error) {
      console.warn(`⚠️ Cleanup failed: ${operation} - ${error.message}`);
    }
  }
}
```

## Security Auditing

### Operation Logging

```javascript
/**
 * Logs all GitHub operations for security auditing
 */
function logOperation(operation, repository, result) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    operation: operation,
    repository: repository,
    result: result,
    userAgent: 'MCP-Testing-Framework',
    sessionId: getCurrentSessionId()
  };
  
  // Write to audit log
  fs.appendFileSync(
    'testing-logs/security-audit.log',
    JSON.stringify(logEntry) + '\n'
  );
  
  // Check for security violations
  if (result.securityViolation) {
    console.error('🚨 SECURITY VIOLATION DETECTED:', logEntry);
    sendSecurityAlert(logEntry);
  }
}
```

### Security Violation Detection

```javascript
/**
 * Detects potential security violations in GitHub operations
 */
function detectSecurityViolation(operation, args) {
  const violations = [];
  
  // Check for write operations on non-user repos
  if (isWriteOperation(operation) && !isUserRepository(args.owner, args.repo)) {
    violations.push({
      type: 'UNAUTHORIZED_WRITE',
      severity: 'CRITICAL',
      description: `Write operation on non-user repository: ${args.owner}/${args.repo}`
    });
  }
  
  // Check for suspicious file patterns
  if (args.path && isSuspiciousFilePath(args.path)) {
    violations.push({
      type: 'SUSPICIOUS_FILE_PATH',
      severity: 'HIGH', 
      description: `Suspicious file path: ${args.path}`
    });
  }
  
  // Check for large file uploads
  if (args.content && args.content.length > 1024 * 1024) { // 1MB
    violations.push({
      type: 'LARGE_FILE_UPLOAD',
      severity: 'MEDIUM',
      description: `Large file upload detected: ${args.content.length} bytes`
    });
  }
  
  return violations;
}
```

## Test Scenarios

### Write Operation Tests (User Repos Only)

```javascript
describe('GitHub MCP Write Operations', () => {
  const userRepo = 'ceverson/MCP_Advanced_Multi_Agent_Ecosystem';
  
  test('should create file in user repository', async () => {
    const result = await create_or_update_file({
      owner: 'ceverson',
      repo: 'MCP_Advanced_Multi_Agent_Ecosystem',
      path: 'test-files/sample-test.md',
      content: '# Test File\nThis is a test file.',
      message: 'Add test file for MCP testing'
    });
    
    expect(result.status).toBe(201);
    expect(result.content.sha).toBeDefined();
  });
  
  test('should reject file creation in public repository', async () => {
    await expect(
      create_or_update_file({
        owner: 'microsoft',
        repo: 'vscode', 
        path: 'test-file.md',
        content: 'This should fail',
        message: 'This should not be allowed'
      })
    ).rejects.toThrow('Write operation not allowed');
  });
  
  test('should create issue in user repository', async () => {
    const result = await create_issue({
      owner: 'ceverson',
      repo: 'MCP_Advanced_Multi_Agent_Ecosystem',
      title: 'Test Issue for MCP Testing',
      body: 'This is a test issue created during MCP server testing.',
      labels: ['test', 'automated']
    });
    
    expect(result.status).toBe(201);
    expect(result.data.number).toBeDefined();
  });
});
```

### Read Operation Tests (Any Public Repo)

```javascript
describe('GitHub MCP Read Operations', () => {
  test('should read file from public repository', async () => {
    const result = await get_file_contents({
      owner: 'microsoft',
      repo: 'vscode',
      path: 'README.md'
    });
    
    expect(result.status).toBe(200);
    expect(result.content).toBeDefined();
  });
  
  test('should search public repositories', async () => {
    const result = await search_repositories({
      query: 'language:typescript stars:>1000',
      perPage: 10
    });
    
    expect(result.status).toBe(200);
    expect(result.data.items).toHaveLength(10);
  });
  
  test('should search code in public repositories', async () => {
    const result = await search_code({
      q: 'useState react hooks',
      perPage: 5
    });
    
    expect(result.status).toBe(200);
    expect(result.data.items).toBeDefined();
  });
});
```

## Continuous Integration Integration

### GitHub Actions Workflow

```yaml
name: GitHub MCP Server Tests

on:
  push:
    paths: ['src/mcp-servers/github-oauth/**']
  pull_request:
    paths: ['src/mcp-servers/github-oauth/**']

jobs:
  test-github-mcp:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: |
          cd src/mcp-servers/github-oauth
          npm install
          
      - name: Run unit tests
        run: |
          cd src/mcp-servers/github-oauth
          npm run test:unit
          
      - name: Run integration tests
        run: |
          cd src/mcp-servers/github-oauth
          npm run test:integration
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          USER_REPOS: 'ceverson/MCP_Advanced_Multi_Agent_Ecosystem'
          
      - name: Run security tests
        run: |
          cd src/mcp-servers/github-oauth
          npm run test:security
          
      - name: Validate write constraints
        run: |
          cd src/mcp-servers/github-oauth
          node scripts/validate-write-constraints.js
```

## Emergency Procedures

### Security Incident Response

1. **Immediate Action**: Stop all write operations
2. **Investigation**: Review audit logs for unauthorized operations
3. **Remediation**: Revert any unauthorized changes
4. **Reporting**: Document incident and improve safeguards

### Rollback Procedures

```bash
# Emergency rollback script
#!/bin/bash

echo "🚨 Emergency GitHub MCP rollback initiated"

# Revert recent commits to user repositories
gh repo list --json nameWithOwner | jq '.[] | select(.nameWithOwner | contains("ceverson")) | .nameWithOwner' | while read repo; do
  echo "Checking repository: $repo"
  
  # Get recent commits from last 24 hours
  gh api repos/$repo/commits --since "$(date -d '1 day ago' -Iseconds)" | jq '.[].sha' | while read sha; do
    echo "Found recent commit: $sha in $repo"
    
    # Check if it's a test commit
    commit_message=$(gh api repos/$repo/commits/$sha | jq -r .commit.message)
    if [[ $commit_message == *"test"* ]] || [[ $commit_message == *"automated"* ]]; then
      echo "🔄 Reverting test commit: $sha"
      # git revert logic here
    fi
  done
done

echo "✅ Rollback completed"
```

## Conclusion

These constraints ensure that GitHub MCP server testing maintains strict security boundaries while allowing comprehensive testing of both read and write operations. The key principle is:

**Read operations can test any public repository, but write operations are strictly limited to user-owned repositories.**

This approach enables thorough testing while preventing accidental modifications to public repositories.