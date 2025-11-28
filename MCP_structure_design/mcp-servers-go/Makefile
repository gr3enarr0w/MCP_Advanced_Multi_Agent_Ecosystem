.PHONY: build test clean security-scan run-all

# Build all MCP servers
build:
	@echo "Building MCP servers..."
	@mkdir -p dist
	@for server in agent-swarm task-orchestrator search-aggregator skills-manager; do \
		echo "Building $$server..."; \
		go build -ldflags="-s -w" -o dist/$$server ./cmd/$$server; \
	done
	@echo "Build complete! Binaries in dist/"

# Build with race detector
build-race:
	@echo "Building with race detector..."
	@mkdir -p dist
	@go build -race -o dist/ ./cmd/...

# Run tests
test:
	@echo "Running tests..."
	@go test -v -race -coverprofile=coverage.out ./...
	@go tool cover -html=coverage.out -o coverage.html

# Run tests with verbose output
test-verbose:
	@echo "Running tests with verbose output..."
	@go test -v -race ./...

# Benchmark tests
bench:
	@echo "Running benchmarks..."
	@go test -bench=. -benchmem ./...

# Security scanning
security-scan:
	@echo "Running security scans..."
	@which gosec >/dev/null 2>&1 || echo "Warning: gosec not installed"
	@gosec ./... 2>/dev/null || echo "gosec scan skipped"
	@which govulncheck >/dev/null 2>&1 || echo "Warning: govulncheck not installed"
	@govulncheck ./... 2>/dev/null || echo "govulncheck scan skipped"

# Code formatting
fmt:
	@echo "Formatting code..."
	@go fmt ./...

# Code linting
lint:
	@echo "Running linter..."
	@which golangci-lint >/dev/null 2>&1 || echo "Warning: golangci-lint not installed"
	@golangci-lint run ./... 2>/dev/null || echo "Linting skipped"

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	@rm -rf dist/
	@rm -f coverage.out coverage.html

# Run all servers (development)
run-all:
	@echo "Starting all MCP servers..."
	@mkdir -p logs
	@./scripts/run-all.sh

# Install development dependencies
install-tools:
	@echo "Installing development tools..."
	@go install github.com/securecodewarrior/gosec/v2/cmd/gosec@latest
	@go install golang.org/x/vuln/cmd/govulncheck@latest
	@go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest

# Generate mocks (if using mockgen)
generate:
	@echo "Generating code..."
	@go generate ./...

# Docker build
docker-build:
	@echo "Building Docker images..."
	@docker build -t mcp-agent-swarm:latest -f docker/agent-swarm/Dockerfile .
	@docker build -t mcp-task-orchestrator:latest -f docker/task-orchestrator/Dockerfile .
	@docker build -t mcp-search-aggregator:latest -f docker/search-aggregator/Dockerfile .
	@docker build -t mcp-skills-manager:latest -f docker/skills-manager/Dockerfile .

# Help
help:
	@echo "Available targets:"
	@echo "  build         - Build all MCP servers"
	@echo "  build-race    - Build with race detector"
	@echo "  test          - Run tests with coverage"
	@echo "  test-verbose  - Run tests with verbose output"
	@echo "  bench         - Run benchmarks"
	@echo "  security-scan - Run security scans"
	@echo "  fmt           - Format code"
	@echo "  lint          - Run linter"
	@echo "  clean         - Clean build artifacts"
	@echo "  run-all       - Run all servers (development)"
	@echo "  install-tools - Install development tools"
	@echo "  generate      - Generate code"
	@echo "  docker-build  - Build Docker images"
	@echo "  help          - Show this help"