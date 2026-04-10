import { isKanjiClashKanjiCharacter } from "./utils.ts";

export type SimilarKanjiDatasetRules = {
  minimumMetricScore: number;
  rulesVersion: number;
};

export type SimilarKanjiDatasetEntry = {
  confidence: number;
  leftKanji: string;
  rightKanji: string;
  sources: {
    manualExclude: boolean;
    manualInclude: boolean;
    strokeEditDistance: number | null;
    whiteRabbit: boolean;
    yehAndLiRadical: number | null;
  };
};

export type SimilarKanjiDataset = {
  generatedAt: string;
  rules: SimilarKanjiDatasetRules;
  swaps: SimilarKanjiDatasetEntry[];
};

export type BuildSimilarKanjiDatasetInput = {
  generatedAt: string;
  manualExcludes?: ReadonlyArray<readonly [string, string]>;
  manualIncludes?: ReadonlyArray<readonly [string, string]>;
  minimumMetricScore: number;
  rulesVersion: number;
  strokeEditDistance?: ReadonlyArray<readonly [string, string, number]>;
  whiteRabbit?: ReadonlyArray<readonly [string, string]>;
  yehAndLiRadical?: ReadonlyArray<readonly [string, string, number]>;
};

type MutableSimilarKanjiDatasetEntry = SimilarKanjiDatasetEntry & {
  key: string;
};

export function buildSimilarKanjiDataset(
  input: BuildSimilarKanjiDatasetInput
): SimilarKanjiDataset {
  const entries = new Map<string, MutableSimilarKanjiDatasetEntry>();
  const metricThreshold = input.minimumMetricScore;

  for (const [leftKanji, rightKanji] of input.whiteRabbit ?? []) {
    const entry = getOrCreateSimilarKanjiDatasetEntry(
      entries,
      leftKanji,
      rightKanji
    );
    entry.sources.whiteRabbit = true;
  }

  for (const [leftKanji, rightKanji, score] of input.strokeEditDistance ?? []) {
    if (score < metricThreshold) {
      continue;
    }

    const entry = getOrCreateSimilarKanjiDatasetEntry(
      entries,
      leftKanji,
      rightKanji
    );
    entry.sources.strokeEditDistance = mergeSimilarKanjiMetricScore(
      entry.sources.strokeEditDistance,
      score
    );
  }

  for (const [leftKanji, rightKanji, score] of input.yehAndLiRadical ?? []) {
    if (score < metricThreshold) {
      continue;
    }

    const entry = getOrCreateSimilarKanjiDatasetEntry(
      entries,
      leftKanji,
      rightKanji
    );
    entry.sources.yehAndLiRadical = mergeSimilarKanjiMetricScore(
      entry.sources.yehAndLiRadical,
      score
    );
  }

  for (const [index, [leftKanji, rightKanji]] of (
    input.manualIncludes ?? []
  ).entries()) {
    validateManualOverridePair(
      "manualIncludes",
      index,
      leftKanji,
      rightKanji
    );
    const entry = getOrCreateSimilarKanjiDatasetEntry(
      entries,
      leftKanji,
      rightKanji
    );
    entry.sources.manualInclude = true;
  }

  for (const [index, [leftKanji, rightKanji]] of (
    input.manualExcludes ?? []
  ).entries()) {
    validateManualOverridePair(
      "manualExcludes",
      index,
      leftKanji,
      rightKanji
    );
    const entry = getOrCreateSimilarKanjiDatasetEntry(
      entries,
      leftKanji,
      rightKanji
    );
    entry.sources.manualExclude = true;
  }

  const swaps = [...entries.values()]
    .filter((entry) => shouldKeepSimilarKanjiDatasetEntry(entry))
    .map((entry) => ({
      confidence: computeSimilarKanjiDatasetConfidence(entry.sources),
      leftKanji: entry.leftKanji,
      rightKanji: entry.rightKanji,
      sources: {
        ...entry.sources
      }
    }))
    .sort((left, right) => {
      const leftKey = buildSimilarKanjiSwapKey(left.leftKanji, left.rightKanji);
      const rightKey = buildSimilarKanjiSwapKey(
        right.leftKanji,
        right.rightKanji
      );

      return leftKey.localeCompare(rightKey);
    });

  return {
    generatedAt: input.generatedAt,
    rules: {
      minimumMetricScore: input.minimumMetricScore,
      rulesVersion: input.rulesVersion
    },
    swaps
  };
}

export function buildSimilarKanjiSwapKey(
  leftKanji: string,
  rightKanji: string
) {
  return [leftKanji, rightKanji]
    .sort((left, right) => left.localeCompare(right))
    .join("::");
}

function getOrCreateSimilarKanjiDatasetEntry(
  entries: Map<string, MutableSimilarKanjiDatasetEntry>,
  rawLeftKanji: string,
  rawRightKanji: string
) {
  const [leftKanji, rightKanji] = [
    rawLeftKanji.trim(),
    rawRightKanji.trim()
  ].sort((left, right) => left.localeCompare(right));
  const key = buildSimilarKanjiSwapKey(leftKanji, rightKanji);
  const existing = entries.get(key);

  if (existing) {
    return existing;
  }

  const created: MutableSimilarKanjiDatasetEntry = {
    confidence: 0,
    key,
    leftKanji,
    rightKanji,
    sources: {
      manualExclude: false,
      manualInclude: false,
      strokeEditDistance: null,
      whiteRabbit: false,
      yehAndLiRadical: null
    }
  };

  entries.set(key, created);

  return created;
}

function validateManualOverridePair(
  listName: "manualIncludes" | "manualExcludes",
  index: number,
  rawLeftKanji: string,
  rawRightKanji: string
) {
  const leftKanji = rawLeftKanji.trim();
  const rightKanji = rawRightKanji.trim();

  if (
    [...leftKanji].length !== 1 ||
    [...rightKanji].length !== 1 ||
    !isKanjiClashKanjiCharacter(leftKanji) ||
    !isKanjiClashKanjiCharacter(rightKanji) ||
    leftKanji === rightKanji
  ) {
    throw new Error(
      `Invalid ${listName}[${index}]: expected single-kanji swap, got ${JSON.stringify(rawLeftKanji)} <-> ${JSON.stringify(rawRightKanji)}`
    );
  }
}

function mergeSimilarKanjiMetricScore(
  currentScore: number | null,
  nextScore: number
) {
  return currentScore === null ? nextScore : Math.max(currentScore, nextScore);
}

function shouldKeepSimilarKanjiDatasetEntry(
  entry: MutableSimilarKanjiDatasetEntry
) {
  if (entry.sources.manualExclude) {
    return false;
  }

  return (
    entry.sources.manualInclude ||
    entry.sources.whiteRabbit ||
    entry.sources.strokeEditDistance !== null ||
    entry.sources.yehAndLiRadical !== null
  );
}

function computeSimilarKanjiDatasetConfidence(
  sources: SimilarKanjiDatasetEntry["sources"]
) {
  if (sources.manualInclude) {
    return 1;
  }

  let confidence = 0;

  if (sources.whiteRabbit) {
    confidence += 0.5;
  }

  if (sources.strokeEditDistance !== null) {
    confidence += 0.25;
  }

  if (sources.yehAndLiRadical !== null) {
    confidence += 0.25;
  }

  return Math.min(1, confidence);
}
