import type {
  KatakanaSpeedErrorTag,
  KatakanaSpeedSelfRating,
  KatakanaSpeedSessionMode,
  KatakanaSpeedTrialMode
} from "../types.ts";
import {
  getKatakanaSpeedCatalog,
  getKatakanaSpeedItemById
} from "./catalog.ts";

export type KatakanaSpeedAnalyticsAttempt = {
  readonly errorTags: readonly KatakanaSpeedErrorTag[];
  readonly expectedSurface: string;
  readonly features: Readonly<Record<string, unknown>>;
  readonly focusChunks: readonly string[];
  readonly isCorrect: boolean;
  readonly itemId: string;
  readonly itemType: string | null;
  readonly metrics: Readonly<Record<string, unknown>>;
  readonly mode: KatakanaSpeedTrialMode | string;
  readonly promptSurface: string;
  readonly responseMs: number;
  readonly selfRating: KatakanaSpeedSelfRating | null;
  readonly targetRtMs: number | null;
  readonly userAnswer: string;
  readonly wasPseudo: boolean;
  readonly wasRepair: boolean;
  readonly wasTransfer: boolean;
};

export type KatakanaSpeedAnalyticsExerciseResult = {
  readonly metrics: Readonly<Record<string, unknown>>;
  readonly selfRating: KatakanaSpeedSelfRating | null;
};

export type KatakanaSpeedAnalyticsItemState = {
  readonly bestRtMs: number | null;
  readonly correctCount: number;
  readonly itemId: string;
  readonly lastResponseMs: number | null;
  readonly recentResponseMs: readonly number[];
  readonly reps: number;
  readonly slowCorrectCount: number;
  readonly status: string;
  readonly wrongCount: number;
};

export type KatakanaSpeedAnalyticsConfusionEdge = {
  readonly confusionCount: number;
  readonly expectedItemId: string;
  readonly metrics: Readonly<Record<string, unknown>>;
  readonly observedItemId: string;
};

export type KatakanaSpeedModeMetric = {
  readonly accuracyPercent: number | null;
  readonly attempts: number;
};

export type KatakanaSpeedPseudoTransferMetric = {
  readonly attempts: number;
  readonly medianMsPerMora: number | null;
  readonly status: "blocked" | "developing" | "transfer_ready";
  readonly transferReadyPercent: number | null;
};

export type KatakanaSpeedSentenceFlowMetric = {
  readonly attempts: number;
  readonly fluentPercent: number | null;
  readonly medianMsPerMora: number | null;
  readonly status: "fluent" | "steady" | "slow";
};

export type KatakanaSpeedRanWrongCell = {
  readonly column: number;
  readonly index: number;
  readonly itemId: string;
  readonly row: number;
  readonly surface: string;
};

export type KatakanaSpeedRanMetric = {
  readonly adjustedItemsPerSecond: number | null;
  readonly cellSurfaces: readonly string[];
  readonly columns: number | null;
  readonly errorRate: number | null;
  readonly errors: number | null;
  readonly itemsPerSecond: number;
  readonly rows: number | null;
  readonly totalItems: number | null;
  readonly wrongCellIndexes: readonly number[];
  readonly wrongCells: readonly KatakanaSpeedRanWrongCell[];
};

export type KatakanaSpeedConfusionSummary = {
  readonly avgRtMs: number;
  readonly count: number;
  readonly expectedSurface: string;
  readonly observedSurface: string;
  readonly severity: number;
};

export type KatakanaSpeedSlowItemSummary = {
  readonly count: number;
  readonly family: string;
  readonly itemId: string;
  readonly medianRtMs: number;
  readonly rarity: string;
  readonly surface: string;
  readonly tier: string;
};

export type KatakanaSpeedFamilyCard = {
  readonly accuracyPercent: number | null;
  readonly attempts: number;
  readonly family: string;
  readonly focusSurfaces: readonly string[];
  readonly label: string;
  readonly medianRtMs: number | null;
  readonly status: "new" | "repair" | "stable" | "watch";
};

export type KatakanaSpeedRecommendedMode = {
  readonly detail: string;
  readonly label: string;
  readonly mode: KatakanaSpeedSessionMode;
};

