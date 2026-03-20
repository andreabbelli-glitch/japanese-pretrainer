import { and, eq, inArray } from "drizzle-orm";

import type { DatabaseClient } from "./client.ts";
import {
  card,
  entryLink,
  lesson,
  media
} from "./schema/index.ts";

export async function purgeArchivedMedia(database: DatabaseClient) {
  const archivedMedia = await database.query.media.findMany({
    where: eq(media.status, "archived")
  });

  if (archivedMedia.length === 0) {
    return [];
  }

  const archivedMediaIds = archivedMedia.map((row) => row.id);
  const [lessons, cards] = await Promise.all([
    database.query.lesson.findMany({
      where: inArray(lesson.mediaId, archivedMediaIds)
    }),
    database.query.card.findMany({
      where: inArray(card.mediaId, archivedMediaIds)
    })
  ]);

  const lessonIds = lessons.map((row) => row.id);
  const cardIds = cards.map((row) => row.id);

  await database.transaction(async (tx) => {
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
