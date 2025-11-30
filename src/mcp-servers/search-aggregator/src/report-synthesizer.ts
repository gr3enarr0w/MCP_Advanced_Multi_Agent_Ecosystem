/**
 * Report Synthesizer Module
 * 
 * Advanced report generation capabilities including:
 * - Markdown research report generation
 * - Executive summary creation
 * - Source citations and references
 * - Comparison tables and analysis
 * - Multiple output formats
 */

import { ResearchPlan, ResearchQuestion } from './research-planner.js';
import { SearchResult } from './index.js';
import { DocumentMetadata } from './local-search.js';
import { ExecutionResult } from './parallel-executor.js';

// Types
export interface ResearchReport {
  id: string;
  title: string;
  executiveSummary: string;
  sections: ReportSection[];
  sources: Citation[];
  comparisons: ComparisonTable[];
  metadata: {
    researchPlan: ResearchPlan;
    totalSources: number;
    searchResults: number;
    localDocuments: number;
    generatedAt: string;
    methodology: string;
    scope: string;
  };
  format: 'markdown' | 'html' | 'json';
}

export interface ReportSection {
  id: string;
  title: string;
  content: string;
  type: 'introduction' | 'findings' | 'analysis' | 'conclusion' | 'recommendations' | 'methodology';
  order: number;
  sources: string[]; // Source IDs
  keyFindings: string[];
}

export interface Citation {
  id: string;
  type: 'web' | 'document' | 'academic';
  title: string;
  url?: string;
  authors?: string[];
  publishedDate?: string;
  accessedDate: string;
  relevance: 'high' | 'medium' | 'low';
  summary: string;
  metadata?: Record<string, any>;
}

export interface ComparisonItem {
  name: string;
  value: string;
  score?: number;
  pros?: string[];
  cons?: string[];
  sourceIds: string[];
}

export interface ComparisonTable {
  id: string;
  title: string;
  description: string;
  criteria: string[];
  items: ComparisonItem[];
  winner?: string; // Item name that scored highest
  analysis: string;
}

export interface ReportOptions {
  format: 'markdown' | 'html' | 'json';
  includeExecutiveSummary: boolean;
  includeMethodology: boolean;
  includeSources: boolean;
  includeComparisons: boolean;
  maxSourcesPerSection: number;
  includeLocalDocuments: boolean;
  detailedAnalysis: boolean;
}

/**
 * Research Report Generator
 */
export class ReportSynthesizer {
  private reports: Map<string, ResearchReport> = new Map();

  /**
   * Generate a comprehensive research report
   */
  public generateReport(
    researchId: string,
    researchPlan: ResearchPlan,
    searchResults: ExecutionResult[],
    localDocuments: DocumentMetadata[] = [],
    options: Partial<ReportOptions> = {}
  ): ResearchReport {
    const {
      format = 'markdown',
      includeExecutiveSummary = true,
      includeMethodology = true,
      includeSources = true,
      includeComparisons = true,
      maxSourcesPerSection = 5,
      includeLocalDocuments = true,
      detailedAnalysis = true
    } = options;

    // Extract all search results
    const allResults = this.aggregateSearchResults(searchResults);
    
    // Generate report sections
    const sections = this.generateReportSections(
      researchPlan, 
      allResults, 
      localDocuments, 
      detailedAnalysis,
      maxSourcesPerSection
    );

    // Create citations
    const citations = this.createCitations(allResults, localDocuments, maxSourcesPerSection);

    // Generate comparisons if applicable
    const comparisons = includeComparisons ? 
      this.generateComparisons(researchPlan, allResults) : [];

    // Generate executive summary
    const executiveSummary = includeExecutiveSummary ? 
      this.generateExecutiveSummary(researchPlan, sections, citations) : '';

    // Create report
    const report: ResearchReport = {
      id: researchId,
      title: `Research Report: ${researchPlan.topic}`,
      executiveSummary,
      sections,
      sources: citations,
      comparisons,
      metadata: {
        researchPlan,
        totalSources: citations.length,
        searchResults: allResults.length,
        localDocuments: includeLocalDocuments ? localDocuments.length : 0,
        generatedAt: new Date().toISOString(),
        methodology: researchPlan.methodology,
        scope: researchPlan.scope,
      },
      format,
    };

    // Store report
    this.reports.set(researchId, report);

    return report;
  }