export type KatakanaSpeedAnalytics = {
  readonly familyCards: readonly KatakanaSpeedFamilyCard[];
  readonly modeMetrics: {
    readonly pseudoTransfer: KatakanaSpeedPseudoTransferMetric | null;
    readonly ranItemsPerSecond: KatakanaSpeedRanMetric | null;
    readonly rareAccuracy: KatakanaSpeedModeMetric | null;
    readonly sentenceFlow: KatakanaSpeedSentenceFlowMetric | null;
  };
  readonly overview: {
    readonly accuracyPercent: number | null;
    readonly fluentCorrectPercent: number | null;
    readonly medianRtMs: number | null;
    readonly p90RtMs: number | null;
    readonly totalAttempts: number;
  };
  readonly recommendedMode: KatakanaSpeedRecommendedMode;
  readonly topConfusions: readonly KatakanaSpeedConfusionSummary[];
  readonly topSlowItems: readonly KatakanaSpeedSlowItemSummary[];
};

export function buildKatakanaSpeedAnalytics(input: {
  readonly attempts: readonly KatakanaSpeedAnalyticsAttempt[];
  readonly confusionEdges?: readonly KatakanaSpeedAnalyticsConfusionEdge[];
  readonly exerciseResults: readonly KatakanaSpeedAnalyticsExerciseResult[];
  readonly itemStates: readonly KatakanaSpeedAnalyticsItemState[];
}): KatakanaSpeedAnalytics {
  const attempts = input.attempts;
  const topSlowItems = buildTopSlowItems(attempts);
  const topConfusions = buildTopConfusions(
    attempts,
    input.confusionEdges ?? []
  );
  const modeMetrics = {
    pseudoTransfer: buildPseudoTransferMetric(attempts),
    ranItemsPerSecond: buildRanMetric(input.exerciseResults),
    rareAccuracy: buildRareAccuracyMetric(attempts),
    sentenceFlow: buildSentenceFlowMetric(attempts)
  };
  const analytics = {
    familyCards: buildFamilyCards(attempts, input.itemStates),
    modeMetrics,
    overview: buildOverview(attempts),
    recommendedMode: recommendMode({
      modeMetrics,
      topConfusions,
      topSlowItems
    }),
    topConfusions,
    topSlowItems
  };

  return analytics;
}

function buildOverview(attempts: readonly KatakanaSpeedAnalyticsAttempt[]) {
  const responseTimes = attempts.map((attempt) => attempt.responseMs);
  const correctAttempts = attempts.filter((attempt) => attempt.isCorrect);
  const fluentCorrect = correctAttempts.filter(
    (attempt) => !isSlowAttempt(attempt)
  );

  return {
    accuracyPercent: percent(correctAttempts.length, attempts.length),
    fluentCorrectPercent: percent(fluentCorrect.length, attempts.length),
    medianRtMs: median(responseTimes),
    p90RtMs: percentile(responseTimes, 0.9),
    totalAttempts: attempts.length
  };
}

function buildRareAccuracyMetric(
  attempts: readonly KatakanaSpeedAnalyticsAttempt[]
): KatakanaSpeedModeMetric | null {
  const rareAttempts = attempts.filter(isRareAttempt);
  if (rareAttempts.length === 0) {
    return null;
  }

  return {
    accuracyPercent: percent(
      rareAttempts.filter((attempt) => attempt.isCorrect).length,
      rareAttempts.length
    ),
    attempts: rareAttempts.length
  };
}

function buildPseudoTransferMetric(
  attempts: readonly KatakanaSpeedAnalyticsAttempt[]
): KatakanaSpeedPseudoTransferMetric | null {
  const pseudoAttempts = attempts.filter(
    (attempt) => attempt.wasPseudo || attempt.mode === "pseudoword_sprint"
  );
  if (pseudoAttempts.length === 0) {
    return null;
  }

  const msPerMoraValues = pseudoAttempts.flatMap((attempt) => {
    const msPerMora = getMsPerMora(attempt);
    return msPerMora === null ? [] : [msPerMora];
  });
  const transferReady = pseudoAttempts.filter((attempt) => {
    const msPerMora = getMsPerMora(attempt);
    return (
      attempt.isCorrect &&
      attempt.selfRating !== "wrong" &&
      msPerMora !== null &&
      msPerMora <= 450
    );
  }).length;
  const transferReadyPercent = percent(transferReady, pseudoAttempts.length);

  return {
    attempts: pseudoAttempts.length,
    medianMsPerMora: median(msPerMoraValues),
    status:
      (transferReadyPercent ?? 0) >= 80
        ? "transfer_ready"
        : (transferReadyPercent ?? 0) >= 50
          ? "developing"
          : "blocked",
    transferReadyPercent
  };
}

