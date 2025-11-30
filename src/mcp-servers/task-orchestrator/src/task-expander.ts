/**
 * Task Expander
 * 
 * AI-powered task expansion system using LLM integration
 * 
 * Features:
 * - Auto-generate subtasks using LLM (OpenAI/Anthropic)
 * - Suggest implementation steps for each task
 * - Create test tasks automatically
 * - Fallback between multiple LLM providers
 * - Intelligent task breakdown based on complexity analysis
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { analyzeComplexity, ComplexityAnalysisResult } from './complexity-analyzer';

/**
 * Task expansion options
 */
export interface TaskExpansionOptions {
  /** Maximum expansion depth */
  maxDepth?: number;
  /** Include test task generation */
  includeTests?: boolean;
  /** Include documentation tasks */
  includeDocumentation?: boolean;
  /** Include implementation guidance */
  includeImplementation?: boolean;
  /** LLM provider preference */
  provider?: 'openai' | 'anthropic' | 'auto';
  /** Model to use for expansion */
  model?: string;
  /** Maximum tokens for LLM response */
  maxTokens?: number;
  /** Temperature for LLM creativity (0-2) */
  temperature?: number;
  /** Custom prompts for task expansion */
  customPrompts?: TaskExpansionPrompts;
  /** Complexity analysis options */
  complexityOptions?: any;
  /** Task context for expansion */
  context?: TaskContext;
}

/**
 * Custom prompts for task expansion
 */
export interface TaskExpansionPrompts {
  /** Prompt for generating subtasks */
  subtasksPrompt?: string;
  /** Prompt for generating implementation steps */
  implementationPrompt?: string;
  /** Prompt for generating test tasks */
  testPrompt?: string;
  /** Prompt for generating documentation tasks */
  documentationPrompt?: string;
  /** General expansion prompt */
  generalPrompt?: string;
}

/**
 * Task context for expansion
 */
export interface TaskContext {
  /** Project domain */
  domain?: string;
  /** Technology stack */
  techStack?: string[];
  /** Team skills */
  teamSkills?: string[];
  /** Project constraints */
  constraints?: string[];
  /** Business objectives */
  businessObjectives?: string[];
  /** Previous tasks context */
  previousTasks?: string[];
}

/**
 * Expanded task result
 */
export interface ExpandedTaskResult {
  /** Original task ID */
  originalTaskId: number;
  /** Generated subtasks */
  subtasks: ExpandedSubtask[];
  /** Implementation guidance */
  implementationSteps: ImplementationStep[];
  /** Generated test tasks */
  testTasks: TestTask[];
  /** Documentation tasks */
  documentationTasks: DocumentationTask[];
  /** Expansion metadata */
  metadata: {
    expansionDepth: number;
    provider: string;
    model: string;
    tokenUsage: TokenUsage;
    confidence: number;
    processingTime: number;
    warnings: string[];
  };
}

/**
 * Expanded subtask
 */
export interface ExpandedSubtask {
  /** Subtask ID (generated) */
  id: string;
  /** Subtask title */
  title: string;
  /** Subtask description */
  description: string;
  /** Estimated effort (hours) */
  estimatedEffort: number;
  /** Priority level */
  priority: 'low' | 'medium' | 'high' | 'critical';
  /** Dependencies on other subtasks */
  dependencies: string[];
  /** Task type */
  type: 'development' | 'design' | 'research' | 'configuration' | 'deployment';
  /** Skills required */
  requiredSkills: string[];
  /** Acceptance criteria */
  acceptanceCriteria: string[];
  /** Implementation hints */
  implementationHints?: string;
  /** Technical notes */
  technicalNotes?: string;
}

/**
 * Implementation step
 */
export interface ImplementationStep {
  /** Step number */
  stepNumber: number;
  /** Step title */
  title: string;
  /** Step description */
  description: string;
  /** Expected outcome */
  expectedOutcome: string;
  /** Dependencies */
  dependencies: string[];
  /** Resources needed */
  resources: string[];
  /** Time estimate (hours) */
  timeEstimate: number;
  /** Risk level */
  riskLevel: 'low' | 'medium' | 'high';
  /** Validation criteria */
  validationCriteria: string[];
}

/**
 * Generated test task
 */
