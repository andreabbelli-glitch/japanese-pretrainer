import {
  preReviewConsolidationState,
  reviewSubjectState
} from "../../../db/schema/index.ts";

import type { ReviewRecallTask } from "../../../domain/review.ts";
import { pickBestBy } from "../../shared/model/collections.ts";
import type {
  ReviewSubjectGroup,
  ReviewSubjectStateSnapshot
} from "../model/subject.ts";
import {
  buildReviewMemoryKey,
  REVIEW_MEMORY_KEY_VERSION
} from "../model/recall-task.ts";
import { getDrivingEntryLinks } from "../model/state.ts";

export type ReviewSubjectStateRecord = typeof reviewSubjectState.$inferSelect;
export type PreReviewConsolidationStateRecord =
  typeof preReviewConsolidationState.$inferSelect;
export type ReviewSubjectMigrationIndex = {
  groupByTargetKey: Map<string, ReviewSubjectGroup>;
  targetKeyByCardId: Map<string, string>;
  targetKeys: Set<string>;
  targetKeysByCanonical: Map<string, Set<string>>;
  targetKeysByCanonicalTask: Map<string, Set<string>>;
  targetKeysByEntryKey: Map<string, Set<string>>;
  targetKeysByLegacyCardKey: Map<string, Set<string>>;
};
export type DesiredMemoryAlias = {
  aliasMemoryKey: string;
  currentMemoryKey: string;
};

export function findStateTargetKeys(
  state: ReviewSubjectStateRecord,
  index: ReviewSubjectMigrationIndex
) {
  const ownerTargetKey = state.cardId
    ? index.targetKeyByCardId.get(state.cardId)
    : undefined;

  if (index.targetKeys.has(state.subjectKey)) {
    return [state.subjectKey];
  }

  const legacyCardTargets = index.targetKeysByLegacyCardKey.get(
    state.subjectKey
  );

  if (legacyCardTargets?.size) {
    return [selectDeterministicLegacyOwnerTarget(legacyCardTargets, index)];
  }

  if (ownerTargetKey) {
    return [ownerTargetKey];
  }

  const parsedMemory = parseReviewMemoryKey(state.subjectKey);
  const canonicalSubjectKey =
    state.canonicalSubjectKey ?? parsedMemory?.canonicalSubjectKey;
  const recallTask = state.recallTask ?? parsedMemory?.recallTask;

  if (canonicalSubjectKey && recallTask) {
    const targets = index.targetKeysByCanonicalTask.get(
      buildCanonicalTaskKey(canonicalSubjectKey, recallTask)
    );

    if (targets?.size) {
      return [...targets];
    }
  }

  if (canonicalSubjectKey) {
    const targets = index.targetKeysByCanonical.get(canonicalSubjectKey);

    if (targets?.size) {
      return [selectDeterministicLegacyOwnerTarget(targets, index)];
    }
  }

  if (state.entryType && state.entryId) {
    const targets = index.targetKeysByEntryKey.get(
      buildReviewSubjectEntryKey(state.entryType, state.entryId)
    );

    if (targets?.size) {
      return [selectDeterministicLegacyOwnerTarget(targets, index)];
    }
  }

  return [];
}

function selectDeterministicLegacyOwnerTarget(
  targets: ReadonlySet<string>,
  index: ReviewSubjectMigrationIndex
) {
  return [...targets].sort((left, right) => {
    const leftTask = index.groupByTargetKey.get(left)?.identity.recallTask;
    const rightTask = index.groupByTargetKey.get(right)?.identity.recallTask;
    const taskDifference =
      getLegacyOwnerTaskRank(leftTask) - getLegacyOwnerTaskRank(rightTask);

    return taskDifference !== 0 ? taskDifference : left.localeCompare(right);
  })[0]!;
}

function getLegacyOwnerTaskRank(task: ReviewRecallTask | undefined) {
  if (task === "recognition") {
    return 0;
  }

  if (task === "concept") {
    return 1;
  }

  return 2;
}

export function buildReviewSubjectMigrationIndex(
  subjectGroups: ReviewSubjectGroup[]
): ReviewSubjectMigrationIndex {
  const index: ReviewSubjectMigrationIndex = {
    groupByTargetKey: new Map<string, ReviewSubjectGroup>(),
    targetKeyByCardId: new Map<string, string>(),
    targetKeys: new Set<string>(),
    targetKeysByCanonical: new Map<string, Set<string>>(),
    targetKeysByCanonicalTask: new Map<string, Set<string>>(),
    targetKeysByEntryKey: new Map<string, Set<string>>(),
    targetKeysByLegacyCardKey: new Map<string, Set<string>>()
  };

  for (const group of subjectGroups) {
    const targetKey = group.identity.memoryKey;

    index.groupByTargetKey.set(targetKey, group);
    index.targetKeys.add(targetKey);
    addTargetKeyToIndex(
      index.targetKeysByCanonical,
      group.identity.canonicalSubjectKey,
      targetKey
    );
    addTargetKeyToIndex(
      index.targetKeysByCanonicalTask,
      buildCanonicalTaskKey(
        group.identity.canonicalSubjectKey,
        group.identity.recallTask
      ),
      targetKey
    );

    for (const card of group.cards) {
      index.targetKeyByCardId.set(card.id, targetKey);
      addTargetKeyToIndex(
        index.targetKeysByLegacyCardKey,
        `card:${card.id}`,
        targetKey
      );
    }

    if (group.identity.entryType) {
      for (const entryId of collectSubjectGroupEntryIds(group)) {
        addTargetKeyToIndex(
          index.targetKeysByEntryKey,
          buildReviewSubjectEntryKey(group.identity.entryType, entryId),
          targetKey
        );
      }
    }
  }

  return index;
}

