# Podman Container Setup (Archived)

## Status: ARCHIVED - NOT ACTIVELY MAINTAINED

This directory contains the Podman/container setup for the MCP Advanced Multi-Agent Ecosystem. These files have been archived and are **not currently maintained or tested**.

## Why Archived?

The MCP servers are designed to run **natively on the host system** for optimal performance and ease of development. The container setup was created for potential future use but is not required for the system to function.

**Recommendation**: Run the MCP servers directly using the native installation scripts in `scripts/`.

## Contents

- `podman/` - Dockerfiles for each MCP server
- `podman-compose.yaml` - Podman Compose configuration
- `start-podman-stack.sh` - Start script for containerized deployment

## If You Want to Use Containers

If you need containerized deployment in the future:

1. **Test the setup first**: The container configuration has not been validated
2. **Update dependencies**: Container images may have outdated dependencies
3. **Verify networking**: Ensure ports don't conflict with native installations
4. **Check volumes**: Verify data persistence paths are correct

## Native Installation (Recommended)

Instead of using containers, run the native setup:

```bash
# Full setup (first-time)
./scripts/setup.sh

# Install/rebuild all servers
./scripts/install-mcp-servers.sh

# Verify installation
./scripts/test-installation.sh
```

## Status Date

**Archived**: November 24, 2025

## Future Considerations

If containerization becomes a priority:
- Update all Dockerfiles to use current dependencies
- Test all services in containerized environment
- Add health checks and proper networking
- Document volume management
- Add docker-compose.yaml as an alternative to Podman

---

**Note**: These files are preserved for reference but should not be used in their current state without thorough testing and updates.
