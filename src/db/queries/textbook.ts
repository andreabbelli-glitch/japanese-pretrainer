import { and, asc, eq, inArray, or } from "drizzle-orm";

import type { DatabaseClient } from "../client.ts";
import {
  card,
  cardEntryLink,
  entryLink,
  reviewState,
  userSetting
} from "../schema/index.ts";

export async function listLessonEntryLinks(
  database: DatabaseClient,
  lessonId: string
) {
  return database.query.entryLink.findMany({
    where: and(eq(entryLink.sourceType, "lesson"), eq(entryLink.sourceId, lessonId)),
    orderBy: [asc(entryLink.sortOrder), asc(entryLink.entryType), asc(entryLink.entryId)]
  });
}

export async function getUserSettingValue(
  database: DatabaseClient,
  key: (typeof userSetting.$inferSelect)["key"]
) {
  const row = await database.query.userSetting.findFirst({
    where: eq(userSetting.key, key)
  });

  return row ?? null;
}

export async function listEntryStudySignals(
  database: DatabaseClient,
  entries: Array<{
    entryId: string;
    entryType: "term" | "grammar";
  }>
) {
  if (entries.length === 0) {
    return [];
  }

  const termIds = entries
    .filter((entry) => entry.entryType === "term")
    .map((entry) => entry.entryId);
  const grammarIds = entries
    .filter((entry) => entry.entryType === "grammar")
    .map((entry) => entry.entryId);
  const filters = [];

  if (termIds.length > 0) {
    filters.push(
      and(
        eq(cardEntryLink.entryType, "term"),
        inArray(cardEntryLink.entryId, termIds)
      )
    );
  }

  if (grammarIds.length > 0) {
    filters.push(
      and(
        eq(cardEntryLink.entryType, "grammar"),
        inArray(cardEntryLink.entryId, grammarIds)
      )
    );
  }

  if (filters.length === 0) {
    return [];
  }

  return database
    .select({
      entryId: cardEntryLink.entryId,
      entryType: cardEntryLink.entryType,
      relationshipType: cardEntryLink.relationshipType,
      cardId: card.id,
      reviewState: reviewState.state,
      dueAt: reviewState.dueAt,
      manualOverride: reviewState.manualOverride
    })
    .from(cardEntryLink)
    .innerJoin(card, eq(card.id, cardEntryLink.cardId))
    .leftJoin(reviewState, eq(reviewState.cardId, card.id))
    .where(and(eq(card.status, "active"), or(...filters)));
}
