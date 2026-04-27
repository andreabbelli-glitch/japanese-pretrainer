import type {
  KatakanaSpeedItem,
  KatakanaSpeedItemKind,
  KatakanaSpeedSessionMode,
  KatakanaSpeedState,
  KatakanaSpeedTrialMode,
  KatakanaSpeedTrialPlan
} from "../types.ts";
import {
  getKatakanaSpeedCatalog,
  getKatakanaSpeedItemBySurface
} from "./catalog.ts";
import { encodeKatakanaSpeedRawOption } from "./exercise-catalog.ts";
import {
  getItemsForFocus,
  pickKatakanaTrainingFocus,
  type KatakanaTrainingFocus
} from "./focus.ts";
import { stableShuffle } from "./options.ts";
import { isKatakanaSpeedTargetablePseudowordItem } from "./pseudoword-catalog.ts";

type KatakanaSpeedTrainingLoopMode = Extract<
  KatakanaSpeedSessionMode,
  "daily" | "diagnostic_probe" | "repair"
>;

type KatakanaSpeedMoraContrastPair = {
  readonly correctSurface: string;
  readonly distractorSurface: string;
  readonly errorTag: string;
  readonly feature: "long-vowel" | "sokuon";
  readonly focusId: "long-vowel" | "sokuon";
};

const MORA_CONTRAST_PAIRS: readonly KatakanaSpeedMoraContrastPair[] =
  Object.freeze([
    moraContrast("sokuon", "バッグ", "バグ"),
    moraContrast("sokuon", "ベッド", "ベド"),
    moraContrast("sokuon", "ネット", "ネト"),
    moraContrast("sokuon", "チケット", "チケト"),
    moraContrast("long-vowel", "コーヒー", "コヒー"),
    moraContrast("long-vowel", "サーバー", "サバ"),
    moraContrast("long-vowel", "スーパー", "スパ")
  ]);

export function generateKatakanaSpeedSessionPlan(input: {
  count: number;
  now: Date | string;
  seed: string;
  sessionMode?: KatakanaSpeedSessionMode;
  state: KatakanaSpeedState;
}): KatakanaSpeedTrialPlan[] {
  const mode = input.sessionMode ?? "daily";
  assertKatakanaSpeedTrainingLoopMode(mode);

  return generateKatakanaSpeedTrainingLoopPlan({
    count: input.count,
    mode,
    now: input.now,
    seed: input.seed,
    state: input.state
  });
}

function assertKatakanaSpeedTrainingLoopMode(
  mode: KatakanaSpeedSessionMode
): asserts mode is KatakanaSpeedTrainingLoopMode {
  if (mode === "daily" || mode === "diagnostic_probe" || mode === "repair") {
    return;
  }

  throw new Error("Unsupported Katakana Speed session mode.");
}

function generateKatakanaSpeedTrainingLoopPlan(input: {
  count: number;
  mode: KatakanaSpeedTrainingLoopMode;
  now: Date | string;
  seed: string;
  state: KatakanaSpeedState;
}): KatakanaSpeedTrialPlan[] {
  const count = Math.max(0, input.count);
  if (count === 0) {
    return [];
  }

  const focus = pickKatakanaTrainingFocus({
    now: input.now,
    recentAttempts: [],
    state: input.state
  });

  if (input.mode === "repair") {
    return buildRepairTrainingPlan({
      count,
      focus,
      seed: input.seed
    });
  }

  if (input.mode === "diagnostic_probe") {
    return buildDiagnosticTrainingPlan({
      count,
      focus,
      seed: input.seed
    });
  }

  return buildDailyTrainingPlan({
    count,
    focus,
    seed: input.seed
  });
}

