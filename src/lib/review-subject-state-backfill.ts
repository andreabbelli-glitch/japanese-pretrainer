import { sql } from "drizzle-orm";

import type { DatabaseClient } from "../db/client.ts";
import { listReviewCardsByMediaIds } from "../db/queries/review.ts";
import { listReviewSubjectStatesByKeys } from "../db/queries/review-subject.ts";
import { reviewSubjectState } from "../db/schema/review.ts";

import type { ReviewSubjectStateSnapshot } from "./review-subject.ts";
import {
  resolveReviewSubjectGroups,
  type ResolveReviewSubjectGroupsResult
} from "./review-subject-state-lookup.ts";

export type ReviewSubjectStateBackfillResult = {
  cardCount: number;
  insertedCount: number;
  subjectCount: number;
};

type ReviewSubjectStateDatabase = Pick<DatabaseClient, "insert" | "query">;

type ReviewSubjectCoverageSnapshot = {
  cardCount: number;
  existingStateCount: number;
  missingStateCount: number;
  subjectCount: number;
  subjectGroups: ResolveReviewSubjectGroupsResult["subjectGroups"];
};

export async function syncReviewSubjectState(
  database: ReviewSubjectStateDatabase,
  input: {
    now?: Date;
  } = {}
): Promise<ReviewSubjectStateBackfillResult> {
  const snapshot = await loadReviewSubjectCoverageSnapshot(database, input);

  if (snapshot.subjectGroups.length === 0) {
    return {
      cardCount: snapshot.cardCount,
      insertedCount: 0,
      subjectCount: snapshot.subjectCount
    };
  }

  await database
    .insert(reviewSubjectState)
    .values(
      snapshot.subjectGroups.map((group) =>
        buildSynchronizedReviewSubjectState(group)
      )
    )
    .onConflictDoUpdate({
      target: reviewSubjectState.subjectKey,
      set: {
        cardId: sql.raw("excluded.card_id"),
        crossMediaGroupId: sql.raw("excluded.cross_media_group_id"),
        entryId: sql.raw("excluded.entry_id"),
        entryType: sql.raw("excluded.entry_type"),
        subjectType: sql.raw("excluded.subject_type"),
        suspended: sql.raw("excluded.suspended")
      }
    });

  return {
    cardCount: snapshot.cardCount,
    insertedCount: snapshot.missingStateCount,
    subjectCount: snapshot.subjectCount
  };
}

export async function backfillReviewSubjectState(
  database: ReviewSubjectStateDatabase,
  input: {
    now?: Date;
  } = {}
): Promise<ReviewSubjectStateBackfillResult> {
  return syncReviewSubjectState(database, input);
}

async function loadReviewSubjectCoverageSnapshot(
  database: ReviewSubjectStateDatabase,
  input: {
    now?: Date;
  }
): Promise<ReviewSubjectCoverageSnapshot> {
  const [mediaRows, terms, grammar] = await Promise.all([
    database.query.media.findMany({
      columns: {
        id: true
      }
    }),
    database.query.term.findMany({
      columns: {
        crossMediaGroupId: true,
        id: true,
        lemma: true,
        reading: true
      }
    }),
    database.query.grammarPattern.findMany({
      columns: {
        crossMediaGroupId: true,
        id: true,
        pattern: true,
        reading: true
      }
    })
  ]);
  const mediaIds = mediaRows.map((row) => row.id);

  if (mediaIds.length === 0) {
    return {
      cardCount: 0,
      existingStateCount: 0,
      missingStateCount: 0,
      subjectCount: 0,
      subjectGroups: []
    };
  }

  const cards = await listReviewCardsByMediaIds(database, mediaIds);

  if (cards.length === 0) {
    return {
      cardCount: 0,
      existingStateCount: 0,
      missingStateCount: 0,
      subjectCount: 0,
      subjectGroups: []
    };
  }

  const { subjectGroups, subjectStates } = await resolveReviewSubjectGroups({
    cards,
    grammar,
    loadSubjectStatesByKeys: (subjectKeys) =>
      listReviewSubjectStatesByKeys(database, subjectKeys),
    nowIso: input.now?.toISOString(),
    terms
  });
  const existingStateCount = subjectStates.size;

  return {
    cardCount: cards.length,
    existingStateCount,
    missingStateCount: subjectGroups.length - existingStateCount,
    subjectCount: subjectGroups.length,
    subjectGroups
  };
}

function buildInitialReviewSubjectState(
  group: ReviewSubjectCoverageSnapshot["subjectGroups"][number]
): ReviewSubjectStateSnapshot {
  return {
    cardId: group.representativeCard.id,
    createdAt: group.representativeCard.createdAt,
    crossMediaGroupId: group.identity.crossMediaGroupId,
    difficulty: null,
    dueAt: null,
    entryId: group.identity.entryId,
    entryType: group.identity.entryType,
    lapses: 0,
    lastInteractionAt:
      group.representativeCard.updatedAt ?? group.representativeCard.createdAt,
    lastReviewedAt: null,
    learningSteps: 0,
    manualOverride: false,
    reps: 0,
    scheduledDays: 0,
    schedulerVersion: "fsrs_v1",
    stability: null,
    state: "new",
    subjectKey: group.identity.subjectKey,
    subjectType: group.identity.subjectKind,
    suspended: group.representativeCard.status === "suspended",
    updatedAt: group.representativeCard.updatedAt
  };
}

function buildSynchronizedReviewSubjectState(
  group: ReviewSubjectCoverageSnapshot["subjectGroups"][number]
) {
  const currentState = group.subjectState ?? buildInitialReviewSubjectState(group);

  return {
    cardId: group.representativeCard.id,
    createdAt: currentState.createdAt,
    crossMediaGroupId: group.identity.crossMediaGroupId,
    difficulty: currentState.difficulty,
    dueAt: currentState.dueAt,
    entryId: group.identity.entryId,
    entryType: group.identity.entryType,
    lapses: currentState.lapses,
    lastInteractionAt: currentState.lastInteractionAt,
    lastReviewedAt: currentState.lastReviewedAt,
    learningSteps: currentState.learningSteps,
    manualOverride: currentState.manualOverride,
    reps: currentState.reps,
    scheduledDays: currentState.scheduledDays,
    schedulerVersion: currentState.schedulerVersion,
    stability: currentState.stability,
    state: currentState.state,
    subjectKey: group.identity.subjectKey,
    subjectType: group.identity.subjectKind,
    suspended: currentState.suspended,
    updatedAt: currentState.updatedAt
  };
}
