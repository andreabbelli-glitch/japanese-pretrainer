import path from "node:path";

import { migrate } from "drizzle-orm/libsql/migrator";

import { db, type DatabaseClient } from "./client.ts";

export async function runMigrations(
  database: DatabaseClient = db,
  migrationsFolder = path.resolve(process.cwd(), "drizzle")
): Promise<void> {
  await migrate(database, { migrationsFolder });
}
