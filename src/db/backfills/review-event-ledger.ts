import { and, eq, isNull } from "drizzle-orm";

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
  "select" | "update"
>;

export type ReviewEventLedgerBackfillResult = {
  backfilledCount: number;
};

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

  let backfilledCount = 0;

  for (const row of legacyRows) {
    const cardTypeSnapshot =
      row.cardTypeSnapshot ??
      row.liveCardType ??
      LEGACY_UNKNOWN_REVIEW_CARD_TYPE;
    const recordedAt = row.answeredAt;
    const updatedRows = await database
      .update(reviewSubjectLog)
      .set({
        algorithmVersion: FSRS_ALGORITHM_VERSION,
        bindingVersion: FSRS_SCHEDULER_BINDING_VERSION,
        canonicalSubjectKey: row.canonicalSubjectKey ?? row.subjectKey,
        cardTypeSnapshot,
        eventKind: "grade",
        eventSchemaVersion: 0,
        mediaIdSnapshot: row.mediaIdSnapshot ?? row.liveMediaId,
        recallTask: row.recallTask ?? resolveReviewRecallTask(cardTypeSnapshot),
        recordedAt,
        studyDay: getReviewStudyDay(recordedAt),
        studyDayPolicy: getReviewStudyDayPolicyKey()
      })
      .where(
        and(
          eq(reviewSubjectLog.id, row.id),
          eq(reviewSubjectLog.eventSchemaVersion, 0),
          isNull(reviewSubjectLog.recordedAt)
        )
      )
      .returning({ id: reviewSubjectLog.id });

    backfilledCount += updatedRows.length;
  }

  return { backfilledCount };
}
