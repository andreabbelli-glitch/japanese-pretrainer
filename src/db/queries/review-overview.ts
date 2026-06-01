import type { DatabaseQueryClient } from "../client.ts";
import {
  buildCompletedReviewLessonsCteSql,
  buildReviewSubjectIdentityCteSql,
  quoteSqlString
} from "./review-query-helpers.ts";
import {
  loadReviewLaunchCandidateRows,
  selectReviewLaunchCandidateByDue,
  selectReviewLaunchCandidateByNew,
  type ReviewLaunchCandidate
} from "./review-launch-candidates.ts";

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
  const mediaStats = await loadReviewLaunchCandidateRows(database, {
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
  const stats = await loadReviewLaunchCandidateRows(database, {
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

export async function getQueuedNewReviewSubjectSummaryByMediaId(
  database: DatabaseQueryClient,
  input: {
    asOf?: Date;
    mediaId: string;
    queuedNewLimit: number;
  }
) {
  const queuedNewLimit = Math.max(Math.trunc(input.queuedNewLimit), 0);

  const asOf = input.asOf ?? new Date();
  const asOfIso = asOf.toISOString();
  const rows = await database.all<{
    count: number | string | null;
    firstDueFront: string | null;
    firstFront: string | null;
  }>(`
    WITH ${buildReviewSubjectIdentityCteSql({
      mediaFilter: "SELECT id FROM media WHERE status = 'active'"
    })},
    ${buildCompletedReviewLessonsCteSql()},
    global_subject_card_candidates AS (
      SELECT
        si.media_id AS mediaId,
        si.subject_key AS subjectKey,
        si.card_id AS cardId,
        si.card_status AS cardStatus,
        si.created_at AS createdAt,
        si.order_index AS orderIndex,
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
      LEFT JOIN pre_review_consolidation_state prcs
        ON prcs.subject_key = si.subject_key
       AND prcs.status = 'pending'
      INNER JOIN completed_lessons cl
        ON cl.id = si.lesson_id
      WHERE si.lesson_id IS NOT NULL
        AND prcs.subject_key IS NULL
    ),
    global_subject_candidates AS (
      SELECT
        cardId,
        createdAt,
        dueAt,
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
      FROM global_subject_card_candidates
      WHERE rowNumber = 1
    ),
    due_subjects AS (
      SELECT
        cardId,
        createdAt,
        dueAt,
        lastInteractionAt,
        orderIndex,
        subjectKey,
        ROW_NUMBER() OVER (
          ORDER BY
            CASE WHEN dueAt IS NULL THEN 1 ELSE 0 END ASC,
            dueAt ASC,
            lastInteractionAt DESC,
            COALESCE(orderIndex, 2147483647) ASC,
            createdAt ASC,
            cardId ASC
        ) AS queueRank
      FROM global_subject_candidates
      WHERE manualOverride = 0
        AND effectiveState NOT IN ('new', 'known_manual', 'suspended')
        AND (dueAt IS NULL OR dueAt <= ${quoteSqlString(asOfIso)})
    ),
    queued_new_subjects AS (
      SELECT
        cardId,
        createdAt,
        lastInteractionAt,
        orderIndex,
        subjectKey,
        ROW_NUMBER() OVER (
          ORDER BY
            lastInteractionAt DESC,
            COALESCE(orderIndex, 2147483647) ASC,
            createdAt ASC,
            cardId ASC
        ) AS queueRank
      FROM global_subject_candidates
      WHERE manualOverride = 0
        AND effectiveState = 'new'
    ),
    visible_due_subject_cards AS (
      SELECT
        ds.cardId AS subjectCardId,
        ds.createdAt AS subjectCreatedAt,
        ds.dueAt AS subjectDueAt,
        ds.lastInteractionAt AS subjectLastInteractionAt,
        ds.orderIndex AS subjectOrderIndex,
        si.subject_key AS subjectKey,
        si.card_id AS cardId,
        si.card_status AS cardStatus,
        si.created_at AS createdAt,
        si.order_index AS orderIndex,
        c.front AS front,
        COALESCE(rss.manual_override, 0) AS manualOverride,
        COALESCE(rss.suspended, 0) AS suspended,
        COALESCE(rss.state, 'new') AS reviewState,
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
            COALESCE(c.updated_at, si.created_at) DESC,
            COALESCE(si.order_index, 2147483647) ASC,
            si.card_id ASC
        ) AS rowNumber
      FROM due_subjects ds
      INNER JOIN subject_identity si
        ON si.subject_key = ds.subjectKey
       AND si.media_id = ${quoteSqlString(input.mediaId)}
      INNER JOIN card c
        ON c.id = si.card_id
      LEFT JOIN review_subject_state rss
        ON rss.subject_key = si.subject_key
      INNER JOIN completed_lessons cl
        ON cl.id = si.lesson_id
      WHERE si.lesson_id IS NOT NULL
        AND si.card_status != 'suspended'
        AND COALESCE(rss.suspended, 0) = 0
        AND COALESCE(rss.state, 'new') != 'suspended'
    ),
    visible_due_subjects AS (
      SELECT
        front,
        subjectCardId,
        subjectCreatedAt,
        subjectDueAt,
        subjectKey,
        subjectLastInteractionAt,
        subjectOrderIndex
      FROM visible_due_subject_cards
      WHERE rowNumber = 1
    ),
    visible_queued_subject_cards AS (
      SELECT
        qns.lastInteractionAt AS subjectLastInteractionAt,
        si.subject_key AS subjectKey,
        si.card_id AS cardId,
        si.card_status AS cardStatus,
        si.created_at AS createdAt,
        si.order_index AS orderIndex,
        c.front AS front,
        COALESCE(c.updated_at, si.created_at) AS cardInteractionAt,
        COALESCE(rss.manual_override, 0) AS manualOverride,
        COALESCE(rss.suspended, 0) AS suspended,
        COALESCE(rss.state, 'new') AS reviewState,
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
            COALESCE(c.updated_at, si.created_at) DESC,
            COALESCE(si.order_index, 2147483647) ASC,
            si.card_id ASC
        ) AS rowNumber
      FROM queued_new_subjects qns
      INNER JOIN subject_identity si
        ON si.subject_key = qns.subjectKey
       AND si.media_id = ${quoteSqlString(input.mediaId)}
      INNER JOIN card c
        ON c.id = si.card_id
      LEFT JOIN review_subject_state rss
        ON rss.subject_key = si.subject_key
      INNER JOIN completed_lessons cl
        ON cl.id = si.lesson_id
      WHERE si.lesson_id IS NOT NULL
        AND si.card_status != 'suspended'
        AND COALESCE(rss.suspended, 0) = 0
        AND COALESCE(rss.state, 'new') != 'suspended'
        AND qns.queueRank <= ${queuedNewLimit}
    ),
    visible_queued_subjects AS (
      SELECT
        cardId,
        createdAt,
        front,
        orderIndex,
        subjectKey,
        subjectLastInteractionAt
      FROM visible_queued_subject_cards
      WHERE rowNumber = 1
    )
    SELECT
      cast(count(distinct subjectKey) as integer) AS count,
      (
        SELECT front
        FROM visible_due_subjects
        ORDER BY
          CASE WHEN subjectDueAt IS NULL THEN 1 ELSE 0 END ASC,
          subjectDueAt ASC,
          subjectLastInteractionAt DESC,
          COALESCE(subjectOrderIndex, 2147483647) ASC,
          subjectCreatedAt ASC,
          subjectCardId ASC
        LIMIT 1
      ) AS firstDueFront,
      (
        SELECT front
        FROM visible_queued_subjects
        ORDER BY
          subjectLastInteractionAt DESC,
          COALESCE(orderIndex, 2147483647) ASC,
          createdAt ASC,
          cardId ASC
        LIMIT 1
      ) AS firstFront
    FROM visible_queued_subjects
  `);

  return {
    count: Number(rows[0]?.count ?? 0),
    firstDueFront: rows[0]?.firstDueFront ?? null,
    firstFront: rows[0]?.firstFront ?? null
  };
}
