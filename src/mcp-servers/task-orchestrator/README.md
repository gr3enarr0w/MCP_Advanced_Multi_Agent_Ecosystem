# Enhanced Task Orchestrator MCP Server

A powerful, local-first MCP server that combines task management with embedded code execution and analysis capabilities. This enhanced version replaces the functionality of legacy servers (python-interpreter, code-runner, code-checker) by embedding their essential features directly into the Task Orchestrator.

## 🚀 Features

### Core Task Management
- **Local-first task management** with SQL.js (pure JavaScript SQLite)
- **Git integration** for auto-tracking and commit linking
- **DAG dependency graph** using graphology for complex task relationships
- **Priority-based task ordering** and lifecycle management
- **Task status tracking**: pending → in_progress → blocked → completed

### Embedded Code Execution
- **Multi-language support**: Python, JavaScript/TypeScript, Bash, SQL
- **Sandboxed execution** with resource limits and security controls
- **Package management** for Python environments
- **Execution history tracking** with detailed logs and metrics
- **Timeout and memory protection** for safe code execution

### Code Analysis & Quality Assessment
- **Static code analysis** with language-specific rules
- **Security vulnerability scanning** with pattern detection
- **Code quality metrics** calculation and scoring
- **Automated suggestions** for code improvement
- **Historical trend analysis** for quality tracking

### Integration Capabilities
- **Context persistence** integration for storing execution results
- **Search aggregator** integration for finding relevant code examples
- **Skills manager** integration for tracking execution patterns
- **File watching** for automatic analysis triggers

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- Python 3.8+ (for Python code execution)
- SQLite3 (for SQL execution)

### Setup
```bash
cd mcp-servers/task-orchestrator
npm install
npm run build
```

### Configuration
The server automatically creates necessary directories in `~/.mcp/`:
- `~/.mcp/tasks/` - Task database storage
- `~/.mcp/cache/code/` - Code execution cache
- `~/.mcp/logs/` - Server logs

## 🛠️ Available Tools

### Task Management Tools

#### `create_task`
Create a new task with optional code execution environment.
```json
{
  "title": "Implement user authentication",
  "description": "Create login system with JWT tokens",
  "priority": 10,
  "dependencies": [1, 2],
  "tags": ["auth", "security"],
  "execution_environment": "python",
  "code_language": "python"
}
```

#### `update_task_status`
Update task status through the workflow.
```json
{
  "task_id": 1,
  "status": "in_progress"
}
```

#### `get_task`
Retrieve task details with optional execution history.
```json
{
  "task_id": 1,
  "include_executions": true,
  "include_analysis": true
}
```

#### `list_tasks`
List tasks with filtering and metrics.
```json
{
  "status": "in_progress",
  "code_language": "python",
  "include_metrics": true
}
```

#### `get_task_graph`
Generate dependency graphs in JSON or Mermaid format.
```json
{
  "format": "mermaid",
  "include_executions": true
}
```

### Code Execution Tools

#### `execute_code`
Execute code in multiple programming languages.
```json
{
  "task_id": 1,
  "language": "python",
  "code": "print('Hello, World!')",
  "timeout": 30000,
  "packages": ["requests", "numpy"]
}
```

#### `execute_python_code`
Execute Python code with sandbox security.
```json
{
  "task_id": 1,
  "code": "import math\nprint(math.sqrt(16))",
  "timeout": 30000,
  "packages": ["numpy", "pandas"],
  "sandbox_enabled": true
}
```

#### `execute_javascript_code`
Execute JavaScript/TypeScript code safely.
```json
{
  "task_id": 1,
  "code": "console.log('Hello from JS!');\n[1,2,3].map(x => x * 2);",
  "timeout": 30000,
  "sandbox_enabled": true
}
```

#### `execute_bash_command`
Execute bash commands with security restrictions.
```json
{
  "task_id": 1,
  "command": "ls -la && echo 'Current directory contents'",
  "timeout": 30000,
  "security_level": "medium"
}
```

### Code Analysis Tools

