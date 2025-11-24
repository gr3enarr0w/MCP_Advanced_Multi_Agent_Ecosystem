# MCP Advanced Multi-Agent Ecosystem

[![Python 3.12+](https://img.shields.io/badge/python-3.12+-blue.svg)](https://www.python.org/downloads/)
[![Node.js](https://img.shields.io/badge/node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5+-blue.svg)](https://www.typescriptlang.org/)

A sophisticated, production-grade Model Context Protocol (MCP) ecosystem featuring advanced multi-agent orchestration, context persistence, and intelligent workflow automation. This ecosystem demonstrates enterprise-level multi-agent system architecture with local-first data storage and intelligent task delegation.

## 🚀 Project Overview

The MCP Advanced Multi-Agent Ecosystem is a comprehensive platform that orchestrates 7 interconnected MCP servers to provide intelligent agent workflow management. The system leverages the SPARC methodology (Specification → Pseudocode → Architecture → Refinement → Completion) to ensure structured, high-quality agent collaboration.

### Key Capabilities

- **🤖 Multi-Agent Orchestration**: Advanced agent delegation with keyword-based routing and boomerang refinement loops
- **💾 Context Persistence**: Vector-based memory with Python 3.12 powered context storage
- **🔍 Search Aggregation**: Multi-provider search intelligence with unified interface
- **🎯 Skills Management**: Dynamic capability tracking and skill evolution
- **🔗 GitHub Integration**: OAuth-secured repository and workflow management
- **⚡ External MCP Integration**: Seamless integration of external MCP servers as internal components

## 🏗️ Architecture

The ecosystem follows a distributed microservices architecture with 7 core MCP servers:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Agent Swarm    │◄──►│  Task Orchestrator│◄──►│ Skills Manager  │
│  (Central Hub)  │    │  (Routing Core)   │    │ (Capability DB) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                        │
         ▼                       ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Context Storage │    │  Search Aggregator│    │   Git Service   │
│ (Python 3.12)   │    │  (Multi-Provider) │    │ (OAuth Secured) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                        │
         └───────────────────────┼────────────────────────┘
                                 │
                    ┌──────────────────┐
                    │  External MCP    │
                    │  Integrations    │
                    │  (context7, etc.)│
                    └──────────────────┘
```

### Core Components

| Server | Technology | Primary Function |
|--------|-----------|------------------|
| **Agent Swarm** | TypeScript | Central orchestrator with keyword-based delegation |
| **Context Persistence** | Python 3.12 | Vector embeddings and memory storage |
| **Task Orchestrator** | TypeScript | Workflow routing and boomerang loops |
| **Search Aggregator** | TypeScript | Multi-provider search coordination |
| **Skills Manager** | TypeScript | Dynamic capability tracking |
| **Git Service** | Node.js | Repository and OAuth management |
| **External MCP** | Multiple | Integrated external server compatibility |

## 🚀 Quick Start

### Prerequisites

- **Python 3.12+** (mandatory for context persistence)
- **Node.js 18+** and **npm**
- **Git** for version control integration

### Installation

**Important: This project uses git submodules for external MCP servers.**

```bash
# Clone with submodules (recommended)
git clone --recursive https://github.com/gr3enarr0w/MCP_Advanced_Multi_Agent_Ecosystem.git
cd MCP_Advanced_Multi_Agent_Ecosystem

# Or if already cloned without --recursive:
git submodule update --init --recursive
```

Then run the setup:

```bash
# 1. Initial setup (includes submodule init, storage, and dependencies)
./scripts/setup.sh

# 2. Verify installation
./scripts/test-installation.sh
```

**Note**: If you see "Checkpoints disabled due to nested git repository", run:
```bash
git submodule update --init --recursive
```

### Local Storage

The ecosystem uses local-first storage in `~/.mcp/` with the following structure:
```
~/.mcp/
├── context/          # Vector embeddings and context storage
├── tasks/           # Task execution history and queues
├── cache/           # Search and code caching
├── skills/          # Capability and skill definitions
├── agents/          # Agent state and configurations
└── logs/            # System and execution logs
```

## 🔧 Configuration

### Environment Setup

The system requires several critical environment variables:

```bash
# External MCP server paths
EXTERNAL_MCP_SERVERS_PATH=/path/to/external/servers

# Search provider API keys
SEARCH_PROVIDER_API_KEYS=your-api-keys-here

# Agent swarm configuration
AGENT_SWARM_CONFIG=~/.mcp/agents/swarm-config.json

# GitHub OAuth credentials
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret
```

### Client Integration

The ecosystem provides configuration templates for popular MCP clients:

- **Roo Integration**: `roo-config/.roo/mcp.json`
- **Cursor Integration**: `configs/cursor-mcp.json`

Refer to `docs/installation/tool-configurations/` for detailed client setup instructions.

## 📚 Documentation

Comprehensive documentation is available in the `docs/` directory:

- **[Architecture Overview](docs/architecture/system-overview.md)** - System design and component interactions
- **[Installation Guide](docs/installation/quick-start.md)** - Step-by-step installation process
- **[Multi-Agent Guide](docs/usage/multi-agent-guide.md)** - Advanced agent orchestration patterns
- **[API Documentation](docs/api/)** - Complete API reference and examples
- **[Development Guide](docs/development/)** - Contributing guidelines and development workflows

## 🔄 Agent Workflows

The ecosystem implements the SPARC methodology for structured agent collaboration:

### SPARC Workflow Stages

1. **Specification** - Requirements gathering and task definition
2. **Pseudocode** - High-level solution design and algorithm planning
3. **Architecture** - Technical implementation design and component planning
4. **Refinement** - Iterative improvement and quality assurance
5. **Completion** - Final implementation and delivery

### Agent Delegation

Agents use keyword-based routing for intelligent task distribution:

- `analyze` → Research and data analysis agents
- `implement` → Development and coding agents
- `review` → Quality assurance and validation agents
- `document` → Documentation and communication agents
- `orchestrate` → Workflow coordination agents

## 🛠️ Development

### Project Structure

```
├── src/mcp-servers/        # Individual MCP server implementations
│   ├── agent-swarm/        # Central orchestrator service
│   ├── context-persistence/ # Python 3.12 context storage
│   ├── task-orchestrator/  # Workflow routing engine
│   ├── search-aggregator/  # Multi-provider search service
│   ├── skills-manager/     # Capability management system
│   ├── github-oauth/       # GitHub integration service
│   └── external/          # External MCP server integrations
├── configs/               # Client configuration templates
├── scripts/               # Setup, installation, and testing scripts
├── docs/                  # Comprehensive documentation
├── tests/                 # Cross-cutting integration tests
└── examples/              # Usage examples and workflows
```

### Building and Testing

```bash
# Install dependencies for all servers
./scripts/install-mcp-servers.sh

# Run tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:performance
```

### Adding New MCP Servers

1. Create server structure in `src/mcp-servers/`
2. Follow TypeScript/Python conventions and path aliases (`@/*`)
3. Add configuration templates to `configs/`
4. Update documentation in `docs/`
5. Include tests and validation

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines on:

- Code standards and review process
- Security requirements and best practices
- Testing and validation requirements
- Documentation and API standards

For AI assistant integration guidelines, see [AGENTS.md](AGENTS.md).

## 🔒 Security

- **No hardcoded secrets**: All credentials via environment variables
- **OAuth integration**: Secure GitHub and service authentication
- **Local-first storage**: Data sovereignty and privacy protection
- **Encrypted communications**: Secure inter-service communication

## 📊 Performance

- **30-second test timeouts**: Optimized for CI/CD pipelines
- **Vector storage**: Efficient context retrieval and similarity search
- **Cached results**: Intelligent caching for search and code operations
- **Load balancing**: Distributed task execution across agents

## 🔌 External MCP Servers (Git Submodules)

External MCPs extend the ecosystem's capabilities and are managed as **git submodules**:

| Server | Purpose | Routing Keywords |
|--------|---------|------------------|
| **context7** | Documentation lookup | `doc`, `manual`, `spec`, `reference` |
| **mcp-code-checker** | Code quality (pylint, pytest, mypy) | `lint`, `pylint`, `pytest`, `mypy`, `code quality` |

**Setup external MCPs:**
```bash
./scripts/setup-external-mcps.sh
```

**How it works:**
- External MCPs are internal to `agent-swarm` - Roo/Claude only sees agent-swarm
- The `delegate` tool routes requests based on keywords
- See [docs/EXTERNAL_MCPS_GUIDE.md](docs/EXTERNAL_MCPS_GUIDE.md) for complete documentation

## 🆘 Troubleshooting

Common issues and solutions:

1. **"Checkpoints disabled due to nested git repository"**
   ```bash
   # This means submodules weren't properly initialized
   git submodule update --init --recursive

   # If still failing, check for orphaned .git directories:
   find src/mcp-servers/external -name ".git" -type d
   # Should return empty - if not, reinitialize submodules
   ```

2. **Python 3.12 not found**: Install via pyenv or system package manager

3. **Permission errors**: Check pip installation flags and virtual environment

4. **Connection timeouts**: Verify network configuration and API keys

5. **Agent delegation failures**: Check keyword routing and boomerang configuration
   ```bash
   # Test routing with route_plan tool
   # Check agent-swarm logs for: "External MCP availability: {...}"
   ```

6. **External MCP not working**:
   ```bash
   # Verify submodule status
   git submodule status

   # Rebuild external MCPs
   ./scripts/setup-external-mcps.sh
   ```

For detailed troubleshooting, see [docs/installation/troubleshooting.md](docs/installation/troubleshooting.md) and [docs/EXTERNAL_MCPS_GUIDE.md](docs/EXTERNAL_MCPS_GUIDE.md).

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Model Context Protocol (MCP)** for the foundational protocol
- **Vector databases** for intelligent context storage
- **Agent orchestration frameworks** for workflow inspiration
- **Open source community** for tools and integrations

---

**Ready to orchestrate intelligent agent workflows?** Start with the [Quick Start Guide](docs/installation/quick-start.md) and explore the [Multi-Agent Guide](docs/usage/multi-agent-guide.md) for advanced patterns.