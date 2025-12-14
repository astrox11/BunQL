import type { Database } from "bun:sqlite";
import type { OrderBy, OrderDirection, SQLQueryBindings, WhereCondition } from "./types";

/**
 * QueryBuilder<T> - A fluent query builder for constructing SQL queries
 * Queries are only executed when .all(), .first(), or .run() are called
 */
export class QueryBuilder<T> {
  private db: Database;
  private tableName: string;
  private _where: WhereCondition<T> = {};
  private _orderBy: OrderBy<T>[] = [];
  private _limit?: number;
  private _offset?: number;
  private _select: string[] = ["*"];
  private statementCache: Map<string, ReturnType<Database["prepare"]>>;

  constructor(
    db: Database,
    tableName: string,
    statementCache: Map<string, ReturnType<Database["prepare"]>>,
    initialWhere?: WhereCondition<T>
  ) {
    this.db = db;
    this.tableName = tableName;
    this.statementCache = statementCache;
    if (initialWhere) {
      this._where = { ...initialWhere };
    }
  }

  /**
   * Add WHERE conditions to the query
   */
  where(conditions: WhereCondition<T>): QueryBuilder<T> {
    this._where = { ...this._where, ...conditions };
    return this;
  }

  /**
   * Add ORDER BY clause to the query
   */
  orderBy(column: keyof T, direction: OrderDirection = "ASC"): QueryBuilder<T> {
    this._orderBy.push({ column, direction });
    return this;
  }

  /**
   * Set LIMIT for the query
   */
  limit(count: number): QueryBuilder<T> {
    this._limit = count;
    return this;
  }

  /**
   * Set OFFSET for the query
   */
  offset(count: number): QueryBuilder<T> {
    this._offset = count;
    return this;
  }

  /**
   * Select specific columns
   */
  select(...columns: (keyof T)[]): QueryBuilder<T> {
    this._select = columns as string[];
    return this;
  }

  /**
   * Build the SQL query and parameters
   */
  private buildQuery(): { sql: string; params: SQLQueryBindings[] } {
    const params: SQLQueryBindings[] = [];
    let sql = `SELECT ${this._select.join(", ")} FROM "${this.tableName}"`;

    // WHERE clause
    const whereKeys = Object.keys(this._where) as (keyof T)[];
    if (whereKeys.length > 0) {
      const conditions = whereKeys.map((key) => {
        params.push(this._where[key] as SQLQueryBindings);
        return `"${String(key)}" = ?`;
      });
      sql += ` WHERE ${conditions.join(" AND ")}`;
    }

    // ORDER BY clause
    if (this._orderBy.length > 0) {
      const orderClauses = this._orderBy.map(
        (o) => `"${String(o.column)}" ${o.direction || "ASC"}`
      );
      sql += ` ORDER BY ${orderClauses.join(", ")}`;
    }

    // LIMIT clause
    if (this._limit !== undefined) {
      sql += ` LIMIT ${this._limit}`;
    }

    // OFFSET clause
    if (this._offset !== undefined) {
      sql += ` OFFSET ${this._offset}`;
    }

    return { sql, params };
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
    const { sql, params } = this.buildQuery();
    const stmt = this.getStatement(sql);
    return stmt.all(...params) as T[];
  }

  /**
   * Execute query and return the first matching row
   */
  first(): T | null {
    this._limit = 1;
    const { sql, params } = this.buildQuery();
    const stmt = this.getStatement(sql);
    return (stmt.get(...params) as T) || null;
  }

  /**
   * Execute query and return raw results (alias for all())
   */
  run(): T[] {
    return this.all();
  }

  /**
   * Get the SQL string for debugging
   */
  toSQL(): { sql: string; params: SQLQueryBindings[] } {
    return this.buildQuery();
  }
}
