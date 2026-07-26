import { and, eq, isNull } from "drizzle-orm";
import type { InStatement } from "@libsql/client";

import type { DatabaseClient } from "../client.ts";
import { card, reviewSubjectLog } from "../schema/index.ts";
import {
  FSRS_ALGORITHM_VERSION,
  FSRS_SCHEDULER_BINDING_VERSION
} from "../../features/fsrs-optimizer/server/parameter-set.ts";
import { resolveReviewRecallTask } from "../../features/review/model/recall-task.ts";
import {
  getReviewStudyDay,
  getReviewStudyDayPolicyKey
} from "../../features/review/model/study-day.ts";

export const LEGACY_UNKNOWN_REVIEW_CARD_TYPE = "legacy_unknown";

type ReviewEventLedgerBackfillDatabase = Pick<
  DatabaseClient,
  "$client" | "select"
>;

export type ReviewEventLedgerBackfillResult = {
  backfilledCount: number;
};

const REVIEW_EVENT_LEDGER_BACKFILL_BATCH_SIZE = 100;

export async function backfillLegacyReviewEvents(
  database: ReviewEventLedgerBackfillDatabase
): Promise<ReviewEventLedgerBackfillResult> {
  const legacyRows = await database
    .select({
      answeredAt: reviewSubjectLog.answeredAt,
      canonicalSubjectKey: reviewSubjectLog.canonicalSubjectKey,
      cardTypeSnapshot: reviewSubjectLog.cardTypeSnapshot,
      id: reviewSubjectLog.id,
      liveCardType: card.cardType,
      liveMediaId: card.mediaId,
      mediaIdSnapshot: reviewSubjectLog.mediaIdSnapshot,
      recallTask: reviewSubjectLog.recallTask,
      subjectKey: reviewSubjectLog.subjectKey
    })
    .from(reviewSubjectLog)
    .leftJoin(card, eq(card.id, reviewSubjectLog.cardId))
    .where(
      and(
        eq(reviewSubjectLog.eventSchemaVersion, 0),
        isNull(reviewSubjectLog.recordedAt)
      )
    );

  const statements: InStatement[] = legacyRows.map((row) => {
    const cardTypeSnapshot =
      row.cardTypeSnapshot ??
      row.liveCardType ??
      LEGACY_UNKNOWN_REVIEW_CARD_TYPE;
    const recordedAt = row.answeredAt;

    return {
      args: [
        FSRS_ALGORITHM_VERSION,
        FSRS_SCHEDULER_BINDING_VERSION,
        row.canonicalSubjectKey ?? row.subjectKey,
        cardTypeSnapshot,
        row.mediaIdSnapshot ?? row.liveMediaId,
        row.recallTask ?? resolveReviewRecallTask(cardTypeSnapshot),
        recordedAt,
        getReviewStudyDay(recordedAt),
        getReviewStudyDayPolicyKey(),
        row.id
      ],
      sql: `
        update review_subject_log
        set algorithm_version = ?,
          binding_version = ?,
          canonical_subject_key = ?,
          card_type_snapshot = ?,
          event_kind = 'grade',
          event_schema_version = 0,
          media_id_snapshot = ?,
          recall_task = ?,
          recorded_at = ?,
          study_day = ?,
          study_day_policy = ?
        where id = ?
          and event_schema_version = 0
          and recorded_at is null
      `
    };
  });
  let backfilledCount = 0;

  for (
    let index = 0;
    index < statements.length;
    index += REVIEW_EVENT_LEDGER_BACKFILL_BATCH_SIZE
  ) {
    const results = await database.$client.batch(
      statements.slice(
        index,
        index + REVIEW_EVENT_LEDGER_BACKFILL_BATCH_SIZE
      ),
      "write"
    );

    backfilledCount += results.reduce(
      (total, result) => total + result.rowsAffected,
      0
    );
  }

  return { backfilledCount };
}
