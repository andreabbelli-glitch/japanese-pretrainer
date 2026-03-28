import path from "node:path";

import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";

import { db, type DatabaseClient } from "./client.ts";
import { normalizeReviewSubjectSurface } from "../lib/review-subject.ts";
import { romanizeKanaForSearch } from "../lib/study-search.ts";
import { card, grammarPattern } from "./schema/index.ts";

export async function runMigrations(
  database: DatabaseClient = db,
  migrationsFolder = path.resolve(process.cwd(), "drizzle")
): Promise<void> {
  await migrate(database, { migrationsFolder });
  await backfillNormalizedFront(database);
  await backfillGrammarSearchRomaji(database);
}

async function backfillNormalizedFront(database: DatabaseClient) {
  const rows = await database.query.card.findMany({
    columns: {
      id: true,
      front: true,
      normalizedFront: true
    }
  });

  for (const row of rows) {
    if (row.normalizedFront !== null) {
      continue;
    }

    await database
      .update(card)
      .set({
        normalizedFront: normalizeReviewSubjectSurface(row.front)
      })
      .where(eq(card.id, row.id));
  }
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
