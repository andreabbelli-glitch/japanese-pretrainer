import { and, asc, eq, inArray, ne } from "drizzle-orm";

import type { DatabaseQueryClient } from "../client.ts";
import { card, grammarPattern, media, term } from "../schema/index.ts";
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

const reviewCardSelection = {
  columns: {
    id: true,
    mediaId: true,
    lessonId: true,
    segmentId: true,
    cardType: true,
    front: true,
    back: true,
    exampleJp: true,
    exampleIt: true,
    notesIt: true,
    status: true,
    orderIndex: true,
    createdAt: true,
    updatedAt: true
  },
  with: {
    lesson: {
      columns: {
        status: true
      },
      with: {
        progress: {
          columns: {
            status: true
          }
        }
      }
    },
    segment: {
      columns: {
        title: true
      }
    },
    entryLinks: {
      columns: {
        entryId: true,
        entryType: true,
        relationshipType: true
      }
    }
  }
} as const;

const reviewCardDetailSelection = {
  ...reviewCardSelection,
  with: {
    ...reviewCardSelection.with,
    media: {
      columns: {
        slug: true,
        status: true,
        title: true
      }
    }
  }
} as const;

export async function listCardsByMediaId(
  database: DatabaseQueryClient,
  mediaId: string
) {
  return database.query.card.findMany({
    where: and(eq(card.mediaId, mediaId), eq(card.status, "active")),
    with: cardRelations,
    orderBy: [asc(card.orderIndex), asc(card.createdAt)]
  });
}

export async function getCardById(
  database: DatabaseQueryClient,
  cardId: string
) {
  return database.query.card.findFirst({
    where: eq(card.id, cardId),
    ...reviewCardDetailSelection
  });
}

export async function getCardsByIds(
  database: DatabaseQueryClient,
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
  database: DatabaseQueryClient,
  cardIds: string[]
) {
  if (cardIds.length === 0) {
    return [];
  }

  return database.query.card.findMany({
    where: and(ne(card.status, "archived"), inArray(card.id, cardIds)),
    ...reviewCardSelection,
    orderBy: [asc(card.orderIndex), asc(card.createdAt)]
  });
}

export async function listReviewCardsByMediaId(
  database: Pick<DatabaseQueryClient, "query">,
  mediaId: string
) {
  return database.query.card.findMany({
    where: and(eq(card.mediaId, mediaId), ne(card.status, "archived")),
    ...reviewCardSelection,
    orderBy: [asc(card.orderIndex), asc(card.createdAt)]
  });
}

export async function listReviewCardsByMediaIds(
  database: Pick<DatabaseQueryClient, "query">,
  mediaIds: string[]
) {
  if (mediaIds.length === 0) {
    return [];
  }

  return database.query.card.findMany({
    where: and(inArray(card.mediaId, mediaIds), ne(card.status, "archived")),
    ...reviewCardSelection,
    orderBy: [asc(card.mediaId), asc(card.orderIndex), asc(card.createdAt)]
  });
}

export async function listTermEntryReviewSummariesByIds(
  database: DatabaseQueryClient,
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
      mediaSlug: media.slug
    })
    .from(term)
    .innerJoin(media, eq(media.id, term.mediaId))
    .where(inArray(term.id, termIds))
    .orderBy(asc(term.lemma), asc(term.reading));
}

export async function listTermReviewSubjectIdentityRowsByIds(
  database: DatabaseQueryClient,
  termIds: string[]
) {
  if (termIds.length === 0) {
    return [];
  }

  return database
    .select({
      id: term.id,
      crossMediaGroupId: term.crossMediaGroupId,
      lemma: term.lemma,
      reading: term.reading
    })
    .from(term)
    .where(inArray(term.id, termIds))
    .orderBy(asc(term.lemma), asc(term.reading));
}

export async function listGrammarEntryReviewSummariesByIds(
  database: DatabaseQueryClient,
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
      mediaSlug: media.slug
    })
    .from(grammarPattern)
    .innerJoin(media, eq(media.id, grammarPattern.mediaId))
    .where(inArray(grammarPattern.id, grammarIds))
    .orderBy(asc(grammarPattern.pattern), asc(grammarPattern.title));
}

export async function listGrammarReviewSubjectIdentityRowsByIds(
  database: DatabaseQueryClient,
  grammarIds: string[]
) {
  if (grammarIds.length === 0) {
    return [];
  }

  return database
    .select({
      id: grammarPattern.id,
      crossMediaGroupId: grammarPattern.crossMediaGroupId,
      pattern: grammarPattern.pattern,
      reading: grammarPattern.reading
    })
    .from(grammarPattern)
    .where(inArray(grammarPattern.id, grammarIds))
    .orderBy(asc(grammarPattern.pattern), asc(grammarPattern.title));
}

export type TermEntryReviewSummaryById = Awaited<
  ReturnType<typeof listTermEntryReviewSummariesByIds>
>[number];

export type GrammarEntryReviewSummaryById = Awaited<
  ReturnType<typeof listGrammarEntryReviewSummariesByIds>
>[number];

export type TermReviewSubjectIdentityRowById = Awaited<
  ReturnType<typeof listTermReviewSubjectIdentityRowsByIds>
>[number];

export type GrammarReviewSubjectIdentityRowById = Awaited<
  ReturnType<typeof listGrammarReviewSubjectIdentityRowsByIds>
>[number];

export {
  aggregateGlobalReviewOverviewData,
  getGlobalReviewNextCardFront,
  getGlobalReviewOverviewData,
  getQueuedNewReviewSubjectSummaryByMediaId,
  getReviewLaunchCandidateByMediaId,
  getReviewOverviewDataByMediaId,
  listReviewLaunchCandidates,
  selectReviewLaunchCandidateByDue,
  selectReviewLaunchCandidateByNew
} from "./review-overview.ts";
export type {
  GlobalReviewOverviewCounts,
  GlobalReviewOverviewData,
  ReviewLaunchCandidate
} from "./review-overview.ts";

export async function listDueCardsByMediaId(
  database: DatabaseQueryClient,
  mediaId: string,
  asOf = new Date().toISOString()
) {
  const dueRows = await database.all<{ cardId: string }>(`
    WITH ${buildReviewSubjectIdentityCteSql({ mediaFilter: quoteSqlString(mediaId) })},
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
      LEFT JOIN pre_review_consolidation_state prcs
        ON prcs.subject_key = si.subject_key
       AND prcs.status = 'pending'
      WHERE si.media_id = ${quoteSqlString(mediaId)}
        AND si.card_status = 'active'
        AND prcs.subject_key IS NULL
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

  const cards = await database.query.card.findMany({
    where: inArray(card.id, orderedCardIds),
    ...reviewCardSelection
  });
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
