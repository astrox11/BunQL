import { Database } from "bun:sqlite";
import type {
  BunQLConfig,
  InferSchemaType,
  SchemaDefinition,
  SQLQueryBindings,
  TransactionCallback,
} from "./types";
import { Model, generateCreateTableSQL } from "./model";

/**
 * BunQL - A minimal high performance ORM for Bun using bun:sqlite
 * 
 * @example
 * ```typescript
 * import { BunQL } from "bunql";
 * 
 * const ql = new BunQL({ filename: ":memory:", create: true });
 * 
 * const User = ql.define("user", {
 *   id: { type: "INTEGER", primary: true, autoIncrement: true },
 *   email: { type: "TEXT", unique: true },
 *   username: { type: "TEXT" },
 *   created_at: { type: "INTEGER" }
 * });
 * 
 * const user = User.insert({ email: "a@mail.com", username: "alice", created_at: Date.now() });
 * const found = User.find({ email: "a@mail.com" }).first();
 * ```
 */
export class BunQL {
  private db: Database;
  private config: BunQLConfig;
  private statementCache: Map<string, ReturnType<Database["prepare"]>>;
  private models: Map<string, Model<SchemaDefinition>>;

  constructor(config: BunQLConfig) {
    this.config = {
      wal: true,
      strict: false,
      create: true,
      ...config,
    };

    // Create database connection
    this.db = new Database(this.config.filename, {
      strict: this.config.strict,
      create: this.config.create,
    });

    // Enable WAL mode for better concurrent performance
    if (this.config.wal) {
      this.db.exec("PRAGMA journal_mode = WAL");
    }

    // Initialize caches
    this.statementCache = new Map();
    this.models = new Map();
  }

  /**
   * Define a new model/table with the given schema
   * Automatically creates the table if it doesn't exist
   */
  define<S extends SchemaDefinition>(
    tableName: string,
    schema: S
  ): Model<S> {
    // Generate and execute CREATE TABLE SQL
    const createSQL = generateCreateTableSQL(tableName, schema);
    this.db.exec(createSQL);

    // Create and cache the model
    const model = new Model<S>(
      this.db,
      tableName,
      schema,
      this.statementCache
    );

    this.models.set(tableName, model as unknown as Model<SchemaDefinition>);

    return model;
  }

  /**
   * Get a previously defined model by table name
   */
  getModel<S extends SchemaDefinition>(tableName: string): Model<S> | undefined {
    return this.models.get(tableName) as Model<S> | undefined;
  }

  /**
   * Execute a raw SQL query
   */
  exec(sql: string): void {
    this.db.exec(sql);
  }

  /**
   * Execute a raw SQL query with parameters and return results
   */
  query<T = unknown>(sql: string, params?: SQLQueryBindings[]): T[] {
    const stmt = this.db.prepare(sql);
    if (params && params.length > 0) {
      return stmt.all(...params) as T[];
    }
    return stmt.all() as T[];
  }

  /**
   * Execute a raw SQL query with parameters and return the first result
   */
  queryOne<T = unknown>(sql: string, params?: SQLQueryBindings[]): T | null {
    const stmt = this.db.prepare(sql);
    if (params && params.length > 0) {
      return (stmt.get(...params) as T) || null;
    }
    return (stmt.get() as T) || null;
  }

  /**
   * Execute operations within a transaction
   * Automatically commits on success, rolls back on error
   */
  transaction<R>(callback: TransactionCallback<R>): R {
    const transaction = this.db.transaction(callback);
    return transaction();
  }

  /**
   * Begin a manual transaction
   */
  beginTransaction(): void {
    this.db.exec("BEGIN TRANSACTION");
  }

  /**
   * Commit the current transaction
   */
  commit(): void {
    this.db.exec("COMMIT");
  }

  /**
   * Rollback the current transaction
   */
  rollback(): void {
    this.db.exec("ROLLBACK");
  }

  /**
   * Get the underlying bun:sqlite Database instance
   */
  getDatabase(): Database {
    return this.db;
  }

  /**
   * Close the database connection and clear caches
   */
  close(): void {
    this.statementCache.clear();
    this.models.clear();
    this.db.close();
  }

  /**
   * Check if the database connection is open
   */
  isOpen(): boolean {
    try {
      this.db.exec("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get database statistics
   */
  stats(): { tables: number; cachedStatements: number } {
    return {
      tables: this.models.size,
      cachedStatements: this.statementCache.size,
    };
  }
}
