# Integration Tests for Cross-Phase MCP Workflows

This directory contains comprehensive integration tests for the MCP Advanced Multi-Agent Ecosystem, validating that all phases (6-11) work together correctly and that the MCP servers can communicate and coordinate effectively.

## Overview

The integration tests cover the following cross-phase workflows:

1. **Research to Tasks Workflow** (`workflow-research-to-tasks.test.ts`)
   - Tests: Search-Aggregator (Phase 8) → Task-Orchestrator (Phase 7)
   - Validates: Research plan generation → Task creation → Complexity analysis → Task selection

2. **Code Analysis to Knowledge Workflow** (`workflow-code-analysis-to-knowledge.test.ts`)
   - Tests: Code-Intelligence (Phase 10) → Context-Persistence (Phase 6)
   - Validates: Symbol extraction → Entity extraction → Knowledge graph building → Hybrid search

3. **Agent Swarm Orchestration Workflow** (`workflow-agent-swarm-orchestration.test.ts`)
   - Tests: Agent-Swarm (Phase 9) → Task-Orchestrator (Phase 7) → Search-Aggregator (Phase 8)
   - Validates: Session management → Worker spawning → Task delegation → Research execution → Report generation

4. **MCP Server Communication** (`mcp-server-communication.test.ts`)
   - Tests: All 7 MCP servers interoperability
   - Validates: Cross-server tool calls → Error propagation → Concurrent handling → Protocol compliance

5. **Visualization Pipeline Workflow** (`workflow-visualization-pipeline.test.ts`)
   - Tests: Chart-Generator (Phase 11) → Context-Persistence (Phase 6) → Task-Orchestrator (Phase 7)
   - Validates: Chart generation → Metadata storage → Task creation → Progress tracking

## Prerequisites

Before running integration tests, ensure:

1. **MCP Servers Built**: All MCP servers must be compiled and ready
   ```bash
   npm run build:search-aggregator
   npm run build:task-orchestrator
   npm run build:code-intelligence
   npm run build:chart-generator
   npm run build:agent-swarm
   ```

2. **Python Environment**: Context-Persistence server requires Python 3.12
   ```bash
   python3 --version  # Should be 3.12.x
   ```

3. **Environment Variables**: Set required environment variables
   ```bash
   export MCP_HOME=$HOME/.mcp
   export TAVILY_API_KEY=your-api-key
   export PERPLEXITY_API_KEY=your-api-key
   export BRAVE_API_KEY=your-api-key
   export MCP_ALLOW_MODEL_DOWNLOAD=1
   ```

4. **Dependencies**: Install test dependencies
   ```bash
   cd tests/integration
   npm install
   ```

## Running Tests

### Quick Start

Run all integration tests:
```bash
cd tests/integration
npm test
```

Run specific test files:
```bash
# Run specific workflow test
npm test -- workflow-research-to-tasks.test.ts

# Run with coverage
npm run test:coverage

# Run in watch mode for development
npm run test:watch
```

### Individual Test Suites

#### Research to Tasks Workflow
```bash
npm test -- workflow-research-to-tasks.test.ts
```
Tests complete research workflow from topic to actionable tasks.

#### Code Analysis to Knowledge Workflow
```bash
npm test -- workflow-code-analysis-to-knowledge.test.ts
```
Tests code analysis workflow and knowledge graph integration.

#### Agent Swarm Orchestration Workflow
```bash
npm test -- workflow-agent-swarm-orchestration.test.ts
```
Tests multi-agent coordination and SPARC workflow execution.

#### MCP Server Communication
```bash
npm test -- mcp-server-communication.test.ts
```
Tests interoperability between all MCP servers.

#### Visualization Pipeline Workflow
```bash
npm test -- workflow-visualization-pipeline.test.ts
```
Tests chart generation and visualization pipeline.

## Test Configuration

### Jest Configuration

The tests use Jest with the following configuration:

- **Test Timeout**: 30 seconds (as required by project standards)
- **Test Environment**: Node.js
- **Coverage**: HTML, LCOV, and text reports
- **Setup**: Automatic server management and cleanup

### Environment Variables for Testing

Tests use isolated MCP home directory:
```bash
MCP_HOME=./test-data/.mcp
```

### Test Data

Tests use comprehensive fixtures located in `fixtures/test-data.ts`:

- **Sample PRDs**: Product requirements documents for task generation
- **Code Files**: TypeScript, Python, JavaScript examples
- **Research Topics**: Various complexity levels and domains
- **Chart Data**: Multiple chart types with themes and options
- **Workflow Scenarios**: Expected durations and success criteria
- **Error Scenarios**: Failure modes and recovery steps

## Server Management

### MCPServerManager Utility

The `utils/mcp-server-manager.ts` provides:

- **Server Lifecycle**: Start, stop, restart MCP servers
- **Health Monitoring**: Check server availability and responsiveness
- **Client Management**: Create and manage MCP client connections
- **Process Management**: Handle server processes and stdio transport
- **Error Handling**: Graceful degradation and recovery