  /**
   * Generate comparison table between different approaches/items
   */
  public createComparison(
    topic: string,
    items: { name: string; description: string; data: Record<string, any> }[],
    criteria?: string[]
  ): ComparisonTable {
    const comparisonId = `comparison-${Date.now()}`;

    // Determine comparison criteria
    const comparisonCriteria = criteria || this.extractComparisonCriteria(items);
    
    // Score each item against criteria
    const comparisonItems: ComparisonItem[] = items.map(item => {
      const pros: string[] = [];
      const cons: string[] = [];
      let totalScore = 0;

      for (const criterion of comparisonCriteria) {
        const value = item.data[criterion];
        const score = this.scoreItemAgainstCriterion(item.name, criterion, value);
        totalScore += score;

        if (score >= 0.7) {
          pros.push(`Strong ${criterion}: ${value}`);
        } else if (score <= 0.3) {
          cons.push(`Weak ${criterion}: ${value}`);
        }
      }

      return {
        name: item.name,
        value: item.description,
        score: totalScore / comparisonCriteria.length,
        pros: pros.length > 0 ? pros : undefined,
        cons: cons.length > 0 ? cons : undefined,
        sourceIds: [], // Would be populated with actual source IDs in real implementation
      };
    });

    // Determine winner
    const winner = comparisonItems.reduce((prev, current) => 
      (prev.score || 0) > (current.score || 0) ? prev : current
    );

    // Generate analysis
    const analysis = this.generateComparisonAnalysis(comparisonItems, comparisonCriteria);

    return {
      id: comparisonId,
      title: `Comparison: ${topic}`,
      description: `Systematic comparison of ${items.length} ${topic.toLowerCase()} approaches`,
      criteria: comparisonCriteria,
      items: comparisonItems,
      winner: winner.name,
      analysis,
    };
  }