function buildSentenceFlowMetric(
  attempts: readonly KatakanaSpeedAnalyticsAttempt[]
): KatakanaSpeedSentenceFlowMetric | null {
  const sentenceAttempts = attempts.filter(
    (attempt) => attempt.mode === "sentence_sprint"
  );
  if (sentenceAttempts.length === 0) {
    return null;
  }

  const msPerMoraValues = sentenceAttempts.flatMap((attempt) => {
    const msPerMora = getMsPerMora(attempt);
    return msPerMora === null ? [] : [msPerMora];
  });
  const fluentCount = sentenceAttempts.filter((attempt) => {
    const msPerMora = getMsPerMora(attempt);
    return attempt.isCorrect && msPerMora !== null && msPerMora <= 280;
  }).length;
  const medianMsPerMora = median(msPerMoraValues);

  return {
    attempts: sentenceAttempts.length,
    fluentPercent: percent(fluentCount, sentenceAttempts.length),
    medianMsPerMora,
    status:
      medianMsPerMora !== null && medianMsPerMora <= 280
        ? "fluent"
        : medianMsPerMora !== null && medianMsPerMora <= 420
          ? "steady"
          : "slow"
  };
}

function buildRanMetric(
  results: readonly KatakanaSpeedAnalyticsExerciseResult[]
): KatakanaSpeedRanMetric | null {
  const result = [...results]
    .reverse()
    .find((candidate) => typeof candidate.metrics.itemsPerSecond === "number");
  if (!result) {
    return null;
  }

  return {
    adjustedItemsPerSecond: nullableNumber(
      result.metrics.adjustedItemsPerSecond
    ),
    cellSurfaces: parseStringArray(result.metrics.cellSurfaces),
    columns: nullableNumber(result.metrics.columns),
    errorRate: nullableNumber(result.metrics.errorRate),
    errors: nullableNumber(result.metrics.errors),
    itemsPerSecond: toFiniteNumber(result.metrics.itemsPerSecond, 0),
    rows: nullableNumber(result.metrics.rows),
    totalItems: nullableNumber(result.metrics.totalItems),
    wrongCellIndexes: parseNumberArray(result.metrics.wrongCellIndexes),
    wrongCells: parseRanWrongCells(result.metrics.wrongCells)
  };
}

function buildTopConfusions(
  attempts: readonly KatakanaSpeedAnalyticsAttempt[],
  edges: readonly KatakanaSpeedAnalyticsConfusionEdge[]
) {
  const counts = new Map<
    string,
    {
      count: number;
      expectedSurface: string;
      observedSurface: string;
      totalRtMs: number;
    }
  >();

  for (const attempt of attempts) {
    if (
      attempt.isCorrect ||
      !attempt.userAnswer ||
      isSelfRatingValue(attempt.userAnswer) ||
      attempt.userAnswer === attempt.expectedSurface
    ) {
      continue;
    }

    addConfusion(counts, {
      count: 1,
      expectedSurface: attempt.expectedSurface || attempt.promptSurface,
      observedSurface: attempt.userAnswer,
      responseMs: attempt.responseMs
    });
  }

  for (const edge of edges) {
    const expected = getKatakanaSpeedItemById(edge.expectedItemId);
    const observed = getKatakanaSpeedItemById(edge.observedItemId);
    if (!expected || !observed) {
      continue;
    }

    const key = confusionKey(expected.surface, observed.surface);
    if (counts.has(key)) {
      continue;
    }

    addConfusion(counts, {
      count: Math.max(1, edge.confusionCount),
      expectedSurface: expected.surface,
      observedSurface: observed.surface,
      responseMs: nullableNumber(edge.metrics.responseMs) ?? 0
    });
  }

  const maxCount = Math.max(
    1,
    ...[...counts.values()].map((entry) => entry.count)
  );

  return [...counts.values()]
    .map((entry) => {
      const avgRtMs = Math.round(entry.totalRtMs / Math.max(1, entry.count));
      return {
        avgRtMs,
        count: entry.count,
        expectedSurface: entry.expectedSurface,
        observedSurface: entry.observedSurface,
        severity: roundTo(
          Math.min(
            1,
            (entry.count / maxCount) * 0.7 + Math.min(avgRtMs / 2000, 1) * 0.3
          ),
          2
        )
      };
    })
    .sort(
      (left, right) =>
        right.severity - left.severity ||
        right.count - left.count ||
        left.expectedSurface.localeCompare(right.expectedSurface)
    )
    .slice(0, 5);
}

