import { eq, inArray, sql } from "drizzle-orm";

import type { DatabaseClient } from "../../../db/client.ts";
import { listReviewCardsByMediaIds } from "../../../db/queries/review.ts";
import { listReviewSubjectStatesByKeys } from "../../../db/queries/review-subject.ts";
import {
  preReviewConsolidationState,
  reviewCanonicalControl,
  reviewMemoryAlias,
  reviewSubjectState,
  userSetting
} from "../../../db/schema/index.ts";

import { CURRENT_REVIEW_SCHEDULER_VERSION } from "../model/scheduler.ts";
import type {
  ReviewSubjectGroup,
  ReviewSubjectStateSnapshot
} from "../model/subject.ts";
import { REVIEW_MEMORY_KEY_VERSION } from "../model/recall-task.ts";
import {
  buildCanonicalTaskKey,
  buildReviewSubjectMigrationIndex,
  chunkArray,
  dedupeDesiredMemoryAliases,
  findStateTargetKeys,
  getEffectiveLegacyMemoryKey,
  isLegacyCanonicalSubjectKey,
  parseReviewMemoryKey,
  resolveAliasTarget,
  selectBestPreReviewConsolidationState,
  selectBestReviewSubjectState,
  type DesiredMemoryAlias,
  type PreReviewConsolidationStateRecord,
  type ReviewSubjectMigrationIndex,
  type ReviewSubjectStateRecord
} from "./subject-state-backfill-helpers.ts";
import {
  resolveReviewSubjectGroups,
  type ResolveReviewSubjectGroupsResult
} from "./subject-state-lookup.ts";

export type ReviewSubjectStateBackfillResult = {
  cardCount: number;
  insertedCount: number;
  subjectCount: number;
};

type ReviewSubjectStateDatabase = Pick<
  DatabaseClient,
  "delete" | "insert" | "query" | "update"
>;
type ReviewSubjectStateRootDatabase = ReviewSubjectStateDatabase &
  Pick<DatabaseClient, "transaction">;
type ReviewMemoryAliasRecord = typeof reviewMemoryAlias.$inferSelect;
type ReviewCanonicalControlRecord = typeof reviewCanonicalControl.$inferSelect;
type ReviewSubjectCoverageSnapshot = {
  cardCount: number;
  existingStateCount: number;
  missingStateCount: number;
  subjectCount: number;
  subjectGroups: ResolveReviewSubjectGroupsResult["subjectGroups"];
};
type SynchronizedReviewSubjectState = {
  sourceStates: ReviewSubjectStateRecord[];
  state: typeof reviewSubjectState.$inferInsert;
};

const REVIEW_SUBJECT_STATE_UPSERT_BATCH_SIZE = 40;
const REVIEW_MEMORY_KEY_MARKER = "review_memory_key_version";

