// Tree-Sitter Parser for Multiple Languages
// Phase 10: Parse code files into AST for analysis

import Parser from 'tree-sitter';
import Python from 'tree-sitter-python';
import TypeScript from 'tree-sitter-typescript';
import JavaScript from 'tree-sitter-javascript';
import Go from 'tree-sitter-go';
import Rust from 'tree-sitter-rust';
import Java from 'tree-sitter-java';
import C from 'tree-sitter-c';
import CPP from 'tree-sitter-cpp';
import { promises as fs } from 'fs';
import path from 'path';

export type SupportedLanguage =
  | 'python'
  | 'typescript'
  | 'javascript'
  | 'go'
  | 'rust'
  | 'java'
  | 'c'
  | 'cpp'
  | 'tsx'
  | 'jsx';

export interface ParseResult {
  language: SupportedLanguage;
  tree: Parser.Tree;
  rootNode: Parser.SyntaxNode;
  sourceCode: string;
  filePath: string;
}

export interface ParseError {
  filePath: string;
  error: string;
  language?: SupportedLanguage;
}

export interface NodeLocation {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

/**
 * CodeParser - Parse code files using tree-sitter
 */
export class CodeParser {
  private parsers: Map<SupportedLanguage, Parser> = new Map();

  constructor() {
    this.initializeParsers();
  }

  private initializeParsers(): void {
    // Python
    const pythonParser = new Parser();
    pythonParser.setLanguage(Python);
    this.parsers.set('python', pythonParser);

    // TypeScript
    const tsParser = new Parser();
    tsParser.setLanguage(TypeScript.typescript);
    this.parsers.set('typescript', tsParser);

    // TSX
    const tsxParser = new Parser();
    tsxParser.setLanguage(TypeScript.tsx);
    this.parsers.set('tsx', tsxParser);

    // JavaScript
    const jsParser = new Parser();
    jsParser.setLanguage(JavaScript);
    this.parsers.set('javascript', jsParser);

    // JSX (uses JavaScript parser with JSX support)
    this.parsers.set('jsx', jsParser);

    // Go
    const goParser = new Parser();
    goParser.setLanguage(Go);
    this.parsers.set('go', goParser);

    // Rust
    const rustParser = new Parser();
    rustParser.setLanguage(Rust);
    this.parsers.set('rust', rustParser);

    // Java
    const javaParser = new Parser();
    javaParser.setLanguage(Java);
    this.parsers.set('java', javaParser);

    // C
    const cParser = new Parser();
    cParser.setLanguage(C);
    this.parsers.set('c', cParser);

    // C++
    const cppParser = new Parser();
    cppParser.setLanguage(CPP);
    this.parsers.set('cpp', cppParser);
  }

  /**
   * Detect language from file extension
   */
  detectLanguage(filePath: string): SupportedLanguage | null {
    const ext = path.extname(filePath).toLowerCase();

    const extensionMap: Record<string, SupportedLanguage> = {
      '.py': 'python',
      '.ts': 'typescript',
      '.tsx': 'tsx',
      '.js': 'javascript',
      '.jsx': 'jsx',
      '.mjs': 'javascript',
      '.cjs': 'javascript',
      '.go': 'go',
      '.rs': 'rust',
      '.java': 'java',
      '.c': 'c',
      '.h': 'c',
      '.cpp': 'cpp',
      '.cc': 'cpp',
      '.cxx': 'cpp',
      '.hpp': 'cpp',
      '.hh': 'cpp',
      '.hxx': 'cpp',
    };

    return extensionMap[ext] || null;
  }

  /**
   * Parse a file
   */
  async parseFile(filePath: string, language?: SupportedLanguage): Promise<ParseResult> {
    // Detect language if not provided
    const detectedLanguage = language || this.detectLanguage(filePath);

    if (!detectedLanguage) {
      throw new Error(`Unable to detect language for file: ${filePath}`);
    }

    const parser = this.parsers.get(detectedLanguage);
    if (!parser) {
      throw new Error(`No parser available for language: ${detectedLanguage}`);
    }

    // Read file
    const sourceCode = await fs.readFile(filePath, 'utf-8');

    // Parse
    const tree = parser.parse(sourceCode);

    return {
      language: detectedLanguage,
      tree,
      rootNode: tree.rootNode,
      sourceCode,
      filePath,
    };
  }

