# Roo Git MCP Configuration Solution

## Problem Analysis

**Issue**: You added a GitHub OAuth MCP server, but Roo is trying to access a "git mcp" server that doesn't exist in your configuration.

**Current Roo Configuration**:
- Has `github-oauth` server running on HTTP transport (localhost:3000)
- Missing standard Git MCP server that Roo expects
- Configured servers don't match what Roo is looking for

## Solution Options

### Option 1: Add Official Git MCP Server (Recommended)

Add the official GitHub MCP server to your Roo configuration:

```json
{
  "mcpServers": {
    "context-persistence": {
      "command": "python3",
      "args": ["-m", "context_persistence.server"],
      "env": {
        "PYTHONPATH": "/Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/MCP_structure_design/mcp-servers/context-persistence/src",
        "CONTEXT_DB": "/Users/ceverson/.mcp/context/db/conversation.db",
        "QDRANT_PATH": "/Users/ceverson/.mcp/context/qdrant"
      }
    },
    "task-orchestrator": {
      "command": "/Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/MCP_structure_design/mcp-servers-go/dist/task-orchestrator",
      "args": [],
      "env": {
        "MCP_DATABASE_DIR": "/Users/ceverson/.mcp/tasks",
        "MCP_LOG_LEVEL": "info"
      }
    },
    "search-aggregator": {
      "command": "/Users/ceverson/MCP_Advanced_Multi_Agent_Ecosystem/MCP_structure_design/mcp-servers-go/dist/search-aggregator",
      "args": [],
      "env": {
        "MCP_DATABASE_DIR": "/Users/ceverson/.mcp/cache",
        "MCP_LOG_LEVEL": "info",
        "PERPLEXITY_API_KEY": "${PERPLEXITY_API_KEY}",
        "BRAVE_API_KEY": "",
        "GOOGLE_API_KEY": "",
        "GOOGLE_CX": ""
      }
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"],
      "env": {
        "DEFAULT_MINIMUM_TOKENS": ""
      }
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "~/Development"
      ]
    },
    "memory": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-memory"
      ]
    },
    "sequentialthinking": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-sequential-thinking"
      ]
    },
    "github-oauth": {
      "transport": {
        "type": "http",
        "url": "http://localhost:3000"
      }
    },
    "git": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-github"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your_github_token_here"
      }
    }
  }
}
```

### Option 2: Use Your Custom GitHub OAuth Server

Modify your existing `github-oauth` server to provide the Git MCP interface that Roo expects:

1. **Update the server name** from "github-oauth" to "git" in your configuration
2. **Ensure the server provides Git MCP tools** (not just OAuth endpoints)

## Recommended Steps

### Step 1: Install Official Git MCP Server

```bash
# Install the official GitHub MCP server
npm install -g @modelcontextprotocol/server-github
```

### Step 2: Get GitHub Personal Access Token

1. Go to GitHub → Settings → Developer settings → Personal access tokens
2. Generate new token with these scopes:
   - `repo` (for repository access)
   - `read:org` (for organization access)
   - `user` (for user information)
3. Copy the token for configuration

### Step 3: Update Roo Configuration

Replace the current `github-oauth` entry with the official `git` entry:

```json
{
  "mcpServers": {
    "git": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-github"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_your_actual_token_here"
      }
    }
  }
}
```

**Note**: Remove the `github-oauth` entry and replace it with `git` entry.

### Step 4: Test the Configuration

1. Restart Roo
2. Try using Git operations
3. Verify the server responds correctly

## Alternative: Keep Both Servers

If you want to keep both your custom GitHub OAuth server and the standard Git server:

```json
{
  "mcpServers": {
    "github-oauth": {
      "transport": {
        "type": "http",
        "url": "http://localhost:3000"
      }
    },
    "git": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-github"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_your_token_here"
      }
    }
  }
}
```

## Configuration File Location

**Roo Configuration File**: 
`~/Library/Application Support/Cursor/User/globalStorage/rooveterinaryinc.roo-cline/settings/mcp_settings.json`

## Verification Steps

1. **Check server installation**:
   ```bash
   npx @modelcontextprotocol/server-github --version
   ```

2. **Test GitHub token**:
   ```bash
   export GITHUB_PERSONAL_ACCESS_TOKEN="your_token"
   npx @modelcontextprotocol/server-github
   ```

3. **Verify Roo can see the server**:
   - Restart Roo
   - Check available tools/commands
   - Look for Git-related tools

## Expected Git MCP Tools

Once properly configured, Roo should have access to these Git tools:

- `git_clone` - Clone repositories
- `git_push` - Push changes
- `git_pull` - Pull latest changes
- `git_branch` - Manage branches
- `git_status` - Check repository status
- `git_commit` - Create commits
- `git_log` - View commit history
- `git_diff` - View changes

## Troubleshooting

### Issue: "Command not found" for Git MCP server

**Solution**: Ensure the server is globally installed
```bash
npm install -g @modelcontextprotocol/server-github
```

### Issue: Authentication errors

**Solution**: 
1. Verify your GitHub token is valid
2. Check token permissions (repo, read:org, user)
3. Ensure token isn't expired

### Issue: Roo still can't find Git tools

**Solution**:
1. Restart Roo completely
2. Check that the configuration file is valid JSON
3. Verify the server name is exactly "git" (not "github" or "github-oauth")

### Issue: HTTP server connection refused

**Solution**:
1. Ensure your GitHub OAuth server is running on port 3000
2. Check server logs for errors
3. Verify the server provides proper MCP protocol responses

## Summary

**Root Cause**: Roo expects a "git" MCP server but you only had a "github-oauth" server.

**Best Solution**: Install and configure the official `@modelcontextprotocol/server-github` as "git" in your Roo configuration.

**Alternative**: Keep your custom GitHub OAuth server for specialized operations and add the standard Git server for Roo compatibility.

This should resolve the "can't access git mcp" issue and give you full Git functionality in Roo.
