/**
 * Product Requirements Document (PRD) Parser
 * 
 * Intelligent PRD parsing system that converts markdown PRDs into hierarchical task trees
 * 
 * Features:
 * - Markdown PRD parsing with hierarchical structure extraction
 * - Feature and requirement identification
 * - Acceptance criteria parsing
 * - Automatic task creation with dependencies
 * - Dependency detection from text analysis
 * - Multi-level task breakdown
 */

import MarkdownIt from 'markdown-it';
import { v4 as uuidv4 } from 'uuid';

/**
 * Parsed PRD structure
 */
export interface ParsedPRD {
  /** Document metadata */
  metadata: PRDMetadata;
  /** Parsed features */
  features: PRDFeature[];
  /** Parsed requirements */
  requirements: PRDRequirement[];
  /** Acceptance criteria */
  acceptanceCriteria: PRDAcceptanceCriteria[];
  /** Generated tasks */
  tasks: GeneratedTask[];
  /** Document structure hierarchy */
  hierarchy: PRDSection[];
  /** Dependencies discovered */
  dependencies: PRDDependency[];
  /** Parsing statistics */
  statistics: PRDStatistics;
}

/**
 * PRD metadata
 */
export interface PRDMetadata {
  /** Document title */
  title: string;
  /** Document version */
  version?: string;
  /** Document author(s) */
  author?: string;
  /** Creation date */
  createdAt?: string;
  /** Last modified date */
  modifiedAt?: string;
  /** Product name */
  productName?: string;
  /** Target audience */
  targetAudience?: string;
  /** Document type */
  type: 'feature' | 'enhancement' | 'bugfix' | 'refactor' | 'technical';
}

/**
 * Parsed feature from PRD
 */
export interface PRDFeature {
  /** Feature identifier */
  id: string;
  /** Feature title */
  title: string;
  /** Feature description */
  description: string;
  /** Feature priority */
  priority: 'low' | 'medium' | 'high' | 'critical';
  /** Business value */
  businessValue?: string;
  /** User stories */
  userStories: string[];
  /** Associated requirements */
  requirementIds: string[];
  /** Acceptance criteria IDs */
  acceptanceCriteriaIds: string[];
  /** Estimated complexity */
  estimatedComplexity?: number;
  /** Dependencies on other features */
  dependencies: string[];
}

/**
 * Parsed requirement
 */
export interface PRDRequirement {
  /** Requirement identifier */
  id: string;
  /** Requirement title */
  title: string;
  /** Requirement description */
  description: string;
  /** Requirement type */
  type: 'functional' | 'non-functional' | 'technical' | 'business';
  /** Priority level */
  priority: 'low' | 'medium' | 'high' | 'critical';
  /** Acceptance criteria */
  acceptanceCriteria: string[];
  /** Dependencies */
  dependencies: string[];
  /** Implementation notes */
  implementationNotes?: string;
}

/**
 * Parsed acceptance criteria
 */
export interface PRDAcceptanceCriteria {
  /** Criteria identifier */
  id: string;
  /** Criteria description */
  description: string;
  /** Criteria type */
  type: 'functional' | 'technical' | 'business' | 'performance';
  /** Test scenarios */
  testScenarios: string[];
  /** Dependencies */
  dependencies: string[];
  /** Priority */
  priority: 'low' | 'medium' | 'high';
}

/**
 * Generated task from PRD parsing
 */
export interface GeneratedTask {
  /** Task identifier */
  id: string;
  /** Task title */
  title: string;
  /** Task description */
  description: string;
  /** Task type */
  type: 'development' | 'testing' | 'documentation' | 'design' | 'research';
  /** Priority level */
  priority: 'low' | 'medium' | 'high' | 'critical';
  /** Dependencies */
  dependencies: string[];
  /** Source references (feature/requirement IDs) */
  sourceReferences: string[];
  /** Estimated effort (hours) */
  estimatedEffort?: number;
  /** Assigned tags */
  tags: string[];
  /** Acceptance criteria */
  acceptanceCriteria: string[];
  /** Implementation details */
  implementationDetails?: string;
  /** Test requirements */
  testRequirements?: string[];
}

/**
 * PRD section in hierarchy
 */
