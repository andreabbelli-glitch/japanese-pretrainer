import type {
  KatakanaSpeedItem,
  KatakanaSpeedItemKind,
  KatakanaSpeedManualExercise,
  KatakanaSpeedSessionMode,
  KatakanaSpeedState,
  KatakanaSpeedTrialMode,
  KatakanaSpeedTrialPlan
} from "../types.ts";
import {
  getKatakanaSpeedCatalog,
  getKatakanaSpeedItemById,
  getKatakanaSpeedItemBySurface
} from "./catalog.ts";
import { encodeKatakanaSpeedRawOption } from "./exercise-catalog.ts";
import {
  KATAKANA_SPEED_FOCUSES,
  getItemsForFocus,
  pickKatakanaTrainingFocus,
  type KatakanaTrainingFocus
} from "./focus.ts";
import { stableShuffle } from "./options.ts";
import { isKatakanaSpeedTargetablePseudowordItem } from "./pseudoword-catalog.ts";
import { romanizeKatakanaForLearner } from "./readings.ts";

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
    moraContrast("sokuon", "メッセージ", "メセージ"),
    moraContrast("sokuon", "アップデート", "アプデート"),
    moraContrast("sokuon", "ネット", "ネト"),
    moraContrast("sokuon", "チェック", "チェク"),
    moraContrast("sokuon", "ピッツァ", "ピツァ"),
    moraContrast("sokuon", "チケット", "チケト"),
    moraContrast("sokuon", "ウォレット", "ウォレト"),
    moraContrast("sokuon", "クァルテット", "クァルテト"),
    moraContrast("sokuon", "ストップウォッチ", "ストプウォッチ"),
    moraContrast("long-vowel", "コーヒー", "コヒー"),
    moraContrast("long-vowel", "メール", "メル"),
    moraContrast("long-vowel", "データ", "デタ"),
    moraContrast("long-vowel", "サーバー", "サバ"),
    moraContrast("long-vowel", "スーパー", "スパ"),
    moraContrast("long-vowel", "チーズ", "チズ"),
    moraContrast("long-vowel", "ケーキ", "ケキ"),
    moraContrast("long-vowel", "タクシー", "タクシ"),
    moraContrast("long-vowel", "ギター", "ギタ"),
    moraContrast("long-vowel", "パーティー", "パティ"),
    moraContrast("long-vowel", "サービス", "サビス"),
    moraContrast("long-vowel", "キャンペーン", "キャンペン"),
    moraContrast("long-vowel", "ニューヨーク", "ニュヨク"),
    moraContrast("long-vowel", "プロデューサー", "プロデュサ"),
    moraContrast("long-vowel", "クォーター", "クォタ"),
    moraContrast("long-vowel", "ヒンドゥー", "ヒンドゥ"),
    moraContrast("long-vowel", "ヴィーナス", "ヴィナス"),
    moraContrast("long-vowel", "ヴォーカル", "ヴォカル"),
    moraContrast("long-vowel", "フュージョン", "フュジョン")
  ]);