function buildTopSlowItems(
  attempts: readonly KatakanaSpeedAnalyticsAttempt[]
): KatakanaSpeedSlowItemSummary[] {
  const groups = new Map<
    string,
    {
      family: string;
      itemId: string;
      rarity: string;
      responseTimes: number[];
      surface: string;
      tier: string;
    }
  >();

  for (const attempt of attempts) {
    if (!attempt.isCorrect || !isSlowAttempt(attempt)) {
      continue;
    }

    const item = getKatakanaSpeedItemById(attempt.itemId);
    const group = groups.get(attempt.itemId) ?? {
      family: item?.family ?? stringFeature(attempt.features.family) ?? "mixed",
      itemId: attempt.itemId,
      rarity: item?.rarity ?? stringFeature(attempt.features.rarity) ?? "core",
      responseTimes: [],
      surface:
        item?.surface ?? attempt.expectedSurface ?? attempt.promptSurface,
      tier: item?.tier ?? stringFeature(attempt.features.tier) ?? "A"
    };
    group.responseTimes.push(attempt.responseMs);
    groups.set(attempt.itemId, group);
  }

  return [...groups.values()]
    .map((group) => ({
      count: group.responseTimes.length,
      family: group.family,
      itemId: group.itemId,
      medianRtMs: median(group.responseTimes) ?? 0,
      rarity: group.rarity,
      surface: group.surface,
      tier: group.tier
    }))
    .sort(
      (left, right) =>
        right.count - left.count ||
        right.medianRtMs - left.medianRtMs ||
        left.surface.localeCompare(right.surface)
    )
    .slice(0, 5);
}

function buildFamilyCards(
  attempts: readonly KatakanaSpeedAnalyticsAttempt[],
  itemStates: readonly KatakanaSpeedAnalyticsItemState[]
): KatakanaSpeedFamilyCard[] {
  const groups = new Map<
    string,
    {
      attempts: number;
      correct: number;
      focusSurfaces: Set<string>;
      responseTimes: number[];
      slow: number;
    }
  >();

  for (const attempt of attempts) {
    const family = familyForAttempt(attempt);
    const group = groups.get(family) ?? createFamilyGroup();
    group.attempts += 1;
    group.correct += attempt.isCorrect ? 1 : 0;
    group.slow += isSlowAttempt(attempt) ? 1 : 0;
    group.responseTimes.push(attempt.responseMs);
    for (const surface of focusSurfacesForAttempt(attempt)) {
      group.focusSurfaces.add(surface);
    }
    groups.set(family, group);
  }

  for (const state of itemStates) {
    if (state.reps <= 0) {
      continue;
    }
    const item = getKatakanaSpeedItemById(state.itemId);
    const family = item?.family ?? "mixed";
    if (groups.has(family)) {
      continue;
    }

    const group = groups.get(family) ?? createFamilyGroup();
    group.attempts += state.reps;
    group.correct += state.correctCount;
    group.slow += state.slowCorrectCount;
    for (const responseMs of state.recentResponseMs) {
      group.responseTimes.push(responseMs);
    }
    if (state.lastResponseMs !== null) {
      group.responseTimes.push(state.lastResponseMs);
    }
    if (item) {
      group.focusSurfaces.add(item.surface);
    }
    groups.set(family, group);
  }

  const cards = [...groups.entries()]
    .map(([family, group]) => {
      const accuracyPercent = percent(group.correct, group.attempts);
      const slowPercent = percent(group.slow, group.attempts) ?? 0;
      const medianRtMs = median(group.responseTimes);
      return {
        accuracyPercent,
        attempts: group.attempts,
        family,
        focusSurfaces: [...group.focusSurfaces].slice(0, 4),
        label: labelForFamily(family),
        medianRtMs,
        status: familyStatus({
          accuracyPercent,
          attempts: group.attempts,
          medianRtMs,
          slowPercent
        })
      } satisfies KatakanaSpeedFamilyCard;
    })
    .sort(
      (left, right) =>
        familyStatusWeight(right.status) - familyStatusWeight(left.status) ||
        right.attempts - left.attempts ||
        left.label.localeCompare(right.label)
    )
    .slice(0, 6);

  return cards.length > 0 ? cards : fallbackFamilyCards();
}

