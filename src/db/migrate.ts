import path from "node:path";
import { access } from "node:fs/promises";

import { eq, isNull } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";

import { db, type DatabaseClient } from "./client.ts";
import { card } from "./schema/index.ts";
import { migrateReviewHistoryToFsrs } from "./review-fsrs-migration.ts";
import { parseContentRoot } from "../lib/content/validator.ts";
import { backfillReviewSubjectState } from "../lib/review-subject-state-backfill.ts";

export async function runMigrations(
  database: DatabaseClient = db,
  migrationsFolder = path.resolve(process.cwd(), "drizzle"),
  contentRoot = path.resolve(process.cwd(), "content")
): Promise<void> {
  await migrate(database, { migrationsFolder });
  await repairPitchAccentSourceColumns(database);
  await backfillCardLessonIdsFromContent(database, contentRoot);
  await migrateReviewHistoryToFsrs(database);
  await backfillReviewSubjectState(database);
}

export async function backfillCardLessonIdsFromContent(
  database: DatabaseClient,
  contentRoot: string
): Promise<number> {
  if (!(await pathExists(contentRoot))) {
    return 0;
  }

  const legacyCards = await database.query.card.findMany({
    where: isNull(card.lessonId),
    columns: {
      id: true
    }
  });

  if (legacyCards.length === 0) {
    return 0;
  }

  const parseResult = await parseContentRoot(contentRoot);

  if (!parseResult.ok) {
    return 0;
  }

  const lessonIdByCardId = new Map(
    parseResult.data.bundles.flatMap((bundle) =>
      bundle.cards.map((cardRow) => [cardRow.id, cardRow.lessonId] as const)
    )
  );

  let updated = 0;

  for (const legacyCard of legacyCards) {
    const lessonId = lessonIdByCardId.get(legacyCard.id);

    if (!lessonId) {
      continue;
    }

    await database
      .update(card)
      .set({
        lessonId
      })
      .where(eq(card.id, legacyCard.id));

    updated += 1;
  }

  return updated;
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

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}
