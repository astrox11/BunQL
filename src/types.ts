/**
 * BunQL Types - Core type definitions for BunQL ORM
 */

/** Supported SQLite column types */
export type ColumnType = "INTEGER" | "TEXT" | "REAL" | "BLOB" | "NULL";

/** Column definition for schema */
export interface ColumnDefinition {
  type: ColumnType;
  primary?: boolean;
  unique?: boolean;
  notNull?: boolean;
  default?: unknown;
  autoIncrement?: boolean;
}

/** Schema definition - maps column names to their definitions */
export type SchemaDefinition = Record<string, ColumnDefinition>;

/** Maps SQLite types to TypeScript types */
export type SQLiteToTS<T extends ColumnType> = 
  T extends "INTEGER" ? number :
  T extends "TEXT" ? string :
  T extends "REAL" ? number :
  T extends "BLOB" ? Uint8Array :
  T extends "NULL" ? null :
  never;

/** Infer TypeScript type from a column definition */
export type InferColumnType<T extends ColumnDefinition> = SQLiteToTS<T["type"]>;

/** Infer TypeScript type from a schema definition */
export type InferSchemaType<T extends SchemaDefinition> = {
  [K in keyof T]: InferColumnType<T[K]>;
};

/** BunQL configuration options */
export interface BunQLConfig {
  /** Path to the SQLite database file or ":memory:" for in-memory database */
  filename: string;
  /** Enable WAL mode for better concurrent performance */
  wal?: boolean;
  /** Enable strict mode for stricter type checking */
  strict?: boolean;
  /** Create tables automatically when models are defined */
  create?: boolean;
}

/** Where clause conditions */
export type WhereCondition<T> = Partial<T>;

/** Order direction */
export type OrderDirection = "ASC" | "DESC";

/** Order by clause */
export type OrderBy<T> = {
  column: keyof T;
  direction?: OrderDirection;
};

/** Query options for find operations */
export interface QueryOptions<T> {
  where?: WhereCondition<T>;
  orderBy?: OrderBy<T> | OrderBy<T>[];
  limit?: number;
  offset?: number;
}

/** Update data type */
export type UpdateData<T> = Partial<T>;

/** Transaction callback type */
export type TransactionCallback<R> = () => R;

/** SQLite query parameter binding types */
export type SQLQueryBindings = string | number | bigint | boolean | null | Uint8Array;