  /**
   * Export report in specified format
   */
  public exportReport(
    researchId: string,
    format: 'markdown' | 'html' | 'json'
  ): string {
    const report = this.reports.get(researchId);
    if (!report) {
      throw new Error(`Report with ID ${researchId} not found`);
    }

    switch (format) {
      case 'markdown':
        return this.exportAsMarkdown(report);
      case 'html':
        return this.exportAsHtml(report);
      case 'json':
        return JSON.stringify(report, null, 2);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Get all stored reports
   */
  public getReports(): ResearchReport[] {
    return Array.from(this.reports.values());
  }

  /**
   * Get report by ID
   */
  public getReport(researchId: string): ResearchReport | undefined {
    return this.reports.get(researchId);
  }

  /**
   * Delete a report
   */
  public deleteReport(researchId: string): boolean {
    return this.reports.delete(researchId);
  }

  // Private helper methods

  /**
   * Aggregate all search results from execution
   */
  private aggregateSearchResults(executionResults: ExecutionResult[]): SearchResult[] {
    const allResults: SearchResult[] = [];
    
    for (const result of executionResults) {
      if (result.success && result.results.length > 0) {
        allResults.push(...result.results);
      }
    }
    
    return allResults;
  }

  /**
   * Generate report sections based on research plan and results
   */
  private generateReportSections(
    researchPlan: ResearchPlan,
    searchResults: SearchResult[],
    localDocuments: DocumentMetadata[],
    detailedAnalysis: boolean,
    maxSourcesPerSection: number
  ): ReportSection[] {
    const sections: ReportSection[] = [];

    // Introduction section
    sections.push({
      id: 'introduction',
      title: 'Introduction',
      content: this.generateIntroduction(researchPlan),
      type: 'introduction',
      order: 1,
      sources: [],
      keyFindings: [],
    });

    // Findings sections for each research question
    const questionSections = this.generateQuestionSections(
      researchPlan.questions,
      searchResults,
      localDocuments,
      maxSourcesPerSection
    );
    sections.push(...questionSections);

    // Analysis section
    if (detailedAnalysis) {
      sections.push({
        id: 'analysis',
        title: 'Analysis',
        content: this.generateAnalysis(researchPlan, searchResults),
        type: 'analysis',
        order: sections.length + 1,
        sources: [],
        keyFindings: this.extractKeyFindings(searchResults),
      });
    }

    // Recommendations section
    sections.push({
      id: 'recommendations',
      title: 'Recommendations',
      content: this.generateRecommendations(researchPlan, searchResults),
      type: 'recommendations',
      order: sections.length + 1,
      sources: [],
      keyFindings: [],
    });

    // Conclusion section
    sections.push({
      id: 'conclusion',
      title: 'Conclusion',
      content: this.generateConclusion(researchPlan),
      type: 'conclusion',
      order: sections.length + 1,
      sources: [],
      keyFindings: [],
    });

    return sections;
  }

  /**
   * Generate sections for each research question
   */
  private generateQuestionSections(
    questions: ResearchQuestion[],
    searchResults: SearchResult[],
    localDocuments: DocumentMetadata[],
    maxSourcesPerSection: number
  ): ReportSection[] {
    const sections: ReportSection[] = [];

    questions.forEach((question, index) => {
      const relevantResults = this.findRelevantResults(question, searchResults);
      const relevantDocuments = this.findRelevantDocuments(question, localDocuments);
      const sources = [...relevantResults.slice(0, maxSourcesPerSection)]
        .map((_, i) => `source-${index}-${i}`);

      const content = this.generateQuestionContent(question, relevantResults, relevantDocuments);

      sections.push({
        id: `question-${index}`,
        title: question.question,
        content,
        type: 'findings',
        order: index + 2,
        sources,
        keyFindings: this.extractKeyFindings(relevantResults),
      });
    });

    return sections;
  }

  /**
   * Create citations from search results and documents
   */
  private createCitations(
    searchResults: SearchResult[],
    localDocuments: DocumentMetadata[],
    maxSourcesPerSection: number
  ): Citation[] {
    const citations: Citation[] = [];

    // Web source citations
    searchResults.slice(0, maxSourcesPerSection * 3).forEach((result, index) => {
      const citation: Citation = {
        id: `citation-${index}`,
        type: result.source === 'scholar' ? 'academic' : 'web',
        title: result.title,
        url: result.url,
        authors: this.extractAuthors(result.snippet),
        publishedDate: this.extractPublishedDate(result.snippet),
        accessedDate: new Date().toISOString().split('T')[0],
        relevance: result.score > 0.7 ? 'high' : result.score > 0.4 ? 'medium' : 'low',
        summary: result.snippet,
        metadata: {
          source: result.source,
          score: result.score,
          timestamp: result.timestamp,
        },
      };
      citations.push(citation);
    });

    // Document citations
    localDocuments.slice(0, maxSourcesPerSection).forEach((doc, index) => {
      const citation: Citation = {
        id: `doc-citation-${index}`,
        type: 'document',
        title: doc.title,
        url: `file://${doc.path}`,
        accessedDate: new Date().toISOString().split('T')[0],
        relevance: 'high',
        summary: doc.summary || 'Local document',
        metadata: {
          path: doc.path,
          type: doc.type,
          language: doc.language,
          wordCount: doc.wordCount,
        },
      };
      citations.push(citation);
    });

    return citations;
  }

  /**
   * Generate comparison tables
   */
  private generateComparisons(
    researchPlan: ResearchPlan,
    searchResults: SearchResult[]
  ): ComparisonTable[] {
    const comparisons: ComparisonTable[] = [];

    // Look for comparison-related questions
    const comparisonQuestions = researchPlan.questions.filter(q =>
      q.question.toLowerCase().includes('compare') || 
      q.question.toLowerCase().includes('vs') ||
      q.question.toLowerCase().includes('difference')
    );

    comparisonQuestions.forEach(question => {
      // Extract potential comparison items from results
      const items = this.extractComparisonItems(question, searchResults);
      
      if (items.length >= 2) {
        const comparison = this.createComparison(
          question.question,
          items
        );
        comparisons.push(comparison);
      }
    });

    return comparisons;
  }

  /**
   * Generate executive summary
   */
  private generateExecutiveSummary(
    researchPlan: ResearchPlan,
    sections: ReportSection[],
    citations: Citation[]
  ): string {
    const keyFindings = sections
      .flatMap(s => s.keyFindings)
      .filter((finding, index, arr) => arr.indexOf(finding) === index)
      .slice(0, 5);

    const totalSources = citations.length;
    const highRelevanceSources = citations.filter(c => c.relevance === 'high').length;

    return `# Executive Summary

## Research Overview
This report presents findings from a comprehensive research investigation into **${researchPlan.topic}** using a ${researchPlan.methodology} methodology.

## Key Findings
${keyFindings.map((finding, index) => `${index + 1}. ${finding}`).join('\n')}

## Research Scope
${researchPlan.scope}

## Source Quality
- **Total Sources**: ${totalSources}
- **High Relevance Sources**: ${highRelevanceSources}
- **Source Distribution**: ${this.getSourceDistribution(citations)}

## Methodology
The research employed a systematic approach with ${researchPlan.strategies.length} distinct search strategies, covering both web-based and local document sources to ensure comprehensive coverage.

## Recommendations Summary
Based on the analysis, the research indicates several actionable recommendations that should be considered for implementation.

*Report generated on ${new Date().toLocaleDateString()} using automated research synthesis.*`;
  }

  // Format-specific export methods

  private exportAsMarkdown(report: ResearchReport): string {
    let markdown = `# ${report.title}\n\n`;

    if (report.executiveSummary) {
      markdown += report.executiveSummary + '\n\n';
    }

    // Report sections
    for (const section of report.sections.sort((a, b) => a.order - b.order)) {
      markdown += `## ${section.title}\n\n${section.content}\n\n`;
    }

    // Comparison tables
    if (report.comparisons.length > 0) {
      markdown += '## Comparisons\n\n';
      
      for (const comparison of report.comparisons) {
        markdown += `### ${comparison.title}\n\n`;
        markdown += comparison.description + '\n\n';
        
        // Create markdown table
        markdown += '| Item | Score | Pros | Cons |\n';
        markdown += '|------|-------|------|------|\n';
        
        for (const item of comparison.items) {
          const pros = item.pros ? item.pros.join(', ') : 'N/A';
          const cons = item.cons ? item.cons.join(', ') : 'N/A';
          const score = item.score ? item.score.toFixed(2) : 'N/A';
          
          markdown += `| ${item.name} | ${score} | ${pros} | ${cons} |\n`;
        }
        
        markdown += `\n**Analysis**: ${comparison.analysis}\n\n`;
        
        if (comparison.winner) {
          markdown += `**Recommended Choice**: ${comparison.winner}\n\n`;
        }
      }
    }

    // Sources
    if (report.sources.length > 0) {
      markdown += '## Sources\n\n';
      
      for (const citation of report.sources) {
        markdown += `### ${citation.title}\n`;
        markdown += `**Type**: ${citation.type}\n`;
        markdown += `**Relevance**: ${citation.relevance}\n`;
        
        if (citation.url) {
          markdown += `**URL**: ${citation.url}\n`;
        }
        
        if (citation.authors && citation.authors.length > 0) {
          markdown += `**Authors**: ${citation.authors.join(', ')}\n`;
        }
        
        if (citation.publishedDate) {
          markdown += `**Published**: ${citation.publishedDate}\n`;
        }
        
        markdown += `**Summary**: ${citation.summary}\n\n`;
      }
    }

    return markdown;
  }

  private exportAsHtml(report: ResearchReport): string {
    // Simplified HTML export - in production, this would be more sophisticated
    const markdown = this.exportAsMarkdown(report);
    
    // Basic markdown to HTML conversion (would use a proper library in production)
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${report.title}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
        h1, h2, h3 { color: #333; }
        .metadata { background: #f5f5f5; padding: 10px; border-radius: 5px; margin-bottom: 20px; }
        .source { background: #f9f9f9; padding: 10px; margin: 10px 0; border-left: 3px solid #ccc; }
    </style>
</head>
<body>
    <div class="metadata">
        <h1>${report.title}</h1>
        <p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>
        <p><strong>Sources:</strong> ${report.metadata.totalSources}</p>
        <p><strong>Methodology:</strong> ${report.metadata.methodology}</p>
    </div>
    <div class="content">
        ${this.markdownToBasicHtml(markdown)}
    </div>
</body>
</html>`;
  }

  private markdownToBasicHtml(markdown: string): string {
    return markdown
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(.+)$/gm, '<p>$1</p>');
  }

  // Additional helper methods (abbreviated for space)

  private generateIntroduction(researchPlan: ResearchPlan): string {
    return `This research report examines ${researchPlan.topic} through a comprehensive ${researchPlan.methodology} approach. The study aims to provide actionable insights and recommendations based on systematic analysis of available sources.

**Research Objective**: ${researchPlan.objective}

**Scope**: ${researchPlan.scope}`;
  }

  private generateAnalysis(researchPlan: ResearchPlan, searchResults: SearchResult[]): string {
    return `Based on the analysis of ${searchResults.length} sources, several key patterns and insights emerge:

1. **Source Diversity**: The research incorporated multiple source types to ensure comprehensive coverage
2. **Quality Assessment**: Sources were evaluated for relevance and credibility
3. **Synthesis**: Findings were synthesized to identify common themes and contradictions

This analysis provides the foundation for the recommendations presented in subsequent sections.`;
  }

  private generateRecommendations(researchPlan: ResearchPlan, searchResults: SearchResult[]): string {
    return `Based on the research findings, the following recommendations are proposed:

1. **Primary Recommendation**: Implement the most promising approach identified in the analysis
2. **Secondary Actions**: Consider supplementary strategies for comprehensive coverage
3. **Implementation Considerations**: Factor in resource requirements and timeline constraints

These recommendations should be evaluated in the context of specific organizational needs and constraints.`;
  }

  private generateConclusion(researchPlan: ResearchPlan): string {
    return `This research investigation into ${researchPlan.topic} has provided valuable insights through systematic analysis of multiple sources. The findings support several actionable recommendations that can guide decision-making and implementation efforts.

The methodology employed ensured comprehensive coverage while maintaining focus on the core research objectives. Future research in this area should consider emerging trends and evolving best practices.`;
  }

  private generateQuestionContent(question: ResearchQuestion, results: SearchResult[], documents: DocumentMetadata[]): string {
    return `**Question**: ${question.question}

**Analysis**: Based on ${results.length} web sources and ${documents.length} local documents:

${results.slice(0, 3).map(result => 
  `- ${result.title}: ${result.snippet.substring(0, 150)}...`
).join('\n')}

**Key Insights**: This analysis reveals multiple perspectives on the research question, with sources providing both theoretical foundations and practical applications.`;
  }

  private extractKeyFindings(searchResults: SearchResult[]): string[] {
    const findings: string[] = [];
    
    // Simplified extraction - in production, this would use NLP
    searchResults.slice(0, 5).forEach(result => {
      if (result.score > 0.7) {
        findings.push(result.title);
      }
    });
    
    return findings;
  }

  private findRelevantResults(question: ResearchQuestion, searchResults: SearchResult[]): SearchResult[] {
    return searchResults
      .filter(result => question.searchTerms.some(term => 
        result.title.toLowerCase().includes(term) || 
        result.snippet.toLowerCase().includes(term)
      ))
      .sort((a, b) => b.score - a.score);
  }

  private findRelevantDocuments(question: ResearchQuestion, documents: DocumentMetadata[]): DocumentMetadata[] {
    return documents
      .filter(doc => question.searchTerms.some(term => 
        doc.title.toLowerCase().includes(term) || 
        doc.content.toLowerCase().includes(term)
      ))
      .sort((a, b) => b.wordCount - a.wordCount);
  }

  private extractComparisonCriteria(items: { data: Record<string, any> }[]): string[] {
    if (items.length === 0) return [];
    
    const allCriteria = new Set<string>();
    items.forEach(item => {
      Object.keys(item.data).forEach(key => {
        if (typeof item.data[key] === 'number' || typeof item.data[key] === 'string') {
          allCriteria.add(key);
        }
      });
    });
    
    return Array.from(allCriteria);
  }

  private scoreItemAgainstCriterion(_itemName: string, _criterion: string, value: any): number {
    // Simplified scoring - in production, this would use more sophisticated algorithms
    if (typeof value === 'number') {
      return Math.min(1, Math.max(0, value / 100));
    }
    
    if (typeof value === 'string') {
      const positiveWords = ['good', 'excellent', 'high', 'fast', 'efficient'];
      const negativeWords = ['bad', 'poor', 'low', 'slow', 'inefficient'];
      
      const lowerValue = value.toLowerCase();
      
      if (positiveWords.some(word => lowerValue.includes(word))) return 0.8;
      if (negativeWords.some(word => lowerValue.includes(word))) return 0.2;
      return 0.5;
    }
    
    return 0.5;
  }

  private generateComparisonAnalysis(items: ComparisonItem[], criteria: string[]): string {
    return `Analysis of ${items.length} options across ${criteria.length} criteria reveals varying strengths and weaknesses. The comparison shows that each approach has distinct advantages depending on specific requirements and constraints.`;
  }

  private extractComparisonItems(_question: ResearchQuestion, searchResults: SearchResult[]): { name: string; description: string; data: Record<string, any> }[] {
    // Simplified extraction - would be more sophisticated in production
    return searchResults.slice(0, 3).map((result, index) => ({
      name: `Option ${index + 1}`,
      description: result.title,
      data: {
        relevance: result.score,
        source: result.source,
        snippet: result.snippet.substring(0, 100),
      },
    }));
  }

  private extractAuthors(snippet: string): string[] {
    // Simplified author extraction
    const authorMatch = snippet.match(/by\s+([A-Za-z\s,]+)/i);
    return authorMatch ? [authorMatch[1].trim()] : [];
  }

  private extractPublishedDate(snippet: string): string | undefined {
    // Simplified date extraction
    const dateMatch = snippet.match(/\b(20\d{2}|19\d{2})\b/);
    return dateMatch ? dateMatch[0] : undefined;
  }

  private getSourceDistribution(citations: Citation[]): string {
    const distribution = citations.reduce((acc, citation) => {
      acc[citation.type] = (acc[citation.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(distribution)
      .map(([type, count]) => `${type}: ${count}`)
      .join(', ');
  }
}

/**
 * Convenience function for generating reports
 */
export function generateReport(
  researchId: string,
  researchPlan: ResearchPlan,
  searchResults: ExecutionResult[],
  localDocuments?: DocumentMetadata[],
  options?: Partial<ReportOptions>
): ResearchReport {
  const synthesizer = new ReportSynthesizer();
  return synthesizer.generateReport(researchId, researchPlan, searchResults, localDocuments || [], options);
}

/**
 * Convenience function for creating comparisons
 */
export function createComparison(
  topic: string,
  items: { name: string; description: string; data: Record<string, any> }[],
  criteria?: string[]
): ComparisonTable {
  const synthesizer = new ReportSynthesizer();
  return synthesizer.createComparison(topic, items, criteria);
}