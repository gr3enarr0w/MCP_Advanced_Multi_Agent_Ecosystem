# CI/CD Pipeline Documentation

## Overview

The MCP Advanced Multi-Agent Ecosystem features a comprehensive CI/CD pipeline designed to ensure code quality, test coverage, and reliable deployments across all 7 interconnected MCP servers.

## Pipeline Architecture

### Workflow Files

- **[`.github/workflows/ci.yml`](../.github/workflows/ci.yml)** - Main CI pipeline for build verification and installation testing
- **[`.github/workflows/test.yml`](../.github/workflows/test.yml)** - Comprehensive testing with unit, integration, performance, and E2E tests
- **[`.github/workflows/coverage.yml`](../.github/workflows/coverage.yml)** - Coverage reporting and analysis

### Triggers

All pipelines are triggered by:
- **Push** to `main` and `develop` branches
- **Pull Requests** to `main` and `develop` branches
- **Schedule** (daily runs at 2-3 AM UTC for comprehensive testing)
- **Manual** dispatch for selective testing

## CI Pipeline (`ci.yml`)

### Purpose

The main CI pipeline ensures that all MCP servers can be built, installed, and properly integrated.

### Jobs

#### 1. Setup Environment
- **Cache Management**: Intelligent caching for Node.js, Python, and Go dependencies
- **Submodule Handling**: Recursive checkout and initialization of git submodules
- **Dependency Installation**: Runs `setup.sh` and `install-mcp-servers.sh`
- **Artifact Storage**: Preserves build artifacts for downstream jobs

#### 2. Test Go Servers
- **Matrix Strategy**: Tests `task-orchestrator`, `search-aggregator`, `skills-manager`
- **Build Verification**: Ensures Go binaries are properly compiled
- **Startup Testing**: Validates that servers start and exit gracefully
- **Integration Tests**: Runs Go integration test suite with 30s timeout

#### 3. Test TypeScript Servers
- **Matrix Strategy**: Tests `chart-generator`, `code-intelligence`, `prompt-cache-mcp`, `vision-adapter`
- **Build Verification**: Ensures TypeScript compilation succeeds
- **Test Execution**: Runs Jest tests with 30s timeout
- **Artifact Collection**: Gathers coverage and test results

#### 4. Test Python Servers
- **Context Persistence**: Tests Python 3.12 context storage server
- **Pytest Execution**: Runs unit and integration tests with coverage
- **Virtual Environment**: Proper Python 3.12 environment setup

#### 5. Test GitHub OAuth Server
- **Syntax Validation**: Ensures Node.js code is valid
- **Dependency Check**: Verifies npm dependencies are properly installed
- **OAuth Integration**: Validates GitHub OAuth functionality

#### 6. End-to-End Tests
- **Complete Workflow**: Runs full E2E test suite
- **Cross-Server Testing**: Validates inter-server communication
- **Real-world Scenarios**: Tests actual usage patterns

#### 7. Installation Verification
- **Build Order**: Enforces `setup.sh` → `install-mcp-servers.sh` → `test-installation.sh`
- **Artifact Validation**: Ensures all required files are present
- **Integration Testing**: Validates complete ecosystem functionality

### Caching Strategy

```yaml
# Node.js caching
- name: Cache Node modules
  uses: actions/cache@v3
  with:
    path: |
      ~/.npm
      **/node_modules
    key: node-${{ hashFiles('**/package-lock.json', '**/package.json') }}

# Python caching  
- name: Cache Python packages
  uses: actions/cache@v3
  with:
    path: |
      ~/.cache/pip
      ~/.local/share/virtualenvs
    key: python-${{ hashFiles('**/pyproject.toml', '**/requirements.txt') }}

# Go caching
- name: Cache Go modules
  uses: actions/cache@v3
  with:
    path: |
      ~/.cache/go-build
      ~/go/pkg/mod
    key: go-${{ hashFiles('**/go.sum', '**/go.mod') }}
```

## Comprehensive Testing Pipeline (`test.yml`)

### Purpose

Provides extensive testing coverage including unit, integration, performance, and security testing across all MCP servers.

### Test Types

#### 1. Unit Tests
- **Go Servers**: `go test ./... -v -short`
- **TypeScript Servers**: `npm run test:unit --if-present`
- **Python Servers**: `python -m pytest tests/unit -v --tb=short`

#### 2. Integration Tests
- **Go Integration**: `go test -v ./test/integration/... -timeout 60s`
- **TypeScript Integration**: `npm run test:integration --if-present`
- **Python Integration**: `python -m pytest tests/integration -v --tb=short --timeout=60`

#### 3. Performance Tests
- **Startup Performance**: Measures server startup times
- **Build Performance**: Tests TypeScript compilation speed
- **Benchmark Tests**: Runs performance benchmarks if available

#### 4. End-to-End Tests
- **Complete E2E**: Runs `scripts/test-all-mcp-servers.sh`
- **Final Validation**: Runs `scripts/final-e2e-test.sh`
- **Cross-Platform**: Tests on Ubuntu with all dependencies

