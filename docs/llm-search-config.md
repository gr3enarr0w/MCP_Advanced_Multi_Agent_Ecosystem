# LLM and Search Provider Configuration Guide

This document provides comprehensive configuration instructions for the Phase 1 LLM and search provider implementations.

## Table of Contents

- [LLM Configuration](#llm-configuration)
- [Search Provider Configuration](#search-provider-configuration)
- [Research Configuration](#research-configuration)
- [API Key Setup](#api-key-setup)
- [Environment Variable Precedence](#environment-variable-precedence)
- [Example Configurations](#example-configurations)
- [Troubleshooting](#troubleshooting)

## LLM Configuration

### LLM Mode

The system supports three LLM operation modes:

- **`hybrid`**: Uses local LLM as primary with cloud fallback
- **`local`**: Uses only local LLM provider
- **`cloud`**: Uses only cloud LLM provider

```bash
LLM_MODE=hybrid
```

### Local LLM Provider

Configuration for local LLM instances (typically Ollama):

```bash
# Local provider type
LLM_LOCAL_PROVIDER=ollama

# Model to use (check with: ollama list)
LLM_LOCAL_MODEL=llama2:70b

# Ollama server URL
LLM_LOCAL_URL=http://localhost:11434
```

### Cloud LLM Provider

Configuration for cloud-based LLM services:

```bash
# Cloud provider (currently supports: perplexity)
LLM_CLOUD_PROVIDER=perplexity

# Model to use
LLM_CLOUD_MODEL=sonar-pro
```

### Fallback Configuration

Controls how the system handles LLM failures:

```bash
# Enable automatic fallback between providers
LLM_FALLBACK_ENABLED=true

# Order of fallback attempts
LLM_FALLBACK_ORDER=local,cloud

# Complexity threshold for switching providers
LLM_COMPLEXITY_THRESHOLD=0.6

# Track costs for cloud providers
LLM_COST_TRACKING=true
```

## Search Provider Configuration

### Search API Keys

Required API keys for search providers:

```bash
# Tavily API (Primary) - REQUIRED
TAVILY_API_KEY=your_tavily_key_here

# Perplexity API - REQUIRED
PERPLEXITY_API_KEY=your_perplexity_key_here

# Brave API - OPTIONAL
BRAVE_API_KEY=your_brave_key_here

# DuckDuckGo (Free - no key required)
# No configuration needed
```

### Provider Settings

Configure which search providers to use and their behavior:

```bash
# Comma-separated list of active providers
SEARCH_PROVIDERS=tavily,perplexity,brave,duckduckgo

# Enable parallel search across providers
SEARCH_PARALLEL_ENABLED=true

# Provider priority (lower number = higher priority)
SEARCH_TAVILY_PRIORITY=1
SEARCH_PERPLEXITY_PRIORITY=2
SEARCH_BRAVE_PRIORITY=3
SEARCH_DUCKDUCKGO_PRIORITY=4

# Maximum results per provider
SEARCH_MAX_RESULTS=10

# Request timeout in milliseconds
SEARCH_TIMEOUT=30000
```

## Research Configuration

Settings for the research workflow:

```bash
# Maximum research iterations
RESEARCH_MAX_ITERATIONS=5

# Quality threshold for research results
RESEARCH_QUALITY_THRESHOLD=0.75

# Citation style for outputs
RESEARCH_CITATION_STYLE=apa

# Enable streaming for real-time results
RESEARCH_ENABLE_STREAMING=true
```

## API Key Setup

### Tavily API

1. Visit [Tavily Dashboard](https://tavily.com/dashboard)
2. Sign up or log in
3. Navigate to API Keys section
4. Copy your API key
5. Set environment variable: `TAVILY_API_KEY=your_key_here`

### Perplexity API

1. Visit [Perplexity API Console](https://www.perplexity.ai/settings/api)
2. Generate a new API key
3. Set environment variable: `PERPLEXITY_API_KEY=your_key_here`

### Brave Search API

1. Visit [Brave Search API](https://brave.com/search/api/)
2. Sign up for API access
3. Get your API key
4. Set environment variable: `BRAVE_API_KEY=your_key_here`

## Environment Variable Precedence

The system loads configuration in the following order:

1. **System environment variables** (highest priority)
2. **`.env.external-mcps`** file
3. **Default values** (lowest priority)

Variables set in the system environment will override those in the configuration file.

## Example Configurations

### Development Setup

```bash
# Use local LLM with free search providers
LLM_MODE=local
LLM_LOCAL_PROVIDER=ollama
LLM_LOCAL_MODEL=llama2:7b
SEARCH_PROVIDERS=duckduckgo
```

### Production Setup

```bash
# Full hybrid setup with all providers
LLM_MODE=hybrid
LLM_LOCAL_MODEL=llama2:70b
LLM_CLOUD_MODEL=sonar-pro
SEARCH_PROVIDERS=tavily,perplexity,brave,duckduckgo
SEARCH_PARALLEL_ENABLED=true
```

### Cost-Optimized Setup

```bash
# Minimize cloud usage
LLM_MODE=local
LLM_FALLBACK_ENABLED=false
SEARCH_PROVIDERS=duckduckgo,tavily
SEARCH_TAVILY_PRIORITY=2
```

## Troubleshooting

### Common Issues

1. **Ollama Connection Failed**
   - Ensure Ollama is running: `ollama serve`
   - Check URL: `curl http://localhost:11434/api/tags`

2. **API Key Not Working**
   - Verify key is correct and active
   - Check for trailing spaces or special characters
   - Ensure key has proper permissions

3. **Search Provider Not Responding**
   - Check network connectivity
   - Verify API key is valid
   - Check provider status pages

4. **Configuration Not Loading**
   - Ensure `.env.external-mcps` is in project root
   - Check file permissions
   - Verify variable names are correct

### Validation

Run the environment validation script to check your configuration:

```bash
./scripts/validate-env.sh
```

This will:
- Check for required environment variables
- Validate API key formats
- Test connectivity to configured services
- Provide helpful error messages

### Debug Mode

Enable debug logging to troubleshoot issues:

```bash
# Add to your environment
DEBUG=true
LOG_LEVEL=debug
```

## Security Considerations

- **Never commit API keys** to version control
- **Use environment-specific** configuration files
- **Regularly rotate** API keys
- **Monitor usage** and costs for cloud providers
- **Restrict API key** permissions when possible

## Performance Optimization

- **Enable parallel search** for faster results
- **Adjust timeouts** based on your network conditions
- **Use appropriate model sizes** for your hardware
- **Monitor resource usage** in production environments