function buildDailyTrainingPlan(input: {
  count: number;
  focus: KatakanaTrainingFocus;
  seed: string;
}) {
  const useRepeatedReading =
    input.count >= 20 && shouldUseRepeatedReadingTransfer(input.seed);
  const transferCount = useRepeatedReading ? 3 : 1;
  const counts = splitCounts(Math.max(0, input.count - transferCount), [
    14,
    useRepeatedReading ? 15 : 17
  ]);

  return [
    ...buildContrastSprintTrials({
      blockId: "daily-b1-contrast",
      count: counts[0],
      focus: input.focus,
      seed: `${input.seed}:daily:contrast`
    }),
    ...buildTimedReadingTrials({
      blockId: "daily-b2-reading",
      count: counts[1],
      focus: input.focus,
      seed: `${input.seed}:daily:reading`
    }),
    ...(useRepeatedReading
      ? buildRepeatedReadingTrials({
          blockId: "daily-b3-transfer",
          focus: input.focus,
          seed: `${input.seed}:daily:repeated`
        })
      : buildRanGridTrials({
          blockId: "daily-b3-transfer",
          count: transferCount,
          focus: input.focus,
          seed: `${input.seed}:daily:ran`
        }))
  ];
}

function buildDiagnosticTrainingPlan(input: {
  count: number;
  focus: KatakanaTrainingFocus;
  seed: string;
}) {
  const counts = splitCounts(input.count, [10, 13, 1]);

  return [
    ...buildContrastSprintTrials({
      blockId: "diagnostic-b1-contrast",
      count: counts[0],
      focus: input.focus,
      seed: `${input.seed}:diagnostic:contrast`
    }),
    ...buildTimedReadingTrials({
      blockId: "diagnostic-b2-reading",
      count: counts[1],
      focus: input.focus,
      seed: `${input.seed}:diagnostic:reading`
    }),
    ...buildRanGridTrials({
      blockId: "diagnostic-b3-transfer",
      count: counts[2],
      focus: input.focus,
      seed: `${input.seed}:diagnostic:ran`
    })
  ];
}

function buildRepairTrainingPlan(input: {
  count: number;
  focus: KatakanaTrainingFocus;
  seed: string;
}) {
  const counts = splitCounts(input.count, [16, 10, 8]);

  return [
    ...buildContrastSprintTrials({
      blockId: "repair-b1-contrast",
      count: counts[0],
      focus: input.focus,
      seed: `${input.seed}:repair:contrast`,
      wasRepair: true
    }),
    ...buildTimedReadingTrials({
      blockId: "repair-b2-reading",
      count: counts[1],
      focus: input.focus,
      seed: `${input.seed}:repair:reading`,
      wasRepair: true
    }),
    ...buildContrastSprintTrials({
      blockId: "repair-b3-final",
      count: counts[2],
      focus: input.focus,
      seed: `${input.seed}:repair:final`,
      wasRepair: true
    })
  ];
}

