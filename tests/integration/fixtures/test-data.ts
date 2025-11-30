/**
 * Test data fixtures for integration tests
 */

export const SAMPLE_PRD = `# Product Requirements Document: AI Code Assistant

## Overview
Build an AI-powered code assistant that helps developers write better code through intelligent suggestions, error detection, and automated refactoring.

## Core Features

### 1. Intelligent Code Completion
- Provide context-aware code suggestions
- Support multiple programming languages (JavaScript, Python, TypeScript, Java)
- Learn from user coding patterns
- Integrate with popular IDEs

### 2. Error Detection and Analysis
- Real-time syntax and semantic error detection
- Explain errors with clear messages
- Suggest fixes for common issues
- Integration with linting tools

### 3. Automated Refactoring
- Identify code smells and anti-patterns
- Suggest refactoring opportunities
- Apply safe automated refactoring
- Maintain code functionality

### 4. Code Documentation Generation
- Auto-generate function documentation
- Create README files from code structure
- Generate API documentation
- Support multiple documentation formats

## Technical Requirements

### Performance
- Response time < 100ms for code suggestions
- Support files up to 10,000 lines
- Handle concurrent requests from 100+ users

### Compatibility
- VS Code extension
- JetBrains IDEs plugin
- Vim/Neovim plugin
- Web-based editor

### Security
- No code sent to external servers without consent
- Local processing option
- Encrypted cloud sync (optional)

## Success Criteria
1. 95% accuracy in code suggestions
2. Support for 5+ programming languages
3. Integration with 3+ major IDEs
4. User satisfaction score > 4.5/5
5. < 50ms average response time

## Timeline
- Phase 1: Core engine (4 weeks)
- Phase 2: IDE integrations (3 weeks)
- Phase 3: Advanced features (3 weeks)
- Phase 4: Testing and optimization (2 weeks)

## Dependencies
- Machine learning models for code analysis
- Parser libraries for multiple languages
- IDE SDKs and APIs
- Cloud infrastructure (if using cloud processing)`;

export const SAMPLE_CODE_FILES = {
  'typescript': `
/**
 * User management service for handling user operations
 */
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export class UserService {
  private users: Map<string, User> = new Map();
  
  /**
   * Create a new user
   */
  async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const user: User = {
      id: this.generateId(),
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.users.set(user.id, user);
    return user;
  }
  
  /**
   * Get user by ID
   */
  async getUser(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }
  
  /**
   * Update user
   */
  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const user = this.users.get(id);
    if (!user) return null;
    
    const updatedUser = { ...user, ...updates, updatedAt: new Date() };
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  /**
   * Delete user
   */
  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }
  
  /**
   * List all users
   */
  async listUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }
  
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}`,
  
  'python': `
"""
User management service for handling user operations
"""

import uuid
from datetime import datetime
from typing import Dict, List, Optional
import json

class User:
    """User entity class"""
    
    def __init__(self, name: str, email: str, user_id: str = None):
        self.id = user_id or str(uuid.uuid4())
        self.name = name
        self.email = email
        self.created_at = datetime.now()
        self.updated_at = datetime.now()
    
    def to_dict(self) -> Dict:
        """Convert user to dictionary"""
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

class UserService:
    """Service class for user management operations"""
    
    def __init__(self):
        self.users: Dict[str, User] = {}
    
    def create_user(self, name: str, email: str) -> User:
        """Create a new user"""
        user = User(name, email)
        self.users[user.id] = user
        return user
    
    def get_user(self, user_id: str) -> Optional[User]:
        """Get user by ID"""
        return self.users.get(user_id)
    
    def update_user(self, user_id: str, **updates) -> Optional[User]:
        """Update user"""
        user = self.users.get(user_id)
        if not user:
            return None
        
        for key, value in updates.items():
            if hasattr(user, key):
                setattr(user, key, value)
        
        user.updated_at = datetime.now()
        return user
    
    def delete_user(self, user_id: str) -> bool:
        """Delete user"""
        return self.users.pop(user_id, None) is not None
    
    def list_users(self) -> List[User]:
        """List all users"""
        return list(self.users.values())
    
    def to_json(self) -> str:
        """Export all users to JSON"""
        return json.dumps([user.to_dict() for user in self.users.values()])`,
  
  'javascript': `
/**
 * User management service for handling user operations
 */
class User {
  constructor(name, email) {
    this.id = this.generateId();
    this.name = name;
    this.email = email;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
  
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

class UserService {
  constructor() {
    this.users = new Map();
  }
  
  /**
   * Create a new user
   */
  async createUser(userData) {
    const user = new User(userData.name, userData.email);
    this.users.set(user.id, user);
    return user;
  }
  
  /**
   * Get user by ID
   */
  async getUser(id) {
    return this.users.get(id) || null;
  }
  
  /**
   * Update user
   */
  async updateUser(id, updates) {
    const user = this.users.get(id);
    if (!user) return null;
    
    Object.assign(user, updates);
    user.updatedAt = new Date();
    this.users.set(id, user);
    return user;
  }
  
  /**
   * Delete user
   */
  async deleteUser(id) {
    return this.users.delete(id);
  }
  
  /**
   * List all users
   */
  async listUsers() {
    return Array.from(this.users.values());
  }
  
  generateId() {
    return Math.random().toString(36).substr(2, 9);
  }
}

module.exports = { User, UserService };`
};

