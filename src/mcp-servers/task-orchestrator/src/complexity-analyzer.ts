/**
 * Task Complexity Analyzer
 * 
 * Intelligent complexity scoring system for task estimation and analysis
 * 
 * Features:
 * - Multi-factor complexity scoring (1-10 scale)
 * - Code volume estimation from analysis
 * - File dependency analysis
 * - Technical risk assessment
 * - Historical data correlation
 * - Effort estimation in hours
 */

import { existsSync, readFileSync, statSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { glob } from 'glob';

/**
 * Complexity analysis options
 */
export interface ComplexityAnalysisOptions {
  /** Enable file dependency analysis */
  analyzeDependencies?: boolean;
  /** Enable code volume estimation */
  estimateCodeVolume?: boolean;
  /** Enable technical risk assessment */
  assessRisk?: boolean;
  /** Enable historical data correlation */
  useHistoricalData?: boolean;
  /** Custom weightings for complexity factors */
  weights?: ComplexityWeights;
  /** Base directory for analysis */
  projectRoot?: string;
}

/**
 * Complexity factor weights
 */
export interface ComplexityWeights {
  /** Weight for code volume (0-1) */
  codeVolume: number;
  /** Weight for dependencies (0-1) */
  dependencies: number;
  /** Weight for technical risk (0-1) */
  technicalRisk: number;
  /** Weight for historical data (0-1) */
  historicalData: number;
}

/**
 * Complexity analysis result
 */
export interface ComplexityAnalysisResult {
  /** Overall complexity score (1-10) */
  score: number;
  /** Effort estimation in hours */
  estimatedHours: number;
  /** Breakdown of complexity factors */
  factors: ComplexityFactors;
  /** Risk assessment details */
  riskAssessment: RiskAssessment;
  /** Dependencies found during analysis */
  dependencies: FileDependency[];
  /** Estimated lines of code */
  estimatedLinesOfCode: number;
  /** Confidence level (0-1) */
  confidence: number;
  /** Analysis metadata */
  metadata: {
    analysisTime: string;
    version: string;
    options: ComplexityAnalysisOptions;
  };
}

/**
 * Complexity factor breakdown
 */
export interface ComplexityFactors {
  /** Code volume score (0-1) */
  codeVolume: number;
  /** Dependencies score (0-1) */
  dependencies: number;
  /** Technical risk score (0-1) */
  technicalRisk: number;
  /** Historical data score (0-1) */
  historicalData: number;
  /** Individual factor scores */
  details: {
    linesOfCode: number;
    fileCount: number;
    importCount: number;
    externalDependencies: number;
    newTechnologies: string[];
    riskFactors: string[];
  };
}

/**
 * Risk assessment details
 */
export interface RiskAssessment {
  /** Overall risk level */
  level: 'low' | 'medium' | 'high' | 'critical';
  /** Risk factors identified */
  factors: RiskFactor[];
  /** Mitigation suggestions */
  mitigations: string[];
  /** Technical debt indicators */
  technicalDebt: TechnicalDebt[];
}

/**
 * Individual risk factor
 */
export interface RiskFactor {
  /** Risk category */
  category: 'technology' | 'architecture' | 'integration' | 'maintenance' | 'performance';
  /** Risk description */
  description: string;
  /** Risk impact (0-1) */
  impact: number;
  /** Risk probability (0-1) */
  probability: number;
  /** Mitigation priority */
  priority: 'low' | 'medium' | 'high';
}

/**
 * Technical debt indicator
 */
export interface TechnicalDebt {
  /** Debt type */
  type: string;
  /** Description of debt */
  description: string;
  /** Estimated remediation effort */
  remediationEffort: number; // hours
  /** Priority level */
  priority: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * File dependency information
 */
export interface FileDependency {
  /** Path to dependent file */
  path: string;
  /** Type of dependency */
  type: 'import' | 'require' | 'reference' | 'config';
  /** Dependency strength (0-1) */
  strength: number;
  /** External dependency flag */
  external: boolean;
}

/**
 * Task interface for complexity analysis
 */
export interface TaskForAnalysis {
  /** Task ID */
  id: number;
  /** Task title */
  title: string;
  /** Task description */
  description?: string;
  /** Task tags for categorization */
  tags: string[];
  /** Associated programming language */
  code_language?: string;
  /** Task dependencies */
  dependencies: number[];
  /** Existing code or implementation details */
  code_content?: string;
  /** File paths related to the task */
  file_paths?: string[];
}

/**
 * Default complexity weights
 */
const DEFAULT_WEIGHTS: ComplexityWeights = {
  codeVolume: 0.35,
  dependencies: 0.25,
  technicalRisk: 0.25,
  historicalData: 0.15,
};

/**
 * Technology risk database
 */
const TECHNOLOGY_RISK_DB = {
  'typescript': { risk: 0.1, experience: 'common' },
  'javascript': { risk: 0.1, experience: 'common' },
  'python': { risk: 0.1, experience: 'common' },
  'react': { risk: 0.2, experience: 'intermediate' },
  'vue': { risk: 0.2, experience: 'intermediate' },
  'angular': { risk: 0.3, experience: 'advanced' },
  'node.js': { risk: 0.15, experience: 'intermediate' },
  'express': { risk: 0.15, experience: 'intermediate' },
  'graphql': { risk: 0.35, experience: 'advanced' },
  'docker': { risk: 0.25, experience: 'intermediate' },
  'kubernetes': { risk: 0.4, experience: 'expert' },
  'machine-learning': { risk: 0.5, experience: 'expert' },
  'blockchain': { risk: 0.6, experience: 'expert' },
  'webassembly': { risk: 0.45, experience: 'expert' },
  'microservices': { risk: 0.3, experience: 'advanced' },
  'serverless': { risk: 0.25, experience: 'intermediate' },
};

/**
 * Complexity Analyzer Class
 */
export class ComplexityAnalyzer {
  private historicalData: Map<string, number[]> = new Map();
  private projectRoot: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
  }

  /**
   * Analyze complexity of a task
   * 
   * @param taskId Task ID to analyze
   * @param options Analysis options
   * @returns Complexity analysis result
   */
  async analyzeComplexity(taskId: number, options: ComplexityAnalysisOptions = {}): Promise<ComplexityAnalysisResult> {
    const startTime = Date.now();
    
    try {
      // Load task data (this would integrate with your database)
      const task = await this.getTaskForAnalysis(taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      // Set default options
      const analysisOptions: ComplexityAnalysisOptions = {
        analyzeDependencies: true,
        estimateCodeVolume: true,
        assessRisk: true,
        useHistoricalData: true,
        weights: DEFAULT_WEIGHTS,
        projectRoot: this.projectRoot,
        ...options,
      };

      // Perform analysis
      const factors = await this.analyzeComplexityFactors(task, analysisOptions);
      const score = this.calculateOverallScore(factors, analysisOptions.weights!);
      const estimatedHours = this.estimateEffort(score, factors);
      const riskAssessment = this.assessRisk(factors, task);
      const confidence = this.calculateConfidence(factors, analysisOptions);

      const result: ComplexityAnalysisResult = {
        score: Math.round(score * 10) / 10, // Round to 1 decimal
        estimatedHours,
        factors,
        riskAssessment,
        dependencies: factors.details.importCount > 0 ? await this.analyzeDependencies(task) : [],
        estimatedLinesOfCode: factors.details.linesOfCode,
        confidence,
        metadata: {
          analysisTime: new Date().toISOString(),
          version: '1.0.0',
          options: analysisOptions,
        },
      };

      return result;
    } catch (error) {
      throw new Error(`Complexity analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get task data for analysis (placeholder - integrate with your database)
   */
  private async getTaskForAnalysis(taskId: number): Promise<TaskForAnalysis | null> {
    // This is a placeholder - in real implementation, this would fetch from your database
    // For now, return a mock task structure
    return {
      id: taskId,
      title: `Task ${taskId}`,
      description: 'Sample task for complexity analysis',
      tags: ['development'],
      code_language: 'typescript',
      dependencies: [],
    };
  }

  /**
   * Analyze complexity factors
   */
  private async analyzeComplexityFactors(task: TaskForAnalysis, options: ComplexityAnalysisOptions): Promise<ComplexityFactors> {
    const details = {
      linesOfCode: 0,
      fileCount: 0,
      importCount: 0,
      externalDependencies: 0,
      newTechnologies: [] as string[],
      riskFactors: [] as string[],
    };

    // Code volume analysis
    if (options.estimateCodeVolume) {
      const codeAnalysis = await this.estimateCodeVolume(task);
      details.linesOfCode = codeAnalysis.linesOfCode;
      details.fileCount = codeAnalysis.fileCount;
      details.importCount = codeAnalysis.importCount;
      details.externalDependencies = codeAnalysis.externalDependencies;
    }

    // Dependencies analysis
    if (options.analyzeDependencies) {
      const depAnalysis = await this.analyzeDependencies(task);
      // Populate dependency-related details
    }

    // Technical risk assessment
    if (options.assessRisk) {
      const riskAnalysis = this.assessTechnicalRisk(task);
      details.newTechnologies = riskAnalysis.newTechnologies;
      details.riskFactors = riskAnalysis.riskFactors;
    }

    // Historical data correlation
    const historicalScore = options.useHistoricalData ? this.getHistoricalScore(task) : 0;

    return {
      codeVolume: this.normalizeCodeVolume(details.linesOfCode, details.fileCount),
      dependencies: this.normalizeDependencies(details.importCount, details.externalDependencies),
      technicalRisk: this.normalizeTechnicalRisk(details.newTechnologies, details.riskFactors),
      historicalData: historicalScore,
      details,
    };
  }

  /**
   * Estimate code volume for a task
   */
  private async estimateCodeVolume(task: TaskForAnalysis): Promise<{
    linesOfCode: number;
    fileCount: number;
    importCount: number;
    externalDependencies: number;
  }> {
    // Base estimation from description and tags
    let baseLines = 50; // Minimum for any task
    
    // Adjust based on description length and complexity
    if (task.description) {
      const descriptionWords = task.description.split(/\s+/).length;
      baseLines += Math.min(descriptionWords * 2, 200); // Max 200 additional lines
    }

    // Adjust based on tags
    const complexityTags = ['api', 'database', 'authentication', 'testing', 'deployment'];
    const tagComplexity = task.tags.filter(tag => complexityTags.includes(tag)).length;
    baseLines += tagComplexity * 25;

    // Language-specific adjustments
    if (task.code_language) {
      const languageMultipliers: Record<string, number> = {
        typescript: 1.2,
        javascript: 1.0,
        python: 0.8,
        bash: 0.5,
        sql: 0.6,
      };
      baseLines *= languageMultipliers[task.code_language] || 1.0;
    }

    // Simulate file analysis
    const estimatedFiles = Math.ceil(baseLines / 200); // Average 200 lines per file
    const estimatedImports = Math.ceil(baseLines / 20); // Rough import ratio
    const externalDeps = Math.ceil(estimatedImports / 3); // ~1/3 are external

    return {
      linesOfCode: Math.round(baseLines),
      fileCount: estimatedFiles,
      importCount: estimatedImports,
      externalDependencies: externalDeps,
    };
  }

  /**
   * Analyze file dependencies
   */
  private async analyzeDependencies(task: TaskForAnalysis): Promise<FileDependency[]> {
    const dependencies: FileDependency[] = [];
    
    // Look for actual files if paths are provided
    if (task.file_paths) {
      for (const filePath of task.file_paths) {
        const fullPath = resolve(this.projectRoot, filePath);
        if (existsSync(fullPath)) {
          try {
            const content = readFileSync(fullPath, 'utf8');
            const fileDeps = this.parseFileDependencies(content, filePath);
            dependencies.push(...fileDeps);
          } catch (error) {
            // Skip files that can't be read
            continue;
          }
        }
      }
    }

    // If no file paths, simulate common dependencies based on language and tags
    if (dependencies.length === 0) {
      dependencies.push(...this.simulateDependencies(task));
    }

    return dependencies;
  }

  /**
   * Parse dependencies from file content
   */
  private parseFileDependencies(content: string, filePath: string): FileDependency[] {
    const dependencies: FileDependency[] = [];
    const lines = content.split('\n');

    // JavaScript/TypeScript imports
    const importRegex = /(?:import|require)\s+['"]([^'"]+)['"]/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      const depPath = match[1];
      const isExternal = !depPath.startsWith('.') && !depPath.startsWith('/');
      
      dependencies.push({
        path: depPath,
        type: match[0].startsWith('import') ? 'import' : 'require',
        strength: 1.0,
        external: isExternal,
      });
    }

    // Config file references
    if (filePath.endsWith('.json')) {
      try {
        const config = JSON.parse(content);
        const configDeps = this.extractConfigDependencies(config, filePath);
        dependencies.push(...configDeps);
      } catch (error) {
        // Invalid JSON, skip
      }
    }

    return dependencies;
  }

  /**
   * Extract dependencies from config files
   */
  private extractConfigDependencies(config: any, filePath: string): FileDependency[] {
    const dependencies: FileDependency[] = [];
    
    if (filePath.includes('package.json')) {
      // Extract npm dependencies
      const deps = { ...config.dependencies, ...config.devDependencies };
      for (const depName of Object.keys(deps)) {
        dependencies.push({
          path: depName,
          type: 'config',
          strength: 0.8,
          external: true,
        });
      }
    }

    return dependencies;
  }

  /**
   * Simulate dependencies when no files are available
   */
  private simulateDependencies(task: TaskForAnalysis): FileDependency[] {
    const dependencies: FileDependency[] = [];
    
    // Common framework dependencies based on language
    if (task.code_language === 'typescript' || task.code_language === 'javascript') {
      dependencies.push(
        { path: './utils', type: 'import', strength: 0.7, external: false },
        { path: './types', type: 'import', strength: 0.6, external: false },
      );

      // Add framework-specific dependencies based on tags
      if (task.tags.includes('api')) {
        dependencies.push({ path: 'express', type: 'import', strength: 0.9, external: true });
      }
      if (task.tags.includes('testing')) {
        dependencies.push({ path: 'jest', type: 'import', strength: 0.8, external: true });
      }
      if (task.tags.includes('database')) {
        dependencies.push({ path: 'sqlite3', type: 'import', strength: 0.8, external: true });
      }
    }

    return dependencies;
  }

  /**
   * Assess technical risk factors
   */
  private assessTechnicalRisk(task: TaskForAnalysis): {
    newTechnologies: string[];
    riskFactors: string[];
  } {
    const newTechnologies: string[] = [];
    const riskFactors: string[] = [];

    // Check for new technologies in tags
    for (const tag of task.tags) {
      const tech = tag.toLowerCase();
      if (TECHNOLOGY_RISK_DB[tech as keyof typeof TECHNOLOGY_RISK_DB]) {
        newTechnologies.push(tech);
      }
    }

    // Language-specific risks
    if (task.code_language) {
      const lang = task.code_language.toLowerCase();
      if (lang === 'typescript') {
        riskFactors.push('Type safety maintenance');
      }
      if (lang === 'python') {
        riskFactors.push('Dependency management');
      }
    }

    // Complexity indicators from description
    if (task.description) {
      const desc = task.description.toLowerCase();
      if (desc.includes('integration') || desc.includes('api')) {
        riskFactors.push('External integration complexity');
      }
      if (desc.includes('security') || desc.includes('auth')) {
        riskFactors.push('Security implementation complexity');
      }
      if (desc.includes('performance') || desc.includes('optimization')) {
        riskFactors.push('Performance optimization challenges');
      }
    }

    return { newTechnologies, riskFactors };
  }

  /**
   * Get historical score for similar tasks
   */
  private getHistoricalScore(task: TaskForAnalysis): number {
    const key = this.getTaskCategoryKey(task);
    const historicalScores = this.historicalData.get(key) || [];
    
    if (historicalScores.length === 0) {
      return 0.5; // Neutral score when no historical data
    }

    // Return average of similar task complexities
    const average = historicalScores.reduce((sum, score) => sum + score, 0) / historicalScores.length;
    return average;
  }

  /**
   * Get category key for historical data matching
   */
  private getTaskCategoryKey(task: TaskForAnalysis): string {
    return `${task.code_language || 'unknown'}_${task.tags.sort().join('_')}`;
  }

  /**
   * Normalize code volume score
   */
  private normalizeCodeVolume(linesOfCode: number, fileCount: number): number {
    // Score based on lines of code (0-1 scale)
    let score = 0;
    
    if (linesOfCode <= 100) score = 0.1;
    else if (linesOfCode <= 500) score = 0.3;
    else if (linesOfCode <= 1000) score = 0.5;
    else if (linesOfCode <= 2000) score = 0.7;
    else if (linesOfCode <= 5000) score = 0.9;
    else score = 1.0;

    // Adjust for file count
    const filePenalty = Math.max(0, (fileCount - 5) * 0.05);
    return Math.min(1.0, score + filePenalty);
  }

  /**
   * Normalize dependencies score
   */
  private normalizeDependencies(importCount: number, _externalDeps: number): number {
    const totalImports = importCount;
    if (totalImports <= 5) return 0.1;
    if (totalImports <= 15) return 0.3;
    if (totalImports <= 30) return 0.5;
    if (totalImports <= 50) return 0.7;
    if (totalImports <= 100) return 0.9;
    return 1.0;
  }

  /**
   * Normalize technical risk score
   */
  private normalizeTechnicalRisk(newTechnologies: string[], riskFactors: string[]): number {
    let riskScore = 0;

    // Technology risk
    for (const tech of newTechnologies) {
      const techInfo = TECHNOLOGY_RISK_DB[tech as keyof typeof TECHNOLOGY_RISK_DB];
      if (techInfo) {
        riskScore += techInfo.risk;
      }
    }

    // Risk factors from description and tags
    riskScore += riskFactors.length * 0.1;

    return Math.min(1.0, riskScore);
  }

  /**
   * Calculate overall complexity score
   */
  private calculateOverallScore(factors: ComplexityFactors, weights: ComplexityWeights): number {
    return (
      factors.codeVolume * weights.codeVolume +
      factors.dependencies * weights.dependencies +
      factors.technicalRisk * weights.technicalRisk +
      factors.historicalData * weights.historicalData
    ) * 10; // Convert to 1-10 scale
  }

  /**
   * Estimate effort in hours based on complexity score
   */
  private estimateEffort(score: number, factors: ComplexityFactors): number {
    // Base effort estimation formula
    const baseHours = 8; // Minimum 8 hours
    
    // Scale with complexity
    const complexityMultiplier = score / 5; // Normalize around complexity 5
    let estimatedHours = baseHours * complexityMultiplier;

    // Adjust for dependencies
    if (factors.details.externalDependencies > 5) {
      estimatedHours *= 1.2; // 20% more for many external dependencies
    }

    // Adjust for new technologies
    if (factors.details.newTechnologies.length > 0) {
      estimatedHours *= 1.1; // 10% more for new tech learning curve
    }

    return Math.round(estimatedHours);
  }

  /**
   * Perform comprehensive risk assessment
   */
  private assessRisk(factors: ComplexityFactors, task: TaskForAnalysis): RiskAssessment {
    const riskFactors: RiskFactor[] = [];

    // Technical risk factors
    factors.details.newTechnologies.forEach(tech => {
      const techInfo = TECHNOLOGY_RISK_DB[tech as keyof typeof TECHNOLOGY_RISK_DB];
      if (techInfo) {
        riskFactors.push({
          category: 'technology',
          description: `Using ${tech} technology`,
          impact: techInfo.risk,
          probability: 0.7,
          priority: techInfo.risk > 0.4 ? 'high' : techInfo.risk > 0.2 ? 'medium' : 'low',
        });
      }
    });

    // Dependency risk factors
    if (factors.details.externalDependencies > 10) {
      riskFactors.push({
        category: 'integration',
        description: `High number of external dependencies (${factors.details.externalDependencies})`,
        impact: 0.3,
        probability: 0.6,
        priority: 'medium',
      });
    }

    // Architecture risk factors
    if (factors.details.fileCount > 10) {
      riskFactors.push({
        category: 'architecture',
        description: `Large number of files (${factors.details.fileCount}) increases complexity`,
        impact: 0.2,
        probability: 0.8,
        priority: 'medium',
      });
    }

    // Determine overall risk level
    const highRiskFactors = riskFactors.filter(rf => rf.priority === 'high');
    const mediumRiskFactors = riskFactors.filter(rf => rf.priority === 'medium');
    
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (highRiskFactors.length > 2) riskLevel = 'critical';
    else if (highRiskFactors.length > 0 || mediumRiskFactors.length > 3) riskLevel = 'high';
    else if (mediumRiskFactors.length > 0) riskLevel = 'medium';
    else riskLevel = 'low';

    // Generate mitigation suggestions
    const mitigations = this.generateMitigations(riskFactors);

    // Technical debt assessment
    const technicalDebt = this.assessTechnicalDebt(factors, task);

    return {
      level: riskLevel,
      factors: riskFactors,
      mitigations,
      technicalDebt,
    };
  }

  /**
   * Generate risk mitigation suggestions
   */
  private generateMitigations(riskFactors: RiskFactor[]): string[] {
    const mitigations: string[] = [];

    riskFactors.forEach(rf => {
      switch (rf.category) {
        case 'technology':
          mitigations.push(`Allocate time for ${rf.description.toLowerCase()} learning and documentation`);
          break;
        case 'integration':
          mitigations.push('Use dependency injection and comprehensive testing for external integrations');
          break;
        case 'architecture':
          mitigations.push('Consider refactoring to reduce file count and improve modularity');
          break;
        case 'maintenance':
          mitigations.push('Implement comprehensive logging and monitoring');
          break;
        case 'performance':
          mitigations.push('Profile code early and implement performance testing');
          break;
      }
    });

    // Add general mitigations
    mitigations.push('Implement incremental development with regular testing');
    mitigations.push('Set up continuous integration and automated testing');
    mitigations.push('Document architecture decisions and trade-offs');

    return [...new Set(mitigations)]; // Remove duplicates
  }

  /**
   * Assess technical debt
   */
  private assessTechnicalDebt(factors: ComplexityFactors, task: TaskForAnalysis): TechnicalDebt[] {
    const technicalDebt: TechnicalDebt[] = [];

    // Code complexity debt
    if (factors.details.linesOfCode > 1000) {
      technicalDebt.push({
        type: 'Code Complexity',
        description: 'Large code volume may indicate need for refactoring',
        remediationEffort: Math.ceil(factors.details.linesOfCode / 100),
        priority: factors.details.linesOfCode > 2000 ? 'high' : 'medium',
      });
    }

    // Missing tests debt
    if (!task.tags.includes('testing') && factors.details.linesOfCode > 100) {
      technicalDebt.push({
        type: 'Missing Tests',
        description: 'No testing strategy identified for substantial code',
        remediationEffort: Math.ceil(factors.details.linesOfCode / 50),
        priority: 'high',
      });
    }

    // Documentation debt
    if (!task.description || task.description.length < 50) {
      technicalDebt.push({
        type: 'Documentation',
        description: 'Insufficient task description and documentation',
        remediationEffort: 2,
        priority: 'medium',
      });
    }

    return technicalDebt;
  }

  /**
   * Calculate analysis confidence level
   */
  private calculateConfidence(factors: ComplexityFactors, options: ComplexityAnalysisOptions): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on available data
    if (options.estimateCodeVolume && factors.details.linesOfCode > 0) confidence += 0.2;
    if (options.analyzeDependencies && factors.details.importCount > 0) confidence += 0.2;
    if (options.assessRisk && factors.details.newTechnologies.length >= 0) confidence += 0.1;
    if (options.useHistoricalData && factors.historicalData > 0) confidence += 0.1;

    // Decrease confidence for very high complexity
    const overallComplexity = (factors.codeVolume + factors.dependencies + factors.technicalRisk) / 3;
    if (overallComplexity > 0.8) confidence -= 0.1;

    return Math.max(0.1, Math.min(1.0, confidence));
  }
}

/**
 * Estimate effort for a specific task ID
 * 
 * @param taskId Task ID to estimate effort for
 * @param options Analysis options
 * @returns Effort estimation in hours
 */
export async function estimateEffort(taskId: number, options?: ComplexityAnalysisOptions): Promise<number> {
  const analyzer = new ComplexityAnalyzer();
  const result = await analyzer.analyzeComplexity(taskId, options);
  return result.estimatedHours;
}

/**
 * Analyze complexity for a specific task ID
 * 
 * @param taskId Task ID to analyze
 * @param options Analysis options
 * @returns Complexity analysis result
 */
export async function analyzeComplexity(taskId: number, options?: ComplexityAnalysisOptions): Promise<ComplexityAnalysisResult> {
  const analyzer = new ComplexityAnalyzer();
  return analyzer.analyzeComplexity(taskId, options);
}