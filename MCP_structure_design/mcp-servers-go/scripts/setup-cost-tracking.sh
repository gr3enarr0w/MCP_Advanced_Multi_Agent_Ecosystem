#!/bin/bash
# Setup cost tracking database for MCP usage

set -e

echo "💰 Setting up MCP cost tracking system..."

# Create directory
mkdir -p ~/.mcp/cost-tracking

# Create SQLite database with usage tracking tables
sqlite3 ~/.mcp/cost-tracking/usage.db << 'EOF'
-- Usage tracking table
CREATE TABLE IF NOT EXISTS usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    provider TEXT NOT NULL,
    model TEXT,
    tokens_prompt INTEGER DEFAULT 0,
    tokens_completion INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0,
    context TEXT,  -- 'personal' or 'work'
    task_type TEXT,  -- 'coding', 'research', etc.
    free_tier BOOLEAN DEFAULT 0,
    endpoint TEXT  -- which endpoint was used
);

-- Provider balances table
CREATE TABLE IF NOT EXISTS provider_balances (
    provider TEXT PRIMARY KEY,
    free_tier_used INTEGER DEFAULT 0,
    free_tier_limit INTEGER,
    paid_balance REAL DEFAULT 0,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Monthly totals table
CREATE TABLE IF NOT EXISTS monthly_totals (
    month TEXT PRIMARY KEY,
    personal_cost REAL DEFAULT 0,
    work_cost REAL DEFAULT 0,
    free_tier_usage INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial provider balances
INSERT OR IGNORE INTO provider_balances (provider, free_tier_limit) VALUES
    ('nanogpt', 60000),
    ('openrouter', 0),
    ('vertex-ai', 0);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON usage(timestamp);
CREATE INDEX IF NOT EXISTS idx_usage_provider ON usage(provider);
CREATE INDEX IF NOT EXISTS idx_usage_context ON usage(context);
CREATE INDEX IF NOT EXISTS idx_usage_task_type ON usage(task_type);

-- Create view for daily summary
CREATE VIEW IF NOT EXISTS daily_summary AS
SELECT 
    date(timestamp) as date,
    provider,
    context,
    SUM(tokens_prompt + tokens_completion) as total_tokens,
    SUM(cost_usd) as total_cost,
    SUM(CASE WHEN free_tier = 1 THEN tokens_prompt + tokens_completion ELSE 0 END) as free_tier_tokens
FROM usage
GROUP BY date(timestamp), provider, context;

-- Create view for monthly summary
CREATE VIEW IF NOT EXISTS monthly_summary AS
SELECT 
    strftime('%Y-%m', timestamp) as month,
    provider,
    context,
    SUM(tokens_prompt + tokens_completion) as total_tokens,
    SUM(cost_usd) as total_cost,
    COUNT(*) as total_requests
FROM usage
GROUP BY strftime('%Y-%m', timestamp), provider, context;

EOF

echo "✅ Cost tracking database created at ~/.mcp/cost-tracking/usage.db"

# Create .env entries
echo ""
echo "Add these to your .env file:"
echo "NANOGPT_API_KEY=your_nanogpt_api_key_here"
echo "OPENROUTER_API_KEY=your_openrouter_api_key_here"
echo "GCP_PROJECT_ID=your_gcp_project_id_here"
echo ""
echo "To track usage, call: ./scripts/track-usage.sh --provider nanogpt --tokens-prompt 100 --tokens-completion 50 --context personal"
echo "To check usage, call: ./scripts/check-usage.sh --today"