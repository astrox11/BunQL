import type { Database } from "bun:sqlite";
import type { InferSchemaType, SchemaDefinition, SQLQueryBindings, WhereCondition } from "./types";
import { buildWhereClause } from "./where-builder";

/** Conflict resolution strategy for INSERT operations */
export type ConflictResolution = "abort" | "ignore" | "replace";

/**
 * InsertBuilder<T> - A fluent query builder for constructing INSERT queries
 * Queries are only executed when .run() is called
 */
export class InsertBuilder<T, S extends SchemaDefinition = SchemaDefinition> {
  private db: Database;
  private tableName: string;
  private _data: Partial<T>;
  private _conflictResolution: ConflictResolution = "abort";
  private _checkCondition: WhereCondition<T> | null = null;
  private statementCache: Map<string, ReturnType<Database["prepare"]>>;
  private schema: S;
  private primaryKey: string | null = null;

  constructor(
    db: Database,
    tableName: string,
    statementCache: Map<string, ReturnType<Database["prepare"]>>,
    data: Partial<T>,
    schema: S,
    primaryKey: string | null = null
  ) {
    this.db = db;
    this.tableName = tableName;
    this.statementCache = statementCache;
    this._data = data;
    this.schema = schema;
    this.primaryKey = primaryKey;
  }

  /**
   * Check if a record already exists before inserting
   * If a record matching the condition exists, the insert will be skipped
   * @param condition - The WHERE condition to check for existing records
   */
  ifNotExists(condition: WhereCondition<T>): InsertBuilder<T, S> {
    this._checkCondition = condition;
    return this;
  }

  /**
   * Use INSERT OR IGNORE - silently skip if unique constraint fails
   */
  orIgnore(): InsertBuilder<T, S> {
    this._conflictResolution = "ignore";
    return this;
  }

  /**
   * Use INSERT OR REPLACE - replace existing record if unique constraint fails
   */
  orReplace(): InsertBuilder<T, S> {
    this._conflictResolution = "replace";
    return this;
  }

  /**
   * Build the SQL query and parameters
   */
  private buildQuery(): { sql: string; params: SQLQueryBindings[] } {
    const keys = Object.keys(this._data);
    const values = Object.values(this._data) as SQLQueryBindings[];
    const placeholders = keys.map(() => "?").join(", ");
    const columns = keys.map((k) => `"${k}"`).join(", ");

    let insertKeyword = "INSERT";
    if (this._conflictResolution === "ignore") {
      insertKeyword = "INSERT OR IGNORE";
    } else if (this._conflictResolution === "replace") {
      insertKeyword = "INSERT OR REPLACE";
    }

    const sql = `${insertKeyword} INTO "${this.tableName}" (${columns}) VALUES (${placeholders})`;
    return { sql, params: values };
  }

  /**
   * Get or create a cached prepared statement
   */
  private getStatement(sql: string): ReturnType<Database["prepare"]> {
    let stmt = this.statementCache.get(sql);
    if (!stmt) {
      stmt = this.db.prepare(sql);
      this.statementCache.set(sql, stmt);
    }
    return stmt;
  }

  /**
   * Check if a record exists matching the condition
   */
  private recordExists(condition: WhereCondition<T>): boolean {
    const params: SQLQueryBindings[] = [];
    const whereClause = buildWhereClause(condition, params);
    
    if (!whereClause) {
      return false;
    }

    const sql = `SELECT EXISTS(SELECT 1 FROM "${this.tableName}" WHERE ${whereClause}) as exists_result`;
    const stmt = this.db.prepare(sql);
    const result = stmt.get(...params) as { exists_result: number };
    return result.exists_result === 1;
  }

  /**
   * Find a record by its primary key
   */
  private findById(id: number | string): T | null {
    if (!this.primaryKey) {
      return null;
    }

    const sql = `SELECT * FROM "${this.tableName}" WHERE "${this.primaryKey}" = ?`;
    const stmt = this.getStatement(sql);
    return (stmt.get(id) as T) || null;
  }

  /**
   * Execute the INSERT query and return the inserted record
   * Returns null if the insert was skipped (due to ifNotExists check or orIgnore)
   */
  run(): T | null {
    // Check if record already exists if ifNotExists was called
    if (this._checkCondition !== null) {
      if (this.recordExists(this._checkCondition)) {
        return null;
      }
    }

    const { sql, params } = this.buildQuery();
    const stmt = this.getStatement(sql);
    stmt.run(...params);

    // Check if any row was affected (for OR IGNORE case)
    const changesStmt = this.getStatement("SELECT changes() as count");
    const changes = (changesStmt.get() as { count: number }).count;
    
    if (changes === 0) {
      // No row was inserted (could be due to OR IGNORE)
      return null;
    }

    // Get the last inserted row
    const lastIdStmt = this.getStatement("SELECT last_insert_rowid() as id");
    const lastId = lastIdStmt.get() as { id: number };

    if (this.primaryKey) {
      return this.findById(lastId.id);
    }

    // If no primary key, return the inserted data
    return { ...this._data } as T;
  }

  /**
   * Get the SQL string for debugging
   */
  toSQL(): { sql: string; params: SQLQueryBindings[] } {
    return this.buildQuery();
  }
}