function buildContrastSprintTrials(input: {
  blockId: string;
  count: number;
  focus: KatakanaTrainingFocus;
  seed: string;
  wasRepair?: boolean;
}): KatakanaSpeedTrialPlan[] {
  if (input.focus.kind === "mora_contrast") {
    const trials = buildMoraContrastTrials(input);
    if (trials.length > 0) {
      return trials;
    }
  }

  const surfaces = [
    ...new Set([...input.focus.targetChunks, ...input.focus.distractorChunks])
  ];
  const targetItems = input.focus.targetChunks.flatMap((surface) => {
    const item = getKatakanaSpeedItemBySurface(surface);
    return item ? [item] : [];
  });
  const fallbackItem =
    targetItems[0] ??
    getItemsForFocus({ focus: input.focus, includeRare: true })[0] ??
    getKatakanaSpeedCatalog()[0];
  const shuffledSurfaces = stableShuffle(
    surfaces.length > 0 ? surfaces : [fallbackItem.surface],
    `${input.seed}:surfaces`
  );

  return Array.from({ length: input.count }, (_, index) => {
    const correctSurface =
      input.focus.targetChunks[
        index % Math.max(1, input.focus.targetChunks.length)
      ] ??
      shuffledSurfaces[index % Math.max(1, shuffledSurfaces.length)] ??
      fallbackItem.surface;
    const item = getKatakanaSpeedItemBySurface(correctSurface) ?? fallbackItem;
    const mode: KatakanaSpeedTrialMode =
      index % 4 === 1 ? "blink" : "minimal_pair";
    const optionSurfaces = buildContrastOptionSurfaces({
      correctSurface,
      focus: input.focus,
      maxOptions: mode === "blink" ? 2 : 4,
      seed: `${input.seed}:${index}`
    });
    const targetRtMs = mode === "blink" ? 850 : 1050;

    return {
      blockId: input.blockId,
      correctItemId: item.id,
      exerciseId: `katakana-speed-${blockMode(input.blockId)}`,
      expectedSurface: correctSurface,
      ...(mode === "blink" ? { exposureMs: 700 } : {}),
      features: {
        correctnessSource: "objective",
        exerciseFamily: mode === "blink" ? "blink_choice" : "contrast_choice",
        focusId: input.focus.id,
        focusLabel: input.focus.label,
        hardMode: true,
        interaction: "raw_choice",
        showReadingDuringTrial: false
      },
      focusChunks: input.focus.targetChunks,
      itemId: item.id,
      itemType: item.kind,
      metadataRole: input.wasRepair ? "repair_block" : "confusion_repair",
      metrics: {
        focusId: input.focus.id,
        targetRtMs
      },
      mode,
      optionItemIds: optionSurfaces.map((surface) => {
        const optionItem = getKatakanaSpeedItemBySurface(surface);
        return optionItem?.id ?? encodeKatakanaSpeedRawOption(surface);
      }),
      promptSurface: correctSurface,
      rarity: item.rarity,
      targetRtMs,
      trialId: `katakana-speed-${input.seed}-${index}-${slugForTrial(correctSurface)}`,
      ...(input.wasRepair ? { wasRepair: true } : {})
    };
  });
}

function buildMoraContrastTrials(input: {
  blockId: string;
  count: number;
  focus: KatakanaTrainingFocus;
  seed: string;
  wasRepair?: boolean;
}): KatakanaSpeedTrialPlan[] {
  if (input.count <= 0) {
    return [];
  }

  const pairs = stableShuffle(
    MORA_CONTRAST_PAIRS.filter((pair) => pair.focusId === input.focus.id),
    `${input.seed}:mora-pairs`
  );

  if (pairs.length === 0) {
    return [];
  }

  return Array.from({ length: input.count }, (_, index) => {
    const pair = pairs[index % pairs.length]!;
    const item =
      getKatakanaSpeedItemBySurface(pair.correctSurface) ??
      getItemsForFocus({ focus: input.focus, includeRare: true })[0] ??
      getKatakanaSpeedCatalog()[0];
    const optionSurfaces = stableShuffle(
      [pair.correctSurface, pair.distractorSurface],
      `${input.seed}:${index}:mora-options`
    );

    return {
      blockId: input.blockId,
      correctItemId: item.id,
      exerciseId: `katakana-speed-${blockMode(input.blockId)}`,
      expectedSurface: pair.correctSurface,
      features: {
        correctnessSource: "objective",
        errorTagOnWrong: pair.errorTag,
        exerciseCode: "E16",
        exerciseFamily: "mora_contrast",
        feature: pair.feature,
        focusId: input.focus.id,
        focusLabel: input.focus.label,
        hardMode: true,
        interaction: "raw_choice",
        showReadingDuringTrial: false
      },
      focusChunks: input.focus.targetChunks,
      itemId: item.id,
      itemType: item.kind,
      metadataRole: input.wasRepair ? "repair_block" : "confusion_repair",
      metrics: {
        exerciseFamily: "mora_contrast",
        feature: pair.feature,
        focusId: input.focus.id,
        targetRtMs: 1400
      },
      mode: "minimal_pair",
      optionItemIds: optionSurfaces.map(surfaceToOptionId),
      promptSurface: pair.correctSurface,
      rarity: item.rarity,
      targetRtMs: 1400,
      trialId: `katakana-speed-${input.seed}-${index}-${slugForTrial(pair.correctSurface)}-${slugForTrial(pair.distractorSurface)}`,
      ...(input.wasRepair ? { wasRepair: true } : {})
    };
  });
}

