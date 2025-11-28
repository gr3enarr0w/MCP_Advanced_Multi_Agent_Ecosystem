# Quick Start - NanoGPT Proxy

## 30-Second Setup

```bash
# 1. Get your API key from https://nano-gpt.com

# 2. Set environment
cd src/services/nanogpt-proxy
export NANOGPT_API_KEY="your-key-here"

# 3. Start server
./scripts/start.sh

# 4. Test it
curl http://localhost:8090/health
```

## First Request

```bash
curl -X POST http://localhost:8090/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "messages": [
      {"role": "user", "content": "Explain what a proxy server does"}
    ],
    "role": "general"
  }'
```

## Configure Roo Code

In Roo Code settings:
- **API Base URL**: `http://localhost:8090/v1`
- **Model**: `auto`

Done! Roo Code now uses the intelligent proxy.

## Available Roles

Use these in the `"role"` field for optimized results:

- `architect` - System design, architecture decisions
- `implementation` - Writing production code
- `code_review` - Security and quality analysis
- `debugging` - Finding and fixing bugs
- `testing` - Test cases and edge cases
- `documentation` - Clear technical writing
- `research` - Deep information gathering
- `general` - Everything else

## Monthly Research

Check when models were last updated:

```bash
curl http://localhost:8090/admin/research/status
```

Manually trigger research:

```bash
curl -X POST http://localhost:8090/admin/research/trigger
```

## More Info

See README.md for complete documentation.
