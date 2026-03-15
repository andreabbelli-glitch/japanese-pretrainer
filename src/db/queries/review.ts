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

export async function listReviewCardsByMediaIds(
  database: DatabaseClient,
  mediaIds: string[]
) {
  if (mediaIds.length === 0) {
    return [];
  }

  return database.query.card.findMany({
    where: and(inArray(card.mediaId, mediaIds), ne(card.status, "archived")),
    with: {
      segment: true,
      reviewState: true,
      entryLinks: true
    },
    orderBy: [asc(card.mediaId), asc(card.orderIndex), asc(card.createdAt)]
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

export type LessonLinkedReviewEntryByMedia = LessonLinkedReviewEntry & {
  mediaId: string;
};

export async function listLessonLinkedReviewEntriesByMediaIds(
  database: DatabaseClient,
  mediaIds: string[]
): Promise<LessonLinkedReviewEntryByMedia[]> {
  if (mediaIds.length === 0) {
    return [];
  }

  return database
    .select({
      mediaId: lesson.mediaId,
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
        inArray(lesson.mediaId, mediaIds),
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

export async function countNewCardsIntroducedOnDayByMediaIds(
  database: DatabaseClient,
  mediaIds: string[],
  asOf = new Date()
) {
  if (mediaIds.length === 0) {
    return [];
  }

  const dayStart = new Date(
    asOf.getFullYear(),
    asOf.getMonth(),
    asOf.getDate()
  );
  const dayEnd = new Date(dayStart);

  dayEnd.setDate(dayEnd.getDate() + 1);

  const rows = await database
    .select({
      mediaId: card.mediaId,
      cardId: reviewLog.cardId
    })
    .from(reviewLog)
    .innerJoin(card, eq(reviewLog.cardId, card.id))
    .where(
      and(
        inArray(card.mediaId, mediaIds),
        eq(reviewLog.previousState, "new"),
        gte(reviewLog.answeredAt, dayStart.toISOString()),
        lt(reviewLog.answeredAt, dayEnd.toISOString())
      )
    );

  const grouped = new Map<string, Set<string>>();

  for (const row of rows) {
    const existing = grouped.get(row.mediaId);

    if (existing) {
      existing.add(row.cardId);
      continue;
    }

    grouped.set(row.mediaId, new Set([row.cardId]));
  }

  return [...grouped.entries()].map(([mediaId, cardIds]) => ({
    mediaId,
    count: cardIds.size
  }));
}

export type ReviewLaunchCandidate = {
  activeReviewCards: number;
  cardsTotal: number;
  dueCount: number;
  mediaId: string;
  slug: string;
  title: string;
};

export async function listReviewLaunchCandidates(
  database: DatabaseClient,
  asOfIso = new Date().toISOString()
): Promise<ReviewLaunchCandidate[]> {
  const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
  const asOfSql = quote(asOfIso);
  const drivingEntryCondition = `
    (
      cel.relationship_type = 'primary'
      OR NOT EXISTS (
        SELECT 1
        FROM card_entry_link cel_primary
        WHERE cel_primary.card_id = c.id
          AND cel_primary.relationship_type = 'primary'
      )
    )
  `;
  const lessonLinkedDrivingEntries = `
    SELECT 1
    FROM card_entry_link cel
    JOIN entry_link el
      ON el.entry_type = cel.entry_type
     AND el.entry_id = cel.entry_id
     AND el.source_type = 'lesson'
     AND el.link_role IN ('introduced', 'explained')
    JOIN lesson l
      ON l.id = el.source_id
     AND l.status = 'active'
    WHERE cel.card_id = c.id
      AND ${drivingEntryCondition}
  `;

  const rows = await database.all<{
    activeReviewCards: number | string | null;
    cardsTotal: number | string | null;
    dueCount: number | string | null;
    mediaId: string;
    slug: string;
    title: string;
  }>(`
    WITH eligible_cards AS (
      SELECT
        c.id AS card_id,
        c.media_id AS media_id,
        c.status AS card_status,
        rs.state AS review_state,
        rs.due_at AS due_at,
        COALESCE(rs.manual_override, 0) AS manual_override,
        CASE
          WHEN EXISTS (${lessonLinkedDrivingEntries}) THEN 1
          ELSE 0
        END AS has_lesson_linked_driving_entry,
        CASE
          WHEN EXISTS (
            ${lessonLinkedDrivingEntries}
              AND EXISTS (
                SELECT 1
                FROM lesson_progress lp
                WHERE lp.lesson_id = l.id
                  AND lp.status = 'completed'
              )
          ) THEN 1
          ELSE 0
        END AS has_completed_driving_lesson,
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM card_entry_link cel
            JOIN entry_status es
              ON es.entry_type = cel.entry_type
             AND es.entry_id = cel.entry_id
            WHERE cel.card_id = c.id
              AND ${drivingEntryCondition}
              AND es.status = 'ignored'
          ) THEN 1
          ELSE 0
        END AS has_ignored_driving_entry,
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM card_entry_link cel
            JOIN entry_status es
              ON es.entry_type = cel.entry_type
             AND es.entry_id = cel.entry_id
            WHERE cel.card_id = c.id
              AND ${drivingEntryCondition}
              AND es.status = 'known_manual'
          ) THEN 1
          ELSE 0
        END AS has_known_manual_driving_entry
      FROM card c
      LEFT JOIN review_state rs
        ON rs.card_id = c.id
      WHERE c.status != 'archived'
    )
    SELECT
      m.id AS mediaId,
      m.slug AS slug,
      m.title AS title,
      COALESCE(
        SUM(
          CASE
            WHEN ec.card_id IS NOT NULL
             AND (
               ec.has_lesson_linked_driving_entry = 0
               OR ec.has_completed_driving_lesson = 1
             )
            THEN 1
            ELSE 0
          END
        ),
        0
      ) AS cardsTotal,
      COALESCE(
        SUM(
          CASE
            WHEN ec.card_id IS NOT NULL
             AND (
               ec.has_lesson_linked_driving_entry = 0
               OR ec.has_completed_driving_lesson = 1
             )
             AND ec.review_state IS NOT NULL
             AND ec.review_state NOT IN ('known_manual', 'suspended')
            THEN 1
            ELSE 0
          END
        ),
        0
      ) AS activeReviewCards,
      COALESCE(
        SUM(
          CASE
            WHEN ec.card_id IS NOT NULL
             AND (
               ec.has_lesson_linked_driving_entry = 0
               OR ec.has_completed_driving_lesson = 1
             )
             AND ec.card_status != 'suspended'
             AND ec.review_state IS NOT NULL
             AND ec.review_state NOT IN ('new', 'known_manual', 'suspended')
             AND ec.manual_override = 0
             AND ec.has_ignored_driving_entry = 0
             AND ec.has_known_manual_driving_entry = 0
             AND (ec.due_at IS NULL OR ec.due_at <= ${asOfSql})
            THEN 1
            ELSE 0
          END
        ),
        0
      ) AS dueCount
    FROM media m
    LEFT JOIN eligible_cards ec
      ON ec.media_id = m.id
    WHERE m.status = 'active'
    GROUP BY m.id, m.slug, m.title
    ORDER BY m.title ASC, m.slug ASC
  `);

  return rows.map((row) => ({
    activeReviewCards: Number(row.activeReviewCards ?? 0),
    cardsTotal: Number(row.cardsTotal ?? 0),
    dueCount: Number(row.dueCount ?? 0),
    mediaId: row.mediaId,
    slug: row.slug,
    title: row.title
  }));
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
