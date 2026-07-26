import { eq, inArray } from "drizzle-orm";

import { db, type DatabaseClient, type DatabaseQueryClient } from "@/db";
import {
  listReviewSubjectStatesByKeys,
  type ReviewSubjectStateRecord
} from "@/db/queries";
import { preReviewConsolidationState } from "@/db/schema";
import {
  deriveReviewSubjectIdentity,
  type ReviewSubjectIdentity
} from "@/features/review/model/subject";
import type { ReviewRating } from "@/features/review/model/scheduler";

import { buildConsolidationEntryLookup } from "./entry-lookups";
import {
  listActiveConsolidationCardsByLessonId,
  type ConsolidationCard
} from "./read-queries";

type EnqueueLessonConsolidationInput = {
  database?: ConsolidationMutationClient;
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
        canonicalSubjectKey: candidate.identity.canonicalSubjectKey,
        subjectKey: candidate.identity.subjectKey,
        subjectType: candidate.identity.subjectKind,
        recallTask: candidate.identity.recallTask,
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

export async function syncReviewGradeConsolidation(input: {
  database?: ConsolidationMutationClient;
  identity: ReviewSubjectIdentity;
  lessonId: string;
  mediaId: string;
  now?: Date;
  rating: ReviewRating;
  representativeCardId: string;
}) {
  const database = input.database ?? db;
  const nowIso = (input.now ?? new Date()).toISOString();
  const existingRow =
    await database.query.preReviewConsolidationState.findFirst({
      where: eq(
        preReviewConsolidationState.subjectKey,
        input.identity.subjectKey
      )
    });

  if (existingRow?.status === "retraining" && input.rating !== "again") {
    await database
      .update(preReviewConsolidationState)
      .set({
        completedAt: nowIso,
        status: "passed",
        updatedAt: nowIso
      })
      .where(
        eq(preReviewConsolidationState.subjectKey, input.identity.subjectKey)
      );

    return {
      changed: true as const,
      queued: false as const,
      resolved: true as const,
      subjectKey: input.identity.subjectKey
    };
  }

  if (input.rating !== "again" && input.rating !== "hard") {
    return {
      changed: false as const,
      queued: false as const,
      resolved: false as const,
      subjectKey: input.identity.subjectKey
    };
  }

  if (
    existingRow?.status === "pending" ||
    existingRow?.status === "retraining"
  ) {
    return {
      changed: false as const,
      queued: false as const,
      resolved: false as const,
      subjectKey: input.identity.subjectKey
    };
  }

  const rowValues = {
    attemptCount: 0,
    canonicalSubjectKey: input.identity.canonicalSubjectKey,
    completedAt: null,
    crossMediaGroupId: input.identity.crossMediaGroupId,
    entryId: input.identity.entryId,
    entryType: input.identity.entryType,
    lastAttemptAt: null,
    lessonId: input.lessonId,
    mediaId: input.mediaId,
    readingPassedAt: null,
    recallTask: input.identity.recallTask,
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
    changed: true as const,
    queued: true as const,
    resolved: false as const,
    subjectKey: input.identity.subjectKey
  };
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
