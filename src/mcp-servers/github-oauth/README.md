# OAuth2 GitHub MCP Server - Complete Setup Guide

## 🎯 Overview

This guide provides complete instructions for setting up and using the OAuth2 GitHub MCP server across all your AI tools (Cursor, Claude Code, OpenAI Codex, Roo).

## ✅ Current Configuration Status

### Tools Configured with GitHub OAuth2:
- ✅ **Cursor**: Already has `github-official`, now also has `github-oauth`
- ✅ **Claude Code**: Added `github-oauth` 
- ✅ **OpenAI Codex**: Added `github-oauth`
- ✅ **Roo**: Added `github-oauth`
- ✅ **Roo (Alternative)**: Added `github-oauth`

### OAuth2 Server Details:
- **Location**: `/Users/ceverson/MCP_structure_design/mcp-servers/github-oauth/`
- **URL**: `http://localhost:3000`
- **Status**: Ready for deployment

## 🚀 Quick Start

### 1. Start the OAuth2 GitHub MCP Server

```bash
cd /Users/ceverson/MCP_structure_design/mcp-servers/github-oauth
npm start
```

The server will start on `http://localhost:3000` and display available endpoints.

### 2. OAuth2 Authentication Flow

#### Step 1: Get Authorization URL
```bash
curl http://localhost:3000/auth/github
```

Response:
```json
{
  "authUrl": "https://github.com/login/oauth/authorize?client_id=YOUR_CLIENT_ID&...",
  "state": "uuid-string",
  "message": "Please visit the authUrl to authorize the application"
}
```

#### Step 2: Authorize Application
1. Visit the `authUrl` from Step 1
2. GitHub will ask you to authorize the application
3. After authorization, you'll be redirected to the callback URL
4. You'll receive a session ID to use with MCP tools

#### Step 3: Use Session ID with MCP Tools
The session ID returned from the OAuth flow should be provided to your AI tools when they request GitHub access.

## 🔧 Configuration Files Updated

### Claude Code (`~/.claude/mcp.json`)
```json
{
  "mcpServers": {
    "context-persistence": { ... },
    "task-orchestrator": { ... },
    "search-aggregator": { ... },
    "skills-manager": { ... },
    "github-oauth": {
      "transport": {
        "type": "http",
        "url": "http://localhost:3000"
      }
    }
  }
}
```

### OpenAI Codex (`~/.codex/mcp.json`)
```json
{
  "mcpServers": {
    "task-orchestrator": { ... },
    "skills-manager": { ... },
    "github-oauth": {
      "transport": {
        "type": "http",
        "url": "http://localhost:3000"
      }
    }
  }
}
```

### Roo (`~/.roo/mcp.json`)
```json
{
  "mcpServers": {
    "context-persistence": { ... },
    "task-orchestrator": { ... },
    "search-aggregator": { ... },
    "skills-manager": { ... },
    "github-oauth": {
      "transport": {
        "type": "http",
        "url": "http://localhost:3000"
      }
    }
  }
}
```

### Roo Alternative (`~/Library/Application Support/Cursor/User/globalStorage/rooveterinaryinc.roo-cline/settings/mcp_settings.json`)
```json
{
  "mcpServers": {
    "context-persistence": { ... },
    "task-orchestrator": { ... },
    "search-aggregator": { ... },
    "context7": { ... },
    "filesystem": { ... },
    "memory": { ... },
    "sequentialthinking": { ... },
    "github-oauth": {
      "transport": {
        "type": "http",
        "url": "http://localhost:3000"
      }
    }
  }
}
```

## 📋 Available Endpoints

### Health Check
```bash
GET /mcp/health
```
Returns server status and timestamp.

### OAuth2 Endpoints
```bash
GET /auth/github          # Get authorization URL
GET /auth/callback        # OAuth2 callback handler
```

### MCP Endpoints
```bash
GET /mcp/repositories     # List user repositories (requires session ID)
GET /mcp/search          # Search GitHub repositories (requires session ID)
GET /mcp/user            # Get user information (requires session ID)
GET /mcp/sessions        # List active sessions
```

## 🔐 Security Features

- **OAuth2 Flow**: Secure authentication without storing personal access tokens
- **Session Management**: Automatic session cleanup and expiration
- **CORS Protection**: Configured for specific allowed origins
- **State Parameter**: CSRF protection in OAuth flow
- **Token Storage**: In-memory storage (use database in production)

## 🛠️ Environment Variables

Located in `mcp-servers/github-oauth/.env`:
```bash
GITHUB_CLIENT_ID=Ov23liDl8LxKNFMAPck3
GITHUB_CLIENT_SECRET=3c3e396a24417ad4d0c683e0dd635e59f4459eda
PORT=3000
HOST=http://localhost:3000
GITHUB_SCOPES=repo,user,read:org
SESSION_SECRET=mcp-github-oauth-session-2025
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000,https://claude.ai,https://cursor.sh,https://roo.sh
```

## 📝 Usage Instructions

### For AI Tools:
1. **Start the server**: `cd /Users/ceverson/MCP_structure_design/mcp-servers/github-oauth && npm start`
2. **AI tools will automatically detect** the `github-oauth` server configuration
3. **When GitHub access is needed**, the tool will:
   - Call `/auth/github` to get authorization URL
   - Present the URL to you for authorization
   - Receive session ID after successful OAuth
   - Use session ID for subsequent GitHub API calls

### For Users:
1. **Wait for OAuth prompt** when AI tool needs GitHub access
2. **Visit the authorization URL** provided by your AI tool
3. **Authorize the application** on GitHub
4. **Copy the session ID** from the success page
5. **Provide session ID to your AI tool** when requested

## 🔄 Migration from Personal Access Token

### Before (Personal Access Token):
```json
"github-official": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "env": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": "your-token-here"
  }
}
```

### After (OAuth2):
```json
"github-oauth": {
  "transport": {
    "type": "http",
    "url": "http://localhost:3000"
  }
}
```

## 🐛 Troubleshooting

### Server Won't Start
```bash
cd /Users/ceverson/MCP_structure_design/mcp-servers/github-oauth
npm install  # Ensure dependencies are installed
npm start    # Check for error messages
```

### OAuth Flow Issues
1. **Check GitHub OAuth App settings**:
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3000/auth/callback`
2. **Verify Client ID and Secret** in `.env` file
3. **Check CORS settings** if accessing from different domain

### AI Tools Can't Connect
1. **Verify server is running**: `curl http://localhost:3000/mcp/health`
2. **Check configuration files** for correct `github-oauth` entry
3. **Restart AI tools** after configuration changes

## 🎉 Benefits of OAuth2 Setup

✅ **No Manual Token Management**: OAuth2 eliminates the need to manually create and manage GitHub personal access tokens

✅ **Better Security**: OAuth2 provides secure, time-limited access with proper scope control

✅ **User-Friendly**: Users simply authorize through their browser - no token copying required

✅ **Automatic Refresh**: OAuth2 tokens are automatically managed and refreshed

✅ **Multi-Tool Support**: Single OAuth2 server works across all your AI tools

## 📞 Support

If you encounter issues:
1. Check the server logs for error messages
2. Verify GitHub OAuth App configuration
3. Ensure all configuration files are properly updated
4. Restart the server and AI tools as needed

---

**Setup completed successfully!** 🎉

Your OAuth2 GitHub MCP server is now configured and ready to use across all your AI development tools.