export async function syncReviewSubjectState(
  database: ReviewSubjectStateDatabase,
  input: {
    now?: Date;
  } = {}
): Promise<ReviewSubjectStateBackfillResult> {
  const now = input.now ?? new Date();
  const snapshot = await loadReviewSubjectCoverageSnapshot(database, input);

  if (snapshot.subjectGroups.length === 0) {
    return {
      cardCount: snapshot.cardCount,
      insertedCount: 0,
      subjectCount: snapshot.subjectCount
    };
  }

  const migrationIndex = buildReviewSubjectMigrationIndex(
    snapshot.subjectGroups
  );
  const currentStates = await database.query.reviewSubjectState.findMany();
  await backfillReviewCanonicalControls(
    database,
    currentStates,
    migrationIndex
  );
  const canonicalControls = new Map(
    (await database.query.reviewCanonicalControl.findMany()).map((control) => [
      control.canonicalSubjectKey,
      control
    ])
  );
  const synchronizedStates = buildSynchronizedReviewSubjectStates(
    snapshot.subjectGroups,
    currentStates,
    migrationIndex,
    canonicalControls
  );

  for (const stateBatch of chunkArray(
    synchronizedStates.map((entry) => entry.state),
    REVIEW_SUBJECT_STATE_UPSERT_BATCH_SIZE
  )) {
    await database
      .insert(reviewSubjectState)
      .values(stateBatch)
      .onConflictDoUpdate({
        target: reviewSubjectState.subjectKey,
        set: {
          canonicalSubjectKey: sql.raw("excluded.canonical_subject_key"),
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
          recallTask: sql.raw("excluded.recall_task"),
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
  }

  const aliases = collectStateMemoryAliases(synchronizedStates, migrationIndex);
  aliases.push(
    ...(await migratePreReviewConsolidationStates(database, migrationIndex))
  );
  await upsertAndCompressMemoryAliases(database, aliases, now.toISOString());

  const legacyStateKeys = currentStates
    .filter((state) => {
      if (migrationIndex.targetKeys.has(state.subjectKey)) {
        return false;
      }

      return findStateTargetKeys(state, migrationIndex).length > 0;
    })
    .map((state) => state.subjectKey);

  for (const legacyKeyBatch of chunkArray(
    legacyStateKeys,
    REVIEW_SUBJECT_STATE_UPSERT_BATCH_SIZE
  )) {
    await database
      .delete(reviewSubjectState)
      .where(inArray(reviewSubjectState.subjectKey, legacyKeyBatch));
  }

  return {
    cardCount: snapshot.cardCount,
    insertedCount: snapshot.missingStateCount,
    subjectCount: snapshot.subjectCount
  };
}

export async function backfillReviewSubjectState(
  database: ReviewSubjectStateRootDatabase,
  input: {
    now?: Date;
  } = {}
): Promise<ReviewSubjectStateBackfillResult> {
  return database.transaction((transaction) =>
    syncReviewSubjectState(transaction, input)
  );
}

export async function backfillReviewMemoryKeysOnce(
  database: ReviewSubjectStateRootDatabase,
  input: { now?: Date } = {}
): Promise<ReviewSubjectStateBackfillResult | null> {
  return database.transaction(async (transaction) => {
    const marker = await transaction.query.userSetting.findFirst({
      where: eq(userSetting.key, REVIEW_MEMORY_KEY_MARKER)
    });

    if (marker?.valueJson === JSON.stringify(REVIEW_MEMORY_KEY_VERSION)) {
      return null;
    }

    const now = input.now ?? new Date();
    const result = await syncReviewSubjectState(transaction, { now });

    await transaction
      .insert(userSetting)
      .values({
        key: REVIEW_MEMORY_KEY_MARKER,
        updatedAt: now.toISOString(),
        valueJson: JSON.stringify(REVIEW_MEMORY_KEY_VERSION)
      })
      .onConflictDoUpdate({
        target: userSetting.key,
        set: {
          updatedAt: now.toISOString(),
          valueJson: JSON.stringify(REVIEW_MEMORY_KEY_VERSION)
        }
      });

    return result;
  });
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
    return emptyCoverageSnapshot();
  }

  const cards = await listReviewCardsByMediaIds(database, mediaIds);

  if (cards.length === 0) {
    return emptyCoverageSnapshot();
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

function emptyCoverageSnapshot(): ReviewSubjectCoverageSnapshot {
  return {
    cardCount: 0,
    existingStateCount: 0,
    missingStateCount: 0,
    subjectCount: 0,
    subjectGroups: []
  };
}

function buildInitialReviewSubjectState(
  group: ReviewSubjectGroup
): ReviewSubjectStateSnapshot {
  return {
    canonicalSubjectKey: group.identity.canonicalSubjectKey,
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
    recallTask: group.identity.recallTask,
    reps: 0,
    scheduledDays: 0,
    schedulerVersion: CURRENT_REVIEW_SCHEDULER_VERSION,
    stability: null,
    state: "new",
    subjectKey: group.identity.memoryKey,
    subjectType: group.identity.subjectKind,
    suspended: group.representativeCard.status === "suspended",
    updatedAt: group.representativeCard.updatedAt
  };
}

function buildSynchronizedReviewSubjectStates(
  subjectGroups: ReviewSubjectGroup[],
  currentStates: ReviewSubjectStateRecord[],
  migrationIndex: ReviewSubjectMigrationIndex,
  canonicalControls: ReadonlyMap<string, ReviewCanonicalControlRecord>
): SynchronizedReviewSubjectState[] {
  const candidateStatesByTarget = new Map<string, ReviewSubjectStateRecord[]>();

  for (const state of currentStates) {
    for (const targetKey of findStateTargetKeys(state, migrationIndex)) {
      const states = candidateStatesByTarget.get(targetKey) ?? [];

      states.push(state);
      candidateStatesByTarget.set(targetKey, states);
    }
  }

  return subjectGroups.map((group) => {
    const sourceStates = candidateStatesByTarget.get(group.identity.memoryKey);
    const hasExistingTargetState = Boolean(
      sourceStates?.length || group.subjectState
    );
    const currentState =
      selectBestReviewSubjectState(sourceStates) ??
      group.subjectState ??
      buildInitialReviewSubjectState(group);

    return {
      sourceStates: sourceStates ?? [],
      state: applyReviewCanonicalControl(
        buildSynchronizedReviewSubjectState(group, currentState),
        canonicalControls.get(group.identity.canonicalSubjectKey),
        hasExistingTargetState
      )
    };
  });
}

async function backfillReviewCanonicalControls(
  database: ReviewSubjectStateDatabase,
  currentStates: ReviewSubjectStateRecord[],
  index: ReviewSubjectMigrationIndex
) {
  const existingControls =
    await database.query.reviewCanonicalControl.findMany();
  const originalByCanonical = new Map(
    existingControls.map((control) => [control.canonicalSubjectKey, control])
  );
  const controlsByCanonical = new Map(originalByCanonical);
  const targetCanonicalsBySource = new Map<string, Set<string>>();

  for (const state of currentStates) {
    const targetKey = findStateTargetKeys(state, index)[0];
    const ownerGroup = targetKey
      ? index.groupByTargetKey.get(targetKey)
      : undefined;

    if (!ownerGroup) {
      continue;
    }

    const parsedMemory = parseReviewMemoryKey(state.subjectKey);
    const sourceCanonicalSubjectKey =
      state.canonicalSubjectKey ??
      parsedMemory?.canonicalSubjectKey ??
      (isLegacyCanonicalSubjectKey(state.subjectKey)
        ? state.subjectKey
        : ownerGroup.identity.canonicalSubjectKey);
    const targetCanonicalSubjectKey = ownerGroup.identity.canonicalSubjectKey;

    if (sourceCanonicalSubjectKey !== targetCanonicalSubjectKey) {
      const targets =
        targetCanonicalsBySource.get(sourceCanonicalSubjectKey) ??
        new Set<string>();

      targets.add(targetCanonicalSubjectKey);
      targetCanonicalsBySource.set(sourceCanonicalSubjectKey, targets);
    }

    if (parsedMemory) {
      continue;
    }

    const status =
      state.manualOverride || state.state === "known_manual"
        ? "known_manual"
        : isLegacyCanonicalIgnoredState(state, ownerGroup)
          ? "ignored"
          : null;

    if (!status) {
      continue;
    }

    mergeCanonicalControl(controlsByCanonical, {
      canonicalSubjectKey: sourceCanonicalSubjectKey,
      createdAt: state.updatedAt,
      status,
      updatedAt: state.updatedAt
    });
  }

  let propagated = true;

  while (propagated) {
    propagated = false;

    for (const [
      sourceCanonicalSubjectKey,
      targets
    ] of targetCanonicalsBySource) {
      const sourceControl = controlsByCanonical.get(sourceCanonicalSubjectKey);

      if (!sourceControl) {
        continue;
      }

      for (const targetCanonicalSubjectKey of targets) {
        propagated =
          mergeCanonicalControl(controlsByCanonical, {
            ...sourceControl,
            canonicalSubjectKey: targetCanonicalSubjectKey
          }) || propagated;
      }
    }
  }

  const controls = [...controlsByCanonical.values()].filter((control) => {
    const original = originalByCanonical.get(control.canonicalSubjectKey);

    return (
      !original ||
      original.status !== control.status ||
      original.updatedAt !== control.updatedAt
    );
  });

  for (const batch of chunkArray(
    controls,
    REVIEW_SUBJECT_STATE_UPSERT_BATCH_SIZE
  )) {
    await database
      .insert(reviewCanonicalControl)
      .values(batch)
      .onConflictDoUpdate({
        target: reviewCanonicalControl.canonicalSubjectKey,
        set: {
          status: sql.raw("excluded.status"),
          updatedAt: sql.raw("excluded.updated_at")
        }
      });
  }
}

function mergeCanonicalControl(
  controls: Map<string, ReviewCanonicalControlRecord>,
  candidate: ReviewCanonicalControlRecord
) {
  const existing = controls.get(candidate.canonicalSubjectKey);

  if (existing && existing.updatedAt >= candidate.updatedAt) {
    return false;
  }

  controls.set(candidate.canonicalSubjectKey, candidate);
  return true;
}

function isLegacyCanonicalIgnoredState(
  state: ReviewSubjectStateRecord,
  ownerGroup: ReviewSubjectGroup
) {
  return (
    (state.suspended || state.state === "suspended") &&
    ownerGroup.cards.some((candidate) => candidate.status !== "suspended")
  );
}

function applyReviewCanonicalControl(
  state: typeof reviewSubjectState.$inferInsert,
  control: ReviewCanonicalControlRecord | undefined,
  hasExistingTargetState: boolean
): typeof reviewSubjectState.$inferInsert {
  if (!control) {
    return state;
  }

  if (
    hasExistingTargetState &&
    new Date(state.updatedAt).getTime() > new Date(control.updatedAt).getTime()
  ) {
    return state;
  }

  if (control.status === "known_manual") {
    return {
      ...state,
      manualOverride: true,
      suspended: false
    };
  }

  if (control.status === "ignored") {
    return {
      ...state,
      manualOverride: false,
      suspended: true
    };
  }

  return {
    ...state,
    manualOverride: false,
    state: state.state === "known_manual" ? "learning" : state.state,
    suspended: false
  };
}

function buildSynchronizedReviewSubjectState(
  group: ReviewSubjectGroup,
  currentState: ReviewSubjectStateSnapshot
): typeof reviewSubjectState.$inferInsert {
  const pinnedCardId = group.cards.some(
    (candidate) => candidate.id === currentState.cardId
  )
    ? currentState.cardId
    : group.representativeCard.id;

  return {
    canonicalSubjectKey: group.identity.canonicalSubjectKey,
    cardId: pinnedCardId,
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
    recallTask: group.identity.recallTask,
    reps: currentState.reps,
    scheduledDays: currentState.scheduledDays,
    schedulerVersion: currentState.schedulerVersion,
    stability: currentState.stability,
    state: currentState.state,
    subjectKey: group.identity.memoryKey,
    subjectType: group.identity.subjectKind,
    suspended: currentState.suspended,
    updatedAt: currentState.updatedAt
  };
}

function collectStateMemoryAliases(
  synchronizedStates: SynchronizedReviewSubjectState[],
  index: ReviewSubjectMigrationIndex
) {
  const aliases: DesiredMemoryAlias[] = [];

  for (const entry of synchronizedStates) {
    for (const sourceState of entry.sourceStates) {
      const ownerTargetKey = sourceState.cardId
        ? index.targetKeyByCardId.get(sourceState.cardId)
        : undefined;

      if (!ownerTargetKey || entry.state.subjectKey !== ownerTargetKey) {
        continue;
      }

      const ownerGroup = index.groupByTargetKey.get(ownerTargetKey);

      if (!ownerGroup) {
        continue;
      }

      const aliasMemoryKey = getEffectiveLegacyMemoryKey(
        sourceState,
        ownerGroup
      );

      if (aliasMemoryKey !== ownerTargetKey) {
        aliases.push({
          aliasMemoryKey,
          currentMemoryKey: ownerTargetKey
        });
      }
    }
  }

  return dedupeDesiredMemoryAliases(aliases);
}

async function migratePreReviewConsolidationStates(
  database: ReviewSubjectStateDatabase,
  index: ReviewSubjectMigrationIndex
) {
  const rows = await database.query.preReviewConsolidationState.findMany();
  const rowsByTarget = new Map<string, PreReviewConsolidationStateRecord[]>();
  const sourceTargetPairs: Array<{
    row: PreReviewConsolidationStateRecord;
    targetKey: string;
  }> = [];

  for (const row of rows) {
    const targetKey = findConsolidationTargetKey(row, index);

    if (!targetKey) {
      continue;
    }

    const targetRows = rowsByTarget.get(targetKey) ?? [];

    targetRows.push(row);
    rowsByTarget.set(targetKey, targetRows);
    sourceTargetPairs.push({ row, targetKey });
  }

  const migratedRows: Array<typeof preReviewConsolidationState.$inferInsert> =
    [];

  for (const [targetKey, targetRows] of rowsByTarget) {
    const group = index.groupByTargetKey.get(targetKey);
    const rowToKeep = selectBestPreReviewConsolidationState(targetRows);

    if (!group || !rowToKeep) {
      continue;
    }

    const representativeCardId = group.cards.some(
      (candidate) => candidate.id === rowToKeep.representativeCardId
    )
      ? rowToKeep.representativeCardId
      : group.representativeCard.id;

    migratedRows.push({
      attemptCount: rowToKeep.attemptCount,
      canonicalSubjectKey: group.identity.canonicalSubjectKey,
      completedAt: rowToKeep.completedAt,
      createdAt: rowToKeep.createdAt,
      crossMediaGroupId: group.identity.crossMediaGroupId,
      entryId: group.identity.entryId,
      entryType: group.identity.entryType,
      lastAttemptAt: rowToKeep.lastAttemptAt,
      lessonId: rowToKeep.lessonId,
      mediaId: rowToKeep.mediaId,
      readingPassedAt: rowToKeep.readingPassedAt,
      recallTask: group.identity.recallTask,
      representativeCardId,
      status: rowToKeep.status,
      subjectKey: targetKey,
      subjectType: group.identity.subjectKind,
      updatedAt: rowToKeep.updatedAt
    });
  }

  for (const stateBatch of chunkArray(
    migratedRows,
    REVIEW_SUBJECT_STATE_UPSERT_BATCH_SIZE
  )) {
    await database
      .insert(preReviewConsolidationState)
      .values(stateBatch)
      .onConflictDoUpdate({
        target: preReviewConsolidationState.subjectKey,
        set: {
          attemptCount: sql.raw("excluded.attempt_count"),
          canonicalSubjectKey: sql.raw("excluded.canonical_subject_key"),
          completedAt: sql.raw("excluded.completed_at"),
          createdAt: sql.raw("excluded.created_at"),
          crossMediaGroupId: sql.raw("excluded.cross_media_group_id"),
          entryId: sql.raw("excluded.entry_id"),
          entryType: sql.raw("excluded.entry_type"),
          lastAttemptAt: sql.raw("excluded.last_attempt_at"),
          lessonId: sql.raw("excluded.lesson_id"),
          mediaId: sql.raw("excluded.media_id"),
          readingPassedAt: sql.raw("excluded.reading_passed_at"),
          recallTask: sql.raw("excluded.recall_task"),
          representativeCardId: sql.raw("excluded.representative_card_id"),
          status: sql.raw("excluded.status"),
          subjectType: sql.raw("excluded.subject_type"),
          updatedAt: sql.raw("excluded.updated_at")
        }
      });
  }

  const legacyKeys = sourceTargetPairs
    .filter(({ row, targetKey }) => row.subjectKey !== targetKey)
    .map(({ row }) => row.subjectKey);

  for (const legacyKeyBatch of chunkArray(
    legacyKeys,
    REVIEW_SUBJECT_STATE_UPSERT_BATCH_SIZE
  )) {
    await database
      .delete(preReviewConsolidationState)
      .where(inArray(preReviewConsolidationState.subjectKey, legacyKeyBatch));
  }

  return dedupeDesiredMemoryAliases(
    sourceTargetPairs.flatMap(({ row, targetKey }) => {
      const group = index.groupByTargetKey.get(targetKey);

      if (!group) {
        return [];
      }

      const aliasMemoryKey = getEffectiveLegacyMemoryKey(row, group);

      return aliasMemoryKey === targetKey
        ? []
        : [{ aliasMemoryKey, currentMemoryKey: targetKey }];
    })
  );
}

function findConsolidationTargetKey(
  row: PreReviewConsolidationStateRecord,
  index: ReviewSubjectMigrationIndex
) {
  const representativeTarget = index.targetKeyByCardId.get(
    row.representativeCardId
  );

  if (representativeTarget) {
    return representativeTarget;
  }

  if (index.targetKeys.has(row.subjectKey)) {
    return row.subjectKey;
  }

  const parsedMemory = parseReviewMemoryKey(row.subjectKey);
  const canonicalSubjectKey =
    row.canonicalSubjectKey ?? parsedMemory?.canonicalSubjectKey;
  const recallTask = row.recallTask ?? parsedMemory?.recallTask;

  if (!canonicalSubjectKey || !recallTask) {
    return null;
  }

  const targets = index.targetKeysByCanonicalTask.get(
    buildCanonicalTaskKey(canonicalSubjectKey, recallTask)
  );

  return targets?.values().next().value ?? null;
}

async function upsertAndCompressMemoryAliases(
  database: ReviewSubjectStateDatabase,
  desiredAliases: DesiredMemoryAlias[],
  migratedAt: string
) {
  const existingAliases = await database.query.reviewMemoryAlias.findMany();
  const desiredByAlias = new Map(
    desiredAliases.map((alias) => [alias.aliasMemoryKey, alias])
  );
  const targets = new Map(
    existingAliases.map((alias) => [
      alias.aliasMemoryKey,
      alias.currentMemoryKey
    ])
  );

  for (const alias of desiredAliases) {
    targets.set(alias.aliasMemoryKey, alias.currentMemoryKey);
  }

  const compressedRows: ReviewMemoryAliasRecord[] = [];

  for (const [aliasMemoryKey] of targets) {
    const currentMemoryKey = resolveAliasTarget(aliasMemoryKey, targets);

    if (currentMemoryKey === aliasMemoryKey) {
      continue;
    }

    const existing = existingAliases.find(
      (candidate) => candidate.aliasMemoryKey === aliasMemoryKey
    );
    const desired = desiredByAlias.get(aliasMemoryKey);

    compressedRows.push({
      aliasMemoryKey,
      currentMemoryKey,
      migratedAt: desired ? migratedAt : (existing?.migratedAt ?? migratedAt),
      reason: desired ? "canonical_rekey" : (existing?.reason ?? "compressed")
    });
  }

  for (const aliasBatch of chunkArray(
    compressedRows,
    REVIEW_SUBJECT_STATE_UPSERT_BATCH_SIZE
  )) {
    await database
      .insert(reviewMemoryAlias)
      .values(aliasBatch)
      .onConflictDoUpdate({
        target: reviewMemoryAlias.aliasMemoryKey,
        set: {
          currentMemoryKey: sql.raw("excluded.current_memory_key"),
          migratedAt: sql.raw("excluded.migrated_at"),
          reason: sql.raw("excluded.reason")
        }
      });
  }
}
