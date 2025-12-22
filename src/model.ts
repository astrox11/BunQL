import type { Database } from "bun:sqlite";
import type {
  ColumnDefinition,
  InferSchemaType,
  SchemaDefinition,
  SQLQueryBindings,
  UpdateData,
  WhereCondition,
} from "./types";
import { QueryBuilder } from "./query-builder";
import { RawQueryBuilder } from "./raw-query-builder";
import { DeleteBuilder } from "./delete-builder";
import { UpdateBuilder } from "./update-builder";
import { InsertBuilder } from "./insert-builder";
import { buildWhereClause } from "./where-builder";
import { createResultProxy, ResultProxy } from "./result-proxy";

/**
 * Model<T> - Represents a database table with typed CRUD operations
 */
export class Model<S extends SchemaDefinition> {
  private db: Database;
  private tableName: string;
  private schema: S;
  private statementCache: Map<string, ReturnType<Database["prepare"]>>;
  private primaryKey: string | null = null;

  constructor(
    db: Database,
    tableName: string,
    schema: S,
    statementCache: Map<string, ReturnType<Database["prepare"]>>
  ) {
    this.db = db;
    this.tableName = tableName;
    this.schema = schema;
    this.statementCache = statementCache;

    // Find primary key
    for (const [key, def] of Object.entries(schema)) {
      if (def.primary) {
        this.primaryKey = key;
        break;
      }
    }
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
   * Create a QueryBuilder with optional initial WHERE conditions
   */
  find(
    where?: WhereCondition<InferSchemaType<S>>
  ): QueryBuilder<InferSchemaType<S>> {
    return new QueryBuilder<InferSchemaType<S>>(
      this.db,
      this.tableName,
      this.statementCache,
      where,
      this.primaryKey
    );
  }

  /**
   * Create a QueryBuilder for SELECT queries with fluent chaining
   * @example
   * const users = User.select().where("lid", "=", id).get();
   * const activeUsers = User.select().where({ status: "active" }).orderBy("name").all();
   */
  select(
    where?: WhereCondition<InferSchemaType<S>>
  ): QueryBuilder<InferSchemaType<S>> {
    return new QueryBuilder<InferSchemaType<S>>(
      this.db,
      this.tableName,
      this.statementCache,
      where,
      this.primaryKey
    );
  }

  /**
   * Create a QueryBuilder for SELECT queries with fluent chaining, or execute raw SQL
   * Alias for select() method, providing a more intuitive API for querying
   * @overload query(where) - Create a QueryBuilder with optional initial WHERE conditions
   * @overload query(rawSql) - Execute raw SQL query and return results
   * @overload query(rawSql, params) - Execute raw SQL query with parameters
   * @example
   * // QueryBuilder pattern
   * const contact = Contact.query().where("lid", "=", lid).first();
   * const users = User.query().where("status", "=", "active").all();
   * 
   * // Raw SQL pattern
   * const results = User.query("SELECT * FROM user WHERE status = 'active'");
   * const paramResults = User.query("SELECT * FROM user WHERE id = ?", [1]);
   */
  query(rawSql: string, params?: SQLQueryBindings[]): RawQueryBuilder<InferSchemaType<S>>;
  query(where?: WhereCondition<InferSchemaType<S>>): QueryBuilder<InferSchemaType<S>>;
  query(
    whereOrRawSql?: WhereCondition<InferSchemaType<S>> | string,
    params?: SQLQueryBindings[]
  ): QueryBuilder<InferSchemaType<S>> | RawQueryBuilder<InferSchemaType<S>> {
    // If a string is passed, treat it as raw SQL
    if (typeof whereOrRawSql === "string") {
      return new RawQueryBuilder<InferSchemaType<S>>(
        this.db,
        this.tableName,
        this.statementCache,
        this.primaryKey,
        whereOrRawSql,
        params
      );
    }
    
    // Otherwise, create a QueryBuilder
    return new QueryBuilder<InferSchemaType<S>>(
      this.db,
      this.tableName,
      this.statementCache,
      whereOrRawSql,
      this.primaryKey
    );
  }

  /**
   * Find a record by its primary key
   * Returns a result with chainable methods like delete(), update(), save()
   */
  findById(id: number | string): (InferSchemaType<S> & ResultProxy<InferSchemaType<S>>) | null {
    if (!this.primaryKey) {
      throw new Error(`No primary key defined for table "${this.tableName}"`);
    }

    const sql = `SELECT * FROM "${this.tableName}" WHERE "${this.primaryKey}" = ?`;
    const stmt = this.getStatement(sql);
    const data = (stmt.get(id) as InferSchemaType<S>) || null;
    return createResultProxy<InferSchemaType<S>>(
      this.db,
      this.tableName,
      this.statementCache,
      this.primaryKey,
      data
    );
  }

  /**
   * Insert a new record (immediate execution)
   */
  insert(data: Partial<InferSchemaType<S>>): InferSchemaType<S> {
    const keys = Object.keys(data);
    const values = Object.values(data) as SQLQueryBindings[];
    const placeholders = keys.map(() => "?").join(", ");
    const columns = keys.map((k) => `"${k}"`).join(", ");

    const sql = `INSERT INTO "${this.tableName}" (${columns}) VALUES (${placeholders})`;
    const stmt = this.getStatement(sql);
    stmt.run(...values);

    // Get the last inserted row
    const lastId = this.db.query("SELECT last_insert_rowid() as id").get() as {
      id: number;
    };

    if (this.primaryKey) {
      return this.findById(lastId.id) as InferSchemaType<S>;
    }

    // If no primary key, return the inserted data merged with defaults
    return { ...data } as InferSchemaType<S>;
  }

  /**
   * Create an InsertBuilder for fluent chaining with options like ifNotExists, orIgnore, orReplace
   * @example
   * // Insert with existence check (avoids UNIQUE constraint errors)
   * const user = User.insertBuilder({ email: "test@example.com", name: "Test" })
   *   .ifNotExists({ email: "test@example.com" })
   *   .run();
   * 
   * // Insert with OR IGNORE (silently skip on conflict)
   * const user = User.insertBuilder({ email: "test@example.com", name: "Test" })
   *   .orIgnore()
   *   .run();
   * 
   * // Insert with OR REPLACE (replace on conflict)
   * const user = User.insertBuilder({ email: "test@example.com", name: "Test" })
   *   .orReplace()
   *   .run();
   */
  insertBuilder(data: Partial<InferSchemaType<S>>): InsertBuilder<InferSchemaType<S>, S> {
    return new InsertBuilder<InferSchemaType<S>, S>(
      this.db,
      this.tableName,
      this.statementCache,
      data,
      this.schema,
      this.primaryKey
    );
  }

  /**
   * Insert multiple records at once
   */
  insertMany(dataArray: Partial<InferSchemaType<S>>[]): InferSchemaType<S>[] {
    if (dataArray.length === 0) return [];

    const results: InferSchemaType<S>[] = [];
    for (const data of dataArray) {
      results.push(this.insert(data));
    }
    return results;
  }

  /**
   * Update records matching the WHERE conditions or return an UpdateBuilder for chaining
   * @overload When called with just data, returns an UpdateBuilder for fluent chaining
   * @overload When called with a WhereCondition and data, executes immediately and returns the count
   */
  update(data: UpdateData<InferSchemaType<S>>): UpdateBuilder<InferSchemaType<S>>;
  update(where: WhereCondition<InferSchemaType<S>>, data: UpdateData<InferSchemaType<S>>): number;
  update(
    whereOrData: WhereCondition<InferSchemaType<S>> | UpdateData<InferSchemaType<S>>,
    data?: UpdateData<InferSchemaType<S>>
  ): UpdateBuilder<InferSchemaType<S>> | number {
    // If only one argument, return an UpdateBuilder for chaining
    if (data === undefined) {
      return new UpdateBuilder<InferSchemaType<S>>(
        this.db,
        this.tableName,
        this.statementCache,
        whereOrData as UpdateData<InferSchemaType<S>>
      );
    }

    // Otherwise, execute immediately (existing behavior)
    const where = whereOrData as WhereCondition<InferSchemaType<S>>;
    const updateKeys = Object.keys(data);
    const updateValues = Object.values(data) as SQLQueryBindings[];
    const setClauses = updateKeys.map((k) => `"${k}" = ?`).join(", ");

    const whereKeys = Object.keys(where);
    const whereValues = Object.values(where) as SQLQueryBindings[];
    const whereConditions = whereKeys.map((k) => `"${k}" = ?`).join(" AND ");

    const sql = `UPDATE "${this.tableName}" SET ${setClauses} WHERE ${whereConditions}`;
    const stmt = this.getStatement(sql);
    stmt.run(...updateValues, ...whereValues);

    return (
      this.db.query("SELECT changes() as count").get() as { count: number }
    ).count;
  }

  /**
   * Update a record by its primary key
   */
  updateById(
    id: number | string,
    data: UpdateData<InferSchemaType<S>>
  ): boolean {
    if (!this.primaryKey) {
      throw new Error(`No primary key defined for table "${this.tableName}"`);
    }

    const changes = this.update(
      { [this.primaryKey]: id } as WhereCondition<InferSchemaType<S>>,
      data
    );
    return changes > 0;
  }

  /**
   * Delete records matching the WHERE conditions or return a DeleteBuilder for chaining
   * @overload When called with no arguments, returns a DeleteBuilder for fluent chaining
   * @overload When called with a WhereCondition, executes immediately and returns the count
   */
  delete(): DeleteBuilder<InferSchemaType<S>>;
  delete(where: WhereCondition<InferSchemaType<S>>): number;
  delete(where?: WhereCondition<InferSchemaType<S>>): DeleteBuilder<InferSchemaType<S>> | number {
    // If no argument, return a DeleteBuilder for chaining
    if (where === undefined) {
      return new DeleteBuilder<InferSchemaType<S>>(
        this.db,
        this.tableName,
        this.statementCache
      );
    }

    // Otherwise, execute immediately (existing behavior)
    const whereKeys = Object.keys(where);
    const whereValues = Object.values(where) as SQLQueryBindings[];
    const whereConditions = whereKeys.map((k) => `"${k}" = ?`).join(" AND ");

    const sql = `DELETE FROM "${this.tableName}" WHERE ${whereConditions}`;
    const stmt = this.getStatement(sql);
    stmt.run(...whereValues);

    return (
      this.db.query("SELECT changes() as count").get() as { count: number }
    ).count;
  }

  /**
   * Delete a record by its primary key
   */
  deleteById(id: number | string): boolean {
    if (!this.primaryKey) {
      throw new Error(`No primary key defined for table "${this.tableName}"`);
    }

    const changes = this.delete({
      [this.primaryKey]: id,
    } as WhereCondition<InferSchemaType<S>>) as number;
    return changes > 0;
  }

  /**
   * Count records matching the WHERE conditions
   */
  count(where?: WhereCondition<InferSchemaType<S>>): number {
    let sql = `SELECT COUNT(*) as count FROM "${this.tableName}"`;
    const params: SQLQueryBindings[] = [];

    if (where) {
      const whereKeys = Object.keys(where);
      if (whereKeys.length > 0) {
        const whereConditions = whereKeys.map((k) => {
          params.push(where[k as keyof typeof where] as SQLQueryBindings);
          return `"${k}" = ?`;
        });
        sql += ` WHERE ${whereConditions.join(" AND ")}`;
      }
    }

    const stmt = this.getStatement(sql);
    return (stmt.get(...params) as { count: number }).count;
  }

  /**
   * Get all records from the table
   */
  all(): InferSchemaType<S>[] {
    const sql = `SELECT * FROM "${this.tableName}"`;
    const stmt = this.getStatement(sql);
    return stmt.all() as InferSchemaType<S>[];
  }

  /**
   * Insert or replace a record (upsert)
   * Uses SQLite's INSERT OR REPLACE
   */
  upsert(data: Partial<InferSchemaType<S>>): InferSchemaType<S> {
    const keys = Object.keys(data);
    const values = Object.values(data) as SQLQueryBindings[];
    const placeholders = keys.map(() => "?").join(", ");
    const columns = keys.map((k) => `"${k}"`).join(", ");

    const sql = `INSERT OR REPLACE INTO "${this.tableName}" (${columns}) VALUES (${placeholders})`;
    const stmt = this.getStatement(sql);
    stmt.run(...values);

    // Get the last inserted row
    const lastId = this.db.query("SELECT last_insert_rowid() as id").get() as {
      id: number;
    };

    if (this.primaryKey) {
      return this.findById(lastId.id) as InferSchemaType<S>;
    }

    return { ...data } as InferSchemaType<S>;
  }

  /**
   * Insert or update on conflict (more granular upsert)
   * Uses SQLite's INSERT ... ON CONFLICT DO UPDATE
   */
  upsertOn(
    data: Partial<InferSchemaType<S>>,
    conflictColumns: (keyof InferSchemaType<S>)[],
    updateData?: UpdateData<InferSchemaType<S>>
  ): InferSchemaType<S> {
    const keys = Object.keys(data);
    const values = Object.values(data) as SQLQueryBindings[];
    const placeholders = keys.map(() => "?").join(", ");
    const columns = keys.map((k) => `"${k}"`).join(", ");
    const conflictCols = conflictColumns.map((c) => `"${String(c)}"`).join(", ");

    // Determine what to update on conflict
    const updateKeys = updateData ? Object.keys(updateData) : keys.filter(k => !conflictColumns.includes(k as keyof InferSchemaType<S>));
    const updateValues = updateData ? Object.values(updateData) as SQLQueryBindings[] : [];
    const updateClauses = updateKeys.map((k) => `"${k}" = excluded."${k}"`).join(", ");

    let sql = `INSERT INTO "${this.tableName}" (${columns}) VALUES (${placeholders})`;
    sql += ` ON CONFLICT (${conflictCols}) DO UPDATE SET ${updateClauses}`;

    const stmt = this.getStatement(sql);
    stmt.run(...values, ...updateValues);

    // Get the last inserted/updated row
    const lastId = this.db.query("SELECT last_insert_rowid() as id").get() as {
      id: number;
    };

    if (this.primaryKey) {
      return this.findById(lastId.id) as InferSchemaType<S>;
    }

    return { ...data } as InferSchemaType<S>;
  }

  /**
   * Check if any records exist matching the conditions
   */
  exists(where?: WhereCondition<InferSchemaType<S>>): boolean {
    return this.find(where).exists();
  }

  /**
   * Find a record by primary key or throw an error
   * Returns a result with chainable methods like delete(), update(), save()
   */
  findByIdOrFail(id: number | string): InferSchemaType<S> & ResultProxy<InferSchemaType<S>> {
    const result = this.findById(id);
    if (result === null) {
      throw new Error(`Record with id "${id}" not found in table "${this.tableName}"`);
    }
    return result;
  }

  /**
   * Get array of values for a single column
   */
  pluck<K extends keyof InferSchemaType<S>>(column: K, where?: WhereCondition<InferSchemaType<S>>): InferSchemaType<S>[K][] {
    return this.find(where).pluck(column);
  }

  /**
   * Get distinct values for a column
   */
  distinct<K extends keyof InferSchemaType<S>>(column: K, where?: WhereCondition<InferSchemaType<S>>): InferSchemaType<S>[K][] {
    const sql = where 
      ? this.find(where).select(column as keyof InferSchemaType<S>).distinct().toSQL()
      : { sql: `SELECT DISTINCT "${String(column)}" FROM "${this.tableName}"`, params: [] };
    
    const stmt = this.db.prepare(sql.sql);
    const results = stmt.all(...sql.params) as Record<string, InferSchemaType<S>[K]>[];
    return results.map(row => row[String(column) as string]);
  }

  /**
   * Get the sum of a column
   */
  sum(column: keyof InferSchemaType<S>, where?: WhereCondition<InferSchemaType<S>>): number {
    return this.find(where).sum(column);
  }

  /**
   * Get the average of a column
   */
  avg(column: keyof InferSchemaType<S>, where?: WhereCondition<InferSchemaType<S>>): number {
    return this.find(where).avg(column);
  }

  /**
   * Get the minimum value of a column
   */
  min(column: keyof InferSchemaType<S>, where?: WhereCondition<InferSchemaType<S>>): number {
    return this.find(where).min(column);
  }

  /**
   * Get the maximum value of a column
   */
  max(column: keyof InferSchemaType<S>, where?: WhereCondition<InferSchemaType<S>>): number {
    return this.find(where).max(column);
  }

  /**
   * Increment a column value
   */
  increment(
    column: keyof InferSchemaType<S>,
    amount: number = 1,
    where?: WhereCondition<InferSchemaType<S>>
  ): number {
    let sql = `UPDATE "${this.tableName}" SET "${String(column)}" = "${String(column)}" + ?`;
    const params: SQLQueryBindings[] = [amount];

    if (where) {
      const whereClause = buildWhereClause(where, params);
      if (whereClause) {
        sql += ` WHERE ${whereClause}`;
      }
    }

    const stmt = this.getStatement(sql);
    stmt.run(...params);

    return (
      this.db.query("SELECT changes() as count").get() as { count: number }
    ).count;
  }

  /**
   * Decrement a column value
   */
  decrement(
    column: keyof InferSchemaType<S>,
    amount: number = 1,
    where?: WhereCondition<InferSchemaType<S>>
  ): number {
    return this.increment(column, -amount, where);
  }

  /**
   * Truncate the table (delete all records)
   */
  truncate(): void {
    const sql = `DELETE FROM "${this.tableName}"`;
    this.db.exec(sql);
    // Reset autoincrement counter - use parameterized query for safety
    const resetSeqStmt = this.db.prepare("DELETE FROM sqlite_sequence WHERE name = ?");
    resetSeqStmt.run(this.tableName);
  }

  /**
   * Get the table name
   */
  getTableName(): string {
    return this.tableName;
  }

  /**
   * Get the schema definition
   */
  getSchema(): S {
    return this.schema;
  }

  /**
   * Generate CREATE TABLE SQL for this model
   */
  toCreateTableSQL(): string {
    return generateCreateTableSQL(this.tableName, this.schema);
  }
}

/**
 * Generate CREATE TABLE SQL from schema definition
 */
export function generateCreateTableSQL(
  tableName: string,
  schema: SchemaDefinition
): string {
  const columns: string[] = [];

  for (const [name, def] of Object.entries(schema)) {
    let col = `"${name}" ${def.type}`;

    if (def.primary) {
      col += " PRIMARY KEY";
    }
    if (def.autoIncrement) {
      col += " AUTOINCREMENT";
    }
    if (def.unique && !def.primary) {
      col += " UNIQUE";
    }
    if (def.notNull && !def.primary) {
      col += " NOT NULL";
    }
    if (def.default !== undefined) {
      const defaultValue =
        typeof def.default === "string" ? `'${def.default}'` : def.default;
      col += ` DEFAULT ${defaultValue}`;
    }

    columns.push(col);
  }

  return `CREATE TABLE IF NOT EXISTS "${tableName}" (${columns.join(", ")})`;
}