export interface TestTask {
  /** Test task ID */
  id: string;
  /** Test task title */
  title: string;
  /** Test type */
  type: 'unit' | 'integration' | 'e2e' | 'performance' | 'security' | 'usability';
  /** Test description */
  description: string;
  /** Test scenarios */
  scenarios: TestScenario[];
  /** Target subtask IDs */
  targetSubtaskIds: string[];
  /** Priority */
  priority: 'low' | 'medium' | 'high';
  /** Estimated effort (hours) */
  estimatedEffort: number;
  /** Testing framework suggestions */
  frameworkSuggestions?: string[];
  /** Dependencies */
  dependencies: string[];
}

/**
 * Test scenario
 */
export interface TestScenario {
  /** Scenario ID */
  id: string;
  /** Scenario description */
  description: string;
  /** Test steps */
  steps: string[];
  /** Expected results */
  expectedResults: string[];
  /** Edge cases */
  edgeCases?: string[];
  /** Test data requirements */
  testDataRequirements?: string[];
}

/**
 * Documentation task
 */
export interface DocumentationTask {
  /** Documentation task ID */
  id: string;
  /** Document title */
  title: string;
  /** Document type */
  type: 'api' | 'user-guide' | 'developer' | 'architecture' | 'deployment' | 'troubleshooting';
  /** Description */
  description: string;
  /** Target subtask IDs */
  targetSubtaskIds: string[];
  /** Sections to include */
  sections: DocumentationSection[];
  /** Priority */
  priority: 'low' | 'medium' | 'high';
  /** Estimated effort (hours) */
  estimatedEffort: number;
  /** Dependencies */
  dependencies: string[];
}

/**
 * Documentation section
 */
export interface DocumentationSection {
  /** Section title */
  title: string;
  /** Section content outline */
  contentOutline: string[];
  /** Required elements */
  requiredElements: string[];
  /** Target audience */
  targetAudience: string;
}

/**
 * LLM token usage information
 */
export interface TokenUsage {
  /** Input tokens */
  inputTokens: number;
  /** Output tokens */
  outputTokens: number;
  /** Total tokens */
  totalTokens: number;
  /** Estimated cost (USD) */
  estimatedCost?: number;
}

/**
 * Default expansion prompts
 */
const DEFAULT_PROMPTS: TaskExpansionPrompts = {
  subtasksPrompt: `Analyze this task and break it down into 3-8 specific, actionable subtasks. For each subtask, provide:
1. Clear, descriptive title
2. Detailed description of what needs to be done
3. Estimated effort in hours
4. Priority level (low, medium, high, critical)
5. Required skills or technologies
6. Dependencies on other subtasks
7. Acceptance criteria

Consider the task complexity and ensure subtasks are:
- Specific and measurable
- Logically ordered
- Appropriately sized (2-16 hours each)
- Clearly defined with no ambiguity`,

  implementationPrompt: `Provide detailed implementation guidance for this task including:
1. Step-by-step implementation approach
2. Key technical decisions and trade-offs
3. Required resources and tools
4. Potential challenges and mitigation strategies
5. Validation and testing approaches
6. Code structure recommendations
7. Performance considerations

Focus on practical, actionable guidance that a developer can follow.`,

  testPrompt: `Generate comprehensive test tasks for this implementation including:
1. Unit tests for core functionality
2. Integration tests for component interactions
3. End-to-end tests for user workflows
4. Performance tests for critical paths
5. Security tests where applicable
6. Edge case and boundary condition tests

For each test type, provide:
- Test scenarios with clear descriptions
- Expected outcomes and validation criteria
- Test data requirements
- Framework and tool recommendations`,

  documentationPrompt: `Create documentation tasks for this implementation including:
1. API documentation for public interfaces
2. User guides for feature usage
3. Developer documentation for maintenance
4. Architecture documentation for system design
5. Deployment and operations guides
6. Troubleshooting and FAQ sections

For each document type, specify:
- Target audience and scope
- Required sections and content
- Technical depth and format preferences
- Maintenance and update requirements`,
};

/**
 * LLM Provider interface
 */
interface LLMProvider {
  generateCompletion(prompt: string, options: any): Promise<{
    content: string;
    tokenUsage: TokenUsage;
    model: string;
  }>;
  isAvailable(): boolean;
}

/**
 * OpenAI Provider implementation
 */
