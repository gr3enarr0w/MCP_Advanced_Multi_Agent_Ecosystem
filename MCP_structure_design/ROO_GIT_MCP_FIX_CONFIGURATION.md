# Roo Git MCP Configuration Fix

## Current Problem
Roo cannot access the Git MCP server because your configuration has `github-oauth` but Roo expects a `git` server.

## Solution: Updated Roo Configuration

Replace the current content in:
`~/Library/Application Support/Cursor/User/globalStorage/rooveterinaryinc.roo-cline/settings/mcp_settings.json`

With this updated configuration:

```json
{
  "mcpServers": {
    "context-persistence": {
      "command": "python3",
      "args": ["-m", "context_persistence.server"],
      "env": {
        "PYTHONPATH": "/Users/ceverson/mcp-servers/context-persistence/src",
        "CONTEXT_DB": "/Users/ceverson/.mcp/context/db/conversation.db",
        "QDRANT_PATH": "/Users/ceverson/.mcp/context/qdrant"
      }
    },
    "task-orchestrator": {
      "command": "node",
      "args": ["/Users/ceverson/mcp-servers/task-orchestrator/dist/index.js"],
      "env": {
        "TASKS_DB": "/Users/ceverson/.mcp/tasks/tasks.db"
      }
    },
    "search-aggregator": {
      "command": "node",
      "args": ["/Users/ceverson/mcp-servers/search-aggregator/dist/index.js"],
      "env": {
        "PERPLEXITY_API_KEY": "${PERPLEXITY_API_KEY}",
        "BRAVE_API_KEY": "",
        "GOOGLE_API_KEY": "",
        "GOOGLE_CX": ""
      }
    },
    "context7": {
      "command": "npx",
      "args": [
        "-y",
        "@upstash/context7-mcp"
      ],
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
    "git": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-github"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "REPLACE_WITH_YOUR_GITHUB_TOKEN"
      }
    }
  }
}
```

## Key Changes Made

1. **Removed**: `github-oauth` server entry
2. **Added**: `git` server with official GitHub MCP server
3. **Server Name**: Changed from "github-oauth" to "git" (what Roo expects)

## Setup Steps

### Step 1: Install Git MCP Server
```bash
npm install -g @modelcontextprotocol/server-github
```

### Step 2: Get GitHub Personal Access Token
1. Go to GitHub → Settings → Developer settings → Personal access tokens
2. Generate new token with scopes: `repo`, `read:org`, `user`
3. Copy the token

### Step 3: Update Configuration
1. Replace `REPLACE_WITH_YOUR_GITHUB_TOKEN` with your actual GitHub token
2. Save the file
3. Restart Roo

## Expected Result
After this fix, Roo will have access to Git tools like:
- git_clone
- git_push  
- git_pull
- git_branch
- git_status
- git_commit
- git_log
- git_diff

## Alternative: Keep Both Servers
If you want to keep your custom GitHub OAuth server AND have Git functionality:

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
        "GITHUB_PERSONAL_ACCESS_TOKEN": "YOUR_GITHUB_TOKEN_HERE"
      }
    }
  }
}
```

This should resolve the "can't access git mcp" error you're experiencing in Roo.