function recommendMode(input: {
  modeMetrics: KatakanaSpeedAnalytics["modeMetrics"];
  topConfusions: readonly KatakanaSpeedConfusionSummary[];
  topSlowItems: readonly KatakanaSpeedSlowItemSummary[];
}): KatakanaSpeedRecommendedMode {
  const slowest =
    input.topSlowItems.find(
      (item) => item.rarity === "rare" || item.tier === "C"
    ) ?? input.topSlowItems[0];
  if (slowest) {
    return {
      detail: `Ripara ${slowest.surface}: corretta ma lenta`,
      label: "Ripara debolezza",
      mode: "repair"
    };
  }

  const confusion = input.topConfusions[0];
  if (confusion) {
    return {
      detail: `Ripara ${confusion.expectedSurface}/${confusion.observedSurface}`,
      label: "Ripara debolezza",
      mode: "repair"
    };
  }

  if (input.modeMetrics.pseudoTransfer?.status === "blocked") {
    return {
      detail: "transfer su pseudoparole sotto soglia",
      label: "Start 5 min",
      mode: "daily"
    };
  }
  if (
    input.modeMetrics.ranItemsPerSecond &&
    (input.modeMetrics.ranItemsPerSecond.adjustedItemsPerSecond ??
      input.modeMetrics.ranItemsPerSecond.itemsPerSecond) < 1.6
  ) {
    return {
      detail: "lettura griglia lenta",
      label: "Start 5 min",
      mode: "daily"
    };
  }

  return {
    detail: "sessione focalizzata consigliata",
    label: "Start 5 min",
    mode: "daily"
  };
}

function isRareAttempt(attempt: KatakanaSpeedAnalyticsAttempt) {
  const item = getKatakanaSpeedItemById(attempt.itemId);
  return (
    item?.rarity === "rare" ||
    item?.tier === "C" ||
    attempt.features.wasRare === true ||
    attempt.features.rarity === "rare" ||
    attempt.features.tier === "C"
  );
}

function isSlowAttempt(attempt: KatakanaSpeedAnalyticsAttempt) {
  return (
    attempt.errorTags.includes("slow_correct") ||
    attempt.selfRating === "hesitated" ||
    (attempt.targetRtMs !== null && attempt.responseMs > attempt.targetRtMs)
  );
}

function familyForAttempt(attempt: KatakanaSpeedAnalyticsAttempt) {
  const item = getKatakanaSpeedItemById(attempt.itemId);
  return item?.family ?? stringFeature(attempt.features.family) ?? "mixed";
}

function focusSurfacesForAttempt(attempt: KatakanaSpeedAnalyticsAttempt) {
  const surfaces = new Set<string>();
  for (const chunk of attempt.focusChunks) {
    surfaces.add(chunk);
  }
  if (surfaces.size === 0) {
    surfaces.add(attempt.expectedSurface || attempt.promptSurface);
  }
  return surfaces;
}

function getMsPerMora(attempt: KatakanaSpeedAnalyticsAttempt) {
  const metricValue =
    nullableNumber(attempt.metrics.msPerMora) ??
    nullableNumber(attempt.metrics.rtPerMora);
  if (metricValue !== null) {
    return Math.round(metricValue);
  }

  const moraCount =
    nullableNumber(attempt.features.moraCount) ??
    nullableNumber(attempt.metrics.moraCount);
  if (moraCount === null || moraCount <= 0) {
    return null;
  }

  return Math.round(attempt.responseMs / moraCount);
}

