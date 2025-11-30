/**
 * Local Document Search Module
 * 
 * Advanced local document indexing and search capabilities including:
 * - PDF indexing using pdf-parse
 * - Markdown file processing
 * - Code file indexing with language detection
 * - Full-text search with relevance scoring
 * - Document metadata extraction
 */

import { promises as fs } from 'fs';
import { join, extname, basename } from 'path';
import { existsSync } from 'fs';
import mammoth from 'mammoth';

// Note: pdf-parse would be imported here but requires special handling for binary data
// import * as pdfParse from 'pdf-parse';

// Types
export interface DocumentMetadata {
  id: string;
  path: string;
  filename: string;
  title: string;
  content: string;
  type: 'pdf' | 'markdown' | 'code' | 'docx' | 'text';
  language?: string;
  size: number;
  lastModified: string;
  created: string;
  tags: string[];
  summary?: string;
  wordCount: number;
  hash: string;
}

export interface SearchResult {
  document: DocumentMetadata;
  score: number;
  matches: {
    field: 'title' | 'content' | 'summary';
    match: string;
    position: number;
  }[];
}

export interface SearchOptions {
  maxResults?: number;
  minScore?: number;
  searchIn?: ('title' | 'content' | 'summary')[];
  includeMetadata?: boolean;
  fuzzyMatch?: boolean;
}

export interface IndexStats {
  totalDocuments: number;
  totalWords: number;
  averageWordsPerDocument: number;
  documentTypes: Record<string, number>;
  lastIndexed: string;
  indexPath: string;
}

/**
 * Language detection utilities
 */
class LanguageDetector {
  private static readonly LANGUAGE_EXTENSIONS: Record<string, string[]> = {
    typescript: ['.ts', '.tsx'],
    javascript: ['.js', '.jsx'],
    python: ['.py'],
    java: ['.java'],
    csharp: ['.cs'],
    cpp: ['.cpp', '.cxx', '.cc'],
    c: ['.c'],
    go: ['.go'],
    rust: ['.rs'],
    php: ['.php'],
    ruby: ['.rb'],
    swift: ['.swift'],
    kotlin: ['.kt'],
    scala: ['.scala'],
    sql: ['.sql'],
    html: ['.html', '.htm'],
    css: ['.css'],
    scss: ['.scss', '.sass'],
    less: ['.less'],
    json: ['.json'],
    yaml: ['.yml', '.yaml'],
    xml: ['.xml'],
    shell: ['.sh', '.bash', '.zsh'],
    powershell: ['.ps1'],
    batch: ['.bat', '.cmd'],
    dockerfile: ['Dockerfile', '.dockerfile'],
    makefile: ['Makefile', 'makefile'],
    markdown: ['.md', '.markdown'],
    text: ['.txt', '.rtf'],
  };

  private static readonly LANGUAGE_KEYWORDS: Record<string, string[]> = {
    typescript: ['interface', 'type ', 'extends', 'implements', '=>'],
    javascript: ['function', 'const ', 'let ', 'var ', '=>'],
    python: ['def ', 'import ', 'from ', 'class ', 'if __name__'],
    java: ['public class', 'private ', 'public ', 'import ', 'package '],
    csharp: ['using ', 'namespace ', 'public class', 'private ', 'protected '],
    go: ['package ', 'import ', 'func ', 'type ', 'struct '],
    rust: ['fn ', 'use ', 'struct ', 'enum ', 'impl '],
    php: ['<?php', 'function ', 'class ', 'public ', 'private '],
  };

  /**
   * Detect programming language from file extension and content
   */
  public static detectLanguage(filepath: string, content: string): string {
    const ext = extname(filepath).toLowerCase();
    
    // Try extension-based detection first
    for (const [lang, extensions] of Object.entries(this.LANGUAGE_EXTENSIONS)) {
      if (extensions.includes(ext)) {
        return lang;
      }
    }

    // Fallback to content-based detection for ambiguous extensions
    const contentLower = content.toLowerCase();
    
    // Check for specific language keywords
    for (const [lang, keywords] of Object.entries(this.LANGUAGE_KEYWORDS)) {
      const keywordCount = keywords.filter(keyword => 
        contentLower.includes(keyword.toLowerCase())
      ).length;
      
      if (keywordCount >= 2) {
        return lang;
      }
    }

    // Default to text for unknown files
    return 'text';
  }

