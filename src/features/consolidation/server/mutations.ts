import { eq } from "drizzle-orm";

import { db } from "@/db";
import { preReviewConsolidationState, reviewSubjectState } from "@/db/schema";

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

    await transaction
      .update(preReviewConsolidationState)
      .set({
        completedAt: nowIso,
        status: "known_manual",
        updatedAt: nowIso
      })
      .where(eq(preReviewConsolidationState.subjectKey, input.subjectKey));

    await transaction
      .insert(reviewSubjectState)
      .values({
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
        reps: 0,
        scheduledDays: 0,
        schedulerVersion: "fsrs_v1",
        stability: null,
        state: "known_manual",
        subjectKey: row.subjectKey,
        subjectType: row.subjectType,
        suspended: false,
        updatedAt: nowIso
      })
      .onConflictDoUpdate({
        target: reviewSubjectState.subjectKey,
        set: {
          cardId: row.representativeCardId,
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
          reps: 0,
          scheduledDays: 0,
          schedulerVersion: "fsrs_v1",
          stability: null,
          state: "known_manual",
          subjectType: row.subjectType,
          suspended: false,
          updatedAt: nowIso
        }
      });

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