export interface PRDSection {
  /** Section identifier */
  id: string;
  /** Section title */
  title: string;
  /** Section level (h1, h2, h3, etc.) */
  level: number;
  /** Section content */
  content: string;
  /** Child sections */
  children: PRDSection[];
  /** Associated items */
  items: SectionItem[];
}

/**
 * Section item (feature, requirement, etc.)
 */
export interface SectionItem {
  /** Item type */
  type: 'feature' | 'requirement' | 'acceptance_criteria' | 'user_story' | 'task';
  /** Item identifier */
  id: string;
  /** Item data */
  data: any;
}

/**
 * PRD dependency information
 */
export interface PRDDependency {
  /** Source item ID */
  sourceId: string;
  /** Target item ID */
  targetId: string;
  /** Dependency type */
  type: 'blocking' | 'required' | 'optional' | 'prerequisite';
  /** Dependency strength */
  strength: 'weak' | 'medium' | 'strong';
  /** Dependency reason */
  reason: string;
}

/**
 * PRD parsing statistics
 */
export interface PRDStatistics {
  /** Total features found */
  featureCount: number;
  /** Total requirements found */
  requirementCount: number;
  /** Total acceptance criteria found */
  acceptanceCriteriaCount: number;
  /** Total tasks generated */
  taskCount: number;
  /** Total dependencies discovered */
  dependencyCount: number;
  /** Average complexity score */
  averageComplexity: number;
  /** Parsing confidence (0-1) */
  confidence: number;
  /** Processing time (ms) */
  processingTime: number;
}

/**
 * PRD parsing options
 */
export interface PRDParseOptions {
  /** Enable automatic task generation */
  generateTasks?: boolean;
  /** Enable dependency analysis */
  analyzeDependencies?: boolean;
  /** Extract user stories */
  extractUserStories?: boolean;
  /** Parse acceptance criteria */
  parseAcceptanceCriteria?: boolean;
  /** Generate test scenarios */
  generateTestScenarios?: boolean;
  /** Confidence threshold for parsing (0-1) */
  confidenceThreshold?: number;
  /** Maximum task depth for expansion */
  maxTaskDepth?: number;
  /** Custom priority mapping */
  priorityMapping?: Record<string, 'low' | 'medium' | 'high' | 'critical'>;
  /** Project identifier for generated tasks */
  projectId?: string;
}

/**
 * Regular expressions for parsing different PRD elements
 */
