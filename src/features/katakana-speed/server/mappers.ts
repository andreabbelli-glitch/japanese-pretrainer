import { getKatakanaSpeedItemById } from "../model/catalog";
import type { KatakanaSpeedErrorTag, KatakanaSpeedTrialPlan } from "../types";
import type {
  KatakanaSpeedAnalyticsAttempt,
  KatakanaSpeedAnalyticsConfusionEdge,
  KatakanaSpeedAnalyticsExerciseResult,
  KatakanaSpeedAnalyticsItemState
} from "../model/analytics";
import type {
  KatakanaSpeedAttemptSummary,
  KatakanaSpeedExerciseResultSummary,
  KatakanaSpeedFocusItem,
  KatakanaSpeedSessionSummary
} from "./contracts";
import {
  nullableNumber,
  parseJsonArray,
  parseJsonObject,
  parseKatakanaSelfRating,
  parseKatakanaSpeedTrialMode
} from "./codecs";
import type {
  getKatakanaSessionRow,
  listKatakanaAttemptLogsBySession,
  listKatakanaConfusionEdgeRowsBySession,
  listKatakanaExerciseResultRowsBySession,
  listKatakanaItemStateRows,
  listKatakanaTrialRowsBySession
} from "@/db/queries";

export type KatakanaSessionRow = NonNullable<
  Awaited<ReturnType<typeof getKatakanaSessionRow>>
>;
export type KatakanaTrialRow = Awaited<
  ReturnType<typeof listKatakanaTrialRowsBySession>
>[number];
export type KatakanaAttemptRow = Awaited<
  ReturnType<typeof listKatakanaAttemptLogsBySession>
>[number];
export type KatakanaExerciseResultRow = Awaited<
  ReturnType<typeof listKatakanaExerciseResultRowsBySession>
>[number];
export type KatakanaConfusionEdgeRow = Awaited<
  ReturnType<typeof listKatakanaConfusionEdgeRowsBySession>
>[number];
export type KatakanaItemStateRow = Awaited<
  ReturnType<typeof listKatakanaItemStateRows>
>[number];

export type KatakanaTrialSnapshot = {
  readonly blockId?: string;
  readonly exerciseId?: string;
  readonly expectedSurface: string;
  readonly features: Readonly<Record<string, unknown>>;
  readonly focusChunks: readonly string[];
  readonly itemType: string;
  readonly metrics: Readonly<Record<string, unknown>>;
  readonly wasPseudo: boolean;
  readonly wasRepair: boolean;
  readonly wasTransfer: boolean;
};

export type ExpandedKatakanaTrialPlan = KatakanaSpeedTrialPlan &
  Partial<KatakanaTrialSnapshot>;

export function snapshotKatakanaTrial(
  trial: KatakanaSpeedTrialPlan
): KatakanaTrialSnapshot {
  const expandedTrial = trial as ExpandedKatakanaTrialPlan;
  const item = getKatakanaSpeedItemById(trial.itemId);

  return {
    ...(expandedTrial.blockId ? { blockId: expandedTrial.blockId } : {}),
    ...(expandedTrial.exerciseId
      ? { exerciseId: expandedTrial.exerciseId }
      : {}),
    expectedSurface:
      expandedTrial.expectedSurface ?? item?.surface ?? trial.promptSurface,
    features:
      expandedTrial.features ??
      (item
        ? {
            family: item.family,
            kind: item.kind,
            moraCount: item.moraCount,
            rarity: item.rarity,
            tier: item.tier
          }
        : {}),
    focusChunks: expandedTrial.focusChunks ?? item?.focusChunks ?? [],
    itemType: expandedTrial.itemType ?? item?.kind ?? "unknown",
    metrics: expandedTrial.metrics ?? { targetRtMs: trial.targetRtMs },
    wasPseudo: expandedTrial.wasPseudo ?? Boolean(item?.kind === "pseudoword"),
    wasRepair: expandedTrial.wasRepair ?? false,
    wasTransfer: expandedTrial.wasTransfer ?? false
  };
}

export function snapshotKatakanaTrialRow(
  row: KatakanaTrialRow
): KatakanaTrialSnapshot {
  const item = getKatakanaSpeedItemById(row.itemId);

  return {
    ...(row.blockId ? { blockId: row.blockId } : {}),
    ...(row.exerciseId ? { exerciseId: row.exerciseId } : {}),
    expectedSurface: row.expectedSurface ?? item?.surface ?? row.promptSurface,
    features: parseJsonObject(row.featuresJson),
    focusChunks: parseJsonArray<string>(row.focusChunksJson),
    itemType: row.itemType ?? item?.kind ?? "unknown",
    metrics: parseJsonObject(row.metricsJson),
    wasPseudo: row.wasPseudo === 1,
    wasRepair: row.wasRepair === 1,
    wasTransfer: row.wasTransfer === 1
  };
}

export function mapKatakanaSpeedSessionSummary(
  session: KatakanaSessionRow
): KatakanaSpeedSessionSummary {
  return {
    correctAttempts: session.correctAttempts,
    durationMs: session.durationMs,
    endedAt: session.endedAt,
    medianRtMs: session.medianRtMs,
    p90RtMs: session.p90RtMs,
    recommendedFocus: buildFocusItems(
      parseJsonArray<string>(session.recommendedFocusJson)
    ),
    sessionId: session.id,
    slowCorrectCount: session.slowCorrectCount,
    startedAt: session.startedAt,
    status: session.status,
    totalAttempts: session.totalAttempts
  };
}

