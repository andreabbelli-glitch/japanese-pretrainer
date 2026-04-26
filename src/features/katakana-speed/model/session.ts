import type {
  KatakanaSpeedItem,
  KatakanaSpeedSessionMode,
  KatakanaSpeedState,
  KatakanaSpeedTrialMode,
  KatakanaSpeedTrialPlan
} from "../types.ts";
import {
  getKatakanaSpeedCatalog,
  getKatakanaSpeedConfusionClusterById,
  getKatakanaSpeedItemBySurface
} from "./catalog.ts";
import { generateKatakanaSpeedOptions, stableShuffle } from "./options.ts";
import {
  encodeKatakanaSpeedRawOption,
  getKatakanaSpeedChunkSpottingTargets,
  getKatakanaSpeedLadderDefinitions,
  getKatakanaSpeedMoraTrapPairs,
  getKatakanaSpeedVariantPairs
} from "./exercise-catalog.ts";
import { isKatakanaSpeedTargetablePseudowordItem } from "./pseudoword-catalog.ts";
import { formatKatakanaSpeedReading } from "./readings.ts";
import { computeKatakanaSpeedPriority } from "./scheduler.ts";
import { tokenizeKatakanaDisplaySegments } from "./tokenizer.ts";

type ExpandedRole = NonNullable<KatakanaSpeedTrialPlan["metadataRole"]>;

export function generateKatakanaSpeedSessionPlan(input: {
  count: number;
  now: Date | string;
  seed: string;
  sessionMode?: KatakanaSpeedSessionMode;
  state: KatakanaSpeedState;
}): KatakanaSpeedTrialPlan[] {
  if (input.sessionMode) {
    return generateExpandedKatakanaSpeedSessionPlan({
      count: input.count,
      now: input.now,
      seed: input.seed,
      sessionMode: input.sessionMode,
      state: input.state
    });
  }

  return generateLegacyKatakanaSpeedSessionPlan(input);
}

function generateLegacyKatakanaSpeedSessionPlan(input: {
  count: number;
  now: Date | string;
  seed: string;
  state: KatakanaSpeedState;
}): KatakanaSpeedTrialPlan[] {
  const rankedItems = stableShuffle(
    getKatakanaSpeedCatalog(),
    `${input.seed}:priority-tie`
  ).sort(
    (left, right) =>
      computeKatakanaSpeedPriority({
        itemId: right.id,
        now: input.now,
        state: input.state
      }) -
      computeKatakanaSpeedPriority({
        itemId: left.id,
        now: input.now,
        state: input.state
      })
  );

  return rankedItems.slice(0, Math.max(0, input.count)).map((item, index) => {
    const confusionClusterId = item.confusionClusterIds[0];
    const mode = index % 3 === 2 ? "blink" : "minimal_pair";
    const trial: KatakanaSpeedTrialPlan = {
      ...(confusionClusterId ? { confusionClusterId } : {}),
      correctItemId: item.id,
      ...(mode === "blink" ? { exposureMs: 450 } : {}),
      itemId: item.id,
      mode,
      optionItemIds: generateKatakanaSpeedOptions({
        count: mode === "blink" ? 2 : 4,
        seed: `${input.seed}:${index}:${item.id}`,
        targetItemId: item.id
      }),
      promptSurface: item.surface,
      targetRtMs: item.targetRtMs,
      trialId: `katakana-speed-${input.seed}-${index}-${item.id}`
    };

    if (trial.confusionClusterId) {
      const cluster = getKatakanaSpeedConfusionClusterById(
        trial.confusionClusterId
      );
      if (!cluster?.itemIds.includes(item.id)) {
        return {
          ...trial,
          confusionClusterId: undefined
        };
      }
    }

    return trial;
  });
}

