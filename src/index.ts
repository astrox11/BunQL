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
 * // Insert with existence check (avoids UNIQUE constraint errors)
 * const user2 = User.insertBuilder({ email: "a@mail.com", username: "alice" })
 *   .ifNotExists({ email: "a@mail.com" })
 *   .run();
 * 
 * // Query users
 * const found = User.find({ email: "a@mail.com" }).first();
 * const all = User.find().all();
 * const byId = User.findById(1);
 * 
 * // Chainable methods on results (methods that never end)
 * const contact = User.query().where("id", "=", 1).first();
 * contact?.delete(); // Delete the record
 * contact?.update({ username: "new_name" }); // Update the record
 * contact?.username; // Access property
 * 
 * // Raw SQL queries
 * const results = User.query("SELECT * FROM user WHERE status = 'active'");
 * const paramResults = User.query("SELECT * FROM user WHERE id = ?", [1]);
 * 
 * // Update (immediate execution)
 * User.update({ email: "a@mail.com" }, { username: "alice_updated" });
 * 
 * // Update (builder pattern)
 * User.update({ username: "alice_updated" }).where("email", "=", "a@mail.com").run();
 * 
 * // Delete (immediate execution)
 * User.delete({ email: "a@mail.com" });
 * 
 * // Delete (builder pattern)
 * User.delete().where({ status: "inactive" }).orWhere({ expired: true }).run();
 * ```
 */

export { BunQL } from "./bunql";
export { Model } from "./model";
export { QueryBuilder } from "./query-builder";
export { RawQueryBuilder } from "./raw-query-builder";
export { DeleteBuilder } from "./delete-builder";
export { UpdateBuilder } from "./update-builder";
export { InsertBuilder } from "./insert-builder";
export { ResultProxy, createResultProxy } from "./result-proxy";
export type { ConflictResolution } from "./insert-builder";

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
