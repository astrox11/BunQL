import type { Database } from "bun:sqlite";
import type { SQLQueryBindings, UpdateData } from "./types";

/**
 * ResultProxy<T> - Wraps a query result with chainable methods
 * Allows patterns like: Model.query().where(...).first().delete()
 * While still allowing property access: Model.query().where(...).first().propertyName
 */
export class ResultProxy<T extends Record<string, unknown>> {
  private db: Database;
  private tableName: string;
  private statementCache: Map<string, ReturnType<Database["prepare"]>>;
  private primaryKey: string | null;
  private _data: T | null;

  constructor(
    db: Database,
    tableName: string,
    statementCache: Map<string, ReturnType<Database["prepare"]>>,
    primaryKey: string | null,
    data: T | null
  ) {
    this.db = db;
    this.tableName = tableName;
    this.statementCache = statementCache;
    this.primaryKey = primaryKey;
    this._data = data;
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
   * Delete the current record from the database
   * Returns the number of deleted records (0 or 1)
   */
  delete(): number {
    if (this._data === null) {
      return 0;
    }

    if (!this.primaryKey || !(this.primaryKey in this._data)) {
      throw new Error(`Cannot delete: No primary key defined or primary key not found in record`);
    }

    const id = this._data[this.primaryKey] as SQLQueryBindings;
    const sql = `DELETE FROM "${this.tableName}" WHERE "${this.primaryKey}" = ?`;
    const stmt = this.getStatement(sql);
    stmt.run(id);

    return (
      this.db.query("SELECT changes() as count").get() as { count: number }
    ).count;
  }

  /**
   * Update the current record in the database
   * Returns the number of updated records (0 or 1)
   */
  update(data: UpdateData<T>): number {
    if (this._data === null) {
      return 0;
    }

    if (!this.primaryKey || !(this.primaryKey in this._data)) {
      throw new Error(`Cannot update: No primary key defined or primary key not found in record`);
    }

    const id = this._data[this.primaryKey] as SQLQueryBindings;
    const updateKeys = Object.keys(data);
    const updateValues = Object.values(data) as SQLQueryBindings[];
    const setClauses = updateKeys.map((k) => `"${k}" = ?`).join(", ");

    const sql = `UPDATE "${this.tableName}" SET ${setClauses} WHERE "${this.primaryKey}" = ?`;
    const stmt = this.getStatement(sql);
    stmt.run(...updateValues, id);

    return (
      this.db.query("SELECT changes() as count").get() as { count: number }
    ).count;
  }

  /**
   * Save changes made to the record back to the database
   * (Re-inserts/updates the full record)
   * Returns the number of affected records
   */
  save(): number {
    if (this._data === null) {
      return 0;
    }

    if (!this.primaryKey || !(this.primaryKey in this._data)) {
      throw new Error(`Cannot save: No primary key defined or primary key not found in record`);
    }

    const id = this._data[this.primaryKey] as SQLQueryBindings;
    const updateKeys = Object.keys(this._data).filter(k => k !== this.primaryKey);
    const updateValues = updateKeys.map(k => this._data![k] as SQLQueryBindings);
    const setClauses = updateKeys.map((k) => `"${k}" = ?`).join(", ");

    const sql = `UPDATE "${this.tableName}" SET ${setClauses} WHERE "${this.primaryKey}" = ?`;
    const stmt = this.getStatement(sql);
    stmt.run(...updateValues, id);

    return (
      this.db.query("SELECT changes() as count").get() as { count: number }
    ).count;
  }

  /**
   * Refresh the record from the database
   * Returns a new result with the refreshed data and chainable methods
   */
  refresh(): (T & ResultProxy<T>) | null {
    if (this._data === null || !this.primaryKey || !(this.primaryKey in this._data)) {
      return null;
    }

    const id = this._data[this.primaryKey] as SQLQueryBindings;
    const sql = `SELECT * FROM "${this.tableName}" WHERE "${this.primaryKey}" = ?`;
    const stmt = this.getStatement(sql);
    const data = (stmt.get(id) as T) || null;

    return createResultProxy<T>(this.db, this.tableName, this.statementCache, this.primaryKey, data);
  }

  /**
   * Check if the record exists (is not null)
   */
  exists(): boolean {
    return this._data !== null;
  }

  /**
   * Get the underlying data
   */
  toJSON(): T | null {
    return this._data;
  }

  /**
   * Get the underlying data (alias for toJSON)
   */
  getData(): T | null {
    return this._data;
  }

  /**
   * Check if the result is null
   */
  isNull(): boolean {
    return this._data === null;
  }
}

/**
 * Create a ResultProxy that also acts as a Proxy for direct property access
 * This allows: result.propertyName AND result.delete()
 * Returns null when data is null to maintain backward compatibility
 */
export function createResultProxy<T extends Record<string, unknown>>(
  db: Database,
  tableName: string,
  statementCache: Map<string, ReturnType<Database["prepare"]>>,
  primaryKey: string | null,
  data: T | null
): (T & ResultProxy<T>) | null {
  // Return null directly when data is null to maintain backward compatibility
  if (data === null) {
    return null;
  }

  const proxy = new ResultProxy<T>(db, tableName, statementCache, primaryKey, data);
  
  // Type-safe way to access proxy properties
  const proxyAsAny = proxy as unknown as Record<string, unknown>;

  // For non-null results, create a proxy that combines data and methods
  return new Proxy(data as T & ResultProxy<T>, {
    get(target, prop) {
      // First check if it's a method from ResultProxy
      if (prop in proxy && typeof proxyAsAny[prop as string] === "function") {
        return (proxyAsAny[prop as string] as Function).bind(proxy);
      }
      // Then check if it's a property from the data
      if (prop in target) {
        return target[prop as keyof typeof target];
      }
      return undefined;
    },
    set(target, prop, value) {
      // Allow setting properties on the data
      (target as Record<string, unknown>)[prop as string] = value;
      return true;
    },
  });
}