  /**
   * Parse source code directly
   */
  parseSource(sourceCode: string, language: SupportedLanguage): ParseResult {
    const parser = this.parsers.get(language);
    if (!parser) {
      throw new Error(`No parser available for language: ${language}`);
    }

    const tree = parser.parse(sourceCode);

    return {
      language,
      tree,
      rootNode: tree.rootNode,
      sourceCode,
      filePath: '<in-memory>',
    };
  }

  /**
   * Parse multiple files in batch
   */
  async parseFiles(filePaths: string[]): Promise<{
    results: ParseResult[];
    errors: ParseError[];
  }> {
    const results: ParseResult[] = [];
    const errors: ParseError[] = [];

    for (const filePath of filePaths) {
      try {
        const result = await this.parseFile(filePath);
        results.push(result);
      } catch (error) {
        errors.push({
          filePath,
          error: error instanceof Error ? error.message : String(error),
          language: this.detectLanguage(filePath) || undefined,
        });
      }
    }

    return { results, errors };
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): SupportedLanguage[] {
    return Array.from(this.parsers.keys());
  }

  /**
   * Check if a language is supported
   */
  isLanguageSupported(language: string): boolean {
    return this.parsers.has(language as SupportedLanguage);
  }

  /**
   * Get parser for a language
   */
  getParser(language: SupportedLanguage): Parser | undefined {
    return this.parsers.get(language);
  }

  /**
   * Query AST using tree-sitter query syntax
   */
  query(parseResult: ParseResult, queryString: string): Parser.QueryCapture[] {
    const language = this.parsers.get(parseResult.language)?.getLanguage();
    if (!language) {
      throw new Error(`Language not found: ${parseResult.language}`);
    }

    const query = language.query(queryString);
    const captures = query.captures(parseResult.rootNode);

    return captures;
  }

  /**
   * Get all nodes of a specific type
   */
  getNodesByType(rootNode: Parser.SyntaxNode, type: string): Parser.SyntaxNode[] {
    const nodes: Parser.SyntaxNode[] = [];

    function traverse(node: Parser.SyntaxNode) {
      if (node.type === type) {
        nodes.push(node);
      }

      for (const child of node.children) {
        traverse(child);
      }
    }

    traverse(rootNode);
    return nodes;
  }

  /**
   * Get node text
   */
  getNodeText(node: Parser.SyntaxNode, sourceCode: string): string {
    return sourceCode.slice(node.startIndex, node.endIndex);
  }

  /**
   * Get node location
   */
  getNodeLocation(node: Parser.SyntaxNode): NodeLocation {
    return {
      startLine: node.startPosition.row + 1,  // 1-indexed
      startColumn: node.startPosition.column + 1,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column + 1,
    };
  }

  /**
   * Pretty print AST
   */
  printTree(node: Parser.SyntaxNode, indent: number = 0): string {
    const indentation = '  '.repeat(indent);
    let result = `${indentation}${node.type}`;

    if (node.isNamed) {
      result += ` (${node.startPosition.row}:${node.startPosition.column} - ${node.endPosition.row}:${node.endPosition.column})`;
    }

    result += '\n';

    for (const child of node.children) {
      if (child.isNamed) {
        result += this.printTree(child, indent + 1);
      }
    }

    return result;
  }

  /**
   * Check for syntax errors
   */
  hasErrors(parseResult: ParseResult): boolean {
    return parseResult.rootNode.hasError;
  }

  /**
   * Get all error nodes
   */
  getErrors(parseResult: ParseResult): Array<{
    node: Parser.SyntaxNode;
    location: NodeLocation;
    text: string;
  }> {
    const errors: Array<{
      node: Parser.SyntaxNode;
      location: NodeLocation;
      text: string;
    }> = [];

    const traverse = (node: Parser.SyntaxNode): void => {
      if (node.type === 'ERROR' || node.isMissing) {
        errors.push({
          node,
          location: {
            startLine: node.startPosition.row + 1,
            startColumn: node.startPosition.column + 1,
            endLine: node.endPosition.row + 1,
            endColumn: node.endPosition.column + 1,
          },
          text: parseResult.sourceCode.slice(node.startIndex, node.endIndex),
        });
      }

      for (const child of node.children) {
        traverse(child);
      }
    };

    traverse(parseResult.rootNode);
    return errors;
  }
}
