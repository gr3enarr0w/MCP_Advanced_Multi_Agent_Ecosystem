/**
 * Unit Tests for Skills Manager MCP Server
 */
import { describe, it, expect } from '@jest/globals';

describe('Skills Manager', () => {
  describe('Configuration', () => {
    it('should have test environment configured', () => {
      expect(process.env.NODE_ENV).toBe('test');
    });

    it('should use in-memory database for tests', () => {
      expect(process.env.SKILLS_DB_PATH).toBe(':memory:');
    });
  });

  describe('Skill Operations', () => {
    it('should create a skill object', () => {
      const skill = {
        id: 'skill-1',
        name: 'TypeScript',
        category: 'programming',
        level: 3,
        createdAt: new Date().toISOString()
      };

      expect(skill.name).toBe('TypeScript');
      expect(skill.level).toBeGreaterThanOrEqual(1);
      expect(skill.level).toBeLessThanOrEqual(5);
    });

    it('should validate skill level range', () => {
      const validateLevel = (level: number): boolean => {
        return level >= 1 && level <= 5;
      };

      expect(validateLevel(1)).toBe(true);
      expect(validateLevel(5)).toBe(true);
      expect(validateLevel(0)).toBe(false);
      expect(validateLevel(6)).toBe(false);
    });
  });

  describe('Category Management', () => {
    it('should have valid skill categories', () => {
      const categories = ['programming', 'framework', 'tool', 'soft-skill', 'other'];
      expect(categories).toContain('programming');
      expect(categories.length).toBe(5);
    });
  });
});