function generateExpandedKatakanaSpeedSessionPlan(input: {
  count: number;
  now: Date | string;
  seed: string;
  sessionMode: KatakanaSpeedSessionMode;
  state: KatakanaSpeedState;
}): KatakanaSpeedTrialPlan[] {
  const count = Math.max(0, input.count);
  const rankedItems = rankItems({
    now: input.now,
    seed: input.seed,
    state: input.state
  });
  const pools = createExpandedPools(rankedItems, input.state);
  const rareCap =
    input.sessionMode === "pseudoword_transfer"
      ? count
      : input.sessionMode === "rare_combo"
        ? Math.floor(count * 0.25)
        : Math.floor(count * 0.1);
  const roles = rolesForSessionMode(input.sessionMode);
  const roleIndexes = new Map<ExpandedRole, number>();
  const trials: KatakanaSpeedTrialPlan[] = [];
  let rareCount = 0;
  let previousItemId: string | null = null;

  for (let index = 0; index < count; index += 1) {
    const role = roles[index % roles.length];
    const mode = trialModeForRole(role, index);
    const item = selectItemForRole({
      avoidItemIds: previousItemId ? new Set([previousItemId]) : new Set(),
      allowRare:
        role === "rare_shock" ||
        (input.sessionMode === "pseudoword_transfer" &&
          role === "pseudoword_transfer"),
      pools,
      rareCap,
      rareCount,
      role,
      roleIndexes
    });

    if (item.rarity === "rare") {
      rareCount += 1;
    }
    previousItemId = item.id;

    trials.push(
      buildExpandedTrial({
        index,
        item,
        mode,
        role,
        seed: input.seed,
        sessionMode: input.sessionMode
      })
    );
  }

  return trials;
}

function rankItems(input: {
  now: Date | string;
  seed: string;
  state: KatakanaSpeedState;
}) {
  return stableShuffle(
    getKatakanaSpeedCatalog(),
    `${input.seed}:expanded-tie`
  ).sort(
    (left, right) =>
      computeKatakanaSpeedPriority({
        itemId: right.id,
        now: input.now,
        state: input.state
      }) -
      computeKatakanaSpeedPriority({
        itemId: left.id,
        now: input.now,
        state: input.state
      })
  );
}

