# BunQL

A minimal high performance ORM for Bun using bun:sqlite. Thin and SQL first with no decorators, no reflection, no runtime magic.

## Features

- 🚀 **High Performance** - Built directly on bun:sqlite with cached prepared statements
- 📦 **Minimal** - Zero dependencies, small footprint
- 🔒 **Type Safe** - Strong TypeScript inference for schemas and queries
- 🎯 **SQL First** - Predictable, debuggable SQL generation
- 💾 **Transaction Support** - Automatic and manual transaction control
- ⚡ **Auto Table Creation** - Tables created automatically from schema definitions

## Installation

```bash
bun add bunql
```

## Quick Start

```typescript
import { BunQL } from "bunql";

// Create a new database connection
const ql = new BunQL({ filename: ":memory:" });

// Define a model with schema
const User = ql.define("user", {
  id: { type: "INTEGER", primary: true, autoIncrement: true },
  email: { type: "TEXT", unique: true },
  username: { type: "TEXT" },
  created_at: { type: "INTEGER" }
});

// Insert a new record
const user = User.insert({
  email: "a@mail.com",
  username: "alice",
  created_at: Date.now()
});

// Query records
const found = User.find({ email: "a@mail.com" }).first();
const allUsers = User.find().all();
const byId = User.findById(1);

// Update records
User.update({ email: "a@mail.com" }, { username: "alice_updated" });
User.updateById(1, { username: "alice_v2" });

// Delete records
User.delete({ email: "a@mail.com" });
User.deleteById(1);
```

## API Reference

### BunQL Class

#### Constructor

```typescript
const ql = new BunQL({
  filename: ":memory:",  // Database file path or ":memory:" for in-memory
  wal: true,             // Enable WAL mode (default: true)
  strict: false,         // Enable strict mode (default: false)
  create: true           // Create database if not exists (default: true)
});
```

#### Methods

- `define<S>(tableName: string, schema: S): Model<S>` - Define a new model/table
- `getModel<S>(tableName: string): Model<S> | undefined` - Get a previously defined model
- `exec(sql: string): void` - Execute raw SQL
- `query<T>(sql: string, params?: SQLQueryBindings[]): T[]` - Query with parameters
- `queryOne<T>(sql: string, params?: SQLQueryBindings[]): T | null` - Query single result
- `transaction<R>(callback: () => R): R` - Execute in transaction
- `beginTransaction(): void` - Begin manual transaction
- `commit(): void` - Commit transaction
- `rollback(): void` - Rollback transaction
- `getDatabase(): Database` - Get underlying bun:sqlite Database
- `close(): void` - Close database connection
- `isOpen(): boolean` - Check if database is open
- `stats(): { tables: number; cachedStatements: number }` - Get statistics

### Model Class

#### Query Methods

```typescript
// Find with QueryBuilder
User.find({ status: "active" })
  .where({ role: "admin" })
  .orderBy("created_at", "DESC")
  .limit(10)
  .offset(0)
  .all();      // Returns T[]
  .first();    // Returns T | null
  .run();      // Alias for all()

// Find by ID
User.findById(1);  // Returns T | null

// Get all records
User.all();  // Returns T[]

// Count records
User.count();                      // Count all
User.count({ status: "active" });  // Count with filter
```

#### Mutation Methods

```typescript
// Insert
User.insert({ email: "test@example.com", username: "test" });  // Returns T
User.insertMany([{ email: "a@example.com" }, { email: "b@example.com" }]);  // Returns T[]

// Update
User.update({ email: "old@example.com" }, { email: "new@example.com" });  // Returns affected count
User.updateById(1, { email: "new@example.com" });  // Returns boolean

// Delete
User.delete({ email: "test@example.com" });  // Returns affected count
User.deleteById(1);  // Returns boolean
```

### QueryBuilder Class

The QueryBuilder provides a fluent API for constructing queries. Queries are only executed when you call `.all()`, `.first()`, or `.run()`.

```typescript
User.find({ status: "active" })
  .where({ role: "admin" })      // Add WHERE conditions
  .orderBy("name", "ASC")        // Add ORDER BY
  .limit(10)                     // Set LIMIT
  .offset(20)                    // Set OFFSET
  .select("id", "name", "email") // Select specific columns
  .toSQL();                      // Get { sql, params } for debugging
```

### Schema Definition

Define columns with the following options:

```typescript
{
  type: "INTEGER" | "TEXT" | "REAL" | "BLOB" | "NULL",
  primary?: boolean,      // PRIMARY KEY
  autoIncrement?: boolean, // AUTOINCREMENT (requires INTEGER primary)
  unique?: boolean,       // UNIQUE constraint
  notNull?: boolean,      // NOT NULL constraint
  default?: unknown       // DEFAULT value
}
```

### Transactions

```typescript
// Automatic transaction (commits on success, rolls back on error)
ql.transaction(() => {
  User.insert({ email: "a@example.com" });
  User.insert({ email: "b@example.com" });
});

// Manual transaction control
ql.beginTransaction();
try {
  User.insert({ email: "test@example.com" });
  ql.commit();
} catch (error) {
  ql.rollback();
  throw error;
}
```

## Type Inference

BunQL provides strong TypeScript inference. The schema definition automatically infers the correct types:

```typescript
const User = ql.define("user", {
  id: { type: "INTEGER", primary: true },
  email: { type: "TEXT" },
  balance: { type: "REAL" },
  data: { type: "BLOB" }
});

// TypeScript knows:
// - id is number
// - email is string
// - balance is number
// - data is Uint8Array

const user = User.findById(1);
// user is { id: number; email: string; balance: number; data: Uint8Array } | null
```

## Performance

BunQL uses cached prepared statements for optimal performance. Statements are cached and reused across calls, minimizing SQL parsing overhead.

```typescript
// These use cached statements
User.findById(1);
User.findById(2);
User.find({ status: "active" }).all();
```

## License

MIT