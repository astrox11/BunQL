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
      where
    );
  }

  /**
   * Find a record by its primary key
   */
  findById(id: number | string): InferSchemaType<S> | null {
    if (!this.primaryKey) {
      throw new Error(`No primary key defined for table "${this.tableName}"`);
    }

    const sql = `SELECT * FROM "${this.tableName}" WHERE "${this.primaryKey}" = ?`;
    const stmt = this.getStatement(sql);
    return (stmt.get(id) as InferSchemaType<S>) || null;
  }

  /**
   * Insert a new record
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
   * Update records matching the WHERE conditions
   */
  update(
    where: WhereCondition<InferSchemaType<S>>,
    data: UpdateData<InferSchemaType<S>>
  ): number {
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
   * Delete records matching the WHERE conditions
   */
  delete(where: WhereCondition<InferSchemaType<S>>): number {
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
    } as WhereCondition<InferSchemaType<S>>);
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
