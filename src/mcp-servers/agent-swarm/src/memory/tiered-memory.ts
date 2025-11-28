// Tiered Memory System
// Phase 9: Working → Episodic → Persistent memory with auto-promotion/demotion

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

export type MemoryTier = 'working' | 'episodic' | 'persistent';

export type MemoryCategory =
  | 'task'
  | 'learning'
  | 'interaction'
  | 'context'
  | 'pattern'
  | 'knowledge';

export interface MemoryEntry {
  id: string;
  key: string;
  value: any;
  tier: MemoryTier;
  category: MemoryCategory;
  agentId?: string;

  // Access tracking
  accessCount: number;
  lastAccessed: Date;
  createdAt: Date;

  // Importance scoring
  importance: number;  // 0-1
  decay: number;       // Decay rate per hour

  // Promotion/demotion thresholds
  promotionScore: number;  // Auto-calculated
  demotionScore: number;   // Auto-calculated

  // Metadata
  tags: string[];
  metadata: Record<string, any>;

  // Lifecycle
  expiresAt?: Date;
  isPinned: boolean;  // Pinned entries won't be demoted/deleted
}

export interface TierConfig {
  maxEntries: number;
  defaultTTL: number;  // milliseconds
  promotionThreshold: number;  // Score threshold for promotion
  demotionThreshold: number;   // Score threshold for demotion
  accessDecayRate: number;     // How much importance decays per hour
}

export interface MemoryStats {
  working: TierStats;
  episodic: TierStats;
  persistent: TierStats;
  total: TierStats;
}

export interface TierStats {
  count: number;
  size: number;  // Approximate size in bytes
  avgImportance: number;
  avgAccessCount: number;
  oldestEntry?: Date;
  newestEntry?: Date;
}

export class TieredMemory {
  private workingMemory: Map<string, MemoryEntry> = new Map();
  private episodicMemory: Map<string, MemoryEntry> = new Map();
  private persistentMemory: Map<string, MemoryEntry> = new Map();

  private config: Record<MemoryTier, TierConfig> = {
    working: {
      maxEntries: 100,
      defaultTTL: 1000 * 60 * 15,  // 15 minutes
      promotionThreshold: 0.7,
      demotionThreshold: 0.3,
      accessDecayRate: 0.1
    },
    episodic: {
      maxEntries: 1000,
      defaultTTL: 1000 * 60 * 60 * 24,  // 24 hours
      promotionThreshold: 0.8,
      demotionThreshold: 0.4,
      accessDecayRate: 0.05
    },
    persistent: {
      maxEntries: 10000,
      defaultTTL: 1000 * 60 * 60 * 24 * 365,  // 1 year
      promotionThreshold: 1.0,  // Can't promote from persistent
      demotionThreshold: 0.2,
      accessDecayRate: 0.01
    }
  };

  private storageDir: string;
  private maintenanceInterval: NodeJS.Timeout | null = null;

  constructor(storageDir?: string) {
    this.storageDir = storageDir || path.join(os.homedir(), '.mcp', 'agents', 'memory');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.storageDir, { recursive: true });
    await this.loadPersistentMemory();