  /**
   * Get file type from extension
   */
  public static getFileType(filepath: string): DocumentMetadata['type'] {
    const ext = extname(filepath).toLowerCase();
    
    if (ext === '.pdf') return 'pdf';
    if (ext === '.md' || ext === '.markdown') return 'markdown';
    if (ext === '.docx') return 'docx';
    
    // Code files
    const codeExtensions = [
      '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cs', '.cpp', '.c', '.go',
      '.rs', '.php', '.rb', '.swift', '.kt', '.scala', '.sql', '.html', '.css',
      '.scss', '.sass', '.less', '.json', '.yml', '.yaml', '.xml', '.sh',
      '.bash', '.zsh', '.ps1', '.bat', '.cmd', 'Dockerfile', 'makefile'
    ];
    
    if (codeExtensions.includes(ext) || basename(filepath) === 'Dockerfile' || basename(filepath) === 'Makefile') {
      return 'code';
    }
    
    return 'text';
  }
}

/**
 * Content processing utilities
 */
class ContentProcessor {
  /**
   * Extract title from content based on file type
   */
  public static extractTitle(filepath: string, content: string, type: DocumentMetadata['type']): string {
    const filename = basename(filepath, extname(filepath));
    
    switch (type) {
      case 'markdown':
        const mdTitle = content.match(/^#\s+(.+)$/m);
        if (mdTitle) return mdTitle[1].trim();
        break;
      
      case 'text':
        // HTML files are treated as text in this implementation
        const htmlTitle = content.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (htmlTitle) return htmlTitle[1].trim();
        break;
      
      case 'code':
        // Try to find class/function names or file comments
        const lines = content.split('\n').slice(0, 20); // Check first 20 lines
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*')) {
            const commentTitle = trimmed.replace(/^[\/\*#]+/, '').trim();
            if (commentTitle.length > 5) return commentTitle;
          }
          
          const classMatch = trimmed.match(/(?:class|interface|struct)\s+(\w+)/);
          if (classMatch) return classMatch[1];
        }
        break;
    }
    
    return filename;
  }

  /**
   * Generate summary from content
   */
  public static generateSummary(content: string, maxLength: number = 200): string {
    // Clean content
    const cleanContent = content
      .replace(/\s+/g, ' ')
      .replace(/[#*`]/g, '')
      .trim();
    
    if (cleanContent.length <= maxLength) {
      return cleanContent;
    }
    
    // Find sentence boundary closest to max length
    const truncated = cleanContent.substring(0, maxLength);
    const lastSentence = truncated.lastIndexOf('.');
    const lastQuestion = truncated.lastIndexOf('?');
    const lastExclamation = truncated.lastIndexOf('!');
    
    const lastBoundary = Math.max(lastSentence, lastQuestion, lastExclamation);
    
    if (lastBoundary > maxLength * 0.5) {
      return truncated.substring(0, lastBoundary + 1);
    }
    
    return truncated + '...';
  }

  /**
   * Extract tags from content
   */
  public static extractTags(content: string, filepath: string): string[] {
    const tags = new Set<string>();
    
    // Add filename tags
    const filename = basename(filepath, extname(filepath));
    tags.add(filename.toLowerCase());
    
    // Add file type tags
    const type = LanguageDetector.getFileType(filepath);
    tags.add(type);
    
    // Add language tags
    const language = LanguageDetector.detectLanguage(filepath, content);
    if (language !== 'text') {
      tags.add(language);
    }
    
    // Extract content-based tags
    const words = content
      .toLowerCase()
      .match(/\b[a-z]{4,}\b/g) || [];
    
    // Common technical terms
    const techTerms = [
      'api', 'function', 'class', 'method', 'variable', 'constant',
      'interface', 'protocol', 'framework', 'library', 'package',
      'import', 'export', 'module', 'component', 'service',
      'database', 'server', 'client', 'application', 'system'
    ];
    
    const wordCount: Record<string, number> = {};
    for (const word of words) {
      if (techTerms.includes(word)) {
        wordCount[word] = (wordCount[word] || 0) + 1;
      }
    }
    
    // Add frequent technical terms
    Object.entries(wordCount)
      .filter(([, count]) => count >= 2)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .forEach(([word]) => tags.add(word));
    
    return Array.from(tags);
  }

  /**
   * Calculate word count
   */
  public static getWordCount(content: string): number {
    return (content.match(/\b\w+\b/g) || []).length;
  }
}

/**
 * Local Document Search Engine
 */
export class LocalDocumentSearch {
  private indexPath: string;
  private documents: Map<string, DocumentMetadata> = new Map();
  private invertedIndex: Map<string, Map<string, number>> = new Map(); // word -> documentId -> frequency

  constructor(indexPath: string = './search_index') {
    this.indexPath = indexPath;
  }

  /**
   * Initialize the search engine and load existing index
   */
  async initialize(): Promise<void> {
    try {
      // Create index directory if it doesn't exist
      if (!existsSync(this.indexPath)) {
        await fs.mkdir(this.indexPath, { recursive: true });
      }

      // Load existing index
      await this.loadIndex();
      
      console.log(`Local search engine initialized with ${this.documents.size} documents`);
    } catch (error) {
      console.error('Failed to initialize local search engine:', error);
      throw error;
    }
  }

  /**
   * Index a single document
   */
  async indexDocument(filepath: string): Promise<DocumentMetadata> {
    try {
      const content = await fs.readFile(filepath, 'utf-8');
      const stats = await fs.stat(filepath);
      
      const type = LanguageDetector.getFileType(filepath);
      const language = type === 'code' ? LanguageDetector.detectLanguage(filepath, content) : undefined;
      
      // Special handling for different file types
      let processedContent = content;
      
      if (type === 'pdf') {
        // PDF processing would require pdf-parse which needs binary data
        // For now, skip PDF processing as it requires different handling
        processedContent = '[PDF content - requires special processing]';
      } else if (type === 'docx') {
        // DOCX processing with mammoth
        try {
          const result = await mammoth.extractRawText({ path: filepath });
          processedContent = result.value;
        } catch (error) {
          console.warn(`Failed to process DOCX file ${filepath}:`, error);
          processedContent = '[DOCX content - processing failed]';
        }
      }

      const metadata: DocumentMetadata = {
        id: this.generateDocumentId(filepath),
        path: filepath,
        filename: basename(filepath),
        title: ContentProcessor.extractTitle(filepath, processedContent, type),
        content: processedContent,
        type,
        language,
        size: stats.size,
        lastModified: stats.mtime.toISOString(),
        created: stats.ctime.toISOString(),
        tags: ContentProcessor.extractTags(processedContent, filepath),
        summary: ContentProcessor.generateSummary(processedContent),
        wordCount: ContentProcessor.getWordCount(processedContent),
        hash: await this.generateContentHash(processedContent),
      };

      // Store document
      this.documents.set(metadata.id, metadata);
      
      // Update inverted index
      await this.updateInvertedIndex(metadata);
      
      return metadata;
    } catch (error) {
      console.error(`Failed to index document ${filepath}:`, error);
      throw error;
    }
  }

  /**
   * Index multiple documents from paths
   */
  async indexDocuments(paths: string[]): Promise<DocumentMetadata[]> {
    const results: DocumentMetadata[] = [];
    
    for (const path of paths) {
      try {
        const stat = await fs.stat(path);
        
        if (stat.isDirectory()) {
          // Recursively index directory
          const dirResults = await this.indexDirectory(path);
          results.push(...dirResults);
        } else if (stat.isFile()) {
          // Index single file
          const metadata = await this.indexDocument(path);
          results.push(metadata);
        }
      } catch (error) {
        console.warn(`Failed to process path ${path}:`, error);
      }
    }
    
    // Save updated index
    await this.saveIndex();
    
    console.log(`Indexed ${results.length} documents`);
    return results;
  }

  /**
   * Recursively index a directory
   */
  private async indexDirectory(dirPath: string): Promise<DocumentMetadata[]> {
    const results: DocumentMetadata[] = [];
    const allowedExtensions = [
      '.pdf', '.md', '.markdown', '.txt', '.rtf', '.docx',
      '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cs', '.cpp', '.c', '.go',
      '.rs', '.php', '.rb', '.swift', '.kt', '.scala', '.sql', '.html', '.css',
      '.scss', '.sass', '.less', '.json', '.yml', '.yaml', '.xml', '.sh',
      '.bash', '.zsh', '.ps1', '.bat', '.cmd'
    ];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          // Skip hidden directories and common build directories
          if (!entry.name.startsWith('.') && 
              !['node_modules', 'dist', 'build', 'target', '.git'].includes(entry.name)) {
            const dirResults = await this.indexDirectory(fullPath);
            results.push(...dirResults);
          }
        } else if (entry.isFile()) {
          // Check if file type is supported
          const ext = extname(entry.name).toLowerCase();
          if (allowedExtensions.includes(ext) || 
              entry.name === 'Dockerfile' || 
              entry.name === 'Makefile') {
            try {
              const metadata = await this.indexDocument(fullPath);
              results.push(metadata);
            } catch (error) {
              console.warn(`Failed to index ${fullPath}:`, error);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Failed to read directory ${dirPath}:`, error);
    }
    
    return results;
  }

  /**
   * Search documents by query
   */
  async searchLocalDocuments(
    query: string, 
    paths?: string[],
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const {
      maxResults = 20,
      minScore = 0.1,
      searchIn = ['title', 'content', 'summary'],
      includeMetadata = true,
      fuzzyMatch = true
    } = options;

    // Filter documents by paths if specified
    let searchableDocs = Array.from(this.documents.values());
    if (paths && paths.length > 0) {
      searchableDocs = searchableDocs.filter(doc => 
        paths.some(path => doc.path.startsWith(path))
      );
    }

    if (searchableDocs.length === 0) {
      return [];
    }

    // Process search terms
    const searchTerms = this.extractSearchTerms(query, fuzzyMatch);
    const results: SearchResult[] = [];

    for (const doc of searchableDocs) {
      const score = this.calculateRelevanceScore(doc, searchTerms, searchIn);
      
      if (score >= minScore) {
        const matches = this.findMatches(doc, searchTerms, searchIn);
        
        results.push({
          document: includeMetadata ? doc : { ...doc, content: '' },
          score,
          matches,
        });
      }
    }

    // Sort by score and limit results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }

  /**
   * Get index statistics
   */
  getIndexStats(): IndexStats {
    const docs = Array.from(this.documents.values());
    const totalWords = docs.reduce((sum, doc) => sum + doc.wordCount, 0);
    
    const documentTypes: Record<string, number> = {};
    docs.forEach(doc => {
      documentTypes[doc.type] = (documentTypes[doc.type] || 0) + 1;
    });

    return {
      totalDocuments: docs.length,
      totalWords,
      averageWordsPerDocument: docs.length > 0 ? totalWords / docs.length : 0,
      documentTypes,
      lastIndexed: new Date().toISOString(),
      indexPath: this.indexPath,
    };
  }

  /**
   * Clear the index
   */
  async clearIndex(): Promise<void> {
    this.documents.clear();
    this.invertedIndex.clear();
    
    try {
      await fs.rm(this.indexPath, { recursive: true, force: true });
      await fs.mkdir(this.indexPath, { recursive: true });
    } catch (error) {
      console.error('Failed to clear index:', error);
    }
  }

  // Private helper methods

  private generateDocumentId(filepath: string): string {
    // Simple hash-based ID
    return filepath
      .split('')
      .reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) & 0xffffffff, 0)
      .toString(36);
  }

  private async generateContentHash(content: string): Promise<string> {
    // Simple hash function - in production, use crypto
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private extractSearchTerms(query: string, fuzzyMatch: boolean): string[] {
    const terms = query.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 2);
    
    if (fuzzyMatch) {
      // Add partial matches for fuzzy searching
      const expandedTerms = new Set(terms);
      terms.forEach(term => {
        if (term.length > 4) {
          expandedTerms.add(term.substring(0, Math.floor(term.length * 0.7)));
        }
      });
      return Array.from(expandedTerms);
    }
    
    return terms;
  }

  private calculateRelevanceScore(
    doc: DocumentMetadata, 
    searchTerms: string[], 
    searchIn: string[]
  ): number {
    let score = 0;
    
    for (const term of searchTerms) {
      // Title matches (highest weight)
      if (searchIn.includes('title')) {
        const titleMatches = (doc.title.toLowerCase().match(new RegExp(term, 'g')) || []).length;
        score += titleMatches * 3;
      }
      
      // Content matches (medium weight)
      if (searchIn.includes('content')) {
        const contentMatches = (doc.content.toLowerCase().match(new RegExp(term, 'g')) || []).length;
        score += contentMatches * 1;
      }
      
      // Summary matches (lowest weight)
      if (searchIn.includes('summary') && doc.summary) {
        const summaryMatches = (doc.summary.toLowerCase().match(new RegExp(term, 'g')) || []).length;
        score += summaryMatches * 2;
      }
      
      // Tag matches
      const tagMatches = doc.tags.filter(tag => 
        tag.toLowerCase().includes(term)
      ).length;
      score += tagMatches * 1.5;
    }
    
    // Normalize score
    return score / (searchTerms.length * 10);
  }

  private findMatches(
    doc: DocumentMetadata, 
    searchTerms: string[], 
    searchIn: string[]
  ): SearchResult['matches'] {
    const matches: SearchResult['matches'] = [];
    
    for (const term of searchTerms) {
      if (searchIn.includes('title')) {
        const titleMatch = doc.title.toLowerCase().indexOf(term);
        if (titleMatch !== -1) {
          matches.push({
            field: 'title',
            match: doc.title.substring(titleMatch, titleMatch + term.length),
            position: titleMatch,
          });
        }
      }
      
      if (searchIn.includes('content')) {
        const contentMatch = doc.content.toLowerCase().indexOf(term);
        if (contentMatch !== -1) {
          matches.push({
            field: 'content',
            match: doc.content.substring(contentMatch, contentMatch + term.length),
            position: contentMatch,
          });
        }
      }
    }
    
    return matches;
  }

  private async updateInvertedIndex(doc: DocumentMetadata): Promise<void> {
    const words = new Set(
      doc.content.toLowerCase()
        .match(/\b\w+\b/g) || []
    );
    
    for (const word of words) {
      if (!this.invertedIndex.has(word)) {
        this.invertedIndex.set(word, new Map());
      }
      
      const docFreq = this.invertedIndex.get(word)!;
      docFreq.set(doc.id, (docFreq.get(doc.id) || 0) + 1);
    }
  }

  private async loadIndex(): Promise<void> {
    try {
      const indexFile = join(this.indexPath, 'index.json');
      const exists = existsSync(indexFile);
      
      if (exists) {
        const data = await fs.readFile(indexFile, 'utf-8');
        const parsed = JSON.parse(data);
        
        this.documents = new Map(parsed.documents || []);
        this.invertedIndex = new Map(parsed.invertedIndex || []);
      }
    } catch (error) {
      console.warn('Failed to load existing index:', error);
    }
  }

  private async saveIndex(): Promise<void> {
    try {
      const indexFile = join(this.indexPath, 'index.json');
      const data = {
        documents: Array.from(this.documents.entries()),
        invertedIndex: Array.from(this.invertedIndex.entries()),
        timestamp: new Date().toISOString(),
      };
      
      await fs.writeFile(indexFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save index:', error);
    }
  }
}

/**
 * Convenience function for searching local documents
 */
export async function searchLocalDocuments(
  query: string, 
  paths?: string[],
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const searchEngine = new LocalDocumentSearch();
  await searchEngine.initialize();
  return searchEngine.searchLocalDocuments(query, paths, options);
}