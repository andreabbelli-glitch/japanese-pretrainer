import path from "node:path";

import { migrate } from "drizzle-orm/libsql/migrator";

import { db, type DatabaseClient } from "./client.ts";
import { migrateReviewHistoryToFsrs } from "./review-fsrs-migration.ts";

export async function runMigrations(
  database: DatabaseClient = db,
  migrationsFolder = path.resolve(process.cwd(), "drizzle")
): Promise<void> {
  await migrate(database, { migrationsFolder });
  await repairPitchAccentSourceColumns(database);
  await migrateReviewHistoryToFsrs(database);
}

async function repairPitchAccentSourceColumns(
  database: DatabaseClient
): Promise<void> {
  await ensureOptionalColumn(database, "term", "pitch_accent_source", "text");
  await ensureOptionalColumn(
    database,
    "term",
    "pitch_accent_page_url",
    "text"
  );
  await ensureOptionalColumn(
    database,
    "grammar_pattern",
    "pitch_accent_source",
    "text"
  );
  await ensureOptionalColumn(
    database,
    "grammar_pattern",
    "pitch_accent_page_url",
    "text"
  );
}

async function ensureOptionalColumn(
  database: DatabaseClient,
  tableName: string,
  columnName: string,
  columnType: string
): Promise<void> {
  const columns = await database.all<{ name: string }>(
    `pragma table_info('${tableName}')`
  );

  if (columns.some((column) => column.name === columnName)) {
    return;
  }

  await database.run(
    `ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${columnType}`
  );
}
