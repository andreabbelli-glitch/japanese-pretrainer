import { and, asc, eq, inArray, ne } from "drizzle-orm";

import type { DatabaseClient } from "../client.ts";
import {
  card,
  crossMediaGroup,
  grammarPattern,
  media,
  segment,
  term
} from "../schema/index.ts";
import {
  buildReviewSubjectIdentityCteSql,
  quoteSqlString
} from "./review-query-helpers.ts";

const cardRelations = {
  lesson: {
    with: {
      progress: true
    }
  },
  segment: true,
  entryLinks: true
} as const;

export async function listCardsByMediaId(
  database: DatabaseClient,
  mediaId: string
) {
  return database.query.card.findMany({
    where: and(eq(card.mediaId, mediaId), eq(card.status, "active")),
    with: cardRelations,
    orderBy: [asc(card.orderIndex), asc(card.createdAt)]
  });
}

export async function getCardById(database: DatabaseClient, cardId: string) {
  return database.query.card.findFirst({
    where: eq(card.id, cardId),
    with: cardRelations
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
    with: cardRelations,
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
    with: cardRelations,
    orderBy: [asc(card.orderIndex), asc(card.createdAt)]
  });
}

export async function listReviewCardsByMediaId(
  database: DatabaseClient,
  mediaId: string
) {
  return database.query.card.findMany({
    where: and(eq(card.mediaId, mediaId), ne(card.status, "archived")),
    with: cardRelations,
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
    with: cardRelations,
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
      audioSrc: term.audioSrc,
      audioSource: term.audioSource,
      audioSpeaker: term.audioSpeaker,
      audioLicense: term.audioLicense,
      audioAttribution: term.audioAttribution,
      audioPageUrl: term.audioPageUrl,
      pitchAccent: term.pitchAccent,
      pitchAccentSource: term.pitchAccentSource,
      pitchAccentPageUrl: term.pitchAccentPageUrl,
      mediaSlug: media.slug,
      mediaTitle: media.title,
      segmentTitle: segment.title,
      crossMediaGroupKey: crossMediaGroup.groupKey
    })
    .from(term)
    .innerJoin(media, eq(media.id, term.mediaId))
    .leftJoin(segment, eq(segment.id, term.segmentId))
    .leftJoin(crossMediaGroup, eq(crossMediaGroup.id, term.crossMediaGroupId))
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
      audioSrc: grammarPattern.audioSrc,
      audioSource: grammarPattern.audioSource,
      audioSpeaker: grammarPattern.audioSpeaker,
      audioLicense: grammarPattern.audioLicense,
      audioAttribution: grammarPattern.audioAttribution,
      audioPageUrl: grammarPattern.audioPageUrl,
      pitchAccent: grammarPattern.pitchAccent,
      pitchAccentSource: grammarPattern.pitchAccentSource,
      pitchAccentPageUrl: grammarPattern.pitchAccentPageUrl,
      mediaSlug: media.slug,
      mediaTitle: media.title,
      segmentTitle: segment.title,
      crossMediaGroupKey: crossMediaGroup.groupKey
    })
    .from(grammarPattern)
    .innerJoin(media, eq(media.id, grammarPattern.mediaId))
    .leftJoin(segment, eq(segment.id, grammarPattern.segmentId))
    .leftJoin(
      crossMediaGroup,
      eq(crossMediaGroup.id, grammarPattern.crossMediaGroupId)
    )
    .where(inArray(grammarPattern.id, grammarIds))
    .orderBy(asc(grammarPattern.pattern), asc(grammarPattern.title));
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
  const asOfSql = quoteSqlString(asOfIso);

  const rows = await database.all<{
    activeReviewCards: number | string | null;
    cardsTotal: number | string | null;
    dueCount: number | string | null;
    mediaId: string;
    newCount: number | string | null;
    slug: string;
    title: string;
  }>(`
    WITH RECURSIVE ${buildReviewSubjectIdentityCteSql()},
    subject_media_candidates AS (
      SELECT
        si.media_id AS mediaId,
        si.subject_key AS subjectKey,
        MAX(
          CASE
            WHEN si.lesson_id IS NOT NULL
             AND EXISTS (
               SELECT 1
               FROM lesson l
               INNER JOIN lesson_progress lp
                 ON lp.lesson_id = l.id
               WHERE l.id = si.lesson_id
                 AND l.status = 'active'
                 AND lp.status = 'completed'
             )
            THEN 1
            ELSE 0
          END
        ) AS hasCompletedLesson,
        MAX(
          CASE
            WHEN si.card_status != 'suspended' THEN 1
            ELSE 0
          END
        ) AS hasActiveCard,
        MAX(COALESCE(rss.manual_override, 0)) AS manualOverride,
        MAX(COALESCE(rss.suspended, 0)) AS suspended,
        MAX(rss.state) AS reviewState,
        MAX(rss.due_at) AS dueAt
      FROM subject_identity si
      LEFT JOIN review_subject_state rss
        ON rss.subject_key = si.subject_key
      GROUP BY si.media_id, si.subject_key
    )
    SELECT
      m.id AS mediaId,
      m.slug AS slug,
      m.title AS title,
      COALESCE(
        SUM(
          CASE
            WHEN smc.hasCompletedLesson = 1
            THEN 1
            ELSE 0
          END
        ),
        0
      ) AS cardsTotal,
      COALESCE(
        SUM(
          CASE
            WHEN smc.hasCompletedLesson = 1
             AND smc.hasActiveCard = 1
             AND smc.suspended = 0
             AND smc.manualOverride = 0
             AND smc.reviewState NOT IN ('new', 'known_manual', 'suspended')
            THEN 1
            ELSE 0
          END
        ),
        0
      ) AS activeReviewCards,
      COALESCE(
        SUM(
          CASE
            WHEN smc.hasCompletedLesson = 1
             AND smc.hasActiveCard = 1
             AND smc.suspended = 0
             AND smc.manualOverride = 0
             AND smc.reviewState NOT IN ('new', 'known_manual', 'suspended')
             AND (smc.dueAt IS NULL OR smc.dueAt <= ${asOfSql})
            THEN 1
            ELSE 0
          END
        ),
        0
      ) AS dueCount,
      COALESCE(
        SUM(
          CASE
            WHEN smc.hasCompletedLesson = 1
             AND smc.hasActiveCard = 1
             AND smc.suspended = 0
             AND COALESCE(smc.reviewState, 'new') = 'new'
            THEN 1
            ELSE 0
          END
        ),
        0
      ) AS newCount
    FROM media m
    LEFT JOIN subject_media_candidates smc
      ON smc.mediaId = m.id
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

export async function listDueCardsByMediaId(
  database: DatabaseClient,
  mediaId: string,
  asOf = new Date().toISOString()
) {
  const dueRows = await database.all<{ cardId: string }>(`
    WITH RECURSIVE ${buildReviewSubjectIdentityCteSql()},
    eligible_due_cards AS (
      SELECT
        si.card_id AS cardId,
        si.subject_key AS subjectKey,
        si.order_index AS orderIndex,
        si.created_at AS createdAt,
        rss.due_at AS dueAt,
        ROW_NUMBER() OVER (
          PARTITION BY si.subject_key
          ORDER BY
            COALESCE(si.order_index, 2147483647) ASC,
            si.created_at ASC,
            si.card_id ASC
        ) AS rowNumber
      FROM subject_identity si
      INNER JOIN lesson l
        ON l.id = si.lesson_id
      INNER JOIN lesson_progress lp
        ON lp.lesson_id = l.id
      INNER JOIN review_subject_state rss
        ON rss.subject_key = si.subject_key
      WHERE si.media_id = ${quoteSqlString(mediaId)}
        AND si.card_status = 'active'
        AND l.status = 'active'
        AND lp.status = 'completed'
        AND rss.due_at IS NOT NULL
        AND rss.due_at <= ${quoteSqlString(asOf)}
        AND COALESCE(rss.manual_override, 0) = 0
        AND COALESCE(rss.suspended, 0) = 0
        AND rss.state NOT IN ('new', 'known_manual', 'suspended')
    )
    SELECT cardId
    FROM eligible_due_cards
    WHERE rowNumber = 1
    ORDER BY
      dueAt ASC,
      COALESCE(orderIndex, 2147483647) ASC,
      createdAt ASC,
      cardId ASC
  `);
  const orderedCardIds = dueRows.map((row) => row.cardId);

  if (orderedCardIds.length === 0) {
    return [];
  }

  const cards = await getCardsByIds(database, orderedCardIds);
  const cardsById = new Map(cards.map((dueCard) => [dueCard.id, dueCard]));

  return orderedCardIds.flatMap((cardId) => {
    const dueCard = cardsById.get(cardId);

    return dueCard ? [dueCard] : [];
  });
}

export type CardListItem = Awaited<
  ReturnType<typeof listCardsByMediaId>
>[number];
export type ReviewCardListItem = Awaited<
  ReturnType<typeof listReviewCardsByMediaId>
>[number];
