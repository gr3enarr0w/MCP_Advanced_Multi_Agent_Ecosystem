// Symbol Finder - Find function/class/variable definitions
// Phase 10: Locate symbols across files with context

import Parser from 'tree-sitter';
import { CodeParser, ParseResult, SupportedLanguage } from './parser.js';

export interface Symbol {
  name: string;
  type: SymbolType;
  language: SupportedLanguage;
  filePath: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  text: string;
  scope?: string;
  signature?: string;
  docstring?: string;
}

export type SymbolType =
  | 'function'
  | 'class'
  | 'method'
  | 'variable'
  | 'constant'
  | 'interface'
  | 'type'
  | 'enum'
  | 'module';

export class SymbolFinder {
  private parser: CodeParser;

  constructor(parser: CodeParser) {
    this.parser = parser;
  }

  /**
   * Find all symbols in a file
   */
  async findSymbolsInFile(filePath: string): Promise<Symbol[]> {
    const parseResult = await this.parser.parseFile(filePath);
    return this.extractSymbols(parseResult);
  }

  /**
   * Extract symbols from parse result
   */
  private extractSymbols(parseResult: ParseResult): Symbol[] {
    const symbols: Symbol[] = [];

    switch (parseResult.language) {
      case 'python':
        symbols.push(...this.extractPythonSymbols(parseResult));
        break;
      case 'typescript':
      case 'tsx':
      case 'javascript':
      case 'jsx':
        symbols.push(...this.extractTSJSSymbols(parseResult));
        break;
      case 'go':
        symbols.push(...this.extractGoSymbols(parseResult));
        break;
      case 'rust':
        symbols.push(...this.extractRustSymbols(parseResult));
        break;
      default:
        symbols.push(...this.extractGenericSymbols(parseResult));
    }

    return symbols;
  }

  private extractPythonSymbols(result: ParseResult): Symbol[] {
    const symbols: Symbol[] = [];

    // Find classes
    const classes = this.parser.getNodesByType(result.rootNode, 'class_definition');
    for (const node of classes) {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        symbols.push({
          name: this.parser.getNodeText(nameNode, result.sourceCode),
          type: 'class',
          language: result.language,
          filePath: result.filePath,
          ...this.parser.getNodeLocation(node),
          text: this.parser.getNodeText(node, result.sourceCode),
        });
      }
    }

    // Find functions
    const functions = this.parser.getNodesByType(result.rootNode, 'function_definition');
    for (const node of functions) {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        symbols.push({
          name: this.parser.getNodeText(nameNode, result.sourceCode),
          type: 'function',
          language: result.language,
          filePath: result.filePath,
          ...this.parser.getNodeLocation(node),
          text: this.parser.getNodeText(node, result.sourceCode),
        });
      }
    }

    return symbols;
  }

  private extractTSJSSymbols(result: ParseResult): Symbol[] {
    const symbols: Symbol[] = [];

    // Function declarations
    const functions = this.parser.getNodesByType(result.rootNode, 'function_declaration');
    for (const node of functions) {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        symbols.push({
          name: this.parser.getNodeText(nameNode, result.sourceCode),
          type: 'function',
          language: result.language,
          filePath: result.filePath,
          ...this.parser.getNodeLocation(node),
          text: this.parser.getNodeText(node, result.sourceCode),
        });
      }
    }

    // Class declarations
    const classes = this.parser.getNodesByType(result.rootNode, 'class_declaration');
    for (const node of classes) {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        symbols.push({
          name: this.parser.getNodeText(nameNode, result.sourceCode),
          type: 'class',
          language: result.language,
          filePath: result.filePath,
          ...this.parser.getNodeLocation(node),
          text: this.parser.getNodeText(node, result.sourceCode),
        });
      }
    }

    // Interfaces (TypeScript)
    const interfaces = this.parser.getNodesByType(result.rootNode, 'interface_declaration');
    for (const node of interfaces) {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        symbols.push({
          name: this.parser.getNodeText(nameNode, result.sourceCode),
          type: 'interface',
          language: result.language,
          filePath: result.filePath,
          ...this.parser.getNodeLocation(node),
          text: this.parser.getNodeText(node, result.sourceCode),
        });
      }
    }

    return symbols;
  }

  private extractGoSymbols(result: ParseResult): Symbol[] {
    const symbols: Symbol[] = [];

    const functions = this.parser.getNodesByType(result.rootNode, 'function_declaration');
    for (const node of functions) {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        symbols.push({
          name: this.parser.getNodeText(nameNode, result.sourceCode),
          type: 'function',
          language: result.language,
          filePath: result.filePath,
          ...this.parser.getNodeLocation(node),
          text: this.parser.getNodeText(node, result.sourceCode),
        });
      }
    }

    return symbols;
  }

  private extractRustSymbols(result: ParseResult): Symbol[] {
    const symbols: Symbol[] = [];

    const functions = this.parser.getNodesByType(result.rootNode, 'function_item');
    for (const node of functions) {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        symbols.push({
          name: this.parser.getNodeText(nameNode, result.sourceCode),
          type: 'function',
          language: result.language,
          filePath: result.filePath,
          ...this.parser.getNodeLocation(node),
          text: this.parser.getNodeText(node, result.sourceCode),
        });
      }
    }

    return symbols;
  }

  private extractGenericSymbols(result: ParseResult): Symbol[] {
    // Generic extraction for unsupported languages
    return [];
  }

  /**
   * Find symbol by name
   */
  async findSymbol(name: string, filePaths: string[]): Promise<Symbol[]> {
    const allSymbols: Symbol[] = [];

    for (const filePath of filePaths) {
      try {
        const symbols = await this.findSymbolsInFile(filePath);
        allSymbols.push(...symbols.filter(s => s.name === name));
      } catch (error) {
        // Skip files with errors
      }
    }

    return allSymbols;
  }
}
