import { Database } from "sqlite3";
import { errors } from "./errorUtils.ts";

export class DatabaseHelper {
  constructor(private db: Database) {}

  async transaction<T>(callback: (tx: DatabaseHelper) => Promise<T>): Promise<T> {
    await this.run("BEGIN TRANSACTION");
    try {
      const result = await callback(this);
      await this.run("COMMIT");
      return result;
    } catch (err) {
      await this.run("ROLLBACK");
      throw err;
    }
  }

  async get<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
    this.validateSqlParams(params);
    return new Promise((resolve, reject) => {
      this.db.get(sql, params as (string | number | boolean | null)[], (err, row) => {
        if (err) reject(errors.internal(err.message));
        else resolve((row as T) || null);
      });
    });
  }

  async run(sql: string, params: unknown[] = []): Promise<{ lastID: number; changes: number }> {
    this.validateSqlParams(params);
    return new Promise((resolve, reject) => {
      this.db.run(sql, params as (string | number | boolean | null)[], function (err) {
        if (err) reject(errors.internal(err.message));
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  async all<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    this.validateSqlParams(params);
    return new Promise((resolve, reject) => {
      this.db.all(sql, params as (string | number | boolean | null)[], (err, rows) => {
        if (err) reject(errors.internal(err.message));
        else resolve((rows as T[]) || []);
      });
    });
  }

  private validateSqlParams(
    params: unknown[]
  ): asserts params is (string | number | boolean | null)[] {
    for (let i = 0; i < params.length; i++) {
      const param = params[i];

      // undefined is almost always a bug - fail fast
      // Use null for intentional SQL NULL values
      if (param === undefined) {
        throw errors.internal(
          `Invalid SQL parameter at index ${i}: received undefined. Use null for SQL NULL values.`
        );
      }

      // null is valid (represents SQL NULL)
      if (param === null) {
        continue;
      }

      const paramType = typeof param;
      if (paramType !== "string" && paramType !== "number" && paramType !== "boolean") {
        throw errors.internal(
          `Invalid SQL parameter at index ${i}: expected primitive (string, number, boolean, null), got ${paramType}`
        );
      }
    }
  }
}
