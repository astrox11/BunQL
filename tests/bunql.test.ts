import { expect, test, describe, beforeEach, afterEach } from "bun:test";
import { BunQL } from "../src";

describe("BunQL", () => {
  let ql: BunQL;

  beforeEach(() => {
    ql = new BunQL({ filename: ":memory:" });
  });

  afterEach(() => {
    ql.close();
  });

  describe("define", () => {
    test("should create a table with the defined schema", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT", unique: true },
        username: { type: "TEXT" },
        created_at: { type: "INTEGER" },
      });

      expect(User).toBeDefined();
      expect(User.getTableName()).toBe("user");
    });

    test("should store and retrieve models", () => {
      const userSchema = {
        id: { type: "INTEGER" as const, primary: true },
        name: { type: "TEXT" as const },
      };

      ql.define("test_user", userSchema);
      const retrieved = ql.getModel("test_user");
      expect(retrieved).toBeDefined();
    });
  });

  describe("Model CRUD operations", () => {
    test("should insert and retrieve a record", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT", unique: true },
        username: { type: "TEXT" },
      });

      const inserted = User.insert({
        email: "test@example.com",
        username: "testuser",
      });

      expect(inserted.id).toBe(1);
      expect(inserted.email).toBe("test@example.com");
      expect(inserted.username).toBe("testuser");
    });

    test("should find record by id", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
      });

      User.insert({ email: "test@example.com" });
      const found = User.findById(1);

      expect(found).not.toBeNull();
      expect(found?.email).toBe("test@example.com");
    });

    test("should find records with where clause", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
        status: { type: "TEXT" },
      });

      User.insert({ email: "active@example.com", status: "active" });
      User.insert({ email: "inactive@example.com", status: "inactive" });

      const activeUsers = User.find({ status: "active" }).all();
      expect(activeUsers).toHaveLength(1);
      expect(activeUsers[0].email).toBe("active@example.com");
    });

    test("should return first matching record", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
      });

      User.insert({ email: "first@example.com" });
      User.insert({ email: "second@example.com" });

      const first = User.find().first();
      expect(first).not.toBeNull();
      expect(first?.email).toBe("first@example.com");
    });

    test("should update records", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
        username: { type: "TEXT" },
      });

      User.insert({ email: "test@example.com", username: "oldname" });
      User.update({ email: "test@example.com" }, { username: "newname" });

      const updated = User.findById(1);
      expect(updated?.username).toBe("newname");
    });

    test("should update record by id", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
      });

      User.insert({ email: "old@example.com" });
      const result = User.updateById(1, { email: "new@example.com" });

      expect(result).toBe(true);
      const updated = User.findById(1);
      expect(updated?.email).toBe("new@example.com");
    });

    test("should delete records", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
      });

      User.insert({ email: "test@example.com" });
      const deletedCount = User.delete({ email: "test@example.com" });

      expect(deletedCount).toBe(1);
      const found = User.findById(1);
      expect(found).toBeNull();
    });

    test("should delete record by id", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
      });

      User.insert({ email: "test@example.com" });
      const result = User.deleteById(1);

      expect(result).toBe(true);
      expect(User.findById(1)).toBeNull();
    });

    test("should count records", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
        status: { type: "TEXT" },
      });

      User.insert({ email: "a@example.com", status: "active" });
      User.insert({ email: "b@example.com", status: "active" });
      User.insert({ email: "c@example.com", status: "inactive" });

      expect(User.count()).toBe(3);
      expect(User.count({ status: "active" })).toBe(2);
    });

    test("should get all records", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
      });

      User.insert({ email: "a@example.com" });
      User.insert({ email: "b@example.com" });

      const all = User.all();
      expect(all).toHaveLength(2);
    });

    test("should insert many records", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
      });

      const results = User.insertMany([
        { email: "a@example.com" },
        { email: "b@example.com" },
        { email: "c@example.com" },
      ]);

      expect(results).toHaveLength(3);
      expect(User.count()).toBe(3);
    });
  });

  describe("QueryBuilder", () => {
    test("should support chained where conditions", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
        status: { type: "TEXT" },
        role: { type: "TEXT" },
      });

      User.insert({ email: "a@example.com", status: "active", role: "admin" });
      User.insert({ email: "b@example.com", status: "active", role: "user" });
      User.insert({ email: "c@example.com", status: "inactive", role: "admin" });

      const results = User.find({ status: "active" }).where({ role: "admin" }).all();
      expect(results).toHaveLength(1);
      expect(results[0].email).toBe("a@example.com");
    });

    test("should support orderBy", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        name: { type: "TEXT" },
      });

      User.insert({ name: "Charlie" });
      User.insert({ name: "Alice" });
      User.insert({ name: "Bob" });

      const ascResults = User.find().orderBy("name", "ASC").all();
      expect(ascResults[0].name).toBe("Alice");
      expect(ascResults[2].name).toBe("Charlie");

      const descResults = User.find().orderBy("name", "DESC").all();
      expect(descResults[0].name).toBe("Charlie");
      expect(descResults[2].name).toBe("Alice");
    });

    test("should support limit", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
      });

      User.insert({ email: "a@example.com" });
      User.insert({ email: "b@example.com" });
      User.insert({ email: "c@example.com" });

      const results = User.find().limit(2).all();
      expect(results).toHaveLength(2);
    });

    test("should support offset", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
      });

      User.insert({ email: "a@example.com" });
      User.insert({ email: "b@example.com" });
      User.insert({ email: "c@example.com" });

      const results = User.find().offset(1).limit(2).all();
      expect(results).toHaveLength(2);
      expect(results[0].email).toBe("b@example.com");
    });

    test("should expose toSQL for debugging", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
      });

      const { sql, params } = User.find({ email: "test@example.com" }).toSQL();
      expect(sql).toContain("SELECT");
      expect(sql).toContain("WHERE");
      expect(params).toContain("test@example.com");
    });

    test("should run() as alias for all()", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
      });

      User.insert({ email: "test@example.com" });
      const results = User.find().run();
      expect(results).toHaveLength(1);
    });
  });

  describe("Transactions", () => {
    test("should commit transaction on success", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
      });

      ql.transaction(() => {
        User.insert({ email: "a@example.com" });
        User.insert({ email: "b@example.com" });
      });

      expect(User.count()).toBe(2);
    });

    test("should rollback transaction on error", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT", unique: true },
      });

      expect(() => {
        ql.transaction(() => {
          User.insert({ email: "test@example.com" });
          User.insert({ email: "test@example.com" }); // Duplicate - will fail
        });
      }).toThrow();

      expect(User.count()).toBe(0);
    });

    test("should support manual transaction control", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
      });

      ql.beginTransaction();
      User.insert({ email: "test@example.com" });
      ql.commit();

      expect(User.count()).toBe(1);
    });

    test("should support manual rollback", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
      });

      ql.beginTransaction();
      User.insert({ email: "test@example.com" });
      ql.rollback();

      expect(User.count()).toBe(0);
    });
  });

  describe("Raw SQL", () => {
    test("should execute raw SQL with exec", () => {
      ql.exec("CREATE TABLE raw_test (id INTEGER PRIMARY KEY, value TEXT)");
      ql.exec("INSERT INTO raw_test (value) VALUES ('test')");

      const results = ql.query<{ id: number; value: string }>(
        "SELECT * FROM raw_test"
      );
      expect(results).toHaveLength(1);
      expect(results[0].value).toBe("test");
    });

    test("should query with parameters", () => {
      ql.exec("CREATE TABLE param_test (id INTEGER PRIMARY KEY, value TEXT)");
      ql.exec("INSERT INTO param_test (value) VALUES ('test')");

      const results = ql.query<{ id: number; value: string }>(
        "SELECT * FROM param_test WHERE value = ?",
        ["test"]
      );
      expect(results).toHaveLength(1);
    });

    test("should queryOne for single result", () => {
      ql.exec("CREATE TABLE single_test (id INTEGER PRIMARY KEY, value TEXT)");
      ql.exec("INSERT INTO single_test (value) VALUES ('test')");

      const result = ql.queryOne<{ id: number; value: string }>(
        "SELECT * FROM single_test WHERE id = ?",
        [1]
      );
      expect(result?.value).toBe("test");
    });
  });

  describe("Database management", () => {
    test("should report open status", () => {
      expect(ql.isOpen()).toBe(true);
    });

    test("should provide database statistics", () => {
      ql.define("test1", { id: { type: "INTEGER", primary: true } });
      ql.define("test2", { id: { type: "INTEGER", primary: true } });

      const stats = ql.stats();
      expect(stats.tables).toBe(2);
    });

    test("should provide access to underlying database", () => {
      const db = ql.getDatabase();
      expect(db).toBeDefined();
    });
  });

  describe("Schema features", () => {
    test("should support default values", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        status: { type: "TEXT", default: "active" },
      });

      ql.exec("INSERT INTO user DEFAULT VALUES");
      const user = User.findById(1);
      expect(user?.status).toBe("active");
    });

    test("should support NOT NULL constraint", () => {
      ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT", notNull: true },
      });

      expect(() => {
        ql.exec("INSERT INTO user (id) VALUES (1)");
      }).toThrow();
    });

    test("should generate correct CREATE TABLE SQL", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT", unique: true, notNull: true },
        status: { type: "TEXT", default: "active" },
      });

      const sql = User.toCreateTableSQL();
      expect(sql).toContain("CREATE TABLE IF NOT EXISTS");
      expect(sql).toContain("PRIMARY KEY");
      expect(sql).toContain("AUTOINCREMENT");
      expect(sql).toContain("UNIQUE");
      expect(sql).toContain("NOT NULL");
      expect(sql).toContain("DEFAULT");
    });
  });
});
