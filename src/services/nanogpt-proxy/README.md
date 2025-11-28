# NanoGPT Proxy - Intelligent LLM Gateway

An OpenAI-compatible proxy server with advanced features:

- **Phase 1**: OpenAI-compatible API for NanoGPT and Vertex AI
- **Phase 2**: Prompt Engineer - Role-based prompt optimization
- **Phase 3**: Model Router - Automatic model selection per role
- **Phase 4**: Context Manager - Conversation history via MCP integration
- **Phase 5**: Monthly Research - Auto-evaluate and rank new models

## Features

### 🚀 Smart Model Routing
Automatically selects the best LLM for each role (architect, implementation, debugging, etc.) based on latest benchmarks.

### 🎯 Prompt Optimization
Rewrites user prompts using role-specific strategies for better results.

### 💾 Context Enrichment
Integrates conversation history and similar past interactions via MCP servers.

### 📊 Monthly Research
Automatically discovers and evaluates new models monthly, updating rankings.

### 💰 Cost Optimization
Prioritizes free tier (NanoGPT 60k/mo) with enterprise fallback (Vertex AI).

## Quick Start

### Prerequisites

- Go 1.21+
- NanoGPT API Key: https://nano-gpt.com
- (Optional) Google Cloud project for Vertex AI

### 1. Install Dependencies

```bash
cd src/services/nanogpt-proxy
go mod download
```

### 2. Set Environment Variables

```bash
# Required
export NANOGPT_API_KEY="your-nanogpt-api-key"

# Optional
export VERTEX_PROJECT_ID="your-gcp-project-id"
export VERTEX_LOCATION="us-central1"

# Configuration
export ACTIVE_PROFILE="personal"  # or "work"
export NANOGPT_MONTHLY_QUOTA=60000
export PORT=8090
```

### 3. Run the Proxy

```bash
go run main.go
```

The server starts on `http://localhost:8090`

### 4. Configure Roo Code

In Roo Code settings:
- **API Base URL**: `http://localhost:8090/v1`
- **API Key**: (any value)
- **Model**: `auto` (let proxy choose)

## API Endpoints

### OpenAI-Compatible

```bash
# Chat completion
POST /v1/chat/completions
{
  "model": "auto",
  "messages": [...],
  "role": "architect",  # Optional: architect, implementation, etc.
  "conversation_id": "conv-123"  # Optional: for history
}

# List models
GET /v1/models

# Get model details
GET /v1/models/{model}
```

### Research Administration

```bash
# Trigger monthly research manually
POST /admin/research/trigger

# Get research status
GET /admin/research/status

# Force complete refresh
POST /admin/research/force-refresh
```

### Monitoring

```bash
# Health check
GET /health

# System status
GET /status
```

## Architecture

```
User Request
    ↓
[1. Prompt Engineer] - Optimize prompt based on role
    ↓
[2. Model Router] - Select best model for role
    ↓
[3. Context Manager] - Add conversation history
    ↓
[4. Backend (NanoGPT/Vertex)] - Execute request
    ↓
[5. Usage Tracker] - Record metrics
    ↓
Response
```

## Role-Based Strategies

The proxy supports 8 specialized roles:

| Role | Primary Model | Optimization Focus |
|------|--------------|-------------------|
| **architect** | claude-3.5-sonnet | Reasoning, trade-offs |
| **implementation** | claude-3.5-sonnet | Clean code, tests |
| **code_review** | claude-3-opus | Security, best practices |
| **debugging** | gpt-4o | Hypothesis testing |
| **testing** | claude-3.5-sonnet | Edge cases, coverage |
| **documentation** | gemini-2.0-flash | Clarity, examples |
| **research** | gemini-2.5-pro | Multi-source analysis |
| **general** | gemini-2.0-flash | Speed, versatility |

## Monthly Research System

### How It Works

1. **Scraping** (1st of each month, 2 AM)
   - Fetches latest benchmarks from Vellum, HuggingFace
   - Identifies new models not in current rankings

