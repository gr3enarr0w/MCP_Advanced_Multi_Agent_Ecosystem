# Security Hardening Implementation Plan

## Overview
This plan addresses the Shai-Hulud npm malware threat and secures our MCP ecosystem against supply chain attacks while preserving our working TypeScript implementation.

## Timeline: 3-5 days

## Phase 1: Immediate Dependency Lockdown (Day 1)

### 1.1 Exact Version Pinning
**Files to Update**:
- `mcp-servers/agent-swarm/package.json`
- `mcp-servers/task-orchestrator/package.json`
- `mcp-servers/search-aggregator/package.json`
- `mcp-servers/skills-manager/package.json`

**Changes**:
- Remove all `^` and `~` version prefixes
- Pin to exact versions (e.g., `"1.2.3"` instead of `"^1.2.3"`)
- Add `package-lock.json` to version control
- Enable lockfile validation in CI

**Example**:
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "1.0.3",
    "sql.js": "1.10.2",
    "simple-git": "3.27.0",
    "graphology": "0.25.4"
  }
}
```

### 1.2 Dependency Audit
**Actions**:
- Run `npm audit` on all servers
- Fix or document all high/critical vulnerabilities
- Remove unused dependencies
- Update vulnerable packages to secure versions

**Commands**:
```bash
cd mcp-servers/agent-swarm && npm audit --audit-level=high
cd mcp-servers/task-orchestrator && npm audit --audit-level=high
cd mcp-servers/search-aggregator && npm audit --audit-level=high
cd mcp-servers/skills-manager && npm audit --audit-level=high
```

### 1.3 Integrity Verification
**Files to Create**:
- `.npmrc` with integrity settings
- Dependency validation script

**`.npmrc` Configuration**:
```
package-lock=true
save-exact=true
fund=false
audit-level=high
```

## Phase 2: Supply Chain Security (Day 2)

### 2.1 SLSA Compliance
**Files to Create**:
- `.github/workflows/slsa-compliance.yml`
- `slsa.provenance.json`

**GitHub Actions Workflow**:
- Generate SLSA provenance attestations
- Sign build artifacts
- Verify dependencies before build

### 2.2 Dependency Scanning
**Tools to Implement**:
- **Snyk**: For vulnerability scanning
- **Socket.dev**: For supply chain attack detection
- **OSV-Scanner**: For known vulnerabilities

**Files to Create**:
- `.github/workflows/dependency-scan.yml`
- `security/dependency-policy.yml`

### 2.3 Signed Commits & Tags
**Implementation**:
- Require GPG-signed commits for main branch
- Sign all release tags
- Verify signatures in CI pipeline

**Git Configuration**:
```bash
git config commit.gpgsign true
git config tag.gpgsign true
```

## Phase 3: Container Security (Day 3)

### 3.1 Docker Containerization
**Files to Create**:
- `Dockerfile` for each MCP server
- `docker-compose.yml` for orchestration
- `.dockerignore` for each server

**Security Features**:
- Non-root user execution
- Minimal base images (distroless where possible)
- Read-only filesystems
- Resource limits (CPU, memory)
- Network policies
- Secret management

**Example Dockerfile**:
```dockerfile
FROM node:20-slim

# Create non-root user
RUN groupadd -r mcp && useradd -r -g mcp mcp

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with exact versions
RUN npm ci --only=production --ignore-scripts

# Copy source code
COPY --chown=mcp:mcp . .

# Switch to non-root user
USER mcp

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD node health-check.js || exit 1

# Run with security options
CMD ["node", "--enable-source-maps", "dist/index.js"]
```

### 3.2 Security Policies
**Files to Create**:
- `security/apparmor.profile`
- `security/seccomp.json`
- `security/capabilities.drop`

**AppArmor Profile**:
```bash
#include <tunables/global>

