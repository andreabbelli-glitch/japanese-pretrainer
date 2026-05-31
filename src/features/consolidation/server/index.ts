import { eq, inArray } from "drizzle-orm";

import { db, type DatabaseClient, type DatabaseQueryClient } from "@/db";
import {
  listReviewSubjectStatesByKeys,
  type ReviewSubjectStateRecord
} from "@/db/queries";
import { preReviewConsolidationState, reviewSubjectState } from "@/db/schema";
import {
  deriveReviewSubjectIdentity,
  type ReviewSubjectIdentity
} from "@/features/review/model/subject";
import { setLessonCompletionState } from "@/features/textbook/server/progress";
import type { ReviewRating } from "@/features/review/model/scheduler";

import type {
  ConsolidationAnswerResult,
  MarkConsolidationKnownInput,
  SubmitConsolidationAnswerInput
} from "./contracts";
import { buildConsolidationEntryLookup } from "./entry-lookups";
import {
  countPendingRowsForLesson,
  countRetrainingRows,
  listActiveConsolidationCardsByLessonId,
  loadPendingConsolidationRowBySubjectKey,
  type ConsolidationCard
} from "./read-queries";
import {
  getDeterministicIndex,
  subjectRequiresReadingStep
} from "./presentation";

export type * from "./contracts";
export {
  getConsolidationHubData,
  getConsolidationSessionData,
  getRetrainingConsolidationSessionData
} from "./page-data";
export {
  getPendingConsolidationSubjectKeys,
  getPendingConsolidationSubjectKeySet
} from "./read-queries";

type EnqueueLessonConsolidationInput = {
  database?: ConsolidationMutationClient;
  lessonId: string;
  now?: Date;
};

type SetLessonCompletionWithConsolidationInput = {
  completed: boolean;
  database?: DatabaseClient;
  lessonId: string;
  now?: Date;
};

type ConsolidationCandidate = {
  identity: ReviewSubjectIdentity;
  representativeCardId: string;
  lessonId: string;
  mediaId: string;
};

type ConsolidationMutationClient = DatabaseQueryClient &
  Pick<DatabaseClient, "insert" | "update">;

export async function enqueueLessonConsolidation(
  input: EnqueueLessonConsolidationInput
) {
  const database = input.database ?? db;
  const nowIso = (input.now ?? new Date()).toISOString();
  const candidates = await buildLessonConsolidationCandidates(
    database,
    input.lessonId
  );

  if (candidates.length === 0) {
    return {
      createdCount: 0,
      subjectKeys: [] as string[]
    };
  }

  const subjectKeys = candidates.map(
    (candidate) => candidate.identity.subjectKey
  );
  const [existingReviewStates, existingConsolidationRows] = await Promise.all([
    listReviewSubjectStatesByKeys(database, subjectKeys),
    database.query.preReviewConsolidationState.findMany({
      where: inArray(preReviewConsolidationState.subjectKey, subjectKeys)
    })
  ]);
  const existingConsolidationKeys = new Set(
    existingConsolidationRows.map((row) => row.subjectKey)
  );
  const rowsToInsert = candidates.filter((candidate) => {
    const existingReviewState = existingReviewStates.get(
      candidate.identity.subjectKey
    );

    return (
      !existingConsolidationKeys.has(candidate.identity.subjectKey) &&
      (!existingReviewState ||
        isImporterSeededNewReviewSubjectState(existingReviewState))
    );
  });

  if (rowsToInsert.length === 0) {
    return {
      createdCount: 0,
      subjectKeys: [] as string[]
    };
  }

  await database
    .insert(preReviewConsolidationState)
    .values(
      rowsToInsert.map((candidate) => ({
        subjectKey: candidate.identity.subjectKey,
        subjectType: candidate.identity.subjectKind,
        entryType: candidate.identity.entryType,
        crossMediaGroupId: candidate.identity.crossMediaGroupId,
        entryId: candidate.identity.entryId,
        representativeCardId: candidate.representativeCardId,
        lessonId: candidate.lessonId,
        mediaId: candidate.mediaId,
        status: "pending" as const,
        attemptCount: 0,
        lastAttemptAt: null,
        completedAt: null,
        createdAt: nowIso,
        updatedAt: nowIso
      }))
    )
    .onConflictDoNothing({
      target: preReviewConsolidationState.subjectKey
    });

  return {
    createdCount: rowsToInsert.length,
    subjectKeys: rowsToInsert.map((candidate) => candidate.identity.subjectKey)
  };
}

