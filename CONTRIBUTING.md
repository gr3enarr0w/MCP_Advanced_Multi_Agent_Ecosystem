# Contributing to MCP Advanced Multi-Agent Ecosystem

Thank you for your interest in contributing. This repository is a consolidated, production-grade MCP ecosystem composed of multiple independent MCP servers, shared tooling, and documentation. The guidelines below ensure changes remain secure, consistent, and easy to operate.

## Core Principles

- Security first:
  - Never commit secrets, tokens, or credentials.
  - Use environment variables or a secrets manager for all sensitive values.
- Immutable, testable changes:
  - Prefer additive changes and versioned releases.
  - Every change should be verifiable via tests or documented manual steps.
- Clear boundaries:
  - Each MCP server remains independently runnable and testable.
  - Shared contracts (APIs, configs) are documented in `docs/` and `configs/`.

## Repository Structure (High Level)

- `src/mcp-servers/*` — Individual MCP servers (Node.js/TypeScript or Python).
- `configs/` — Client configuration templates and shared settings.
- `docs/` — Architecture, installation, usage, API, and development docs.
- `scripts/` — Setup, install, configure, and test helpers.
- `tests/` — Cross-cutting integration and E2E tests.
- `examples/` — Example workflows and client setups.

Before contributing, familiarize yourself with `README.md` and relevant `docs/development/*`.

## How to Contribute

### 1. Issues and Proposals

- Use issues to propose:
  - New MCP servers or tools
  - Enhancements to orchestration, skills, or persistence
  - Bug reports or security concerns
- When possible, include:
  - Context and motivation
  - Proposed design/architecture
  - Impact on existing servers and clients

### 2. Branching and Commits

- Fork or create a feature branch from `main`:
  - `feat/...` for new features
  - `fix/...` for bug fixes
  - `docs/...` for documentation changes
  - `chore/...` for maintenance or non-functional updates

- Use Conventional Commits:
  - `feat: add new search provider to search-aggregator`
  - `fix: handle token expiry in github-oauth server`
  - `docs: update multi-agent architecture diagrams`
  - `chore: bump dependencies for agent-swarm`

### 3. Coding Standards

- TypeScript/Node.js MCP servers:
  - Follow existing tsconfig/eslint patterns where present.
  - Prefer explicit types and clear error handling.
  - Keep server entrypoints minimal; move logic into modules.

- Python MCP servers:
  - Follow PEP 8 and existing layout (`src/` + `pyproject.toml`/`setup.cfg` if present).
  - Use virtual environments; do not commit `.venv` or `venv` folders.
  - Keep side effects behind `if __name__ == "__main__":` when applicable.

- Shared expectations:
  - No hard-coded secrets or environment-specific paths.
  - Provide configuration via `.env.example` templates where needed.
  - Keep logs structured and avoid noisy debug output by default.

### 4. Tests

- Add or update tests for any behavior change:
  - Unit tests inside the relevant server package.
  - Integration/E2E tests under `tests/` when changes affect cross-server flows.
- Ensure:
  - `scripts/test-installation.sh` (or the relevant subset) can pass locally.
  - New servers include at least a smoke test to validate startup.

### 5. Documentation

- Update `docs/` when:
  - Adding a new MCP server or tool.
  - Modifying APIs, environment variables, or architecture.
  - Introducing new workflows or breaking changes.

- At minimum:
  - Each MCP server should have a `README.md` describing:
    - Purpose
    - Setup
    - Run commands
    - Required environment variables
    - Example MCP client configuration

### 6. Security and Secrets

- Never commit:
  - `.env` files with real values
  - API keys, OAuth secrets, private keys, or tokens
- Use:
  - `.env.example` to document required variables
  - Secret managers (1Password, Vault, SSM, etc.) or local env injection
- If you discover a vulnerability:
  - Report privately via the repository’s security contact process (or open a security-focused issue if no private channel is available).

### 7. Pull Request Checklist

Before opening a PR:

- [ ] Code is formatted and linted according to existing standards.
- [ ] Tests are added/updated and passing locally.
- [ ] Documentation is updated where required.
- [ ] No secrets or environment-specific artifacts are committed.
- [ ] Changes are scoped and well-described in the PR description.

### 8. Review Expectations

- Be responsive to review feedback.
- Keep discussions technical and respectful.
- Squash or rebase if requested to keep history clean.

By contributing, you agree that your contributions may be licensed under the same license as this repository (MIT by default).