function addConfusion(
  counts: Map<
    string,
    {
      count: number;
      expectedSurface: string;
      observedSurface: string;
      totalRtMs: number;
    }
  >,
  input: {
    count: number;
    expectedSurface: string;
    observedSurface: string;
    responseMs: number;
  }
) {
  const key = confusionKey(input.expectedSurface, input.observedSurface);
  const current = counts.get(key) ?? {
    count: 0,
    expectedSurface: input.expectedSurface,
    observedSurface: input.observedSurface,
    totalRtMs: 0
  };
  current.count += input.count;
  current.totalRtMs += input.responseMs * input.count;
  counts.set(key, current);
}

function confusionKey(expectedSurface: string, observedSurface: string) {
  return `${expectedSurface}\u0000${observedSurface}`;
}

function createFamilyGroup() {
  return {
    attempts: 0,
    correct: 0,
    focusSurfaces: new Set<string>(),
    responseTimes: [] as number[],
    slow: 0
  };
}

function familyStatus(input: {
  accuracyPercent: number | null;
  attempts: number;
  medianRtMs: number | null;
  slowPercent: number;
}): KatakanaSpeedFamilyCard["status"] {
  if (input.attempts === 0) {
    return "new";
  }
  if ((input.accuracyPercent ?? 100) < 80 || input.slowPercent >= 35) {
    return "repair";
  }
  if ((input.accuracyPercent ?? 100) < 92 || input.slowPercent >= 15) {
    return "watch";
  }
  return "stable";
}

function familyStatusWeight(status: KatakanaSpeedFamilyCard["status"]) {
  if (status === "repair") {
    return 4;
  }
  if (status === "watch") {
    return 3;
  }
  if (status === "stable") {
    return 2;
  }
  return 1;
}

function fallbackFamilyCards(): KatakanaSpeedFamilyCard[] {
  const families = ["t-d", "f", "w", "v", "ts", "kw-gw"];
  return families.map((family) => ({
    accuracyPercent: null,
    attempts: 0,
    family,
    focusSurfaces: getKatakanaSpeedCatalog()
      .filter((item) => item.family === family)
      .slice(0, 3)
      .map((item) => item.surface),
    label: labelForFamily(family),
    medianRtMs: null,
    status: "new"
  }));
}

function labelForFamily(family: string) {
  const labels: Readonly<Record<string, string>> = {
    "c-tier": "Kana rari",
    f: "Famiglia F",
    "kw-gw": "KW/GW",
    "loanword-bank": "Prestiti",
    mixed: "Misto",
    "pseudo-bank": "Pseudo-parole",
    "sentence-sprint": "Frasi",
    "sibilant-e": "Sibilanti E",
    t: "Famiglia T",
    "t-d": "T/D",
    ts: "TS",
    v: "Famiglia V",
    "visual-dakuon-core": "Dakuon",
    "visual-no-me-nu": "ノ/メ/ヌ",
    "visual-shi-tsu-so-n": "シ/ツ/ソ/ン",
    w: "Famiglia W",
    "word-bank": "Parole"
  };

  return labels[family] ?? family;
}

function isSelfRatingValue(value: string) {
  return value === "clean" || value === "hesitated" || value === "wrong";
}

function stringFeature(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function parseNumberArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is number => Number.isFinite(item))
    : [];
}

function parseRanWrongCells(value: unknown): KatakanaSpeedRanWrongCell[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (entry === null || Array.isArray(entry) || typeof entry !== "object") {
      return [];
    }

    const record = entry as Record<string, unknown>;
    const index = nullableNumber(record.index);
    const row = nullableNumber(record.row);
    const column = nullableNumber(record.column);
    const itemId = stringFeature(record.itemId);
    const surface = stringFeature(record.surface);
    if (
      index === null ||
      row === null ||
      column === null ||
      itemId === null ||
      surface === null
    ) {
      return [];
    }

    return [
      {
        column,
        index,
        itemId,
        row,
        surface
      }
    ];
  });
}

function nullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toFiniteNumber(value: unknown, fallback: number) {
  return nullableNumber(value) ?? fallback;
}

function percent(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return null;
  }

  return Math.round((numerator / denominator) * 100);
}

function median(values: readonly number[]) {
  return percentile(values, 0.5);
}

function percentile(values: readonly number[], percentileValue: number) {
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
    return lower !== null && upper !== null
      ? Math.round((lower + upper) / 2)
      : null;
  }

  const index = Math.ceil(sorted.length * percentileValue) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))] ?? null;
}

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
