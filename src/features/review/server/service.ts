import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { db, type DatabaseClient } from "@/db";
import { preReviewConsolidationState, reviewSubjectLog } from "@/db/schema";
import { resolveReviewForcedContrast } from "@/features/kanji-clash/server/manual-contrast-review";

import { resolveEffectiveReviewState } from "@/features/review/model/state";
import { buildReviewSubjectSeedState } from "@/features/review/model/subject";
import {
  getFsrsOptimizerSnapshot,
  resolveFsrsPresetKey
} from "@/features/fsrs-optimizer/server";
import {
  scheduleReview,
  type ReviewRating,
  type ReviewState
} from "@/features/review/model/scheduler";
import type {
  ReviewForcedContrastPayload,
  ReviewForcedContrastResolution,
  ReviewScope
} from "@/features/review/types";
import { syncReviewGradeConsolidation } from "@/features/consolidation/server";
import {
  assertCardBelongsToExpectedMedia,
  isActiveReviewableMutationCard,
  loadReviewCardForMutation,
  loadReviewSubjectMutationContext,
  normalizeReviewFreshnessExpectation,
  patchReviewSubjectState,
  resolveReviewSubjectStateSource,
  resolveSubjectReviewStateForValidation,
  writeReviewSubjectStateForGrade,
  type ReviewMutationTransaction
} from "@/features/review/server/mutation-context";

const REVIEW_CARD_OUT_OF_DATE_ERROR_MESSAGE = "Review card is out of date.";

export {
  resetReviewCardProgress,
  setLinkedEntryStatusByCard,
  setReviewCardSuspended
} from "@/features/review/server/mutations";
export type { ReviewMutationTransaction } from "@/features/review/server/mutation-context";

export type ReviewGradeResult = {
  cardId: string;
  consolidationChanged: boolean;
  consolidationQueued: boolean;
  dueAt: string;
  forcedContrast?: ReviewForcedContrastResolution;
  mediaId: string;
  newState: ReviewState;
  previousState: ReviewState;
};

export async function applyReviewGrade(input: {
  cardId: string;
  database?: DatabaseClient;
  expectedMediaId?: string;
  expectedUpdatedAt?: string | null;
  forcedContrast?: ReviewForcedContrastPayload;
  forcedContrastMediaSlug?: string;
  forcedContrastScope?: ReviewScope;
  now?: Date;
  rating: ReviewRating;
  responseMs?: number | null;
}): Promise<ReviewGradeResult> {
  const database = input.database ?? db;

  return database.transaction((transaction) =>
    gradeReviewCardInTransaction({
      ...input,
      transaction
    })
  );
}