export async function enqueueReviewMistakeConsolidation(input: {
  database?: ConsolidationMutationClient;
  identity: ReviewSubjectIdentity;
  lessonId: string;
  mediaId: string;
  now?: Date;
  rating: ReviewRating;
  representativeCardId: string;
}) {
  if (input.rating !== "again" && input.rating !== "hard") {
    return {
      queued: false as const,
      subjectKey: input.identity.subjectKey
    };
  }

  const database = input.database ?? db;
  const nowIso = (input.now ?? new Date()).toISOString();
  const existingRow =
    await database.query.preReviewConsolidationState.findFirst({
      where: eq(
        preReviewConsolidationState.subjectKey,
        input.identity.subjectKey
      )
    });

  if (
    existingRow?.status === "pending" ||
    existingRow?.status === "retraining"
  ) {
    return {
      queued: false as const,
      subjectKey: input.identity.subjectKey
    };
  }

  const rowValues = {
    attemptCount: 0,
    completedAt: null,
    crossMediaGroupId: input.identity.crossMediaGroupId,
    entryId: input.identity.entryId,
    entryType: input.identity.entryType,
    lastAttemptAt: null,
    lessonId: input.lessonId,
    mediaId: input.mediaId,
    readingPassedAt: null,
    representativeCardId: input.representativeCardId,
    status: "retraining" as const,
    subjectType: input.identity.subjectKind,
    updatedAt: nowIso
  };

  if (existingRow) {
    await database
      .update(preReviewConsolidationState)
      .set(rowValues)
      .where(
        eq(preReviewConsolidationState.subjectKey, input.identity.subjectKey)
      );
  } else {
    await database.insert(preReviewConsolidationState).values({
      ...rowValues,
      createdAt: nowIso,
      subjectKey: input.identity.subjectKey
    });
  }

  return {
    queued: true as const,
    subjectKey: input.identity.subjectKey
  };
}

export async function setLessonCompletionWithConsolidation(
  input: SetLessonCompletionWithConsolidationInput
) {
  const database = input.database ?? db;

  return database.transaction(async (transaction) => {
    const completion = await setLessonCompletionState(
      input.lessonId,
      input.completed,
      transaction
    );
    const consolidation =
      input.completed && completion.completedNow
        ? await enqueueLessonConsolidation({
            database: transaction,
            lessonId: input.lessonId,
            now: input.now
          })
        : {
            createdCount: 0,
            subjectKeys: [] as string[]
          };

    return {
      ...completion,
      consolidation
    };
  });
}

async function buildLessonConsolidationCandidates(
  database: ConsolidationMutationClient,
  lessonId: string
): Promise<ConsolidationCandidate[]> {
  const cards = await listActiveConsolidationCardsByLessonId(
    database,
    lessonId
  );

  if (cards.length === 0) {
    return [];
  }

  const entryLookup = await buildConsolidationEntryLookup(database, cards);
  const candidatesBySubjectKey = new Map<string, ConsolidationCandidate>();

  for (const candidateCard of cards) {
    if (!isCardFromCompletedActiveLesson(candidateCard)) {
      continue;
    }

    const identity = deriveReviewSubjectIdentity({
      cardId: candidateCard.id,
      cardType: candidateCard.cardType,
      entryLinks: candidateCard.entryLinks,
      entryLookup,
      front: candidateCard.front
    });

    if (!candidatesBySubjectKey.has(identity.subjectKey)) {
      candidatesBySubjectKey.set(identity.subjectKey, {
        identity,
        lessonId: candidateCard.lessonId!,
        mediaId: candidateCard.mediaId,
        representativeCardId: candidateCard.id
      });
    }
  }

  return [...candidatesBySubjectKey.values()];
}

function isCardFromCompletedActiveLesson(
  candidateCard: Pick<ConsolidationCard, "lesson" | "lessonId">
) {
  return (
    Boolean(candidateCard.lessonId) &&
    candidateCard.lesson?.status === "active" &&
    candidateCard.lesson.progress?.status === "completed"
  );
}

function isImporterSeededNewReviewSubjectState(
  state: ReviewSubjectStateRecord
) {
  return (
    state.state === "new" &&
    state.reps === 0 &&
    state.learningSteps === 0 &&
    state.lapses === 0 &&
    state.scheduledDays === 0 &&
    state.lastReviewedAt === null &&
    state.dueAt === null &&
    state.stability === null &&
    state.difficulty === null &&
    !state.manualOverride &&
    !state.suspended
  );
}

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
