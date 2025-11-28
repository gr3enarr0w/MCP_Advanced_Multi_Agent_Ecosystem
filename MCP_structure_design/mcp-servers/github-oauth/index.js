const express = require('express');
const cors = require('cors');
const { Octokit } = require('@octokit/rest');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory storage for tokens (use a proper database in production)
const tokenStore = new Map();

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:8000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple in-memory session
const sessions = new Map();

// Generate authorization URL for GitHub OAuth
app.get('/auth/github', (req, res) => {
  const state = uuidv4();
  const clientId = process.env.GITHUB_CLIENT_ID;
  const scopes = process.env.GITHUB_SCOPES || 'repo,user,read:org';
  const redirectUri = `${process.env.HOST}/auth/callback`;
  
  const authUrl = `https://github.com/login/oauth/authorize?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `scope=${encodeURIComponent(scopes)}&` +
    `state=${state}`;
  
  // Store state for verification
  sessions.set(state, { createdAt: Date.now() });
  
  res.json({ 
    authUrl, 
    state,
    message: 'Please visit the authUrl to authorize the application'
  });
});

// OAuth2 callback handler
app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;
  
  if (!code || !state) {
    return res.status(400).send('Missing code or state parameter');
  }
  
  if (!sessions.has(state)) {
    return res.status(400).send('Invalid state parameter');
  }
  
  // Clean up used state
  sessions.delete(state);
  
  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: code,
        redirect_uri: `${process.env.HOST}/auth/callback`,
      }),
    });
    
    const tokenData = await tokenResponse.json();
    
    if (tokenData.error) {
      return res.status(400).send(`OAuth error: ${tokenData.error_description || tokenData.error}`);
    }
    
    const accessToken = tokenData.access_token;
    const sessionId = uuidv4();
    
    // Store token with session
    tokenStore.set(sessionId, {
      accessToken,
      createdAt: Date.now(),
      expiresAt: Date.now() + (tokenData.expires_in * 1000 || 3600000) // 1 hour default
    });
    
    // Return success page
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>GitHub OAuth Success</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .success { color: #28a745; }
          .info { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <h1 class="success">✅ GitHub OAuth Successful!</h1>
        <div class="info">
          <h3>Your session ID:</h3>
          <code>${sessionId}</code>
          <p><strong>Save this session ID</strong> - you'll need it to authenticate with the MCP server.</p>
        </div>
        <p>You can now use GitHub MCP tools in your AI assistant.</p>
        <script>
          // Send session ID to parent window if opened in popup
          if (window.opener) {
            window.opener.postMessage({ type: 'github-oauth-success', sessionId: '${sessionId}' }, '*');
            window.close();
          }
        </script>
      </body>
      </html>
    `);
    
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send('Internal server error during OAuth');
  }
});

// MCP protocol endpoints
app.get('/mcp/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'GitHub OAuth MCP Server',
    timestamp: new Date().toISOString()
  });
});

// Get repositories for a session
app.get('/mcp/repositories', async (req, res) => {
  const sessionId = req.headers['x-session-id'];
  
  if (!sessionId || !tokenStore.has(sessionId)) {
    return res.status(401).json({ error: 'Invalid or missing session ID' });
  }
  
  const session = tokenStore.get(sessionId);
  const { accessToken } = session;
  
  try {
    const octokit = new Octokit({ auth: accessToken });
    
    // Get user repositories
    const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: 50,
    });
    
    res.json({
      repositories: repos.map(repo => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        private: repo.private,
        description: repo.description,
        html_url: repo.html_url,
        updated_at: repo.updated_at,
        language: repo.language,
        stargazers_count: repo.stargazers_count,
        forks_count: repo.forks_count,
      }))
    });
    
  } catch (error) {
    console.error('GitHub API error:', error);
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

// Search repositories
app.get('/mcp/search', async (req, res) => {
  const sessionId = req.headers['x-session-id'];
  const { q, type = 'repositories' } = req.query;
  
  if (!sessionId || !tokenStore.has(sessionId)) {
    return res.status(401).json({ error: 'Invalid or missing session ID' });
  }
  
  if (!q) {
    return res.status(400).json({ error: 'Search query (q) is required' });
  }
  
  const session = tokenStore.get(sessionId);
  const { accessToken } = session;
  
  try {
    const octokit = new Octokit({ auth: accessToken });
    
    const { data } = await octokit.rest.search[type]({
      q,
      sort: 'updated',
      order: 'desc',
      per_page: 20,
    });
    
    res.json({
      total_count: data.total_count,
      incomplete_results: data.incomplete_results,
      items: data.items
    });
    
  } catch (error) {
    console.error('GitHub search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get user information
app.get('/mcp/user', async (req, res) => {
  const sessionId = req.headers['x-session-id'];
  
  if (!sessionId || !tokenStore.has(sessionId)) {
    return res.status(401).json({ error: 'Invalid or missing session ID' });
  }
  
  const session = tokenStore.get(sessionId);
  const { accessToken } = session;
  
  try {
    const octokit = new Octokit({ auth: accessToken });
    const { data: user } = await octokit.rest.users.getAuthenticated();
    
    res.json({
      id: user.id,
      login: user.login,
      name: user.name,
      email: user.email,
      avatar_url: user.avatar_url,
      html_url: user.html_url,
      public_repos: user.public_repos,
      public_gists: user.public_gists,
      followers: user.followers,
      following: user.following,
      created_at: user.created_at,
    });
    
  } catch (error) {
    console.error('GitHub user API error:', error);
    res.status(500).json({ error: 'Failed to fetch user information' });
  }
});

// Session management
app.get('/mcp/sessions', (req, res) => {
  const sessions = Array.from(tokenStore.entries()).map(([id, data]) => ({
    sessionId: id,
    createdAt: data.createdAt,
    expiresAt: data.expiresAt,
  }));
  
  res.json({ sessions });
});

// Clean up expired sessions
setInterval(() => {
  const now = Date.now();
  for (const [id, data] of tokenStore.entries()) {
    if (data.expiresAt < now) {
      tokenStore.delete(id);
    }
  }
}, 60000); // Clean up every minute

// Start server
app.listen(PORT, () => {
  console.log(`🚀 GitHub OAuth MCP Server running on ${process.env.HOST || `http://localhost:${PORT}`}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   - GET  /auth/github - Get GitHub authorization URL`);
  console.log(`   - GET  /auth/callback - OAuth2 callback handler`);
  console.log(`   - GET  /mcp/health - Health check`);
  console.log(`   - GET  /mcp/repositories - List user repositories`);
  console.log(`   - GET  /mcp/search - Search GitHub`);
  console.log(`   - GET  /mcp/user - Get user information`);
  console.log(`   - GET  /mcp/sessions - List active sessions`);
  console.log(`\n🔧 Environment variables loaded from .env file`);
});

module.exports = app;