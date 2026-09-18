import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * node:sqlite singleton, same HMR-survival trick as a Prisma client
 * singleton would use (see the comment this replaced in git history):
 * `next dev` re-evaluates modules on every save, so without stashing the
 * connection on `globalThis` we'd open a new file handle on every reload.
 */
const globalForDb = globalThis as unknown as { sqliteDb: DatabaseSync | undefined };

function openDatabase(): DatabaseSync {
  const dbPath = process.env.DATABASE_PATH ?? "./data/dev.db";

  if (dbPath !== ":memory:") {
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON;");

  const schemaPath = join(process.cwd(), "db", "schema.sql");
  const schema = readFileSync(schemaPath, "utf-8");
  db.exec(schema);

  return db;
}

export const db = globalForDb.sqliteDb ?? openDatabase();

if (process.env.NODE_ENV !== "production") {
  globalForDb.sqliteDb = db;
}