#### `analyze_code_quality`
Perform comprehensive code quality analysis.
```json
{
  "task_id": 1,
  "target_path": "./src/main.py",
  "language": "python",
  "analysis_depth": "full"
}
```

#### `scan_security`
Security vulnerability scanning.
```json
{
  "task_id": 1,
  "target_path": "./src/auth.py",
  "language": "python",
  "scan_types": ["vulnerabilities", "secrets", "injection"]
}
```

#### `get_code_metrics`
Calculate code complexity and quality metrics.
```json
{
  "task_id": 1,
  "target_path": "./src/utils.py",
  "language": "python",
  "include_trends": true
}
```

#### `get_execution_history`
Retrieve execution history for tasks.
```json
{
  "task_id": 1,
  "status": "completed",
  "language": "python",
  "limit": 10
}
```

#### `get_analysis_results`
Get code analysis results.
```json
{
  "task_id": 1,
  "analysis_type": "quality"
}
```

## 🔒 Security Features

### Sandboxed Execution
- **VM2 sandbox** for JavaScript execution
- **Subprocess isolation** for Python and system commands
- **Resource limits** on execution time and memory usage
- **Blocked command list** for dangerous operations

### Security Configuration
```typescript
const securityConfig = {
  maxExecutionTime: 30000,    // 30 seconds
  maxMemoryUsage: 512 * 1024 * 1024, // 512MB
  maxOutputSize: 10 * 1024 * 1024,   // 10MB
  allowedImports: ['os', 'sys', 'json', 'math'],
  blockedCommands: ['rm', 'del', 'format', 'shutdown'],
  sandboxEnabled: true
};
```

### Vulnerability Detection
- **Code injection patterns** (eval, exec, subprocess with shell=True)
- **Hardcoded secrets** (passwords, API keys, tokens)
- **XSS vulnerabilities** (innerHTML, document.write)
- **Unsafe imports** (dynamic imports, pickle.load)

## 📊 Database Schema

### Enhanced Tasks Table
```sql
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  priority INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  dependencies TEXT DEFAULT '[]',
  git_commits TEXT DEFAULT '[]',
  tags TEXT DEFAULT '[]',
  metadata TEXT DEFAULT '{}',
  execution_environment TEXT,
  code_language TEXT,
  test_results TEXT,
  quality_score INTEGER,
  execution_logs TEXT
);
```

### Code Executions Table
```sql
CREATE TABLE code_executions (
  id TEXT PRIMARY KEY,
  task_id INTEGER,
  language TEXT NOT NULL,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  output TEXT DEFAULT '',
  error TEXT DEFAULT '',
  execution_time REAL DEFAULT 0,
  memory_usage REAL DEFAULT 0,
  start_time TEXT,
  end_time TEXT,
  environment TEXT DEFAULT 'default',
  dependencies TEXT DEFAULT '[]',
  security_level TEXT DEFAULT 'medium',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
```

### Code Analysis Table
```sql
CREATE TABLE code_analysis (
  id TEXT PRIMARY KEY,
  task_id INTEGER,
  analysis_type TEXT NOT NULL,
  target_path TEXT NOT NULL,
  results TEXT DEFAULT '{}',
  quality_score INTEGER DEFAULT 0,
  suggestions TEXT DEFAULT '[]',
  issues TEXT DEFAULT '[]',
  scan_duration REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
```

## 🔄 Integration Examples

### Context Persistence Integration
```typescript
// Save execution results to context
await contextPersistence.saveContext({
  type: 'code_execution',
  task_id: taskId,
  execution_id: executionId,
  results: executionResults
});
```

### Search Aggregator Integration
```typescript
// Find relevant code examples
const examples = await searchAggregator.search({
  query: 'python authentication jwt',
  language: 'python',
  limit: 5
});
```

### Skills Manager Integration
```typescript
// Track execution patterns
await skillsManager.updateSkillProgress({
  skill: 'python_authentication',
  task_id: taskId,
  success: executionStatus === 'completed',
  complexity: qualityScore
});
```

## 📈 Performance Metrics

