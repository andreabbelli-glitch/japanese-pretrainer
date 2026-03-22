import path from "node:path";

import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";

import { db, type DatabaseClient } from "./client.ts";
import { romanizeKanaForSearch } from "../lib/study-search.ts";
import { grammarPattern } from "./schema/index.ts";

export async function runMigrations(
  database: DatabaseClient = db,
  migrationsFolder = path.resolve(process.cwd(), "drizzle")
): Promise<void> {
  await migrate(database, { migrationsFolder });
  await backfillGrammarSearchRomaji(database);
}

async function backfillGrammarSearchRomaji(database: DatabaseClient) {
  const rows = await database.query.grammarPattern.findMany({
    columns: {
      id: true,
      searchPatternNorm: true,
      searchRomajiNorm: true
    }
  });

  for (const row of rows) {
    if (row.searchRomajiNorm) {
      continue;
    }

    await database
      .update(grammarPattern)
      .set({
        searchRomajiNorm: romanizeKanaForSearch(row.searchPatternNorm)
      })
      .where(eq(grammarPattern.id, row.id));
  }
}
