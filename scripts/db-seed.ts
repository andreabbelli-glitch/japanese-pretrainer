import "dotenv/config";

import path from "node:path";

import { and, eq } from "drizzle-orm";

import { closeDatabaseClient, db } from "../src/db/client.ts";
import { resolveDatabaseLocation } from "../src/db/config.ts";
import { entryStatus, entryLink, media } from "../src/db/schema/index.ts";
import { importContentWorkspace } from "../src/lib/content/importer.ts";

const location = resolveDatabaseLocation();
const contentRoot = path.resolve(process.cwd(), "content");

try {
  await removeLegacyDemoAnime(db);
  const result = await importContentWorkspace({
    contentRoot,
    database: db
  });

  if (result.status === "failed") {
    throw new Error(result.message);
  }

  console.info(
    `Imported ${result.parseResult.data.bundles.length} content bundle(s) into ${location.databasePath ?? location.configuredPath}.`
  );
} finally {
  closeDatabaseClient(db);
}

async function removeLegacyDemoAnime(database: typeof db) {
  const legacyMedia = await database.query.media.findFirst({
    where: eq(media.slug, "demo-anime")
  });

  if (!legacyMedia) {
    return;
  }

  const [terms, grammar, lessons, cards] = await Promise.all([
    database.query.term.findMany({
      where: (table, { eq }) => eq(table.mediaId, legacyMedia.id)
    }),
    database.query.grammarPattern.findMany({
      where: (table, { eq }) => eq(table.mediaId, legacyMedia.id)
    }),
    database.query.lesson.findMany({
      where: (table, { eq }) => eq(table.mediaId, legacyMedia.id)
    }),
    database.query.card.findMany({
      where: (table, { eq }) => eq(table.mediaId, legacyMedia.id)
    })
  ]);

  const entryPairs = [
    ...terms.map((row) => ({ entryId: row.id, entryType: "term" as const })),
    ...grammar.map((row) => ({ entryId: row.id, entryType: "grammar" as const }))
  ];
  const sourcePairs = [
    ...lessons.map((row) => ({ sourceId: row.id, sourceType: "lesson" as const })),
    ...cards.map((row) => ({ sourceId: row.id, sourceType: "card" as const }))
  ];

  await database.transaction(async (tx) => {
    for (const pair of entryPairs) {
      await tx
        .delete(entryStatus)
        .where(
          and(
            eq(entryStatus.entryType, pair.entryType),
            eq(entryStatus.entryId, pair.entryId)
          )
        );
    }

    for (const pair of sourcePairs) {
      await tx
        .delete(entryLink)
        .where(
          and(
            eq(entryLink.sourceType, pair.sourceType),
            eq(entryLink.sourceId, pair.sourceId)
          )
        );
    }

    await tx.delete(media).where(eq(media.id, legacyMedia.id));
  });
}
