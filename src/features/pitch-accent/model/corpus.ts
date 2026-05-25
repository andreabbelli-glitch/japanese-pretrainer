import type {
  PitchAccentMinimalPair,
  PitchAccentMinimalPairsCorpus,
  PitchAccentPairOption,
  PitchAccentPatternFilter,
  PitchAccentPatternKey
} from "../types.ts";

export const pitchAccentPatternKeys = [
  "pitch0",
  "pitch1",
  "pitch2",
  "pitch3",
  "pitch4"
] as const satisfies readonly PitchAccentPatternKey[];

export const defaultPitchAccentFilters: PitchAccentPatternFilter = {
  onlyDevoiced: false,
  patternKeys: pitchAccentPatternKeys,
  strictPairFinding: false
};

export function getPitchAccentPatternKey(
  input: Pick<PitchAccentPairOption, "moraCount" | "pitchAccent">
): PitchAccentPatternKey {
  if (input.pitchAccent === 0 || input.pitchAccent === input.moraCount) {
    return "pitch0";
  }
  if (input.pitchAccent === 1) {
    return "pitch1";
  }
  if (input.pitchAccent === 2) {
    return "pitch2";
  }
  if (input.pitchAccent === 3) {
    return "pitch3";
  }

  return "pitch4";
}

export function normalizePitchAccentFilters(
  filters: Partial<PitchAccentPatternFilter> | undefined
): PitchAccentPatternFilter {
  const selectedKeys = [
    ...new Set(filters?.patternKeys ?? pitchAccentPatternKeys)
  ]
    .filter(isPitchAccentPatternKey)
    .sort(comparePitchAccentPatternKey);

  return {
    onlyDevoiced: filters?.onlyDevoiced ?? false,
    patternKeys:
      selectedKeys.length > 0 ? selectedKeys : pitchAccentPatternKeys,
    strictPairFinding: filters?.strictPairFinding ?? false
  };
}

export function filterPitchAccentMinimalPairs(
  corpus: Pick<PitchAccentMinimalPairsCorpus, "pairs">,
  filters: Partial<PitchAccentPatternFilter> | undefined
): readonly PitchAccentMinimalPair[] {
  const normalizedFilters = normalizePitchAccentFilters(filters);
  const selected = new Set(normalizedFilters.patternKeys);

  return corpus.pairs.filter((pair) => {
    if (normalizedFilters.onlyDevoiced && !pair.hasDevoiced) {
      return false;
    }

    const optionPatternKeys = new Set(
      pair.options.map((option) => getPitchAccentPatternKey(option))
    );

    if (normalizedFilters.strictPairFinding) {
      return [...optionPatternKeys].every((patternKey) =>
        selected.has(patternKey)
      );
    }

    return [...optionPatternKeys].some((patternKey) =>
      selected.has(patternKey)
    );
  });
}

export function validatePitchAccentMinimalPairsCorpus(
  corpus: PitchAccentMinimalPairsCorpus
): { readonly errors: readonly string[]; readonly ok: boolean } {
  const errors: string[] = [];
  const pairIds = new Set<string>();

  if (corpus.version !== 1) {
    errors.push("Corpus version must be 1.");
  }
  if (!corpus.source.repository || !corpus.source.revision) {
    errors.push("Corpus source metadata is incomplete.");
  }

  for (const pair of corpus.pairs) {
    if (!pair.id.trim()) {
      errors.push("Every pair must include an id.");
      continue;
    }
    if (pairIds.has(pair.id)) {
      errors.push(`${pair.id} is duplicated.`);
    }
    pairIds.add(pair.id);
    if (!isSafePitchAccentPairId(pair.id)) {
      errors.push(`${pair.id} has an unsafe pair id.`);
    }

    if (pair.options.length < 2) {
      errors.push(`${pair.id} must include at least two answer options.`);
    }
    if (pair.optionCount !== pair.options.length) {
      errors.push(`${pair.id} optionCount does not match options length.`);
    }

    const optionIds = new Set<string>();
    for (const option of pair.options) {
      if (optionIds.has(option.id)) {
        errors.push(`${pair.id} has duplicated option ${option.id}.`);
      }
      optionIds.add(option.id);

      if (!option.audioSrc.startsWith("/vendor/minimal-pairs/audio/")) {
        errors.push(
          `${option.id} audioSrc must point to the vendor audio path.`
        );
      }
      if (
        !Number.isInteger(option.pitchAccent) ||
        option.pitchAccent < 0 ||
        option.pitchAccent > option.moraCount
      ) {
        errors.push(`${option.id} has an invalid pitch accent.`);
      }
      if (!Number.isInteger(option.moraCount) || option.moraCount <= 0) {
        errors.push(`${option.id} has an invalid mora count.`);
      }
    }
  }

  return {
    errors,
    ok: errors.length === 0
  };
}

export function isSafePitchAccentPairId(value: string) {
  return /^[0-9A-Za-z][0-9A-Za-z_-]*$/u.test(value);
}

function isPitchAccentPatternKey(
  value: string
): value is PitchAccentPatternKey {
  return (pitchAccentPatternKeys as readonly string[]).includes(value);
}

function comparePitchAccentPatternKey(
  left: PitchAccentPatternKey,
  right: PitchAccentPatternKey
) {
  return (
    pitchAccentPatternKeys.indexOf(left) - pitchAccentPatternKeys.indexOf(right)
  );
}