class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private isConfigured: boolean;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    this.isConfigured = !!apiKey;
    
    if (this.isConfigured) {
      this.client = new OpenAI({ apiKey });
    }
  }

  async generateCompletion(prompt: string, options: any): Promise<{
    content: string;
    tokenUsage: TokenUsage;
    model: string;
  }> {
    if (!this.isConfigured) {
      throw new Error('OpenAI API key not configured');
    }

    const completion = await this.client.chat.completions.create({
      model: options.model || 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a helpful task expansion assistant.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: options.maxTokens || 2000,
      temperature: options.temperature || 0.7,
    });

    const choice = completion.choices[0];
    const usage = completion.usage;

    return {
      content: choice.message.content || '',
      tokenUsage: {
        inputTokens: usage?.prompt_tokens || 0,
        outputTokens: usage?.completion_tokens || 0,
        totalTokens: usage?.total_tokens || 0,
        estimatedCost: this.calculateCost(usage?.total_tokens || 0),
      },
      model: options.model || 'gpt-4o',
    };
  }

  isAvailable(): boolean {
    return this.isConfigured;
  }

  private calculateCost(totalTokens: number): number {
    // GPT-4o pricing: ~$5/1M input tokens, ~$15/1M output tokens
    // This is a simplified calculation
    const inputCost = (totalTokens * 0.6) / 1000000 * 5; // Assume 60% input tokens
    const outputCost = (totalTokens * 0.4) / 1000000 * 15; // Assume 40% output tokens
    return inputCost + outputCost;
  }
}

/**
 * Anthropic Provider implementation
 */
