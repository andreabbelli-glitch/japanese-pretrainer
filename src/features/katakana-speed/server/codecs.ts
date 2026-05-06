import { katakanaTrialModeValues } from "@/db/schema/enums";
import type { getKatakanaExerciseResultRow } from "@/db/queries";

import {
  buildKatakanaSpeedRanGridCellSnapshots,
  buildKatakanaSpeedRanGridMetrics
} from "../model/ran-grid-metrics";
import type {
  KatakanaSpeedErrorTag,
  KatakanaSpeedManualExercise,
  KatakanaSpeedSelfRating,
  KatakanaSpeedSessionMode,
  KatakanaSpeedTrialMode
} from "../types";

const katakanaTrialModeSet = new Set<string>(katakanaTrialModeValues);

type KatakanaRanGridTrialRow = {
  readonly featuresJson: string;
  readonly itemId: string;
};

export function hasSupportedKatakanaTrialMode(row: { readonly mode: string }) {
  return parseKatakanaSpeedTrialMode(row.mode) !== null;
}

export function hasSupportedKatakanaAttemptMode(row: {
  readonly mode: string;
}) {
  return parseKatakanaSpeedTrialMode(row.mode) !== null;
}

export function parseKatakanaSpeedTrialMode(
  mode: string
): KatakanaSpeedTrialMode | null {
  return katakanaTrialModeSet.has(mode)
    ? (mode as KatakanaSpeedTrialMode)
    : null;
}

export function assertKatakanaSpeedTrialMode(
  mode: string
): asserts mode is KatakanaSpeedTrialMode {
  if (!parseKatakanaSpeedTrialMode(mode)) {
    throw new Error("Unsupported Katakana Speed trial mode.");
  }
}

export function assertKatakanaSpeedSessionMode(
  mode: string
): asserts mode is KatakanaSpeedSessionMode {
  if (mode !== "daily" && mode !== "diagnostic_probe" && mode !== "repair") {
    throw new Error("Unsupported Katakana Speed session mode.");
  }
}

export function assertKatakanaSpeedManualExercise(
  manualExercise: string | undefined
): asserts manualExercise is KatakanaSpeedManualExercise | undefined {
  if (
    manualExercise === undefined ||
    manualExercise === "contrast" ||
    manualExercise === "ran_grid" ||
    manualExercise === "reading" ||
    manualExercise === "romaji_to_katakana"
  ) {
    return;
  }

  throw new Error("Unsupported Katakana Speed manual exercise.");
}

export function assertNeverKatakanaSpeedSessionMode(mode: never): never {
  throw new Error(`Unsupported Katakana Speed session mode: ${mode}`);
}

export function parseJsonArray<T>(value: string): T[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function parseJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed !== null &&
      !Array.isArray(parsed) &&
      typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function normalizeMetricsJson(value: unknown): string {
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return JSON.stringify(parsed);
    } catch {
      return "{}";
    }
  }

  if (value === undefined || value === null) {
    return "{}";
  }

  return JSON.stringify(value);
}

export function normalizeRanGridMetricsJson(
  value: unknown,
  trial: KatakanaRanGridTrialRow | null
): string {
  const raw = parseUnknownObject(value);
  const featureCells = buildRanGridCellsFromTrial(trial);
  const rawCellSurfaces = parseUnknownStringArray(raw.cellSurfaces);
  const rawCellItemIds = parseUnknownStringArray(raw.cellItemIds);
  const sourceSurfaces =
    featureCells.length > 0
      ? featureCells.map((cell) => cell.surface)
      : rawCellSurfaces;
  const sourceItemIds =
    featureCells.length > 0
      ? featureCells.map((cell) => cell.itemId)
      : rawCellItemIds;
  const totalItems = Math.max(
    0,
    Math.round(
      nullableNumber(raw.totalItems) ??
        nullableNumber(raw.cells) ??
        (sourceSurfaces.length > 0 ? sourceSurfaces.length : 25)
    )
  );
  const rows = Math.max(1, Math.round(nullableNumber(raw.rows) ?? 5));
  const columns = Math.max(1, Math.round(nullableNumber(raw.columns) ?? 5));
  const cells = buildKatakanaSpeedRanGridCellSnapshots({
    cells: Array.from({ length: totalItems }, (_, index) => ({
      itemId: sourceItemIds[index] ?? featureCells[index]?.itemId ?? "",
      surface: sourceSurfaces[index] ?? featureCells[index]?.surface ?? ""
    })),
    columns,
    totalItems
  });
  const wrongCellIndexes = parseWrongCellIndexes(
    raw.wrongCellIndexes ?? raw.errorCellIndexes,
    totalItems
  );
  const hasWrongCellIndexes = wrongCellIndexes !== null;
  const errors = hasWrongCellIndexes
    ? wrongCellIndexes.length
    : Math.max(
        0,
        Math.min(
          totalItems,
          Math.round(
            nullableNumber(raw.errors) ?? nullableNumber(raw.errorCount) ?? 0
          )
        )
      );
  const durationMs = Math.max(
    0,
    Math.round(
      nullableNumber(raw.durationMs) ?? nullableNumber(raw.responseMs) ?? 0
    )
  );
  const canonical = buildKatakanaSpeedRanGridMetrics({
    cells,
    columns,
    durationMs,
    errors,
    extraMetrics: raw,
    rows,
    wrongCellIndexes: hasWrongCellIndexes ? wrongCellIndexes : null
  });

  return JSON.stringify(canonical);
}

