import { and, eq, inArray } from "drizzle-orm";

import type { DatabaseClient } from "./client.ts";
import {
  card,
  entryLink,
  entryStatus,
  grammarPattern,
  lesson,
  media,
  term
} from "./schema/index.ts";

export async function purgeArchivedMedia(database: DatabaseClient) {
  const archivedMedia = await database.query.media.findMany({
    where: eq(media.status, "archived")
  });

  if (archivedMedia.length === 0) {
    return [];
  }

  const archivedMediaIds = archivedMedia.map((row) => row.id);
  const [terms, grammar, lessons, cards] = await Promise.all([
    database.query.term.findMany({
      where: inArray(term.mediaId, archivedMediaIds)
    }),
    database.query.grammarPattern.findMany({
      where: inArray(grammarPattern.mediaId, archivedMediaIds)
    }),
    database.query.lesson.findMany({
      where: inArray(lesson.mediaId, archivedMediaIds)
    }),
    database.query.card.findMany({
      where: inArray(card.mediaId, archivedMediaIds)
    })
  ]);

  const termIds = terms.map((row) => row.id);
  const grammarIds = grammar.map((row) => row.id);
  const lessonIds = lessons.map((row) => row.id);
  const cardIds = cards.map((row) => row.id);

  await database.transaction(async (tx) => {
    if (termIds.length > 0) {
      await tx
        .delete(entryStatus)
        .where(
          and(
            eq(entryStatus.entryType, "term"),
            inArray(entryStatus.entryId, termIds)
          )
        );
    }

    if (grammarIds.length > 0) {
      await tx
        .delete(entryStatus)
        .where(
          and(
            eq(entryStatus.entryType, "grammar"),
            inArray(entryStatus.entryId, grammarIds)
          )
        );
    }

    if (lessonIds.length > 0) {
      await tx
        .delete(entryLink)
        .where(
          and(
            eq(entryLink.sourceType, "lesson"),
            inArray(entryLink.sourceId, lessonIds)
          )
        );
    }

    if (cardIds.length > 0) {
      await tx
        .delete(entryLink)
        .where(
          and(
            eq(entryLink.sourceType, "card"),
            inArray(entryLink.sourceId, cardIds)
          )
        );
    }

    await tx.delete(media).where(inArray(media.id, archivedMediaIds));
  });

  return archivedMedia.map((row) => row.slug);
}
