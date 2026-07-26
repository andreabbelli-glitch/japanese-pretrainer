import { eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  card,
  preReviewConsolidationState,
  reviewCanonicalControl,
  reviewSubjectState
} from "@/db/schema";
import {
  buildReviewCanonicalSubjectKey,
  buildReviewSubjectIdentityFromCanonical
} from "@/features/review/model/subject";
import { CURRENT_REVIEW_SCHEDULER_VERSION } from "@/features/review/model/scheduler";
import { appendReviewEvent } from "@/features/review/server/event-ledger";
import { upsertReviewSubjectState } from "@/features/review/server/mutation-context";

import type {
  ConsolidationAnswerResult,
  MarkConsolidationKnownInput,
  SubmitConsolidationAnswerInput
} from "./contracts";
import {
  countPendingRowsForLesson,
  countRetrainingRows,
  loadPendingConsolidationRowBySubjectKey
} from "./read-queries";
import {
  getDeterministicIndex,
  subjectRequiresReadingStep
} from "./presentation";

export async function submitConsolidationAnswer(
  input: SubmitConsolidationAnswerInput
): Promise<ConsolidationAnswerResult> {
  const database = input.database ?? db;
  const nowIso = (input.now ?? new Date()).toISOString();

  return database.transaction(async (transaction) => {
    const row = await loadPendingConsolidationRowBySubjectKey(
      transaction,
      input.subjectKey
    );

    if (!row) {
      throw new Error("Consolidation subject is not pending.");
    }

    if (input.selectedSubjectKey !== input.subjectKey) {
      const attemptCount = row.attemptCount + 1;
      const pendingCount =
        row.status === "retraining"
          ? await countRetrainingRows(transaction)
          : await countPendingRowsForLesson(transaction, row.lessonId);
      const nextStep = (await subjectRequiresReadingStep(transaction, row))
        ? "reading"
        : "meaning";
      const reinsertionSeed =
        row.status === "retraining" ? "retraining" : row.lessonId;
      const reinsertionIndex = getDeterministicIndex(
        [
          reinsertionSeed,
          input.subjectKey,
          input.step,
          String(attemptCount)
        ].join(":"),
        Math.max(1, pendingCount)
      );

      await transaction
        .update(preReviewConsolidationState)
        .set({
          attemptCount,
          lastAttemptAt: nowIso,
          readingPassedAt: null,
          updatedAt: nowIso
        })
        .where(eq(preReviewConsolidationState.subjectKey, input.subjectKey));

      return {
        attemptCount,
        completed: false,
        correct: false,
        lessonId: row.lessonId,
        mediaId: row.mediaId,
        nextStep,
        reinsertionIndex,
        status: row.status,
        subjectKey: input.subjectKey
      };
    }

    if (input.step === "reading") {
      await transaction
        .update(preReviewConsolidationState)
        .set({
          readingPassedAt: nowIso,
          updatedAt: nowIso
        })
        .where(eq(preReviewConsolidationState.subjectKey, input.subjectKey));

      return {
        attemptCount: row.attemptCount,
        completed: false,
        correct: true,
        lessonId: row.lessonId,
        mediaId: row.mediaId,
        nextStep: "meaning",
        reinsertionIndex: null,
        status: row.status,
        subjectKey: input.subjectKey
      };
    }

    if (
      (await subjectRequiresReadingStep(transaction, row)) &&
      !row.readingPassedAt
    ) {
      throw new Error("Reading step must be completed before meaning.");
    }

    const attemptCount = row.attemptCount + 1;

    await transaction
      .update(preReviewConsolidationState)
      .set({
        attemptCount,
        completedAt: nowIso,
        lastAttemptAt: nowIso,
        readingPassedAt: row.readingPassedAt,
        status: "passed",
        updatedAt: nowIso
      })
      .where(eq(preReviewConsolidationState.subjectKey, input.subjectKey));

    return {
      attemptCount,
      completed: true,
      correct: true,
      lessonId: row.lessonId,
      mediaId: row.mediaId,
      nextStep: null,
      reinsertionIndex: null,
      status: "passed",
      subjectKey: input.subjectKey
    };
  });
}