export function buildRanGridCellsFromTrial(
  trial: KatakanaRanGridTrialRow | null
) {
  if (!trial) {
    return [];
  }

  const features = parseJsonObject(trial.featuresJson);
  const surfaces = parseUnknownStringArray(features.gridSurfaces);
  const itemIds = parseUnknownStringArray(features.gridItemIds);
  if (surfaces.length === 0) {
    return [];
  }

  return surfaces.map((surface, index) => ({
    itemId: itemIds[index] ?? `${trial.itemId}-${index}`,
    surface
  }));
}

export function parseWrongCellIndexes(value: unknown, totalItems: number) {
  if (value === undefined || value === null) {
    return null;
  }
  if (!Array.isArray(value)) {
    throw new Error("Invalid Katakana Speed RAN wrong cell indexes.");
  }

  const indexes = value.map((entry) => {
    const index =
      typeof entry === "number"
        ? entry
        : typeof entry === "string" && entry.trim().length > 0
          ? Number(entry)
          : Number.NaN;
    if (!Number.isInteger(index) || index < 0 || index >= totalItems) {
      throw new Error("Invalid Katakana Speed RAN wrong cell index.");
    }
    return index;
  });

  return [...new Set(indexes)].sort((left, right) => left - right);
}

export function parseUnknownObject(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed !== null &&
        !Array.isArray(parsed) &&
        typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  return value !== null && !Array.isArray(value) && typeof value === "object"
    ? { ...(value as Record<string, unknown>) }
    : {};
}

export function parseUnknownStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function assertKatakanaSelfRating(
  selfRating: string
): asserts selfRating is KatakanaSpeedSelfRating {
  if (!["clean", "hesitated", "wrong"].includes(selfRating)) {
    throw new Error("Invalid Katakana Speed self rating.");
  }
}

export function parseKatakanaSelfRating(
  selfRating: string | null | undefined
): KatakanaSpeedSelfRating | null {
  if (!selfRating) {
    return null;
  }

  return ["clean", "hesitated", "wrong"].includes(selfRating)
    ? (selfRating as KatakanaSpeedSelfRating)
    : null;
}

export function normalizeSelfCheckMetrics(input: {
  readonly inputMetrics: unknown;
  readonly responseMs: number;
  readonly selfRating: KatakanaSpeedSelfRating;
  readonly targetRtMs: number;
  readonly trialMetrics: Readonly<Record<string, unknown>>;
}) {
  const inputMetrics = parseUnknownObject(input.inputMetrics);
  const moraCount =
    nullableNumber(inputMetrics.moraCount) ??
    nullableNumber(input.trialMetrics.moraCount) ??
    1;
  const msPerMora =
    nullableNumber(inputMetrics.msPerMora) ??
    Math.round(input.responseMs / Math.max(1, moraCount));
  const targetMsPerMora =
    nullableNumber(inputMetrics.targetMsPerMora) ??
    nullableNumber(input.trialMetrics.targetMsPerMora) ??
    Math.round(input.targetRtMs / Math.max(1, moraCount));
  const slowCorrect =
    input.selfRating === "hesitated" ||
    (input.selfRating !== "wrong" && msPerMora > targetMsPerMora);

  return {
    ...input.trialMetrics,
    ...inputMetrics,
    correctnessSource: "self_report",
    durationMs:
      nullableNumber(inputMetrics.durationMs) ?? Math.max(0, input.responseMs),
    moraCount,
    msPerMora,
    slowCorrect,
    targetMsPerMora
  };
}

export function exerciseFamilyForTrialMode(mode: string) {
  if (mode === "pseudoword_sprint") {
    return "timed_pseudoword_reading";
  }
  if (mode === "word_naming") {
    return "timed_word_reading";
  }
  if (mode === "sentence_sprint") {
    return "sentence_flow";
  }

  return "timed_word_reading";
}

export function selfRatingErrorTags(input: {
  readonly selfRating: KatakanaSpeedSelfRating;
  readonly slowCorrect: boolean;
}): KatakanaSpeedErrorTag[] {
  if (input.selfRating === "hesitated" || input.slowCorrect) {
    return ["slow_correct"];
  }
  if (input.selfRating === "wrong") {
    return ["unclassified_error"];
  }

  return [];
}

export function assertKatakanaExerciseResultIdentity(
  result: NonNullable<Awaited<ReturnType<typeof getKatakanaExerciseResultRow>>>,
  expected: {
    readonly blockId: string;
    readonly exerciseId: string;
    readonly sessionId: string;
  }
) {
  if (result.sessionId !== expected.sessionId) {
    throw new Error("Katakana Speed result belongs to another session.");
  }
  if (result.blockId !== expected.blockId) {
    throw new Error("Katakana Speed result block does not match.");
  }
  if (result.exerciseId !== expected.exerciseId) {
    throw new Error("Katakana Speed result exercise does not match.");
  }
}

export function percentile(values: readonly number[], percentileValue: number) {
  const sorted = values
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  if (sorted.length === 0) {
    return null;
  }

  if (percentileValue === 0.5 && sorted.length % 2 === 0) {
    const upperIndex = sorted.length / 2;
    const lower = sorted[upperIndex - 1] ?? null;
    const upper = sorted[upperIndex] ?? null;

    if (lower !== null && upper !== null) {
      return Math.round((lower + upper) / 2);
    }
  }

  const index = Math.ceil(sorted.length * percentileValue) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))] ?? null;
}

export function countValues(values: readonly string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

export function topKeys(counts: ReadonlyMap<string, number>, limit: number) {
  return [...counts.entries()]
    .sort(
      ([leftKey, leftCount], [rightKey, rightCount]) =>
        rightCount - leftCount || leftKey.localeCompare(rightKey)
    )
    .slice(0, limit)
    .map(([key]) => key);
}

export function nullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
