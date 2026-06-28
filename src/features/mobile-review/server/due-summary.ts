import { db, type DatabaseClient } from "@/db";
import { buildReviewSubjectIdentityCteSql } from "@/db/queries/review-query-helpers";

export type MobileReviewDueSummary = {
  dueCount: number;
  nextDueAt: string | null;
};

export async function loadMobileReviewDueSummary(input: {
  asOf?: Date;
  database?: DatabaseClient;
} = {}): Promise<MobileReviewDueSummary> {
  const database = input.database ?? db;
  const asOfIso = (input.asOf ?? new Date()).toISOString();
  const row = await database.get<{
    dueCount: number;
    nextDueAt: string | null;
  }>(`
    WITH ${buildReviewSubjectIdentityCteSql()},
    eligible_due_subjects AS (
      SELECT
        si.subject_key AS subjectKey,
        MIN(rss.due_at) AS dueAt
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
      WHERE si.card_status = 'active'
        AND prcs.subject_key IS NULL
        AND l.status = 'active'
        AND lp.status = 'completed'
        AND rss.due_at IS NOT NULL
        AND rss.due_at <= '${asOfIso.replaceAll("'", "''")}'
        AND COALESCE(rss.manual_override, 0) = 0
        AND COALESCE(rss.suspended, 0) = 0
        AND rss.state NOT IN ('new', 'known_manual', 'suspended')
      GROUP BY si.subject_key
    )
    SELECT
      COUNT(*) AS dueCount,
      MIN(dueAt) AS nextDueAt
    FROM eligible_due_subjects
  `);

  return {
    dueCount: Number(row?.dueCount ?? 0),
    nextDueAt: row?.nextDueAt ?? null
  };
}