function buildTimedReadingTrials(input: {
  blockId: string;
  count: number;
  focus: KatakanaTrainingFocus;
  seed: string;
  wasRepair?: boolean;
}): KatakanaSpeedTrialPlan[] {
  if (input.count <= 0) {
    return [];
  }

  const pseudoCount = Math.max(1, Math.round(input.count * 0.4));
  const wordCount = Math.max(0, input.count - pseudoCount);
  const wordItems = pickReadingItems({
    count: wordCount,
    focus: input.focus,
    kind: "word",
    seed: `${input.seed}:word`
  });
  const pseudoItems = pickReadingItems({
    count: pseudoCount,
    focus: input.focus,
    kind: "pseudoword",
    seed: `${input.seed}:pseudo`
  });

  return interleavePools([wordItems, pseudoItems])
    .slice(0, input.count)
    .map((item, index) => {
      const isPseudo = item.kind === "pseudoword" || Boolean(item.isPseudo);
      const exerciseFamily = isPseudo
        ? "timed_pseudoword_reading"
        : "timed_word_reading";
      const mode: KatakanaSpeedTrialMode = isPseudo
        ? "pseudoword_sprint"
        : "word_naming";
      const targetMsPerMora = isPseudo ? 850 : 700;

      return {
        blockId: input.blockId,
        correctItemId: item.id,
        exerciseId: `katakana-speed-${blockMode(input.blockId)}`,
        expectedSurface: item.surface,
        features: {
          correctnessSource: "self_report",
          exerciseFamily,
          family: item.family,
          focusId: input.focus.id,
          focusLabel: input.focus.label,
          interaction: "self_check",
          kind: item.kind,
          moraCount: item.moraCount,
          rarity: item.rarity,
          showReadingDuringTrial: false,
          tier: item.tier
        },
        focusChunks:
          item.focusChunks.length > 0
            ? item.focusChunks
            : input.focus.targetChunks,
        itemId: item.id,
        itemType: item.kind,
        metadataRole: isPseudo ? "pseudoword_transfer" : "word_transfer",
        metrics: {
          exerciseFamily,
          focusId: input.focus.id,
          moraCount: item.moraCount,
          targetMsPerMora
        },
        mode,
        optionItemIds: [item.id],
        promptSurface: item.surface,
        rarity: item.rarity,
        targetRtMs: targetMsPerMora * Math.max(1, item.moraCount),
        trialId: `katakana-speed-${input.seed}-${index}-${item.id}`,
        ...(isPseudo ? { wasPseudo: true } : {}),
        ...(input.wasRepair ? { wasRepair: true } : {}),
        wasTransfer: true
      };
    });
}

function buildRanGridTrials(input: {
  blockId: string;
  count: number;
  focus: KatakanaTrainingFocus;
  seed: string;
}): KatakanaSpeedTrialPlan[] {
  if (input.count <= 0) {
    return [];
  }

  const surfaces = [
    ...new Set([...input.focus.targetChunks, ...input.focus.distractorChunks])
  ];
  const sourceItems = stableShuffle(
    getKatakanaSpeedCatalog().filter(
      (item) =>
        item.kind === "single_kana" ||
        item.kind === "core_mora" ||
        item.kind === "extended_chunk"
    ),
    `${input.seed}:source`
  );
  const gridSurfaces = Array.from({ length: 25 }, (_, index) => {
    const surface = surfaces[index % Math.max(1, surfaces.length)];
    return (
      surface ??
      sourceItems[index % Math.max(1, sourceItems.length)]?.surface ??
      "ティ"
    );
  });
  const gridItemIds = gridSurfaces.map((surface, index) => {
    const item = getKatakanaSpeedItemBySurface(surface);
    return item?.id ?? `raw-grid-${index}`;
  });
  const firstItem =
    getKatakanaSpeedItemBySurface(gridSurfaces[0] ?? "") ??
    getItemsForFocus({ focus: input.focus, includeRare: true })[0] ??
    getKatakanaSpeedCatalog()[0];

  return [
    {
      blockId: input.blockId,
      correctItemId: firstItem.id,
      exerciseId: `katakana-speed-${blockMode(input.blockId)}`,
      expectedSurface: firstItem.surface,
      features: {
        cellCount: 25,
        correctnessSource: "aggregate_manual",
        exerciseFamily: "ran_grid",
        focusId: input.focus.id,
        focusLabel: input.focus.label,
        gridItemIds,
        gridSurfaces,
        showReadingDuringTrial: false
      },
      focusChunks: input.focus.targetChunks,
      itemId: firstItem.id,
      itemType: "ran_grid",
      metadataRole: "ran_grid",
      metrics: {
        cellCount: 25,
        exerciseFamily: "ran_grid",
        focusId: input.focus.id,
        targetItemsPerSecond: 1.8
      },
      mode: "ran_grid",
      optionItemIds: [firstItem.id],
      promptSurface: firstItem.surface,
      rarity: firstItem.rarity,
      targetRtMs: 14_000,
      trialId: `katakana-speed-${input.seed}-0-${firstItem.id}`,
      wasTransfer: true
    }
  ];
}

