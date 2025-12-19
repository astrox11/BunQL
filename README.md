### BunQL

A simple, lightweight Object-Relational Mapper designed for Bun’s native SQLite integration. It provides a comprehensive API for database operations, predictable SQL generation, cached prepared statements, and high performance.

### Capabilities

- Zero dependencies, small footprint.

- Built directly on `bun:sqlite` module with cached prepared statements.

- SQL-first approach with no decorators or reflection.

- Automatic table creation from schema definitions.

- Full transaction support.

- Advanced query operators such as: `comparison`, `IN`, `BETWEEN`, `LIKE`.

### Getting Started

##### Install
```bash
bun add @realastrox11/bunql
```

##### Create Model
```javascript
import { BunQL } from "@realastrox11/bunql";

const ql = new BunQL({ filename: ":memory:" });

const User = ql.define("user", {
  id: { type: "INTEGER", primary: true, autoIncrement: true },
  email: { type: "TEXT", unique: true },
  username: { type: "TEXT" },
  created_at: { type: "INTEGER" }
});

// Insert
const user = User.insert({
  email: "a@mail.com",
  username: "alice",
  created_at: Date.now()
});

// Query
const found = User.find({ email: "a@mail.com" }).first();
const allUsers = User.all();

// Update
User.updateById(1, { username: "alice_updated" });

// Delete
User.deleteById(1);
```

### License

MIT License
Copyright (c) 2024 astrox11
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software.
