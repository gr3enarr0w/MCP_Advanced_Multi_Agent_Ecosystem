#!/bin/bash
# Simple provider selection logic for MCP
# Usage: ./select-provider.sh --task-type coding --complexity high

# Default values
TASK_TYPE="quick"
COMPLEXITY="low"
CONTEXT="personal"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --task-type) TASK_TYPE="$2"; shift 2;;
        --complexity) COMPLEXITY="$2"; shift 2;;
        --context) CONTEXT="$2"; shift 2;;
        *) shift;;
    esac
done

# Provider selection logic
case $CONTEXT in
    work)
        # Work context - use Vertex AI primarily
        PROVIDER="vertex-ai"
        REASON="Work project - using Vertex AI"
        ;;
    personal)
        # Personal context - optimize for cost
        case $TASK_TYPE in
            coding)
                if [ "$COMPLEXITY" = "high" ]; then
                    PROVIDER="vertex-ai"
                    REASON="Complex coding task - using Vertex AI for quality"
                else
                    PROVIDER="nanogpt"
                    REASON="Simple coding - using NanoGPT (free tier)"
                fi
                ;;
            research)
                PROVIDER="nanogpt"
                REASON="Research task - using NanoGPT (cost-effective)"
                ;;
            creative)
                PROVIDER="openrouter"
                REASON="Creative task - using OpenRouter for variety"
                ;;
            quick|*)
                PROVIDER="nanogpt"
                REASON="Quick question - using NanoGPT (fast & free)"
                ;;
        esac
        ;;
esac

# Export for use by other scripts
export SELECTED_PROVIDER="$PROVIDER"
export MCP_TASK_TYPE="$TASK_TYPE"
export MCP_COMPLEXITY="$COMPLEXITY"
export MCP_CONTEXT="$CONTEXT"

echo "🎯 Provider: $PROVIDER"
echo "📋 Reason: $REASON"
echo "📝 Task: $TASK_TYPE (complexity: $COMPLEXITY, context: $CONTEXT)"

# Check free tier status if using NanoGPT
if [ "$PROVIDER" = "nanogpt" ] && [ "$CONTEXT" = "personal" ]; then
    MONTHLY_USAGE=$(sqlite3 ~/.mcp/cost-tracking/usage.db \
        "SELECT SUM(tokens_prompt + tokens_completion) FROM usage 
         WHERE provider='nanogpt' AND free_tier=1 
         AND strftime('%Y-%m', timestamp) = strftime('%Y-%m', 'now')" 2>/dev/null) || MONTHLY_USAGE=0
    
    FREE_REMAINING=$((60000000 - MONTHLY_USAGE))
    echo "🪙 Free tier remaining: $((FREE_REMAINING / 1000))k tokens"
fi