function buildRepeatedReadingTrials(input: {
  blockId: string;
  focus: KatakanaTrainingFocus;
  seed: string;
}): KatakanaSpeedTrialPlan[] {
  const focusedSentences = getItemsForFocus({
    focus: input.focus,
    includeRare: true,
    kind: "sentence"
  });
  const fallbackSentences = getKatakanaSpeedCatalog().filter(
    (item) => item.kind === "sentence"
  );
  const sentences = stableShuffle(
    focusedSentences.length > 0 ? focusedSentences : fallbackSentences,
    `${input.seed}:sentences`
  );
  const { firstSentence, transferSentence } = findRepeatedReadingPair(
    sentences.length > 0 ? sentences : [getKatakanaSpeedCatalog()[0]],
    input.focus
  );
  const trialItems = [
    { item: firstSentence, passRole: "first_pass" },
    { item: firstSentence, passRole: "repeat_pass" },
    { item: transferSentence, passRole: "transfer_pass" }
  ] as const;

  return trialItems.map(({ item, passRole }, index) => ({
    blockId: input.blockId,
    correctItemId: item.id,
    exerciseId: `katakana-speed-${blockMode(input.blockId)}`,
    expectedSurface: item.surface,
    features: {
      correctnessSource: "aggregate_manual",
      exerciseFamily: "repeated_reading",
      focusId: input.focus.id,
      focusLabel: input.focus.label,
      kind: item.kind,
      moraCount: item.moraCount,
      repeatedReadingPass: index + 1,
      repeatedReadingRole: passRole,
      showReadingDuringTrial: false
    },
    focusChunks:
      item.focusChunks.length > 0 ? item.focusChunks : input.focus.targetChunks,
    itemId: item.id,
    itemType: "sentence",
    metadataRole: "repeated_reading",
    metrics: {
      exerciseFamily: "repeated_reading",
      focusId: input.focus.id,
      passRole,
      repeatedReadingPass: index + 1,
      targetMsPerMora: Math.round(item.targetRtMs / Math.max(1, item.moraCount))
    },
    mode: "repeated_reading_pass",
    optionItemIds: [item.id],
    promptSurface: item.surface,
    rarity: item.rarity,
    targetRtMs: item.targetRtMs,
    trialId: `katakana-speed-${input.seed}-${index}-${item.id}`,
    ...(passRole === "transfer_pass" ? { wasTransfer: true } : {})
  }));
}

function findRepeatedReadingPair(
  sentences: readonly KatakanaSpeedItem[],
  focus: KatakanaTrainingFocus
) {
  for (const firstSentence of sentences) {
    for (const focusChunk of [
      ...focus.targetChunks,
      ...firstSentence.focusChunks
    ]) {
      const transferSentence = sentences.find(
        (candidate) =>
          candidate.id !== firstSentence.id &&
          (candidate.focusChunks.includes(focusChunk) ||
            candidate.surface.includes(focusChunk))
      );

      if (transferSentence) {
        return { firstSentence, transferSentence };
      }
    }
  }

  const firstSentence = sentences[0] ?? getKatakanaSpeedCatalog()[0];
  const transferSentence =
    sentences.find((candidate) => candidate.id !== firstSentence.id) ??
    firstSentence;

  return { firstSentence, transferSentence };
}

