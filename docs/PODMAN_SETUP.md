# Podman Deployment (optional)

The repository includes `podman-compose.yaml` plus Dockerfiles under `podman/` so you can containerize every MCP server. The stack mirrors the default local setup (`~/.mcp` volumes, same env vars, identical entrypoints), and `scripts/start-podman-stack.sh` wraps `podman machine start` + `podman compose up --build -d` for convenience.

Use this flow when you want strict isolation, but keep in mind:

- The Python/Node stacks pull heavy dependencies (torch, sentence-transformers, sql.js, etc.), so the first build is CPU- and network-intensive. Once the images exist, restart with `podman compose start` to reuse them.
- The script uses the `podman-machine-default-root` connection; if your Podman machine uses a different socket, override `CONNECTION` (e.g., `CONNECTION=podman-machine-default ./scripts/start-podman-stack.sh`).
- After the containers are running, the Roo config (`rooveterinaryinc.roo-cline/settings/mcp_settings.json`) points Roo to the `podman exec ...` commands, so Roo/VSCode will see the agent network automatically.
- The `podman-compose.yaml` file remains in the repo for documentation/reference, but the default workflow now runs the servers locally for better performance.

When you’re done testing in Podman, tear down the stack with:

```bash
podman --connection podman-machine-default-root compose -f podman-compose.yaml down
podman machine stop podman-machine-default
```

That frees resources and returns you to the faster, local script-based workflow.
