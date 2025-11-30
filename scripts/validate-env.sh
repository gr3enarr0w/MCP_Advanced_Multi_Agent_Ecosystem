#!/bin/bash

# Environment Validation Script for Phase 1 Components
# Validates LLM, Search API, and Research configuration

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration file path
ENV_FILE=".env.external-mcps"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Validation results
VALIDATION_ERRORS=0
VALIDATION_WARNINGS=0

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    ((VALIDATION_WARNINGS++))
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    ((VALIDATION_ERRORS++))
}

check_file_exists() {
    local file="$1"
    if [[ -f "$file" ]]; then
        log_success "Configuration file found: $file"
        return 0
    else
        log_error "Configuration file not found: $file"
        return 1
    fi
}

check_env_file() {
    local env_file="$1"
    if [[ -f "$env_file" ]]; then
        log_success "Environment file found: $env_file"
        
        # Source the file to check for syntax errors
        if bash -n "$env_file" 2>/dev/null; then
            log_success "Environment file syntax is valid"
        else
            log_error "Environment file has syntax errors"
            return 1
        fi
    else
        log_warning "Environment file not found: $env_file"
        return 1
    fi
}

check_required_var() {
    local var_name="$1"
    local var_value="${!var_name:-}"
    
    if [[ -z "$var_value" ]]; then
        log_error "Required environment variable not set: $var_name"
        return 1
    else
        log_success "Required variable set: $var_name"
        return 0
    fi
}

check_optional_var() {
    local var_name="$1"
    local var_value="${!var_name:-}"
    
    if [[ -z "$var_value" ]]; then
        log_warning "Optional variable not set: $var_name"
        return 1
    else
        log_success "Optional variable set: $var_name"
        return 0
    fi
}

