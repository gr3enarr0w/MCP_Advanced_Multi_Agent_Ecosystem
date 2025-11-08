export interface DatabaseConfig {
  path: string;
  backupPath?: string;
  backupInterval: number; // hours
  maxBackupFiles: number;
  encryption?: {
    enabled: boolean;
    key: string;
  };
}

export interface DatabaseSchema {
  version: string;
  tables: DatabaseTable[];
  indexes: DatabaseIndex[];
  triggers: DatabaseTrigger[];
}

export interface DatabaseTable {
  name: string;
  columns: DatabaseColumn[];
  constraints: DatabaseConstraint[];
}

export interface DatabaseColumn {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  defaultValue?: any;
  unique: boolean;
}

export interface DatabaseConstraint {
  type: 'PRIMARY KEY' | 'FOREIGN KEY' | 'UNIQUE' | 'CHECK';
  columns: string[];
  referencedTable?: string;
  referencedColumns?: string[];
  expression?: string;
}

export interface DatabaseIndex {
  name: string;
  table: string;
  columns: string[];
  unique: boolean;
  using?: string;
}

export interface DatabaseTrigger {
  name: string;
  table: string;
  event: 'INSERT' | 'UPDATE' | 'DELETE';
  timing: 'BEFORE' | 'AFTER' | 'INSTEAD OF';
  action: string;
}

export interface DatabaseOperation {
  type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'CREATE' | 'ALTER' | 'DROP';
  table: string;
  query: string;
  params: any[];
  result?: any;
  error?: string;
  executionTime: number;
}

export interface DatabaseStats {
  totalSize: number;
  tableSizes: Map<string, number>;
  indexSizes: Map<string, number>;
  queryStats: Map<string, QueryStats>;
  lastOptimization: Date;
}

export interface QueryStats {
  totalExecutions: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  lastExecution: Date;
  successRate: number;
}

export interface DatabaseBackup {
  id: string;
  timestamp: Date;
  path: string;
  size: number;
  compression: boolean;
  encryption: boolean;
  checksum: string;
}

export interface DatabaseError {
  code: string;
  message: string;
  query?: string;
  params?: any[];
  timestamp: Date;
  stack?: string;
}

export interface DatabaseTransaction {
  id: string;
  startTime: Date;
  operations: DatabaseOperation[];
  status: 'pending' | 'committed' | 'rolled_back' | 'failed';
  error?: DatabaseError;
}

export interface DatabaseMigration {
  version: string;
  description: string;
  upScript: string;
  downScript?: string;
  timestamp: Date;
  checksum: string;
}