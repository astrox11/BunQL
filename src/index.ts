/**
 * BunQL - A minimal high performance ORM for Bun using bun:sqlite
 * 
 * Thin and SQL first with no decorators, no reflection, no runtime magic.
 * Built directly on bun:sqlite with cached prepared statements, 
 * transaction support, and strong TypeScript inference.
 * 
 * @example
 * ```typescript
 * import { BunQL } from "bunql";
 * 
 * const ql = new BunQL({ filename: ":memory:" });
 * 
 * const User = ql.define("user", {
 *   id: { type: "INTEGER", primary: true, autoIncrement: true },
 *   email: { type: "TEXT", unique: true },
 *   username: { type: "TEXT" },
 *   created_at: { type: "INTEGER" }
 * });
 * 
 * // Insert a new user
 * const user = User.insert({ email: "a@mail.com", username: "alice", created_at: Date.now() });
 * 
 * // Query users
 * const found = User.find({ email: "a@mail.com" }).first();
 * const all = User.find().all();
 * const byId = User.findById(1);
 * 
 * // Update
 * User.update({ email: "a@mail.com" }, { username: "alice_updated" });
 * 
 * // Delete
 * User.delete({ email: "a@mail.com" });
 * ```
 */

export { BunQL } from "./bunql";
export { Model } from "./model";
export { QueryBuilder } from "./query-builder";

export type {
  AdvancedWhereCondition,
  AggregateFunction,
  AndCondition,
  BunQLConfig,
  ColumnDefinition,
  ColumnType,
  ComparisonOperator,
  InferSchemaType,
  OrderBy,
  OrderDirection,
  OrCondition,
  QueryOptions,
  SchemaDefinition,
  SQLQueryBindings,
  TransactionCallback,
  UpdateData,
  WhereCondition,
  WhereOperator,
  WhereValue,
} from "./types";