function splitCounts(total: number, weights: readonly number[]) {
  if (total <= 0) {
    return weights.map(() => 0);
  }

  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  if (total === weightTotal) {
    return [...weights];
  }

  const activeSlots = Math.min(total, weights.length);
  const base = weights.map((_, index) => (index < activeSlots ? 1 : 0));
  let remaining = total - activeSlots;

  for (let index = 0; index < weights.length; index += 1) {
    if (remaining <= 0) {
      break;
    }
    const share = Math.min(
      remaining,
      Math.floor((total * weights[index]!) / Math.max(1, weightTotal))
    );
    base[index] += share;
    remaining -= share;
  }

  let index = 0;
  while (remaining > 0) {
    base[index % activeSlots] += 1;
    remaining -= 1;
    index += 1;
  }

  return base;
}

function buildContrastOptionSurfaces(input: {
  correctSurface: string;
  focus: KatakanaTrainingFocus;
  maxOptions: number;
  seed: string;
}) {
  const distractors = stableShuffle(
    [
      ...new Set(
        [...input.focus.distractorChunks, ...input.focus.targetChunks].filter(
          (surface) => surface.length > 0 && surface !== input.correctSurface
        )
      )
    ],
    `${input.seed}:distractors`
  ).slice(0, Math.max(0, input.maxOptions - 1));

  return stableShuffle(
    [input.correctSurface, ...distractors],
    `${input.seed}:final`
  ).slice(0, input.maxOptions);
}

function surfaceToOptionId(surface: string) {
  const optionItem = getKatakanaSpeedItemBySurface(surface);
  return optionItem?.id ?? encodeKatakanaSpeedRawOption(surface);
}

function pickReadingItems(input: {
  count: number;
  focus: KatakanaTrainingFocus;
  kind: Extract<KatakanaSpeedItemKind, "pseudoword" | "sentence" | "word">;
  seed: string;
}) {
  if (input.count <= 0) {
    return [];
  }

  const isEligible = (item: KatakanaSpeedItem) =>
    item.kind === input.kind &&
    item.rarity !== "rare" &&
    (input.kind !== "pseudoword" ||
      isKatakanaSpeedTargetablePseudowordItem(item));
  const focused = getItemsForFocus({
    focus: input.focus,
    kind: input.kind
  }).filter(isEligible);
  const fallback = getKatakanaSpeedCatalog().filter(isEligible);
  const pool = focused.length > 0 ? focused : fallback;
  const shuffled = stableShuffle(pool, input.seed);

  return Array.from({ length: input.count }, (_, index) => {
    const item = shuffled[index % Math.max(1, shuffled.length)];
    return item ?? fallback[0] ?? getKatakanaSpeedCatalog()[0];
  });
}

function interleavePools<T>(pools: readonly (readonly T[])[]) {
  const maxLength = Math.max(0, ...pools.map((pool) => pool.length));
  const result: T[] = [];

  for (let index = 0; index < maxLength; index += 1) {
    for (const pool of pools) {
      const item = pool[index];
      if (item) {
        result.push(item);
      }
    }
  }

  return result;
}

function shouldUseRepeatedReadingTransfer(seed: string) {
  return hashSeed(seed) % 2 === 0;
}

function hashSeed(seed: string) {
  let hash = 0;
  for (const character of seed) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return hash;
}

function blockMode(blockId: string) {
  return blockId.split("-")[0] ?? "daily";
}

function moraContrast(
  focusId: "long-vowel" | "sokuon",
  correctSurface: string,
  distractorSurface: string
): KatakanaSpeedMoraContrastPair {
  return {
    correctSurface,
    distractorSurface,
    errorTag: focusId === "sokuon" ? "sokuon_missed" : "long_vowel_missed",
    feature: focusId,
    focusId
  };
}

function slugForTrial(surface: string) {
  return Array.from(surface)
    .map((character) => character.codePointAt(0)?.toString(16) ?? "x")
    .join("-");
}
