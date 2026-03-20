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
  crossMediaGroup,
  entryStatus,
  grammarPattern,
  lesson,
  lessonProgress,
  media,
  reviewLog,
  reviewState,
  segment,
  term
} from "../schema/index.ts";

export async function listCardsByMediaId(
  database: DatabaseClient,
  mediaId: string
) {
  return database.query.card.findMany({
    where: and(eq(card.mediaId, mediaId), eq(card.status, "active")),
    with: {
      lesson: {
        with: {
          progress: true
        }
      },
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
      lesson: {
        with: {
          progress: true
        }
      },
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
      lesson: {
        with: {
          progress: true
        }
      },
      segment: true,
      reviewState: true,
      entryLinks: true
    },
    orderBy: [asc(card.orderIndex), asc(card.createdAt)]
  });
}

export async function listReviewCardsByIds(
  database: DatabaseClient,
  cardIds: string[]
) {
  if (cardIds.length === 0) {
    return [];
  }

  return database.query.card.findMany({
    where: and(ne(card.status, "archived"), inArray(card.id, cardIds)),
    with: {
      lesson: {
        with: {
          progress: true
        }
      },
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
      lesson: {
        with: {
          progress: true
        }
      },
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
      lesson: {
        with: {
          progress: true
        }
      },
      segment: true,
      reviewState: true,
      entryLinks: true
    },
    orderBy: [asc(card.mediaId), asc(card.orderIndex), asc(card.createdAt)]
  });
}

export async function listTermEntryReviewSummariesByIds(
  database: DatabaseClient,
  termIds: string[]
) {
  if (termIds.length === 0) {
    return [];
  }

  return database
    .select({
      id: term.id,
      sourceId: term.sourceId,
      crossMediaGroupId: term.crossMediaGroupId,
      mediaId: term.mediaId,
      segmentId: term.segmentId,
      lemma: term.lemma,
      reading: term.reading,
      romaji: term.romaji,
      meaningIt: term.meaningIt,
      mediaSlug: media.slug,
      mediaTitle: media.title,
      segmentTitle: segment.title,
      crossMediaGroupKey: crossMediaGroup.groupKey,
      entryStatus: entryStatus.status
    })
    .from(term)
    .innerJoin(media, eq(media.id, term.mediaId))
    .leftJoin(segment, eq(segment.id, term.segmentId))
    .leftJoin(crossMediaGroup, eq(crossMediaGroup.id, term.crossMediaGroupId))
    .leftJoin(
      entryStatus,
      and(eq(entryStatus.entryId, term.id), eq(entryStatus.entryType, "term"))
    )
    .where(inArray(term.id, termIds))
    .orderBy(asc(term.lemma), asc(term.reading));
}

export async function listGrammarEntryReviewSummariesByIds(
  database: DatabaseClient,
  grammarIds: string[]
) {
  if (grammarIds.length === 0) {
    return [];
  }

  return database
    .select({
      id: grammarPattern.id,
      sourceId: grammarPattern.sourceId,
      crossMediaGroupId: grammarPattern.crossMediaGroupId,
      mediaId: grammarPattern.mediaId,
      segmentId: grammarPattern.segmentId,
      pattern: grammarPattern.pattern,
      title: grammarPattern.title,
      reading: grammarPattern.reading,
      meaningIt: grammarPattern.meaningIt,
      mediaSlug: media.slug,
      mediaTitle: media.title,
      segmentTitle: segment.title,
      crossMediaGroupKey: crossMediaGroup.groupKey,
      entryStatus: entryStatus.status
    })
    .from(grammarPattern)
    .innerJoin(media, eq(media.id, grammarPattern.mediaId))
    .leftJoin(segment, eq(segment.id, grammarPattern.segmentId))
    .leftJoin(
      crossMediaGroup,
      eq(crossMediaGroup.id, grammarPattern.crossMediaGroupId)
    )
    .leftJoin(
      entryStatus,
      and(
        eq(entryStatus.entryId, grammarPattern.id),
        eq(entryStatus.entryType, "grammar")
      )
    )
    .where(inArray(grammarPattern.id, grammarIds))
    .orderBy(asc(grammarPattern.pattern), asc(grammarPattern.title));
}