validate_api_key_format() {
    local key_name="$1"
    local key_value="${!key_name:-}"
    
    if [[ -z "$key_value" ]]; then
        return 1
    fi
    
    # Check for placeholder values
    if [[ "$key_value" =~ ^(your_|placeholder_|example_|test_) ]]; then
        log_error "API key appears to be placeholder: $key_name"
        return 1
    fi
    
    # Basic format validation (adjust patterns as needed)
    case "$key_name" in
        *API_KEY*)
            if [[ ${#key_value} -lt 20 ]]; then
                log_warning "API key seems too short: $key_name"
            fi
            ;;
    esac
    
    log_success "API key format appears valid: $key_name"
    return 0
}

validate_url() {
    local url_name="$1"
    local url_value="${!url_name:-}"
    
    if [[ -z "$url_value" ]]; then
        return 1
    fi
    
    # Basic URL validation
    if [[ "$url_value" =~ ^https?://[a-zA-Z0-9.-]+:[0-9]+.*$ ]]; then
        log_success "URL format valid: $url_name"
        return 0
    else
        log_error "Invalid URL format: $url_name = $url_value"
        return 1
    fi
}

test_connectivity() {
    local url="$1"
    local service_name="$2"
    local timeout="${3:-5}"
    
    log_info "Testing connectivity to $service_name..."
    
    if command -v curl >/dev/null 2>&1; then
        if curl -s --connect-timeout "$timeout" "$url" >/dev/null 2>&1; then
            log_success "Successfully connected to $service_name"
            return 0
        else
            log_warning "Could not connect to $service_name (service may be down)"
            return 1
        fi
    else
        log_warning "curl not available, skipping connectivity test"
        return 0
    fi
}

validate_llm_config() {
    log_info "Validating LLM Configuration..."
    
    # Check LLM mode
    local llm_mode="${LLM_MODE:-}"
    case "$llm_mode" in
        hybrid|local|cloud)
            log_success "Valid LLM mode: $llm_mode"
            ;;
        "")
            log_error "LLM_MODE not set"
            ;;
        *)
            log_error "Invalid LLM mode: $llm_mode (must be hybrid, local, or cloud)"
            ;;
    esac
    
    # Validate local LLM configuration
    if [[ "$llm_mode" == "local" || "$llm_mode" == "hybrid" ]]; then
        check_required_var "LLM_LOCAL_PROVIDER"
        check_required_var "LLM_LOCAL_MODEL"
        validate_url "LLM_LOCAL_URL"
        
        # Test Ollama connectivity if configured
        if [[ "${LLM_LOCAL_PROVIDER:-}" == "ollama" ]]; then
            test_connectivity "${LLM_LOCAL_URL}/api/tags" "Ollama" 10
        fi
    fi
    
    # Validate cloud LLM configuration
    if [[ "$llm_mode" == "cloud" || "$llm_mode" == "hybrid" ]]; then
        check_required_var "LLM_CLOUD_PROVIDER"
        check_required_var "LLM_CLOUD_MODEL"
    fi
    
    # Validate fallback configuration
    if [[ "$llm_mode" == "hybrid" ]]; then
        check_optional_var "LLM_FALLBACK_ENABLED"
        check_optional_var "LLM_FALLBACK_ORDER"
        check_optional_var "LLM_COMPLEXITY_THRESHOLD"
        check_optional_var "LLM_COST_TRACKING"
    fi
}

validate_search_config() {
    log_info "Validating Search Configuration..."
    
    # Check required API keys
    check_required_var "TAVILY_API_KEY"
    validate_api_key_format "TAVILY_API_KEY"
    
    check_required_var "PERPLEXITY_API_KEY"
    validate_api_key_format "PERPLEXITY_API_KEY"
    
    # Check optional API keys
    check_optional_var "BRAVE_API_KEY"
    if [[ -n "${BRAVE_API_KEY:-}" ]]; then
        validate_api_key_format "BRAVE_API_KEY"
    fi
    
    # Validate search provider configuration
    check_required_var "SEARCH_PROVIDERS"
    check_optional_var "SEARCH_PARALLEL_ENABLED"
    check_optional_var "SEARCH_MAX_RESULTS"
    check_optional_var "SEARCH_TIMEOUT"
    
    # Validate provider priorities
    local providers="${SEARCH_PROVIDERS:-}"
    IFS=',' read -ra PROVIDER_ARRAY <<< "$providers"
    for provider in "${PROVIDER_ARRAY[@]}"; do
        provider=$(echo "$provider" | xargs) # trim whitespace
        local priority_var="SEARCH_${provider^^}_PRIORITY"
        check_optional_var "$priority_var"
    done
}

validate_research_config() {
    log_info "Validating Research Configuration..."
    
    check_optional_var "RESEARCH_MAX_ITERATIONS"
    check_optional_var "RESEARCH_QUALITY_THRESHOLD"
    check_optional_var "RESEARCH_CITATION_STYLE"
    check_optional_var "RESEARCH_ENABLE_STREAMING"
    
    # Validate numeric values
    local max_iterations="${RESEARCH_MAX_ITERATIONS:-}"
    if [[ -n "$max_iterations" && ! "$max_iterations" =~ ^[0-9]+$ ]]; then
        log_error "RESEARCH_MAX_ITERATIONS must be a number: $max_iterations"
    fi
    
    local quality_threshold="${RESEARCH_QUALITY_THRESHOLD:-}"
    if [[ -n "$quality_threshold" && ! "$quality_threshold" =~ ^0\.[0-9]+$|^1\.0$ ]]; then
        log_error "RESEARCH_QUALITY_THRESHOLD must be between 0.0 and 1.0: $quality_threshold"
    fi
}

validate_mcp_config() {
    log_info "Validating MCP Configuration..."
    
    # Check Context7 configuration
    check_required_var "CONTEXT7_MCP_CMD"
    check_required_var "CONTEXT7_MCP_ARGS"
    
    # Check MCP Code Checker configuration
    check_required_var "MCP_CODE_CHECKER_CMD"
    check_required_var "MCP_CODE_CHECKER_PROJECT_DIR"
}

main() {
    echo "========================================"
    echo "Phase 1 Environment Validation"
    echo "========================================"
    echo
    
    # Change to project root
    cd "$PROJECT_ROOT"
    
    # Check if environment file exists
    if check_file_exists "$ENV_FILE"; then
        # Source the environment file
        log_info "Loading environment configuration..."
        set -a
        source "$ENV_FILE"
        set +a
        log_success "Environment configuration loaded"
    else
        log_error "Cannot proceed without environment file: $ENV_FILE"
        exit 1
    fi
    
    echo
    
    # Run validation checks
    validate_llm_config
    echo
    validate_search_config
    echo
    validate_research_config
    echo
    validate_mcp_config
    echo
    
    # Print summary
    echo "========================================"
    echo "Validation Summary"
    echo "========================================"
    
    if [[ $VALIDATION_ERRORS -eq 0 ]]; then
        if [[ $VALIDATION_WARNINGS -eq 0 ]]; then
            log_success "All validations passed! ✅"
            echo "Your Phase 1 environment is properly configured."
        else
            log_warning "Validation completed with $VALIDATION_WARNINGS warning(s) ⚠️"
            echo "Review the warnings above, but your configuration should work."
        fi
        exit_code=0
    else
        log_error "Validation failed with $VALIDATION_ERRORS error(s) ❌"
        echo "Please fix the errors before proceeding."
        exit_code=1
    fi
    
    echo
    echo "For detailed configuration instructions, see:"
    echo "  docs/llm-search-config.md"
    echo
    
    exit $exit_code
}

# Run main function
main "$@"