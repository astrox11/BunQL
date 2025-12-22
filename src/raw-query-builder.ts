import type { Database } from "bun:sqlite";
import type { SQLQueryBindings } from "./types";
import { createResultProxy, ResultProxy } from "./result-proxy";

/**
 * RawQueryBuilder<T> - Executes raw SQL queries and returns results with chainable methods
 * Used when passing a raw SQL string to Model.query()
 */
export class RawQueryBuilder<T extends Record<string, unknown>> {
  private db: Database;
  private tableName: string;
  private statementCache: Map<string, ReturnType<Database["prepare"]>>;
  private primaryKey: string | null;
  private rawSql: string;
  private params: SQLQueryBindings[];

  constructor(
    db: Database,
    tableName: string,
    statementCache: Map<string, ReturnType<Database["prepare"]>>,
    primaryKey: string | null,
    rawSql: string,
    params?: SQLQueryBindings[]
  ) {
    this.db = db;
    this.tableName = tableName;
    this.statementCache = statementCache;
    this.primaryKey = primaryKey;
    this.rawSql = rawSql;
    this.params = params || [];
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
   * Execute query and return all matching rows
   */
  all(): T[] {
    const stmt = this.getStatement(this.rawSql);
    return stmt.all(...this.params) as T[];
  }

  /**
   * Execute query and return all matching rows (alias for all())
   */
  get(): T[] {
    return this.all();
  }

  /**
   * Execute query and return all matching rows (alias for all())
   */
  run(): T[] {
    return this.all();
  }

  /**
   * Execute query and return the first matching row with chainable methods
   */
  first(): (T & ResultProxy<T>) | null {
    const stmt = this.getStatement(this.rawSql);
    const data = (stmt.get(...this.params) as T) || null;
    return createResultProxy<T>(this.db, this.tableName, this.statementCache, this.primaryKey, data);
  }

  /**
   * Execute query and return the first matching row or throw an error
   */
  firstOrFail(): T & ResultProxy<T> {
    const result = this.first();
    if (result === null) {
      throw new Error(`No record found for raw query`);
    }
    return result;
  }

  /**
   * Check if any records exist matching the query
   */
  exists(): boolean {
    const existsSql = `SELECT EXISTS(${this.rawSql}) as exists_result`;
    const stmt = this.db.prepare(existsSql);
    const result = stmt.get(...this.params) as { exists_result: number };
    return result.exists_result === 1;
  }

  /**
   * Get the count of matching records
   */
  count(): number {
    // Wrap the raw SQL to get a count
    const countSql = `SELECT COUNT(*) as count FROM (${this.rawSql})`;
    const stmt = this.db.prepare(countSql);
    const result = stmt.get(...this.params) as { count: number };
    return result.count;
  }

  /**
   * Get array of values for a single column
   */
  pluck<K extends keyof T>(column: K): T[K][] {
    const results = this.all();
    return results.map(row => row[column]);
  }

  /**
   * Get the SQL string for debugging
   */
  toSQL(): { sql: string; params: SQLQueryBindings[] } {
    return { sql: this.rawSql, params: this.params };
  }
}