export async function countNewCardsIntroducedOnDayByMediaId(
  database: DatabaseClient,
  mediaId: string,
  asOf = new Date()
) {
  const { dayEndIso, dayStartIso } = getUtcDayBounds(asOf);

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
        gte(reviewLog.answeredAt, dayStartIso),
        lt(reviewLog.answeredAt, dayEndIso)
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

  const { dayEndIso, dayStartIso } = getUtcDayBounds(asOf);

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
        gte(reviewLog.answeredAt, dayStartIso),
        lt(reviewLog.answeredAt, dayEndIso)
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

export function getUtcDayBounds(asOf: Date) {
  const dayStart = new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate())
  );
  const dayEnd = new Date(dayStart);

  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  return {
    dayEndIso: dayEnd.toISOString(),
    dayStartIso: dayStart.toISOString()
  };
}

export type ReviewLaunchCandidate = {
  activeReviewCards: number;
  cardsTotal: number;
  dueCount: number;
  mediaId: string;
  newCount: number;
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

  const rows = await database.all<{
    activeReviewCards: number | string | null;
    cardsTotal: number | string | null;
    dueCount: number | string | null;
    mediaId: string;
    newCount: number | string | null;
    slug: string;
    title: string;
  }>(`
    WITH eligible_cards AS (
      SELECT
        c.id AS card_id,
        c.media_id AS media_id,
        c.status AS card_status,
        c.lesson_id AS lesson_id,
        rs.state AS review_state,
        rs.due_at AS due_at,
        COALESCE(rs.manual_override, 0) AS manual_override,
        CASE
          WHEN c.lesson_id IS NOT NULL
           AND EXISTS (
             SELECT 1
             FROM lesson l
             INNER JOIN lesson_progress lp
               ON lp.lesson_id = l.id
             WHERE l.id = c.lesson_id
               AND l.status = 'active'
               AND lp.status = 'completed'
           )
          THEN 1
          ELSE 0
        END AS has_completed_lesson
        ,
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
            WHEN ec.has_completed_lesson = 1
             AND ec.has_ignored_driving_entry = 0
             AND ec.has_known_manual_driving_entry = 0
            THEN 1
            ELSE 0
          END
        ),
        0
      ) AS cardsTotal,
      COALESCE(
        SUM(
          CASE
            WHEN ec.has_completed_lesson = 1
             AND ec.review_state IS NOT NULL
             AND ec.review_state NOT IN ('known_manual', 'suspended')
             AND ec.has_ignored_driving_entry = 0
             AND ec.has_known_manual_driving_entry = 0
            THEN 1
            ELSE 0
          END
        ),
        0
      ) AS activeReviewCards,
      COALESCE(
        SUM(
          CASE
            WHEN ec.has_completed_lesson = 1
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
      ) AS dueCount,
      COALESCE(
        SUM(
          CASE
            WHEN ec.has_completed_lesson = 1
             AND ec.review_state IS NULL
             AND ec.card_status != 'suspended'
             AND ec.has_ignored_driving_entry = 0
             AND ec.has_known_manual_driving_entry = 0
            THEN 1
            ELSE 0
          END
        ),
        0
      ) AS newCount
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
    newCount: Number(row.newCount ?? 0),
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
    .innerJoin(lesson, eq(lesson.id, card.lessonId))
    .innerJoin(lessonProgress, eq(lessonProgress.lessonId, lesson.id))
    .where(
      and(
        eq(card.mediaId, mediaId),
        eq(card.status, "active"),
        eq(lesson.status, "active"),
        eq(lessonProgress.status, "completed"),
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