export const RESEARCH_TOPICS = [
  {
    topic: 'microservices architecture patterns',
    expectedResults: ['service discovery', 'API gateway', 'circuit breaker', 'event sourcing'],
    complexity: 'intermediate'
  },
  {
    topic: 'machine learning model optimization',
    expectedResults: ['quantization', 'pruning', 'knowledge distillation', 'model compression'],
    complexity: 'advanced'
  },
  {
    topic: 'react performance optimization',
    expectedResults: ['memoization', 'virtual scrolling', 'code splitting', 'lazy loading'],
    complexity: 'intermediate'
  },
  {
    topic: 'blockchain consensus mechanisms',
    expectedResults: ['Proof of Work', 'Proof of Stake', 'Delegated Proof of Stake', 'Practical Byzantine Fault Tolerance'],
    complexity: 'advanced'
  }
];

export const SAMPLE_CHART_DATA = {
  bar: {
    type: 'bar',
    data: {
      labels: ['Q1', 'Q2', 'Q3', 'Q4'],
      datasets: [{
        label: 'Revenue',
        data: [12500, 15800, 18900, 22100],
        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']
      }]
    },
    options: {
      title: 'Quarterly Revenue',
      width: 800,
      height: 600
    }
  },
  
  line: {
    type: 'line',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      datasets: [{
        label: 'User Growth',
        data: [1200, 1890, 2400, 3100, 3890, 4750],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)'
      }]
    },
    options: {
      title: 'Monthly User Growth',
      width: 800,
      height: 600
    }
  },
  
  pie: {
    type: 'pie',
    data: {
      labels: ['Desktop', 'Mobile', 'Tablet'],
      datasets: [{
        data: [65, 28, 7],
        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b']
      }]
    },
    options: {
      title: 'Traffic by Device Type',
      width: 600,
      height: 600
    }
  },
  
  gantt: {
    type: 'gantt',
    data: [
      { task: 'Requirements Analysis', start: '2024-01-01', end: '2024-01-15', progress: 100 },
      { task: 'System Design', start: '2024-01-10', end: '2024-01-25', progress: 80 },
      { task: 'Implementation', start: '2024-01-20', end: '2024-02-15', progress: 60 },
      { task: 'Testing', start: '2024-02-01', end: '2024-02-20', progress: 30 },
      { task: 'Deployment', start: '2024-02-15', end: '2024-02-25', progress: 0 }
    ],
    options: {
      title: 'Project Timeline',
      width: 1000,
      height: 600
    }
  }
};

export const AGENT_SWARM_CONFIGS = {
  hierarchical: {
    topology: 'hierarchical',
    description: 'Multi-level coordination with clear command structure',
    expectedAgents: ['coordinator', 'workers', 'specialists']
  },
  
  mesh: {
    topology: 'mesh',
    description: 'Flat network where all agents can communicate directly',
    expectedAgents: ['peers', 'collaborators']
  },
  
  star: {
    topology: 'star',
    description: 'Central hub with spoke agents',
    expectedAgents: ['hub', 'spokes']
  }
};

export const WORKFLOW_SCENARIOS = {
  researchToTasks: {
    name: 'Research to Tasks Workflow',
    description: 'Complete research workflow from topic to actionable tasks',
    steps: [
      'Generate research plan',
      'Execute parallel searches',
      'Synthesize findings',
      'Parse research results',
      'Generate structured tasks',
      'Analyze task complexity',
      'Select next optimal task'
    ],
    expectedDuration: 45, // seconds
    successCriteria: [
      'Research plan generated',
      'Search results collected',
      'Tasks created and prioritized',
      'Complexity analysis completed'
    ]
  },
  
  codeAnalysisToKnowledge: {
    name: 'Code Analysis to Knowledge Workflow',
    description: 'Analyze code and build knowledge graph',
    steps: [
      'Parse code files',
      'Extract symbols and entities',
      'Build relationships',
      'Create knowledge graph entries',
      'Enable hybrid search'
    ],
    expectedDuration: 30,
    successCriteria: [
      'Code symbols extracted',
      'Knowledge graph updated',
      'Search functionality working'
    ]
  },
  
  agentSwarmOrchestration: {
    name: 'Agent Swarm Orchestration Workflow',
    description: 'Multi-agent coordination and task execution',
    steps: [
      'Create swarm session',
      'Spawn worker agents',
      'Delegate tasks to agents',
      'Execute research workflows',
      'Generate comprehensive reports',
      'Checkpoint and recovery testing'
    ],
    expectedDuration: 60,
    successCriteria: [
      'Swarm session created',
      'Workers spawned successfully',
      'Tasks delegated and executed',
      'Reports generated'
    ]
  }
};

export const ERROR_SCENARIOS = {
  serverUnavailable: {
    description: 'MCP server becomes unavailable during workflow',
    expectedBehavior: 'Graceful degradation and retry mechanisms',
    recoverySteps: ['Detect failure', 'Initiate retry', 'Fallback to alternative', 'Resume workflow']
  },
  
  invalidData: {
    description: 'Invalid or malformed data passed to workflow',
    expectedBehavior: 'Validation and error handling',
    recoverySteps: ['Validate input', 'Return meaningful error', 'Suggest corrections']
  },
  
  resourceExhaustion: {
    description: 'System resources exhausted during execution',
    expectedBehavior: 'Resource management and cleanup',
    recoverySteps: ['Detect resource limits', 'Pause execution', 'Free resources', 'Resume or fail gracefully']
  }
};