#### 5. Security Tests
- **Dependency Audit**: `npm audit` for all Node.js packages
- **Python Security**: `safety` and `bandit` for Python packages
- **Go Security**: `gosec` for Go code (if available)
- **Secret Detection**: Scans for hardcoded credentials

### Test Matrix Strategy

```yaml
strategy:
  matrix:
    include:
      - name: 'Go Servers'
        path: 'MCP_structure_design/mcp-servers-go'
        test-command: 'go test ./... -v -short'
        cache-key: 'go-unit'
      - name: 'TypeScript Servers'
        path: 'src/mcp-servers'
        test-command: 'npm run test:unit --if-present'
        cache-key: 'ts-unit'
      - name: 'Python Context Persistence'
        path: 'src/mcp-servers/context-persistence'
        test-command: 'python -m pytest tests/unit -v --tb=short'
        cache-key: 'py-unit'
```

## Coverage Pipeline (`coverage.yml`)

### Purpose

Generates, merges, and reports code coverage across all MCP servers with threshold enforcement.

### Coverage Generation

#### Go Coverage
```bash
go test -coverprofile=coverage.out -covermode=atomic ./...
go tool cover -html=coverage.out -o coverage.html
```

#### TypeScript Coverage
```bash
npm run test:coverage --if-present
# Generates LCOV format for Codecov integration
```

#### Python Coverage
```bash
python -m pytest --cov=src/context_persistence --cov-report=xml --cov-report=html --cov-report=lcov
```

### Coverage Merging

```bash
# Merge LCOV files from all languages
lcovmerge coverage-ts/*.lcov coverage-py/*.lcov combined.lcov

# Generate coverage summary
lcov --summary combined.lcov > coverage-summary.txt
```

### Threshold Enforcement

- **Minimum Coverage**: 80% across all codebases
- **Failure Condition**: Pipeline fails if coverage drops below threshold
- **PR Comments**: Automatic coverage reports on pull requests
- **Badge Generation**: Dynamic coverage badges for README

### Coverage Reporting

- **Codecov Integration**: Uploads to Codecov with proper token authentication
- **Artifact Storage**: Coverage reports stored as GitHub artifacts
- **PR Comments**: Coverage summaries posted as PR comments
- **Badge Updates**: README badges updated on main branch

## Environment Variables

### Required Secrets

```yaml
# Codecov token for coverage reporting
CODECOV_TOKEN: ${{ secrets.CODECOV_TOKEN }}

# Optional: External service credentials
GITHUB_CLIENT_ID: ${{ secrets.GITHUB_CLIENT_ID }}
GITHUB_CLIENT_SECRET: ${{ secrets.GITHUB_CLIENT_SECRET }}
SEARCH_PROVIDER_API_KEYS: ${{ secrets.SEARCH_PROVIDER_API_KEYS }}
```

### Configuration Variables

```yaml
# Versions
NODE_VERSION: '20'
PYTHON_VERSION: '3.12'
GO_VERSION: '1.21'

# Pipeline settings
COVERAGE_THRESHOLD: '80'
PIP_INDEX_URL: 'https://pypi.org/simple'
PIP_TRUSTED_HOST: 'pypi.org'
```

## Artifacts

### Build Artifacts

- **Setup Artifacts**: `setup-artifacts`
  - `~/.mcp/` directory structure
  - Go server binaries (`dist/`)
  - TypeScript compiled output (`dist/`)
  - Retention: 1 day

### Test Artifacts

- **Unit Tests**: `unit-test-results-{type}`
  - Coverage reports (HTML, XML, LCOV)
  - Test results (JUnit format)
  - Retention: 7 days

- **Integration Tests**: `integration-test-results-{server}`
  - Integration test logs
  - Cross-server test results
  - Retention: 7 days

- **E2E Tests**: `e2e-test-results`
  - Complete E2E execution logs
  - Performance metrics
  - Retention: 7 days

- **Coverage Reports**: `merged-coverage`
  - Combined LCOV files
  - Coverage summaries
  - Coverage badges
  - Retention: 7 days

## Performance Optimizations

### Parallel Execution

- **Matrix Strategy**: Tests run in parallel across server types
- **Dependency Caching**: Reduces setup time by 60-80%
- **Artifact Reuse**: Build artifacts shared between jobs
- **Selective Testing**: Manual dispatch for specific test types

### Timeout Management

- **Jest Tests**: 30-second timeout (as required by project standards)
- **Go Tests**: 60-second timeout for integration tests
- **Python Tests**: 60-second timeout with pytest
- **E2E Tests**: Extended timeouts for complete workflows

## Security Features

### Automated Scanning

- **Dependency Vulnerabilities**: npm audit for all Node.js packages
- **Python Security**: safety check for known vulnerabilities
- **Code Analysis**: bandit for Python security issues
- **Secret Detection**: Pattern matching for hardcoded credentials

### Secure Practices

