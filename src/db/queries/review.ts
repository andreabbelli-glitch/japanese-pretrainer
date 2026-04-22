import { and, asc, eq, inArray, ne } from "drizzle-orm";

import type { DatabaseQueryClient } from "../client.ts";
import {
  card,
  grammarPattern,
  media,
  term
} from "../schema/index.ts";
import {
  buildReviewSubjectIdentityCteSql,
  getLocalDayBounds,
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

export type TermEntryReviewSummaryById = Awaited<
  ReturnType<typeof listTermEntryReviewSummariesByIds>
>[number];

export type GrammarEntryReviewSummaryById = Awaited<
  ReturnType<typeof listGrammarEntryReviewSummariesByIds>
>[number];

export type ReviewLaunchCandidate = {
  activeReviewCards: number;
  cardsTotal: number;
  dueCount: number;
  firstDueCardId: string | null;
  firstDueCreatedAt: string | null;
  firstDueDueAt: string | null;
  firstDueFront: string | null;
  firstDueLastInteractionAt: string | null;
  firstDueOrderIndex: number | null;
  firstNewCardId: string | null;
  firstNewCreatedAt: string | null;
  firstNewFront: string | null;
  firstNewLastInteractionAt: string | null;
  firstNewOrderIndex: number | null;
  manualCount: number;
  mediaId: string;
  newAvailableCount: number;
  newCount: number;
  slug: string;
  suspendedCount: number;
  title: string;
  tomorrowCount: number;
  totalCards: number;
};

export type GlobalReviewOverviewCounts = {
  activeReviewCards: number;
  dueCount: number;
  manualCount: number;
  newAvailableCount: number;
  suspendedCount: number;
  tomorrowCount: number;
  totalCards: number;
};

export type GlobalReviewOverviewData = GlobalReviewOverviewCounts & {
  firstDueFront: string | null;
  firstNewFront: string | null;
};

function buildCompletedLessonsCteSql(mediaId?: string) {
  const mediaFilterSql = mediaId
    ? `\n        AND l.media_id = ${quoteSqlString(mediaId)}`
    : "";

  return `
    completed_lessons AS (
      SELECT l.id
      FROM lesson l
      INNER JOIN lesson_progress lp
        ON lp.lesson_id = l.id
      WHERE l.status = 'active'
        AND lp.status = 'completed'${mediaFilterSql}
    )
  `;
}

export async function getGlobalReviewNextCardFront(
  database: DatabaseQueryClient,
  input: {
    asOf?: Date;
    queuedNewLimit?: number;
  } = {}
) {
  const asOf = input.asOf ?? new Date();
  const queuedNewLimit = input.queuedNewLimit ?? 0;
  const overview = await getGlobalReviewOverviewData(database, asOf);

  return (
    overview.firstDueFront ??
    (queuedNewLimit > 0 ? (overview.firstNewFront ?? null) : null)
  );
}

function compareNullableStringAsc(left: string | null, right: string | null) {
  if (left === right) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return left.localeCompare(right);
}

function compareNullableStringDesc(left: string | null, right: string | null) {
  if (left === right) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return right.localeCompare(left);
}

function compareNullableNumberAsc(left: number | null, right: number | null) {
  if (left === right) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return left - right;
}

function buildSubjectCardPartitionSql(partitionByMedia: boolean) {
  return partitionByMedia
    ? "PARTITION BY si.media_id, si.subject_key"
    : "PARTITION BY si.subject_key";
}

function compareReviewLaunchCandidatesByDue(
  left: ReviewLaunchCandidate,
  right: ReviewLaunchCandidate
) {
  const dueAtDifference = compareNullableStringAsc(
    left.firstDueDueAt,
    right.firstDueDueAt
  );

  if (dueAtDifference !== 0) {
    return dueAtDifference;
  }

  const interactionDifference = compareNullableStringDesc(
    left.firstDueLastInteractionAt,
    right.firstDueLastInteractionAt
  );

  if (interactionDifference !== 0) {
    return interactionDifference;
  }

  const orderIndexDifference = compareNullableNumberAsc(
    left.firstDueOrderIndex,
    right.firstDueOrderIndex
  );

  if (orderIndexDifference !== 0) {
    return orderIndexDifference;
  }

  const createdAtDifference = compareNullableStringAsc(
    left.firstDueCreatedAt,
    right.firstDueCreatedAt
  );

  if (createdAtDifference !== 0) {
    return createdAtDifference;
  }

  return compareNullableStringAsc(left.firstDueCardId, right.firstDueCardId);
}

function compareReviewLaunchCandidatesByNew(
  left: ReviewLaunchCandidate,
  right: ReviewLaunchCandidate
) {
  const interactionDifference = compareNullableStringDesc(
    left.firstNewLastInteractionAt,
    right.firstNewLastInteractionAt
  );

  if (interactionDifference !== 0) {
    return interactionDifference;
  }

  const orderIndexDifference = compareNullableNumberAsc(
    left.firstNewOrderIndex,
    right.firstNewOrderIndex
  );

  if (orderIndexDifference !== 0) {
    return orderIndexDifference;
  }

  const createdAtDifference = compareNullableStringAsc(
    left.firstNewCreatedAt,
    right.firstNewCreatedAt
  );

  if (createdAtDifference !== 0) {
    return createdAtDifference;
  }

  return compareNullableStringAsc(left.firstNewCardId, right.firstNewCardId);
}

export function selectReviewLaunchCandidateByDue(
  candidates: ReviewLaunchCandidate[]
) {
  let best: ReviewLaunchCandidate | null = null;

  for (const candidate of candidates) {
    if (candidate.firstDueFront === null) {
      continue;
    }

    if (
      best === null ||
      compareReviewLaunchCandidatesByDue(candidate, best) < 0
    ) {
      best = candidate;
    }
  }

  return best;
}

export function selectReviewLaunchCandidateByNew(
  candidates: ReviewLaunchCandidate[]
) {
  let best: ReviewLaunchCandidate | null = null;

  for (const candidate of candidates) {
    if (candidate.firstNewFront === null) {
      continue;
    }

    if (
      best === null ||
      compareReviewLaunchCandidatesByNew(candidate, best) < 0
    ) {
      best = candidate;
    }
  }

  return best;
}

async function loadReviewOverviewData(
  database: DatabaseQueryClient,
  input: {
    asOf: Date;
    completedLessonsMediaId?: string;
    scopePrefix: string;
    subjectIdentityMediaFilter: string;
    subjectCardPartitionByMedia?: boolean;
  }
): Promise<Array<ReviewLaunchCandidate & GlobalReviewOverviewCounts>> {
  const {
    asOf,
    completedLessonsMediaId,
    scopePrefix,
    subjectIdentityMediaFilter,
    subjectCardPartitionByMedia = false
  } = input;
  const asOfIso = asOf.toISOString();
  const { dayStartIso, dayEndIso } = getLocalDayBounds(
    new Date(asOf.getTime() + 86400000)
  );

  const subjectCardCandidatesCte = `${scopePrefix}_subject_card_candidates`;
  const subjectCandidatesCte = `${scopePrefix}_subject_candidates`;

  const rows = await database.all<{
    activeReviewCards: number | string | null;
    cardsTotal: number | string | null;
    dueCount: number | string | null;
    firstDueCardId: string | null;
    firstDueCreatedAt: string | null;
    firstDueDueAt: string | null;
    firstDueFront: string | null;
    firstDueLastInteractionAt: string | null;
    firstDueOrderIndex: number | string | null;
    firstNewCardId: string | null;
    firstNewCreatedAt: string | null;
    firstNewFront: string | null;
    firstNewLastInteractionAt: string | null;
    firstNewOrderIndex: number | string | null;
    manualCount: number | string | null;
    mediaId: string;
    newAvailableCount: number | string | null;
    slug: string;
    suspendedCount: number | string | null;
    title: string;
    tomorrowCount: number | string | null;
    totalCards: number | string | null;
  }>(`
    WITH ${buildReviewSubjectIdentityCteSql({ mediaFilter: subjectIdentityMediaFilter })},
    ${buildCompletedLessonsCteSql(completedLessonsMediaId)},
    ${subjectCardCandidatesCte} AS (
      SELECT
        si.media_id AS mediaId,
        si.subject_key AS subjectKey,
        si.card_id AS cardId,
        si.card_status AS cardStatus,
        si.created_at AS createdAt,
        si.order_index AS orderIndex,
        c.front AS front,
        COALESCE(rss.last_interaction_at, c.updated_at, si.created_at) AS lastInteractionAt,
        COALESCE(rss.manual_override, 0) AS manualOverride,
        COALESCE(rss.suspended, 0) AS suspended,
        COALESCE(rss.state, 'new') AS reviewState,
        rss.due_at AS dueAt,
        ROW_NUMBER() OVER (
          ${buildSubjectCardPartitionSql(subjectCardPartitionByMedia)}
          ORDER BY
            CASE
              WHEN rss.card_id IS NOT NULL
               AND rss.card_id = si.card_id THEN 0
              ELSE 1
            END ASC,
            CASE
              WHEN si.card_status = 'suspended'
               OR COALESCE(rss.suspended, 0) = 1
               OR COALESCE(rss.state, 'new') = 'suspended' THEN 4
              WHEN COALESCE(rss.manual_override, 0) = 1
               OR COALESCE(rss.state, 'new') = 'known_manual' THEN 3
              WHEN COALESCE(rss.state, 'new') = 'new' THEN 2
              WHEN rss.due_at IS NULL
               OR rss.due_at <= ${quoteSqlString(asOfIso)} THEN 0
              ELSE 1
            END ASC,
            CASE
              WHEN rss.card_id IS NOT NULL
               AND rss.card_id = si.card_id
                 THEN COALESCE(rss.last_interaction_at, c.updated_at, si.created_at)
              ELSE COALESCE(c.updated_at, si.created_at)
            END DESC,
            COALESCE(si.order_index, 2147483647) ASC,
            si.card_id ASC
        ) AS rowNumber
      FROM subject_identity si
      INNER JOIN card c
        ON c.id = si.card_id
      LEFT JOIN review_subject_state rss
        ON rss.subject_key = si.subject_key
      LEFT JOIN completed_lessons cl
        ON cl.id = si.lesson_id
      WHERE si.lesson_id IS NOT NULL
       AND cl.id IS NOT NULL
    ),
    ${subjectCandidatesCte} AS (
      SELECT
        mediaId,
        cardId,
        createdAt,
        dueAt,
        front,
        lastInteractionAt,
        manualOverride,
        orderIndex,
        subjectKey,
        CASE
          WHEN cardStatus = 'suspended'
           OR suspended = 1
           OR reviewState = 'suspended' THEN 'suspended'
          WHEN manualOverride = 1
           OR reviewState = 'known_manual' THEN 'known_manual'
          ELSE reviewState
        END AS effectiveState
      FROM ${subjectCardCandidatesCte}
      WHERE rowNumber = 1
    ),
    due_fronts AS (
      SELECT
        mediaId,
        front,
        dueAt,
        lastInteractionAt,
        orderIndex,
        createdAt,
        cardId,
        ROW_NUMBER() OVER (
          PARTITION BY mediaId
          ORDER BY
            CASE WHEN dueAt IS NULL THEN 1 ELSE 0 END ASC,
            dueAt ASC,
            lastInteractionAt DESC,
            COALESCE(orderIndex, 2147483647) ASC,
            createdAt ASC,
            cardId ASC
        ) AS rowNumber
      FROM ${subjectCandidatesCte}
      WHERE effectiveState NOT IN ('new', 'known_manual', 'suspended')
        AND (dueAt IS NULL OR dueAt <= ${quoteSqlString(asOfIso)})
    ),
    new_fronts AS (
      SELECT
        mediaId,
        front,
        lastInteractionAt,
        orderIndex,
        createdAt,
        cardId,
        ROW_NUMBER() OVER (
          PARTITION BY mediaId
          ORDER BY
            lastInteractionAt DESC,
            COALESCE(orderIndex, 2147483647) ASC,
            createdAt ASC,
            cardId ASC
        ) AS rowNumber
      FROM ${subjectCandidatesCte}
      WHERE effectiveState = 'new'
    )
    SELECT
      m.id AS mediaId,
      m.slug AS slug,
      m.title AS title,
      COALESCE(COUNT(gsc.subjectKey), 0) AS totalCards,
      COALESCE(SUM(CASE WHEN gsc.manualOverride = 0 AND gsc.effectiveState NOT IN ('new', 'known_manual', 'suspended') THEN 1 ELSE 0 END), 0) AS activeReviewCards,
      COALESCE(SUM(CASE WHEN gsc.manualOverride = 0 AND gsc.effectiveState NOT IN ('new', 'known_manual', 'suspended') AND (gsc.dueAt IS NULL OR gsc.dueAt <= ${quoteSqlString(asOfIso)}) THEN 1 ELSE 0 END), 0) AS dueCount,
      COALESCE(SUM(CASE WHEN gsc.manualOverride = 0 AND gsc.effectiveState = 'new' THEN 1 ELSE 0 END), 0) AS newAvailableCount,
      COALESCE(SUM(CASE WHEN gsc.effectiveState = 'known_manual' THEN 1 ELSE 0 END), 0) AS manualCount,
      COALESCE(SUM(CASE WHEN gsc.effectiveState = 'suspended' THEN 1 ELSE 0 END), 0) AS suspendedCount,
      COALESCE(SUM(CASE WHEN gsc.manualOverride = 0 AND gsc.effectiveState NOT IN ('new', 'known_manual', 'suspended') AND gsc.dueAt IS NOT NULL AND gsc.dueAt >= ${quoteSqlString(dayStartIso)} AND gsc.dueAt < ${quoteSqlString(dayEndIso)} THEN 1 ELSE 0 END), 0) AS tomorrowCount,
      MAX(first_due.front) AS firstDueFront,
      MAX(first_due.dueAt) AS firstDueDueAt,
      MAX(first_due.lastInteractionAt) AS firstDueLastInteractionAt,
      MAX(first_due.orderIndex) AS firstDueOrderIndex,
      MAX(first_due.createdAt) AS firstDueCreatedAt,
      MAX(first_due.cardId) AS firstDueCardId,
      MAX(first_new.front) AS firstNewFront,
      MAX(first_new.lastInteractionAt) AS firstNewLastInteractionAt,
      MAX(first_new.orderIndex) AS firstNewOrderIndex,
      MAX(first_new.createdAt) AS firstNewCreatedAt,
      MAX(first_new.cardId) AS firstNewCardId
    FROM media m
    LEFT JOIN ${subjectCandidatesCte} gsc ON gsc.mediaId = m.id
    LEFT JOIN due_fronts first_due
      ON first_due.mediaId = m.id
     AND first_due.rowNumber = 1
    LEFT JOIN new_fronts first_new
      ON first_new.mediaId = m.id
     AND first_new.rowNumber = 1
    WHERE m.status = 'active'
      ${completedLessonsMediaId ? `AND m.id = ${quoteSqlString(completedLessonsMediaId)}` : ""}
    GROUP BY m.id, m.slug, m.title
    ORDER BY m.title ASC, m.slug ASC
  `);

  return rows.map((row) => ({
    activeReviewCards: Number(row.activeReviewCards ?? 0),
    cardsTotal: Number(row.totalCards ?? 0),
    dueCount: Number(row.dueCount ?? 0),
    firstDueCardId: row.firstDueCardId,
    firstDueCreatedAt: row.firstDueCreatedAt,
    firstDueDueAt: row.firstDueDueAt,
    firstDueFront: row.firstDueFront,
    firstDueLastInteractionAt: row.firstDueLastInteractionAt,
    firstDueOrderIndex:
      row.firstDueOrderIndex == null ? null : Number(row.firstDueOrderIndex),
    firstNewCardId: row.firstNewCardId,
    firstNewCreatedAt: row.firstNewCreatedAt,
    firstNewFront: row.firstNewFront,
    firstNewLastInteractionAt: row.firstNewLastInteractionAt,
    firstNewOrderIndex:
      row.firstNewOrderIndex == null ? null : Number(row.firstNewOrderIndex),
    manualCount: Number(row.manualCount ?? 0),
    mediaId: row.mediaId,
    newAvailableCount: Number(row.newAvailableCount ?? 0),
    newCount: Number(row.newAvailableCount ?? 0),
    slug: row.slug,
    suspendedCount: Number(row.suspendedCount ?? 0),
    title: row.title,
    tomorrowCount: Number(row.tomorrowCount ?? 0),
    totalCards: Number(row.totalCards ?? 0)
  }));
}

export function aggregateGlobalReviewOverviewData(
  mediaStats: ReviewLaunchCandidate[]
): GlobalReviewOverviewData {
  const totals = mediaStats.reduce(
    (acc, row) => {
      acc.activeReviewCards += row.activeReviewCards;
      acc.dueCount += row.dueCount;
      acc.manualCount += row.manualCount;
      acc.newAvailableCount += row.newAvailableCount;
      acc.suspendedCount += row.suspendedCount;
      acc.tomorrowCount += row.tomorrowCount;
      acc.totalCards += row.totalCards;
      return acc;
    },
    {
      activeReviewCards: 0,
      dueCount: 0,
      manualCount: 0,
      newAvailableCount: 0,
      suspendedCount: 0,
      tomorrowCount: 0,
      totalCards: 0
    }
  );

  const firstDueFront =
    selectReviewLaunchCandidateByDue(mediaStats)?.firstDueFront ?? null;
  const firstNewFront =
    selectReviewLaunchCandidateByNew(mediaStats)?.firstNewFront ?? null;

  return {
    ...totals,
    firstDueFront,
    firstNewFront
  };
}

export async function getGlobalReviewOverviewData(
  database: DatabaseQueryClient,
  asOf = new Date()
): Promise<GlobalReviewOverviewData> {
  const mediaStats = await loadReviewOverviewData(database, {
    asOf,
    completedLessonsMediaId: undefined,
    scopePrefix: "global",
    subjectIdentityMediaFilter: "SELECT id FROM media WHERE status = 'active'"
  });

  return aggregateGlobalReviewOverviewData(mediaStats);
}

export async function getReviewOverviewDataByMediaId(
  database: DatabaseQueryClient,
  mediaId: string,
  asOf = new Date()
): Promise<GlobalReviewOverviewData> {
  const stats = await loadReviewOverviewData(database, {
    asOf,
    completedLessonsMediaId: mediaId,
    scopePrefix: "media",
    subjectIdentityMediaFilter: quoteSqlString(mediaId)
  });

  const row = stats[0];

  return {
    activeReviewCards: row?.activeReviewCards ?? 0,
    dueCount: row?.dueCount ?? 0,
    firstDueFront: row?.firstDueFront ?? null,
    firstNewFront: row?.firstNewFront ?? null,
    manualCount: row?.manualCount ?? 0,
    newAvailableCount: row?.newAvailableCount ?? 0,
    suspendedCount: row?.suspendedCount ?? 0,
    tomorrowCount: row?.tomorrowCount ?? 0,
    totalCards: row?.totalCards ?? 0
  };
}

export async function listReviewLaunchCandidates(
  database: DatabaseQueryClient,
  asOfIso = new Date().toISOString()
): Promise<ReviewLaunchCandidate[]> {
  const stats = await loadReviewOverviewData(database, {
    asOf: new Date(asOfIso),
    completedLessonsMediaId: undefined,
    scopePrefix: "launch",
    subjectIdentityMediaFilter: "SELECT id FROM media WHERE status = 'active'",
    subjectCardPartitionByMedia: true
  });

  return stats;
}

export async function getReviewLaunchCandidateByMediaId(
  database: DatabaseQueryClient,
  mediaId: string,
  asOfIso = new Date().toISOString()
): Promise<ReviewLaunchCandidate | null> {
  const stats = await loadReviewOverviewData(database, {
    asOf: new Date(asOfIso),
    completedLessonsMediaId: mediaId,
    scopePrefix: "launch",
    subjectIdentityMediaFilter: quoteSqlString(mediaId),
    subjectCardPartitionByMedia: true
  });

  return stats[0] ?? null;
}

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