class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  private isConfigured: boolean;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    this.isConfigured = !!apiKey;
    
    if (this.isConfigured) {
      this.client = new Anthropic({ apiKey });
    }
  }

  async generateCompletion(prompt: string, options: any): Promise<{
    content: string;
    tokenUsage: TokenUsage;
    model: string;
  }> {
    if (!this.isConfigured) {
      throw new Error('Anthropic API key not configured');
    }

    const response = await this.client.messages.create({
      model: options.model || 'claude-3-5-sonnet-20241022',
      max_tokens: options.maxTokens || 2000,
      temperature: options.temperature || 0.7,
      messages: [
        { role: 'user', content: prompt }
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Anthropic');
    }

    const usage = response.usage;

    return {
      content: content.text,
      tokenUsage: {
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        totalTokens: usage.input_tokens + usage.output_tokens,
        estimatedCost: this.calculateCost(usage.input_tokens + usage.output_tokens),
      },
      model: options.model || 'claude-3-5-sonnet-20241022',
    };
  }

  isAvailable(): boolean {
    return this.isConfigured;
  }

  private calculateCost(totalTokens: number): number {
    // Claude 3.5 Sonnet pricing: ~$3/1M input tokens, ~$15/1M output tokens
    // Simplified calculation
    const inputCost = (totalTokens * 0.6) / 1000000 * 3;
    const outputCost = (totalTokens * 0.4) / 1000000 * 15;
    return inputCost + outputCost;
  }
}

/**
 * Task Expander Class
 */
export class TaskExpander {
  private providers: {
    openai: OpenAIProvider;
    anthropic: AnthropicProvider;
  };
  private defaultOptions: Required<TaskExpansionOptions>;

  constructor() {
    this.providers = {
      openai: new OpenAIProvider(),
      anthropic: new AnthropicProvider(),
    };

    this.defaultOptions = {
      maxDepth: 3,
      includeTests: true,
      includeDocumentation: true,
      includeImplementation: true,
      provider: 'auto',
      model: 'auto',
      maxTokens: 2000,
      temperature: 0.7,
      customPrompts: DEFAULT_PROMPTS,
      complexityOptions: {},
      context: {},
    };
  }

  /**
   * Expand a task into subtasks, implementation steps, and test tasks
   * 
   * @param taskId Task ID to expand
   * @param depth Expansion depth
   * @param options Expansion options
   * @returns Expanded task result
   */
  async expandTask(taskId: number, depth: number = 2, options: TaskExpansionOptions = {}): Promise<ExpandedTaskResult> {
    const startTime = Date.now();
    
    try {
      // Merge options with defaults
      const expansionOptions: Required<TaskExpansionOptions> = {
        ...this.defaultOptions,
        ...options,
        customPrompts: { ...DEFAULT_PROMPTS, ...options.customPrompts },
      };

      // Perform complexity analysis first
      const complexity = await analyzeComplexity(taskId, expansionOptions.complexityOptions);
      
      // Generate expansion prompts based on task analysis
      const taskPrompt = await this.generateTaskPrompt(taskId, complexity, expansionOptions);
      
      // Get LLM completion
      const provider = this.selectProvider(expansionOptions.provider);
      const completion = await provider.generateCompletion(taskPrompt, {
        model: expansionOptions.model,
        maxTokens: expansionOptions.maxTokens,
        temperature: expansionOptions.temperature,
      });

      // Parse LLM response
      const parsedResponse = await this.parseLLMResponse(completion.content, expansionOptions);
      
      // Generate additional tasks based on options
      const [testTasks, documentationTasks] = await Promise.all([
        expansionOptions.includeTests ? this.generateTestTasks(parsedResponse, complexity, expansionOptions) : [],
        expansionOptions.includeDocumentation ? this.generateDocumentationTasks(parsedResponse, complexity, expansionOptions) : [],
      ]);

      const result: ExpandedTaskResult = {
        originalTaskId: taskId,
        subtasks: parsedResponse.subtasks,
        implementationSteps: expansionOptions.includeImplementation ? parsedResponse.implementationSteps : [],
        testTasks,
        documentationTasks,
        metadata: {
          expansionDepth: Math.min(depth, expansionOptions.maxDepth),
          provider: provider.constructor.name.replace('Provider', ''),
          model: completion.model,
          tokenUsage: completion.tokenUsage,
          confidence: this.calculateConfidence(parsedResponse, complexity),
          processingTime: Date.now() - startTime,
          warnings: this.generateWarnings(parsedResponse, complexity),
        },
      };

      return result;
    } catch (error) {
      throw new Error(`Task expansion failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Select appropriate LLM provider
   */
  private selectProvider(preference: 'openai' | 'anthropic' | 'auto'): LLMProvider {
    const availableProviders = Object.entries(this.providers)
      .filter(([, provider]) => provider.isAvailable())
      .map(([, provider]) => provider);

    if (availableProviders.length === 0) {
      throw new Error('No LLM providers available. Please configure OPENAI_API_KEY or ANTHROPIC_API_KEY');
    }

    // If only one provider available, use it
    if (availableProviders.length === 1) {
      return availableProviders[0];
    }

    // If preference is specified, try to use it
    if (preference !== 'auto') {
      const preferredProvider = this.providers[preference];
      if (preferredProvider.isAvailable()) {
        return preferredProvider;
      }
    }

    // Default to OpenAI if available, otherwise Anthropic
    return availableProviders[0];
  }

  /**
   * Generate comprehensive task prompt for LLM
   */
  private async generateTaskPrompt(
    taskId: number, 
    complexity: ComplexityAnalysisResult, 
    options: Required<TaskExpansionOptions>
  ): Promise<string> {
    // Get task details (placeholder - integrate with your database)
    const task = await this.getTaskDetails(taskId);
    
    let prompt = `# Task Expansion Request
    
## Original Task
**ID:** ${taskId}
**Title:** ${task.title}
**Description:** ${task.description || 'No description provided'}
**Priority:** ${task.priority}
**Estimated Complexity:** ${complexity.score}/10
**Estimated Effort:** ${complexity.estimatedHours} hours

## Task Context
${options.context?.domain ? `**Domain:** ${options.context.domain}` : ''}
${options.context?.techStack ? `**Technology Stack:** ${options.context.techStack.join(', ')}` : ''}
${options.context?.teamSkills ? `**Team Skills:** ${options.context.teamSkills.join(', ')}` : ''}
${options.context?.constraints ? `**Constraints:** ${options.context.constraints.join(', ')}` : ''}

## Complexity Analysis
- **Code Volume Score:** ${complexity.factors.codeVolume}/1
- **Dependencies Score:** ${complexity.factors.dependencies}/1
- **Technical Risk Score:** ${complexity.factors.technicalRisk}/1
- **External Dependencies:** ${complexity.factors.details.externalDependencies}
- **Risk Level:** ${complexity.riskAssessment.level}

${complexity.riskAssessment.mitigations.length > 0 ? `## Risk Mitigation
${complexity.riskAssessment.mitigations.map(m => `- ${m}`).join('\n')}` : ''}

Please expand this task comprehensively:`;

    // Add specific expansion requests
    prompt += `

## Expansion Requirements

### 1. Subtask Generation (Required)
${options.customPrompts.subtasksPrompt}

### 2. Implementation Guidance ${options.includeImplementation ? '(Required)' : '(Optional)'}
${options.includeImplementation ? options.customPrompts.implementationPrompt : 'Skip if not requested.'}

### 3. Test Planning ${options.includeTests ? '(Required)' : '(Optional)'}
${options.includeTests ? options.customPrompts.testPrompt : 'Skip if not requested.'}

### 4. Documentation Planning ${options.includeDocumentation ? '(Required)' : '(Optional)'}
${options.includeDocumentation ? options.customPrompts.documentationPrompt : 'Skip if not requested.'}

## Output Format
Provide your response as a structured JSON object with the following format:

\`\`\`json
{
  "subtasks": [
    {
      "id": "subtask-1",
      "title": "Specific subtask title",
      "description": "Detailed description of what needs to be done",
      "estimatedEffort": 8,
      "priority": "medium",
      "dependencies": ["subtask-2"],
      "type": "development",
      "requiredSkills": ["React", "TypeScript"],
      "acceptanceCriteria": ["Clear measurable outcomes"],
      "implementationHints": "Technical guidance",
      "technicalNotes": "Additional technical details"
    }
  ],
  "implementationSteps": [
    {
      "stepNumber": 1,
      "title": "Setup development environment",
      "description": "Detailed step description",
      "expectedOutcome": "What should be achieved",
      "dependencies": [],
      "resources": ["Node.js", "npm"],
      "timeEstimate": 2,
      "riskLevel": "low",
      "validationCriteria": ["How to verify completion"]
    }
  ]
}
\`\`\`

Ensure all subtasks are:
- Specific and actionable
- Appropriately sized (2-16 hours each)
- Have clear dependencies
- Include acceptance criteria
- Match the complexity level of the original task

Consider the technical risk factors identified in the complexity analysis and provide appropriate mitigation guidance.`;

    return prompt;
  }

  /**
   * Parse LLM response into structured data
   */
  private async parseLLMResponse(content: string, options: Required<TaskExpansionOptions>): Promise<{
    subtasks: ExpandedSubtask[];
    implementationSteps: ImplementationStep[];
  }> {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        return {
          subtasks: parsed.subtasks || [],
          implementationSteps: parsed.implementationSteps || [],
        };
      }

      // Fallback: try to parse the entire content as JSON
      const parsed = JSON.parse(content);
      return {
        subtasks: parsed.subtasks || [],
        implementationSteps: parsed.implementationSteps || [],
      };
    } catch (error) {
      // If JSON parsing fails, try to extract structured information using regex
      return this.fallbackParseResponse(content, options);
    }
  }

  /**
   * Fallback parsing for non-JSON LLM responses
   */
  private fallbackParseResponse(content: string, options: Required<TaskExpansionOptions>): {
    subtasks: ExpandedSubtask[];
    implementationSteps: ImplementationStep[];
  } {
    const subtasks: ExpandedSubtask[] = [];
    const implementationSteps: ImplementationStep[] = [];

    // Simple parsing logic for subtasks
    const subtaskMatches = content.match(/(\d+\.?\s*)?([^-•\n]+)/g);
    if (subtaskMatches) {
      subtaskMatches.forEach((match, index) => {
        const cleanTitle = match.replace(/^\d+\.?\s*/, '').trim();
        if (cleanTitle.length > 10) { // Filter out very short matches
          subtasks.push({
            id: `fallback-subtask-${index}`,
            title: cleanTitle,
            description: `Implement ${cleanTitle.toLowerCase()}`,
            estimatedEffort: 4,
            priority: 'medium',
            dependencies: [],
            type: 'development',
            requiredSkills: [],
            acceptanceCriteria: [],
          });
        }
      });
    }

    return { subtasks, implementationSteps };
  }

  /**
   * Generate test tasks based on subtasks
   */
  private async generateTestTasks(
    parsedResponse: { subtasks: ExpandedSubtask[] },
    complexity: ComplexityAnalysisResult,
    options: Required<TaskExpansionOptions>
  ): Promise<TestTask[]> {
    const testTasks: TestTask[] = [];

    // Generate unit tests for development subtasks
    const developmentTasks = parsedResponse.subtasks.filter(st => st.type === 'development');
    developmentTasks.forEach((subtask, index) => {
      testTasks.push({
        id: `unit-test-${subtask.id}`,
        title: `Unit tests for ${subtask.title}`,
        type: 'unit',
        description: `Create comprehensive unit tests for ${subtask.title}`,
        scenarios: [
          {
            id: `scenario-${index}-1`,
            description: `Test ${subtask.title} with valid inputs`,
            steps: [`Call ${subtask.title} with valid data`, 'Verify expected behavior'],
            expectedResults: ['Function executes successfully', 'Returns correct results'],
          },
          {
            id: `scenario-${index}-2`,
            description: `Test ${subtask.title} with invalid inputs`,
            steps: ['Call with invalid data', 'Verify error handling'],
            expectedResults: ['Appropriate error thrown', 'System remains stable'],
          },
        ],
        targetSubtaskIds: [subtask.id],
        priority: 'high',
        estimatedEffort: Math.ceil(subtask.estimatedEffort * 0.3),
        dependencies: [subtask.id],
      });
    });

    // Generate integration tests if there are multiple subtasks
    if (parsedResponse.subtasks.length > 1) {
      testTasks.push({
        id: 'integration-test-main',
        title: 'Integration tests for task workflow',
        type: 'integration',
        description: 'Test interaction between all subtasks',
        scenarios: [
          {
            id: 'integration-scenario',
            description: 'End-to-end workflow test',
            steps: ['Execute all subtasks in sequence', 'Verify data flow between components'],
            expectedResults: ['All subtasks complete successfully', 'Data integrity maintained'],
          },
        ],
        targetSubtaskIds: parsedResponse.subtasks.map(st => st.id),
        priority: 'medium',
        estimatedEffort: Math.ceil(complexity.estimatedHours * 0.2),
        dependencies: parsedResponse.subtasks.map(st => st.id),
      });
    }

    // Generate performance tests for complex tasks
    if (complexity.score > 7) {
      testTasks.push({
        id: 'performance-test-main',
        title: 'Performance testing',
        type: 'performance',
        description: 'Performance testing for high-complexity implementation',
        scenarios: [
          {
            id: 'performance-scenario',
            description: 'Load testing',
            steps: ['Simulate expected load', 'Monitor performance metrics'],
            expectedResults: ['Performance meets requirements', 'No memory leaks detected'],
          },
        ],
        targetSubtaskIds: parsedResponse.subtasks.map(st => st.id),
        priority: 'medium',
        estimatedEffort: 8,
        dependencies: parsedResponse.subtasks.map(st => `unit-test-${st.id}`),
      });
    }

    return testTasks;
  }

  /**
   * Generate documentation tasks
   */
  private async generateDocumentationTasks(
    parsedResponse: { subtasks: ExpandedSubtask[] },
    complexity: ComplexityAnalysisResult,
    options: Required<TaskExpansionOptions>
  ): Promise<DocumentationTask[]> {
    const documentationTasks: DocumentationTask[] = [];

    // API documentation for development tasks
    const developmentTasks = parsedResponse.subtasks.filter(st => st.type === 'development');
    if (developmentTasks.length > 0) {
      documentationTasks.push({
        id: 'api-docs-main',
        title: 'API Documentation',
        type: 'api',
        description: 'Create comprehensive API documentation for implemented features',
        targetSubtaskIds: developmentTasks.map(st => st.id),
        sections: [
          {
            title: 'API Reference',
            contentOutline: ['Endpoint descriptions', 'Request/response formats', 'Error codes'],
            requiredElements: ['Method signatures', 'Parameter descriptions', 'Return types'],
            targetAudience: 'Developers',
          },
          {
            title: 'Integration Guide',
            contentOutline: ['Authentication', 'Usage examples', 'SDK references'],
            requiredElements: ['Code examples', 'Best practices', 'Common pitfalls'],
            targetAudience: 'Integration developers',
          },
        ],
        priority: 'high',
        estimatedEffort: Math.ceil(developmentTasks.length * 2),
        dependencies: developmentTasks.map(st => st.id),
      });
    }

    // User guide if user-facing functionality
    const userFacingTasks = parsedResponse.subtasks.filter(st => 
      st.acceptanceCriteria.some(cr => cr.toLowerCase().includes('user') || cr.toLowerCase().includes('customer'))
    );
    if (userFacingTasks.length > 0) {
      documentationTasks.push({
        id: 'user-guide-main',
        title: 'User Guide',
        type: 'user-guide',
        description: 'Create user guide for new functionality',
        targetSubtaskIds: userFacingTasks.map(st => st.id),
        sections: [
          {
            title: 'Getting Started',
            contentOutline: ['Feature overview', 'Basic usage', 'Key concepts'],
            requiredElements: ['Screenshots', 'Step-by-step instructions', 'FAQs'],
            targetAudience: 'End users',
          },
        ],
        priority: 'medium',
        estimatedEffort: userFacingTasks.length * 3,
        dependencies: userFacingTasks.map(st => st.id),
      });
    }

    // Developer documentation for complex implementations
    if (complexity.score > 6) {
      documentationTasks.push({
        id: 'developer-docs-main',
        title: 'Developer Documentation',
        type: 'developer',
        description: 'Technical documentation for maintenance and future development',
        targetSubtaskIds: parsedResponse.subtasks.map(st => st.id),
        sections: [
          {
            title: 'Architecture Overview',
            contentOutline: ['System design', 'Component interactions', 'Data flow'],
            requiredElements: ['Architecture diagrams', 'Component descriptions', 'Integration patterns'],
            targetAudience: 'Developers',
          },
        ],
        priority: 'high',
        estimatedEffort: 6,
        dependencies: parsedResponse.subtasks.map(st => st.id),
      });
    }

    return documentationTasks;
  }

  /**
   * Calculate confidence in expansion based on task complexity and response quality
   */
  private calculateConfidence(
    parsedResponse: { subtasks: ExpandedSubtask[]; implementationSteps: ImplementationStep[] },
    complexity: ComplexityAnalysisResult
  ): number {
    let confidence = 0.5; // Base confidence

    // Adjust based on number of subtasks generated
    if (parsedResponse.subtasks.length >= 3 && parsedResponse.subtasks.length <= 10) {
      confidence += 0.2;
    }

    // Adjust based on implementation steps
    if (parsedResponse.implementationSteps.length > 0) {
      confidence += 0.1;
    }

    // Adjust based on task complexity
    if (complexity.score <= 5) {
      confidence += 0.1; // Lower complexity = higher confidence
    }

    // Adjust for external dependencies
    if (complexity.factors.details.externalDependencies > 5) {
      confidence -= 0.1; // High external dependencies = lower confidence
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Generate warnings based on task analysis
   */
  private generateWarnings(
    parsedResponse: { subtasks: ExpandedSubtask[]; implementationSteps: ImplementationStep[] },
    complexity: ComplexityAnalysisResult
  ): string[] {
    const warnings: string[] = [];

    // Check for high complexity tasks
    if (complexity.score > 8) {
      warnings.push('High complexity task - consider breaking down further');
    }

    // Check for many external dependencies
    if (complexity.factors.details.externalDependencies > 10) {
      warnings.push('Many external dependencies detected - may increase integration complexity');
    }

    // Check for risk factors
    if (complexity.riskAssessment.level === 'high' || complexity.riskAssessment.level === 'critical') {
      warnings.push(`High risk task detected - review risk mitigation strategies`);
    }

    // Check for missing implementation guidance
    if (parsedResponse.implementationSteps.length === 0) {
      warnings.push('No implementation guidance generated - may need manual planning');
    }

    // Check for very small or very large subtasks
    parsedResponse.subtasks.forEach(subtask => {
      if (subtask.estimatedEffort < 2) {
        warnings.push(`Subtask "${subtask.title}" may be too small (${subtask.estimatedEffort}h)`);
      } else if (subtask.estimatedEffort > 16) {
        warnings.push(`Subtask "${subtask.title}" may be too large (${subtask.estimatedEffort}h)`);
      }
    });

    return warnings;
  }

  /**
   * Get task details (placeholder - integrate with your database)
   */
  private async getTaskDetails(taskId: number): Promise<{
    title: string;
    description?: string;
    priority: string;
  }> {
    // This is a placeholder - in real implementation, this would fetch from your database
    return {
      title: `Task ${taskId}`,
      description: 'Sample task description for expansion',
      priority: 'medium',
    };
  }
}

/**
 * Expand a task with specified depth and options
 * 
 * @param taskId Task ID to expand
 * @param depth Maximum expansion depth
 * @param options Expansion options
 * @returns Expanded task result
 */
export async function expandTask(taskId: number, depth: number = 2, options: TaskExpansionOptions = {}): Promise<ExpandedTaskResult> {
  const expander = new TaskExpander();
  return expander.expandTask(taskId, depth, options);
}