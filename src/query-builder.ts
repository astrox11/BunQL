import type { Database } from "bun:sqlite";
import type { AggregateFunction, OrderBy, OrderDirection, SQLQueryBindings, WhereCondition, WhereOperator } from "./types";

/**
 * QueryBuilder<T> - A fluent query builder for constructing SQL queries
 * Queries are only executed when .all(), .first(), or .run() are called
 */
export class QueryBuilder<T> {
  private db: Database;
  private tableName: string;
  private _where: WhereCondition<T> = {};
  private _orConditions: WhereCondition<T>[] = [];
  private _orderBy: OrderBy<T>[] = [];
  private _limit?: number;
  private _offset?: number;
  private _select: string[] = ["*"];
  private _distinct: boolean = false;
  private _groupBy: (keyof T)[] = [];
  private _having: WhereCondition<T> = {};
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
   * Add WHERE conditions to the query (AND)
   */
  where(conditions: WhereCondition<T>): QueryBuilder<T> {
    this._where = { ...this._where, ...conditions };
    return this;
  }

  /**
   * Add OR conditions to the query
   */
  orWhere(conditions: WhereCondition<T>): QueryBuilder<T> {
    this._orConditions.push(conditions);
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
   * Select DISTINCT rows
   */
  distinct(): QueryBuilder<T> {
    this._distinct = true;
    return this;
  }

  /**
   * Add GROUP BY clause
   */
  groupBy(...columns: (keyof T)[]): QueryBuilder<T> {
    this._groupBy = columns;
    return this;
  }

  /**
   * Add HAVING clause (for use with GROUP BY)
   */
  having(conditions: WhereCondition<T>): QueryBuilder<T> {
    this._having = { ...this._having, ...conditions };
    return this;
  }

  /**
   * Check if a value is a WhereOperator object
   */
  private isWhereOperator<V>(value: unknown): value is WhereOperator<V> {
    if (value === null || typeof value !== "object") return false;
    const ops = ["$eq", "$ne", "$gt", "$gte", "$lt", "$lte", "$like", "$notLike", "$in", "$notIn", "$between", "$isNull"];
    return ops.some(op => op in (value as Record<string, unknown>));
  }

  /**
   * Build conditions for a single key-value pair with operator support
   */
  private buildCondition(key: string, value: unknown, params: SQLQueryBindings[]): string {
    const column = `"${key}"`;

    if (this.isWhereOperator(value)) {
      const conditions: string[] = [];
      const op = value as WhereOperator<SQLQueryBindings>;

      if (op.$eq !== undefined) {
        params.push(op.$eq);
        conditions.push(`${column} = ?`);
      }
      if (op.$ne !== undefined) {
        params.push(op.$ne);
        conditions.push(`${column} != ?`);
      }
      if (op.$gt !== undefined) {
        params.push(op.$gt);
        conditions.push(`${column} > ?`);
      }
      if (op.$gte !== undefined) {
        params.push(op.$gte);
        conditions.push(`${column} >= ?`);
      }
      if (op.$lt !== undefined) {
        params.push(op.$lt);
        conditions.push(`${column} < ?`);
      }
      if (op.$lte !== undefined) {
        params.push(op.$lte);
        conditions.push(`${column} <= ?`);
      }
      if (op.$like !== undefined) {
        params.push(op.$like);
        conditions.push(`${column} LIKE ?`);
      }
      if (op.$notLike !== undefined) {
        params.push(op.$notLike);
        conditions.push(`${column} NOT LIKE ?`);
      }
      if (op.$in !== undefined && Array.isArray(op.$in)) {
        const placeholders = op.$in.map(() => "?").join(", ");
        params.push(...(op.$in as SQLQueryBindings[]));
        conditions.push(`${column} IN (${placeholders})`);
      }
      if (op.$notIn !== undefined && Array.isArray(op.$notIn)) {
        const placeholders = op.$notIn.map(() => "?").join(", ");
        params.push(...(op.$notIn as SQLQueryBindings[]));
        conditions.push(`${column} NOT IN (${placeholders})`);
      }
      if (op.$between !== undefined && Array.isArray(op.$between)) {
        params.push(op.$between[0] as SQLQueryBindings, op.$between[1] as SQLQueryBindings);
        conditions.push(`${column} BETWEEN ? AND ?`);
      }
      if (op.$isNull !== undefined) {
        conditions.push(op.$isNull ? `${column} IS NULL` : `${column} IS NOT NULL`);
      }

      return conditions.join(" AND ");
    }

    // Simple equality check
    params.push(value as SQLQueryBindings);
    return `${column} = ?`;
  }

  /**
   * Build WHERE clause from conditions object
   */
  private buildWhereClause(where: WhereCondition<T>, params: SQLQueryBindings[]): string {
    const whereKeys = Object.keys(where) as (keyof T)[];
    if (whereKeys.length === 0) return "";

    const conditions = whereKeys.map((key) => {
      return this.buildCondition(String(key), where[key], params);
    });

    return conditions.join(" AND ");
  }

  /**
   * Build the SQL query and parameters
   */
  private buildQuery(): { sql: string; params: SQLQueryBindings[] } {
    const params: SQLQueryBindings[] = [];
    const selectClause = this._distinct ? "SELECT DISTINCT" : "SELECT";
    let sql = `${selectClause} ${this._select.join(", ")} FROM "${this.tableName}"`;

    // WHERE clause
    const whereClause = this.buildWhereClause(this._where, params);
    const orClauses = this._orConditions.map(orCond => {
      const orParams: SQLQueryBindings[] = [];
      const clause = this.buildWhereClause(orCond, orParams);
      params.push(...orParams);
      return `(${clause})`;
    });

    if (whereClause || orClauses.length > 0) {
      const allConditions: string[] = [];
      if (whereClause) {
        allConditions.push(`(${whereClause})`);
      }
      if (orClauses.length > 0) {
        if (allConditions.length > 0) {
          sql += ` WHERE ${allConditions.join(" AND ")} OR ${orClauses.join(" OR ")}`;
        } else {
          sql += ` WHERE ${orClauses.join(" OR ")}`;
        }
      } else {
        sql += ` WHERE ${whereClause}`;
      }
    }

    // GROUP BY clause
    if (this._groupBy.length > 0) {
      const groupCols = this._groupBy.map(c => `"${String(c)}"`);
      sql += ` GROUP BY ${groupCols.join(", ")}`;
    }

    // HAVING clause
    const havingClause = this.buildWhereClause(this._having, params);
    if (havingClause) {
      sql += ` HAVING ${havingClause}`;
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
   * Execute query and return the first matching row or throw an error
   */
  firstOrFail(): T {
    const result = this.first();
    if (result === null) {
      throw new Error(`No record found in table "${this.tableName}"`);
    }
    return result;
  }

  /**
   * Check if any records exist matching the query
   */
  exists(): boolean {
    const { sql, params } = this.buildQuery();
    const existsSql = `SELECT EXISTS(${sql}) as exists_result`;
    const stmt = this.db.prepare(existsSql);
    const result = stmt.get(...params) as { exists_result: number };
    return result.exists_result === 1;
  }

  /**
   * Get array of values for a single column
   */
  pluck<K extends keyof T>(column: K): T[K][] {
    this._select = [String(column)];
    const results = this.all();
    return results.map(row => row[column]);
  }

  /**
   * Execute query and return raw results (alias for all())
   */
  run(): T[] {
    return this.all();
  }

  /**
   * Get the count of matching records
   */
  count(): number {
    const params: SQLQueryBindings[] = [];
    let sql = `SELECT COUNT(*) as count FROM "${this.tableName}"`;
    
    const whereClause = this.buildWhereClause(this._where, params);
    if (whereClause) {
      sql += ` WHERE ${whereClause}`;
    }

    const stmt = this.db.prepare(sql);
    const result = stmt.get(...params) as { count: number };
    return result.count;
  }

  /**
   * Get the sum of a column
   */
  sum(column: keyof T): number {
    return this.aggregate("SUM", column);
  }

  /**
   * Get the average of a column
   */
  avg(column: keyof T): number {
    return this.aggregate("AVG", column);
  }

  /**
   * Get the minimum value of a column
   */
  min(column: keyof T): number {
    return this.aggregate("MIN", column);
  }

  /**
   * Get the maximum value of a column
   */
  max(column: keyof T): number {
    return this.aggregate("MAX", column);
  }

  /**
   * Execute an aggregate function
   */
  private aggregate(fn: AggregateFunction, column: keyof T): number {
    const params: SQLQueryBindings[] = [];
    let sql = `SELECT ${fn}("${String(column)}") as result FROM "${this.tableName}"`;
    
    const whereClause = this.buildWhereClause(this._where, params);
    if (whereClause) {
      sql += ` WHERE ${whereClause}`;
    }

    if (this._groupBy.length > 0) {
      const groupCols = this._groupBy.map(c => `"${String(c)}"`);
      sql += ` GROUP BY ${groupCols.join(", ")}`;
    }

    const stmt = this.db.prepare(sql);
    const result = stmt.get(...params) as { result: number | null };
    return result.result ?? 0;
  }

  /**
   * Get the SQL string for debugging
   */
  toSQL(): { sql: string; params: SQLQueryBindings[] } {
    return this.buildQuery();
  }
}
