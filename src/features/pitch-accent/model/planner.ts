import type {
  PitchAccentMinimalPairsCorpus,
  PitchAccentPatternFilter,
  PitchAccentSessionTrialPlan
} from "../types.ts";
import {
  filterPitchAccentMinimalPairs,
  getPitchAccentPatternKey
} from "./corpus.ts";

export function planPitchAccentSessionTrials(input: {
  readonly corpus: PitchAccentMinimalPairsCorpus;
  readonly count: number;
  readonly filters?: Partial<PitchAccentPatternFilter>;
  readonly seed: string;
  readonly sessionId: string;
}): readonly PitchAccentSessionTrialPlan[] {
  const requestedCount = Math.max(1, Math.floor(input.count));
  const random = createSeededRandom(input.seed);
  const eligiblePairs = selectSessionPairs(
    filterPitchAccentMinimalPairs(input.corpus, input.filters),
    requestedCount,
    random
  );

  return eligiblePairs.map((pair, sortOrder) => {
    const correctOption =
      pair.options[Math.floor(random() * pair.options.length)] ??
      pair.options[0]!;

    return {
      correctOptionId: correctOption.id,
      correctPatternKey: getPitchAccentPatternKey(correctOption),
      kana: pair.kana,
      options: pair.options,
      pairId: pair.id,
      sessionId: input.sessionId,
      sortOrder,
      trialId: `${input.sessionId}:trial-${sortOrder + 1}`
    };
  });
}

function selectSessionPairs<T>(
  eligiblePairs: readonly T[],
  requestedCount: number,
  random: () => number
) {
  if (eligiblePairs.length === 0) {
    return [];
  }

  const selectedPairs: T[] = [];
  while (selectedPairs.length < requestedCount) {
    const shuffledPairs = shuffle(eligiblePairs, random);
    for (const pair of shuffledPairs) {
      selectedPairs.push(pair);
      if (selectedPairs.length >= requestedCount) {
        break;
      }
    }
  }

  return selectedPairs;
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = shuffled[index]!;
    shuffled[index] = shuffled[swapIndex]!;
    shuffled[swapIndex] = current;
  }

  return shuffled;
}

function createSeededRandom(seed: string) {
  let state = hashString(seed);

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
