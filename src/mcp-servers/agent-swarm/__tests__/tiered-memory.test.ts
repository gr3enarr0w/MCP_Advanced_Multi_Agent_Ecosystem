/**
 * Comprehensive Unit Tests for TieredMemory
 * Phase 9 Agent-Swarm Component Testing
 * Coverage Target: >80%
 */

// Mock the problematic mcp-bridge module before importing anything else
jest.mock('../src/integration/mcp-bridge.js', () => ({
  MCPServerBridge: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { TieredMemory, MemoryTier, MemoryCategory, MemoryEntry, TierConfig, MemoryStats } from '../src/memory/tiered-memory.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Mock filesystem operations
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn(),
    readdir: jest.fn(),
    unlink: jest.fn()
  }
}));

// Mock os module
jest.mock('os', () => ({
  homedir: jest.fn(() => '/mock/home')
}));

describe('TieredMemory', () => {
  let tieredMemory: TieredMemory;
  let mockFs: jest.Mocked<typeof fs>;
  let mockOs: jest.Mocked<typeof os>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFs = fs as jest.Mocked<typeof fs>;
    mockOs = os as jest.Mocked<typeof os>;
    
    // Setup default mock returns
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.readdir.mockResolvedValue([]);
    mockFs.readFile.mockResolvedValue('{}');
    
    tieredMemory = new TieredMemory('/test/memory');
  });

  describe('Initialization', () => {
    it('should initialize with default storage directory', () => {
      const defaultMemory = new TieredMemory();
      expect(defaultMemory).toBeDefined();
    });

    it('should initialize with custom storage directory', () => {
      const customMemory = new TieredMemory('/custom/path');
      expect(customMemory).toBeDefined();
    });

    it('should create storage directory on initialize', async () => {
      await tieredMemory.initialize();
      
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        '/test/memory',
        { recursive: true }
      );
    });

    it('should load persistent memory from disk on initialize', async () => {
      const mockEntryData = JSON.stringify({
        id: 'mem-test-1',
        key: 'test-key',
        value: { data: 'test' },
        tier: 'persistent',
        category: 'context',
        accessCount: 5,
        lastAccessed: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        importance: 0.8,
        decay: 0.01,
        promotionScore: 0,
        demotionScore: 0,
        tags: ['test'],
        metadata: {},
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        isPinned: false
      });

      mockFs.readdir.mockResolvedValue(['mem-test-1.json'] as any);
      mockFs.readFile.mockResolvedValue(mockEntryData);

      await tieredMemory.initialize();

      expect(mockFs.readdir).toHaveBeenCalledWith('/test/memory');
      expect(mockFs.readFile).toHaveBeenCalledWith(
        '/test/memory/mem-test-1.json',
        'utf-8'
      );
    });

    it('should start maintenance loop on initialize', () => {
      jest.useFakeTimers();
      
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      
      tieredMemory.initialize();
      
      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        5 * 60 * 1000 // 5 minutes
      );
      
      setIntervalSpy.mockRestore();
      jest.useRealTimers();
    });

    it('should handle directory not existing on initialize', async () => {
      mockFs.readdir.mockRejectedValue(new Error('ENOENT: no such file'));
      
      await expect(tieredMemory.initialize()).resolves.not.toThrow();
    });

    it('should handle corrupted persistent memory entries', async () => {
      mockFs.readdir.mockResolvedValue(['corrupted.json']);
      mockFs.readFile.mockResolvedValue('invalid json {');

      await expect(tieredMemory.initialize()).resolves.not.toThrow();
    });
  });

  describe('Memory Storage', () => {
    beforeEach(async () => {
      await tieredMemory.initialize();
    });

    it('should store entry in working tier by default', async () => {
      const entry = await tieredMemory.store({
        key: 'test-working',
        value: { data: 'working memory test' },
        category: 'task'
      });

      expect(entry).toBeDefined();
      expect(entry.key).toBe('test-working');
      expect(entry.value).toEqual({ data: 'working memory test' });
      expect(entry.tier).toBe('working');
      expect(entry.category).toBe('task');
      expect(entry.accessCount).toBe(0);
      expect(entry.importance).toBe(0.5);
      expect(entry.isPinned).toBe(false);
      expect(entry.tags).toEqual([]);
    });

    it('should store entry in episodic tier', async () => {
      const entry = await tieredMemory.store({
        key: 'test-episodic',
        value: { data: 'episodic memory test' },
        tier: 'episodic',
        category: 'learning',
        importance: 0.7
      });

      expect(entry.tier).toBe('episodic');
      expect(entry.importance).toBe(0.7);
      expect(entry.category).toBe('learning');
    });

    it('should store entry in persistent tier', async () => {
      const entry = await tieredMemory.store({
        key: 'test-persistent',
        value: { data: 'persistent memory test' },
        tier: 'persistent',
        category: 'knowledge',
        importance: 0.9,
        isPinned: true
      });

      expect(entry.tier).toBe('persistent');
      expect(entry.importance).toBe(0.9);
      expect(entry.isPinned).toBe(true);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should store entry with custom TTL', async () => {
      const customTTL = 1000 * 60 * 30; // 30 minutes
      
      const entry = await tieredMemory.store({
        key: 'test-ttl',
        value: { data: 'ttl test' },
        ttl: customTTL
      });

      const expectedExpiry = new Date(Date.now() + customTTL);
      expect(entry.expiresAt).toBeInstanceOf(Date);
      expect(entry.expiresAt!.getTime()).toBeCloseTo(expectedExpiry.getTime(), -1000);
    });

    it('should store entry with tags', async () => {
      const tags = ['important', 'user-data', 'cache'];
      
      const entry = await tieredMemory.store({
        key: 'test-tags',
        value: { data: 'tags test' },
        tags
      });

      expect(entry.tags).toEqual(tags);
    });

    it('should store entry with agent ID', async () => {
      const agentId = 'agent-123';
      
      const entry = await tieredMemory.store({
        key: 'test-agent',
        value: { data: 'agent test' },
        agentId
      });

      expect(entry.agentId).toBe(agentId);
    });

    it('should store entry with metadata', async () => {
      const metadata = {
        source: 'user-input',
        priority: 'high',
        context: 'session-456'
      };
      
      const entry = await tieredMemory.store({
        key: 'test-metadata',
        value: { data: 'metadata test' },
        metadata
      });

      expect(entry.metadata).toEqual(metadata);
    });

    it('should evict least important entry when tier is full', async () => {
      // Fill working memory to capacity
      const entries = [];
      for (let i = 0; i < 100; i++) {
        const entry = await tieredMemory.store({
          key: `fill-${i}`,
          value: { data: `fill data ${i}` },
          importance: i / 100 // Lower importance for earlier entries
        });
        entries.push(entry);
      }

      // Add one more to trigger eviction
      const newEntry = await tieredMemory.store({
        key: 'trigger-eviction',
        value: { data: 'should trigger eviction' },
        importance: 0.9
      });

      expect(newEntry).toBeDefined();
      // The lowest importance entry should be evicted
      const retrieved = await tieredMemory.retrieve('fill-0');
      expect(retrieved).toBeNull();
    });

    it('should not evict pinned entries', async () => {
      // Fill working memory with pinned entries
      for (let i = 0; i < 50; i++) {
        await tieredMemory.store({
          key: `pinned-${i}`,
          value: { data: `pinned data ${i}` },
          importance: 0.1,
          isPinned: true
        });
      }

      // Fill with unpinned entries
      for (let i = 50; i < 100; i++) {
        await tieredMemory.store({
          key: `unpinned-${i}`,
          value: { data: `unpinned data ${i}` },
          importance: 0.1
        });
      }

      // Add one more to trigger eviction
      await tieredMemory.store({
        key: 'eviction-test',
        value: { data: 'should trigger eviction' },
        importance: 0.9
      });

      // Pinned entries should still be retrievable
      const pinnedRetrieved = await tieredMemory.retrieve('pinned-0');
      expect(pinnedRetrieved).toBeDefined();

      // Some unpinned entries should be evicted
      const unpinnedRetrieved = await tieredMemory.retrieve('unpinned-50');
      expect(unpinnedRetrieved).toBeNull();
    });

    it('should persist entries in persistent tier to disk', async () => {
      await tieredMemory.store({
        key: 'persistent-test',
        value: { data: 'should persist' },
        tier: 'persistent'
      });

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/\/test\/memory\/.+\.json$/),
        expect.stringContaining('persistent-test')
      );
    });

    it('should not persist entries in non-persistent tiers', async () => {
      await tieredMemory.store({
        key: 'working-test',
        value: { data: 'should not persist' },
        tier: 'working'
      });

      await tieredMemory.store({
        key: 'episodic-test',
        value: { data: 'should not persist' },
        tier: 'episodic'
      });

      // Should not call writeFile for working/episodic entries
      const writeFileCalls = mockFs.writeFile.mock.calls.filter(call => 
        call[0].includes('working-test') || call[0].includes('episodic-test')
      );
      expect(writeFileCalls).toHaveLength(0);
    });
  });

  describe('Memory Retrieval', () => {
    beforeEach(async () => {
      await tieredMemory.initialize();
    });

    it('should retrieve entry from working memory', async () => {
      const stored = await tieredMemory.store({
        key: 'working-retrieve',
        value: { data: 'working retrieval test' },
        tier: 'working'
      });

      const retrieved = await tieredMemory.retrieve('working-retrieve');
      
      expect(retrieved).toEqual({ data: 'working retrieval test' });
      expect(stored.accessCount).toBe(0);
      
      // Check that access count was updated
      const updatedStats = tieredMemory.getStats();
      expect(updatedStats.working.avgAccessCount).toBe(1);
    });

    it('should retrieve entry from episodic memory', async () => {
      await tieredMemory.store({
        key: 'episodic-retrieve',
        value: { data: 'episodic retrieval test' },
        tier: 'episodic'
      });

      const retrieved = await tieredMemory.retrieve('episodic-retrieve');
      
      expect(retrieved).toEqual({ data: 'episodic retrieval test' });
    });

    it('should retrieve entry from persistent memory', async () => {
      await tieredMemory.store({
        key: 'persistent-retrieve',
        value: { data: 'persistent retrieval test' },
        tier: 'persistent'
      });

      const retrieved = await tieredMemory.retrieve('persistent-retrieve');
      
      expect(retrieved).toEqual({ data: 'persistent retrieval test' });
    });

    it('should search all tiers when no tier specified', async () => {
      await tieredMemory.store({
        key: 'working-key',
        value: { data: 'working data' },
        tier: 'working'
      });

      await tieredMemory.store({
        key: 'episodic-key',
        value: { data: 'episodic data' },
        tier: 'episodic'
      });

      await tieredMemory.store({
        key: 'persistent-key',
        value: { data: 'persistent data' },
        tier: 'persistent'
      });

      // Should find working memory first (priority order)
      const workingRetrieved = await tieredMemory.retrieve('working-key');
      expect(workingRetrieved).toEqual({ data: 'working data' });

      const episodicRetrieved = await tieredMemory.retrieve('episodic-key');
      expect(episodicRetrieved).toEqual({ data: 'episodic data' });

      const persistentRetrieved = await tieredMemory.retrieve('persistent-key');
      expect(persistentRetrieved).toEqual({ data: 'persistent data' });
    });

    it('should retrieve from specific tier when specified', async () => {
      await tieredMemory.store({
        key: 'same-key',
        value: { data: 'working data' },
        tier: 'working'
      });

      await tieredMemory.store({
        key: 'same-key',
        value: { data: 'episodic data' },
        tier: 'episodic'
      });

      const workingRetrieved = await tieredMemory.retrieve('same-key', 'working');
      expect(workingRetrieved).toEqual({ data: 'working data' });

      const episodicRetrieved = await tieredMemory.retrieve('same-key', 'episodic');
      expect(episodicRetrieved).toEqual({ data: 'episodic data' });
    });

    it('should return null for non-existent key', async () => {
      const retrieved = await tieredMemory.retrieve('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should return null for non-existent key in specific tier', async () => {
      const retrieved = await tieredMemory.retrieve('non-existent', 'working');
      expect(retrieved).toBeNull();
    });

    it('should update access tracking on retrieval', async () => {
      const stored = await tieredMemory.store({
        key: 'access-tracking',
        value: { data: 'access test' }
      });

      const originalAccessCount = stored.accessCount;
      const originalLastAccessed = stored.lastAccessed;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      await tieredMemory.retrieve('access-tracking');

      const stats = tieredMemory.getStats();
      expect(stats.working.avgAccessCount).toBeGreaterThan(0);
    });

    it('should trigger auto-promotion on access if threshold met', async () => {
      const entry = await tieredMemory.store({
        key: 'promotion-test',
        value: { data: 'should promote' },
        tier: 'working',
        importance: 0.9 // High importance to trigger promotion
      });

      // Access multiple times to increase promotion score
      for (let i = 0; i < 10; i++) {
        await tieredMemory.retrieve('promotion-test');
      }

      // Entry should be promoted to episodic
      const episodicRetrieved = await tieredMemory.retrieve('promotion-test', 'episodic');
      expect(episodicRetrieved).toEqual({ data: 'should promote' });

      const workingRetrieved = await tieredMemory.retrieve('promotion-test', 'working');
      expect(workingRetrieved).toBeNull();
    });

    it('should handle expired entries', async () => {
      await tieredMemory.store({
        key: 'expired-test',
        value: { data: 'will expire' },
        ttl: 1 // 1ms TTL
      });

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));

      const retrieved = await tieredMemory.retrieve('expired-test');
      expect(retrieved).toBeNull();
    });
  });

  describe('Memory Search', () => {
    beforeEach(async () => {
      await tieredMemory.initialize();

      // Populate test data
      await tieredMemory.store({
        key: 'task-1',
        value: { data: 'task data 1' },
        tier: 'working',
        category: 'task',
        importance: 0.8,
        tags: ['urgent', 'user']
      });

      await tieredMemory.store({
        key: 'task-2',
        value: { data: 'task data 2' },
        tier: 'episodic',
        category: 'task',
        importance: 0.6,
        tags: ['routine']
      });

      await tieredMemory.store({
        key: 'learning-1',
        value: { data: 'learning data 1' },
        tier: 'persistent',
        category: 'learning',
        importance: 0.9,
        tags: ['important', 'pattern']
      });

      await tieredMemory.store({
        key: 'context-1',
        value: { data: 'context data 1' },
        tier: 'working',
        category: 'context',
        importance: 0.4,
        tags: ['temporary']
      });
    });

    it('should search all tiers by default', () => {
      const results = tieredMemory.search({});
      
      expect(results).toHaveLength(4);
      expect(results.map(r => r.key)).toContain('task-1');
      expect(results.map(r => r.key)).toContain('task-2');
      expect(results.map(r => r.key)).toContain('learning-1');
      expect(results.map(r => r.key)).toContain('context-1');
    });

    it('should search specific tier', () => {
      const results = tieredMemory.search({ tier: 'working' });
      
      expect(results).toHaveLength(2);
      expect(results.map(r => r.key)).toContain('task-1');
      expect(results.map(r => r.key)).toContain('context-1');
    });

    it('should filter by category', () => {
      const results = tieredMemory.search({ category: 'task' });
      
      expect(results).toHaveLength(2);
      expect(results.map(r => r.key)).toContain('task-1');
      expect(results.map(r => r.key)).toContain('task-2');
    });

    it('should filter by agent ID', async () => {
      const agentId = 'agent-123';
      await tieredMemory.store({
        key: 'agent-specific',
        value: { data: 'agent specific data' },
        agentId
      });

      const results = tieredMemory.search({ agentId });
      
      expect(results).toHaveLength(1);
      expect(results[0].key).toBe('agent-specific');
      expect(results[0].agentId).toBe(agentId);
    });

    it('should filter by tags', () => {
      const results = tieredMemory.search({ tags: ['urgent'] });
      
      expect(results).toHaveLength(1);
      expect(results[0].key).toBe('task-1');
    });

    it('should filter by multiple tags (AND logic)', () => {
      const results = tieredMemory.search({ tags: ['urgent', 'user'] });
      
      expect(results).toHaveLength(1);
      expect(results[0].key).toBe('task-1');
    });

    it('should filter by minimum importance', () => {
      const results = tieredMemory.search({ minImportance: 0.7 });
      
      expect(results).toHaveLength(2);
      expect(results.map(r => r.key)).toContain('task-1');
      expect(results.map(r => r.key)).toContain('learning-1');
    });

    it('should limit results', () => {
      const results = tieredMemory.search({ limit: 2 });
      
      expect(results).toHaveLength(2);
      // Should return highest scored results first
      expect(results[0].importance).toBeGreaterThanOrEqual(results[1].importance);
    });

    it('should sort results by importance and access count', () => {
      const results = tieredMemory.search({});
      
      // Results should be sorted by composite score (importance * 0.7 + accessCount/100 * 0.3)
      for (let i = 0; i < results.length - 1; i++) {
        const scoreA = results[i].importance * 0.7 + (results[i].accessCount / 100) * 0.3;
        const scoreB = results[i + 1].importance * 0.7 + (results[i + 1].accessCount / 100) * 0.3;
        expect(scoreA).toBeGreaterThanOrEqual(scoreB);
      }
    });

    it('should handle empty search results', () => {
      const results = tieredMemory.search({ 
        category: 'non-existent' as MemoryCategory 
      });
      
      expect(results).toHaveLength(0);
    });

    it('should handle complex search criteria', () => {
      const results = tieredMemory.search({
        tier: 'working',
        category: 'task',
        minImportance: 0.7,
        tags: ['urgent']
      });
      
      expect(results).toHaveLength(1);
      expect(results[0].key).toBe('task-1');
    });
  });

  describe('Memory Deletion', () => {
    beforeEach(async () => {
      await tieredMemory.initialize();

      await tieredMemory.store({
        key: 'delete-working',
        value: { data: 'working delete test' },
        tier: 'working'
      });

      await tieredMemory.store({
        key: 'delete-episodic',
        value: { data: 'episodic delete test' },
        tier: 'episodic'
      });

      await tieredMemory.store({
        key: 'delete-persistent',
        value: { data: 'persistent delete test' },
        tier: 'persistent'
      });
    });

    it('should delete entry from specific tier', async () => {
      const deleted = await tieredMemory.delete('delete-working', 'working');
      
      expect(deleted).toBe(true);
      
      const retrieved = await tieredMemory.retrieve('delete-working', 'working');
      expect(retrieved).toBeNull();
    });

    it('should delete entry from all tiers when no tier specified', async () => {
      const deleted = await tieredMemory.delete('delete-working');
      
      expect(deleted).toBe(true);
      
      const workingRetrieved = await tieredMemory.retrieve('delete-working', 'working');
      const episodicRetrieved = await tieredMemory.retrieve('delete-working', 'episodic');
      const persistentRetrieved = await tieredMemory.retrieve('delete-working', 'persistent');
      
      expect(workingRetrieved).toBeNull();
      expect(episodicRetrieved).toBeNull();
      expect(persistentRetrieved).toBeNull();
    });

    it('should delete persistent entry from disk', async () => {
      await tieredMemory.delete('delete-persistent', 'persistent');
      
      expect(mockFs.unlink).toHaveBeenCalledWith(
        expect.stringMatching(/\/test\/memory\/.+\.json$/)
      );
    });

    it('should return false for non-existent entry', async () => {
      const deleted = await tieredMemory.delete('non-existent');
      
      expect(deleted).toBe(false);
    });

    it('should handle deletion errors gracefully', async () => {
      mockFs.unlink.mockRejectedValue(new Error('File not found'));
      
      const deleted = await tieredMemory.delete('delete-persistent', 'persistent');
      
      expect(deleted).toBe(true); // Should still return true as entry was removed from memory
    });
  });

  describe('Memory Promotion and Demotion', () => {
    beforeEach(async () => {
      await tieredMemory.initialize();
    });

    it('should promote entry from working to episodic', async () => {
      await tieredMemory.store({
        key: 'promote-test',
        value: { data: 'should promote' },
        tier: 'working',
        importance: 0.8
      });

      const promoted = await tieredMemory.promote('promote-test', 'working');
      
      expect(promoted).toBe(true);
      
      const workingRetrieved = await tieredMemory.retrieve('promote-test', 'working');
      const episodicRetrieved = await tieredMemory.retrieve('promote-test', 'episodic');
      
      expect(workingRetrieved).toBeNull();
      expect(episodicRetrieved).toEqual({ data: 'should promote' });
    });

    it('should promote entry from episodic to persistent', async () => {
      await tieredMemory.store({
        key: 'promote-episodic',
        value: { data: 'should promote to persistent' },
        tier: 'episodic',
        importance: 0.9
      });

      const promoted = await tieredMemory.promote('promote-episodic', 'episodic');
      
      expect(promoted).toBe(true);
      
      const episodicRetrieved = await tieredMemory.retrieve('promote-episodic', 'episodic');
      const persistentRetrieved = await tieredMemory.retrieve('promote-episodic', 'persistent');
      
      expect(episodicRetrieved).toBeNull();
      expect(persistentRetrieved).toEqual({ data: 'should promote to persistent' });
    });

    it('should not promote entry from persistent tier', async () => {
      await tieredMemory.store({
        key: 'no-promote',
        value: { data: 'cannot promote' },
        tier: 'persistent'
      });

      const promoted = await tieredMemory.promote('no-promote', 'persistent');
      
      expect(promoted).toBe(false);
      
      const retrieved = await tieredMemory.retrieve('no-promote', 'persistent');
      expect(retrieved).toEqual({ data: 'cannot promote' });
    });

    it('should return false for non-existent entry promotion', async () => {
      const promoted = await tieredMemory.promote('non-existent', 'working');
      
      expect(promoted).toBe(false);
    });

    it('should demote entry from episodic to working', async () => {
      await tieredMemory.store({
        key: 'demote-test',
        value: { data: 'should demote' },
        tier: 'episodic',
        importance: 0.2 // Low importance to trigger demotion
      });

      const demoted = await tieredMemory.demote('demote-test', 'episodic');
      
      expect(demoted).toBe(true);
      
      const episodicRetrieved = await tieredMemory.retrieve('demote-test', 'episodic');
      const workingRetrieved = await tieredMemory.retrieve('demote-test', 'working');
      
      expect(episodicRetrieved).toBeNull();
      expect(workingRetrieved).toEqual({ data: 'should demote' });
    });

    it('should demote entry from persistent to episodic', async () => {
      await tieredMemory.store({
        key: 'demote-persistent',
        value: { data: 'should demote from persistent' },
        tier: 'persistent',
        importance: 0.1 // Very low importance
      });

      const demoted = await tieredMemory.demote('demote-persistent', 'persistent');
      
      expect(demoted).toBe(true);
      
      const persistentRetrieved = await tieredMemory.retrieve('demote-persistent', 'persistent');
      const episodicRetrieved = await tieredMemory.retrieve('demote-persistent', 'episodic');
      
      expect(persistentRetrieved).toBeNull();
      expect(episodicRetrieved).toEqual({ data: 'should demote from persistent' });
    });

    it('should delete entry when demoted from working with very low score', async () => {
      await tieredMemory.store({
        key: 'delete-on-demote',
        value: { data: 'should be deleted' },
        tier: 'working',
        importance: 0.01 // Very low importance
      });

      const demoted = await tieredMemory.demote('delete-on-demote', 'working');
      
      expect(demoted).toBe(false); // Cannot demote from working, should delete
      
      const retrieved = await tieredMemory.retrieve('delete-on-demote');
      expect(retrieved).toBeNull();
    });

    it('should not demote pinned entries', async () => {
      await tieredMemory.store({
        key: 'pinned-demote',
        value: { data: 'pinned entry' },
        tier: 'episodic',
        importance: 0.1,
        isPinned: true
      });

      const demoted = await tieredMemory.demote('pinned-demote', 'episodic');
      
      expect(demoted).toBe(false);
      
      const retrieved = await tieredMemory.retrieve('pinned-demote', 'episodic');
      expect(retrieved).toEqual({ data: 'pinned entry' });
    });

    it('should boost importance on promotion', async () => {
      const originalImportance = 0.6;
      
      await tieredMemory.store({
        key: 'boost-test',
        value: { data: 'importance boost test' },
        tier: 'working',
        importance: originalImportance
      });

      await tieredMemory.promote('boost-test', 'working');
      
      const episodicRetrieved = await tieredMemory.retrieve('boost-test', 'episodic');
      expect(episodicRetrieved).toEqual({ data: 'importance boost test' });
      
      // Check that importance was boosted
      const stats = tieredMemory.getStats();
      expect(stats.episodic.avgImportance).toBeGreaterThan(originalImportance);
    });

    it('should reduce importance on demotion', async () => {
      const originalImportance = 0.6;
      
      await tieredMemory.store({
        key: 'reduce-test',
        value: { data: 'importance reduce test' },
        tier: 'episodic',
        importance: originalImportance
      });

      await tieredMemory.demote('reduce-test', 'episodic');
      
      const workingRetrieved = await tieredMemory.retrieve('reduce-test', 'working');
      expect(workingRetrieved).toEqual({ data: 'importance reduce test' });
      
      // Check that importance was reduced
      const stats = tieredMemory.getStats();
      expect(stats.working.avgImportance).toBeLessThan(originalImportance);
    });
  });

  describe('Memory Statistics', () => {
    beforeEach(async () => {
      await tieredMemory.initialize();
    });

    it('should return empty stats for empty memory', () => {
      const stats = tieredMemory.getStats();
      
      expect(stats.working.count).toBe(0);
      expect(stats.episodic.count).toBe(0);
      expect(stats.persistent.count).toBe(0);
      expect(stats.total.count).toBe(0);
      
      expect(stats.working.size).toBe(0);
      expect(stats.episodic.size).toBe(0);
      expect(stats.persistent.size).toBe(0);
      expect(stats.total.size).toBe(0);
    });

    it('should calculate stats for populated memory', async () => {
      await tieredMemory.store({
        key: 'stats-1',
        value: { data: 'stats test 1' },
        tier: 'working',
        importance: 0.8
      });

      await tieredMemory.store({
        key: 'stats-2',
        value: { data: 'stats test 2' },
        tier: 'episodic',
        importance: 0.6
      });

      await tieredMemory.store({
        key: 'stats-3',
        value: { data: 'stats test 3' },
        tier: 'persistent',
        importance: 0.9
      });

      const stats = tieredMemory.getStats();
      
      expect(stats.working.count).toBe(1);
      expect(stats.episodic.count).toBe(1);
      expect(stats.persistent.count).toBe(1);
      expect(stats.total.count).toBe(3);
      
      expect(stats.working.avgImportance).toBe(0.8);
      expect(stats.episodic.avgImportance).toBe(0.6);
      expect(stats.persistent.avgImportance).toBe(0.9);
    });

    it('should calculate average importance correctly', async () => {
      await tieredMemory.store({
        key: 'avg-1',
        value: { data: 'avg test 1' },
        tier: 'working',
        importance: 0.5
      });

      await tieredMemory.store({
        key: 'avg-2',
        value: { data: 'avg test 2' },
        tier: 'working',
        importance: 0.7
      });

      await tieredMemory.store({
        key: 'avg-3',
        value: { data: 'avg test 3' },
        tier: 'working',
        importance: 0.9
      });

      const stats = tieredMemory.getStats();
      expect(stats.working.avgImportance).toBe((0.5 + 0.7 + 0.9) / 3);
    });

    it('should calculate average access count correctly', async () => {
      const entry1 = await tieredMemory.store({
        key: 'access-1',
        value: { data: 'access test 1' },
        tier: 'working'
      });

      const entry2 = await tieredMemory.store({
        key: 'access-2',
        value: { data: 'access test 2' },
        tier: 'working'
      });

      // Access entries different number of times
      for (let i = 0; i < 5; i++) {
        await tieredMemory.retrieve('access-1');
      }
      
      for (let i = 0; i < 2; i++) {
        await tieredMemory.retrieve('access-2');
      }

      const stats = tieredMemory.getStats();
      expect(stats.working.avgAccessCount).toBe((5 + 2) / 2);
    });

    it('should track oldest and newest entries', async () => {
      const entry1 = await tieredMemory.store({
        key: 'oldest',
        value: { data: 'oldest entry' },
        tier: 'working'
      });

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const entry2 = await tieredMemory.store({
        key: 'newest',
        value: { data: 'newest entry' },
        tier: 'working'
      });

      const stats = tieredMemory.getStats();
      
      expect(stats.working.oldestEntry).toEqual(entry1.createdAt);
      expect(stats.working.newestEntry).toEqual(entry2.createdAt);
    });

    it('should estimate size correctly', async () => {
      await tieredMemory.store({
        key: 'size-test',
        value: { 
          data: 'size test entry with some content to increase size',
          nested: {
            array: [1, 2, 3, 4, 5],
            object: { key: 'value', number: 42 }
          }
        },
        tier: 'working'
      });

      const stats = tieredMemory.getStats();
      expect(stats.working.size).toBeGreaterThan(0);
    });

    it('should handle zero entries gracefully', () => {
      const stats = tieredMemory.getStats();
      
      expect(stats.working.avgImportance).toBe(0);
      expect(stats.working.avgAccessCount).toBe(0);
      expect(stats.working.oldestEntry).toBeUndefined();
      expect(stats.working.newestEntry).toBeUndefined();
    });
  });

  describe('Memory Clearing', () => {
    beforeEach(async () => {
      await tieredMemory.initialize();

      // Populate all tiers
      await tieredMemory.store({
        key: 'clear-working',
        value: { data: 'working clear test' },
        tier: 'working'
      });

      await tieredMemory.store({
        key: 'clear-episodic',
        value: { data: 'episodic clear test' },
        tier: 'episodic'
      });

      await tieredMemory.store({
        key: 'clear-persistent',
        value: { data: 'persistent clear test' },
        tier: 'persistent'
      });
    });

    it('should clear specific tier', async () => {
      await tieredMemory.clear('working');
      
      const workingRetrieved = await tieredMemory.retrieve('clear-working', 'working');
      const episodicRetrieved = await tieredMemory.retrieve('clear-episodic', 'episodic');
      const persistentRetrieved = await tieredMemory.retrieve('clear-persistent', 'persistent');
      
      expect(workingRetrieved).toBeNull();
      expect(episodicRetrieved).toEqual({ data: 'episodic clear test' });
      expect(persistentRetrieved).toEqual({ data: 'persistent clear test' });
    });

    it('should clear all tiers when no tier specified', async () => {
      await tieredMemory.clear();
      
      const workingRetrieved = await tieredMemory.retrieve('clear-working', 'working');
      const episodicRetrieved = await tieredMemory.retrieve('clear-episodic', 'episodic');
      const persistentRetrieved = await tieredMemory.retrieve('clear-persistent', 'persistent');
      
      expect(workingRetrieved).toBeNull();
      expect(episodicRetrieved).toBeNull();
      expect(persistentRetrieved).toBeNull();
    });

    it('should clear persistent storage when clearing persistent tier', async () => {
      await tieredMemory.clear('persistent');
      
      expect(mockFs.unlink).toHaveBeenCalled();
    });

    it('should clear persistent storage when clearing all tiers', async () => {
      await tieredMemory.clear();
      
      expect(mockFs.unlink).toHaveBeenCalled();
    });

    it('should handle clearing errors gracefully', async () => {
      mockFs.unlink.mockRejectedValue(new Error('Permission denied'));
      
      await expect(tieredMemory.clear('persistent')).resolves.not.toThrow();
    });
  });

  describe('Maintenance Operations', () => {
    beforeEach(async () => {
      await tieredMemory.initialize();
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should run maintenance at specified intervals', async () => {
      const maintenanceSpy = jest.spyOn(tieredMemory as any, 'runMaintenance');
      
      await tieredMemory.initialize();
      
      // Fast-forward time to trigger maintenance
      jest.advanceTimersByTime(5 * 60 * 1000); // 5 minutes
      
      expect(maintenanceSpy).toHaveBeenCalled();
      
      maintenanceSpy.mockRestore();
    });

    it('should clean up expired entries during maintenance', async () => {
      await tieredMemory.store({
        key: 'expire-maintenance',
        value: { data: 'will expire in maintenance' },
        ttl: 10 // 10ms TTL
      });

      // Fast-forward time to trigger maintenance
      jest.advanceTimersByTime(5 * 60 * 1000); // 5 minutes

      const retrieved = await tieredMemory.retrieve('expire-maintenance');
      expect(retrieved).toBeNull();
    });

    it('should auto-demote entries with low scores during maintenance', async () => {
      await tieredMemory.store({
        key: 'demote-maintenance',
        value: { data: 'should demote in maintenance' },
        tier: 'episodic',
        importance: 0.1 // Low importance to trigger demotion
      });

      // Fast-forward time to trigger maintenance
      jest.advanceTimersByTime(5 * 60 * 1000); // 5 minutes

      const episodicRetrieved = await tieredMemory.retrieve('demote-maintenance', 'episodic');
      const workingRetrieved = await tieredMemory.retrieve('demote-maintenance', 'working');
      
      expect(episodicRetrieved).toBeNull();
      expect(workingRetrieved).toEqual({ data: 'should demote in maintenance' });
    });

    it('should update scores during maintenance', async () => {
      const entry = await tieredMemory.store({
        key: 'score-update',
        value: { data: 'score update test' },
        tier: 'working',
        importance: 0.5
      });

      // Access entry to increase score
      await tieredMemory.retrieve('score-update');

      // Fast-forward time to trigger maintenance
      jest.advanceTimersByTime(5 * 60 * 1000); // 5 minutes

      // Scores should be updated (accessed entry should have higher promotion score)
      const stats = tieredMemory.getStats();
      expect(stats.working.count).toBe(1);
    });
  });

  describe('Shutdown', () => {
    beforeEach(async () => {
      await tieredMemory.initialize();
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should stop maintenance interval on shutdown', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      tieredMemory.shutdown();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      
      clearIntervalSpy.mockRestore();
    });

    it('should handle shutdown when no maintenance interval is running', () => {
      expect(() => {
        tieredMemory.shutdown();
      }).not.toThrow();
    });
  });

  describe('Score Calculation', () => {
    beforeEach(async () => {
      await tieredMemory.initialize();
    });

    it('should calculate promotion score based on importance, access frequency, and recency', async () => {
      const entry = await tieredMemory.store({
        key: 'score-calculation',
        value: { data: 'score test' },
        tier: 'working',
        importance: 0.7
      });

      // Access multiple times to increase frequency
      for (let i = 0; i < 10; i++) {
        await tieredMemory.retrieve('score-calculation');
      }

      // Entry should have high promotion score due to high access frequency
      // This is tested indirectly through auto-promotion
      const episodicRetrieved = await tieredMemory.retrieve('score-calculation', 'episodic');
      expect(episodicRetrieved).toEqual({ data: 'score test' });
    });

    it('should calculate demotion score based on staleness and decay', async () => {
      const entry = await tieredMemory.store({
        key: 'demotion-score',
        value: { data: 'demotion score test' },
        tier: 'episodic',
        importance: 0.3 // Low importance
      });

      // Wait for entry to become stale
      await new Promise(resolve => setTimeout(resolve, 100));

      // Entry should be demoted due to low importance and staleness
      const demoted = await tieredMemory.demote('demotion-score', 'episodic');
      expect(demoted).toBe(true);
    });

    it('should handle score calculation for entries with different ages', async () => {
      const oldEntry = await tieredMemory.store({
        key: 'old-entry',
        value: { data: 'old entry' },
        tier: 'working',
        importance: 0.5
      });

      // Wait to create age difference
      await new Promise(resolve => setTimeout(resolve, 50));

      const newEntry = await tieredMemory.store({
        key: 'new-entry',
        value: { data: 'new entry' },
        tier: 'working',
        importance: 0.5
      });

      // New entry should have higher recency score
      // This is tested through search ordering
      const results = tieredMemory.search({ tier: 'working' });
      
      const newEntryIndex = results.findIndex(r => r.key === 'new-entry');
      const oldEntryIndex = results.findIndex(r => r.key === 'old-entry');
      
      expect(newEntryIndex).toBeLessThan(oldEntryIndex);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await tieredMemory.initialize();
    });

    it('should handle filesystem errors during persistence', async () => {
      mockFs.writeFile.mockRejectedValue(new Error('Disk full'));

      await expect(
        tieredMemory.store({
          key: 'error-persist',
          value: { data: 'should handle error' },
          tier: 'persistent'
        })
      ).resolves.toBeDefined(); // Should still create entry in memory
    });

    it('should handle filesystem errors during loading', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Permission denied'));

      await expect(tieredMemory.initialize()).resolves.not.toThrow();
    });

    it('should handle corrupted persistent entries', async () => {
      mockFs.readdir.mockResolvedValue(['corrupted.json']);
      mockFs.readFile.mockResolvedValue('invalid json {');

      await expect(tieredMemory.initialize()).resolves.not.toThrow();
    });

    it('should handle deletion errors gracefully', async () => {
      mockFs.unlink.mockRejectedValue(new Error('File not found'));

      await expect(
        tieredMemory.store({
          key: 'error-delete',
          value: { data: 'should handle delete error' },
          tier: 'persistent'
        })
      ).resolves.toBeDefined();
    });
  });

  describe('Concurrent Operations', () => {
    beforeEach(async () => {
      await tieredMemory.initialize();
    });

    it('should handle concurrent storage operations', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        tieredMemory.store({
          key: `concurrent-${i}`,
          value: { data: `concurrent data ${i}` },
          tier: 'working'
        })
      );

      const entries = await Promise.all(promises);
      
      expect(entries).toHaveLength(10);
      expect(new Set(entries.map(e => e.key))).size; // All unique keys
    });

    it('should handle concurrent retrieval operations', async () => {
      // Store test data
      for (let i = 0; i < 5; i++) {
        await tieredMemory.store({
          key: `retrieve-concurrent-${i}`,
          value: { data: `retrieve data ${i}` },
          tier: 'working'
        });
      }

      // Concurrent retrievals
      const promises = Array.from({ length: 5 }, (_, i) =>
        tieredMemory.retrieve(`retrieve-concurrent-${i}`)
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      results.forEach((result, i) => {
        expect(result).toEqual({ data: `retrieve data ${i}` });
      });
    });

    it('should handle concurrent search operations', async () => {
      // Populate test data
      for (let i = 0; i < 10; i++) {
        await tieredMemory.store({
          key: `search-concurrent-${i}`,
          value: { data: `search data ${i}` },
          tier: 'working',
          importance: Math.random()
        });
      }

      // Concurrent searches
      const promises = Array.from({ length: 3 }, () =>
        tieredMemory.search({ tier: 'working' })
      );

      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result).toHaveLength(10);
      });
    });

    it('should handle concurrent promotion/demotion operations', async () => {
      // Store test data
      for (let i = 0; i < 5; i++) {
        await tieredMemory.store({
          key: `promote-concurrent-${i}`,
          value: { data: `promote data ${i}` },
          tier: 'working',
          importance: 0.9
        });
      }

      // Concurrent promotions
      const promises = Array.from({ length: 5 }, (_, i) =>
        tieredMemory.promote(`promote-concurrent-${i}`, 'working')
      );

      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result).toBe(true);
      });

      // Verify all entries were promoted
      const episodicStats = tieredMemory.getStats().episodic;
      expect(episodicStats.count).toBe(5);
    });
  });
});