export async function gradeReviewCardInTransaction(input: {
  cardId: string;
  expectedMediaId?: string;
  expectedUpdatedAt?: string | null;
  forcedContrast?: ReviewForcedContrastPayload;
  forcedContrastMediaSlug?: string;
  forcedContrastScope?: ReviewScope;
  now?: Date;
  rating: ReviewRating;
  responseMs?: number | null;
  transaction: ReviewMutationTransaction;
}): Promise<ReviewGradeResult> {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const loadedCard = await loadReviewCardForMutation(
    input.transaction,
    input.cardId
  );

  if (!isActiveReviewableMutationCard(loadedCard)) {
    throw new Error("Review card not available for grading.");
  }

  assertCardBelongsToExpectedMedia(loadedCard.mediaId, input.expectedMediaId);

  const fsrsOptimizerSnapshotPromise = getFsrsOptimizerSnapshot(
    input.transaction
  );
  const subjectContextPromise = loadReviewSubjectMutationContext(
    input.transaction,
    loadedCard,
    nowIso
  );
  const [subjectContext, fsrsOptimizerSnapshot] = await Promise.all([
    subjectContextPromise,
    fsrsOptimizerSnapshotPromise
  ]);
  const expectedUpdatedAt = normalizeReviewFreshnessExpectation(
    input.expectedUpdatedAt
  );
  const currentUpdatedAt = subjectContext.subjectState?.updatedAt ?? null;

  if (
    expectedUpdatedAt !== undefined &&
    expectedUpdatedAt !== currentUpdatedAt
  ) {
    throw new Error(REVIEW_CARD_OUT_OF_DATE_ERROR_MESSAGE);
  }

  const resolvedSubjectState = resolveSubjectReviewStateForValidation(
    subjectContext.subjectState
  );

  await assertSubjectNotPendingConsolidation(
    input.transaction,
    subjectContext.identity.subjectKey
  );

  const effectiveState = resolveEffectiveReviewState({
    cardStatus: subjectContext.seedCard.status,
    reviewState: resolvedSubjectState
  });

  if (effectiveState.state === "known_manual") {
    throw new Error(
      "Manual mastery cards cannot be graded until the entry is reopened."
    );
  }

  if (effectiveState.state === "suspended") {
    throw new Error("Suspended cards must be resumed before grading.");
  }

  const seedState = buildReviewSubjectSeedState(
    subjectContext.memberCards,
    subjectContext.subjectState,
    nowIso
  );
  const presetKey = resolveFsrsPresetKey(loadedCard.cardType);
  const optimizedParameters = presetKey
    ? fsrsOptimizerSnapshot.presets[presetKey]
    : null;
  const previousState = (resolvedSubjectState?.state ?? "new") as ReviewState;
  const scheduled = scheduleReview({
    current: seedState.current,
    now,
    rating: input.rating,
    scheduler: {
      desiredRetention: fsrsOptimizerSnapshot.config.desiredRetention,
      weights: optimizedParameters?.weights ?? undefined
    }
  });
  const sourceState = resolveReviewSubjectStateSource(subjectContext, nowIso);

  const didWriteSubjectState = await writeReviewSubjectStateForGrade(
    input.transaction,
    patchReviewSubjectState(sourceState, {
      cardId: loadedCard.id,
      crossMediaGroupId: subjectContext.identity.crossMediaGroupId,
      difficulty: scheduled.difficulty,
      dueAt: scheduled.dueAt,
      entryId: subjectContext.identity.entryId,
      entryType: subjectContext.identity.entryType,
      lapses: scheduled.lapses,
      lastInteractionAt: nowIso,
      lastReviewedAt: nowIso,
      learningSteps: scheduled.learningSteps,
      manualOverride: false,
      reps: scheduled.reps,
      scheduledDays: scheduled.scheduledDays,
      schedulerVersion: scheduled.schedulerVersion,
      stability: scheduled.stability,
      state: scheduled.state,
      subjectType: subjectContext.identity.subjectKind,
      suspended: false,
      updatedAt: nowIso
    }),
    expectedUpdatedAt
  );

  if (!didWriteSubjectState) {
    throw new Error(REVIEW_CARD_OUT_OF_DATE_ERROR_MESSAGE);
  }

  const reviewLogId = `review_subject_log_${randomUUID()}`;

  await input.transaction.insert(reviewSubjectLog).values({
    id: reviewLogId,
    subjectKey: subjectContext.identity.subjectKey,
    cardId: loadedCard.id,
    answeredAt: nowIso,
    rating: input.rating,
    previousState,
    newState: scheduled.state,
    scheduledDueAt: scheduled.dueAt,
    elapsedDays: scheduled.elapsedDays,
    responseMs: input.responseMs ?? null,
    schedulerVersion: scheduled.schedulerVersion
  });

  const consolidationResult = await syncReviewGradeConsolidation({
    database: input.transaction,
    identity: subjectContext.identity,
    lessonId: loadedCard.lessonId!,
    mediaId: loadedCard.mediaId,
    now,
    rating: input.rating,
    representativeCardId: loadedCard.id
  });

  const forcedContrast = input.forcedContrast
    ? await resolveReviewForcedContrast({
        identity: subjectContext.identity,
        mediaId: loadedCard.mediaId,
        mediaSlug: input.forcedContrastMediaSlug,
        nowIso,
        payload: input.forcedContrast,
        scope: input.forcedContrastScope ?? "global",
        transaction: input.transaction
      })
    : undefined;

  return {
    cardId: loadedCard.id,
    consolidationChanged: consolidationResult.changed,
    consolidationQueued: consolidationResult.queued,
    dueAt: scheduled.dueAt,
    forcedContrast,
    mediaId: loadedCard.mediaId,
    newState: scheduled.state,
    previousState
  };
}

async function assertSubjectNotPendingConsolidation(
  transaction: ReviewMutationTransaction,
  subjectKey: string
) {
  const row = await transaction.query.preReviewConsolidationState.findFirst({
    columns: {
      subjectKey: true
    },
    where: and(
      eq(preReviewConsolidationState.subjectKey, subjectKey),
      eq(preReviewConsolidationState.status, "pending")
    )
  });

  if (row) {
    throw new Error("Review card is pending consolidation.");
  }
}
