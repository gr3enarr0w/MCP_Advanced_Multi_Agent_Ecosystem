/**
 * Database layer for Skills Management MCP Server
 * Using sql.js for pure JavaScript SQLite
 */

import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import {
  UserSkill,
  LearningGoal,
  TaskSkill,
  ProjectSkill,
  CachedSkill,
  Resource,
  ProficiencyHistory,
  ProficiencyLevel,
  GoalStatus,
  GoalPriority,
  SkillSource,
  UsageFrequency,
} from './types.js';

export class SkillsDatabase {
  private db: SqlJsDatabase | null = null;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async init() {
    const SQL = await initSqlJs();
    
    if (existsSync(this.dbPath)) {
      const buffer = readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
      this.initSchema();
      this.save();
    }
  }

  private initSchema() {
    if (!this.db) return;
    
    // User skills table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS user_skills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        skill_id TEXT NOT NULL,
        skill_name TEXT NOT NULL,
        category TEXT,
        current_level TEXT NOT NULL,
        proficiency_score INTEGER DEFAULT 0,
        acquired_date TEXT,
        last_used_date TEXT,
        usage_count INTEGER DEFAULT 0,
        source TEXT,
        notes TEXT,
        metadata TEXT
      )
    `);
    
    // Learning goals table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS learning_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        skill_id TEXT NOT NULL,
        skill_name TEXT NOT NULL,
        target_level TEXT NOT NULL,
        current_level TEXT,
        priority TEXT DEFAULT 'medium',
        reason TEXT,
        target_date TEXT,
        started_date TEXT,
        completed_date TEXT,
        status TEXT DEFAULT 'active',
        progress_percentage INTEGER DEFAULT 0,
        metadata TEXT
      )
    `);
    
    // Task-skill relationships table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS task_skills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        skill_id TEXT NOT NULL,
        skill_name TEXT NOT NULL,
        required_level TEXT NOT NULL,
        is_primary BOOLEAN DEFAULT 0,
        acquired_through_task BOOLEAN DEFAULT 0,
        notes TEXT
      )
    `);
    
    // Project-skill mapping table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS project_skills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_path TEXT NOT NULL,
        skill_id TEXT NOT NULL,
        skill_name TEXT NOT NULL,
        usage_frequency TEXT DEFAULT 'occasional',
        last_used TEXT,
        metadata TEXT
      )
    `);
    
    // Cached skills table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS cached_skills (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT,
        subcategory TEXT,
        description TEXT,
        source TEXT NOT NULL,
        prerequisites TEXT,
        related_skills TEXT,
        learning_path TEXT,
        resources TEXT,
        market_demand TEXT,
        estimated_hours INTEGER,
        cached_at TEXT NOT NULL,
        last_updated TEXT
      )
    `);
    
    // Learning resources table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS learning_resources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        skill_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        url TEXT,
        difficulty TEXT,
        estimated_hours INTEGER,
        completed BOOLEAN DEFAULT 0,
        rating INTEGER,
        notes TEXT
      )
    `);
    
    // Proficiency history table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS proficiency_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        skill_id TEXT NOT NULL,
        level TEXT NOT NULL,
        score INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        source TEXT,
        notes TEXT
      )
    `);
    
    // Create indexes
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_user_skills_skill_id ON user_skills(skill_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_user_skills_category ON user_skills(category)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_learning_goals_status ON learning_goals(status)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_task_skills_task_id ON task_skills(task_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_task_skills_skill_id ON task_skills(skill_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_project_skills_project_path ON project_skills(project_path)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_cached_skills_category ON cached_skills(category)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_cached_skills_source ON cached_skills(source)`);
  }

  private save() {
    if (!this.db) return;
    const data = this.db.export();
    writeFileSync(this.dbPath, data);
  }

  // User Skills Operations
  addSkill(skill: Omit<UserSkill, 'id'>): UserSkill {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = new Date().toISOString();
    this.db.run(
      `INSERT INTO user_skills (skill_id, skill_name, category, current_level, proficiency_score, 
       acquired_date, last_used_date, usage_count, source, notes, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        skill.skill_id,
        skill.skill_name,
        skill.category,
        skill.current_level,
        skill.proficiency_score,
        skill.acquired_date || now,
        skill.last_used_date || null,
        skill.usage_count,
        skill.source,
        skill.notes || null,
        skill.metadata ? JSON.stringify(skill.metadata) : null,
      ]
    );
    
    const result = this.db.exec('SELECT last_insert_rowid() as id');
    const skillId = result[0].values[0][0] as number;
    
    this.save();
    return { ...skill, id: skillId } as UserSkill;
  }

  updateSkill(skillId: string, updates: Partial<UserSkill>): UserSkill | null {
    if (!this.db) throw new Error('Database not initialized');
    
    const setParts: string[] = [];
    const values: any[] = [];
    
    if (updates.current_level !== undefined) {
      setParts.push('current_level = ?');
      values.push(updates.current_level);
    }
    if (updates.proficiency_score !== undefined) {
      setParts.push('proficiency_score = ?');
      values.push(updates.proficiency_score);
    }
    if (updates.last_used_date !== undefined) {
      setParts.push('last_used_date = ?');
      values.push(updates.last_used_date);
    }
    if (updates.usage_count !== undefined) {
      setParts.push('usage_count = ?');
      values.push(updates.usage_count);
    }
    if (updates.notes !== undefined) {
      setParts.push('notes = ?');
      values.push(updates.notes);
    }
    if (updates.metadata !== undefined) {
      setParts.push('metadata = ?');
      values.push(JSON.stringify(updates.metadata));
    }
    
    if (setParts.length === 0) {
      return this.getSkillById(skillId);
    }
    
    values.push(skillId);
    this.db.run(
      `UPDATE user_skills SET ${setParts.join(', ')} WHERE skill_id = ?`,
      values
    );
    
    this.save();
    return this.getSkillById(skillId);
  }

  getSkillById(skillId: string): UserSkill | null {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = this.db.exec('SELECT * FROM user_skills WHERE skill_id = ?', [skillId]);
    if (result.length === 0 || result[0].values.length === 0) {
      return null;
    }
    
    return this.rowToUserSkill(result[0], 0);
  }

  listSkills(filters?: {
    category?: string;
    level?: ProficiencyLevel;
    min_proficiency?: number;
  }): UserSkill[] {
    if (!this.db) throw new Error('Database not initialized');
    
    let query = 'SELECT * FROM user_skills WHERE 1=1';
    const params: any[] = [];
    
    if (filters?.category) {
      query += ' AND category = ?';
      params.push(filters.category);
    }
    if (filters?.level) {
      query += ' AND current_level = ?';
      params.push(filters.level);
    }
    if (filters?.min_proficiency !== undefined) {
      query += ' AND proficiency_score >= ?';
      params.push(filters.min_proficiency);
    }
    
    query += ' ORDER BY proficiency_score DESC, skill_name ASC';
    
    const result = this.db.exec(query, params);
    if (result.length === 0) return [];
    
    const skills: UserSkill[] = [];
    for (let i = 0; i < result[0].values.length; i++) {
      skills.push(this.rowToUserSkill(result[0], i));
    }
    
    return skills;
  }

  removeSkill(skillId: string): void {
    if (!this.db) throw new Error('Database not initialized');
    
    this.db.run('DELETE FROM user_skills WHERE skill_id = ?', [skillId]);
    this.save();
  }

  incrementSkillUsage(skillId: string): void {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = new Date().toISOString();
    this.db.run(
      `UPDATE user_skills 
       SET usage_count = usage_count + 1, last_used_date = ?
       WHERE skill_id = ?`,
      [now, skillId]
    );
    
    this.save();
  }

  // Learning Goals Operations
  createLearningGoal(goal: Omit<LearningGoal, 'id'>): LearningGoal {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = new Date().toISOString();
    this.db.run(
      `INSERT INTO learning_goals (skill_id, skill_name, target_level, current_level, priority,
       reason, target_date, started_date, completed_date, status, progress_percentage, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        goal.skill_id,
        goal.skill_name,
        goal.target_level,
        goal.current_level || null,
        goal.priority,
        goal.reason || null,
        goal.target_date || null,
        goal.started_date || now,
        goal.completed_date || null,
        goal.status,
        goal.progress_percentage,
        goal.metadata ? JSON.stringify(goal.metadata) : null,
      ]
    );
    
    const result = this.db.exec('SELECT last_insert_rowid() as id');
    const goalId = result[0].values[0][0] as number;
    
    this.save();
    return { ...goal, id: goalId } as LearningGoal;
  }

  updateLearningGoal(goalId: number, updates: Partial<LearningGoal>): LearningGoal | null {
    if (!this.db) throw new Error('Database not initialized');
    
    const setParts: string[] = [];
    const values: any[] = [];
    
    if (updates.progress_percentage !== undefined) {
      setParts.push('progress_percentage = ?');
      values.push(updates.progress_percentage);
    }
    if (updates.current_level !== undefined) {
      setParts.push('current_level = ?');
      values.push(updates.current_level);
    }
    if (updates.status !== undefined) {
      setParts.push('status = ?');
      values.push(updates.status);
      
      if (updates.status === 'completed') {
        setParts.push('completed_date = ?');
        values.push(new Date().toISOString());
      }
    }
    if (updates.metadata !== undefined) {
      setParts.push('metadata = ?');
      values.push(JSON.stringify(updates.metadata));
    }
    
    if (setParts.length === 0) {
      return this.getLearningGoal(goalId);
    }
    
    values.push(goalId);
    this.db.run(
      `UPDATE learning_goals SET ${setParts.join(', ')} WHERE id = ?`,
      values
    );
    
    this.save();
    return this.getLearningGoal(goalId);
  }

  getLearningGoal(goalId: number): LearningGoal | null {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = this.db.exec('SELECT * FROM learning_goals WHERE id = ?', [goalId]);
    if (result.length === 0 || result[0].values.length === 0) {
      return null;
    }
    
    return this.rowToLearningGoal(result[0], 0);
  }

  listLearningGoals(filters?: {
    status?: GoalStatus;
    priority?: GoalPriority;
  }): LearningGoal[] {
    if (!this.db) throw new Error('Database not initialized');
    
    let query = 'SELECT * FROM learning_goals WHERE 1=1';
    const params: any[] = [];
    
    if (filters?.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters?.priority) {
      query += ' AND priority = ?';
      params.push(filters.priority);
    }
    
    query += ' ORDER BY priority DESC, target_date ASC';
    
    const result = this.db.exec(query, params);
    if (result.length === 0) return [];
    
    const goals: LearningGoal[] = [];
    for (let i = 0; i < result[0].values.length; i++) {
      goals.push(this.rowToLearningGoal(result[0], i));
    }
    
    return goals;
  }

  // Task-Skill Operations
  linkSkillToTask(taskSkill: Omit<TaskSkill, 'id'>): TaskSkill {
    if (!this.db) throw new Error('Database not initialized');
    
    this.db.run(
      `INSERT INTO task_skills (task_id, skill_id, skill_name, required_level, is_primary, acquired_through_task, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        taskSkill.task_id,
        taskSkill.skill_id,
        taskSkill.skill_name,
        taskSkill.required_level,
        taskSkill.is_primary ? 1 : 0,
        taskSkill.acquired_through_task ? 1 : 0,
        taskSkill.notes || null,
      ]
    );
    
    const result = this.db.exec('SELECT last_insert_rowid() as id');
    const id = result[0].values[0][0] as number;
    
    this.save();
    return { ...taskSkill, id } as TaskSkill;
  }

  getTaskSkills(taskId: number): TaskSkill[] {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = this.db.exec('SELECT * FROM task_skills WHERE task_id = ?', [taskId]);
    if (result.length === 0) return [];
    
    const skills: TaskSkill[] = [];
    for (let i = 0; i < result[0].values.length; i++) {
      skills.push(this.rowToTaskSkill(result[0], i));
    }
    
    return skills;
  }

  // Cache Operations
  cacheSkill(skill: CachedSkill): void {
    if (!this.db) throw new Error('Database not initialized');
    
    this.db.run(
      `INSERT OR REPLACE INTO cached_skills 
       (id, name, category, subcategory, description, source, prerequisites, related_skills,
        learning_path, resources, market_demand, estimated_hours, cached_at, last_updated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        skill.id,
        skill.name,
        skill.category,
        skill.subcategory || null,
        skill.description,
        skill.source,
        JSON.stringify(skill.prerequisites),
        JSON.stringify(skill.related_skills),
        JSON.stringify(skill.learning_path),
        JSON.stringify(skill.resources),
        skill.market_demand || null,
        skill.estimated_hours || null,
        skill.cached_at,
        skill.last_updated,
      ]
    );
    
    this.save();
  }

  getCachedSkill(skillName: string, source?: SkillSource): CachedSkill | null {
    if (!this.db) throw new Error('Database not initialized');
    
    let query = 'SELECT * FROM cached_skills WHERE name = ?';
    const params: any[] = [skillName];
    
    if (source) {
      query += ' AND source = ?';
      params.push(source);
    }
    
    query += ' ORDER BY last_updated DESC LIMIT 1';
    
    const result = this.db.exec(query, params);
    if (result.length === 0 || result[0].values.length === 0) {
      return null;
    }
    
    return this.rowToCachedSkill(result[0], 0);
  }

  searchCachedSkills(query: string, category?: string, source?: SkillSource): CachedSkill[] {
    if (!this.db) throw new Error('Database not initialized');
    
    let sql = 'SELECT * FROM cached_skills WHERE (name LIKE ? OR description LIKE ?)';
    const params: any[] = [`%${query}%`, `%${query}%`];
    
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (source) {
      sql += ' AND source = ?';
      params.push(source);
    }
    
    sql += ' ORDER BY name ASC LIMIT 50';
    
    const result = this.db.exec(sql, params);
    if (result.length === 0) return [];
    
    const skills: CachedSkill[] = [];
    for (let i = 0; i < result[0].values.length; i++) {
      skills.push(this.rowToCachedSkill(result[0], i));
    }
    
    return skills;
  }

  clearCache(source?: SkillSource): number {
    if (!this.db) throw new Error('Database not initialized');
    
    let query = 'DELETE FROM cached_skills';
    const params: any[] = [];
    
    if (source) {
      query += ' WHERE source = ?';
      params.push(source);
    }
    
    const beforeCount = this.db.exec('SELECT COUNT(*) as count FROM cached_skills')[0].values[0][0] as number;
    this.db.run(query, params);
    const afterCount = this.db.exec('SELECT COUNT(*) as count FROM cached_skills')[0].values[0][0] as number;
    
    this.save();
    return beforeCount - afterCount;
  }

  // Proficiency History Operations
  addProficiencyHistory(history: Omit<ProficiencyHistory, 'id'>): void {
    if (!this.db) throw new Error('Database not initialized');
    
    this.db.run(
      `INSERT INTO proficiency_history (skill_id, level, score, timestamp, source, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        history.skill_id,
        history.level,
        history.score,
        history.timestamp,
        history.source || null,
        history.notes || null,
      ]
    );
    
    this.save();
  }

  getProficiencyHistory(skillId: string): ProficiencyHistory[] {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = this.db.exec(
      'SELECT * FROM proficiency_history WHERE skill_id = ? ORDER BY timestamp DESC',
      [skillId]
    );
    
    if (result.length === 0) return [];
    
    const history: ProficiencyHistory[] = [];
    for (let i = 0; i < result[0].values.length; i++) {
      history.push(this.rowToProficiencyHistory(result[0], i));
    }
    
    return history;
  }

  // Helper methods to convert rows to objects
  private rowToUserSkill(result: { columns: string[], values: any[][] }, index: number): UserSkill {
    const row = result.values[index];
    const skill: any = {};
    
    result.columns.forEach((col, i) => {
      skill[col] = row[i];
    });
    
    if (skill.metadata) {
      skill.metadata = JSON.parse(skill.metadata);
    }
    
    return skill as UserSkill;
  }

  private rowToLearningGoal(result: { columns: string[], values: any[][] }, index: number): LearningGoal {
    const row = result.values[index];
    const goal: any = {};
    
    result.columns.forEach((col, i) => {
      goal[col] = row[i];
    });
    
    if (goal.metadata) {
      goal.metadata = JSON.parse(goal.metadata);
    }
    
    return goal as LearningGoal;
  }

  private rowToTaskSkill(result: { columns: string[], values: any[][] }, index: number): TaskSkill {
    const row = result.values[index];
    const taskSkill: any = {};
    
    result.columns.forEach((col, i) => {
      taskSkill[col] = row[i];
    });
    
    taskSkill.is_primary = Boolean(taskSkill.is_primary);
    taskSkill.acquired_through_task = Boolean(taskSkill.acquired_through_task);
    
    return taskSkill as TaskSkill;
  }

  private rowToCachedSkill(result: { columns: string[], values: any[][] }, index: number): CachedSkill {
    const row = result.values[index];
    const skill: any = {};
    
    result.columns.forEach((col, i) => {
      skill[col] = row[i];
    });
    
    skill.prerequisites = JSON.parse(skill.prerequisites || '[]');
    skill.related_skills = JSON.parse(skill.related_skills || '[]');
    skill.learning_path = JSON.parse(skill.learning_path || '[]');
    skill.resources = JSON.parse(skill.resources || '[]');
    
    return skill as CachedSkill;
  }

  private rowToProficiencyHistory(result: { columns: string[], values: any[][] }, index: number): ProficiencyHistory {
    const row = result.values[index];
    const history: any = {};
    
    result.columns.forEach((col, i) => {
      history[col] = row[i];
    });
    
    return history as ProficiencyHistory;
  }
}