    // Start maintenance loop
    this.startMaintenance();
  }

  /**
   * Store a value in tiered memory
   */
  async store(params: {
    key: string;
    value: any;
    tier?: MemoryTier;
    category?: MemoryCategory;
    agentId?: string;
    importance?: number;
    tags?: string[];
    ttl?: number;
    isPinned?: boolean;
  }): Promise<MemoryEntry> {
    const tier = params.tier || 'working';
    const entryId = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const tierConfig = this.config[tier];
    const ttl = params.ttl || tierConfig.defaultTTL;

    const entry: MemoryEntry = {
      id: entryId,
      key: params.key,
      value: params.value,
      tier,
      category: params.category || 'context',
      agentId: params.agentId,
      accessCount: 0,
      lastAccessed: new Date(),
      createdAt: new Date(),
      importance: params.importance || 0.5,
      decay: tierConfig.accessDecayRate,
      promotionScore: 0,
      demotionScore: 0,
      tags: params.tags || [],
      metadata: {},
      expiresAt: new Date(Date.now() + ttl),
      isPinned: params.isPinned || false
    };

    this.calculateScores(entry);

    // Store in appropriate tier
    const tierMap = this.getTierMap(tier);
    tierMap.set(entry.key, entry);

    // Check if tier is full
    if (tierMap.size > tierConfig.maxEntries) {
      await this.evictLeastImportant(tier);
    }

    // Persist if in persistent tier
    if (tier === 'persistent') {
      await this.persistEntry(entry);
    }

    return entry;
  }

  /**
   * Retrieve a value from tiered memory
   */
  async retrieve(key: string, tier?: MemoryTier): Promise<any | null> {
    let entry: MemoryEntry | undefined;

    if (tier) {
      // Search specific tier
      entry = this.getTierMap(tier).get(key);
    } else {
      // Search all tiers (working → episodic → persistent)
      entry = this.workingMemory.get(key) ||
              this.episodicMemory.get(key) ||
              this.persistentMemory.get(key);
    }

    if (!entry) return null;

    // Update access tracking
    entry.accessCount++;
    entry.lastAccessed = new Date();
    this.calculateScores(entry);

    // Check for auto-promotion
    await this.checkPromotion(entry);

    return entry.value;
  }

  /**
   * Search memory by criteria
   */
  search(criteria: {
    tier?: MemoryTier;
    category?: MemoryCategory;
    agentId?: string;
    tags?: string[];
    minImportance?: number;
    limit?: number;
  }): MemoryEntry[] {
    let results: MemoryEntry[] = [];

    // Gather entries from specified tier or all tiers
    if (criteria.tier) {
      results = Array.from(this.getTierMap(criteria.tier).values());
    } else {
      results = [
        ...Array.from(this.workingMemory.values()),
        ...Array.from(this.episodicMemory.values()),
        ...Array.from(this.persistentMemory.values())
      ];
    }

    // Apply filters
    if (criteria.category) {
      results = results.filter(e => e.category === criteria.category);
    }

    if (criteria.agentId) {
      results = results.filter(e => e.agentId === criteria.agentId);
    }

    if (criteria.tags && criteria.tags.length > 0) {
      results = results.filter(e => {
        return criteria.tags!.some(tag => e.tags.includes(tag));
      });
    }

    if (criteria.minImportance !== undefined) {
      results = results.filter(e => e.importance >= criteria.minImportance!);
    }

    // Sort by importance and access count
    results.sort((a, b) => {
      const scoreA = a.importance * 0.7 + (a.accessCount / 100) * 0.3;
      const scoreB = b.importance * 0.7 + (b.accessCount / 100) * 0.3;
      return scoreB - scoreA;
    });

    // Apply limit
    if (criteria.limit) {
      results = results.slice(0, criteria.limit);
    }

    return results;
  }

  /**
   * Delete an entry
   */
  async delete(key: string, tier?: MemoryTier): Promise<boolean> {
    if (tier) {
      const tierMap = this.getTierMap(tier);
      const entry = tierMap.get(key);
      if (entry && tier === 'persistent') {
        await this.deletePersistentEntry(entry);
      }
      return tierMap.delete(key);
    }

    // Delete from all tiers
    let deleted = false;
    deleted = this.workingMemory.delete(key) || deleted;
    deleted = this.episodicMemory.delete(key) || deleted;

    const persistentEntry = this.persistentMemory.get(key);
    if (persistentEntry) {
      await this.deletePersistentEntry(persistentEntry);
      deleted = this.persistentMemory.delete(key) || deleted;
    }

    return deleted;
  }

  /**
   * Promote an entry to a higher tier
   */
  async promote(key: string, currentTier: MemoryTier): Promise<boolean> {
    const entry = this.getTierMap(currentTier).get(key);
    if (!entry) return false;

    const nextTier = this.getNextTier(currentTier);
    if (!nextTier) return false;  // Already at highest tier

    // Move to next tier
    this.getTierMap(currentTier).delete(key);
    entry.tier = nextTier;
    entry.importance = Math.min(1, entry.importance * 1.2);  // Boost importance
    this.getTierMap(nextTier).set(key, entry);

    // Persist if promoted to persistent
    if (nextTier === 'persistent') {
      await this.persistEntry(entry);
    }

    return true;
  }

  /**
   * Demote an entry to a lower tier
   */
  async demote(key: string, currentTier: MemoryTier): Promise<boolean> {
    const entry = this.getTierMap(currentTier).get(key);
    if (!entry || entry.isPinned) return false;

    const prevTier = this.getPreviousTier(currentTier);
    if (!prevTier) {
      // Already at lowest tier, delete if score is too low
      if (entry.demotionScore < 0.1) {
        await this.delete(key, currentTier);
      }
      return false;
    }

    // Move to previous tier
    this.getTierMap(currentTier).delete(key);
    entry.tier = prevTier;
    entry.importance = Math.max(0, entry.importance * 0.8);  // Reduce importance
    this.getTierMap(prevTier).set(key, entry);

    // Delete from persistent storage if demoted from persistent
    if (currentTier === 'persistent') {
      await this.deletePersistentEntry(entry);
    }

    return true;
  }

  /**
   * Get statistics for all tiers
   */
  getStats(): MemoryStats {
    const workingStats = this.calculateTierStats(this.workingMemory);
    const episodicStats = this.calculateTierStats(this.episodicMemory);
    const persistentStats = this.calculateTierStats(this.persistentMemory);

    return {
      working: workingStats,
      episodic: episodicStats,
      persistent: persistentStats,
      total: {
        count: workingStats.count + episodicStats.count + persistentStats.count,
        size: workingStats.size + episodicStats.size + persistentStats.size,
        avgImportance: (workingStats.avgImportance + episodicStats.avgImportance + persistentStats.avgImportance) / 3,
        avgAccessCount: (workingStats.avgAccessCount + episodicStats.avgAccessCount + persistentStats.avgAccessCount) / 3,
        oldestEntry: this.getOldest([workingStats.oldestEntry, episodicStats.oldestEntry, persistentStats.oldestEntry]),
        newestEntry: this.getNewest([workingStats.newestEntry, episodicStats.newestEntry, persistentStats.newestEntry])
      }
    };
  }

  /**
   * Clear a specific tier or all tiers
   */
  async clear(tier?: MemoryTier): Promise<void> {
    if (tier) {
      this.getTierMap(tier).clear();
      if (tier === 'persistent') {
        await this.clearPersistentStorage();
      }
    } else {
      this.workingMemory.clear();
      this.episodicMemory.clear();
      this.persistentMemory.clear();
      await this.clearPersistentStorage();
    }
  }

  /**
   * Stop maintenance loop
   */
  shutdown(): void {
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
      this.maintenanceInterval = null;
    }
  }

  // Private helper methods

  private getTierMap(tier: MemoryTier): Map<string, MemoryEntry> {
    switch (tier) {
      case 'working':
        return this.workingMemory;
      case 'episodic':
        return this.episodicMemory;
      case 'persistent':
        return this.persistentMemory;
    }
  }

  private getNextTier(tier: MemoryTier): MemoryTier | null {
    switch (tier) {
      case 'working':
        return 'episodic';
      case 'episodic':
        return 'persistent';
      case 'persistent':
        return null;
    }
  }

  private getPreviousTier(tier: MemoryTier): MemoryTier | null {
    switch (tier) {
      case 'persistent':
        return 'episodic';
      case 'episodic':
        return 'working';
      case 'working':
        return null;
    }
  }

  private calculateScores(entry: MemoryEntry): void {
    const now = Date.now();
    const ageHours = (now - entry.createdAt.getTime()) / (1000 * 60 * 60);
    const hoursSinceAccess = (now - entry.lastAccessed.getTime()) / (1000 * 60 * 60);

    // Calculate promotion score
    const accessFrequency = entry.accessCount / Math.max(1, ageHours);
    const recency = 1 / (1 + hoursSinceAccess);
    entry.promotionScore = entry.importance * 0.5 + accessFrequency * 0.3 + recency * 0.2;

    // Calculate demotion score (inverse of promotion)
    const staleness = hoursSinceAccess / 24;  // Days since access
    entry.demotionScore = Math.max(0, entry.importance - staleness * entry.decay);
  }

  private async checkPromotion(entry: MemoryEntry): Promise<void> {
    const tierConfig = this.config[entry.tier];

    if (entry.promotionScore >= tierConfig.promotionThreshold) {
      await this.promote(entry.key, entry.tier);
    }
  }

  private async checkDemotion(entry: MemoryEntry): Promise<void> {
    if (entry.isPinned) return;

    const tierConfig = this.config[entry.tier];

    if (entry.demotionScore <= tierConfig.demotionThreshold) {
      await this.demote(entry.key, entry.tier);
    }
  }

  private async evictLeastImportant(tier: MemoryTier): Promise<void> {
    const tierMap = this.getTierMap(tier);
    const entries = Array.from(tierMap.values());

    // Find unpinned entry with lowest demotion score
    const unpinned = entries.filter(e => !e.isPinned);
    if (unpinned.length === 0) return;

    unpinned.sort((a, b) => a.demotionScore - b.demotionScore);
    const toEvict = unpinned[0];

    await this.delete(toEvict.key, tier);
  }

  private startMaintenance(): void {
    // Run maintenance every 5 minutes
    this.maintenanceInterval = setInterval(() => {
      this.runMaintenance();
    }, 5 * 60 * 1000);
  }

  private async runMaintenance(): Promise<void> {
    const now = Date.now();

    // Process all tiers
    for (const tier of ['working', 'episodic', 'persistent'] as MemoryTier[]) {
      const tierMap = this.getTierMap(tier);
      const entries = Array.from(tierMap.values());

      for (const entry of entries) {
        // Update scores
        this.calculateScores(entry);

        // Check expiration
        if (entry.expiresAt && now > entry.expiresAt.getTime()) {
          await this.delete(entry.key, tier);
          continue;
        }

        // Check for auto-demotion
        await this.checkDemotion(entry);
      }
    }
  }

  private async persistEntry(entry: MemoryEntry): Promise<void> {
    const filePath = path.join(this.storageDir, `${entry.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(entry, null, 2));
  }

  private async deletePersistentEntry(entry: MemoryEntry): Promise<void> {
    const filePath = path.join(this.storageDir, `${entry.id}.json`);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // File doesn't exist, ignore
    }
  }

  private async loadPersistentMemory(): Promise<void> {
    try {
      const files = await fs.readdir(this.storageDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.storageDir, file);
          const data = await fs.readFile(filePath, 'utf-8');
          const entry = JSON.parse(data) as MemoryEntry;

          // Restore dates
          entry.createdAt = new Date(entry.createdAt);
          entry.lastAccessed = new Date(entry.lastAccessed);
          if (entry.expiresAt) {
            entry.expiresAt = new Date(entry.expiresAt);
          }

          this.persistentMemory.set(entry.key, entry);
        }
      }
    } catch (error) {
      // Directory doesn't exist yet
    }
  }

  private async clearPersistentStorage(): Promise<void> {
    try {
      const files = await fs.readdir(this.storageDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          await fs.unlink(path.join(this.storageDir, file));
        }
      }
    } catch (error) {
      // Ignore errors
    }
  }

  private calculateTierStats(tierMap: Map<string, MemoryEntry>): TierStats {
    const entries = Array.from(tierMap.values());

    if (entries.length === 0) {
      return {
        count: 0,
        size: 0,
        avgImportance: 0,
        avgAccessCount: 0
      };
    }

    const totalImportance = entries.reduce((sum, e) => sum + e.importance, 0);
    const totalAccessCount = entries.reduce((sum, e) => sum + e.accessCount, 0);
    const estimatedSize = entries.reduce((sum, e) => {
      return sum + JSON.stringify(e).length;
    }, 0);

    const dates = entries.map(e => e.createdAt);

    return {
      count: entries.length,
      size: estimatedSize,
      avgImportance: totalImportance / entries.length,
      avgAccessCount: totalAccessCount / entries.length,
      oldestEntry: new Date(Math.min(...dates.map(d => d.getTime()))),
      newestEntry: new Date(Math.max(...dates.map(d => d.getTime())))
    };
  }

  private getOldest(dates: (Date | undefined)[]): Date | undefined {
    const validDates = dates.filter(d => d !== undefined) as Date[];
    if (validDates.length === 0) return undefined;
    return new Date(Math.min(...validDates.map(d => d.getTime())));
  }

  private getNewest(dates: (Date | undefined)[]): Date | undefined {
    const validDates = dates.filter(d => d !== undefined) as Date[];
    if (validDates.length === 0) return undefined;
    return new Date(Math.max(...validDates.map(d => d.getTime())));
  }
}