const PATTERNS = {
  // Feature patterns
  feature: /^(?:feature|story|user story|use case)[:\s]*([^\n]+)/i,
  requirement: /^(?:requirement|req|spec|specification)[:\s]*([^\n]+)/i,
  acceptanceCriteria: /^(?:acceptance criteria|ac|acceptance test)[:\s]*([^\n]+)/i,
  priority: /^(?:priority|prio)[:\s]*(low|medium|high|critical)/i,
  businessValue: /^(?:business value|bv|value)[:\s]*([^\n]+)/i,
  userStory: /^(?:as a|user story)[:\s]*([^\n]+)/i,
  
  // Task patterns
  task: /^(?:task|todo|action)[:\s]*([^\n]+)/i,
  implementation: /^(?:implementation|impl)[:\s]*([^\n]+)/i,
  testing: /^(?:test|testing)[:\s]*([^\n]+)/i,
  
  // Dependency patterns
  dependsOn: /^(?:depends on|requires|prerequisite)[:\s]*([^\n]+)/i,
  blocking: /^(?:blocking|blocked by)[:\s]*([^\n]+)/i,
  
  // Section headers
  header: /^(#{1,6})\s+(.+)$/,
  
  // Numbered/bulleted lists
  listItem: /^(\s*[-*+]|\s*\d+\.)\s+(.+)$/,
};

/**
 * Priority keywords mapping
 */
const PRIORITY_KEYWORDS = {
  low: ['low', 'minor', 'nice-to-have', 'enhancement'],
  medium: ['medium', 'normal', 'standard', 'regular'],
  high: ['high', 'important', 'significant', 'major'],
  critical: ['critical', 'urgent', 'must-have', 'blocker', 'essential'],
};

/**
 * PRD Parser Class
 */
export class PRDParser {
  private md: MarkdownIt;
  private projectId: string;

  constructor(projectId?: string) {
    this.projectId = projectId || 'default-project';
    this.md = new MarkdownIt({
      html: false,
      linkify: true,
      typographer: true,
    });
  }

  /**
   * Parse PRD content into structured data
   * 
   * @param content PRD markdown content
   * @param options Parsing options
   * @returns Parsed PRD structure
   */
  async parsePRD(content: string, options: PRDParseOptions = {}): Promise<ParsedPRD> {
    const startTime = Date.now();
    
    try {
      // Set default options
      const parseOptions: PRDParseOptions = {
        generateTasks: true,
        analyzeDependencies: true,
        extractUserStories: true,
        parseAcceptanceCriteria: true,
        generateTestScenarios: true,
        confidenceThreshold: 0.7,
        maxTaskDepth: 3,
        projectId: this.projectId,
        ...options,
      };

      // Clean and preprocess content
      const cleanContent = this.preprocessContent(content);
      
      // Parse document structure
      const tokens = this.md.parse(cleanContent, {});
      const hierarchy = this.parseDocumentStructure(tokens);
      
      // Extract metadata
      const metadata = this.extractMetadata(cleanContent);
      
      // Parse features, requirements, and acceptance criteria
      const features = await this.parseFeatures(cleanContent, parseOptions);
      const requirements = await this.parseRequirements(cleanContent, parseOptions);
      const acceptanceCriteria = await this.parseAcceptanceCriteria(cleanContent, parseOptions);
      
      // Analyze dependencies
      const dependencies = parseOptions.analyzeDependencies 
        ? this.analyzeDependencies(features, requirements, acceptanceCriteria)
        : [];
      
      // Generate tasks
      const tasks = parseOptions.generateTasks
        ? await this.generateTasks(features, requirements, acceptanceCriteria, parseOptions)
        : [];
      
      // Calculate statistics
      const statistics = this.calculateStatistics(
        features, requirements, acceptanceCriteria, tasks, dependencies,
        Date.now() - startTime
      );
      
      const result: ParsedPRD = {
        metadata,
        features,
        requirements,
        acceptanceCriteria,
        tasks,
        hierarchy,
        dependencies,
        statistics,
      };
      
      return result;
    } catch (error) {
      throw new Error(`PRD parsing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Preprocess and clean PRD content
   */
  private preprocessContent(content: string): string {
    return content
      // Normalize line endings
      .replace(/\r\n/g, '\n')
      // Remove excessive whitespace
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      // Normalize headers
      .replace(/^#+\s*/gm, match => match.trim() + ' ')
      // Clean up list formatting
      .replace(/^\s*[-*+]\s+/gm, '- ')
      // Normalize code blocks
      .replace(/```(\w*)\n/g, '```$1\n')
      .trim();
  }

  /**
   * Extract document metadata
   */
  private extractMetadata(content: string): PRDMetadata {
    const lines = content.split('\n');
    
    const metadata: PRDMetadata = {
      title: 'Untitled PRD',
      type: 'feature',
    };

    // Extract title from first header or document title
    for (const line of lines.slice(0, 10)) {
      const headerMatch = line.match(PATTERNS.header);
      if (headerMatch) {
        metadata.title = headerMatch[2].trim();
        break;
      }
    }

    // Extract version
    const versionMatch = content.match(/version[:\s]*([^\n]+)/i);
    if (versionMatch) {
      metadata.version = versionMatch[1].trim();
    }

    // Extract author
    const authorMatch = content.match(/author[:\s]*([^\n]+)/i);
    if (authorMatch) {
      metadata.author = authorMatch[1].trim();
    }

    // Extract dates
    const createdMatch = content.match(/(?:created|modified|updated)[:\s]*([^\n]+)/i);
    if (createdMatch) {
      const dateStr = createdMatch[1].trim();
      if (createdMatch[0].toLowerCase().includes('created')) {
        metadata.createdAt = dateStr;
      } else {
        metadata.modifiedAt = dateStr;
      }
    }

    // Extract product name
    const productMatch = content.match(/(?:product|project)[:\s]*([^\n]+)/i);
    if (productMatch) {
      metadata.productName = productMatch[1].trim();
    }

    // Determine document type from content
    const contentLower = content.toLowerCase();
    if (contentLower.includes('bug') || contentLower.includes('fix')) {
      metadata.type = 'bugfix';
    } else if (contentLower.includes('refactor') || contentLower.includes('cleanup')) {
      metadata.type = 'refactor';
    } else if (contentLower.includes('technical') || contentLower.includes('architecture')) {
      metadata.type = 'technical';
    } else if (contentLower.includes('improve') || contentLower.includes('enhance')) {
      metadata.type = 'enhancement';
    }

    return metadata;
  }

  /**
   * Parse document structure into hierarchy
   */
  private parseDocumentStructure(tokens: any[]): PRDSection[] {
    const sections: PRDSection[] = [];
    const sectionStack: PRDSection[] = [];

    let currentSection: PRDSection | null = null;
    let currentContent = '';

    for (const token of tokens) {
      if (token.type === 'heading_open') {
        // Save previous section content
        if (currentSection) {
          currentSection.content = currentContent.trim();
          currentContent = '';
        }

        // Extract header level and text
        const level = token.tag === 'h1' ? 1 : 
                     token.tag === 'h2' ? 2 :
                     token.tag === 'h3' ? 3 :
                     token.tag === 'h4' ? 4 :
                     token.tag === 'h5' ? 5 : 6;

        // Find header text in next token
        const nextToken = tokens[tokens.indexOf(token) + 1];
        const title = nextToken ? nextToken.content : 'Untitled Section';

        // Create new section
        currentSection = {
          id: this.generateId(title),
          title: title.trim(),
          level,
          content: '',
          children: [],
          items: [],
        };

        // Handle hierarchy
        while (sectionStack.length > 0 && sectionStack[sectionStack.length - 1].level >= level) {
          sectionStack.pop();
        }

        if (sectionStack.length === 0) {
          sections.push(currentSection);
        } else {
          sectionStack[sectionStack.length - 1].children.push(currentSection);
        }

        sectionStack.push(currentSection);
      } else if (currentSection && token.type !== 'heading_close') {
        // Accumulate content for current section
        if (token.type === 'inline') {
          currentContent += token.content + '\n';
        } else if (token.type === 'paragraph_open') {
          currentContent += '\n';
        } else if (token.type === 'paragraph_close') {
          currentContent += '\n';
        }
      }
    }

    // Save final section content
    if (currentSection) {
      currentSection.content = currentContent.trim();
    }

    return sections;
  }

  /**
   * Parse features from PRD content
   */
  private async parseFeatures(content: string, options: PRDParseOptions): Promise<PRDFeature[]> {
    const features: PRDFeature[] = [];
    const lines = content.split('\n');
    
    let currentFeature: Partial<PRDFeature> | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for feature start
      const featureMatch = line.match(PATTERNS.feature);
      if (featureMatch) {
        // Save previous feature if exists
        if (currentFeature && currentFeature.title) {
          features.push(this.completeFeature(currentFeature));
        }
        
        // Start new feature
        currentFeature = {
          id: this.generateId(featureMatch[1]),
          title: featureMatch[1].trim(),
          description: '',
          priority: 'medium',
          userStories: [],
          requirementIds: [],
          acceptanceCriteriaIds: [],
          dependencies: [],
        };
      }
      
      // Parse feature details
      if (currentFeature) {
        // Priority
        const priorityMatch = line.match(PATTERNS.priority);
        if (priorityMatch) {
          currentFeature.priority = this.normalizePriority(priorityMatch[1]);
        }
        
        // Business value
        const businessValueMatch = line.match(PATTERNS.businessValue);
        if (businessValueMatch) {
          currentFeature.businessValue = businessValueMatch[1].trim();
        }
        
        // User stories
        const userStoryMatch = line.match(PATTERNS.userStory);
        if (userStoryMatch) {
          currentFeature.userStories!.push(userStoryMatch[1].trim());
        }
        
        // Accumulate description
        if (!PATTERNS.feature.test(line) && 
            !PATTERNS.priority.test(line) && 
            !PATTERNS.businessValue.test(line) &&
            !PATTERNS.userStory.test(line)) {
          if (line.trim() && !line.startsWith('#')) {
            currentFeature.description += line + '\n';
          }
        }
      }
    }
    
    // Save final feature
    if (currentFeature && currentFeature.title) {
      features.push(this.completeFeature(currentFeature));
    }
    
    return features;
  }

  /**
   * Parse requirements from PRD content
   */
  private async parseRequirements(content: string, options: PRDParseOptions): Promise<PRDRequirement[]> {
    const requirements: PRDRequirement[] = [];
    const lines = content.split('\n');
    
    let currentRequirement: Partial<PRDRequirement> | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for requirement start
      const reqMatch = line.match(PATTERNS.requirement);
      if (reqMatch) {
        // Save previous requirement if exists
        if (currentRequirement && currentRequirement.title) {
          requirements.push(this.completeRequirement(currentRequirement));
        }
        
        // Start new requirement
        currentRequirement = {
          id: this.generateId(reqMatch[1]),
          title: reqMatch[1].trim(),
          description: '',
          type: 'functional',
          priority: 'medium',
          acceptanceCriteria: [],
          dependencies: [],
        };
      }
      
      // Parse requirement details
      if (currentRequirement) {
        // Priority
        const priorityMatch = line.match(PATTERNS.priority);
        if (priorityMatch) {
          currentRequirement.priority = this.normalizePriority(priorityMatch[1]);
        }
        
        // Type detection
        const typeMatch = line.match(/(?:type|category)[:\s]*(functional|non-functional|technical|business)/i);
        if (typeMatch) {
          currentRequirement.type = typeMatch[1].toLowerCase() as any;
        }
        
        // Dependencies
        const depMatch = line.match(PATTERNS.dependsOn);
        if (depMatch) {
          const deps = depMatch[1].split(',').map(d => d.trim());
          currentRequirement.dependencies!.push(...deps);
        }
        
        // Implementation notes
        const implMatch = line.match(PATTERNS.implementation);
        if (implMatch) {
          currentRequirement.implementationNotes = implMatch[1].trim();
        }
        
        // Accumulate description
        if (!PATTERNS.requirement.test(line) && 
            !PATTERNS.priority.test(line) &&
            !line.match(/^(?:type|category|depends on|requires|implementation)/i) &&
            !line.startsWith('#')) {
          if (line.trim()) {
            currentRequirement.description += line + '\n';
          }
        }
      }
    }
    
    // Save final requirement
    if (currentRequirement && currentRequirement.title) {
      requirements.push(this.completeRequirement(currentRequirement));
    }
    
    return requirements;
  }

  /**
   * Parse acceptance criteria from PRD content
   */
  private async parseAcceptanceCriteria(content: string, options: PRDParseOptions): Promise<PRDAcceptanceCriteria[]> {
    const acceptanceCriteria: PRDAcceptanceCriteria[] = [];
    const lines = content.split('\n');
    
    let currentAC: Partial<PRDAcceptanceCriteria> | null = null;
    let inACSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Detect acceptance criteria section
      if (line.toLowerCase().includes('acceptance criteria') || 
          line.toLowerCase().includes('acceptance tests') ||
          PATTERNS.acceptanceCriteria.test(line)) {
        inACSection = true;
        continue;
      }
      
      // Check for new AC item
      const acMatch = line.match(/^\s*[-*+]\s+(.+)/) || line.match(/^\s*\d+\.\s+(.+)/);
      if (inACSection && acMatch && line.trim()) {
        // Save previous AC if exists
        if (currentAC && currentAC.description) {
          acceptanceCriteria.push(this.completeAcceptanceCriteria(currentAC));
        }
        
        // Start new AC
        currentAC = {
          id: this.generateId(acMatch[1]),
          description: acMatch[1].trim(),
          type: 'functional',
          testScenarios: [],
          dependencies: [],
          priority: 'medium',
        };
      }
      
      // Parse AC details
      if (currentAC) {
        // Priority
        const priorityMatch = line.match(PATTERNS.priority);
        if (priorityMatch) {
          currentAC.priority = this.normalizePriority(priorityMatch[1]);
        }
        
        // Test scenarios
        const testMatch = line.match(/(?:test|scenario)[:\s]*([^\n]+)/i);
        if (testMatch) {
          currentAC.testScenarios!.push(testMatch[1].trim());
        }
        
        // Dependencies
        const depMatch = line.match(PATTERNS.dependsOn);
        if (depMatch) {
          const deps = depMatch[1].split(',').map(d => d.trim());
          currentAC.dependencies!.push(...deps);
        }
      }
    }
    
    // Save final AC
    if (currentAC && currentAC.description) {
      acceptanceCriteria.push(this.completeAcceptanceCriteria(currentAC));
    }
    
    return acceptanceCriteria;
  }

  /**
   * Analyze dependencies between features, requirements, and acceptance criteria
   */
  private analyzeDependencies(
    features: PRDFeature[], 
    requirements: PRDRequirement[], 
    acceptanceCriteria: PRDAcceptanceCriteria[]
  ): PRDDependency[] {
    const dependencies: PRDDependency[] = [];
    
    // Feature to feature dependencies
    features.forEach((feature, index) => {
      feature.dependencies.forEach(dep => {
        const targetFeature = features.find(f => 
          f.title.toLowerCase().includes(dep.toLowerCase()) ||
          f.id.toLowerCase() === dep.toLowerCase()
        );
        if (targetFeature) {
          dependencies.push({
            sourceId: feature.id,
            targetId: targetFeature.id,
            type: 'blocking',
            strength: 'strong',
            reason: `Feature "${feature.title}" depends on "${targetFeature.title}"`,
          });
        }
      });
    });
    
    // Requirements to features mapping
    features.forEach(feature => {
      feature.requirementIds.forEach(reqId => {
        const requirement = requirements.find(r => r.id === reqId);
        if (requirement) {
          dependencies.push({
            sourceId: requirement.id,
            targetId: feature.id,
            type: 'required',
            strength: 'strong',
            reason: `Requirement "${requirement.title}" implements feature "${feature.title}"`,
          });
        }
      });
    });
    
    // Acceptance criteria to features mapping
    features.forEach(feature => {
      feature.acceptanceCriteriaIds.forEach(acId => {
        const ac = acceptanceCriteria.find(a => a.id === acId);
        if (ac) {
          dependencies.push({
            sourceId: ac.id,
            targetId: feature.id,
            type: 'required',
            strength: 'medium',
            reason: `Acceptance criteria "${ac.description}" validates feature "${feature.title}"`,
          });
        }
      });
    });
    
    return dependencies;
  }

  /**
   * Generate tasks from parsed PRD elements
   */
  private async generateTasks(
    features: PRDFeature[],
    requirements: PRDRequirement[],
    acceptanceCriteria: PRDAcceptanceCriteria[],
    options: PRDParseOptions
  ): Promise<GeneratedTask[]> {
    const tasks: GeneratedTask[] = [];
    
    // Generate tasks for features
    for (const feature of features) {
      const featureTasks = await this.generateFeatureTasks(feature, options);
      tasks.push(...featureTasks);
    }
    
    // Generate tasks for requirements
    for (const requirement of requirements) {
      const requirementTasks = await this.generateRequirementTasks(requirement, options);
      tasks.push(...requirementTasks);
    }
    
    // Generate tasks for acceptance criteria
    for (const ac of acceptanceCriteria) {
      const acTasks = await this.generateAcceptanceCriteriaTasks(ac, options);
      tasks.push(...acTasks);
    }
    
    // Remove duplicates and validate dependencies
    return this.consolidateAndValidateTasks(tasks);
  }

  /**
   * Generate tasks for a feature
   */
  private async generateFeatureTasks(feature: PRDFeature, options: PRDParseOptions): Promise<GeneratedTask[]> {
    const tasks: GeneratedTask[] = [];
    
    // Main development task
    tasks.push({
      id: this.generateId(`feature-${feature.title}`),
      title: `Implement ${feature.title}`,
      description: feature.description,
      type: 'development',
      priority: feature.priority,
      dependencies: feature.dependencies.map(d => this.generateId(`feature-${d}`)),
      sourceReferences: [feature.id],
      tags: ['feature', 'development'],
      acceptanceCriteria: feature.userStories.map(us => `User Story: ${us}`),
    });
    
    // Testing task
    tasks.push({
      id: this.generateId(`test-${feature.title}`),
      title: `Test ${feature.title}`,
      description: `Create comprehensive tests for ${feature.title} including unit, integration, and acceptance tests`,
      type: 'testing',
      priority: feature.priority,
      dependencies: [this.generateId(`feature-${feature.title}`)],
      sourceReferences: [feature.id],
      tags: ['testing', 'feature'],
      testRequirements: [
        'Unit tests',
        'Integration tests',
        'Acceptance tests',
        ...feature.userStories,
      ],
    });
    
    // Documentation task
    tasks.push({
      id: this.generateId(`docs-${feature.title}`),
      title: `Document ${feature.title}`,
      description: `Create documentation for ${feature.title} including API docs, user guides, and developer documentation`,
      type: 'documentation',
      priority: 'medium',
      dependencies: [this.generateId(`feature-${feature.title}`)],
      sourceReferences: [feature.id],
      tags: ['documentation', 'feature'],
    });
    
    return tasks;
  }

  /**
   * Generate tasks for a requirement
   */
  private async generateRequirementTasks(requirement: PRDRequirement, options: PRDParseOptions): Promise<GeneratedTask[]> {
    const tasks: GeneratedTask[] = [];
    
    // Implementation task
    tasks.push({
      id: this.generateId(`req-${requirement.title}`),
      title: `Implement ${requirement.title}`,
      description: requirement.description,
      type: 'development',
      priority: requirement.priority,
      dependencies: requirement.dependencies.map(d => this.generateId(d)),
      sourceReferences: [requirement.id],
      tags: ['requirement', 'development', requirement.type],
      acceptanceCriteria: requirement.acceptanceCriteria,
      implementationDetails: requirement.implementationNotes,
    });
    
    // Technical specification task for complex requirements
    if (requirement.type === 'technical' || requirement.description.length > 200) {
      tasks.push({
        id: this.generateId(`spec-${requirement.title}`),
        title: `Create technical specification for ${requirement.title}`,
        description: `Develop detailed technical specification and design document for ${requirement.title}`,
        type: 'documentation',
        priority: 'high',
        dependencies: [],
        sourceReferences: [requirement.id],
        tags: ['specification', 'technical', requirement.type],
      });
    }
    
    return tasks;
  }

  /**
   * Generate tasks for acceptance criteria
   */
  private async generateAcceptanceCriteriaTasks(ac: PRDAcceptanceCriteria, options: PRDParseOptions): Promise<GeneratedTask[]> {
    const tasks: GeneratedTask[] = [];
    
    // Test case development task
    tasks.push({
      id: this.generateId(`testcase-${ac.description}`),
      title: `Develop test cases for ${ac.description}`,
      description: `Create detailed test cases and scenarios for acceptance criteria: ${ac.description}`,
      type: 'testing',
      priority: ac.priority,
      dependencies: ac.dependencies.map(d => this.generateId(d)),
      sourceReferences: [ac.id],
      tags: ['test-case', 'acceptance-criteria', ac.type],
      testRequirements: ac.testScenarios,
    });
    
    // Performance testing for performance criteria
    if (ac.type === 'performance') {
      tasks.push({
        id: this.generateId(`perf-${ac.description}`),
        title: `Performance testing for ${ac.description}`,
        description: `Implement performance testing and benchmarking for ${ac.description}`,
        type: 'testing',
        priority: ac.priority,
        dependencies: [this.generateId(`testcase-${ac.description}`)],
        sourceReferences: [ac.id],
        tags: ['performance', 'testing', ac.type],
      });
    }
    
    return tasks;
  }

  /**
   * Complete feature object with defaults
   */
  private completeFeature(feature: Partial<PRDFeature>): PRDFeature {
    return {
      id: feature.id || this.generateId(feature.title || 'feature'),
      title: feature.title || 'Untitled Feature',
      description: feature.description?.trim() || '',
      priority: feature.priority || 'medium',
      businessValue: feature.businessValue,
      userStories: feature.userStories || [],
      requirementIds: feature.requirementIds || [],
      acceptanceCriteriaIds: feature.acceptanceCriteriaIds || [],
      dependencies: feature.dependencies || [],
    };
  }

  /**
   * Complete requirement object with defaults
   */
  private completeRequirement(requirement: Partial<PRDRequirement>): PRDRequirement {
    return {
      id: requirement.id || this.generateId(requirement.title || 'requirement'),
      title: requirement.title || 'Untitled Requirement',
      description: requirement.description?.trim() || '',
      type: requirement.type || 'functional',
      priority: requirement.priority || 'medium',
      acceptanceCriteria: requirement.acceptanceCriteria || [],
      dependencies: requirement.dependencies || [],
      implementationNotes: requirement.implementationNotes,
    };
  }

  /**
   * Complete acceptance criteria object with defaults
   */
  private completeAcceptanceCriteria(ac: Partial<PRDAcceptanceCriteria>): PRDAcceptanceCriteria {
    return {
      id: ac.id || this.generateId(ac.description || 'acceptance-criteria'),
      description: ac.description || 'Untitled Acceptance Criteria',
      type: ac.type || 'functional',
      testScenarios: ac.testScenarios || [],
      dependencies: ac.dependencies || [],
      priority: ac.priority || 'medium',
    };
  }

  /**
   * Consolidate and validate generated tasks
   */
  private consolidateAndValidateTasks(tasks: GeneratedTask[]): GeneratedTask[] {
    // Remove duplicate tasks based on title and type
    const uniqueTasks = tasks.filter((task, index, self) => 
      index === self.findIndex(t => t.title === task.title && t.type === task.type)
    );
    
    // Validate and fix dependencies
    for (const task of uniqueTasks) {
      // Remove self-dependencies
      task.dependencies = task.dependencies.filter(dep => dep !== task.id);
      
      // Ensure all dependencies reference valid tasks
      task.dependencies = task.dependencies.filter(dep => 
        uniqueTasks.some(t => t.id === dep)
      );
    }
    
    return uniqueTasks;
  }

  /**
   * Calculate parsing statistics
   */
  private calculateStatistics(
    features: PRDFeature[],
    requirements: PRDRequirement[],
    acceptanceCriteria: PRDAcceptanceCriteria[],
    tasks: GeneratedTask[],
    dependencies: PRDDependency[],
    processingTime: number
  ): PRDStatistics {
    const allItems = [...features, ...requirements, ...acceptanceCriteria];
    const totalComplexity = allItems.reduce((sum, item) => {
      const priorityWeight = { low: 1, medium: 2, high: 3, critical: 4 };
      return sum + priorityWeight[item.priority];
    }, 0);
    
    const averageComplexity = allItems.length > 0 ? totalComplexity / allItems.length : 0;
    
    // Calculate confidence based on completeness
    let confidence = 0.5; // Base confidence
    
    if (features.length > 0) confidence += 0.2;
    if (requirements.length > 0) confidence += 0.15;
    if (acceptanceCriteria.length > 0) confidence += 0.1;
    if (tasks.length > 0) confidence += 0.05;
    
    return {
      featureCount: features.length,
      requirementCount: requirements.length,
      acceptanceCriteriaCount: acceptanceCriteria.length,
      taskCount: tasks.length,
      dependencyCount: dependencies.length,
      averageComplexity,
      confidence: Math.min(1.0, confidence),
      processingTime,
    };
  }

  /**
   * Normalize priority string to standard format
   */
  private normalizePriority(priority: string): 'low' | 'medium' | 'high' | 'critical' {
    const normalized = priority.toLowerCase().trim();
    
    for (const [level, keywords] of Object.entries(PRIORITY_KEYWORDS)) {
      if (keywords.some(keyword => normalized.includes(keyword))) {
        return level as any;
      }
    }
    
    // Default fallback
    return 'medium';
  }

  /**
   * Generate unique ID for items
   */
  private generateId(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
  }
}

/**
 * Parse PRD content into structured data
 * 
 * @param content PRD markdown content
 * @param projectId Project identifier for generated tasks
 * @param options Parsing options
 * @returns Parsed PRD structure
 */
export async function parsePRD(
  content: string, 
  projectId: string, 
  options: PRDParseOptions = {}
): Promise<ParsedPRD> {
  const parser = new PRDParser(projectId);
  return parser.parsePRD(content, options);
}