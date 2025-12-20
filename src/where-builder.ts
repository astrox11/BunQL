import type { ComparisonOperator, SQLQueryBindings, WhereCondition, WhereOperator } from "./types";

/**
 * Check if a value is a WhereOperator object
 */
export function isWhereOperator<V>(value: unknown): value is WhereOperator<V> {
  if (value === null || typeof value !== "object") return false;
  const ops = ["$eq", "$ne", "$gt", "$gte", "$lt", "$lte", "$like", "$notLike", "$in", "$notIn", "$between", "$isNull"];
  return ops.some(op => op in (value as Record<string, unknown>));
}

/**
 * Map comparison operator string to WhereOperator key
 */
export function operatorToCondition<V>(operator: ComparisonOperator, value: V): WhereOperator<V> {
  switch (operator) {
    case "=":
      return { $eq: value };
    case "!=":
    case "<>":
      return { $ne: value };
    case ">":
      return { $gt: value };
    case ">=":
      return { $gte: value };
    case "<":
      return { $lt: value };
    case "<=":
      return { $lte: value };
    case "LIKE":
      return { $like: value as unknown as string } as WhereOperator<V>;
    case "NOT LIKE":
      return { $notLike: value as unknown as string } as WhereOperator<V>;
    default:
      return { $eq: value };
  }
}

/**
 * Build conditions for a single key-value pair with operator support
 */
export function buildCondition(key: string, value: unknown, params: SQLQueryBindings[]): string {
  const column = `"${key}"`;

  if (isWhereOperator(value)) {
    const conditions: string[] = [];
    const op = value as WhereOperator<SQLQueryBindings>;

    if (op.$eq !== undefined) {
      params.push(op.$eq);
      conditions.push(`${column} = ?`);
    }
    if (op.$ne !== undefined) {
      params.push(op.$ne);
      conditions.push(`${column} != ?`);
    }
    if (op.$gt !== undefined) {
      params.push(op.$gt);
      conditions.push(`${column} > ?`);
    }
    if (op.$gte !== undefined) {
      params.push(op.$gte);
      conditions.push(`${column} >= ?`);
    }
    if (op.$lt !== undefined) {
      params.push(op.$lt);
      conditions.push(`${column} < ?`);
    }
    if (op.$lte !== undefined) {
      params.push(op.$lte);
      conditions.push(`${column} <= ?`);
    }
    if (op.$like !== undefined) {
      params.push(op.$like);
      conditions.push(`${column} LIKE ?`);
    }
    if (op.$notLike !== undefined) {
      params.push(op.$notLike);
      conditions.push(`${column} NOT LIKE ?`);
    }
    if (op.$in !== undefined && Array.isArray(op.$in)) {
      const placeholders = op.$in.map(() => "?").join(", ");
      params.push(...(op.$in as SQLQueryBindings[]));
      conditions.push(`${column} IN (${placeholders})`);
    }
    if (op.$notIn !== undefined && Array.isArray(op.$notIn)) {
      const placeholders = op.$notIn.map(() => "?").join(", ");
      params.push(...(op.$notIn as SQLQueryBindings[]));
      conditions.push(`${column} NOT IN (${placeholders})`);
    }
    if (op.$between !== undefined && Array.isArray(op.$between)) {
      params.push(op.$between[0] as SQLQueryBindings, op.$between[1] as SQLQueryBindings);
      conditions.push(`${column} BETWEEN ? AND ?`);
    }
    if (op.$isNull !== undefined) {
      conditions.push(op.$isNull ? `${column} IS NULL` : `${column} IS NOT NULL`);
    }

    return conditions.join(" AND ");
  }

  // Simple equality check
  params.push(value as SQLQueryBindings);
  return `${column} = ?`;
}

/**
 * Build WHERE clause from conditions object
 */
export function buildWhereClause<T>(where: WhereCondition<T>, params: SQLQueryBindings[]): string {
  const whereKeys = Object.keys(where) as (keyof T)[];
  if (whereKeys.length === 0) return "";

  const conditions = whereKeys.map((key) => {
    return buildCondition(String(key), where[key], params);
  });

  return conditions.join(" AND ");
}
