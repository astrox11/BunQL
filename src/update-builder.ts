import type { Database } from "bun:sqlite";
import type { ComparisonOperator, OrderBy, OrderDirection, SQLQueryBindings, UpdateData, WhereCondition, WhereOperator } from "./types";
import { buildWhereClause } from "./where-builder";

/**
 * Map comparison operator string to WhereOperator key
 */
function operatorToCondition<V>(operator: ComparisonOperator, value: V): WhereOperator<V> {
  switch (operator) {
    case "=":
      return { $eq: value };
    case "!=":
    case "<>":
      return { $ne: value };
    case ">":
      return { $gt: value };
    case ">=":
      return { $gte: value };
    case "<":
      return { $lt: value };
    case "<=":
      return { $lte: value };
    case "LIKE":
      return { $like: value as unknown as string } as WhereOperator<V>;
    case "NOT LIKE":
      return { $notLike: value as unknown as string } as WhereOperator<V>;
    default:
      return { $eq: value };
  }
}

/**
 * UpdateBuilder<T> - A fluent query builder for constructing UPDATE queries
 * Queries are only executed when .run() is called
 */
export class UpdateBuilder<T> {
  private db: Database;
  private tableName: string;
  private _data: UpdateData<T>;
  private _where: WhereCondition<T> = {};
  private _orConditions: WhereCondition<T>[] = [];
  private _orderBy: OrderBy<T>[] = [];
  private _limit?: number;
  private statementCache: Map<string, ReturnType<Database["prepare"]>>;

  constructor(
    db: Database,
    tableName: string,
    statementCache: Map<string, ReturnType<Database["prepare"]>>,
    data: UpdateData<T>,
    initialWhere?: WhereCondition<T>
  ) {
    this.db = db;
    this.tableName = tableName;
    this.statementCache = statementCache;
    this._data = data;
    if (initialWhere) {
      this._where = { ...initialWhere };
    }
  }

  /**
   * Add WHERE conditions to the query (AND)
   * @overload where(conditions) - Add conditions object
   * @overload where(column, operator, value) - Add single condition with operator
   */
  where(conditions: WhereCondition<T>): UpdateBuilder<T>;
  where<K extends keyof T>(column: K, operator: ComparisonOperator, value: T[K]): UpdateBuilder<T>;
  where<K extends keyof T>(
    conditionsOrColumn: WhereCondition<T> | K,
    operator?: ComparisonOperator,
    value?: T[K]
  ): UpdateBuilder<T> {
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
  orWhere(conditions: WhereCondition<T>): UpdateBuilder<T>;
  orWhere<K extends keyof T>(column: K, operator: ComparisonOperator, value: T[K]): UpdateBuilder<T>;
  orWhere<K extends keyof T>(
    conditionsOrColumn: WhereCondition<T> | K,
    operator?: ComparisonOperator,
    value?: T[K]
  ): UpdateBuilder<T> {
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
   * Add ORDER BY clause to the query (SQLite supports ORDER BY in UPDATE with LIMIT)
   */
  orderBy(column: keyof T, direction: OrderDirection = "ASC"): UpdateBuilder<T> {
    this._orderBy.push({ column, direction });
    return this;
  }

  /**
   * Set LIMIT for the query (SQLite supports LIMIT in UPDATE)
   */
  limit(count: number): UpdateBuilder<T> {
    this._limit = count;
    return this;
  }

  /**
   * Build the SQL query and parameters
   */
  private buildQuery(): { sql: string; params: SQLQueryBindings[] } {
    const params: SQLQueryBindings[] = [];
    
    // Build SET clause
    const updateKeys = Object.keys(this._data);
    const updateValues = Object.values(this._data) as SQLQueryBindings[];
    const setClauses = updateKeys.map((k) => `"${k}" = ?`).join(", ");
    params.push(...updateValues);

    let sql = `UPDATE "${this.tableName}" SET ${setClauses}`;

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

    // ORDER BY clause (SQLite supports this with LIMIT)
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
   * Execute the UPDATE query and return the number of updated records
   */
  run(): number {
    const { sql, params } = this.buildQuery();
    const stmt = this.getStatement(sql);
    stmt.run(...params);

    return (
      this.db.query("SELECT changes() as count").get() as { count: number }
    ).count;
  }

  /**
   * Get the SQL string for debugging
   */
  toSQL(): { sql: string; params: SQLQueryBindings[] } {
    return this.buildQuery();
  }
}
