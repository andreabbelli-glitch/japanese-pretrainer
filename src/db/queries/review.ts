import { and, asc, eq, inArray, ne } from "drizzle-orm";

import type { DatabaseQueryClient } from "../client.ts";
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

export async function getCardById(database: DatabaseQueryClient, cardId: string) {
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

type ReviewOverviewDataRow = {
  activeReviewCards: number | string | null;
  dueCount: number | string | null;
  firstDueFront: string | null;
  firstNewFront: string | null;
  manualCount: number | string | null;
  newAvailableCount: number | string | null;
  suspendedCount: number | string | null;
  tomorrowCount: number | string | null;
  totalCards: number | string | null;
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

  return overview.firstDueFront ??
    (queuedNewLimit > 0 ? overview.firstNewFront ?? null : null);
}

export async function getGlobalReviewOverviewData(
  database: DatabaseQueryClient,
  asOf = new Date()
): Promise<GlobalReviewOverviewData> {
  return loadReviewOverviewData(database, {
    asOf,
    completedLessonsMediaId: undefined,
    scopePrefix: "global",
    subjectIdentityMediaFilter: "SELECT id FROM media WHERE status = 'active'"
  });
}

export async function getReviewOverviewDataByMediaId(
  database: DatabaseQueryClient,
  mediaId: string,
  asOf = new Date()
): Promise<GlobalReviewOverviewData> {
  return loadReviewOverviewData(database, {
    asOf,
    completedLessonsMediaId: mediaId,
    scopePrefix: "media",
    subjectIdentityMediaFilter: quoteSqlString(mediaId)
  });
}

async function loadReviewOverviewData(
  database: DatabaseQueryClient,
  input: {
    asOf: Date;
    completedLessonsMediaId?: string;
    scopePrefix: string;
    subjectIdentityMediaFilter: string;
  }
): Promise<GlobalReviewOverviewData> {
  const { asOf, completedLessonsMediaId, scopePrefix, subjectIdentityMediaFilter } =
    input;
  const asOfIso = asOf.toISOString();
  const tomorrowStart = new Date(
    asOf.getFullYear(),
    asOf.getMonth(),
    asOf.getDate() + 1
  );
  const tomorrowEnd = new Date(
    asOf.getFullYear(),
    asOf.getMonth(),
    asOf.getDate() + 2
  );
  const subjectCardCandidatesCte = `${scopePrefix}_subject_card_candidates`;
  const subjectCandidatesCte = `${scopePrefix}_subject_candidates`;

  const rows = await database.all<ReviewOverviewDataRow>(`
    WITH ${buildReviewSubjectIdentityCteSql({ mediaFilter: subjectIdentityMediaFilter })},
    ${buildCompletedLessonsCteSql(completedLessonsMediaId)},
    ${subjectCardCandidatesCte} AS (
      SELECT
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
          PARTITION BY si.subject_key
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
    first_due AS (
      SELECT front
      FROM ${subjectCandidatesCte}
      WHERE effectiveState NOT IN ('new', 'known_manual', 'suspended')
        AND (dueAt IS NULL OR dueAt <= ${quoteSqlString(asOfIso)})
      ORDER BY
        CASE
          WHEN dueAt IS NULL THEN 1
          ELSE 0
        END ASC,
        dueAt ASC,
        lastInteractionAt DESC,
        COALESCE(orderIndex, 2147483647) ASC,
        createdAt ASC,
        cardId ASC
      LIMIT 1
    ),
    first_new AS (
      SELECT front
      FROM ${subjectCandidatesCte}
      WHERE effectiveState = 'new'
      ORDER BY
        lastInteractionAt DESC,
        COALESCE(orderIndex, 2147483647) ASC,
        createdAt ASC,
        cardId ASC
      LIMIT 1
    )
    SELECT
      COALESCE(
        SUM(
          CASE
            WHEN gsc.subjectKey IS NOT NULL THEN 1
            ELSE 0
          END
        ),
        0
      ) AS totalCards,
      COALESCE(
        SUM(
          CASE
            WHEN gsc.manualOverride = 0
             AND gsc.effectiveState NOT IN ('new', 'known_manual', 'suspended')
            THEN 1
            ELSE 0
          END
        ),
        0
      ) AS activeReviewCards,
      COALESCE(
        SUM(
          CASE
            WHEN gsc.manualOverride = 0
             AND gsc.effectiveState NOT IN ('new', 'known_manual', 'suspended')
             AND (gsc.dueAt IS NULL OR gsc.dueAt <= ${quoteSqlString(asOfIso)})
            THEN 1
            ELSE 0
          END
        ),
        0
      ) AS dueCount,
      COALESCE(
        SUM(
          CASE
            WHEN gsc.manualOverride = 0
             AND gsc.effectiveState = 'new'
            THEN 1
            ELSE 0
          END
        ),
        0
      ) AS newAvailableCount,
      COALESCE(
        SUM(
          CASE
            WHEN gsc.effectiveState = 'known_manual'
            THEN 1
            ELSE 0
          END
        ),
        0
      ) AS manualCount,
      COALESCE(
        SUM(
          CASE
            WHEN gsc.effectiveState = 'suspended'
            THEN 1
            ELSE 0
          END
        ),
        0
      ) AS suspendedCount,
      COALESCE(
        SUM(
          CASE
            WHEN gsc.manualOverride = 0
             AND gsc.effectiveState NOT IN ('new', 'known_manual', 'suspended')
             AND gsc.dueAt IS NOT NULL
             AND gsc.dueAt > ${quoteSqlString(asOfIso)}
             AND gsc.dueAt >= ${quoteSqlString(tomorrowStart.toISOString())}
             AND gsc.dueAt < ${quoteSqlString(tomorrowEnd.toISOString())}
            THEN 1
            ELSE 0
          END
        ),
        0
      ) AS tomorrowCount,
      (SELECT front FROM first_due) AS firstDueFront,
      (SELECT front FROM first_new) AS firstNewFront
    FROM ${subjectCandidatesCte} gsc
  `);

  const row = rows[0];

  return {
    activeReviewCards: Number(row?.activeReviewCards ?? 0),
    dueCount: Number(row?.dueCount ?? 0),
    firstDueFront:
      typeof row?.firstDueFront === "string" ? row.firstDueFront : null,
    firstNewFront:
      typeof row?.firstNewFront === "string" ? row.firstNewFront : null,
    manualCount: Number(row?.manualCount ?? 0),
    newAvailableCount: Number(row?.newAvailableCount ?? 0),
    suspendedCount: Number(row?.suspendedCount ?? 0),
    tomorrowCount: Number(row?.tomorrowCount ?? 0),
    totalCards: Number(row?.totalCards ?? 0)
  };
}

export async function getGlobalReviewOverviewCounts(
  database: DatabaseQueryClient,
  asOf = new Date()
): Promise<GlobalReviewOverviewCounts> {
  const overview = await getGlobalReviewOverviewData(database, asOf);

  return {
    activeReviewCards: overview.activeReviewCards,
    dueCount: overview.dueCount,
    manualCount: overview.manualCount,
    newAvailableCount: overview.newAvailableCount,
    suspendedCount: overview.suspendedCount,
    tomorrowCount: overview.tomorrowCount,
    totalCards: overview.totalCards
  };
}

export async function listReviewLaunchCandidates(
  database: DatabaseQueryClient,
  asOfIso = new Date().toISOString()
): Promise<ReviewLaunchCandidate[]> {
  return loadReviewLaunchCandidates(database, asOfIso);
}

export async function getReviewLaunchCandidateByMediaId(
  database: DatabaseQueryClient,
  mediaId: string,
  asOfIso = new Date().toISOString()
): Promise<ReviewLaunchCandidate | null> {
  const [candidate] = await loadReviewLaunchCandidates(
    database,
    asOfIso,
    mediaId
  );

  return candidate ?? null;
}

async function loadReviewLaunchCandidates(
  database: DatabaseQueryClient,
  asOfIso: string,
  mediaId?: string
): Promise<ReviewLaunchCandidate[]> {
  const asOfSql = quoteSqlString(asOfIso);
  const subjectIdentityMediaFilter = mediaId
    ? quoteSqlString(mediaId)
    : "SELECT id FROM media WHERE status = 'active'";
  const mediaFilterSql = mediaId
    ? ` AND m.id = ${quoteSqlString(mediaId)}`
    : "";
  const orderBySql = mediaId ? "" : "ORDER BY m.title ASC, m.slug ASC";

  const rows = await database.all<{
    activeReviewCards: number | string | null;
    cardsTotal: number | string | null;
    dueCount: number | string | null;
    mediaId: string;
    newCount: number | string | null;
    slug: string;
    title: string;
  }>(`
    WITH ${buildReviewSubjectIdentityCteSql({
      mediaFilter: subjectIdentityMediaFilter
    })},
    ${buildCompletedLessonsCteSql(mediaId)},
    subject_media_candidates AS (
      SELECT
        si.media_id AS mediaId,
        si.subject_key AS subjectKey,
        MAX(
          CASE
            WHEN cl.id IS NOT NULL
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
      LEFT JOIN completed_lessons cl
        ON cl.id = si.lesson_id
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
      ${mediaFilterSql}
    GROUP BY m.id, m.slug, m.title
    ${orderBySql}
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
