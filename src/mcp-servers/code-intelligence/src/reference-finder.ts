// Reference Finder - Find all references to a symbol
// Phase 10: Track symbol usage and build call hierarchies

import Parser from 'tree-sitter';
import { CodeParser, ParseResult } from './parser.js';
import { Symbol, SymbolFinder } from './symbol-finder.js';

export interface Reference {
  symbolName: string;
  filePath: string;
  startLine: number;
  startColumn: number;
  context: string;
  isDefinition: boolean;
}

export class ReferenceFinder {
  private parser: CodeParser;
  private symbolFinder: SymbolFinder;

  constructor(parser: CodeParser, symbolFinder: SymbolFinder) {
    this.parser = parser;
    this.symbolFinder = symbolFinder;
  }

  /**
   * Find all references to a symbol
   */
  async findReferences(symbolName: string, filePaths: string[]): Promise<Reference[]> {
    const references: Reference[] = [];

    for (const filePath of filePaths) {
      try {
        const parseResult = await this.parser.parseFile(filePath);
        const fileRefs = this.findReferencesInFile(symbolName, parseResult);
        references.push(...fileRefs);
      } catch (error) {
        // Skip files with errors
      }
    }

    return references;
  }

  private findReferencesInFile(symbolName: string, result: ParseResult): Reference[] {
    const references: Reference[] = [];

    const traverse = (node: Parser.SyntaxNode): void => {
      if (node.type === 'identifier') {
        const text = result.sourceCode.slice(node.startIndex, node.endIndex);
        if (text === symbolName) {
          const location = {
            startLine: node.startPosition.row + 1,
            startColumn: node.startPosition.column + 1,
          };

          // Get context (surrounding line)
          const lineStart = result.sourceCode.lastIndexOf('\n', node.startIndex) + 1;
          const lineEnd = result.sourceCode.indexOf('\n', node.endIndex);
          const context = result.sourceCode.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim();

          references.push({
            symbolName,
            filePath: result.filePath,
            ...location,
            context,
            isDefinition: this.isDefinition(node),
          });
        }
      }

      for (const child of node.children) {
        traverse(child);
      }
    };

    traverse(result.rootNode);
    return references;
  }

  private isDefinition(node: Parser.SyntaxNode): boolean {
    // Check if node is part of a definition
    let current: Parser.SyntaxNode | null = node.parent;

    while (current) {
      if (
        current.type.includes('definition') ||
        current.type.includes('declaration') ||
        current.type === 'class' ||
        current.type === 'function'
      ) {
        return true;
      }
      current = current.parent;
    }

    return false;
  }

  /**
   * Build call hierarchy for a function
   */
  async buildCallHierarchy(functionName: string, filePaths: string[]): Promise<{
    calls: Reference[];
    calledBy: Reference[];
  }> {
    const calls: Reference[] = [];
    const calledBy = await this.findReferences(functionName, filePaths);

    // Find what this function calls (simplified - would need more sophisticated analysis)
    return { calls, calledBy };
  }
}