### Supported Servers

- **search-aggregator**: Multi-provider search with caching
- **task-orchestrator**: Task management and execution
- **code-intelligence**: Code parsing and symbol finding
- **chart-generator**: Chart generation with multiple types
- **agent-swarm**: Multi-agent coordination and SPARC workflows
- **context-persistence**: Conversation storage and knowledge graphs (Python)

## Test Scenarios

### Happy Path Tests

1. **Complete Workflows**: End-to-end execution of all phases
2. **Data Flow**: Validate data transformation between phases
3. **Performance**: Ensure operations complete within expected timeframes
4. **Memory Management**: Verify tiered memory usage in agent-swarm

### Error Handling Tests

1. **Server Failures**: Graceful handling of server unavailability
2. **Invalid Data**: Proper validation of malformed inputs
3. **Resource Exhaustion**: Memory and connection limit handling
4. **Timeout Scenarios**: Proper handling of long-running operations

### Performance Tests

1. **Concurrent Operations**: Multiple simultaneous requests
2. **Large Data**: Handling of substantial datasets
3. **Memory Scaling**: Linear memory usage patterns
4. **Throughput**: Operations per second metrics

## Coverage and Reporting

### Coverage Reports

Generate comprehensive coverage reports:
```bash
npm run test:coverage
```

Coverage reports include:
- **Line Coverage**: Statement and branch coverage
- **Function Coverage**: Function-level coverage metrics
- **Server Coverage**: Which MCP server tools are tested
- **Workflow Coverage**: End-to-end workflow validation

### Coverage Goals

Target coverage metrics:
- **Overall Coverage**: > 80%
- **Critical Path Coverage**: 100% for main workflows
- **Error Path Coverage**: > 90% for error scenarios
- **Integration Coverage**: 100% for cross-server communication

## Troubleshooting

### Common Issues

1. **Port Conflicts**: Ensure MCP servers use different ports
2. **Python Path**: Verify Python 3.12 is in PATH
3. **Memory Issues**: Increase available memory for large tests
4. **Timeout Failures**: Check server health and network connectivity

### Debug Mode

Run tests with additional debugging:
```bash
DEBUG=integration npm test
```

### Clean Up

Force cleanup of test data and servers:
```bash
npm run clean
```

## Architecture Validation

### MCP Protocol Compliance

Tests validate:
- **Tool Schema**: All tools implement proper input/output schemas
- **Error Responses**: Consistent error format across servers
- **Transport Layer**: Reliable stdio communication
- **Resource Management**: Proper cleanup and garbage collection

### Performance Benchmarks

Each test includes performance assertions:
- **Maximum Duration**: Based on workflow complexity
- **Memory Usage**: Linear scaling with data size
- **Concurrent Load**: Efficient handling of multiple requests
- **Recovery Time**: Quick server restart and reconnection

## Continuous Integration

### GitHub Actions

Example CI configuration:
```yaml
name: Integration Tests
on: [push, pull_request]
jobs:
  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: cd tests/integration && npm test
      - uses: actions/upload-artifact@v3
        with:
          name: coverage-report
          path: tests/coverage/
```

### Local Development

For development with hot reloading:
```bash
cd tests/integration
npm run test:watch
```

## Best Practices

### Test Design

1. **Isolation**: Each test runs in isolated environment
2. **Deterministic**: Tests use predictable data and scenarios
3. **Comprehensive**: Cover happy path, errors, and edge cases
4. **Maintainable**: Clear test structure and documentation

### Server Management

1. **Lifecycle**: Proper startup and shutdown procedures
2. **Health Checks**: Verify server readiness before testing
3. **Resource Cleanup**: Remove temporary files and processes
4. **Error Recovery**: Handle partial failures gracefully

### Data Management

1. **Fixtures**: Use consistent, versioned test data
2. **State Management**: Proper setup and teardown
3. **Assertions**: Clear validation of expected outcomes
4. **Logging**: Comprehensive test execution logging

## Contributing

When adding new integration tests:

1. **Follow Pattern**: Use existing test structure and utilities
2. **Update Fixtures**: Add test data to `fixtures/test-data.ts`
3. **Documentation**: Update this README with new test information
4. **Coverage**: Ensure new tests meet coverage requirements

### Test Naming

Use descriptive test names that clearly indicate:
- **Workflow Being Tested**: e.g., "should execute research-to-tasks workflow"
- **Specific Scenario**: e.g., "with large research results"
- **Expected Outcome**: e.g., "and complete within performance limits"

## Security Considerations

Integration tests include security validation:

1. **Input Sanitization**: All inputs are validated and sanitized
2. **Access Control**: Tests verify proper authorization checks
3. **Data Privacy**: No sensitive data in test fixtures
4. **Error Disclosure**: Error messages don't expose sensitive information

---

For detailed test implementation, see individual test files in this directory.