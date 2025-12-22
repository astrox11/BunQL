import type { Database } from "bun:sqlite";
import type { AggregateFunction, ComparisonOperator, OrderBy, OrderDirection, SQLQueryBindings, UpdateData, WhereCondition } from "./types";
import { buildCondition, buildWhereClause, isWhereOperator, operatorToCondition } from "./where-builder";
import { createResultProxy, ResultProxy } from "./result-proxy";

/**
 * QueryBuilder<T> - A fluent query builder for constructing SQL queries
 * Queries are only executed when .all(), .first(), or .run() are called
 */
export class QueryBuilder<T extends Record<string, unknown>> {
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
  private primaryKey: string | null;

  constructor(
    db: Database,
    tableName: string,
    statementCache: Map<string, ReturnType<Database["prepare"]>>,
    initialWhere?: WhereCondition<T>,
    primaryKey?: string | null
  ) {
    this.db = db;
    this.tableName = tableName;
    this.statementCache = statementCache;
    this.primaryKey = primaryKey ?? null;
    if (initialWhere) {
      this._where = { ...initialWhere };
    }
  }

  /**
   * Add WHERE conditions to the query (AND)
   * @overload where(conditions) - Add conditions object
   * @overload where(column, operator, value) - Add single condition with operator
   */
  where(conditions: WhereCondition<T>): QueryBuilder<T>;
  where<K extends keyof T>(column: K, operator: ComparisonOperator, value: T[K]): QueryBuilder<T>;
  where<K extends keyof T>(
    conditionsOrColumn: WhereCondition<T> | K,
    operator?: ComparisonOperator,
    value?: T[K]
  ): QueryBuilder<T> {
    if (typeof conditionsOrColumn === "string" && operator !== undefined && value !== undefined) {
      // Called as where(column, operator, value)
      const condition = operatorToCondition(operator, value);
      this._where = { ...this._where, [conditionsOrColumn]: condition } as WhereCondition<T>;
    } else {
      // Called as where(conditions)
      this._where = { ...this._where, ...(conditionsOrColumn as WhereCondition<T>) };
    }
    return this;
  }

  /**
   * Add OR conditions to the query
   * @overload orWhere(conditions) - Add conditions object
   * @overload orWhere(column, operator, value) - Add single condition with operator
   */
  orWhere(conditions: WhereCondition<T>): QueryBuilder<T>;
  orWhere<K extends keyof T>(column: K, operator: ComparisonOperator, value: T[K]): QueryBuilder<T>;
  orWhere<K extends keyof T>(
    conditionsOrColumn: WhereCondition<T> | K,
    operator?: ComparisonOperator,
    value?: T[K]
  ): QueryBuilder<T> {
    if (typeof conditionsOrColumn === "string" && operator !== undefined && value !== undefined) {
      // Called as orWhere(column, operator, value)
      const condition = operatorToCondition(operator, value);
      this._orConditions.push({ [conditionsOrColumn]: condition } as WhereCondition<T>);
    } else {
      // Called as orWhere(conditions)
      this._orConditions.push(conditionsOrColumn as WhereCondition<T>);
    }
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
   * Build the SQL query and parameters
   */
  private buildQuery(): { sql: string; params: SQLQueryBindings[] } {
    const params: SQLQueryBindings[] = [];
    const selectClause = this._distinct ? "SELECT DISTINCT" : "SELECT";
    let sql = `${selectClause} ${this._select.join(", ")} FROM "${this.tableName}"`;

    // WHERE clause
    const whereClause = buildWhereClause(this._where, params);
    const orClauses = this._orConditions.map(orCond => {
      const orParams: SQLQueryBindings[] = [];
      const clause = buildWhereClause(orCond, orParams);
      params.push(...orParams);
      return `(${clause})`;
    });

    if (whereClause || orClauses.length > 0) {
      if (whereClause && orClauses.length > 0) {
        // Combine AND conditions with OR conditions: (AND conditions) OR (OR condition 1) OR (OR condition 2)
        sql += ` WHERE (${whereClause}) OR ${orClauses.join(" OR ")}`;
      } else if (orClauses.length > 0) {
        sql += ` WHERE ${orClauses.join(" OR ")}`;
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
    const havingClause = buildWhereClause(this._having, params);
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
   * Execute query and return the first matching row with chainable methods
   * The result has both the data properties AND methods like delete(), update(), save()
   * @example
   * const user = User.query().where("id", "=", 1).first();
   * user?.name; // Access property
   * user?.delete(); // Delete the record
   * user?.update({ name: "New Name" }); // Update the record
   */
  first(): (T & ResultProxy<T>) | null {
    this._limit = 1;
    const { sql, params } = this.buildQuery();
    const stmt = this.getStatement(sql);
    const data = (stmt.get(...params) as T) || null;
    return createResultProxy<T>(this.db, this.tableName, this.statementCache, this.primaryKey, data);
  }

  /**
   * Execute query and return the first matching row or throw an error
   * The result has both the data properties AND methods like delete(), update(), save()
   */
  firstOrFail(): T & ResultProxy<T> {
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
   * Execute query and return all matching rows (alias for all())
   */
  get(): T[] {
    return this.all();
  }

  /**
   * Get the count of matching records
   */
  count(): number {
    const params: SQLQueryBindings[] = [];
    let sql = `SELECT COUNT(*) as count FROM "${this.tableName}"`;
    
    const whereClause = buildWhereClause(this._where, params);
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
    
    const whereClause = buildWhereClause(this._where, params);
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