- **No Hardcoded Secrets**: All credentials via environment variables
- **Token Management**: GitHub secrets for sensitive data
- **Minimal Permissions**: Least privilege principle for workflow tokens
- **Audit Logging**: All security scans logged and reported

## Troubleshooting

### Common Issues

#### 1. Cache Misses
```bash
# Clear caches if dependency changes aren't detected
rm -rf ~/.npm ~/.cache/pip ~/.cache/go-build
```

#### 2. Test Timeouts
```bash
# Increase timeouts for slow tests
# Check test environment and resource limits
# Verify test isolation and cleanup
```

#### 3. Coverage Failures
```bash
# Check coverage configuration
# Verify test discovery patterns
# Ensure all source files are included
```

#### 4. Build Failures
```bash
# Check dependency versions
# Verify build environment
# Review build logs for specific errors
```

### Debug Mode

Enable debug logging by adding to workflow files:

```yaml
env:
  DEBUG: true
  ACTIONS_STEP_DEBUG: true
```

## Branch Protection

### Required Checks

Configure branch protection in GitHub repository settings:

1. **Require status checks to pass before merging**
2. **Require branches to be up to date**
3. **Require pull request reviews**
4. **Require status checks to pass before merging**:
   - CI Pipeline (all jobs must pass)
   - Coverage Threshold (80% minimum)
   - Comprehensive Testing (all test types must pass)

### Required Status Checks

- `setup` - Environment setup and dependency installation
- `test-go-servers` - Go server tests
- `test-ts-servers` - TypeScript server tests
- `test-python-servers` - Python server tests
- `test-github-oauth` - GitHub OAuth server tests
- `test-e2e` - End-to-end tests
- `test-installation` - Installation verification
- `ci-status` - Overall CI status validation

## Local Development

### Running Tests Locally

```bash
# Install dependencies
./scripts/setup.sh
./scripts/install-mcp-servers.sh

# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:performance
npm run test:e2e

# Run coverage locally
npm run test:coverage
```

### Local Coverage

```bash
# Generate coverage for all servers
npm run test:coverage

# View coverage reports
open src/mcp-servers/*/coverage/lcov-report/index.html
open src/mcp-servers/context-persistence/htmlcov/index.html
```

## Monitoring and Alerting

### Pipeline Health

- **Success Rate**: Monitor pipeline success/failure rates
- **Performance Metrics**: Track pipeline execution times
- **Coverage Trends**: Monitor coverage percentage changes
- **Test Flakiness**: Identify unreliable tests

### Alerting Setup

Configure GitHub notifications or external monitoring for:

- Pipeline failures
- Coverage drops below threshold
- Performance regressions
- Security vulnerability detections

## Best Practices

### Development

1. **Write Tests**: Include tests with new features and bug fixes
2. **Coverage Maintenance**: Maintain >80% coverage across all codebases
3. **Local Testing**: Run tests locally before pushing
4. **Commit Messages**: Use descriptive commit messages for better tracking

### Pipeline Maintenance

1. **Regular Updates**: Keep dependencies and actions up to date
2. **Review Logs**: Monitor pipeline logs for issues
3. **Optimize Caching**: Adjust cache keys based on dependency changes
4. **Security Scanning**: Regular security audit and dependency updates

### Performance

1. **Parallel Execution**: Leverage matrix strategy for faster feedback
2. **Smart Caching**: Optimize cache keys for better hit rates
3. **Artifact Management**: Clean up old artifacts regularly
4. **Resource Limits**: Monitor and optimize resource usage

## Integration with External Services

### Codecov Integration

```yaml
- name: Upload to Codecov
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/combined.lcov,./coverage/coverage.xml
    flags: unittests
    name: mcp-ecosystem-coverage
    fail_ci_if_error: true
    verbose: true
    token: ${{ secrets.CODECOV_TOKEN }}
```

### GitHub Status API

```yaml
- name: Check CI Status
  run: |
    if [[ "${{ needs.setup.result }}" == "success" ]] && \
       [[ "${{ needs.test-go-servers.result }}" == "success" ]] && \
       [[ "${{ needs.test-ts-servers.result }}" == "success" ]]; then
      echo "✅ All CI jobs passed successfully!"
      exit 0
    else
      echo "❌ Some CI jobs failed"
      exit 1
    fi
```

## Future Enhancements

### Planned Improvements

1. **Multi-Platform Testing**: Add Windows and macOS testing
2. **Container-based Testing**: Docker-based test environments
3. **Performance Regression**: Automated performance regression detection
4. **Advanced Security**: SAST/DAST integration
5. **Deployment Automation**: Automated deployment to staging/production

### Extension Points

The pipeline is designed to be extensible:

- **New MCP Servers**: Easy to add new servers to test matrix
- **Additional Test Types**: Framework supports adding new test categories
- **Custom Coverage**: Configurable coverage thresholds and reporting
- **Integration Hooks**: Points for custom deployment and notification logic

---

For more information, see the [GitHub Actions workflows](../.github/workflows/) and [project documentation](../README.md).