function createExpandedPools(
  rankedItems: readonly KatakanaSpeedItem[],
  state: KatakanaSpeedState
) {
  const nonRare = rankedItems.filter((item) => item.rarity !== "rare");
  const weakItems = nonRare.filter((item) => {
    const itemState = state.items[item.id];

    return Boolean(
      itemState &&
      (itemState.lapses > 0 ||
        itemState.slowStreak > 0 ||
        itemState.lastErrorTags.length > 0)
    );
  });
  const easyReview = nonRare
    .filter((item) => {
      const itemState = state.items[item.id];

      return (
        itemState?.status === "review" || (itemState?.correctStreak ?? 0) > 0
      );
    })
    .reverse();

  return {
    confusion: nonRare.filter((item) => item.confusionClusterIds.length > 0),
    easyReview: easyReview.length > 0 ? easyReview : [...nonRare].reverse(),
    nonRare,
    pseudoword: rankedItems.filter(isKatakanaSpeedTargetablePseudowordItem),
    ran: nonRare.filter(
      (item) => item.kind === "single_kana" || item.kind === "core_mora"
    ),
    rare: rankedItems.filter((item) => item.rarity === "rare"),
    sentence: nonRare.filter((item) => item.kind === "sentence"),
    diagnostic: interleavePools([
      nonRare.filter((item) => item.kind === "single_kana"),
      nonRare.filter((item) => item.kind === "extended_chunk"),
      nonRare.filter((item) => item.kind === "word"),
      rankedItems.filter(isKatakanaSpeedTargetablePseudowordItem),
      nonRare.filter((item) => item.kind === "sentence")
    ]),
    weakItems: weakItems.length > 0 ? weakItems : nonRare,
    word: nonRare.filter((item) => item.kind === "word")
  };
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

function rolesForSessionMode(
  sessionMode: KatakanaSpeedSessionMode
): readonly ExpandedRole[] {
  if (sessionMode === "rare_combo") {
    return [
      "rare_shock",
      "confusion_repair",
      "word_transfer",
      "pseudoword_transfer"
    ];
  }
  if (sessionMode === "pseudoword_transfer") {
    return ["pseudoword_transfer", "weak_item", "confusion_repair"];
  }
  if (sessionMode === "sentence_sprint") {
    return ["sentence_transfer", "word_transfer", "weak_item"];
  }
  if (sessionMode === "repeated_reading") {
    return ["repeated_reading", "sentence_transfer", "easy_review"];
  }
  if (sessionMode === "ran_grid") {
    return ["ran_grid", "confusion_repair", "easy_review"];
  }
  if (sessionMode === "diagnostic_probe") {
    return ["diagnostic_probe"];
  }
  if (sessionMode === "mora_trap") {
    return ["mora_trap", "pair_race", "same_different"];
  }
  if (sessionMode === "chunk_spotting") {
    return ["chunk_spotting", "word_transfer", "confusion_set"];
  }
  if (sessionMode === "loanword_decoder") {
    return ["loanword_decoder", "word_transfer", "tile_builder"];
  }
  if (sessionMode === "tile_builder") {
    return ["tile_builder", "chunk_spotting", "word_transfer"];
  }
  if (sessionMode === "confusion_ladder") {
    return ["confusion_ladder", "confusion_set", "minimal_pair_drill"];
  }
  if (sessionMode === "variant_normalization") {
    return ["variant_normalization", "mora_trap", "word_transfer"];
  }

  return [
    "blink_recognition",
    "minimal_pair_drill",
    "confusion_set",
    "same_different",
    "tile_builder",
    "chunk_spotting",
    "loanword_decoder",
    "pseudoword_transfer",
    "mora_trap",
    "pair_race",
    "variant_normalization",
    "repair_block",
    "weak_item",
    "confusion_repair",
    "word_transfer",
    "sentence_transfer",
    "rare_shock",
    "easy_review"
  ];
}

function trialModeForRole(
  role: ExpandedRole,
  index: number
): KatakanaSpeedTrialMode {
  if (
    role === "same_different" ||
    role === "mora_trap" ||
    role === "pair_race" ||
    role === "variant_normalization" ||
    role === "confusion_ladder" ||
    role === "tile_builder" ||
    role === "chunk_spotting"
  ) {
    return "minimal_pair";
  }
  if (role === "loanword_decoder") {
    return "word_naming";
  }
  if (role === "blink_recognition") {
    return "blink";
  }
  if (role === "word_transfer") {
    return "word_naming";
  }
  if (role === "pseudoword_transfer") {
    return "pseudoword_sprint";
  }
  if (role === "sentence_transfer") {
    return "sentence_sprint";
  }
  if (role === "repeated_reading") {
    return "repeated_reading_pass";
  }
  if (role === "ran_grid") {
    return "ran_grid";
  }
  if (role === "confusion_repair") {
    return "blink";
  }

  return index % 2 === 0 ? "minimal_pair" : "blink";
}

function selectItemForRole(input: {
  avoidItemIds: ReadonlySet<string>;
  allowRare: boolean;
  pools: ReturnType<typeof createExpandedPools>;
  rareCap: number;
  rareCount: number;
  role: ExpandedRole;
  roleIndexes: Map<ExpandedRole, number>;
}) {
  const pool = poolForRole(input.role, input.pools);
  const rareAllowed = input.allowRare && input.rareCount < input.rareCap;
  const eligiblePool = rareAllowed
    ? pool
    : pool.filter((item) => item.rarity !== "rare");
  const fallbackPool =
    input.pools.nonRare.length > 0 ? input.pools.nonRare : pool;
  const finalPool = eligiblePool.length > 0 ? eligiblePool : fallbackPool;
  const nextIndex = input.roleIndexes.get(input.role) ?? 0;

  for (let offset = 0; offset < finalPool.length; offset += 1) {
    const candidate = finalPool[(nextIndex + offset) % finalPool.length];
    if (candidate && !input.avoidItemIds.has(candidate.id)) {
      input.roleIndexes.set(input.role, nextIndex + offset + 1);
      return candidate;
    }
  }

  input.roleIndexes.set(input.role, nextIndex + 1);
  return (
    finalPool[nextIndex % finalPool.length] ?? getKatakanaSpeedCatalog()[0]
  );
}

function poolForRole(
  role: ExpandedRole,
  pools: ReturnType<typeof createExpandedPools>
) {
  if (role === "weak_item") {
    return pools.weakItems;
  }
  if (
    role === "blink_recognition" ||
    role === "minimal_pair_drill" ||
    role === "confusion_set" ||
    role === "confusion_ladder" ||
    role === "repair_block"
  ) {
    return pools.confusion;
  }
  if (
    role === "same_different" ||
    role === "mora_trap" ||
    role === "pair_race" ||
    role === "variant_normalization" ||
    role === "tile_builder" ||
    role === "chunk_spotting" ||
    role === "loanword_decoder"
  ) {
    return pools.word;
  }
  if (role === "diagnostic_probe") {
    return pools.diagnostic;
  }
  if (role === "confusion_repair") {
    return pools.confusion;
  }
  if (role === "word_transfer") {
    return pools.word;
  }
  if (role === "pseudoword_transfer") {
    return pools.pseudoword;
  }
  if (role === "sentence_transfer" || role === "repeated_reading") {
    return pools.sentence;
  }
  if (role === "ran_grid") {
    return pools.ran;
  }
  if (role === "rare_shock") {
    return pools.rare;
  }

  return pools.easyReview;
}

function buildExpandedTrial(input: {
  index: number;
  item: KatakanaSpeedItem;
  mode: KatakanaSpeedTrialMode;
  role: ExpandedRole;
  seed: string;
  sessionMode: KatakanaSpeedSessionMode;
}): KatakanaSpeedTrialPlan {
  const confusionClusterId = input.item.confusionClusterIds[0];
  const optionCount =
    input.mode === "minimal_pair" ? 4 : input.mode === "blink" ? 2 : 1;
  const blockId = `${input.sessionMode}-${blockNumberForRole(input.role)}-${input.role}`;
  const features = {
    exerciseCode: exerciseCodeForRole(input.role),
    hardMode: true,
    interaction: interactionForRole(input.role),
    moraCount: input.item.moraCount,
    tier: input.item.tier,
    wasRare: input.item.rarity === "rare"
  };
  const operationalTrial = buildOperationalTrial(input, features);
  if (operationalTrial) {
    return operationalTrial;
  }
  const trial: KatakanaSpeedTrialPlan = {
    blockId,
    ...(confusionClusterId ? { confusionClusterId } : {}),
    correctItemId: input.item.id,
    exerciseId: `katakana-speed-${input.sessionMode}`,
    ...(input.mode === "blink" ? { exposureMs: 450 } : {}),
    features,
    focusChunks: input.item.focusChunks,
    itemId: input.item.id,
    itemType: input.item.kind,
    metadataRole: input.role,
    metrics: metricsForTrial(input.item, input.mode),
    mode: input.mode,
    optionItemIds:
      optionCount > 1
        ? generateKatakanaSpeedOptions({
            count: optionCount,
            seed: `${input.seed}:${input.index}:${input.item.id}:expanded`,
            targetItemId: input.item.id
          })
        : [input.item.id],
    promptSurface: input.item.surface,
    rarity: input.item.rarity,
    targetRtMs: input.item.targetRtMs,
    trialId: `katakana-speed-${input.seed}-${input.sessionMode}-${input.index}-${input.item.id}`,
    ...(input.item.isPseudo || input.mode === "pseudoword_sprint"
      ? { wasPseudo: true }
      : {}),
    ...(input.role === "confusion_repair" ? { wasRepair: true } : {}),
    ...(isTransferRole(input.role) ? { wasTransfer: true } : {})
  };

  if (trial.confusionClusterId) {
    const cluster = getKatakanaSpeedConfusionClusterById(
      trial.confusionClusterId
    );
    if (!cluster?.itemIds.includes(input.item.id)) {
      return {
        ...trial,
        confusionClusterId: undefined
      };
    }
  }

  return trial;
}

function buildOperationalTrial(
  input: {
    index: number;
    item: KatakanaSpeedItem;
    mode: KatakanaSpeedTrialMode;
    role: ExpandedRole;
    seed: string;
    sessionMode: KatakanaSpeedSessionMode;
  },
  baseFeatures: Readonly<Record<string, unknown>>
): KatakanaSpeedTrialPlan | null {
  if (input.role === "diagnostic_probe") {
    const mode =
      input.item.kind === "word" ||
      input.item.kind === "pseudoword" ||
      input.item.kind === "sentence"
        ? input.item.kind === "word"
          ? "word_naming"
          : input.item.kind === "pseudoword"
            ? "pseudoword_sprint"
            : "sentence_sprint"
        : input.index % 2 === 0
          ? "minimal_pair"
          : "blink";

    return buildItemTrial(input, {
      exerciseCode: "E01",
      interaction:
        mode === "minimal_pair" || mode === "blink" ? "choice" : "self_check",
      item: input.item,
      mode,
      optionCount: mode === "blink" ? 2 : mode === "minimal_pair" ? 4 : 1,
      role: input.role,
      wasTransfer: input.item.kind !== "single_kana"
    });
  }

  if (input.role === "blink_recognition") {
    return buildItemTrial(input, {
      exerciseCode: "E02",
      exposureMs: blinkExposureMs(input.index),
      interaction: "choice",
      item: input.item,
      mode: "blink",
      optionCount: 2,
      role: input.role
    });
  }

  if (input.role === "minimal_pair_drill") {
    return buildItemTrial(input, {
      exerciseCode: "E03",
      interaction: "choice",
      item: input.item,
      mode: "minimal_pair",
      optionCount: 2,
      role: input.role
    });
  }

  if (input.role === "confusion_set") {
    return buildItemTrial(input, {
      exerciseCode: "E04",
      interaction: "choice",
      item: input.item,
      mode: "minimal_pair",
      optionCount: 4,
      role: input.role,
      wasRepair: input.sessionMode === "daily"
    });
  }

  if (input.role === "same_different") {
    const pair = sameDifferentPair(input.index);
    return buildRawChoiceTrial(input, {
      correctSurface: pair.same ? "同じ" : "違う",
      exerciseCode: "E05",
      features: {
        firstSurface: pair.firstSurface,
        interaction: "raw_choice",
        secondSurface: pair.secondSurface,
        same: pair.same
      },
      focusChunks: pair.focusChunks,
      item: itemForSurface(pair.firstSurface) ?? input.item,
      optionSurfaces: ["同じ", "違う"],
      promptSurface: `${pair.firstSurface} / ${pair.secondSurface}`,
      targetRtMs: 1200
    });
  }

  if (input.role === "tile_builder") {
    const item = wordItemForOperationalIndex(input.index, input.item);
    const tiles = stableShuffle(
      tokenizeKatakanaDisplaySegments(item.surface),
      `${input.seed}:tile:${input.index}:${item.id}`
    );

    return {
      blockId: `${input.sessionMode}-${blockNumberForRole(input.role)}-${input.role}`,
      correctItemId: item.id,
      exerciseId: `katakana-speed-${input.sessionMode}`,
      expectedSurface: item.surface,
      features: {
        ...baseFeatures,
        exerciseCode: "E08",
        hardMode: true,
        interaction: "tile_builder",
        tiles
      },
      focusChunks: item.focusChunks,
      itemId: item.id,
      itemType: "scrambled_loanword",
      metadataRole: input.role,
      metrics: {
        tileCount: tiles.length,
        targetRtMs: Math.max(item.targetRtMs, 2600)
      },
      mode: "minimal_pair",
      optionItemIds: [],
      promptSurface: item.surface,
      rarity: item.rarity,
      targetRtMs: Math.max(item.targetRtMs, 2600),
      trialId: `katakana-speed-${input.seed}-${input.sessionMode}-${input.index}-${input.role}-${item.id}`,
      wasTransfer: true
    };
  }

  if (input.role === "chunk_spotting") {
    const target = itemAt(getKatakanaSpeedChunkSpottingTargets(), input.index);
    const item = itemForSurface(target.wordSurface) ?? input.item;

    return buildRawChoiceTrial(input, {
      correctSurface: target.chunk,
      exerciseCode: "E09",
      features: {
        chunk: target.chunk,
        interaction: "segment_select",
        spottingId: target.id
      },
      focusChunks: [target.chunk],
      item,
      optionSurfaces: tokenizeKatakanaDisplaySegments(target.wordSurface),
      promptSurface: target.wordSurface,
      targetRtMs: 1400
    });
  }

  if (input.role === "loanword_decoder") {
    const item = wordItemForOperationalIndex(input.index, input.item);
    return buildItemTrial(input, {
      exerciseCode: "E11",
      interaction: "self_check",
      item,
      mode: "word_naming",
      optionCount: 1,
      role: input.role,
      wasTransfer: true
    });
  }

  if (input.role === "mora_trap" || input.role === "pair_race") {
    const pair = itemAt(getKatakanaSpeedMoraTrapPairs(), input.index);
    const item = itemForSurface(pair.correctSurface) ?? input.item;
    const options = stableShuffle(
      [pair.correctSurface, pair.trapSurface],
      `${input.seed}:${input.role}:${pair.id}`
    );

    return buildRawChoiceTrial(input, {
      correctSurface: pair.correctSurface,
      exerciseCode: input.role === "pair_race" ? "E16" : "E15",
      features: {
        feature: pair.feature,
        interaction: "raw_choice",
        pairId: pair.id,
        trapSurface: pair.trapSurface
      },
      focusChunks: pair.focusChunks,
      item,
      optionSurfaces: options,
      promptSurface:
        formatKatakanaSpeedReading(pair.correctSurface) ?? pair.correctSurface,
      targetRtMs: input.role === "pair_race" ? 1500 : 1800,
      wasRepair: input.sessionMode === "daily"
    });
  }

  if (input.role === "variant_normalization") {
    const pair = itemAt(getKatakanaSpeedVariantPairs(), input.index);
    const item =
      itemForSurface(pair.secondSurface) ??
      itemForSurface(pair.firstSurface) ??
      input.item;

    return buildRawChoiceTrial(input, {
      correctSurface: "stessa variante",
      exerciseCode: "E17",
      features: {
        firstSurface: pair.firstSurface,
        interaction: "raw_choice",
        secondSurface: pair.secondSurface,
        variantId: pair.id
      },
      focusChunks: pair.focusChunks,
      item,
      optionSurfaces: ["stessa variante", "forma diversa"],
      promptSurface: `${pair.firstSurface} / ${pair.secondSurface}`,
      targetRtMs: 1900
    });
  }

  if (input.role === "confusion_ladder") {
    const ladder = itemAt(getKatakanaSpeedLadderDefinitions(), input.index);
    const item = itemForSurface(ladder.targetSurface) ?? input.item;

    return buildRawChoiceTrial(input, {
      correctSurface: ladder.targetSurface,
      exerciseCode: "E14",
      features: {
        interaction: "raw_choice",
        ladderId: ladder.id,
        rows: ladder.rows
      },
      focusChunks: [ladder.targetSurface],
      item,
      optionSurfaces: ladder.rows,
      promptSurface: `Tocca ${ladder.targetSurface}`,
      targetRtMs: 1600,
      wasRepair: true
    });
  }

  if (input.role === "repair_block") {
    return buildItemTrial(input, {
      exerciseCode: "E20",
      interaction: "choice",
      item: input.item,
      mode: input.index % 2 === 0 ? "minimal_pair" : "blink",
      optionCount: input.index % 2 === 0 ? 4 : 2,
      role: input.role,
      wasRepair: true
    });
  }

  return null;
}

function buildItemTrial(
  input: {
    index: number;
    item: KatakanaSpeedItem;
    role: ExpandedRole;
    seed: string;
    sessionMode: KatakanaSpeedSessionMode;
  },
  options: {
    exerciseCode: string;
    exposureMs?: number;
    interaction: string;
    item: KatakanaSpeedItem;
    mode: KatakanaSpeedTrialMode;
    optionCount: number;
    role: ExpandedRole;
    wasRepair?: boolean;
    wasTransfer?: boolean;
  }
): KatakanaSpeedTrialPlan {
  const item = options.item;
  const optionItemIds =
    options.optionCount > 1
      ? generateKatakanaSpeedOptions({
          count: options.optionCount,
          seed: `${input.seed}:${input.index}:${item.id}:${options.exerciseCode}`,
          targetItemId: item.id
        })
      : [item.id];

  return {
    blockId: `${input.sessionMode}-${blockNumberForRole(input.role)}-${input.role}`,
    ...(item.confusionClusterIds[0]
      ? { confusionClusterId: item.confusionClusterIds[0] }
      : {}),
    correctItemId: item.id,
    exerciseId: `katakana-speed-${input.sessionMode}`,
    ...(options.exposureMs ? { exposureMs: options.exposureMs } : {}),
    expectedSurface: item.surface,
    features: {
      exerciseCode: options.exerciseCode,
      family: item.family,
      hardMode: true,
      interaction: options.interaction,
      kind: item.kind,
      moraCount: item.moraCount,
      rarity: item.rarity,
      tier: item.tier,
      wasRare: item.rarity === "rare"
    },
    focusChunks: item.focusChunks,
    itemId: item.id,
    itemType: item.kind,
    metadataRole: options.role,
    metrics: metricsForTrial(item, options.mode),
    mode: options.mode,
    optionItemIds,
    promptSurface: item.surface,
    rarity: item.rarity,
    targetRtMs: item.targetRtMs,
    trialId: `katakana-speed-${input.seed}-${input.sessionMode}-${input.index}-${input.role}-${item.id}`,
    ...(item.isPseudo || options.mode === "pseudoword_sprint"
      ? { wasPseudo: true }
      : {}),
    ...(options.wasRepair ? { wasRepair: true } : {}),
    ...(options.wasTransfer ? { wasTransfer: true } : {})
  };
}

function buildRawChoiceTrial(
  input: {
    index: number;
    role: ExpandedRole;
    seed: string;
    sessionMode: KatakanaSpeedSessionMode;
  },
  options: {
    correctSurface: string;
    exerciseCode: string;
    features: Readonly<Record<string, unknown>>;
    focusChunks: readonly string[];
    item: KatakanaSpeedItem;
    optionSurfaces: readonly string[];
    promptSurface: string;
    targetRtMs: number;
    wasRepair?: boolean;
  }
): KatakanaSpeedTrialPlan {
  const encodedOptions = options.optionSurfaces.map(
    encodeKatakanaSpeedRawOption
  );

  return {
    blockId: `${input.sessionMode}-${blockNumberForRole(input.role)}-${input.role}`,
    correctItemId: options.item.id,
    exerciseId: `katakana-speed-${input.sessionMode}`,
    expectedSurface: options.correctSurface,
    features: {
      ...options.features,
      exerciseCode: options.exerciseCode,
      hardMode: true
    },
    focusChunks: options.focusChunks,
    itemId: options.item.id,
    itemType: String(options.features.interaction ?? "raw_choice"),
    metadataRole: input.role,
    metrics: {
      optionCount: options.optionSurfaces.length,
      targetRtMs: options.targetRtMs
    },
    mode: "minimal_pair",
    optionItemIds: encodedOptions,
    promptSurface: options.promptSurface,
    rarity: options.item.rarity,
    targetRtMs: options.targetRtMs,
    trialId: `katakana-speed-${input.seed}-${input.sessionMode}-${input.index}-${input.role}-${options.item.id}`,
    ...(options.wasRepair ? { wasRepair: true } : {})
  };
}

function itemAt<T>(items: readonly T[], index: number): T {
  const item = items[index % Math.max(1, items.length)];
  if (item === undefined) {
    throw new Error("Katakana Speed operational catalog is empty.");
  }

  return item;
}

function itemForSurface(surface: string) {
  return getKatakanaSpeedItemBySurface(surface);
}

function wordItemForOperationalIndex(
  index: number,
  fallback: KatakanaSpeedItem
) {
  const words = getKatakanaSpeedCatalog().filter(
    (item) => item.kind === "word"
  );
  return words[index % Math.max(1, words.length)] ?? fallback;
}

function sameDifferentPair(index: number) {
  const trap = itemAt(getKatakanaSpeedMoraTrapPairs(), index);
  if (index % 3 === 0) {
    return {
      firstSurface: trap.correctSurface,
      focusChunks: trap.focusChunks,
      same: true,
      secondSurface: trap.correctSurface
    };
  }

  return {
    firstSurface: trap.correctSurface,
    focusChunks: trap.focusChunks,
    same: false,
    secondSurface: trap.trapSurface
  };
}

function blinkExposureMs(index: number) {
  return [1000, 700, 500, 350, 250][index % 5] ?? 450;
}

function blockNumberForRole(role: ExpandedRole) {
  const blockOrder: Record<ExpandedRole, number> = {
    blink_recognition: 1,
    chunk_spotting: 5,
    confusion_repair: 2,
    confusion_ladder: 6,
    confusion_set: 3,
    diagnostic_probe: 1,
    easy_review: 7,
    loanword_decoder: 6,
    minimal_pair_drill: 2,
    mora_trap: 8,
    pair_race: 9,
    pseudoword_transfer: 4,
    ran_grid: 6,
    rare_shock: 8,
    repair_block: 10,
    repeated_reading: 5,
    sentence_transfer: 5,
    same_different: 4,
    tile_builder: 5,
    variant_normalization: 9,
    weak_item: 1,
    word_transfer: 3
  };

  return String(blockOrder[role]).padStart(2, "0");
}

function metricsForTrial(
  item: KatakanaSpeedItem,
  mode: KatakanaSpeedTrialMode
): Readonly<Record<string, number | string | boolean>> {
  if (mode === "ran_grid") {
    return { targetItemsPerSecond: 1.8 };
  }
  if (mode === "sentence_sprint" || mode === "repeated_reading_pass") {
    return {
      targetMsPerMora: Math.round(item.targetRtMs / Math.max(1, item.moraCount))
    };
  }
  if (mode === "pseudoword_sprint") {
    return {
      targetRtPerMora: Math.round(item.targetRtMs / Math.max(1, item.moraCount))
    };
  }

  return { targetRtMs: item.targetRtMs };
}

function isTransferRole(role: ExpandedRole) {
  return (
    role === "word_transfer" ||
    role === "sentence_transfer" ||
    role === "pseudoword_transfer" ||
    role === "repeated_reading"
  );
}

function exerciseCodeForRole(role: ExpandedRole) {
  const exerciseCodes: Partial<Record<ExpandedRole, string>> = {
    blink_recognition: "E02",
    chunk_spotting: "E09",
    confusion_ladder: "E14",
    confusion_repair: "E20",
    confusion_set: "E04",
    diagnostic_probe: "E01",
    loanword_decoder: "E11",
    minimal_pair_drill: "E03",
    mora_trap: "E15",
    pair_race: "E16",
    pseudoword_transfer: "E12",
    ran_grid: "E13",
    repair_block: "E20",
    repeated_reading: "E18",
    same_different: "E05",
    sentence_transfer: "E18",
    tile_builder: "E08",
    variant_normalization: "E17",
    word_transfer: "E10"
  };

  return exerciseCodes[role] ?? "E21";
}

function interactionForRole(role: ExpandedRole) {
  if (
    role === "same_different" ||
    role === "mora_trap" ||
    role === "pair_race" ||
    role === "variant_normalization" ||
    role === "confusion_ladder"
  ) {
    return "raw_choice";
  }
  if (role === "tile_builder") {
    return "tile_builder";
  }
  if (role === "chunk_spotting") {
    return "segment_select";
  }
  if (
    role === "word_transfer" ||
    role === "sentence_transfer" ||
    role === "pseudoword_transfer" ||
    role === "loanword_decoder" ||
    role === "repeated_reading"
  ) {
    return "self_check";
  }
  if (role === "ran_grid") {
    return "aggregate";
  }

  return "choice";
}
