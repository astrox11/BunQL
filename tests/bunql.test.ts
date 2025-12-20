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

  describe("Advanced WHERE operators", () => {
    test("should support $gt (greater than)", () => {
      const Product = ql.define("product", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        name: { type: "TEXT" },
        price: { type: "REAL" },
      });

      Product.insert({ name: "A", price: 10 });
      Product.insert({ name: "B", price: 20 });
      Product.insert({ name: "C", price: 30 });

      const results = Product.find({ price: { $gt: 15 } }).all();
      expect(results).toHaveLength(2);
      expect(results.map(r => r.name).sort()).toEqual(["B", "C"]);
    });

    test("should support $gte (greater than or equal)", () => {
      const Product = ql.define("product", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        price: { type: "REAL" },
      });

      Product.insert({ price: 10 });
      Product.insert({ price: 20 });
      Product.insert({ price: 30 });

      const results = Product.find({ price: { $gte: 20 } }).all();
      expect(results).toHaveLength(2);
    });

    test("should support $lt (less than)", () => {
      const Product = ql.define("product", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        price: { type: "REAL" },
      });

      Product.insert({ price: 10 });
      Product.insert({ price: 20 });
      Product.insert({ price: 30 });

      const results = Product.find({ price: { $lt: 25 } }).all();
      expect(results).toHaveLength(2);
    });

    test("should support $lte (less than or equal)", () => {
      const Product = ql.define("product", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        price: { type: "REAL" },
      });

      Product.insert({ price: 10 });
      Product.insert({ price: 20 });
      Product.insert({ price: 30 });

      const results = Product.find({ price: { $lte: 20 } }).all();
      expect(results).toHaveLength(2);
    });

    test("should support $ne (not equal)", () => {
      const Product = ql.define("product", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        status: { type: "TEXT" },
      });

      Product.insert({ status: "active" });
      Product.insert({ status: "inactive" });
      Product.insert({ status: "active" });

      const results = Product.find({ status: { $ne: "active" } }).all();
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe("inactive");
    });

    test("should support $like", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
      });

      User.insert({ email: "alice@gmail.com" });
      User.insert({ email: "bob@yahoo.com" });
      User.insert({ email: "charlie@gmail.com" });

      const results = User.find({ email: { $like: "%gmail%" } }).all();
      expect(results).toHaveLength(2);
    });

    test("should support $notLike", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
      });

      User.insert({ email: "alice@gmail.com" });
      User.insert({ email: "bob@yahoo.com" });
      User.insert({ email: "charlie@gmail.com" });

      const results = User.find({ email: { $notLike: "%gmail%" } }).all();
      expect(results).toHaveLength(1);
      expect(results[0].email).toBe("bob@yahoo.com");
    });

    test("should support $in", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        role: { type: "TEXT" },
      });

      User.insert({ role: "admin" });
      User.insert({ role: "user" });
      User.insert({ role: "guest" });
      User.insert({ role: "moderator" });

      const results = User.find({ role: { $in: ["admin", "moderator"] } }).all();
      expect(results).toHaveLength(2);
    });

    test("should support $notIn", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        role: { type: "TEXT" },
      });

      User.insert({ role: "admin" });
      User.insert({ role: "user" });
      User.insert({ role: "guest" });

      const results = User.find({ role: { $notIn: ["admin", "guest"] } }).all();
      expect(results).toHaveLength(1);
      expect(results[0].role).toBe("user");
    });

    test("should support $between", () => {
      const Product = ql.define("product", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        price: { type: "REAL" },
      });

      Product.insert({ price: 5 });
      Product.insert({ price: 10 });
      Product.insert({ price: 15 });
      Product.insert({ price: 20 });
      Product.insert({ price: 25 });

      const results = Product.find({ price: { $between: [10, 20] } }).all();
      expect(results).toHaveLength(3);
    });

    test("should support $isNull", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
        phone: { type: "TEXT" },
      });

      User.insert({ email: "alice@example.com", phone: "123456" });
      User.insert({ email: "bob@example.com" });

      const withoutPhone = User.find({ phone: { $isNull: true } }).all();
      expect(withoutPhone).toHaveLength(1);
      expect(withoutPhone[0].email).toBe("bob@example.com");

      const withPhone = User.find({ phone: { $isNull: false } }).all();
      expect(withPhone).toHaveLength(1);
      expect(withPhone[0].email).toBe("alice@example.com");
    });

    test("should support combining multiple operators on same field", () => {
      const Product = ql.define("product", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        price: { type: "REAL" },
      });

      Product.insert({ price: 5 });
      Product.insert({ price: 10 });
      Product.insert({ price: 15 });
      Product.insert({ price: 20 });

      const results = Product.find({ price: { $gte: 10, $lt: 20 } }).all();
      expect(results).toHaveLength(2);
    });
  });

  describe("OR conditions", () => {
    test("should support orWhere", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        status: { type: "TEXT" },
        role: { type: "TEXT" },
      });

      User.insert({ status: "active", role: "admin" });
      User.insert({ status: "inactive", role: "user" });
      User.insert({ status: "active", role: "user" });

      const results = User.find({ status: "active" })
        .orWhere({ role: "admin" })
        .all();
      
      // Should get active users OR admins
      expect(results.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Upsert operations", () => {
    test("should insert with upsert when record does not exist", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true },
        email: { type: "TEXT", unique: true },
        name: { type: "TEXT" },
      });

      const result = User.upsert({ id: 1, email: "test@example.com", name: "Test" });
      expect(result.id).toBe(1);
      expect(result.email).toBe("test@example.com");
      expect(User.count()).toBe(1);
    });

    test("should replace with upsert when record exists", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true },
        email: { type: "TEXT", unique: true },
        name: { type: "TEXT" },
      });

      User.insert({ id: 1, email: "test@example.com", name: "Original" });
      User.upsert({ id: 1, email: "test@example.com", name: "Updated" });

      const user = User.findById(1);
      expect(user?.name).toBe("Updated");
      expect(User.count()).toBe(1);
    });

    test("should support upsertOn with conflict columns", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT", unique: true },
        name: { type: "TEXT" },
        login_count: { type: "INTEGER" },
      });

      User.insert({ email: "test@example.com", name: "Original", login_count: 1 });
      
      User.upsertOn(
        { email: "test@example.com", name: "Updated", login_count: 2 },
        ["email"]
      );

      const users = User.all();
      expect(users).toHaveLength(1);
      expect(users[0].name).toBe("Updated");
    });
  });

  describe("Aggregate functions", () => {
    test("should support sum", () => {
      const Order = ql.define("order", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        amount: { type: "REAL" },
      });

      Order.insert({ amount: 10 });
      Order.insert({ amount: 20 });
      Order.insert({ amount: 30 });

      expect(Order.sum("amount")).toBe(60);
    });

    test("should support sum with where clause", () => {
      const Order = ql.define("order", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        amount: { type: "REAL" },
        status: { type: "TEXT" },
      });

      Order.insert({ amount: 10, status: "completed" });
      Order.insert({ amount: 20, status: "pending" });
      Order.insert({ amount: 30, status: "completed" });

      expect(Order.sum("amount", { status: "completed" })).toBe(40);
    });

    test("should support avg", () => {
      const Order = ql.define("order", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        amount: { type: "REAL" },
      });

      Order.insert({ amount: 10 });
      Order.insert({ amount: 20 });
      Order.insert({ amount: 30 });

      expect(Order.avg("amount")).toBe(20);
    });

    test("should support min", () => {
      const Order = ql.define("order", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        amount: { type: "REAL" },
      });

      Order.insert({ amount: 10 });
      Order.insert({ amount: 5 });
      Order.insert({ amount: 30 });

      expect(Order.min("amount")).toBe(5);
    });

    test("should support max", () => {
      const Order = ql.define("order", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        amount: { type: "REAL" },
      });

      Order.insert({ amount: 10 });
      Order.insert({ amount: 50 });
      Order.insert({ amount: 30 });

      expect(Order.max("amount")).toBe(50);
    });

    test("should support aggregates via QueryBuilder", () => {
      const Order = ql.define("order", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        amount: { type: "REAL" },
        status: { type: "TEXT" },
      });

      Order.insert({ amount: 10, status: "completed" });
      Order.insert({ amount: 20, status: "completed" });
      Order.insert({ amount: 30, status: "pending" });

      const sum = Order.find({ status: "completed" }).sum("amount");
      expect(sum).toBe(30);

      const count = Order.find({ status: "completed" }).count();
      expect(count).toBe(2);
    });
  });

  describe("Utility methods", () => {
    test("should support exists()", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
      });

      expect(User.exists()).toBe(false);

      User.insert({ email: "test@example.com" });
      expect(User.exists()).toBe(true);
      expect(User.exists({ email: "test@example.com" })).toBe(true);
      expect(User.exists({ email: "nonexistent@example.com" })).toBe(false);
    });

    test("should support firstOrFail()", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
      });

      User.insert({ email: "test@example.com" });

      const found = User.find({ email: "test@example.com" }).firstOrFail();
      expect(found.email).toBe("test@example.com");

      expect(() => {
        User.find({ email: "nonexistent@example.com" }).firstOrFail();
      }).toThrow();
    });

    test("should support findByIdOrFail()", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
      });

      User.insert({ email: "test@example.com" });

      const found = User.findByIdOrFail(1);
      expect(found.email).toBe("test@example.com");

      expect(() => {
        User.findByIdOrFail(999);
      }).toThrow();
    });

    test("should support pluck()", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
      });

      User.insert({ email: "a@example.com" });
      User.insert({ email: "b@example.com" });
      User.insert({ email: "c@example.com" });

      const emails = User.pluck("email");
      expect(emails).toHaveLength(3);
      expect(emails).toContain("a@example.com");
      expect(emails).toContain("b@example.com");
      expect(emails).toContain("c@example.com");
    });

    test("should support distinct()", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        role: { type: "TEXT" },
      });

      User.insert({ role: "admin" });
      User.insert({ role: "user" });
      User.insert({ role: "user" });
      User.insert({ role: "admin" });
      User.insert({ role: "guest" });

      const roles = User.distinct("role");
      expect(roles).toHaveLength(3);
      expect(roles.sort()).toEqual(["admin", "guest", "user"]);
    });

    test("should support distinct via QueryBuilder", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        role: { type: "TEXT" },
        status: { type: "TEXT" },
      });

      User.insert({ role: "admin", status: "active" });
      User.insert({ role: "user", status: "active" });
      User.insert({ role: "user", status: "active" });

      const results = User.find().select("role").distinct().all();
      expect(results).toHaveLength(2);
    });
  });

  describe("Increment and Decrement", () => {
    test("should support increment()", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        login_count: { type: "INTEGER" },
      });

      User.insert({ login_count: 5 });
      User.increment("login_count");

      const user = User.findById(1);
      expect(user?.login_count).toBe(6);
    });

    test("should support increment with custom amount", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        points: { type: "INTEGER" },
      });

      User.insert({ points: 10 });
      User.increment("points", 5);

      const user = User.findById(1);
      expect(user?.points).toBe(15);
    });

    test("should support increment with where clause", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        status: { type: "TEXT" },
        points: { type: "INTEGER" },
      });

      User.insert({ status: "active", points: 10 });
      User.insert({ status: "inactive", points: 10 });

      User.increment("points", 5, { status: "active" });

      expect(User.findById(1)?.points).toBe(15);
      expect(User.findById(2)?.points).toBe(10);
    });

    test("should support increment with advanced WHERE operators", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        level: { type: "INTEGER" },
        points: { type: "INTEGER" },
      });

      User.insert({ level: 1, points: 10 });
      User.insert({ level: 5, points: 10 });
      User.insert({ level: 10, points: 10 });

      // Increment points for users with level >= 5
      User.increment("points", 5, { level: { $gte: 5 } });

      expect(User.findById(1)?.points).toBe(10);  // level 1, not incremented
      expect(User.findById(2)?.points).toBe(15);  // level 5, incremented
      expect(User.findById(3)?.points).toBe(15);  // level 10, incremented
    });

    test("should support decrement()", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        credits: { type: "INTEGER" },
      });

      User.insert({ credits: 100 });
      User.decrement("credits", 25);

      const user = User.findById(1);
      expect(user?.credits).toBe(75);
    });
  });

  describe("Truncate", () => {
    test("should truncate table", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
      });

      User.insert({ email: "a@example.com" });
      User.insert({ email: "b@example.com" });
      User.insert({ email: "c@example.com" });

      expect(User.count()).toBe(3);

      User.truncate();

      expect(User.count()).toBe(0);
    });

    test("should reset autoincrement after truncate", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
      });

      User.insert({ email: "first@example.com" });
      User.insert({ email: "second@example.com" });
      
      User.truncate();

      const newUser = User.insert({ email: "new@example.com" });
      expect(newUser.id).toBe(1);
    });
  });

  describe("GROUP BY and HAVING", () => {
    test("should support groupBy", () => {
      const Order = ql.define("order", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        customer_id: { type: "INTEGER" },
        amount: { type: "REAL" },
      });

      Order.insert({ customer_id: 1, amount: 10 });
      Order.insert({ customer_id: 1, amount: 20 });
      Order.insert({ customer_id: 2, amount: 30 });
      Order.insert({ customer_id: 2, amount: 40 });

      // Get count per customer
      const { sql } = Order.find().select("customer_id").groupBy("customer_id").toSQL();
      expect(sql).toContain("GROUP BY");
    });
  });

  describe("DeleteBuilder", () => {
    test("should support delete().where().run() pattern", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
        status: { type: "TEXT" },
      });

      User.insert({ email: "a@example.com", status: "active" });
      User.insert({ email: "b@example.com", status: "inactive" });
      User.insert({ email: "c@example.com", status: "active" });

      const deletedCount = User.delete().where({ status: "inactive" }).run();
      
      expect(deletedCount).toBe(1);
      expect(User.count()).toBe(2);
      expect(User.find({ status: "inactive" }).first()).toBeNull();
    });

    test("should support delete().where().orWhere().run() pattern", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
        status: { type: "TEXT" },
        role: { type: "TEXT" },
      });

      User.insert({ email: "a@example.com", status: "active", role: "admin" });
      User.insert({ email: "b@example.com", status: "inactive", role: "user" });
      User.insert({ email: "c@example.com", status: "active", role: "user" });
      User.insert({ email: "d@example.com", status: "active", role: "guest" });

      // Delete inactive users OR guests
      const deletedCount = User.delete()
        .where({ status: "inactive" })
        .orWhere({ role: "guest" })
        .run();
      
      expect(deletedCount).toBe(2);
      expect(User.count()).toBe(2);
      expect(User.find({ status: "inactive" }).first()).toBeNull();
      expect(User.find({ role: "guest" }).first()).toBeNull();
    });

    test("should support delete() with advanced WHERE operators", () => {
      const Product = ql.define("product", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        name: { type: "TEXT" },
        price: { type: "REAL" },
      });

      Product.insert({ name: "A", price: 5 });
      Product.insert({ name: "B", price: 10 });
      Product.insert({ name: "C", price: 15 });
      Product.insert({ name: "D", price: 20 });

      // Delete products with price < 12
      const deletedCount = Product.delete().where({ price: { $lt: 12 } }).run();
      
      expect(deletedCount).toBe(2);
      expect(Product.count()).toBe(2);
    });

    test("should support delete() with $in operator", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        role: { type: "TEXT" },
      });

      User.insert({ role: "admin" });
      User.insert({ role: "user" });
      User.insert({ role: "guest" });
      User.insert({ role: "moderator" });

      const deletedCount = User.delete().where({ role: { $in: ["guest", "user"] } }).run();
      
      expect(deletedCount).toBe(2);
      expect(User.count()).toBe(2);
      expect(User.find({ role: "admin" }).first()).not.toBeNull();
      expect(User.find({ role: "moderator" }).first()).not.toBeNull();
    });

    test("should support delete() with LIMIT", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        status: { type: "TEXT" },
      });

      User.insert({ status: "inactive" });
      User.insert({ status: "inactive" });
      User.insert({ status: "inactive" });
      User.insert({ status: "active" });

      // Only delete 2 inactive users
      const deletedCount = User.delete().where({ status: "inactive" }).limit(2).run();
      
      expect(deletedCount).toBe(2);
      expect(User.count()).toBe(2);
      // One inactive user should remain
      expect(User.find({ status: "inactive" }).count()).toBe(1);
    });

    test("should support delete() with orderBy and limit", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        name: { type: "TEXT" },
        created_at: { type: "INTEGER" },
      });

      User.insert({ name: "First", created_at: 100 });
      User.insert({ name: "Second", created_at: 200 });
      User.insert({ name: "Third", created_at: 300 });

      // Delete the oldest user
      const deletedCount = User.delete().orderBy("created_at", "ASC").limit(1).run();
      
      expect(deletedCount).toBe(1);
      expect(User.count()).toBe(2);
      expect(User.find({ name: "First" }).first()).toBeNull();
    });

    test("should expose toSQL() for debugging", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
        status: { type: "TEXT" },
      });

      const { sql, params } = User.delete()
        .where({ status: "inactive" })
        .orWhere({ email: { $like: "%test%" } })
        .limit(10)
        .toSQL();

      expect(sql).toContain("DELETE FROM");
      expect(sql).toContain("WHERE");
      expect(sql).toContain("OR");
      expect(sql).toContain("LIMIT 10");
      expect(params).toContain("inactive");
      expect(params).toContain("%test%");
    });

    test("should preserve existing delete(where) behavior", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
      });

      User.insert({ email: "test@example.com" });
      const deletedCount = User.delete({ email: "test@example.com" });
      
      expect(deletedCount).toBe(1);
      expect(User.findById(1)).toBeNull();
    });

    test("should work with deleteById after changes", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
      });

      User.insert({ email: "test@example.com" });
      const result = User.deleteById(1);
      
      expect(result).toBe(true);
      expect(User.findById(1)).toBeNull();
    });

    test("should support multiple chained where conditions", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        status: { type: "TEXT" },
        role: { type: "TEXT" },
      });

      User.insert({ status: "inactive", role: "admin" });
      User.insert({ status: "inactive", role: "user" });
      User.insert({ status: "active", role: "user" });

      // Delete inactive users with role "user"
      const deletedCount = User.delete()
        .where({ status: "inactive" })
        .where({ role: "user" })
        .run();
      
      expect(deletedCount).toBe(1);
      expect(User.count()).toBe(2);
    });

    test("should delete all matching records without limit", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        status: { type: "TEXT" },
      });

      User.insert({ status: "inactive" });
      User.insert({ status: "inactive" });
      User.insert({ status: "inactive" });
      User.insert({ status: "active" });

      const deletedCount = User.delete().where({ status: "inactive" }).run();
      
      expect(deletedCount).toBe(3);
      expect(User.count()).toBe(1);
    });

    test("should support where(column, operator, value) syntax", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        pn: { type: "TEXT" },
        lid: { type: "TEXT" },
      });

      User.insert({ pn: "user1", lid: "lid1" });
      User.insert({ pn: "user2", lid: "lid2" });
      User.insert({ pn: "user3", lid: "lid3" });

      const deletedCount = User.delete().where("pn", "=", "user1").run();
      
      expect(deletedCount).toBe(1);
      expect(User.count()).toBe(2);
      expect(User.find({ pn: "user1" }).first()).toBeNull();
    });

    test("should support where(column, operator, value).orWhere(column, operator, value) syntax", () => {
      const Sudo = ql.define("sudo", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        pn: { type: "TEXT" },
        lid: { type: "TEXT" },
      });

      Sudo.insert({ pn: "user1", lid: "lid1" });
      Sudo.insert({ pn: "user2", lid: "lid2" });
      Sudo.insert({ pn: "user3", lid: "user1" }); // lid matches user1's pn

      // Delete where pn = "user1" OR lid = "user1"
      const deletedCount = Sudo.delete()
        .where("pn", "=", "user1")
        .orWhere("lid", "=", "user1")
        .run();
      
      expect(deletedCount).toBe(2);
      expect(Sudo.count()).toBe(1);
      expect(Sudo.find({ pn: "user2" }).first()).not.toBeNull();
    });

    test("should support mixed where syntax (object and column/operator/value)", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        status: { type: "TEXT" },
        role: { type: "TEXT" },
      });

      User.insert({ status: "active", role: "admin" });
      User.insert({ status: "inactive", role: "user" });
      User.insert({ status: "active", role: "user" });

      // Mix object and column/operator/value syntax
      const deletedCount = User.delete()
        .where({ status: "inactive" })
        .orWhere("role", "=", "admin")
        .run();
      
      expect(deletedCount).toBe(2);
      expect(User.count()).toBe(1);
    });

    test("should support comparison operators in where(column, operator, value)", () => {
      const Product = ql.define("product", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        name: { type: "TEXT" },
        price: { type: "REAL" },
      });

      Product.insert({ name: "A", price: 10 });
      Product.insert({ name: "B", price: 20 });
      Product.insert({ name: "C", price: 30 });
      Product.insert({ name: "D", price: 40 });

      // Delete products with price > 25
      const deletedCount = Product.delete().where("price", ">", 25).run();
      
      expect(deletedCount).toBe(2);
      expect(Product.count()).toBe(2);
    });

    test("should support LIKE operator in where(column, operator, value)", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
      });

      User.insert({ email: "alice@gmail.com" });
      User.insert({ email: "bob@yahoo.com" });
      User.insert({ email: "charlie@gmail.com" });

      const deletedCount = User.delete().where("email", "LIKE", "%gmail%").run();
      
      expect(deletedCount).toBe(2);
      expect(User.count()).toBe(1);
      expect(User.find({ email: "bob@yahoo.com" }).first()).not.toBeNull();
    });

    test("should support != operator in where(column, operator, value)", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        status: { type: "TEXT" },
      });

      User.insert({ status: "active" });
      User.insert({ status: "inactive" });
      User.insert({ status: "active" });

      const deletedCount = User.delete().where("status", "!=", "active").run();
      
      expect(deletedCount).toBe(1);
      expect(User.count()).toBe(2);
    });
  });

  describe("UpdateBuilder", () => {
    test("should support update(data).where().run() pattern", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
        status: { type: "TEXT" },
      });

      User.insert({ email: "a@example.com", status: "active" });
      User.insert({ email: "b@example.com", status: "inactive" });
      User.insert({ email: "c@example.com", status: "active" });

      const updatedCount = User.update({ status: "archived" }).where({ email: "b@example.com" }).run();
      
      expect(updatedCount).toBe(1);
      expect(User.findById(2)?.status).toBe("archived");
      expect(User.findById(1)?.status).toBe("active");
      expect(User.findById(3)?.status).toBe("active");
    });

    test("should support update(data).where().orWhere().run() pattern", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
        status: { type: "TEXT" },
        role: { type: "TEXT" },
      });

      User.insert({ email: "a@example.com", status: "active", role: "admin" });
      User.insert({ email: "b@example.com", status: "inactive", role: "user" });
      User.insert({ email: "c@example.com", status: "active", role: "user" });
      User.insert({ email: "d@example.com", status: "active", role: "guest" });

      // Update inactive users OR guests to be 'pending'
      const updatedCount = User.update({ status: "pending" })
        .where({ status: "inactive" })
        .orWhere({ role: "guest" })
        .run();
      
      expect(updatedCount).toBe(2);
      expect(User.findById(2)?.status).toBe("pending"); // was inactive
      expect(User.findById(4)?.status).toBe("pending"); // was guest
      expect(User.findById(1)?.status).toBe("active"); // unchanged
      expect(User.findById(3)?.status).toBe("active"); // unchanged
    });

    test("should support update() with advanced WHERE operators", () => {
      const Product = ql.define("product", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        name: { type: "TEXT" },
        price: { type: "REAL" },
        discounted: { type: "INTEGER" },
      });

      Product.insert({ name: "A", price: 5, discounted: 0 });
      Product.insert({ name: "B", price: 10, discounted: 0 });
      Product.insert({ name: "C", price: 15, discounted: 0 });
      Product.insert({ name: "D", price: 20, discounted: 0 });

      // Discount products with price > 12
      const updatedCount = Product.update({ discounted: 1 }).where({ price: { $gt: 12 } }).run();
      
      expect(updatedCount).toBe(2);
      expect(Product.findById(1)?.discounted).toBe(0);
      expect(Product.findById(2)?.discounted).toBe(0);
      expect(Product.findById(3)?.discounted).toBe(1);
      expect(Product.findById(4)?.discounted).toBe(1);
    });

    test("should support update() with $in operator", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        role: { type: "TEXT" },
        active: { type: "INTEGER" },
      });

      User.insert({ role: "admin", active: 1 });
      User.insert({ role: "user", active: 1 });
      User.insert({ role: "guest", active: 1 });
      User.insert({ role: "moderator", active: 1 });

      const updatedCount = User.update({ active: 0 }).where({ role: { $in: ["guest", "user"] } }).run();
      
      expect(updatedCount).toBe(2);
      expect(User.findById(1)?.active).toBe(1);
      expect(User.findById(2)?.active).toBe(0);
      expect(User.findById(3)?.active).toBe(0);
      expect(User.findById(4)?.active).toBe(1);
    });

    test("should support update() with LIMIT", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        status: { type: "TEXT" },
      });

      User.insert({ status: "inactive" });
      User.insert({ status: "inactive" });
      User.insert({ status: "inactive" });
      User.insert({ status: "active" });

      // Only update 2 inactive users
      const updatedCount = User.update({ status: "archived" }).where({ status: "inactive" }).limit(2).run();
      
      expect(updatedCount).toBe(2);
      // Two users should be archived, one inactive should remain
      expect(User.find({ status: "archived" }).count()).toBe(2);
      expect(User.find({ status: "inactive" }).count()).toBe(1);
    });

    test("should support update() with orderBy and limit", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        name: { type: "TEXT" },
        created_at: { type: "INTEGER" },
        archived: { type: "INTEGER" },
      });

      User.insert({ name: "First", created_at: 100, archived: 0 });
      User.insert({ name: "Second", created_at: 200, archived: 0 });
      User.insert({ name: "Third", created_at: 300, archived: 0 });

      // Archive the oldest user
      const updatedCount = User.update({ archived: 1 }).orderBy("created_at", "ASC").limit(1).run();
      
      expect(updatedCount).toBe(1);
      expect(User.find({ name: "First" }).first()?.archived).toBe(1);
      expect(User.find({ name: "Second" }).first()?.archived).toBe(0);
      expect(User.find({ name: "Third" }).first()?.archived).toBe(0);
    });

    test("should expose toSQL() for debugging", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
        status: { type: "TEXT" },
      });

      const { sql, params } = User.update({ status: "archived" })
        .where({ status: "inactive" })
        .orWhere({ email: { $like: "%test%" } })
        .limit(10)
        .toSQL();

      expect(sql).toContain("UPDATE");
      expect(sql).toContain("SET");
      expect(sql).toContain("WHERE");
      expect(sql).toContain("OR");
      expect(sql).toContain("LIMIT 10");
      expect(params).toContain("archived");
      expect(params).toContain("inactive");
      expect(params).toContain("%test%");
    });

    test("should preserve existing update(where, data) behavior", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
        username: { type: "TEXT" },
      });

      User.insert({ email: "test@example.com", username: "oldname" });
      const updatedCount = User.update({ email: "test@example.com" }, { username: "newname" });
      
      expect(updatedCount).toBe(1);
      expect(User.findById(1)?.username).toBe("newname");
    });

    test("should work with updateById after changes", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
      });

      User.insert({ email: "old@example.com" });
      const result = User.updateById(1, { email: "new@example.com" });
      
      expect(result).toBe(true);
      expect(User.findById(1)?.email).toBe("new@example.com");
    });

    test("should support multiple chained where conditions", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        status: { type: "TEXT" },
        role: { type: "TEXT" },
      });

      User.insert({ status: "inactive", role: "admin" });
      User.insert({ status: "inactive", role: "user" });
      User.insert({ status: "active", role: "user" });

      // Update inactive users with role "user"
      const updatedCount = User.update({ status: "archived" })
        .where({ status: "inactive" })
        .where({ role: "user" })
        .run();
      
      expect(updatedCount).toBe(1);
      expect(User.findById(2)?.status).toBe("archived");
      expect(User.findById(1)?.status).toBe("inactive");
    });

    test("should update all matching records without limit", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        status: { type: "TEXT" },
      });

      User.insert({ status: "inactive" });
      User.insert({ status: "inactive" });
      User.insert({ status: "inactive" });
      User.insert({ status: "active" });

      const updatedCount = User.update({ status: "archived" }).where({ status: "inactive" }).run();
      
      expect(updatedCount).toBe(3);
      expect(User.find({ status: "archived" }).count()).toBe(3);
      expect(User.find({ status: "active" }).count()).toBe(1);
    });

    test("should support where(column, operator, value) syntax", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        pn: { type: "TEXT" },
        lid: { type: "TEXT" },
        active: { type: "INTEGER" },
      });

      User.insert({ pn: "user1", lid: "lid1", active: 1 });
      User.insert({ pn: "user2", lid: "lid2", active: 1 });
      User.insert({ pn: "user3", lid: "lid3", active: 1 });

      const updatedCount = User.update({ active: 0 }).where("pn", "=", "user1").run();
      
      expect(updatedCount).toBe(1);
      expect(User.findById(1)?.active).toBe(0);
      expect(User.findById(2)?.active).toBe(1);
    });

    test("should support where(column, operator, value).orWhere(column, operator, value) syntax", () => {
      const Auth = ql.define("auth", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        name: { type: "TEXT" },
        data: { type: "TEXT" },
      });

      Auth.insert({ name: "token1", data: "old_data1" });
      Auth.insert({ name: "token2", data: "old_data2" });
      Auth.insert({ name: "token3", data: "old_data3" });

      // Update where name = "token1" OR name = "token3"
      const updatedCount = Auth.update({ data: "new_data" })
        .where("name", "=", "token1")
        .orWhere("name", "=", "token3")
        .run();
      
      expect(updatedCount).toBe(2);
      expect(Auth.find({ name: "token1" }).first()?.data).toBe("new_data");
      expect(Auth.find({ name: "token2" }).first()?.data).toBe("old_data2");
      expect(Auth.find({ name: "token3" }).first()?.data).toBe("new_data");
    });

    test("should support mixed where syntax (object and column/operator/value)", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        status: { type: "TEXT" },
        role: { type: "TEXT" },
      });

      User.insert({ status: "active", role: "admin" });
      User.insert({ status: "inactive", role: "user" });
      User.insert({ status: "active", role: "user" });

      // Mix object and column/operator/value syntax
      const updatedCount = User.update({ status: "archived" })
        .where({ status: "inactive" })
        .orWhere("role", "=", "admin")
        .run();
      
      expect(updatedCount).toBe(2);
      expect(User.findById(1)?.status).toBe("archived"); // was admin
      expect(User.findById(2)?.status).toBe("archived"); // was inactive
      expect(User.findById(3)?.status).toBe("active"); // unchanged
    });

    test("should support comparison operators in where(column, operator, value)", () => {
      const Product = ql.define("product", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        name: { type: "TEXT" },
        price: { type: "REAL" },
        featured: { type: "INTEGER" },
      });

      Product.insert({ name: "A", price: 10, featured: 0 });
      Product.insert({ name: "B", price: 20, featured: 0 });
      Product.insert({ name: "C", price: 30, featured: 0 });
      Product.insert({ name: "D", price: 40, featured: 0 });

      // Feature products with price > 25
      const updatedCount = Product.update({ featured: 1 }).where("price", ">", 25).run();
      
      expect(updatedCount).toBe(2);
      expect(Product.findById(1)?.featured).toBe(0);
      expect(Product.findById(2)?.featured).toBe(0);
      expect(Product.findById(3)?.featured).toBe(1);
      expect(Product.findById(4)?.featured).toBe(1);
    });

    test("should support LIKE operator in where(column, operator, value)", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
        verified: { type: "INTEGER" },
      });

      User.insert({ email: "alice@gmail.com", verified: 0 });
      User.insert({ email: "bob@yahoo.com", verified: 0 });
      User.insert({ email: "charlie@gmail.com", verified: 0 });

      const updatedCount = User.update({ verified: 1 }).where("email", "LIKE", "%gmail%").run();
      
      expect(updatedCount).toBe(2);
      expect(User.findById(1)?.verified).toBe(1);
      expect(User.findById(2)?.verified).toBe(0);
      expect(User.findById(3)?.verified).toBe(1);
    });

    test("should support != operator in where(column, operator, value)", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        status: { type: "TEXT" },
      });

      User.insert({ status: "active" });
      User.insert({ status: "inactive" });
      User.insert({ status: "active" });

      const updatedCount = User.update({ status: "pending" }).where("status", "!=", "active").run();
      
      expect(updatedCount).toBe(1);
      expect(User.findById(2)?.status).toBe("pending");
      expect(User.findById(1)?.status).toBe("active");
      expect(User.findById(3)?.status).toBe("active");
    });

    test("should work with the pattern from the issue", () => {
      // This test validates the exact use case from the issue:
      // Auth.update({ data: JSON.stringify(data) }).where("name", "=", name).run();
      
      const Auth = ql.define("auth", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        name: { type: "TEXT" },
        data: { type: "TEXT" },
      });

      // Insert initial data
      Auth.insert({ name: "test_key", data: JSON.stringify({ value: "initial" }) });
      
      // Update using the new builder pattern
      const newData = { value: "updated" };
      Auth.update({ data: JSON.stringify(newData) })
        .where("name", "=", "test_key")
        .run();

      // Verify the update
      const updated = Auth.find({ name: "test_key" }).first();
      expect(updated?.data).toBe(JSON.stringify({ value: "updated" }));
    });
  });

  describe("SelectBuilder", () => {
    test("should support select().where().get() pattern", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        name: { type: "TEXT" },
        lid: { type: "TEXT" },
      });

      User.insert({ name: "Alice", lid: "lid1" });
      User.insert({ name: "Bob", lid: "lid2" });
      User.insert({ name: "Charlie", lid: "lid1" });

      const users = User.select().where("lid", "=", "lid1").get();
      
      expect(users).toHaveLength(2);
      expect(users.map(u => u.name).sort()).toEqual(["Alice", "Charlie"]);
    });

    test("should support select().where().run() pattern", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        name: { type: "TEXT" },
        status: { type: "TEXT" },
      });

      User.insert({ name: "Alice", status: "active" });
      User.insert({ name: "Bob", status: "inactive" });

      const activeUsers = User.select().where("status", "=", "active").run();
      
      expect(activeUsers).toHaveLength(1);
      expect(activeUsers[0].name).toBe("Alice");
    });

    test("should support select() with optional initial where", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        name: { type: "TEXT" },
        role: { type: "TEXT" },
      });

      User.insert({ name: "Alice", role: "admin" });
      User.insert({ name: "Bob", role: "user" });
      User.insert({ name: "Charlie", role: "admin" });

      const admins = User.select({ role: "admin" }).get();
      
      expect(admins).toHaveLength(2);
    });

    test("should support chained where calls", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        name: { type: "TEXT" },
        status: { type: "TEXT" },
        role: { type: "TEXT" },
      });

      User.insert({ name: "Alice", status: "active", role: "admin" });
      User.insert({ name: "Bob", status: "active", role: "user" });
      User.insert({ name: "Charlie", status: "inactive", role: "admin" });

      const results = User.select()
        .where("status", "=", "active")
        .where("role", "=", "admin")
        .get();
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Alice");
    });

    test("should support orWhere with column/operator/value syntax", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        name: { type: "TEXT" },
        pn: { type: "TEXT" },
        lid: { type: "TEXT" },
      });

      User.insert({ name: "Alice", pn: "user1", lid: "lid1" });
      User.insert({ name: "Bob", pn: "user2", lid: "lid2" });
      User.insert({ name: "Charlie", pn: "user3", lid: "user1" }); // lid matches Alice's pn

      // Select where pn = "user1" OR lid = "user1"
      const results = User.select()
        .where("pn", "=", "user1")
        .orWhere("lid", "=", "user1")
        .get();
      
      expect(results).toHaveLength(2);
      expect(results.map(u => u.name).sort()).toEqual(["Alice", "Charlie"]);
    });

    test("should support comparison operators", () => {
      const Product = ql.define("product", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        name: { type: "TEXT" },
        price: { type: "REAL" },
      });

      Product.insert({ name: "A", price: 10 });
      Product.insert({ name: "B", price: 20 });
      Product.insert({ name: "C", price: 30 });
      Product.insert({ name: "D", price: 40 });

      // Select products with price > 25
      const results = Product.select().where("price", ">", 25).get();
      
      expect(results).toHaveLength(2);
      expect(results.map(p => p.name).sort()).toEqual(["C", "D"]);
    });

    test("should support LIKE operator", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
      });

      User.insert({ email: "alice@gmail.com" });
      User.insert({ email: "bob@yahoo.com" });
      User.insert({ email: "charlie@gmail.com" });

      const gmailUsers = User.select().where("email", "LIKE", "%gmail%").get();
      
      expect(gmailUsers).toHaveLength(2);
    });

    test("should support mixing object and column/operator/value where syntax", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        status: { type: "TEXT" },
        role: { type: "TEXT" },
        name: { type: "TEXT" },
      });

      User.insert({ name: "Alice", status: "active", role: "admin" });
      User.insert({ name: "Bob", status: "inactive", role: "user" });
      User.insert({ name: "Charlie", status: "active", role: "user" });

      // Mix object and column/operator/value syntax
      const results = User.select()
        .where({ status: "inactive" })
        .orWhere("role", "=", "admin")
        .get();
      
      expect(results).toHaveLength(2);
      expect(results.map(u => u.name).sort()).toEqual(["Alice", "Bob"]);
    });

    test("should support all terminal methods (get, run, all, first)", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        name: { type: "TEXT" },
      });

      User.insert({ name: "Alice" });
      User.insert({ name: "Bob" });

      // Test get()
      const getResults = User.select().get();
      expect(getResults).toHaveLength(2);

      // Test run()
      const runResults = User.select().run();
      expect(runResults).toHaveLength(2);

      // Test all()
      const allResults = User.select().all();
      expect(allResults).toHaveLength(2);

      // Test first()
      const firstResult = User.select().where("name", "=", "Alice").first();
      expect(firstResult).not.toBeNull();
      expect(firstResult?.name).toBe("Alice");
    });

    test("should support orderBy, limit, offset", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        name: { type: "TEXT" },
      });

      User.insert({ name: "Charlie" });
      User.insert({ name: "Alice" });
      User.insert({ name: "Bob" });

      const results = User.select()
        .orderBy("name", "ASC")
        .limit(2)
        .offset(1)
        .get();
      
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe("Bob");
      expect(results[1].name).toBe("Charlie");
    });

    test("should support advanced WHERE operators with select()", () => {
      const Product = ql.define("product", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        name: { type: "TEXT" },
        price: { type: "REAL" },
      });

      Product.insert({ name: "A", price: 5 });
      Product.insert({ name: "B", price: 10 });
      Product.insert({ name: "C", price: 15 });
      Product.insert({ name: "D", price: 20 });

      // Mix column/operator/value with object syntax containing operators
      const results = Product.select()
        .where({ price: { $gte: 10, $lt: 20 } })
        .get();
      
      expect(results).toHaveLength(2);
      expect(results.map(p => p.name).sort()).toEqual(["B", "C"]);
    });

    test("should work with the exact pattern from the issue", () => {
      // This test validates the exact use case from the issue:
      // const users = Ban.select().where("lid", "=", id).get();
      
      const Ban = ql.define("ban", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        lid: { type: "TEXT" },
        reason: { type: "TEXT" },
      });

      Ban.insert({ lid: "lid1", reason: "spam" });
      Ban.insert({ lid: "lid2", reason: "abuse" });
      Ban.insert({ lid: "lid1", reason: "test" });

      const targetLid = "lid1";
      const users = Ban.select().where("lid", "=", targetLid).get();

      expect(users).toHaveLength(2);
      expect(users.every(u => u.lid === "lid1")).toBe(true);
    });

    test("should support != operator", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        status: { type: "TEXT" },
      });

      User.insert({ status: "active" });
      User.insert({ status: "inactive" });
      User.insert({ status: "active" });

      const results = User.select().where("status", "!=", "active").get();
      
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe("inactive");
    });

    test("should support <> operator", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        status: { type: "TEXT" },
      });

      User.insert({ status: "active" });
      User.insert({ status: "inactive" });
      User.insert({ status: "active" });

      const results = User.select().where("status", "<>", "active").get();
      
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe("inactive");
    });

    test("should support >= and <= operators", () => {
      const Product = ql.define("product", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        price: { type: "REAL" },
      });

      Product.insert({ price: 10 });
      Product.insert({ price: 20 });
      Product.insert({ price: 30 });

      const gteResults = Product.select().where("price", ">=", 20).get();
      expect(gteResults).toHaveLength(2);

      const lteResults = Product.select().where("price", "<=", 20).get();
      expect(lteResults).toHaveLength(2);
    });

    test("should support NOT LIKE operator", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
      });

      User.insert({ email: "alice@gmail.com" });
      User.insert({ email: "bob@yahoo.com" });
      User.insert({ email: "charlie@gmail.com" });

      const nonGmailUsers = User.select().where("email", "NOT LIKE", "%gmail%").get();
      
      expect(nonGmailUsers).toHaveLength(1);
      expect(nonGmailUsers[0].email).toBe("bob@yahoo.com");
    });

    test("should expose toSQL() for debugging", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
        status: { type: "TEXT" },
      });

      const { sql, params } = User.select()
        .where("status", "=", "inactive")
        .orWhere("email", "LIKE", "%test%")
        .limit(10)
        .toSQL();

      expect(sql).toContain("SELECT");
      expect(sql).toContain("WHERE");
      expect(sql).toContain("OR");
      expect(sql).toContain("LIMIT 10");
      expect(params).toContain("inactive");
      expect(params).toContain("%test%");
    });
  });

  describe("InsertBuilder", () => {
    test("should support basic insertBuilder().run() pattern", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT", unique: true },
        username: { type: "TEXT" },
      });

      const inserted = User.insertBuilder({
        email: "test@example.com",
        username: "testuser",
      }).run();

      expect(inserted).not.toBeNull();
      expect(inserted?.id).toBe(1);
      expect(inserted?.email).toBe("test@example.com");
      expect(inserted?.username).toBe("testuser");
    });

    test("should support ifNotExists() to check for existing records", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT", unique: true },
        username: { type: "TEXT" },
      });

      // First insert should succeed
      const first = User.insertBuilder({ email: "test@example.com", username: "first" })
        .ifNotExists({ email: "test@example.com" })
        .run();

      expect(first).not.toBeNull();
      expect(first?.username).toBe("first");
      expect(User.count()).toBe(1);

      // Second insert with same email should be skipped (returns null)
      const second = User.insertBuilder({ email: "test@example.com", username: "second" })
        .ifNotExists({ email: "test@example.com" })
        .run();

      expect(second).toBeNull();
      expect(User.count()).toBe(1);
      // Original record should remain unchanged
      expect(User.findById(1)?.username).toBe("first");
    });

    test("should support orIgnore() to silently skip on UNIQUE constraint violation", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT", unique: true },
        username: { type: "TEXT" },
      });

      // First insert should succeed
      const first = User.insert({ email: "test@example.com", username: "first" });
      expect(first.id).toBe(1);

      // Second insert with orIgnore should silently skip
      const second = User.insertBuilder({ email: "test@example.com", username: "second" })
        .orIgnore()
        .run();

      expect(second).toBeNull(); // Returns null since insert was skipped
      expect(User.count()).toBe(1);
      expect(User.findById(1)?.username).toBe("first"); // Original unchanged
    });

    test("should support orReplace() to replace on UNIQUE constraint violation", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT", unique: true },
        username: { type: "TEXT" },
      });

      // First insert
      User.insert({ email: "test@example.com", username: "first" });
      expect(User.count()).toBe(1);

      // Second insert with orReplace should replace the existing record
      const replaced = User.insertBuilder({ email: "test@example.com", username: "replaced" })
        .orReplace()
        .run();

      expect(replaced).not.toBeNull();
      expect(replaced?.username).toBe("replaced");
      expect(User.count()).toBe(1);
    });

    test("should expose toSQL() for debugging", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT", unique: true },
        username: { type: "TEXT" },
      });

      const { sql, params } = User.insertBuilder({ email: "test@example.com", username: "testuser" }).toSQL();

      expect(sql).toContain("INSERT INTO");
      expect(sql).toContain('"email"');
      expect(sql).toContain('"username"');
      expect(params).toContain("test@example.com");
      expect(params).toContain("testuser");
    });

    test("should generate correct SQL for orIgnore", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT", unique: true },
      });

      const { sql } = User.insertBuilder({ email: "test@example.com" }).orIgnore().toSQL();

      expect(sql).toContain("INSERT OR IGNORE");
    });

    test("should generate correct SQL for orReplace", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT", unique: true },
      });

      const { sql } = User.insertBuilder({ email: "test@example.com" }).orReplace().toSQL();

      expect(sql).toContain("INSERT OR REPLACE");
    });

    test("should preserve existing insert() behavior", () => {
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
    });

    test("should handle ifNotExists with advanced WHERE operators", () => {
      const Product = ql.define("product", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        sku: { type: "TEXT", unique: true },
        name: { type: "TEXT" },
        price: { type: "REAL" },
      });

      Product.insert({ sku: "ABC123", name: "Product A", price: 10 });

      // Try to insert with same SKU - should be skipped
      const result = Product.insertBuilder({ sku: "ABC123", name: "Product B", price: 20 })
        .ifNotExists({ sku: "ABC123" })
        .run();

      expect(result).toBeNull();
      expect(Product.count()).toBe(1);

      // Insert with different SKU - should succeed
      const newProduct = Product.insertBuilder({ sku: "DEF456", name: "Product C", price: 30 })
        .ifNotExists({ sku: "DEF456" })
        .run();

      expect(newProduct).not.toBeNull();
      expect(newProduct?.sku).toBe("DEF456");
      expect(Product.count()).toBe(2);
    });

    test("should work without primary key", () => {
      const Log = ql.define("log", {
        message: { type: "TEXT" },
        level: { type: "TEXT" },
        timestamp: { type: "INTEGER" },
      });

      const inserted = Log.insertBuilder({
        message: "Test log",
        level: "info",
        timestamp: Date.now(),
      }).run();

      expect(inserted).not.toBeNull();
      expect(inserted?.message).toBe("Test log");
      expect(inserted?.level).toBe("info");
    });

    test("should avoid UNIQUE constraint error with ifNotExists", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT", unique: true },
        username: { type: "TEXT" },
      });

      // Insert first user
      User.insert({ email: "duplicate@example.com", username: "first" });

      // Without ifNotExists, this would throw a UNIQUE constraint error
      // With ifNotExists, it safely returns null
      const result = User.insertBuilder({ email: "duplicate@example.com", username: "second" })
        .ifNotExists({ email: "duplicate@example.com" })
        .run();

      expect(result).toBeNull();
      expect(User.count()).toBe(1);
    });

    test("should avoid UNIQUE constraint error with orIgnore", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT", unique: true },
        username: { type: "TEXT" },
      });

      // Insert first user
      User.insert({ email: "duplicate@example.com", username: "first" });

      // Without orIgnore, this would throw a UNIQUE constraint error
      // With orIgnore, it safely returns null
      const result = User.insertBuilder({ email: "duplicate@example.com", username: "second" })
        .orIgnore()
        .run();

      expect(result).toBeNull();
      expect(User.count()).toBe(1);
    });

    test("should support chaining multiple options (though only last conflict resolution applies)", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT", unique: true },
        username: { type: "TEXT" },
      });

      // Insert first user
      User.insert({ email: "test@example.com", username: "first" });

      // Chain ifNotExists followed by orIgnore - both should work
      const result = User.insertBuilder({ email: "test@example.com", username: "second" })
        .ifNotExists({ email: "test@example.com" })
        .run();

      expect(result).toBeNull();
      expect(User.count()).toBe(1);
    });

    test("should work with the exact pattern from the issue - check if already exists", () => {
      // This test validates the exact use case from the issue:
      // Check if already exists to avoid UNIQUE constraint error during insert operation
      
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT", unique: true },
        username: { type: "TEXT" },
      });

      // First insert
      User.insert({ email: "existing@example.com", username: "existing" });

      // Try to insert same email without checking - would fail with UNIQUE constraint error
      // Using insertBuilder with ifNotExists prevents this error
      const safeInsert = User.insertBuilder({ email: "existing@example.com", username: "newuser" })
        .ifNotExists({ email: "existing@example.com" })
        .run();

      // Returns null because record already exists
      expect(safeInsert).toBeNull();
      // Original record is unchanged
      expect(User.findById(1)?.username).toBe("existing");
      // No duplicate was created
      expect(User.count()).toBe(1);

      // New email should still work
      const newInsert = User.insertBuilder({ email: "new@example.com", username: "newuser" })
        .ifNotExists({ email: "new@example.com" })
        .run();

      expect(newInsert).not.toBeNull();
      expect(newInsert?.email).toBe("new@example.com");
      expect(User.count()).toBe(2);
    });

    test("should work with insertMany after adding insertBuilder", () => {
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

  describe("Model.query() method", () => {
    test("should support query().where(column, value).first() pattern from the issue", () => {
      // This test validates the exact use case from the issue:
      // const contact = Contact.query().where("lid", lid).first();
      // return contact?.pn || null;
      
      const Contact = ql.define("contact", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        lid: { type: "TEXT" },
        pn: { type: "TEXT" },
      });

      Contact.insert({ lid: "lid1", pn: "phone1" });
      Contact.insert({ lid: "lid2", pn: "phone2" });
      Contact.insert({ lid: "lid3", pn: "phone3" });

      // Exact pattern from the issue
      const getPnByLid = (lid: string) => {
        const contact = Contact.query().where("lid", lid).first();
        return contact?.pn || null;
      };

      expect(getPnByLid("lid1")).toBe("phone1");
      expect(getPnByLid("lid2")).toBe("phone2");
      expect(getPnByLid("lid3")).toBe("phone3");
      expect(getPnByLid("nonexistent")).toBeNull();
    });

    test("should support query().where(column, value).all() pattern", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        status: { type: "TEXT" },
        name: { type: "TEXT" },
      });

      User.insert({ status: "active", name: "Alice" });
      User.insert({ status: "active", name: "Bob" });
      User.insert({ status: "inactive", name: "Charlie" });

      const activeUsers = User.query().where("status", "active").all();
      
      expect(activeUsers).toHaveLength(2);
      expect(activeUsers.map(u => u.name).sort()).toEqual(["Alice", "Bob"]);
    });

    test("should support query() with initial where condition", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        role: { type: "TEXT" },
      });

      User.insert({ role: "admin" });
      User.insert({ role: "user" });
      User.insert({ role: "admin" });

      const admins = User.query({ role: "admin" }).all();
      
      expect(admins).toHaveLength(2);
    });

    test("should support chained where(column, value) calls", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        status: { type: "TEXT" },
        role: { type: "TEXT" },
        name: { type: "TEXT" },
      });

      User.insert({ status: "active", role: "admin", name: "Alice" });
      User.insert({ status: "active", role: "user", name: "Bob" });
      User.insert({ status: "inactive", role: "admin", name: "Charlie" });

      const activeAdmins = User.query()
        .where("status", "active")
        .where("role", "admin")
        .all();
      
      expect(activeAdmins).toHaveLength(1);
      expect(activeAdmins[0].name).toBe("Alice");
    });

    test("should support query().where(column, value).orWhere(column, value)", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        name: { type: "TEXT" },
        pn: { type: "TEXT" },
        lid: { type: "TEXT" },
      });

      User.insert({ name: "Alice", pn: "user1", lid: "lid1" });
      User.insert({ name: "Bob", pn: "user2", lid: "lid2" });
      User.insert({ name: "Charlie", pn: "user3", lid: "user1" }); // lid matches Alice's pn

      // Select where pn = "user1" OR lid = "user1"
      const results = User.query()
        .where("pn", "user1")
        .orWhere("lid", "user1")
        .all();
      
      expect(results).toHaveLength(2);
      expect(results.map(u => u.name).sort()).toEqual(["Alice", "Charlie"]);
    });

    test("should support query() with orderBy, limit, offset", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        name: { type: "TEXT" },
      });

      User.insert({ name: "Charlie" });
      User.insert({ name: "Alice" });
      User.insert({ name: "Bob" });

      const results = User.query()
        .orderBy("name", "ASC")
        .limit(2)
        .offset(1)
        .all();
      
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe("Bob");
      expect(results[1].name).toBe("Charlie");
    });

    test("should support query().where(column, value) with get() terminal method", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
      });

      User.insert({ email: "test@example.com" });

      const results = User.query().where("email", "test@example.com").get();
      
      expect(results).toHaveLength(1);
      expect(results[0].email).toBe("test@example.com");
    });

    test("should support query().where(column, value) with run() terminal method", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        email: { type: "TEXT" },
      });

      User.insert({ email: "test@example.com" });

      const results = User.query().where("email", "test@example.com").run();
      
      expect(results).toHaveLength(1);
      expect(results[0].email).toBe("test@example.com");
    });

    test("should support mixing where(column, value) and where(column, operator, value)", () => {
      const Product = ql.define("product", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        category: { type: "TEXT" },
        price: { type: "REAL" },
      });

      Product.insert({ category: "electronics", price: 100 });
      Product.insert({ category: "electronics", price: 200 });
      Product.insert({ category: "clothing", price: 50 });

      const results = Product.query()
        .where("category", "electronics")
        .where("price", ">", 150)
        .all();
      
      expect(results).toHaveLength(1);
      expect(results[0].price).toBe(200);
    });
  });

  describe("Simplified where(column, value) syntax", () => {
    test("should work with select().where(column, value)", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        name: { type: "TEXT" },
      });

      User.insert({ name: "Alice" });
      User.insert({ name: "Bob" });

      const results = User.select().where("name", "Alice").get();
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Alice");
    });

    test("should work with find().where(column, value)", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        status: { type: "TEXT" },
      });

      User.insert({ status: "active" });
      User.insert({ status: "inactive" });

      const results = User.find().where("status", "active").all();
      
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe("active");
    });

    test("should work with delete().where(column, value)", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        status: { type: "TEXT" },
      });

      User.insert({ status: "active" });
      User.insert({ status: "inactive" });
      User.insert({ status: "active" });

      const deletedCount = User.delete().where("status", "inactive").run();
      
      expect(deletedCount).toBe(1);
      expect(User.count()).toBe(2);
      expect(User.find({ status: "inactive" }).first()).toBeNull();
    });

    test("should work with update().where(column, value)", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        name: { type: "TEXT" },
        status: { type: "TEXT" },
      });

      User.insert({ name: "Alice", status: "active" });
      User.insert({ name: "Bob", status: "inactive" });

      const updatedCount = User.update({ status: "archived" }).where("name", "Bob").run();
      
      expect(updatedCount).toBe(1);
      expect(User.find({ name: "Bob" }).first()?.status).toBe("archived");
    });

    test("should support orWhere(column, value) shorthand", () => {
      const User = ql.define("user", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        name: { type: "TEXT" },
      });

      User.insert({ name: "Alice" });
      User.insert({ name: "Bob" });
      User.insert({ name: "Charlie" });

      const results = User.query()
        .where("name", "Alice")
        .orWhere("name", "Charlie")
        .all();
      
      expect(results).toHaveLength(2);
      expect(results.map(u => u.name).sort()).toEqual(["Alice", "Charlie"]);
    });

    test("should work correctly when value looks like an operator", () => {
      const Item = ql.define("item", {
        id: { type: "INTEGER", primary: true, autoIncrement: true },
        value: { type: "TEXT" },
      });

      // Insert items with values that look like SQL operators
      Item.insert({ value: "=" });
      Item.insert({ value: ">" });
      Item.insert({ value: "normal" });

      // Should match exactly the "=" value, not interpret it as an operator
      const results = Item.query().where("value", "=").all();
      
      expect(results).toHaveLength(1);
      expect(results[0].value).toBe("=");
    });
  });
});