export function generateKatakanaSpeedSessionPlan(input: {
  count: number;
  manualExercise?: KatakanaSpeedManualExercise;
  now: Date | string;
  seed: string;
  sessionMode?: KatakanaSpeedSessionMode;
  state: KatakanaSpeedState;
}): KatakanaSpeedTrialPlan[] {
  const mode = input.sessionMode ?? "daily";
  assertKatakanaSpeedTrainingLoopMode(mode);

  return generateKatakanaSpeedTrainingLoopPlan({
    count: input.count,
    manualExercise: input.manualExercise,
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
  manualExercise?: KatakanaSpeedManualExercise;
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

  if (input.manualExercise) {
    return buildManualExercisePlan({
      count,
      focus,
      manualExercise: input.manualExercise,
      seed: input.seed
    });
  }

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

function buildManualExercisePlan(input: {
  count: number;
  focus: KatakanaTrainingFocus;
  manualExercise: KatakanaSpeedManualExercise;
  seed: string;
}) {
  if (input.manualExercise === "romaji_to_katakana") {
    return buildRomajiToKatakanaChoiceTrials({
      blockId: "manual-romaji-to-katakana",
      count: input.count,
      focus: input.focus,
      seed: `${input.seed}:manual:romaji`
    });
  }

  if (input.manualExercise === "contrast") {
    return buildContrastSprintTrials({
      blockId: "manual-contrast",
      count: input.count,
      focus: input.focus,
      seed: `${input.seed}:manual:contrast`
    });
  }

  if (input.manualExercise === "reading") {
    return buildTimedReadingTrials({
      blockId: "manual-reading",
      count: input.count,
      focus: input.focus,
      seed: `${input.seed}:manual:reading`
    });
  }

  if (input.manualExercise === "mora_contrast") {
    return buildManualMoraContrastTrials({
      blockId: "manual-mora-contrast",
      count: input.count,
      focus: input.focus,
      seed: `${input.seed}:manual:mora`
    });
  }

  return buildRanGridTrials({
    blockId: "manual-ran-grid",
    count: 1,
    focus: input.focus,
    seed: `${input.seed}:manual:ran`
  });
}

function buildDailyTrainingPlan(input: {
  count: number;
  focus: KatakanaTrainingFocus;
  seed: string;
}) {
  const transferCount = 1;
  const counts = splitCounts(
    Math.max(0, input.count - transferCount),
    [14, 17]
  );

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
    ...buildRanGridTrials({
      blockId: "daily-b3-transfer",
      count: transferCount,
      focus: input.focus,
      seed: `${input.seed}:daily:ran`
    })
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
    const inverseTrials = buildRomajiToKatakanaChoiceTrials({
      blockId: input.blockId,
      count: Math.min(1, input.count),
      focus: input.focus,
      seed: `${input.seed}:romaji-first`,
      wasRepair: input.wasRepair
    });
    const trials = [
      ...inverseTrials,
      ...buildMoraContrastTrials({
        ...input,
        count: Math.max(0, input.count - inverseTrials.length),
        seed: `${input.seed}:mora`
      })
    ];
    if (trials.length > 0) {
      return trials;
    }
  }

  const surfaces = [
    ...new Set([...input.focus.targetChunks, ...input.focus.distractorChunks])
  ];
  const fallbackItem = pickFallbackItemForFocus(input.focus);
  const shuffledSurfaces = stableShuffle(
    surfaces.length > 0 ? surfaces : [fallbackItem.surface],
    `${input.seed}:surfaces`
  );

  return Array.from({ length: input.count }, (_, index) => {
    const isRomajiToKatakanaChoice = index % 4 === 0;
    if (isRomajiToKatakanaChoice) {
      return buildRomajiToKatakanaChoiceTrial({
        blockId: input.blockId,
        fallbackItem,
        focus: input.focus,
        index: Math.floor(index / 4),
        seed: `${input.seed}:${index}`,
        wasRepair: input.wasRepair
      });
    }

    const correctSurface =
      input.focus.targetChunks[
        index % Math.max(1, input.focus.targetChunks.length)
      ] ??
      shuffledSurfaces[index % Math.max(1, shuffledSurfaces.length)] ??
      fallbackItem.surface;
    const item = getKatakanaSpeedItemBySurface(correctSurface) ?? fallbackItem;
    const mode: KatakanaSpeedTrialMode =
      index % 4 === 2 ? "blink" : "minimal_pair";
    const optionSurfaces = buildContrastOptionSurfaces({
      correctSurface,
      focus: input.focus,
      maxOptions: mode === "blink" ? 2 : 4,
      seed: `${input.seed}:${index}`
    });
    const targetRtMs = mode === "blink" ? 850 : 1050;
    const exerciseFamily =
      mode === "blink" ? "blink_choice" : "contrast_choice";

    return {
      blockId: input.blockId,
      correctItemId: item.id,
      exerciseId: `katakana-speed-${blockMode(input.blockId)}`,
      expectedSurface: correctSurface,
      ...(mode === "blink" ? { exposureMs: 700 } : {}),
      features: {
        correctnessSource: "objective",
        exerciseFamily,
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

function buildRomajiToKatakanaChoiceTrials(input: {
  blockId: string;
  count: number;
  focus: KatakanaTrainingFocus;
  seed: string;
  wasRepair?: boolean;
}): KatakanaSpeedTrialPlan[] {
  if (input.count <= 0) {
    return [];
  }

  const fallbackItem = pickFallbackItemForFocus(input.focus);

  return Array.from({ length: input.count }, (_, index) =>
    buildRomajiToKatakanaChoiceTrial({
      blockId: input.blockId,
      fallbackItem,
      focus: input.focus,
      index,
      seed: `${input.seed}:${index}`,
      wasRepair: input.wasRepair
    })
  );
}

function buildRomajiToKatakanaChoiceTrial(input: {
  blockId: string;
  fallbackItem: KatakanaSpeedItem;
  focus: KatakanaTrainingFocus;
  index: number;
  seed: string;
  wasRepair?: boolean;
}): KatakanaSpeedTrialPlan {
  const correctSurface = pickRomajiChoiceCorrectSurface({
    fallbackSurface: input.fallbackItem.surface,
    focus: input.focus,
    index: input.index,
    seed: `${input.seed}:correct`
  });
  const item =
    getKatakanaSpeedItemBySurface(correctSurface) ?? input.fallbackItem;
  const promptReading =
    romanizeKatakanaForLearner(correctSurface) ?? input.fallbackItem.reading;
  const optionSurfaces = buildRomajiChoiceOptionSurfaces({
    correctSurface,
    focus: input.focus,
    maxOptions: 4,
    promptReading,
    seed: input.seed
  });

  return {
    blockId: input.blockId,
    correctItemId: item.id,
    exerciseId: `katakana-speed-${blockMode(input.blockId)}`,
    expectedSurface: correctSurface,
    features: {
      answerKind: "katakana",
      correctnessSource: "objective",
      direction: "romaji_to_katakana",
      exerciseCode: "E04",
      exerciseFamily: "romaji_to_katakana_choice",
      focusId: input.focus.id,
      focusLabel: input.focus.label,
      hardMode: true,
      interaction: "raw_choice",
      promptKind: "romaji",
      showReadingDuringTrial: false
    },
    focusChunks: input.focus.targetChunks,
    itemId: item.id,
    itemType: item.kind,
    metadataRole: input.wasRepair ? "repair_block" : "confusion_repair",
    metrics: {
      focusId: input.focus.id,
      targetRtMs: 1150
    },
    mode: "minimal_pair",
    optionItemIds: optionSurfaces.map(surfaceToOptionId),
    promptSurface: promptReading,
    rarity: item.rarity,
    targetRtMs: 1150,
    trialId: `katakana-speed-${input.seed}-${input.index}-${slugForTrial(correctSurface)}-romaji`,
    ...(input.wasRepair ? { wasRepair: true } : {})
  };
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

function buildManualMoraContrastTrials(input: {
  blockId: string;
  count: number;
  focus: KatakanaTrainingFocus;
  seed: string;
}) {
  const moraFoci = KATAKANA_SPEED_FOCUSES.filter(
    (focus) => focus.kind === "mora_contrast"
  );
  const orderedFoci =
    input.focus.kind === "mora_contrast"
      ? [
          input.focus,
          ...moraFoci.filter((focus) => focus.id !== input.focus.id)
        ]
      : stableShuffle(moraFoci, `${input.seed}:mora-foci`);
  const counts = splitCounts(
    input.count,
    orderedFoci.map(() => 1)
  );

  return interleavePools(
    orderedFoci.map((focus, index) =>
      buildMoraContrastTrials({
        blockId: input.blockId,
        count: counts[index] ?? 0,
        focus,
        seed: `${input.seed}:${focus.id}`
      })
    )
  ).slice(0, input.count);
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

  const gridSurfaces = buildRanGridSurfaces({
    focus: input.focus,
    seed: input.seed
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

function buildRanGridSurfaces(input: {
  focus: KatakanaTrainingFocus;
  seed: string;
}) {
  const focusedSurfaces = getItemsForFocus({
    focus: input.focus,
    includeRare: false,
    kind: ["single_kana", "core_mora", "extended_chunk", "word"]
  }).map((item) => item.surface);
  const moraFocusSurfaces =
    input.focus.kind === "mora_contrast" &&
    isMoraContrastFocusId(input.focus.id)
      ? getMoraContrastPairsForFocus(input.focus.id).map(
          (pair) => pair.correctSurface
        )
      : [];
  const sourceSurfaces = getKatakanaSpeedCatalog()
    .filter(
      (item) =>
        item.rarity !== "rare" &&
        (item.kind === "single_kana" ||
          item.kind === "core_mora" ||
          item.kind === "extended_chunk")
    )
    .map((item) => item.surface);
  const prioritySurfaces = stableShuffle(
    uniqueDisplayableSurfaces([...moraFocusSurfaces, ...focusedSurfaces]),
    `${input.seed}:ran-priority`
  );
  const fillerSurfaces = stableShuffle(
    uniqueDisplayableSurfaces(sourceSurfaces).filter(
      (surface) => !prioritySurfaces.includes(surface)
    ),
    `${input.seed}:ran-source`
  );
  const pool = [...prioritySurfaces, ...fillerSurfaces];
  const selected =
    pool.length === 0
      ? ["ティ"]
      : pool.length >= 25
        ? pool.slice(0, 25)
        : Array.from({ length: 25 }, (_, index) => pool[index % pool.length]);

  return stableShuffle(selected, `${input.seed}:ran-grid`);
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

function pickRomajiChoiceCorrectSurface(input: {
  fallbackSurface: string;
  focus: KatakanaTrainingFocus;
  index: number;
  seed: string;
}) {
  const focusCandidates =
    input.focus.kind === "mora_contrast" &&
    isMoraContrastFocusId(input.focus.id)
      ? getMoraContrastPairsForFocus(input.focus.id).map(
          (pair) => pair.correctSurface
        )
      : [...input.focus.targetChunks, ...input.focus.distractorChunks];
  const candidates = uniqueDisplayableSurfaces(focusCandidates).filter(
    (surface) => getKatakanaSpeedItemBySurface(surface)
  );
  const shuffled = stableShuffle(candidates, input.seed);

  return (
    shuffled[input.index % Math.max(1, shuffled.length)] ??
    input.fallbackSurface
  );
}

function buildRomajiChoiceOptionSurfaces(input: {
  correctSurface: string;
  focus: KatakanaTrainingFocus;
  maxOptions: number;
  promptReading: string;
  seed: string;
}) {
  const selected = new Set([input.correctSurface]);
  const correctItem = getKatakanaSpeedItemBySurface(input.correctSurface);
  const focusSurfaces = [
    ...new Set([...input.focus.distractorChunks, ...input.focus.targetChunks])
  ];
  const moraPairSurfaces = MORA_CONTRAST_PAIRS.filter(
    (pair) => pair.correctSurface === input.correctSurface
  ).flatMap((pair) => [
    pair.distractorSurface,
    ...getMoraContrastPairsForFocus(pair.focusId).flatMap((candidate) => [
      candidate.correctSurface,
      candidate.distractorSurface
    ])
  ]);
  const clusterSurfaces =
    correctItem?.distractorItemIds.flatMap((itemId) => {
      const item = getKatakanaSpeedItemById(itemId);
      return item ? [item.surface] : [];
    }) ?? [];
  const familySurfaces =
    correctItem === undefined
      ? []
      : getKatakanaSpeedCatalog()
          .filter(
            (item) =>
              item.id !== correctItem.id &&
              item.family === correctItem.family &&
              item.rarity !== "rare"
          )
          .map((item) => item.surface);
  const fallbackSurfaces = getKatakanaSpeedCatalog()
    .filter(
      (item) =>
        item.surface !== input.correctSurface &&
        item.kind !== "word" &&
        item.kind !== "sentence" &&
        item.kind !== "pseudoword"
    )
    .map((item) => item.surface);

  fillRomajiChoiceSurfaces({
    candidates: focusSurfaces,
    maxOptions: input.maxOptions,
    promptReading: input.promptReading,
    selected
  });
  fillRomajiChoiceSurfaces({
    candidates: stableShuffle(moraPairSurfaces, `${input.seed}:mora`),
    maxOptions: input.maxOptions,
    promptReading: input.promptReading,
    selected
  });
  fillRomajiChoiceSurfaces({
    candidates: stableShuffle(clusterSurfaces, `${input.seed}:clusters`),
    maxOptions: input.maxOptions,
    promptReading: input.promptReading,
    selected
  });
  fillRomajiChoiceSurfaces({
    candidates: stableShuffle(familySurfaces, `${input.seed}:family`),
    maxOptions: input.maxOptions,
    promptReading: input.promptReading,
    selected
  });
  fillRomajiChoiceSurfaces({
    candidates: stableShuffle(fallbackSurfaces, `${input.seed}:fallback`),
    maxOptions: input.maxOptions,
    promptReading: input.promptReading,
    selected
  });

  return stableShuffle([...selected], `${input.seed}:final`).slice(
    0,
    input.maxOptions
  );
}

function fillRomajiChoiceSurfaces(input: {
  candidates: readonly string[];
  maxOptions: number;
  promptReading: string;
  selected: Set<string>;
}) {
  for (const candidate of input.candidates) {
    if (input.selected.size >= input.maxOptions) {
      return;
    }
    if (input.selected.has(candidate) || !isKatakanaOptionSurface(candidate)) {
      continue;
    }
    if (romanizeKatakanaForLearner(candidate) === input.promptReading) {
      continue;
    }
    input.selected.add(candidate);
  }
}

function isKatakanaOptionSurface(surface: string) {
  return (
    /^[\u30a0-\u30ffー]+$/u.test(surface) && /[\u30a1-\u30fa]/u.test(surface)
  );
}

function surfaceToOptionId(surface: string) {
  const optionItem = getKatakanaSpeedItemBySurface(surface);
  return optionItem?.id ?? encodeKatakanaSpeedRawOption(surface);
}

function pickFallbackItemForFocus(focus: KatakanaTrainingFocus) {
  const targetItems = focus.targetChunks.flatMap((surface) => {
    const item = getKatakanaSpeedItemBySurface(surface);
    return item && isDisplayableRanCellSurface(item.surface) ? [item] : [];
  });

  return (
    targetItems[0] ??
    getItemsForFocus({ focus, includeRare: true }).find((item) =>
      isDisplayableRanCellSurface(item.surface)
    ) ??
    getKatakanaSpeedCatalog()[0]
  );
}

function getMoraContrastPairsForFocus(
  focusId: KatakanaSpeedMoraContrastPair["focusId"]
) {
  return MORA_CONTRAST_PAIRS.filter((pair) => pair.focusId === focusId);
}

function isMoraContrastFocusId(
  focusId: string
): focusId is KatakanaSpeedMoraContrastPair["focusId"] {
  return focusId === "long-vowel" || focusId === "sokuon";
}

function uniqueDisplayableSurfaces(surfaces: readonly string[]) {
  return [...new Set(surfaces)].filter(isDisplayableRanCellSurface);
}

function isDisplayableRanCellSurface(surface: string) {
  return (
    isKatakanaOptionSurface(surface) && surface !== "ー" && surface !== "ッ"
  );
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