export function mapKatakanaTrialRow(
  row: KatakanaTrialRow
): KatakanaSpeedTrialPlan {
  const item = getKatakanaSpeedItemById(row.itemId);
  const mode = parseKatakanaSpeedTrialMode(row.mode);
  if (!mode) {
    throw new Error("Unsupported Katakana Speed trial mode.");
  }
  const optionItemIds = parseJsonArray<string>(row.optionItemIdsJson);
  const snapshot = snapshotKatakanaTrialRow(row);
  const selfRating = parseKatakanaSelfRating(row.selfRating);

  return {
    ...(snapshot.blockId ? { blockId: snapshot.blockId } : {}),
    ...(item?.confusionClusterIds[0]
      ? { confusionClusterId: item.confusionClusterIds[0] }
      : {}),
    correctItemId: row.correctItemId,
    ...(snapshot.exerciseId ? { exerciseId: snapshot.exerciseId } : {}),
    ...(row.exposureMs !== null ? { exposureMs: row.exposureMs } : {}),
    expectedSurface: snapshot.expectedSurface,
    features: snapshot.features,
    focusChunks: snapshot.focusChunks,
    itemId: row.itemId,
    itemType: snapshot.itemType,
    metrics: snapshot.metrics,
    mode,
    optionItemIds:
      optionItemIds.length > 0 ? optionItemIds : [row.correctItemId],
    promptSurface: row.promptSurface,
    rarity: item?.rarity,
    ...(selfRating ? { selfRating } : {}),
    sortOrder: row.sortOrder,
    targetRtMs: row.targetRtMs,
    trialId: row.trialId,
    wasPseudo: snapshot.wasPseudo,
    wasRepair: snapshot.wasRepair,
    wasTransfer: snapshot.wasTransfer
  };
}

export function mapKatakanaAttemptRow(
  attempt: KatakanaAttemptRow
): KatakanaSpeedAttemptSummary {
  const metrics = parseJsonObject(attempt.metricsJson);

  return {
    createdAt: attempt.createdAt,
    errorTags: parseJsonArray<KatakanaSpeedErrorTag>(attempt.errorTagsJson),
    expectedAnswer: attempt.expectedAnswer,
    expectedSurface: attempt.expectedSurface ?? attempt.expectedAnswer,
    features: parseJsonObject(attempt.featuresJson),
    focusChunks: parseJsonArray<string>(attempt.focusChunksJson),
    isCorrect: attempt.isCorrect === 1,
    itemId: attempt.itemId,
    itemType: attempt.itemType,
    metrics,
    mode: attempt.mode,
    promptSurface: attempt.promptSurface,
    responseMs: attempt.responseMs,
    selfRating: parseKatakanaSelfRating(attempt.selfRating),
    targetRtMs: nullableNumber(metrics.targetRtMs),
    userAnswer: attempt.userAnswer,
    wasPseudo: attempt.wasPseudo === 1,
    wasRepair: attempt.wasRepair === 1,
    wasTransfer: attempt.wasTransfer === 1
  };
}

export function mapKatakanaAnalyticsAttemptRow(
  attempt: KatakanaAttemptRow
): KatakanaSpeedAnalyticsAttempt {
  return mapKatakanaAttemptRow(attempt);
}

export function mapKatakanaExerciseResultRow(
  result: KatakanaExerciseResultRow
): KatakanaSpeedExerciseResultSummary {
  return {
    blockId: result.blockId,
    createdAt: result.createdAt,
    exerciseId: result.exerciseId,
    metrics: parseJsonObject(result.metricsJson),
    resultId: result.resultId,
    selfRating: parseKatakanaSelfRating(result.selfRating),
    sortOrder: result.sortOrder,
    trialId: result.trialId
  };
}

export function mapKatakanaAnalyticsExerciseResultRow(
  result: KatakanaExerciseResultRow
): KatakanaSpeedAnalyticsExerciseResult {
  return mapKatakanaExerciseResultRow(result);
}

export function mapKatakanaAnalyticsItemStateRow(
  row: KatakanaItemStateRow
): KatakanaSpeedAnalyticsItemState {
  return {
    bestRtMs: row.bestRtMs,
    correctCount: row.correctCount,
    itemId: row.itemId,
    lastResponseMs: row.lastResponseMs,
    recentResponseMs: parseJsonArray<number>(row.recentResponseMsJson).filter(
      (value) => Number.isFinite(value)
    ),
    reps: row.reps,
    slowCorrectCount: row.slowCorrectCount,
    status: row.status,
    wrongCount: row.wrongCount
  };
}

export function mapKatakanaConfusionEdgeRow(
  row: KatakanaConfusionEdgeRow
): KatakanaSpeedAnalyticsConfusionEdge {
  return {
    confusionCount: row.confusionCount,
    expectedItemId: row.expectedItemId,
    metrics: parseJsonObject(row.metricsJson),
    observedItemId: row.observedItemId
  };
}

export function buildFocusItems(
  itemIds: readonly string[]
): KatakanaSpeedFocusItem[] {
  return itemIds.flatMap((itemId) => {
    const item = getKatakanaSpeedItemById(itemId);
    if (!item) {
      return [];
    }

    return [
      {
        itemId: item.id,
        reason: item.rarity === "core" ? "Core drill" : "Edge case",
        surface: item.surface
      }
    ];
  });
}