### Execution Performance
- **Python execution**: < 5 seconds startup
- **JavaScript execution**: < 1 second startup
- **Analysis completion**: < 10 seconds for average file
- **Memory usage**: < 512MB for typical operations

### Quality Metrics
- **Security scan coverage**: > 90%
- **Language support**: Python, JavaScript, TypeScript, Bash, SQL
- **Analysis accuracy**: Rule-based with configurable thresholds
- **Historical tracking**: Complete execution and analysis history

## 🧪 Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### Performance Tests
```bash
npm run test:performance
```

## 🚀 Deployment

### Development Mode
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
CMD ["node", "dist/index.js"]
```

## 📝 Usage Examples

### Complete Workflow Example
```typescript
// 1. Create a task with code execution environment
const task = await createTask({
  title: "Data analysis script",
  description: "Analyze sales data and generate report",
  execution_environment: "python",
  code_language: "python",
  priority: 8
});

// 2. Execute Python code
const execution = await executePythonCode({
  task_id: task.task_id,
  code: `
import pandas as pd
import matplotlib.pyplot as plt

# Load and analyze data
df = pd.read_csv('sales.csv')
summary = df.describe()
print("Sales Summary:")
print(summary)
`,
  packages: ["pandas", "matplotlib"]
});

// 3. Analyze code quality
const analysis = await analyzeCodeQuality({
  task_id: task.task_id,
  code: execution.code,
  language: "python",
  analysis_depth: "full"
});

// 4. Scan for security issues
const securityScan = await scanSecurity({
  task_id: task.task_id,
  code: execution.code,
  language: "python"
});

// 5. Get comprehensive metrics
const metrics = await getCodeMetrics({
  task_id: task.task_id,
  code: execution.code,
  language: "python",
  include_trends: true
});
```

## 🔧 Configuration

### Environment Variables
```bash
# Server configuration
MCP_HOME=~/.mcp
TASKS_DB_PATH=~/.mcp/tasks/tasks.db
CODE_CACHE_PATH=~/.mcp/cache/code
LOGS_DIR=~/.mcp/logs

# Security settings
MAX_EXECUTION_TIME=30000
MAX_MEMORY_USAGE=524288000
MAX_OUTPUT_SIZE=10485760
SANDBOX_ENABLED=true

# Integration settings
ENABLE_CONTEXT_PERSISTENCE=true
ENABLE_SEARCH_AGGREGATION=true
ENABLE_SKILLS_TRACKING=true
```

### Custom Security Policies
```typescript
const customPolicy = {
  name: 'strict_security',
  max_execution_time: 10000,
  max_memory_usage: 256 * 1024 * 1024,
  allowed_imports: ['json', 'math'],
  blocked_commands: ['rm', 'del', 'format', 'shutdown', 'reboot'],
  sandbox_enabled: true
};
```

## 🐛 Troubleshooting

### Common Issues

#### Python Execution Fails
```bash
# Check Python installation
python3 --version

# Install required packages
pip3 install --user requests numpy
```

#### Permission Errors
```bash
# Fix directory permissions
chmod -R 755 ~/.mcp/
```

#### Memory Issues
```bash
# Monitor memory usage
top -p $(pgrep -f task-orchestrator)
```

### Debug Mode
```bash
DEBUG=task-orchestrator:* npm start
```

### Log Analysis
```bash
# View logs
tail -f ~/.mcp/logs/task-orchestrator.log

# Search for errors
grep ERROR ~/.mcp/logs/task-orchestrator.log
```

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Install dependencies: `npm install`
4. Make changes and add tests
5. Run tests: `npm test`
6. Build: `npm run build`
7. Submit a pull request

### Code Standards
- TypeScript for type safety
- Comprehensive error handling
- Detailed logging
- Security-first approach
- Performance optimization

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- MCP SDK team for the excellent framework
- SQL.js for pure JavaScript SQLite
- VM2 for secure JavaScript execution
- Graphology for dependency graph management
- Winston for structured logging

## 📞 Support

For issues and questions:
1. Check the troubleshooting section
2. Review the logs in `~/.mcp/logs/`
3. Create an issue with detailed information
4. Include reproduction steps and environment details