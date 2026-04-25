import { inArray, sql } from "drizzle-orm";

import type { DatabaseClient } from "../db/client.ts";
import { listReviewCardsByMediaIds } from "../db/queries/review.ts";
import { listReviewSubjectStatesByKeys } from "../db/queries/review-subject.ts";
import {
  reviewSubjectLog,
  reviewSubjectState
} from "../db/schema/review.ts";

import type { ReviewSubjectStateSnapshot } from "./review-subject.ts";
import {
  resolveReviewSubjectGroups,
  type ResolveReviewSubjectGroupsResult
} from "./review-subject-state-lookup.ts";
import { getDrivingEntryLinks } from "./review-model.ts";

export type ReviewSubjectStateBackfillResult = {
  cardCount: number;
  insertedCount: number;
  subjectCount: number;
};

type ReviewSubjectStateDatabase = Pick<
  DatabaseClient,
  "delete" | "insert" | "query" | "update"
>;

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

  const synchronizedStates = await buildSynchronizedReviewSubjectStates(
    database,
    snapshot.subjectGroups
  );

  await database
    .insert(reviewSubjectState)
    .values(synchronizedStates.map((entry) => entry.state))
    .onConflictDoUpdate({
      target: reviewSubjectState.subjectKey,
      set: {
        cardId: sql.raw("excluded.card_id"),
        createdAt: sql.raw("excluded.created_at"),
        crossMediaGroupId: sql.raw("excluded.cross_media_group_id"),
        difficulty: sql.raw("excluded.difficulty"),
        dueAt: sql.raw("excluded.due_at"),
        entryId: sql.raw("excluded.entry_id"),
        entryType: sql.raw("excluded.entry_type"),
        lapses: sql.raw("excluded.lapses"),
        lastInteractionAt: sql.raw("excluded.last_interaction_at"),
        lastReviewedAt: sql.raw("excluded.last_reviewed_at"),
        learningSteps: sql.raw("excluded.learning_steps"),
        manualOverride: sql.raw("excluded.manual_override"),
        reps: sql.raw("excluded.reps"),
        scheduledDays: sql.raw("excluded.scheduled_days"),
        schedulerVersion: sql.raw("excluded.scheduler_version"),
        stability: sql.raw("excluded.stability"),
        state: sql.raw("excluded.state"),
        subjectType: sql.raw("excluded.subject_type"),
        suspended: sql.raw("excluded.suspended"),
        updatedAt: sql.raw("excluded.updated_at")
      }
    });

  for (const entry of synchronizedStates) {
    if (entry.legacySubjectKeys.length === 0) {
      continue;
    }

    await database
      .update(reviewSubjectLog)
      .set({
        subjectKey: entry.state.subjectKey
      })
      .where(inArray(reviewSubjectLog.subjectKey, entry.legacySubjectKeys));

    await database
      .delete(reviewSubjectState)
      .where(inArray(reviewSubjectState.subjectKey, entry.legacySubjectKeys));
  }

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

async function buildSynchronizedReviewSubjectStates(
  database: ReviewSubjectStateDatabase,
  subjectGroups: ReviewSubjectCoverageSnapshot["subjectGroups"]
) {
  const currentStates = await database.query.reviewSubjectState.findMany();
  const candidateStatesBySubject = new Map<string, ReviewSubjectStateSnapshot[]>();

  for (const state of currentStates) {
    if (state.subjectType === "card") {
      continue;
    }

    const subjectKeys = findCandidateCanonicalSubjectKeys(state, subjectGroups);

    for (const subjectKey of subjectKeys) {
      const states = candidateStatesBySubject.get(subjectKey) ?? [];

      states.push(state);
      candidateStatesBySubject.set(subjectKey, states);
    }
  }

  return subjectGroups.map((group) => {
    const candidates = candidateStatesBySubject.get(group.identity.subjectKey);
    const currentState =
      selectBestReviewSubjectState(candidates) ??
      group.subjectState ??
      buildInitialReviewSubjectState(group);

    return {
      legacySubjectKeys: (candidates ?? [])
        .map((state) => state.subjectKey)
        .filter((subjectKey) => subjectKey !== group.identity.subjectKey),
      state: buildSynchronizedReviewSubjectState(group, currentState)
    };
  });
}

function buildSynchronizedReviewSubjectState(
  group: ReviewSubjectCoverageSnapshot["subjectGroups"][number],
  currentState: ReviewSubjectStateSnapshot
) {

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

function findCandidateCanonicalSubjectKeys(
  state: ReviewSubjectStateSnapshot,
  subjectGroups: ReviewSubjectCoverageSnapshot["subjectGroups"]
) {
  const subjectKeys: string[] = [];

  for (const group of subjectGroups) {
    if (
      state.subjectKey === group.identity.subjectKey ||
      isLegacyStateForSubjectGroup(state, group)
    ) {
      subjectKeys.push(group.identity.subjectKey);
    }
  }

  return subjectKeys;
}

function isLegacyStateForSubjectGroup(
  state: ReviewSubjectStateSnapshot,
  group: ReviewSubjectCoverageSnapshot["subjectGroups"][number]
) {
  if (
    !group.identity.entryType ||
    state.entryType !== group.identity.entryType ||
    state.subjectType === "card"
  ) {
    return false;
  }

  const entryIds = collectSubjectGroupEntryIds(group);

  return Boolean(state.entryId && entryIds.has(state.entryId));
}

function collectSubjectGroupEntryIds(
  group: ReviewSubjectCoverageSnapshot["subjectGroups"][number]
) {
  const entryIds = new Set<string>();

  for (const card of group.cards) {
    for (const link of getDrivingEntryLinks(card.entryLinks)) {
      if (link.entryType === group.identity.entryType) {
        entryIds.add(link.entryId);
      }
    }
  }

  if (group.identity.entryId) {
    entryIds.add(group.identity.entryId);
  }

  return entryIds;
}

function selectBestReviewSubjectState(
  states: ReviewSubjectStateSnapshot[] | undefined
) {
  if (!states || states.length === 0) {
    return null;
  }

  return [...states].sort(compareReviewSubjectStatesForMerge)[0] ?? null;
}

function compareReviewSubjectStatesForMerge(
  left: ReviewSubjectStateSnapshot,
  right: ReviewSubjectStateSnapshot
) {
  const leftRank = getReviewSubjectStateMergeRank(left);
  const rightRank = getReviewSubjectStateMergeRank(right);

  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  if (leftRank === 1) {
    const stabilityDifference =
      (right.stability ?? Number.NEGATIVE_INFINITY) -
      (left.stability ?? Number.NEGATIVE_INFINITY);

    if (stabilityDifference !== 0) {
      return stabilityDifference;
    }
  }

  if (left.lastInteractionAt !== right.lastInteractionAt) {
    return right.lastInteractionAt.localeCompare(left.lastInteractionAt);
  }

  if (left.reps !== right.reps) {
    return right.reps - left.reps;
  }

  return left.subjectKey.localeCompare(right.subjectKey);
}

function getReviewSubjectStateMergeRank(state: ReviewSubjectStateSnapshot) {
  if (
    state.manualOverride ||
    state.suspended ||
    state.state === "known_manual" ||
    state.state === "suspended"
  ) {
    return 0;
  }

  if (state.state === "review" || state.state === "relearning") {
    return 1;
  }

  if (state.state === "learning") {
    return 2;
  }

  return 3;
}
