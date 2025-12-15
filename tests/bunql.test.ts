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
});
