import { and, asc, eq, inArray } from "drizzle-orm";

import type { DatabaseQueryClient } from "../client.ts";
import {
  card,
  cardEntryLink,
  lesson,
  lessonProgress
} from "../schema/index.ts";

export async function listReviewPronunciationCards(
  database: DatabaseQueryClient,
  mediaId?: string
) {
  return database
    .select({
      cardId: card.id,
      mediaId: card.mediaId
    })
    .from(card)
    .innerJoin(lesson, eq(card.lessonId, lesson.id))
    .innerJoin(lessonProgress, eq(lessonProgress.lessonId, lesson.id))
    .where(
      and(
        eq(card.status, "active"),
        eq(lesson.status, "active"),
        eq(lessonProgress.status, "completed"),
        mediaId ? eq(card.mediaId, mediaId) : undefined
      )
    )
    .orderBy(asc(card.mediaId), asc(card.orderIndex), asc(card.createdAt));
}

export async function listLessonPronunciationCards(
  database: DatabaseQueryClient,
  lessonId: string
) {
  return database
    .select({
      cardId: card.id,
      mediaId: card.mediaId
    })
    .from(card)
    .where(and(eq(card.lessonId, lessonId), eq(card.status, "active")))
    .orderBy(asc(card.orderIndex), asc(card.createdAt));
}

export async function listPronunciationEntryRefsByCardIds(
  database: DatabaseQueryClient,
  cardIds: string[]
) {
  if (cardIds.length === 0) {
    return [];
  }

  return database
    .select({
      cardId: cardEntryLink.cardId,
      entryId: cardEntryLink.entryId,
      entryType: cardEntryLink.entryType,
      mediaId: card.mediaId
    })
    .from(cardEntryLink)
    .innerJoin(card, eq(card.id, cardEntryLink.cardId))
    .where(inArray(cardEntryLink.cardId, cardIds))
    .orderBy(
      asc(card.mediaId),
      asc(cardEntryLink.cardId),
      asc(cardEntryLink.relationshipType),
      asc(cardEntryLink.entryType),
      asc(cardEntryLink.entryId)
    );
}
