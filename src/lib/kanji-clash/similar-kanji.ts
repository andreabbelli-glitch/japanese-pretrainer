import type { KanjiClashSimilarKanjiSwap } from "./types.ts";
import similarKanjiDatasetJson from "./similar-kanji-dataset.generated.json";
import type {
  SimilarKanjiDataset,
  SimilarKanjiDatasetEntry
} from "./similar-kanji-dataset-builder.ts";

const similarKanjiDataset = freezeSimilarKanjiDataset(
  similarKanjiDatasetJson as SimilarKanjiDataset
);

const similarKanjiSwapByKey = new Map(
  similarKanjiDataset.swaps.map((entry) => [
    buildSimilarKanjiSwapLookupKey(entry.leftKanji, entry.rightKanji),
    entry
  ])
);

const similarKanjiTargetsByKanji = buildSimilarKanjiTargetsByKanji(
  similarKanjiDataset.swaps
);

export function getKanjiClashSimilarKanjiDataset() {
  return similarKanjiDataset;
}

export function findKanjiClashSimilarKanjiEntry(
  leftKanji: string,
  rightKanji: string
) {
  return (
    similarKanjiSwapByKey.get(
      buildSimilarKanjiSwapLookupKey(leftKanji, rightKanji)
    ) ?? null
  );
}

export function listKanjiClashSimilarKanjiTargets(kanji: string) {
  return [...(similarKanjiTargetsByKanji.get(kanji) ?? [])];
}

export function buildKanjiClashSimilarKanjiSwap(
  leftKanji: string,
  rightKanji: string,
  position: number
): KanjiClashSimilarKanjiSwap | null {
  const entry = findKanjiClashSimilarKanjiEntry(leftKanji, rightKanji);

  if (!entry) {
    return null;
  }

  return {
    confidence: entry.confidence,
    leftKanji,
    position,
    rightKanji
  };
}

function buildSimilarKanjiTargetsByKanji(entries: SimilarKanjiDatasetEntry[]) {
  const targetsByKanji = new Map<string, Set<string>>();

  for (const entry of entries) {
    registerSimilarKanjiTarget(
      targetsByKanji,
      entry.leftKanji,
      entry.rightKanji
    );
    registerSimilarKanjiTarget(
      targetsByKanji,
      entry.rightKanji,
      entry.leftKanji
    );
  }

  return targetsByKanji;
}

function registerSimilarKanjiTarget(
  targetsByKanji: Map<string, Set<string>>,
  pivot: string,
  target: string
) {
  const existing = targetsByKanji.get(pivot);

  if (existing) {
    existing.add(target);
    return;
  }

  targetsByKanji.set(pivot, new Set([target]));
}

function buildSimilarKanjiSwapLookupKey(leftKanji: string, rightKanji: string) {
  return [leftKanji, rightKanji]
    .sort((left, right) => left.localeCompare(right))
    .join("::");
}

function freezeSimilarKanjiDataset<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  for (const childValue of Object.values(value as Record<string, unknown>)) {
    freezeSimilarKanjiDataset(childValue);
  }

  return Object.freeze(value);
}
