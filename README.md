# BunQL

A minimal high performance ORM for Bun using bun:sqlite. Thin and SQL first with no decorators, no reflection, no runtime magic.

## Features

- 🚀 **High Performance** - Built directly on bun:sqlite with cached prepared statements
- 📦 **Minimal** - Zero dependencies, small footprint
- 🔒 **Type Safe** - Strong TypeScript inference for schemas and queries
- 🎯 **SQL First** - Predictable, debuggable SQL generation
- 💾 **Transaction Support** - Automatic and manual transaction control
- ⚡ **Auto Table Creation** - Tables created automatically from schema definitions
- 🔍 **Advanced Queries** - Comparison operators, IN, BETWEEN, LIKE, and more
- 📊 **Aggregations** - SUM, AVG, MIN, MAX, COUNT with optional grouping
- 🔄 **Upsert Support** - INSERT OR REPLACE and ON CONFLICT handling

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
User.findById(1);        // Returns T | null
User.findByIdOrFail(1);  // Returns T, throws if not found

// Get all records
User.all();  // Returns T[]

// Count records
User.count();                      // Count all
User.count({ status: "active" });  // Count with filter

// Check existence
User.exists();                     // Check if any records exist
User.exists({ email: "a@b.com" }); // Check with filter

// Get single column values
User.pluck("email");               // Returns string[]
User.distinct("role");             // Returns unique values
```

#### Aggregate Methods

```typescript
// Sum of a column
User.sum("balance");                      // Sum all
User.sum("balance", { status: "active" }); // Sum with filter

// Average of a column
User.avg("age");

// Minimum value
User.min("created_at");

// Maximum value  
User.max("score");

// Increment/Decrement
User.increment("login_count");            // Increment by 1
User.increment("points", 10);             // Increment by 10
User.increment("points", 5, { id: 1 });   // Increment with filter
User.decrement("credits", 25);            // Decrement by 25
```

#### Mutation Methods

```typescript
// Insert
User.insert({ email: "test@example.com", username: "test" });  // Returns T
User.insertMany([{ email: "a@example.com" }, { email: "b@example.com" }]);  // Returns T[]

// Update
User.update({ email: "old@example.com" }, { email: "new@example.com" });  // Returns affected count
User.updateById(1, { email: "new@example.com" });  // Returns boolean

// Upsert (Insert or Replace)
User.upsert({ id: 1, email: "test@example.com", name: "Test" });  // INSERT OR REPLACE

// Upsert with conflict handling
User.upsertOn(
  { email: "test@example.com", name: "New Name" },
  ["email"],  // Conflict columns
);

// Delete
User.delete({ email: "test@example.com" });  // Returns affected count
User.deleteById(1);  // Returns boolean

// Truncate (delete all and reset autoincrement)
User.truncate();
```

### QueryBuilder Class

The QueryBuilder provides a fluent API for constructing queries. Queries are only executed when you call `.all()`, `.first()`, or `.run()`.

```typescript
User.find({ status: "active" })
  .where({ role: "admin" })      // Add WHERE conditions (AND)
  .orWhere({ role: "superuser" }) // Add OR conditions
  .orderBy("name", "ASC")        // Add ORDER BY
  .limit(10)                     // Set LIMIT
  .offset(20)                    // Set OFFSET
  .select("id", "name", "email") // Select specific columns
  .distinct()                    // Select DISTINCT rows
  .groupBy("department")         // Group results
  .having({ count: { $gt: 5 } }) // Filter groups
  .toSQL();                      // Get { sql, params } for debugging
```

#### Execution Methods

```typescript
.all()          // Returns T[] - all matching records
.first()        // Returns T | null - first matching record
.firstOrFail()  // Returns T - throws if no record found
.run()          // Alias for .all()
.exists()       // Returns boolean - check if any records match
.count()        // Returns number - count matching records
.sum("column")  // Returns number - sum of column
.avg("column")  // Returns number - average of column
.min("column")  // Returns number - minimum value
.max("column")  // Returns number - maximum value
.pluck("column") // Returns T[K][] - array of column values
```

### Advanced WHERE Operators

BunQL supports advanced comparison operators for flexible queries:

```typescript
// Greater than
User.find({ age: { $gt: 18 } });

// Greater than or equal
User.find({ age: { $gte: 21 } });

// Less than
User.find({ price: { $lt: 100 } });

// Less than or equal
User.find({ price: { $lte: 50 } });

// Not equal
User.find({ status: { $ne: "deleted" } });

// LIKE pattern matching
User.find({ email: { $like: "%@gmail.com" } });

// NOT LIKE
User.find({ name: { $notLike: "Admin%" } });

// IN array
User.find({ role: { $in: ["admin", "moderator"] } });

// NOT IN array
User.find({ status: { $notIn: ["banned", "suspended"] } });

// BETWEEN range
User.find({ price: { $between: [10, 100] } });

// IS NULL / IS NOT NULL
User.find({ deleted_at: { $isNull: true } });
User.find({ email: { $isNull: false } });

// Combine multiple operators
User.find({ 
  age: { $gte: 18, $lt: 65 },
  status: { $ne: "inactive" }
});
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