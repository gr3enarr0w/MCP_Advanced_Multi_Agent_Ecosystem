# Role and Profile Routing Test Plan

## Executive Summary

This document outlines a comprehensive testing strategy to validate the current routing behavior and identify gaps between the intended subscription-first routing and the actual profile-based fallback system.

## Problem Diagnosis

### 5-7 Potential Problem Sources Identified:

1. **ModelRouter Integration Gap**: ModelRouter is created in main.go but not passed to ChatHandler
2. **Subscription Service Configuration**: Subscription API base URL may not be properly configured
3. **Authentication Header Handling**: No extraction of user roles from authentication headers
4. **Profile Override Logic**: X-Profile header handling may not work as intended
5. **Backend Availability Checks**: Backend initialization may fail silently
6. **Role Extraction from Requests**: Role field may not be properly parsed from requests
7. **Cache TTL Issues**: Subscription cache may not refresh properly

### 2 Most Likely Root Causes:

1. **PRIMARY: ModelRouter Integration Gap** - The sophisticated subscription-first routing logic exists but is completely disconnected from request handling
2. **SECONDARY: Authentication/Role Extraction** - No mechanism to extract user roles from authentication headers or session data

## Test Scenarios

### 1. Standard User Role Testing

**Objective**: Verify how standard users are routed through the current system

**Test Cases**:
- Role: "general" with Profile: "personal" 
- Role: "general" with Profile: "work"
- Role: "implementation" with Profile: "personal"
- Role: "implementation" with Profile: "work"

**Expected Behavior**: 
- Should use profile-based routing (current behavior)
- Should fall back to NanoGPT for "personal" profile
- Should fall back to Vertex for "work" profile
- Should NOT use subscription-first routing

### 2. Premium User Role Testing

**Objective**: Test premium subscription indicators

**Test Cases**:
- Headers: `X-Subscription-Tier: premium`, `X-User-Role: architect`
- Headers: `X-Subscription-Tier: enterprise`, `X-User-Role: code_review`
- Headers: `Authorization: Bearer premium-token-12345`

**Expected Behavior**:
- Current system should ignore subscription headers (not implemented)
- Should still use profile-based routing
- Should log that subscription headers are present but unused

### 3. Authentication Testing

**Objective**: Test various authentication scenarios

**Test Cases**:
- Valid API key: `Authorization: Bearer valid-key-12345`
- Invalid API key: `Authorization: Bearer invalid-key`
- Missing authentication: No Authorization header
- Session token: `X-Session-Token: session-abc-123`

**Expected Behavior**:
- Should pass authentication to backend (NanoGPT/Vertex)
- Should not extract user roles from auth headers
- Should fail with 401 for invalid credentials

### 4. Profile Override Testing

**Objective**: Test profile override mechanisms

**Test Cases**:
- Header: `X-Profile: work` with default profile "personal"
- Header: `X-Profile: personal` with default profile "work"
- Header: `X-Profile: invalid` (should fallback to default)
- No profile header (should use ACTIVE_PROFILE env var)

**Expected Behavior**:
- Should override default profile when valid
- Should fallback to default when invalid
- Should use environment variable when no header

### 5. Backend Selection Testing

**Objective**: Verify backend selection logic

**Test Cases**:
- NanoGPT available, Vertex unavailable
- Vertex available, NanoGPT unavailable  
- Both backends available
- Both backends unavailable

**Expected Behavior**:
- Should select available backend
- Should fallback to default when preferred unavailable
- Should error when no backends available

### 6. Model Availability Testing

**Objective**: Test model selection per backend

**Test Cases**:
- Request model: "claude-3.5-sonnet" with different backends
- Request model: "gpt-4o" with different backends
- Request model: "auto" (let backend choose)
- Request model: "invalid-model" (should fallback)

**Expected Behavior**:
- Should check model availability in selected backend
- Should fallback to alternative models when requested unavailable
- Should use "auto" when explicitly requested

### 7. Error Handling and Fallback Testing

**Objective**: Test error scenarios and fallback behavior

**Test Cases**:
- Backend returns 401 authentication error
- Backend returns 429 rate limit error
- Backend returns 500 internal server error
- Network timeout to backend

**Expected Behavior**:
- Should propagate authentication errors to client
- Should attempt fallback backend for server errors
- Should timeout gracefully for network issues

## Implementation Plan

### Phase 1: Enhanced Logging Implementation

**Files to Modify**:
1. `handlers/chat.go` - Add comprehensive routing decision logging
2. `handlers/chat_debug.go` - Enhance existing debug logging
3. `routing/router.go` - Add subscription routing validation logs
4. `main.go` - Add startup integration logging

**Log Categories**:
- `[AUTH]` - Authentication and role extraction
- `[PROFILE]` - Profile selection and override logic
- `[ROUTING]` - Backend and model selection decisions
- `[SUBSCRIPTION]` - Subscription service interactions
- `[FALLBACK]` - Fallback mechanism activations

### Phase 2: Test Execution Framework

**Test Script**: `test_role_profile_routing.sh`

**Environment Setup**:
- Mock subscription server (existing)
- Mock backend servers
- Configurable test scenarios
- Automated result collection

**Test Data Collection**:
- Request/response logs
- Routing decision traces
- Performance metrics
- Error categorization

### Phase 3: Analysis and Documentation

**Metrics to Collect**:
- Routing decision accuracy
- Fallback frequency
- Authentication success rate
- Profile override effectiveness
- Subscription service usage

**Documentation Output**:
- Routing behavior matrix
- Role-to-backend mapping
- Authentication flow analysis
- Fallback decision tree

## Validation Criteria

### Success Indicators:
- All test scenarios execute without errors
- Routing decisions are properly logged
- Profile-based routing behavior is documented
- Subscription routing gaps are identified
- Authentication patterns are mapped

### Failure Indicators:
- Tests fail to execute
- Insufficient logging for decision analysis
- Routing behavior is inconsistent
- Authentication errors are not properly handled
- Fallback mechanisms are not triggered

## Expected Findings

Based on code analysis, I expect to find:

1. **ModelRouter is never used** - ChatHandler uses simple profile-based routing
2. **No role extraction from auth** - System relies on explicit role parameter in request
3. **Profile overrides work** - X-Profile header functionality is implemented
4. **Backend selection is basic** - Simple if/else logic without sophisticated fallback
5. **Subscription service is unused** - Despite being properly implemented

## Next Steps

1. Implement enhanced logging
2. Execute test scenarios
3. Analyze routing behavior
4. Document gaps between intended vs actual behavior
5. Provide recommendations for integration fixes

---

**Test Plan Version**: 1.0  
**Created**: December 7, 2025  
**Author**: Debug Analysis Team