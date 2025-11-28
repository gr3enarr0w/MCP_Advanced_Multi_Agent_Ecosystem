// Outline Generator - Generate code structure outlines
// Phase 10: Extract classes, functions, imports, and complexity metrics

import { CodeParser, ParseResult } from './parser.js';
import { SymbolFinder, Symbol } from './symbol-finder.js';

export interface CodeOutline {
  filePath: string;
  language: string;
  imports: Import[];
  symbols: Symbol[];
  complexity: ComplexityMetrics;
  structure: string;  // Mermaid diagram
}

export interface Import {
  module: string;
  items: string[];
  isDefault: boolean;
  line: number;
}

export interface ComplexityMetrics {
  lines: number;
  functions: number;
  classes: number;
  cyclomaticComplexity: number;
  maintainabilityIndex: number;
}

export class OutlineGenerator {
  private parser: CodeParser;
  private symbolFinder: SymbolFinder;

  constructor(parser: CodeParser, symbolFinder: SymbolFinder) {
    this.parser = parser;
    this.symbolFinder = symbolFinder;
  }

  /**
   * Generate outline for a file
   */
  async generateOutline(filePath: string): Promise<CodeOutline> {
    const parseResult = await this.parser.parseFile(filePath);
    const symbols = await this.symbolFinder.findSymbolsInFile(filePath);
    const imports = this.extractImports(parseResult);
    const complexity = this.calculateComplexity(parseResult, symbols);
    const structure = this.generateMermaidDiagram(symbols);

    return {
      filePath,
      language: parseResult.language,
      imports,
      symbols,
      complexity,
      structure,
    };
  }

  private extractImports(result: ParseResult): Import[] {
    const imports: Import[] = [];

    // Language-specific import extraction
    if (result.language === 'python') {
      const importNodes = this.parser.getNodesByType(result.rootNode, 'import_statement');
      const importFromNodes = this.parser.getNodesByType(result.rootNode, 'import_from_statement');

      for (const node of [...importNodes, ...importFromNodes]) {
        imports.push({
          module: this.parser.getNodeText(node, result.sourceCode),
          items: [],
          isDefault: false,
          line: node.startPosition.row + 1,
        });
      }
    } else if (['typescript', 'javascript', 'tsx', 'jsx'].includes(result.language)) {
      const importNodes = this.parser.getNodesByType(result.rootNode, 'import_statement');

      for (const node of importNodes) {
        imports.push({
          module: this.parser.getNodeText(node, result.sourceCode),
          items: [],
          isDefault: false,
          line: node.startPosition.row + 1,
        });
      }
    }

    return imports;
  }

  private calculateComplexity(result: ParseResult, symbols: Symbol[]): ComplexityMetrics {
    const lines = result.sourceCode.split('\n').length;
    const functions = symbols.filter(s => s.type === 'function' || s.type === 'method').length;
    const classes = symbols.filter(s => s.type === 'class').length;

    // Simplified cyclomatic complexity (count decision points)
    const ifNodes = this.parser.getNodesByType(result.rootNode, 'if_statement');
    const whileNodes = this.parser.getNodesByType(result.rootNode, 'while_statement');
    const forNodes = this.parser.getNodesByType(result.rootNode, 'for_statement');

    const cyclomaticComplexity = 1 + ifNodes.length + whileNodes.length + forNodes.length;

    // Simplified maintainability index
    const maintainabilityIndex = Math.max(0, 100 - (cyclomaticComplexity * 2) - (lines / 100));

    return {
      lines,
      functions,
      classes,
      cyclomaticComplexity,
      maintainabilityIndex,
    };
  }

  private generateMermaidDiagram(symbols: Symbol[]): string {
    let mermaid = 'classDiagram\n';

    const classes = symbols.filter(s => s.type === 'class');
    const functions = symbols.filter(s => s.type === 'function');

    for (const cls of classes) {
      mermaid += `  class ${cls.name}\n`;

      // Find methods in this class
      const methods = symbols.filter(
        s => s.type === 'method' && s.scope === cls.name
      );

      for (const method of methods) {
        mermaid += `  ${cls.name} : +${method.name}()\n`;
      }
    }

    return mermaid;
  }

  /**
   * Generate file tree structure
   */
  async generateFileTree(filePaths: string[]): Promise<string> {
    let tree = 'File Structure:\n';

    const sorted = filePaths.sort();
    for (const filePath of sorted) {
      const depth = filePath.split('/').length;
      const indent = '  '.repeat(depth - 1);
      const fileName = filePath.split('/').pop() || filePath;
      tree += `${indent}${fileName}\n`;
    }

    return tree;
  }
}