function addTargetKeyToIndex(
  index: Map<string, Set<string>>,
  lookupKey: string,
  targetKey: string
) {
  const targetKeys = index.get(lookupKey) ?? new Set<string>();

  targetKeys.add(targetKey);
  index.set(lookupKey, targetKeys);
}

function buildReviewSubjectEntryKey(entryType: string, entryId: string) {
  return `${entryType}:${entryId}`;
}

export function buildCanonicalTaskKey(
  canonicalSubjectKey: string,
  recallTask: ReviewRecallTask
) {
  return `${recallTask}\u0000${canonicalSubjectKey}`;
}

export function getEffectiveLegacyMemoryKey(
  source: {
    canonicalSubjectKey: string | null;
    cardId?: string | null;
    recallTask: ReviewRecallTask | null;
    representativeCardId?: string;
    subjectKey: string;
  },
  ownerGroup: ReviewSubjectGroup
) {
  const parsedMemory = parseReviewMemoryKey(source.subjectKey);

  if (parsedMemory) {
    return source.subjectKey;
  }

  const canonicalSubjectKey =
    source.canonicalSubjectKey ??
    (isLegacyCanonicalSubjectKey(source.subjectKey)
      ? source.subjectKey
      : ownerGroup.identity.canonicalSubjectKey);
  const recallTask = source.recallTask ?? ownerGroup.identity.recallTask;

  return buildReviewMemoryKey({
    canonicalSubjectKey,
    cardId:
      source.cardId ??
      source.representativeCardId ??
      ownerGroup.identity.cardId ??
      ownerGroup.representativeCard.id,
    recallTask
  });
}

export function resolveAliasTarget(
  aliasMemoryKey: string,
  targets: ReadonlyMap<string, string>
) {
  const visited = new Set<string>([aliasMemoryKey]);
  let current = targets.get(aliasMemoryKey) ?? aliasMemoryKey;

  while (targets.has(current) && !visited.has(current)) {
    visited.add(current);
    current = targets.get(current) ?? current;
  }

  return current;
}

export function dedupeDesiredMemoryAliases(aliases: DesiredMemoryAlias[]) {
  return [
    ...new Map(
      aliases.map((alias) => [alias.aliasMemoryKey, alias] as const)
    ).values()
  ];
}

export function parseReviewMemoryKey(subjectKey: string): {
  canonicalSubjectKey: string;
  recallTask: ReviewRecallTask;
} | null {
  const prefix = `${REVIEW_MEMORY_KEY_VERSION}:`;

  if (!subjectKey.startsWith(prefix)) {
    return null;
  }

  const remainder = subjectKey.slice(prefix.length);
  const separatorIndex = remainder.indexOf(":");

  if (separatorIndex < 0) {
    return null;
  }

  const recallTask = remainder.slice(0, separatorIndex);

  if (
    recallTask !== "recognition" &&
    recallTask !== "concept" &&
    recallTask !== "other"
  ) {
    return null;
  }

  return {
    canonicalSubjectKey: remainder.slice(separatorIndex + 1),
    recallTask
  };
}

export function isLegacyCanonicalSubjectKey(subjectKey: string) {
  return (
    subjectKey.startsWith("group:") ||
    subjectKey.startsWith("entry:") ||
    subjectKey.startsWith("card:")
  );
}

export function selectBestPreReviewConsolidationState(
  states: PreReviewConsolidationStateRecord[]
) {
  return pickBestBy(states, comparePreReviewConsolidationStatesForMerge);
}

function comparePreReviewConsolidationStatesForMerge(
  left: PreReviewConsolidationStateRecord,
  right: PreReviewConsolidationStateRecord
) {
  const leftRank = getPreReviewConsolidationStateMergeRank(left.status);
  const rightRank = getPreReviewConsolidationStateMergeRank(right.status);

  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  if (left.updatedAt !== right.updatedAt) {
    return right.updatedAt.localeCompare(left.updatedAt);
  }

  if (left.createdAt !== right.createdAt) {
    return right.createdAt.localeCompare(left.createdAt);
  }

  return left.subjectKey.localeCompare(right.subjectKey);
}

function getPreReviewConsolidationStateMergeRank(status: string) {
  if (status === "pending") {
    return 0;
  }

  if (status === "retraining") {
    return 1;
  }

  return 2;
}

function collectSubjectGroupEntryIds(group: ReviewSubjectGroup) {
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

export function selectBestReviewSubjectState(
  states: ReviewSubjectStateSnapshot[] | undefined
) {
  if (!states || states.length === 0) {
    return null;
  }

  return pickBestBy(states, compareReviewSubjectStatesForMerge);
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

export function chunkArray<T>(values: T[], chunkSize: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }

  return chunks;
}
