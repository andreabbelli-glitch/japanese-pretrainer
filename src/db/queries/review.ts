import {
  and,
  asc,
  eq,
  gte,
  inArray,
  isNotNull,
  lt,
  lte,
  ne
} from "drizzle-orm";

import type { DatabaseClient } from "../client.ts";
import {
  card,
  entryLink,
  lesson,
  lessonProgress,
  reviewLog,
  reviewState,
  type EntryType
} from "../schema/index.ts";

export async function listCardsByMediaId(
  database: DatabaseClient,
  mediaId: string
) {
  return database.query.card.findMany({
    where: and(eq(card.mediaId, mediaId), eq(card.status, "active")),
    with: {
      segment: true,
      reviewState: true,
      entryLinks: true
    },
    orderBy: [asc(card.orderIndex), asc(card.createdAt)]
  });
}

export async function getCardById(database: DatabaseClient, cardId: string) {
  return database.query.card.findFirst({
    where: eq(card.id, cardId),
    with: {
      segment: true,
      reviewState: true,
      entryLinks: true
    }
  });
}

export async function getCardsByIds(
  database: DatabaseClient,
  cardIds: string[]
) {
  if (cardIds.length === 0) {
    return [];
  }

  return database.query.card.findMany({
    where: and(eq(card.status, "active"), inArray(card.id, cardIds)),
    with: {
      segment: true,
      reviewState: true,
      entryLinks: true
    },
    orderBy: [asc(card.orderIndex), asc(card.createdAt)]
  });
}

export async function listReviewCardsByMediaId(
  database: DatabaseClient,
  mediaId: string
) {
  return database.query.card.findMany({
    where: and(eq(card.mediaId, mediaId), ne(card.status, "archived")),
    with: {
      segment: true,
      reviewState: true,
      entryLinks: true
    },
    orderBy: [asc(card.orderIndex), asc(card.createdAt)]
  });
}

export type LessonLinkedReviewEntry = {
  entryId: string;
  entryType: EntryType;
  lessonStatus: (typeof lessonProgress.$inferSelect)["status"] | null;
};

export async function listLessonLinkedReviewEntriesByMediaId(
  database: DatabaseClient,
  mediaId: string
): Promise<LessonLinkedReviewEntry[]> {
  return database
    .select({
      entryId: entryLink.entryId,
      entryType: entryLink.entryType,
      lessonStatus: lessonProgress.status
    })
    .from(entryLink)
    .innerJoin(
      lesson,
      and(eq(entryLink.sourceType, "lesson"), eq(entryLink.sourceId, lesson.id))
    )
    .leftJoin(lessonProgress, eq(lessonProgress.lessonId, lesson.id))
    .where(
      and(
        eq(lesson.mediaId, mediaId),
        eq(lesson.status, "active"),
        inArray(entryLink.linkRole, ["introduced", "explained"])
      )
    );
}

export async function countNewCardsIntroducedOnDayByMediaId(
  database: DatabaseClient,
  mediaId: string,
  asOf = new Date()
) {
  const dayStart = new Date(
    asOf.getFullYear(),
    asOf.getMonth(),
    asOf.getDate()
  );
  const dayEnd = new Date(dayStart);

  dayEnd.setDate(dayEnd.getDate() + 1);

  const rows = await database
    .select({
      cardId: reviewLog.cardId
    })
    .from(reviewLog)
    .innerJoin(card, eq(reviewLog.cardId, card.id))
    .where(
      and(
        eq(card.mediaId, mediaId),
        eq(reviewLog.previousState, "new"),
        gte(reviewLog.answeredAt, dayStart.toISOString()),
        lt(reviewLog.answeredAt, dayEnd.toISOString())
      )
    );

  return new Set(rows.map((row) => row.cardId)).size;
}

export type DueCardItem = typeof card.$inferSelect & {
  reviewState: typeof reviewState.$inferSelect;
};

export async function listDueCardsByMediaId(
  database: DatabaseClient,
  mediaId: string,
  asOf = new Date().toISOString()
): Promise<DueCardItem[]> {
  const rows = await database
    .select({
      card,
      reviewState
    })
    .from(card)
    .innerJoin(reviewState, eq(reviewState.cardId, card.id))
      .where(
        and(
          eq(card.mediaId, mediaId),
          eq(card.status, "active"),
          isNotNull(reviewState.dueAt),
          lte(reviewState.dueAt, asOf),
          ne(reviewState.state, "suspended"),
          ne(reviewState.state, "known_manual")
        )
      )
    .orderBy(asc(reviewState.dueAt), asc(card.orderIndex));

  return rows.map((row) => ({
    ...row.card,
    reviewState: row.reviewState
  }));
}

export type CardListItem = Awaited<
  ReturnType<typeof listCardsByMediaId>
>[number];
export type ReviewCardListItem = Awaited<
  ReturnType<typeof listReviewCardsByMediaId>
>[number];