profile mcp-server flags=(attach_disconnected,mediate_deleted) {
  #include <abstractions/base>
  
  # Allow network access
  network inet tcp,
  network inet udp,
  
  # Allow file access to specific directories
  /app/** r,
  /tmp/** rw,
  /home/mcp/.mcp/** rw,
  
  # Deny everything else
  deny network raw,
  deny mount,
  deny remount,
  deny pivot_root,
}
```

### 3.3 Secret Management
**Implementation**:
- Use Docker secrets or Kubernetes secrets
- Never mount secrets as environment variables
- Use secret rotation policies
- Audit secret access

## Phase 4: Runtime Security (Day 4)

### 4.1 Runtime Monitoring
**Tools to Implement**:
- **Falco**: For runtime threat detection
- **Tracee**: For system call monitoring
- **Tetragon**: For eBPF-based security

**Files to Create**:
- `security/falco-rules.yml`
- `security/runtime-policy.yml`

### 4.2 Network Security
**Implementation**:
- Network policies for container communication
- TLS for all inter-server communication
- Certificate management and rotation
- Firewall rules

### 4.3 File System Monitoring
**Implementation**:
- Monitor for unauthorized file changes
- Detect suspicious file access patterns
- Alert on unexpected file modifications
- Audit log analysis

## Phase 5: GitHub Security (Day 5)

### 5.1 Repository Security
**Settings to Enable**:
- Branch protection rules
- Required status checks
- Required pull request reviews
- CodeQL analysis
- Secret scanning
- Dependabot security updates

### 5.2 GitHub Actions Security
**Implementation**:
- Pin action versions to SHA hashes
- Use OpenID Connect for cloud authentication
- Implement least privilege for workflows
- Audit workflow permissions

### 5.3 Secret Management
**Implementation**:
- Use GitHub Secrets for CI/CD
- Rotate secrets regularly
- Audit secret access
- Use environment-specific secrets

## Security Checklist

### Dependency Security
- [ ] All dependencies pinned to exact versions
- [ ] `package-lock.json` committed to version control
- [ ] `npm audit` shows zero high/critical vulnerabilities
- [ ] Unused dependencies removed
- [ ] Dependency update policy documented

### Supply Chain Security
- [ ] SLSA provenance generation enabled
- [ ] Build artifacts signed
- [ ] Dependency scanning automated
- [ ] Vulnerability alerts configured
- [ ] Software bill of materials (SBOM) generated

### Container Security
- [ ] Non-root user execution
- [ ] Minimal base images
- [ ] Read-only filesystems
- [ ] Resource limits configured
- [ ] Security policies applied
- [ ] Secrets managed securely

### Runtime Security
- [ ] Runtime monitoring enabled
- [ ] Network policies configured
- [ ] File system monitoring active
- [ ] Alerting configured
- [ ] Incident response plan documented

### GitHub Security
- [ ] Branch protection enabled
- [ ] Code scanning active
- [ ] Secret scanning enabled
- [ ] Dependabot configured
- [ ] Signed commits required

## Implementation Files

### 1. Dependency Lockdown Script
**File**: `scripts/lock-dependencies.sh`
- Pins all dependencies to exact versions
- Generates integrity hashes
- Creates security report

### 2. Security Audit Script
**File**: `scripts/security-audit.sh`
- Runs comprehensive security audit
- Checks for vulnerabilities
- Validates configurations
- Generates security score

### 3. Container Build Script
**File**: `scripts/build-secure-containers.sh`
- Builds containers with security policies
- Applies AppArmor/SELinux profiles
- Runs security scans
- Generates SBOM

### 4. Runtime Security Policy
**File**: `security/runtime-policy.yml`
- Defines runtime security rules
- Specifies allowed/denied operations
- Configures monitoring and alerting

### 5. Incident Response Plan
**File**: `security/incident-response.md`
- Defines response procedures
- Specifies escalation paths
- Contains communication plans
- Includes recovery procedures

## Monitoring & Alerting

### Security Metrics to Monitor
1. **Dependency Vulnerabilities**: Count and severity
2. **Supply Chain Attacks**: Detection events
3. **Runtime Threats**: Suspicious activity alerts
4. **Access Logs**: Unauthorized access attempts
5. **Secret Access**: Unusual secret usage patterns

### Alerting Rules
- Critical vulnerability discovered
- Supply chain attack detected
- Runtime policy violation
- Unauthorized file modification
- Secret exposed in logs
- Container escape attempt

## Rollback Plan

If security hardening causes issues:
1. Revert to previous `package-lock.json`
2. Disable security policies temporarily
3. Rollback container images
4. Restore previous configurations
5. Document issues for future improvements

## Success Criteria

1. **Zero high/critical vulnerabilities** in `npm audit`
2. **All dependencies pinned** to exact versions
3. **Container images scanned** with no critical issues
4. **Runtime monitoring** detecting test attacks
5. **Supply chain security** tools operational
6. **GitHub security features** fully enabled
7. **Incident response plan** tested and validated

## Timeline Summary

- **Day 1**: Dependency lockdown and audit
- **Day 2**: Supply chain security implementation
- **Day 3**: Container security hardening
- **Day 4**: Runtime security monitoring
- **Day 5**: GitHub security and final validation

This plan addresses the Shai-Hulud threat while preserving our working TypeScript implementation and meeting the 3-5 day timeline constraint.