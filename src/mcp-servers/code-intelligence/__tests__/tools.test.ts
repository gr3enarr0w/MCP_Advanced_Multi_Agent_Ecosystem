import { mkdtempSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { CodeParser } from '../src/parser.js';
import { SymbolFinder } from '../src/symbol-finder.js';
import { ReferenceFinder } from '../src/reference-finder.js';
import { OutlineGenerator } from '../src/outline-generator.js';

describe('code-intelligence integration', () => {
  const parser = new CodeParser();
  const symbolFinder = new SymbolFinder(parser);
  const referenceFinder = new ReferenceFinder(parser, symbolFinder);
  const outlineGenerator = new OutlineGenerator(parser, symbolFinder);

  it('parses TS file and finds symbols and outline', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'code-intel-'));
    const filePath = join(dir, 'sample.ts');
    const source = `
      export function add(a: number, b: number) {
        return a + b;
      }
      export const value = add(2, 3);
    `;
    writeFileSync(filePath, source, 'utf8');

    const parseResult = await parser.parseFile(filePath);
    expect(parseResult.language).toBe('typescript');
    expect(parseResult.rootNode).toBeDefined();

    const symbols = await symbolFinder.findSymbol('add', [filePath]);
    expect(symbols.some(s => s.name === 'add')).toBe(true);

    const references = await referenceFinder.findReferences('add', [filePath]);
    expect(references.length).toBeGreaterThan(0);

    const outline = await outlineGenerator.generateOutline(filePath);
    expect(outline.symbols.length).toBeGreaterThan(0);
    expect(outline.structure.length).toBeGreaterThan(0);
  });
});