2. **Evaluation** (new models only)
   - Scores models using role-specific weights
   - Example: `architect` prioritizes reasoning (3x) over speed (1x)

3. **Ranking Update**
   - Updates model_routing.json with new rankings
   - Preserves existing models, adds new ones

4. **Auto-Apply**
   - All future requests use updated rankings
   - No downtime or manual intervention

### Manual Triggers

```bash
# Trigger research now
curl -X POST http://localhost:8090/admin/research/trigger

# Force re-evaluate ALL models
curl -X POST http://localhost:8090/admin/research/force-refresh

# Check status
curl http://localhost:8090/admin/research/status
```

## Configuration Files

### `config/prompt_strategies.yaml`
Role-specific prompt engineering strategies:
- System prompts
- Optimization techniques
- Constraints
- Examples

### `data/model_routing.json`
Model rankings per role:
- Primary model + reason
- Fallback models
- Free tier alternatives

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NANOGPT_API_KEY` | - | NanoGPT API key (required) |
| `VERTEX_PROJECT_ID` | - | GCP project (optional) |
| `ACTIVE_PROFILE` | `personal` | `personal` or `work` |
| `PORT` | `8090` | Server port |
| `NANOGPT_MONTHLY_QUOTA` | `60000` | Token limit |
| `DB_PATH` | `~/.mcp/proxy/usage.db` | Usage tracking DB |

## Usage Tracking

All requests are logged to SQLite:
- Backend used
- Model selected
- Token consumption
- Response time
- Role and conversation ID

Query usage:

```bash
sqlite3 ~/.mcp/proxy/usage.db "SELECT * FROM usage LIMIT 10"
```

## Development

### Build

```bash
go build -o nanogpt-proxy main.go
```

### Run Tests

```bash
go test ./...
```

### Project Structure

```
nanogpt-proxy/
├── main.go                    # Entry point
├── config/
│   ├── config.go              # Configuration loader
│   └── prompt_strategies.yaml # Role strategies
├── backends/
│   ├── backend.go             # Backend interface
│   ├── nanogpt.go             # NanoGPT client
│   └── vertex.go              # Vertex AI client
├── handlers/
│   ├── chat.go                # Chat endpoints
│   ├── models.go              # Model endpoints
│   └── research.go            # Research admin
├── promptengineer/
│   ├── engineer.go            # Prompt optimizer
│   └── strategies.go          # Strategy loader
├── routing/
│   ├── router.go              # Model selector
│   └── rankings.go            # Rankings DB
├── context/
│   └── manager.go             # Context enrichment
├── mcp/
│   └── bridge.go              # MCP client
├── research/
│   ├── researcher.go          # Research coordinator
│   ├── scraper.go             # Benchmark scraper
│   ├── evaluator.go           # Model evaluator
│   └── scheduler.go           # Cron scheduler
├── storage/
│   └── usage.go               # Usage tracker
└── data/
    └── model_routing.json     # Model rankings
```

## Troubleshooting

### Proxy won't start

```bash
# Check API key
echo $NANOGPT_API_KEY

# Check port availability
lsof -i :8090

# View logs
go run main.go 2>&1 | tee proxy.log
```

### MCP connection failed

```bash
# Ensure context-persistence server is running
cd src/mcp-servers/context-persistence
python3 -m context_persistence.server

# Check MCP server paths in config
```

### Models not updating

```bash
# Check last research date
curl http://localhost:8090/admin/research/status

# Manually trigger
curl -X POST http://localhost:8090/admin/research/trigger
```

## Performance

- **Prompt optimization**: < 1 second (Qwen3-30B local)
- **Model selection**: < 10ms (local lookup)
- **Context enrichment**: < 500ms (MCP call)
- **Total overhead**: ~1.5 seconds per request

## License

MIT

## Credits

Built for the MCP Advanced Multi-Agent Ecosystem project.
