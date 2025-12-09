# Agent Rules Standard

## System Status: CRITICAL ISSUES IDENTIFIED

**Agent Swarm Status: 0% Functional**
**Overall System Health: 40% Operational**
**Production Readiness: NOT READY - 3-4 weeks to completion**

---

## Critical Architecture Requirements
- **7 interconnected MCP servers**: context-persistence (Python 3.12), task-orchestrator, search-aggregator, agent-swarm, skills-manager, git, and external MCP integrations
- **Agent delegation routing**: Keyword-based task routing system with boomerang pattern for refinement loops
- **TypeScript path aliases**: Strict `@/*` patterns required across all TypeScript services
- **Build order**: `setup.sh` → `install-mcp-servers.sh` → `test-installation.sh` (cannot be bypassed)

## Environment-Specific Requirements
- **Python 3.12 mandatory**: Context persistence requires complex virtual environment handling with `pyproject.toml`
- **Critical env vars**: External MCP server paths, search provider keys, and agent swarm configuration must be set
- **Multi-client sync**: MCP configuration files must sync across Roo/Cursor integration templates
- **Testing framework**: 30-second Jest timeouts with specific configs for unit/integration/performance/security suites

## External Dependencies
- External MCP servers integrated as internal dependencies (context7)
- Agent swarm with SPARC workflow execution (Specification → Pseudocode → Architecture → Refinement → Completion)

---

## Critical Issues Blocking Functionality

### 1. Context Persistence Server - 0% Functional
**Issue**: Server initialization fails during module import due to premature async operations
**Impact**: All conversation history and context management tools unavailable
**Root Cause**: Async event loop conflicts and circular import issues
**Test Results**: 7/8 tests failing (12.5% pass rate)

### 2. Agent Swarm - 0% Functional
**Issue**: No agents available for delegation despite framework being operational
**Impact**: SPARC workflows cannot start, multi-agent coordination impossible
**Root Cause**: Agent lifecycle management not initializing agents properly
**Status**: 12 tools defined but 0 agents to execute

### 3. ModelRouter Integration Gap - 25% Functional
**Issue**: Sophisticated subscription-first routing completely disconnected from ChatHandler
**Impact**: Advanced routing capabilities wasted, simple profile routing only
**Root Cause**: ModelRouter created but never passed to ChatHandler constructor

### 4. Search Aggregator - 80% Functional
**Issue**: Missing API keys for external search providers
**Impact**: Operating in fallback mode only, limited search capabilities
**Workaround**: Configure search provider API keys

---

## Component Status Summary

| Component | Implementation Quality | Functional Status | Critical Issues |
|-----------|----------------------|-------------------|-----------------|
| Context Persistence | ⭐⭐⭐⭐⭐ Excellent | ❌ 0% Functional | Server initialization failures |
| Task Orchestrator | ⭐⭐⭐⭐⭐ Excellent | ⚠️ 60% Functional | MCP connectivity issues |
| Agent Swarm | ⭐⭐⭐⭐⭐ Excellent | ❌ 0% Functional | No agents available |
| Search Aggregator | ⭐⭐⭐⭐⭐ Excellent | ✅ 80% Functional | Missing API keys |
| Skills Manager | ⭐⭐⭐⭐⭐ Excellent | ✅ 100% Functional | Limited skill inventory |
| NanoGPT Proxy | ⭐⭐⭐⭐⭐ Excellent | ⚠️ 25% Functional | ModelRouter integration gap |

---

## SPARC Workflows: Cannot Start - 0% Functional

**Current Status**: SPARC methodology (Specification → Pseudocode → Architecture → Refinement → Completion) is fully implemented but completely non-functional due to:
- No agents available for task delegation
- Context persistence tools inaccessible
- Integration gaps preventing workflow execution

---

## Immediate Actions Required

### Critical Fixes (4-6 hours)
1. **Fix ModelRouter Integration** - Add missing parameter to ChatHandler constructor
2. **Fix Context Persistence Initialization** - Implement proper async lifespan management
3. **Resolve Agent Swarm Lifecycle** - Debug agent creation and availability

### High Priority (1-2 weeks)
4. **Configure Search Providers** - Add API keys for external services
5. **Implement Role-Based Authentication** - Complete security framework
6. **Comprehensive Testing** - Achieve 90%+ test coverage

---

## Production Readiness Timeline

**Current State**: NOT READY - Multiple critical system failures
**Path to Production**: 3-4 weeks with focused effort
**Primary Blockers**: 3 critical integration failures
**Risk Level**: HIGH - System instability and capability gaps

---

## Reference Documentation

**Comprehensive Test Report**: See `COMPREHENSIVE_FINAL_TEST_REPORT.md` for detailed analysis
**Context Persistence Analysis**: See `CONTEXT_PERSISTENCE_TEST_REPORT.md` for server-specific issues
**Integration Gap Analysis**: See architecture documentation for detailed breakdown

---

*Last Updated: December 7, 2025*
*System Status: CRITICAL - Immediate attention required*