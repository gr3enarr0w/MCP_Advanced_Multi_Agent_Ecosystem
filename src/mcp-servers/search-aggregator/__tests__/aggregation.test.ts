import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('search-aggregator integration', () => {
  it('performs search and writes cache', async () => {
    const tempHome = mkdtempSync(join(tmpdir(), 'mcp-search-'));
    process.env.MCP_HOME = tempHome;

    const { SearchAggregator } = await import('../src/index');
    const aggregator = new SearchAggregator();
    await aggregator.initialize();

    const results = await aggregator.search('test query', { limit: 3, use_cache: true });
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });
});
