import { asc, eq } from "drizzle-orm";

import {
  replayReviewHistory,
  type ReviewState as SchedulerReviewState
} from "../lib/review-scheduler.ts";
import type { DatabaseClient } from "./client.ts";
import { reviewLog, reviewState } from "./schema/review.ts";

type ReviewStateRow = typeof reviewState.$inferSelect;
type ReviewLogRow = typeof reviewLog.$inferSelect;

export async function migrateReviewHistoryToFsrs(
  database: DatabaseClient
): Promise<void> {
  const [stateRows, logRows] = await Promise.all([
    database.query.reviewState.findMany(),
    database.query.reviewLog.findMany({
      orderBy: [asc(reviewLog.cardId), asc(reviewLog.answeredAt), asc(reviewLog.id)]
    })
  ]);

  const stateByCardId = new Map(stateRows.map((row) => [row.cardId, row]));
  const logsByCardId = new Map<string, ReviewLogRow[]>();

  for (const logRow of logRows) {
    const existing = logsByCardId.get(logRow.cardId);

    if (existing) {
      existing.push(logRow);
      continue;
    }

    logsByCardId.set(logRow.cardId, [logRow]);
  }

  const legacyCardIds = new Set<string>();

  for (const stateRow of stateRows) {
    if (stateRow.schedulerVersion !== "fsrs_v1") {
      legacyCardIds.add(stateRow.cardId);
    }
  }

  for (const logRow of logRows) {
    if (logRow.schedulerVersion !== "fsrs_v1") {
      legacyCardIds.add(logRow.cardId);
    }
  }

  if (legacyCardIds.size === 0) {
    return;
  }

  await database.transaction(async (tx) => {
    for (const cardId of legacyCardIds) {
      const existingState = stateByCardId.get(cardId) ?? null;
      const cardLogs = logsByCardId.get(cardId) ?? [];

      if (cardLogs.length > 0) {
        const replayed = replayReviewHistory(
          cardLogs.map((log) => ({
            answeredAt: log.answeredAt,
            id: log.id,
            previousState: (log.previousState as SchedulerReviewState | null) ?? null,
            rating: log.rating,
            responseMs: log.responseMs ?? null
          }))
        );

        if (replayed) {
          for (const replayedLog of replayed.logs) {
            await tx
              .update(reviewLog)
              .set({
                previousState: replayedLog.previousState,
                newState: replayedLog.newState,
                scheduledDueAt: replayedLog.scheduledDueAt,
                elapsedDays: replayedLog.elapsedDays,
                schedulerVersion: replayedLog.schedulerVersion
              })
              .where(eq(reviewLog.id, replayedLog.id));
          }

          if (existingState) {
            const resetAfterLastReview = shouldTreatAsResetAfterLastReview(existingState);

            await tx
              .update(reviewState)
              .set(
                resetAfterLastReview
                  ? buildResetState(existingState)
                  : {
                      state: replayed.state.state,
                      stability: replayed.state.stability,
                      difficulty: replayed.state.difficulty,
                      dueAt: replayed.state.dueAt,
                      lastReviewedAt: replayed.state.lastReviewedAt,
                      scheduledDays: replayed.state.scheduledDays,
                      learningSteps: replayed.state.learningSteps,
                      lapses: replayed.state.lapses,
                      reps: replayed.state.reps,
                      schedulerVersion: replayed.state.schedulerVersion,
                      updatedAt: existingState.updatedAt
                    }
              )
              .where(eq(reviewState.cardId, cardId));
          }

          continue;
        }
      }

      if (existingState) {
        await tx
          .update(reviewState)
          .set(buildStateWithoutLogs(existingState))
          .where(eq(reviewState.cardId, cardId));
      }
    }
  });
}

function shouldTreatAsResetAfterLastReview(state: ReviewStateRow) {
  return (
    state.state === "new" &&
    state.lastReviewedAt === null &&
    state.reps === 0 &&
    state.lapses === 0
  );
}

function buildResetState(state: ReviewStateRow) {
  return {
    state: "new" as const,
    stability: null,
    difficulty: null,
    dueAt: state.dueAt ?? state.updatedAt,
    lastReviewedAt: null,
    scheduledDays: 0,
    learningSteps: 0,
    lapses: 0,
    reps: 0,
    schedulerVersion: "fsrs_v1" as const,
    updatedAt: state.updatedAt
  };
}

function buildStateWithoutLogs(state: ReviewStateRow) {
  const isNewState = state.state === "new";

  return {
    state: state.state,
    stability: isNewState ? null : state.stability,
    difficulty: isNewState ? null : state.difficulty,
    dueAt: state.dueAt,
    lastReviewedAt: isNewState ? null : state.lastReviewedAt,
    scheduledDays: isNewState ? 0 : deriveScheduledDays(state),
    learningSteps: isNewState ? 0 : state.learningSteps,
    lapses: isNewState ? 0 : state.lapses,
    reps: isNewState ? 0 : state.reps,
    schedulerVersion: "fsrs_v1" as const,
    updatedAt: state.updatedAt
  };
}

function deriveScheduledDays(state: ReviewStateRow) {
  if (state.scheduledDays > 0) {
    return state.scheduledDays;
  }

  if (state.lastReviewedAt && state.dueAt) {
    const scheduledMs =
      new Date(state.dueAt).getTime() - new Date(state.lastReviewedAt).getTime();

    if (Number.isFinite(scheduledMs) && scheduledMs > 0) {
      return Math.max(0, Math.round(scheduledMs / 86_400_000));
    }
  }

  if (state.stability && Number.isFinite(state.stability)) {
    return Math.max(0, Math.round(state.stability));
  }

  return 0;
}