export async function markConsolidationKnown(
  input: MarkConsolidationKnownInput
): Promise<ConsolidationAnswerResult> {
  const database = input.database ?? db;
  const nowIso = (input.now ?? new Date()).toISOString();

  return database.transaction(async (transaction) => {
    const row = await loadPendingConsolidationRowBySubjectKey(
      transaction,
      input.subjectKey
    );

    if (!row) {
      throw new Error("Consolidation subject is not pending.");
    }

    if (row.status !== "pending") {
      throw new Error("Retraining consolidation cannot mark FSRS cards known.");
    }

    const canonicalSubjectKey =
      row.canonicalSubjectKey ??
      buildReviewCanonicalSubjectKey({
        crossMediaGroupId: row.crossMediaGroupId,
        entryId:
          row.subjectType === "card"
            ? row.representativeCardId
            : (row.entryId ?? row.representativeCardId),
        entryType: row.entryType,
        subjectKind: row.subjectType
      });
    const identity = buildReviewSubjectIdentityFromCanonical({
      cardId: row.representativeCardId,
      cardType: row.representativeCard.cardType,
      canonicalSubjectKey,
      crossMediaGroupId: row.crossMediaGroupId,
      entryId: row.entryId,
      entryType: row.entryType,
      subjectKind: row.subjectType
    });
    const existingCanonicalStates =
      await transaction.query.reviewSubjectState.findMany({
        where: eq(
          reviewSubjectState.canonicalSubjectKey,
          identity.canonicalSubjectKey
        )
      });
    const existingStatesByKey = new Map(
      existingCanonicalStates.map((state) => [state.subjectKey, state])
    );
    const initialCurrentState = {
      canonicalSubjectKey: identity.canonicalSubjectKey,
      cardId: row.representativeCardId,
      createdAt: nowIso,
      crossMediaGroupId: row.crossMediaGroupId,
      difficulty: null,
      dueAt: null,
      entryId: row.entryId,
      entryType: row.entryType,
      lapses: 0,
      lastInteractionAt: nowIso,
      lastReviewedAt: null,
      learningSteps: 0,
      manualOverride: true,
      recallTask: identity.recallTask,
      reps: 0,
      scheduledDays: 0,
      schedulerVersion: CURRENT_REVIEW_SCHEDULER_VERSION,
      stability: null,
      state: "new" as const,
      subjectKey: row.subjectKey,
      subjectType: row.subjectType,
      suspended: false,
      updatedAt: nowIso
    } satisfies typeof reviewSubjectState.$inferSelect;
    const statesByKey = new Map(existingStatesByKey);

    if (!statesByKey.has(row.subjectKey)) {
      statesByKey.set(row.subjectKey, initialCurrentState);
    }

    const representativeCardIds = [...statesByKey.values()]
      .map((state) => state.cardId)
      .filter((cardId): cardId is string => cardId !== null);
    const representativeCards =
      representativeCardIds.length > 0
        ? await transaction.query.card.findMany({
            where: inArray(card.id, representativeCardIds)
          })
        : [];
    const cardById = new Map(
      representativeCards.map((representativeCard) => [
        representativeCard.id,
        representativeCard
      ])
    );

    await transaction
      .insert(reviewCanonicalControl)
      .values({
        canonicalSubjectKey: identity.canonicalSubjectKey,
        createdAt: nowIso,
        status: "known_manual",
        updatedAt: nowIso
      })
      .onConflictDoUpdate({
        target: reviewCanonicalControl.canonicalSubjectKey,
        set: {
          status: "known_manual",
          updatedAt: nowIso
        }
      });

    await transaction
      .update(preReviewConsolidationState)
      .set({
        completedAt: nowIso,
        status: "known_manual",
        updatedAt: nowIso
      })
      .where(eq(preReviewConsolidationState.subjectKey, input.subjectKey));

    await transaction
      .update(preReviewConsolidationState)
      .set({
        completedAt: nowIso,
        status: "known_manual",
        updatedAt: nowIso
      })
      .where(
        eq(
          preReviewConsolidationState.canonicalSubjectKey,
          identity.canonicalSubjectKey
        )
      );

    for (const state of statesByKey.values()) {
      const representativeCard = state.cardId
        ? cardById.get(state.cardId)
        : undefined;

      if (!representativeCard) {
        throw new Error(
          `Review memory ${state.subjectKey} has no representative card.`
        );
      }

      const stateIdentity = buildReviewSubjectIdentityFromCanonical({
        cardId: representativeCard.id,
        cardType: representativeCard.cardType,
        canonicalSubjectKey: identity.canonicalSubjectKey,
        crossMediaGroupId: state.crossMediaGroupId,
        entryId: state.entryId,
        entryType: state.entryType,
        subjectKind: state.subjectType
      });
      const nextSubjectState = {
        ...state,
        canonicalSubjectKey: identity.canonicalSubjectKey,
        lastInteractionAt: nowIso,
        manualOverride: true,
        recallTask: stateIdentity.recallTask,
        suspended: false,
        updatedAt: nowIso
      } satisfies typeof reviewSubjectState.$inferSelect;

      await upsertReviewSubjectState(transaction, nextSubjectState);
      await appendReviewEvent(transaction, {
        afterState: nextSubjectState,
        answeredAt: nowIso,
        beforeState: existingStatesByKey.get(state.subjectKey) ?? null,
        cardId: representativeCard.id,
        cardType: representativeCard.cardType,
        eventKind: "manual",
        identity: stateIdentity,
        mediaId: representativeCard.mediaId,
        reason: "consolidation_known_manual"
      });
    }

    return {
      attemptCount: row.attemptCount,
      completed: true,
      correct: true,
      lessonId: row.lessonId,
      mediaId: row.mediaId,
      nextStep: null,
      reinsertionIndex: null,
      status: "known_manual",
      subjectKey: input.subjectKey
    };
  });
}
