import { randomUUID } from "node:crypto";

import { db, type DatabaseClient } from "@/db";
import {
  getKatakanaAttemptLogByTrialId,
  getKatakanaExerciseBlockRow,
  getKatakanaExerciseResultRow,
  getKatakanaSessionRow,
  getKatakanaTrialRow,
  insertKatakanaAttemptLogIfAbsent,
  insertKatakanaConfusionEdgeIfAbsent,
  insertKatakanaExerciseBlocks,
  insertKatakanaExerciseResultIfAbsent,
  insertKatakanaSession,
  insertKatakanaTrials,
  listKatakanaAttemptLogsBySession,
  listKatakanaConfusionEdgeRowsBySession,
  listKatakanaExerciseResultRowsBySession,
  listKatakanaItemStateRows,
  listKatakanaTrialRowsByBlock,
  listKatakanaTrialRowsBySession,
  listRecentKatakanaSessionRows,
  updateKatakanaSessionRollup,
  updateKatakanaTrialAnswered,
  updateKatakanaTrialsAnsweredByBlock,
  upsertKatakanaItemState
} from "@/db/queries";
import {
  getKatakanaSpeedCatalog,
  getKatakanaSpeedItemById,
  getKatakanaSpeedItemBySurface
} from "../model/catalog";
import { isKatakanaSpeedTargetablePseudowordItem } from "../model/pseudoword-catalog";
import { scoreKatakanaSpeedRanGrid } from "../model/scoring";
import {
  buildKatakanaSpeedAnalytics,
  type KatakanaSpeedAnalytics,
  type KatakanaSpeedAnalyticsAttempt,
  type KatakanaSpeedAnalyticsConfusionEdge,
  type KatakanaSpeedAnalyticsExerciseResult,
  type KatakanaSpeedAnalyticsItemState
} from "../model/analytics";
import { classifyKatakanaSpeedError } from "../model/errors";
import {
  createInitialKatakanaSpeedState,
  generateKatakanaSpeedSessionPlan,
  stableShuffle
} from "../model";
import type {
  KatakanaSpeedErrorTag,
  KatakanaSpeedItem,
  KatakanaSpeedItemState,
  KatakanaSpeedSessionMode,
  KatakanaSpeedState,
  KatakanaSpeedTrialMode,
  KatakanaSpeedTrialPlan
} from "../types";

export type { KatakanaSpeedSessionMode } from "../types";

export type KatakanaSpeedSelfRating = "clean" | "hesitated" | "wrong";

export type StartKatakanaSpeedSessionResult = {
  readonly sessionId: string;
  readonly trials: readonly KatakanaSpeedTrialPlan[];
};

export type SubmitKatakanaSpeedAnswerResult = {
  readonly idempotent: boolean;
  readonly isCorrect: boolean;
  readonly errorTags: readonly KatakanaSpeedErrorTag[];
};

export type SubmitKatakanaSpeedSelfCheckResult = {
  readonly idempotent: boolean;
  readonly isCorrect: boolean;
  readonly selfRating: KatakanaSpeedSelfRating;
};

export type AggregateKatakanaSpeedExerciseResult = {
  readonly idempotent: boolean;
  readonly resultId: string;
};

export type KatakanaSpeedSessionRecap = {
  readonly correctAttempts: number;
  readonly durationMs: number | null;
  readonly medianRtMs: number | null;
  readonly p90RtMs: number | null;
  readonly slowCorrectCount: number;
  readonly status: "completed" | "abandoned";
  readonly totalAttempts: number;
};

type KatakanaSessionRow = NonNullable<
  Awaited<ReturnType<typeof getKatakanaSessionRow>>
>;
type KatakanaTrialRow = Awaited<
  ReturnType<typeof listKatakanaTrialRowsBySession>
>[number];
type KatakanaAttemptRow = Awaited<
  ReturnType<typeof listKatakanaAttemptLogsBySession>
>[number];
type KatakanaExerciseResultRow = Awaited<
  ReturnType<typeof listKatakanaExerciseResultRowsBySession>
>[number];
type KatakanaConfusionEdgeRow = Awaited<
  ReturnType<typeof listKatakanaConfusionEdgeRowsBySession>
>[number];
type KatakanaItemStateRow = Awaited<
  ReturnType<typeof listKatakanaItemStateRows>
>[number];

export type KatakanaSpeedFocusItem = {
  readonly itemId: string;
  readonly reason: string;
  readonly surface: string;
};

export type KatakanaSpeedSessionSummary = {
  readonly correctAttempts: number;
  readonly durationMs: number | null;
  readonly endedAt: string | null;
  readonly medianRtMs: number | null;
  readonly p90RtMs: number | null;
  readonly recommendedFocus: readonly KatakanaSpeedFocusItem[];
  readonly sessionId: string;
  readonly slowCorrectCount: number;
  readonly startedAt: string;
  readonly status: "active" | "completed" | "abandoned";
  readonly totalAttempts: number;
};

export type KatakanaSpeedPageData = {
  readonly analytics: KatakanaSpeedAnalytics;
  readonly catalogSize: number;
  readonly recentSession: KatakanaSpeedSessionSummary | null;
  readonly recommendedFocus: readonly KatakanaSpeedFocusItem[];
};

export type KatakanaSpeedSessionPageData = StartKatakanaSpeedSessionResult & {
  readonly answeredCount: number;
  readonly startedAt: string;
  readonly status: "active" | "completed" | "abandoned";
};

export type KatakanaSpeedAttemptSummary = {
  readonly createdAt: string;
  readonly errorTags: readonly KatakanaSpeedErrorTag[];
  readonly expectedAnswer: string;
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

export type KatakanaSpeedExerciseResultSummary = {
  readonly blockId: string | null;
  readonly createdAt: string;
  readonly exerciseId: string;
  readonly metrics: Readonly<Record<string, unknown>>;
  readonly resultId: string;
  readonly selfRating: KatakanaSpeedSelfRating | null;
  readonly sortOrder: number;
  readonly trialId: string | null;
};

export type KatakanaSpeedRecapPageData = {
  readonly analytics: KatakanaSpeedAnalytics;
  readonly attempts: readonly KatakanaSpeedAttemptSummary[];
  readonly exerciseResults: readonly KatakanaSpeedExerciseResultSummary[];
  readonly session: KatakanaSpeedSessionSummary;
};

export async function getKatakanaSpeedPageData(
  input: {
    database?: DatabaseClient;
  } = {}
): Promise<KatakanaSpeedPageData> {
  const database = input.database ?? db;
  const [sessionRows, itemStateRows] = await Promise.all([
    listRecentKatakanaSessionRows(database, 10),
    listKatakanaItemStateRows(database)
  ]);
  const recentSession = sessionRows[0]
    ? mapKatakanaSpeedSessionSummary(sessionRows[0])
    : null;
  const sessionIds = sessionRows.map((session) => session.id);
  const [attemptGroups, exerciseResultGroups, confusionEdgeGroups] =
    await Promise.all([
      Promise.all(
        sessionIds.map((sessionId) =>
          listKatakanaAttemptLogsBySession(database, sessionId)
        )
      ),
      Promise.all(
        sessionIds.map((sessionId) =>
          listKatakanaExerciseResultRowsBySession(database, sessionId)
        )
      ),
      Promise.all(
        sessionIds.map((sessionId) =>
          listKatakanaConfusionEdgeRowsBySession(database, sessionId)
        )
      )
    ]);
  const analytics = buildKatakanaSpeedAnalytics({
    attempts: attemptGroups
      .flat()
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map(mapKatakanaAnalyticsAttemptRow),
    confusionEdges: confusionEdgeGroups.flat().map(mapKatakanaConfusionEdgeRow),
    exerciseResults: exerciseResultGroups
      .flat()
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map(mapKatakanaAnalyticsExerciseResultRow),
    itemStates: itemStateRows.map(mapKatakanaAnalyticsItemStateRow)
  });
  const stateFocusItemIds = itemStateRows
    .filter((row) => row.reps > 0)
    .sort(
      (left, right) =>
        right.lapses - left.lapses ||
        right.slowCorrectCount - left.slowCorrectCount ||
        right.reps - left.reps ||
        left.itemId.localeCompare(right.itemId)
    )
    .map((row) => row.itemId);
  const recentFocusItemIds =
    recentSession?.recommendedFocus.map((focusItem) => focusItem.itemId) ?? [];
  const recommendedFocus = buildFocusItems([
    ...new Set([...stateFocusItemIds, ...recentFocusItemIds])
  ]).slice(0, 6);

  return {
    analytics,
    catalogSize: getKatakanaSpeedCatalog().length,
    recentSession,
    recommendedFocus:
      recommendedFocus.length > 0
        ? recommendedFocus
        : buildFocusItems(["kana-shi", "kana-tsu", "chunk-ti", "chunk-di"])
  };
}

export async function getKatakanaSpeedSessionPageData(input: {
  database?: DatabaseClient;
  sessionId: string;
}): Promise<KatakanaSpeedSessionPageData | null> {
  const database = input.database ?? db;
  const session = await getKatakanaSessionRow(database, input.sessionId);
  if (!session) {
    return null;
  }

  const trialRows = await listKatakanaTrialRowsBySession(
    database,
    input.sessionId
  );
  const trials = trialRows.map(mapKatakanaTrialRow);

  return {
    answeredCount: trialRows.filter((trial) => trial.status === "answered")
      .length,
    sessionId: session.id,
    startedAt: session.startedAt,
    status: session.status,
    trials
  };
}

export async function getKatakanaSpeedRecapPageData(input: {
  database?: DatabaseClient;
  sessionId: string;
}): Promise<KatakanaSpeedRecapPageData | null> {
  const database = input.database ?? db;
  const session = await getKatakanaSessionRow(database, input.sessionId);
  if (!session) {
    return null;
  }

  const [attempts, exerciseResults, confusionEdges] = await Promise.all([
    listKatakanaAttemptLogsBySession(database, input.sessionId),
    listKatakanaExerciseResultRowsBySession(database, input.sessionId),
    listKatakanaConfusionEdgeRowsBySession(database, input.sessionId)
  ]);
  const mappedAttempts = attempts
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .map(mapKatakanaAttemptRow);
  const mappedResults = exerciseResults.map(mapKatakanaExerciseResultRow);

  return {
    analytics: buildKatakanaSpeedAnalytics({
      attempts: mappedAttempts,
      confusionEdges: confusionEdges.map(mapKatakanaConfusionEdgeRow),
      exerciseResults: mappedResults,
      itemStates: []
    }),
    attempts: mappedAttempts,
    exerciseResults: mappedResults,
    session: mapKatakanaSpeedSessionSummary(session)
  };
}

export async function startKatakanaSpeedSession(input: {
  count?: number;
  database?: DatabaseClient;
  mode?: KatakanaSpeedSessionMode;
  now?: Date;
  seed?: string;
}): Promise<StartKatakanaSpeedSessionResult> {
  const database = input.database ?? db;
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const sessionId = `katakana-speed-session-${input.seed ?? randomUUID()}`;
  const mode = input.mode ?? "daily";

  return database.transaction(async (transaction) => {
    const state = await loadKatakanaSpeedState(transaction, now);
    const seed = input.seed ?? sessionId;
    const count = input.count ?? 12;
    const plan = generateExpandedKatakanaSpeedSessionPlan({
      count,
      mode,
      now,
      seed,
      sessionId,
      state
    });

    await insertKatakanaSession(transaction, {
      createdAt: nowIso,
      id: sessionId,
      startedAt: nowIso,
      status: "active",
      updatedAt: nowIso
    });
    await insertKatakanaExerciseBlocks(
      transaction,
      plan.blocks.map((block) => ({
        blockId: block.blockId,
        createdAt: nowIso,
        exerciseId: block.exerciseId,
        focusChunksJson: JSON.stringify(block.focusChunks),
        itemType: block.itemType,
        metricsJson: JSON.stringify(block.metrics),
        mode: block.mode,
        sessionId,
        sortOrder: block.sortOrder,
        title: block.title,
        updatedAt: nowIso
      }))
    );
    await insertKatakanaTrials(
      transaction,
      plan.trials.map((trial, sortOrder) => {
        const snapshot = snapshotKatakanaTrial(trial);

        return {
          blockId: snapshot.blockId ?? null,
          correctItemId: trial.correctItemId,
          exerciseId: snapshot.exerciseId ?? null,
          exposureMs: trial.exposureMs ?? null,
          expectedSurface: snapshot.expectedSurface,
          featuresJson: JSON.stringify(snapshot.features),
          focusChunksJson: JSON.stringify(snapshot.focusChunks),
          itemId: trial.itemId,
          itemType: snapshot.itemType,
          metricsJson: JSON.stringify(snapshot.metrics),
          mode: trial.mode,
          optionItemIdsJson: JSON.stringify(trial.optionItemIds),
          promptSurface: trial.promptSurface,
          sessionId,
          sortOrder,
          status: "planned",
          targetRtMs: trial.targetRtMs,
          trialId: trial.trialId,
          wasPseudo: snapshot.wasPseudo ? 1 : 0,
          wasRepair: snapshot.wasRepair ? 1 : 0,
          wasTransfer: snapshot.wasTransfer ? 1 : 0
        };
      })
    );

    return {
      sessionId,
      trials: plan.trials
    };
  });
}

type ExpandedKatakanaExerciseBlockPlan = {
  readonly blockId: string;
  readonly exerciseId: string;
  readonly focusChunks: readonly string[];
  readonly itemType: string;
  readonly metrics: Readonly<Record<string, unknown>>;
  readonly mode: KatakanaSpeedTrialMode;
  readonly sortOrder: number;
  readonly title: string;
};

type KatakanaTrialSnapshot = {
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

type ExpandedKatakanaTrialPlan = KatakanaSpeedTrialPlan &
  Partial<KatakanaTrialSnapshot>;

type ModelBackedSessionMode = Extract<
  KatakanaSpeedSessionMode,
  | "diagnostic_probe"
  | "mora_trap"
  | "chunk_spotting"
  | "loanword_decoder"
  | "tile_builder"
  | "confusion_ladder"
  | "variant_normalization"
>;

function generateExpandedKatakanaSpeedSessionPlan(input: {
  count: number;
  mode: KatakanaSpeedSessionMode;
  now: Date;
  seed: string;
  sessionId: string;
  state: KatakanaSpeedState;
}): {
  readonly blocks: readonly ExpandedKatakanaExerciseBlockPlan[];
  readonly trials: readonly ExpandedKatakanaTrialPlan[];
} {
  if (input.mode === "daily") {
    const dailyTrials = generateKatakanaSpeedSessionPlan({
      count: input.count,
      now: input.now,
      seed: input.seed,
      sessionMode: "daily",
      state: input.state
    }) as readonly ExpandedKatakanaTrialPlan[];
    const blocksById = new Map<string, ExpandedKatakanaExerciseBlockPlan>();
    const exerciseId = `${input.sessionId}:daily`;
    const trials = dailyTrials.map((trial) => ({
      ...trial,
      blockId: `${input.sessionId}:${trial.blockId ?? "daily-block"}`,
      exerciseId
    }));

    for (const trial of trials) {
      const snapshot = snapshotKatakanaTrial(trial);
      const blockId = snapshot.blockId ?? `${input.sessionId}:daily:block-0`;
      const existing = blocksById.get(blockId);
      const focusChunks = [
        ...new Set([...(existing?.focusChunks ?? []), ...snapshot.focusChunks])
      ];

      blocksById.set(blockId, {
        blockId,
        exerciseId,
        focusChunks,
        itemType: snapshot.itemType,
        metrics: {
          ...(existing?.metrics ?? {}),
          sessionMode: "daily"
        },
        mode: trial.mode,
        sortOrder: existing?.sortOrder ?? blocksById.size,
        title: dailyBlockTitle(trial.metadataRole)
      });
    }

    return {
      blocks: [...blocksById.values()],
      trials
    };
  }
  if (input.mode === "rare_combo") {
    const rareTrials = (
      generateKatakanaSpeedSessionPlan({
        count: input.count,
        now: input.now,
        seed: input.seed,
        sessionMode: "rare_combo",
        state: input.state
      }) as readonly ExpandedKatakanaTrialPlan[]
    ).map((trial) => ({
      ...trial,
      blockId: `${input.sessionId}:${trial.blockId ?? "rare-combo-block"}`,
      exerciseId: `${input.sessionId}:rare_combo`
    }));
    const blocksById = new Map<string, ExpandedKatakanaExerciseBlockPlan>();

    for (const trial of rareTrials) {
      const snapshot = snapshotKatakanaTrial(trial);
      const blockId =
        snapshot.blockId ?? `${input.sessionId}:rare_combo:block-0`;
      const existing = blocksById.get(blockId);
      const focusChunks = [
        ...new Set([...(existing?.focusChunks ?? []), ...snapshot.focusChunks])
      ];

      blocksById.set(blockId, {
        blockId,
        exerciseId: `${input.sessionId}:rare_combo`,
        focusChunks,
        itemType: snapshot.itemType,
        metrics: {
          ...(existing?.metrics ?? {}),
          sessionMode: "rare_combo"
        },
        mode: trial.mode,
        sortOrder: existing?.sortOrder ?? blocksById.size,
        title: dailyBlockTitle(trial.metadataRole)
      });
    }

    return {
      blocks: [...blocksById.values()],
      trials: rareTrials
    };
  }
  if (isModelBackedSessionMode(input.mode)) {
    return generateModelBackedSessionPlan({
      ...input,
      mode: input.mode
    });
  }
  if (input.mode === "repeated_reading") {
    return generateRepeatedReadingSessionPlan(input);
  }
  if (input.mode === "ran_grid") {
    return generateRanGridSessionPlan(input);
  }

  const config = expandedModeConfig(input.mode);
  const items = stableShuffle(
    getKatakanaSpeedCatalog().filter(config.includeItem),
    `${input.seed}:${input.mode}`
  ).slice(0, Math.max(0, input.count));
  const exerciseId = `${input.sessionId}:${input.mode}`;
  const blockId = `${exerciseId}:block-0`;
  const focusChunks = [
    ...new Set(items.flatMap((item) => item.focusChunks))
  ].slice(0, 12);

  return {
    blocks: [
      {
        blockId,
        exerciseId,
        focusChunks,
        itemType: config.itemType,
        metrics: {
          itemCount: items.length,
          sessionMode: input.mode
        },
        mode: config.trialMode,
        sortOrder: 0,
        title: config.title
      }
    ],
    trials: items.map((item, sortOrder) => ({
      blockId,
      correctItemId: item.id,
      exerciseId,
      expectedSurface: item.surface,
      features: {
        family: item.family,
        kind: item.kind,
        moraCount: item.moraCount,
        rarity: item.rarity,
        tier: item.tier
      },
      focusChunks: item.focusChunks,
      itemId: item.id,
      itemType: config.itemType,
      metrics: {
        sessionMode: input.mode,
        targetRtMs: item.targetRtMs
      },
      mode: config.trialMode,
      optionItemIds: config.usesChoiceOptions
        ? [item.id, ...item.distractorItemIds].slice(0, 4)
        : [item.id],
      promptSurface: item.surface,
      targetRtMs: item.targetRtMs,
      trialId: `katakana-speed-${input.seed}-${input.mode}-${sortOrder}-${item.id}`,
      wasPseudo: item.kind === "pseudoword" || Boolean(item.isPseudo),
      wasRepair: false,
      wasTransfer: input.mode === "pseudoword_transfer"
    }))
  };
}

function generateModelBackedSessionPlan(input: {
  count: number;
  mode: ModelBackedSessionMode;
  now: Date;
  seed: string;
  sessionId: string;
  state: KatakanaSpeedState;
}): {
  readonly blocks: readonly ExpandedKatakanaExerciseBlockPlan[];
  readonly trials: readonly ExpandedKatakanaTrialPlan[];
} {
  const generatedTrials = generateKatakanaSpeedSessionPlan({
    count: input.count,
    now: input.now,
    seed: input.seed,
    sessionMode: input.mode,
    state: input.state
  }) as readonly ExpandedKatakanaTrialPlan[];
  const exerciseId = `${input.sessionId}:${input.mode}`;
  const trials = generatedTrials.map((trial) => ({
    ...trial,
    blockId: `${input.sessionId}:${trial.blockId ?? `${input.mode}:block-0`}`,
    exerciseId
  }));
  const blocksById = new Map<string, ExpandedKatakanaExerciseBlockPlan>();

  for (const trial of trials) {
    const snapshot = snapshotKatakanaTrial(trial);
    const blockId =
      snapshot.blockId ?? `${input.sessionId}:${input.mode}:block-0`;
    const existing = blocksById.get(blockId);
    const focusChunks = [
      ...new Set([...(existing?.focusChunks ?? []), ...snapshot.focusChunks])
    ];

    blocksById.set(blockId, {
      blockId,
      exerciseId,
      focusChunks,
      itemType: snapshot.itemType,
      metrics: {
        ...(existing?.metrics ?? {}),
        sessionMode: input.mode
      },
      mode: trial.mode,
      sortOrder: existing?.sortOrder ?? blocksById.size,
      title: dailyBlockTitle(trial.metadataRole)
    });
  }

  return {
    blocks: [...blocksById.values()],
    trials
  };
}

function isModelBackedSessionMode(
  mode: KatakanaSpeedSessionMode
): mode is ModelBackedSessionMode {
  return [
    "diagnostic_probe",
    "mora_trap",
    "chunk_spotting",
    "loanword_decoder",
    "tile_builder",
    "confusion_ladder",
    "variant_normalization"
  ].includes(mode);
}

function generateRepeatedReadingSessionPlan(input: {
  count: number;
  mode: KatakanaSpeedSessionMode;
  now: Date;
  seed: string;
  sessionId: string;
  state: KatakanaSpeedState;
}): {
  readonly blocks: readonly ExpandedKatakanaExerciseBlockPlan[];
  readonly trials: readonly ExpandedKatakanaTrialPlan[];
} {
  const sentences = stableShuffle(
    getKatakanaSpeedCatalog().filter(
      (item) => item.kind === "sentence" && item.focusChunks.length > 0
    ),
    `${input.seed}:repeated-reading`
  );
  const sharedPair = findRepeatedReadingPair(sentences);
  const firstSentence = sharedPair.firstSentence;
  const transferSentence = sharedPair.transferSentence;
  const focusChunks = [
    ...new Set([...firstSentence.focusChunks, ...transferSentence.focusChunks])
  ];
  const exerciseId = `${input.sessionId}:repeated_reading`;
  const blockId = `${exerciseId}:block-0`;
  const trialItems = [
    { item: firstSentence, passRole: "first_pass" },
    { item: firstSentence, passRole: "repeat_pass" },
    { item: transferSentence, passRole: "transfer_pass" }
  ] as const;

  return {
    blocks: [
      {
        blockId,
        exerciseId,
        focusChunks,
        itemType: "sentence",
        metrics: {
          passCount: 3,
          sessionMode: "repeated_reading"
        },
        mode: "repeated_reading_pass",
        sortOrder: 0,
        title: "Repeated reading"
      }
    ],
    trials: trialItems.map(({ item, passRole }, sortOrder) => ({
      blockId,
      correctItemId: item.id,
      exerciseId,
      expectedSurface: item.surface,
      features: {
        family: item.family,
        kind: item.kind,
        moraCount: item.moraCount,
        rarity: item.rarity,
        repeatedReadingPass: sortOrder + 1,
        repeatedReadingRole: passRole,
        tier: item.tier
      },
      focusChunks: item.focusChunks,
      itemId: item.id,
      itemType: "sentence",
      metrics: {
        passRole,
        repeatedReadingPass: sortOrder + 1,
        sessionMode: "repeated_reading",
        targetMsPerMora: Math.round(
          item.targetRtMs / Math.max(1, item.moraCount)
        )
      },
      mode: "repeated_reading_pass",
      optionItemIds: [item.id],
      promptSurface: item.surface,
      targetRtMs: item.targetRtMs,
      trialId: `katakana-speed-${input.seed}-repeated_reading-${sortOrder}-${item.id}`,
      wasTransfer: passRole === "transfer_pass"
    }))
  };
}

function findRepeatedReadingPair(sentences: readonly KatakanaSpeedItem[]) {
  for (const firstSentence of sentences) {
    for (const focusChunk of firstSentence.focusChunks) {
      const transferSentence = sentences.find(
        (candidate) =>
          candidate.id !== firstSentence.id &&
          candidate.focusChunks.includes(focusChunk)
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

function generateRanGridSessionPlan(input: {
  count: number;
  mode: KatakanaSpeedSessionMode;
  now: Date;
  seed: string;
  sessionId: string;
  state: KatakanaSpeedState;
}): {
  readonly blocks: readonly ExpandedKatakanaExerciseBlockPlan[];
  readonly trials: readonly ExpandedKatakanaTrialPlan[];
} {
  const sourceItems = stableShuffle(
    getKatakanaSpeedCatalog().filter(
      (item) =>
        item.kind === "single_kana" ||
        item.kind === "core_mora" ||
        item.kind === "extended_chunk"
    ),
    `${input.seed}:ran-grid`
  );
  const gridItems = Array.from({ length: 25 }, (_, index) => {
    const item = sourceItems[index % Math.max(1, sourceItems.length)];

    return item ?? getKatakanaSpeedCatalog()[0];
  });
  const firstItem = gridItems[0] ?? getKatakanaSpeedCatalog()[0];
  const exerciseId = `${input.sessionId}:ran_grid`;
  const blockId = `${exerciseId}:block-0`;
  const focusChunks = [
    ...new Set(gridItems.flatMap((item) => item.focusChunks))
  ].slice(0, 16);

  return {
    blocks: [
      {
        blockId,
        exerciseId,
        focusChunks,
        itemType: "ran_grid",
        metrics: {
          cellCount: 25,
          sessionMode: "ran_grid",
          targetItemsPerSecond: 1.8
        },
        mode: "ran_grid",
        sortOrder: 0,
        title: "RAN Grid"
      }
    ],
    trials: [
      {
        blockId,
        correctItemId: firstItem.id,
        exerciseId,
        expectedSurface: firstItem.surface,
        features: {
          cellCount: 25,
          gridItemIds: gridItems.map((item) => item.id),
          gridSurfaces: gridItems.map((item) => item.surface)
        },
        focusChunks,
        itemId: firstItem.id,
        itemType: "ran_grid",
        metrics: {
          cellCount: 25,
          sessionMode: "ran_grid",
          targetItemsPerSecond: 1.8
        },
        mode: "ran_grid",
        optionItemIds: [firstItem.id],
        promptSurface: firstItem.surface,
        targetRtMs: 14_000,
        trialId: `katakana-speed-${input.seed}-ran_grid-0-${firstItem.id}`
      }
    ]
  };
}

function expandedModeConfig(
  mode: Exclude<
    KatakanaSpeedSessionMode,
    "daily" | "diagnostic_probe" | ModelBackedSessionMode
  >
): {
  readonly includeItem: (item: KatakanaSpeedItem) => boolean;
  readonly itemType: string;
  readonly title: string;
  readonly trialMode: KatakanaSpeedTrialMode;
  readonly usesChoiceOptions: boolean;
} {
  switch (mode) {
    case "rare_combo":
      return {
        includeItem: (item) => item.rarity === "rare" || item.tier === "C",
        itemType: "rare_combo",
        title: "Rare combo",
        trialMode: "minimal_pair",
        usesChoiceOptions: true
      };
    case "pseudoword_transfer":
      return {
        includeItem: isKatakanaSpeedTargetablePseudowordItem,
        itemType: "pseudoword",
        title: "Pseudoword transfer",
        trialMode: "pseudoword_sprint",
        usesChoiceOptions: false
      };
    case "sentence_sprint":
      return {
        includeItem: (item) => item.kind === "sentence",
        itemType: "sentence",
        title: "Sentence sprint",
        trialMode: "sentence_sprint",
        usesChoiceOptions: false
      };
    case "repeated_reading":
      return {
        includeItem: (item) => item.kind === "sentence",
        itemType: "sentence",
        title: "Repeated reading",
        trialMode: "repeated_reading_pass",
        usesChoiceOptions: false
      };
    case "ran_grid":
      return {
        includeItem: (item) =>
          item.kind === "single_kana" ||
          item.kind === "core_mora" ||
          item.kind === "extended_chunk",
        itemType: "ran_grid",
        title: "RAN grid",
        trialMode: "ran_grid",
        usesChoiceOptions: false
      };
  }
}

function dailyBlockTitle(role: KatakanaSpeedTrialPlan["metadataRole"]) {
  if (role === "pseudoword_transfer") {
    return "Pseudoword transfer";
  }
  if (role === "sentence_transfer") {
    return "Sentence sprint";
  }
  if (role === "repeated_reading") {
    return "Repeated reading";
  }
  if (role === "ran_grid") {
    return "RAN grid";
  }
  if (role === "rare_shock") {
    return "Rare shock";
  }
  if (role === "confusion_repair") {
    return "Confusion repair";
  }
  if (role === "word_transfer") {
    return "Word transfer";
  }

  return "Daily drill";
}

function snapshotKatakanaTrial(
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

function snapshotKatakanaTrialRow(
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

export async function submitKatakanaSpeedAnswer(input: {
  database?: DatabaseClient;
  inputMethod?: string | null;
  now?: Date;
  responseMs: number;
  sessionId: string;
  trialId: string;
  userAnswer: string;
}): Promise<SubmitKatakanaSpeedAnswerResult> {
  const database = input.database ?? db;
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const responseMs = Math.max(0, Math.round(input.responseMs));

  return database.transaction(async (transaction) => {
    const session = await getKatakanaSessionRow(transaction, input.sessionId);
    if (!session) {
      throw new Error("Katakana Speed session was not found.");
    }
    if (session.status !== "active") {
      throw new Error("Katakana Speed session is not active.");
    }

    const trial = await getKatakanaTrialRow(transaction, {
      sessionId: input.sessionId,
      trialId: input.trialId
    });
    if (!trial) {
      throw new Error("Katakana Speed trial was not found.");
    }

    const existingAttempt = await getKatakanaAttemptLogByTrialId(
      transaction,
      input.trialId
    );
    if (existingAttempt) {
      return {
        errorTags: parseJsonArray<KatakanaSpeedErrorTag>(
          existingAttempt.errorTagsJson
        ),
        idempotent: true,
        isCorrect: existingAttempt.isCorrect === 1
      };
    }

    if (trial.status !== "planned") {
      throw new Error("Katakana Speed trial is not answerable.");
    }

    const expectedAnswer =
      trial.expectedSurface ??
      getKatakanaSpeedItemById(trial.correctItemId)?.surface ??
      trial.promptSurface;
    const userAnswer = input.userAnswer.trim();
    const isCorrect = userAnswer === expectedAnswer;
    const errorTags = classifyKatakanaSpeedError({
      actualSurface: userAnswer,
      expectedSurface: expectedAnswer,
      responseMs,
      targetRtMs: trial.targetRtMs
    });
    const confusedWithItemId = !isCorrect
      ? (getKatakanaSpeedItemBySurface(userAnswer)?.id ?? null)
      : null;
    const trialSnapshot = snapshotKatakanaTrialRow(trial);

    const inserted = await insertKatakanaAttemptLogIfAbsent(transaction, {
      blockId: trial.blockId,
      confusedWithItemId,
      createdAt: nowIso,
      errorTagsJson: JSON.stringify(errorTags),
      exerciseId: trial.exerciseId,
      expectedAnswer,
      expectedSurface: trialSnapshot.expectedSurface,
      exposureMs: trial.exposureMs,
      featuresJson: JSON.stringify(trialSnapshot.features),
      focusChunksJson: JSON.stringify(trialSnapshot.focusChunks),
      id: `katakana-speed-attempt-${input.trialId}`,
      inputMethod: input.inputMethod?.trim() || null,
      isCorrect: isCorrect ? 1 : 0,
      itemId: trial.itemId,
      itemType: trialSnapshot.itemType,
      metricsJson: JSON.stringify(trialSnapshot.metrics),
      mode: trial.mode,
      promptSurface: trial.promptSurface,
      responseMs,
      sortOrder: trial.sortOrder,
      sessionId: input.sessionId,
      trialId: input.trialId,
      userAnswer,
      wasPseudo: trialSnapshot.wasPseudo ? 1 : 0,
      wasRepair: trialSnapshot.wasRepair ? 1 : 0,
      wasTransfer: trialSnapshot.wasTransfer ? 1 : 0
    });

    if (!inserted) {
      const attempt = await getKatakanaAttemptLogByTrialId(
        transaction,
        input.trialId
      );
      return {
        errorTags: parseJsonArray<KatakanaSpeedErrorTag>(
          attempt?.errorTagsJson ?? "[]"
        ),
        idempotent: true,
        isCorrect: attempt?.isCorrect === 1
      };
    }

    await updateKatakanaTrialAnswered(transaction, {
      answeredAt: nowIso,
      trialId: input.trialId
    });
    if (!isCorrect && confusedWithItemId) {
      await insertKatakanaConfusionEdgeIfAbsent(transaction, {
        blockId: trial.blockId,
        confusionCount: 1,
        createdAt: nowIso,
        edgeId: `katakana-speed-confusion-${input.trialId}`,
        exerciseId: trial.exerciseId,
        expectedItemId: trial.correctItemId,
        metricsJson: JSON.stringify({
          inputMethod: input.inputMethod?.trim() || null,
          responseMs
        }),
        observedItemId: confusedWithItemId,
        sessionId: input.sessionId,
        sortOrder: trial.sortOrder,
        updatedAt: nowIso
      });
    }
    await updateItemStateAfterAttempt(transaction, {
      errorTags,
      isCorrect,
      itemId: trial.itemId,
      nowIso,
      responseMs
    });
    await refreshSessionRollup(transaction, {
      nowIso,
      sessionId: input.sessionId,
      status: "active"
    });

    return {
      errorTags,
      idempotent: false,
      isCorrect
    };
  });
}

export async function submitKatakanaSpeedSelfCheck(input: {
  database?: DatabaseClient;
  metricsJson?: unknown;
  now?: Date;
  responseMs: number;
  selfRating: KatakanaSpeedSelfRating;
  sessionId: string;
  trialId: string;
}): Promise<SubmitKatakanaSpeedSelfCheckResult> {
  const database = input.database ?? db;
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const responseMs = Math.max(0, Math.round(input.responseMs));
  assertKatakanaSelfRating(input.selfRating);

  return database.transaction(async (transaction) => {
    const session = await getKatakanaSessionRow(transaction, input.sessionId);
    if (!session) {
      throw new Error("Katakana Speed session was not found.");
    }
    if (session.status !== "active") {
      throw new Error("Katakana Speed session is not active.");
    }

    const trial = await getKatakanaTrialRow(transaction, {
      sessionId: input.sessionId,
      trialId: input.trialId
    });
    if (!trial) {
      throw new Error("Katakana Speed trial was not found.");
    }
    if (
      !["word_naming", "pseudoword_sprint", "sentence_sprint"].includes(
        trial.mode
      )
    ) {
      throw new Error("Katakana Speed trial does not accept self-check.");
    }

    const existingAttempt = await getKatakanaAttemptLogByTrialId(
      transaction,
      input.trialId
    );
    if (existingAttempt) {
      return {
        idempotent: true,
        isCorrect: existingAttempt.isCorrect === 1,
        selfRating:
          parseKatakanaSelfRating(existingAttempt.selfRating) ?? "wrong"
      };
    }

    if (trial.status !== "planned") {
      throw new Error("Katakana Speed trial is not answerable.");
    }

    const isCorrect = input.selfRating !== "wrong";
    const errorTags = selfRatingErrorTags(input.selfRating);
    const metricsJson = normalizeMetricsJson(input.metricsJson);
    const trialSnapshot = snapshotKatakanaTrialRow(trial);
    const expectedAnswer = trial.expectedSurface ?? trial.promptSurface;

    const inserted = await insertKatakanaAttemptLogIfAbsent(transaction, {
      blockId: trial.blockId,
      confusedWithItemId: null,
      createdAt: nowIso,
      errorTagsJson: JSON.stringify(errorTags),
      exerciseId: trial.exerciseId,
      expectedAnswer,
      expectedSurface: trialSnapshot.expectedSurface,
      exposureMs: trial.exposureMs,
      featuresJson: JSON.stringify(trialSnapshot.features),
      focusChunksJson: JSON.stringify(trialSnapshot.focusChunks),
      id: `katakana-speed-attempt-${input.trialId}`,
      inputMethod: "self_check",
      isCorrect: isCorrect ? 1 : 0,
      itemId: trial.itemId,
      itemType: trialSnapshot.itemType,
      metricsJson,
      mode: trial.mode,
      promptSurface: trial.promptSurface,
      responseMs,
      selfRating: input.selfRating,
      sessionId: input.sessionId,
      sortOrder: trial.sortOrder,
      trialId: input.trialId,
      userAnswer: input.selfRating,
      wasPseudo: trialSnapshot.wasPseudo ? 1 : 0,
      wasRepair: trialSnapshot.wasRepair ? 1 : 0,
      wasTransfer: trialSnapshot.wasTransfer ? 1 : 0
    });

    if (!inserted) {
      const attempt = await getKatakanaAttemptLogByTrialId(
        transaction,
        input.trialId
      );
      return {
        idempotent: true,
        isCorrect: attempt?.isCorrect === 1,
        selfRating: parseKatakanaSelfRating(attempt?.selfRating) ?? "wrong"
      };
    }

    await updateKatakanaTrialAnswered(transaction, {
      answeredAt: nowIso,
      metricsJson,
      selfRating: input.selfRating,
      trialId: input.trialId
    });
    await updateItemStateAfterAttempt(transaction, {
      errorTags,
      isCorrect,
      itemId: trial.itemId,
      nowIso,
      responseMs
    });
    await refreshSessionRollup(transaction, {
      nowIso,
      sessionId: input.sessionId,
      status: "active"
    });

    return {
      idempotent: false,
      isCorrect,
      selfRating: input.selfRating
    };
  });
}

export async function aggregateKatakanaSpeedExerciseResult(input: {
  blockId?: string | null;
  database?: DatabaseClient;
  exerciseId: string;
  metricsJson?: unknown;
  now?: Date;
  resultId: string;
  selfRating?: KatakanaSpeedSelfRating | null;
  sessionId: string;
  sortOrder?: number;
  trialId?: string | null;
}): Promise<AggregateKatakanaSpeedExerciseResult> {
  const database = input.database ?? db;
  const nowIso = (input.now ?? new Date()).toISOString();
  const resultId = input.resultId.trim();
  if (!resultId) {
    throw new Error("Missing Katakana Speed result id.");
  }
  const blockId = input.blockId?.trim();
  if (!blockId) {
    throw new Error("Katakana Speed exercise block is required.");
  }
  if (input.selfRating) {
    assertKatakanaSelfRating(input.selfRating);
  }

  return database.transaction(async (transaction) => {
    const session = await getKatakanaSessionRow(transaction, input.sessionId);
    if (!session) {
      throw new Error("Katakana Speed session was not found.");
    }
    if (session.status !== "active") {
      throw new Error("Katakana Speed session is not active.");
    }

    const block = await getKatakanaExerciseBlockRow(transaction, blockId);
    if (!block || block.sessionId !== input.sessionId) {
      throw new Error("Katakana Speed exercise block was not found.");
    }
    if (block.exerciseId !== input.exerciseId) {
      throw new Error("Katakana Speed exercise block does not match.");
    }
    if (!["ran_grid", "repeated_reading_pass"].includes(block.mode)) {
      throw new Error("Katakana Speed exercise does not accept aggregates.");
    }

    const existingResult = await getKatakanaExerciseResultRow(
      transaction,
      resultId
    );
    if (existingResult) {
      assertKatakanaExerciseResultIdentity(existingResult, {
        blockId,
        exerciseId: input.exerciseId,
        sessionId: input.sessionId
      });

      return {
        idempotent: true,
        resultId
      };
    }

    let aggregateTrial: KatakanaTrialRow | null = null;
    if (input.trialId) {
      const trial = await getKatakanaTrialRow(transaction, {
        sessionId: input.sessionId,
        trialId: input.trialId
      });
      if (!trial) {
        throw new Error("Katakana Speed trial was not found.");
      }
      if (trial.blockId !== blockId) {
        throw new Error("Katakana Speed trial block does not match.");
      }
      if (trial.exerciseId !== input.exerciseId) {
        throw new Error("Katakana Speed trial exercise does not match.");
      }
      aggregateTrial = trial;
    } else if (block.mode === "ran_grid") {
      const blockTrials = await listKatakanaTrialRowsByBlock(
        transaction,
        blockId
      );
      aggregateTrial =
        blockTrials.find((trial) => trial.mode === "ran_grid") ??
        blockTrials[0] ??
        null;
    }

    const metricsJson =
      block.mode === "ran_grid"
        ? normalizeRanGridMetricsJson(input.metricsJson, aggregateTrial)
        : normalizeMetricsJson(input.metricsJson);

    const inserted = await insertKatakanaExerciseResultIfAbsent(transaction, {
      blockId,
      createdAt: nowIso,
      exerciseId: input.exerciseId,
      isCorrect:
        input.selfRating === undefined || input.selfRating === null
          ? null
          : input.selfRating === "wrong"
            ? 0
            : 1,
      metricsJson,
      resultId,
      selfRating: input.selfRating ?? null,
      sessionId: input.sessionId,
      sortOrder: input.sortOrder ?? 0,
      trialId: input.trialId?.trim() || null
    });

    if (!inserted) {
      const conflictingResult = await getKatakanaExerciseResultRow(
        transaction,
        resultId
      );
      if (!conflictingResult) {
        throw new Error("Katakana Speed result could not be persisted.");
      }
      assertKatakanaExerciseResultIdentity(conflictingResult, {
        blockId,
        exerciseId: input.exerciseId,
        sessionId: input.sessionId
      });
    }
    await updateKatakanaTrialsAnsweredByBlock(transaction, {
      answeredAt: nowIso,
      blockId,
      metricsJson,
      selfRating: input.selfRating ?? null
    });

    return {
      idempotent: !inserted,
      resultId
    };
  });
}

export async function completeKatakanaSpeedSession(input: {
  database?: DatabaseClient;
  now?: Date;
  sessionId: string;
}): Promise<KatakanaSpeedSessionRecap> {
  return finalizeKatakanaSpeedSession({
    ...input,
    status: "completed"
  });
}

export async function abandonKatakanaSpeedSession(input: {
  database?: DatabaseClient;
  now?: Date;
  sessionId: string;
}): Promise<KatakanaSpeedSessionRecap> {
  return finalizeKatakanaSpeedSession({
    ...input,
    status: "abandoned"
  });
}

async function finalizeKatakanaSpeedSession(input: {
  database?: DatabaseClient;
  now?: Date;
  sessionId: string;
  status: "completed" | "abandoned";
}): Promise<KatakanaSpeedSessionRecap> {
  const database = input.database ?? db;
  const nowIso = (input.now ?? new Date()).toISOString();

  return database.transaction(async (transaction) => {
    const session = await getKatakanaSessionRow(transaction, input.sessionId);
    if (!session) {
      throw new Error("Katakana Speed session was not found.");
    }
    const durationMs = Math.max(
      0,
      new Date(nowIso).getTime() - new Date(session.startedAt).getTime()
    );
    const rollup = await refreshSessionRollup(transaction, {
      durationMs,
      endedAt: nowIso,
      nowIso,
      sessionId: input.sessionId,
      status: input.status
    });

    return {
      correctAttempts: rollup.correctAttempts,
      durationMs,
      medianRtMs: rollup.medianRtMs,
      p90RtMs: rollup.p90RtMs,
      slowCorrectCount: rollup.slowCorrectCount,
      status: input.status,
      totalAttempts: rollup.totalAttempts
    };
  });
}

async function loadKatakanaSpeedState(
  database: Parameters<Parameters<DatabaseClient["transaction"]>[0]>[0],
  now: Date
): Promise<KatakanaSpeedState> {
  const initial = createInitialKatakanaSpeedState({ now });
  const rows = await listKatakanaItemStateRows(database);

  return {
    ...initial,
    items: {
      ...initial.items,
      ...Object.fromEntries(
        rows.map((row) => [
          row.itemId,
          {
            correctStreak: row.correctStreak,
            itemId: row.itemId,
            lapses: row.lapses,
            lastAttemptAt: row.lastAttemptAt,
            lastCorrectAt: row.lastCorrectAt,
            lastErrorTags: parseJsonArray<KatakanaSpeedErrorTag>(
              row.lastErrorTagsJson
            ),
            lastResponseMs: row.lastResponseMs,
            reps: row.reps,
            slowStreak: row.slowStreak,
            status: row.status
          } satisfies KatakanaSpeedItemState
        ])
      )
    }
  };
}

async function updateItemStateAfterAttempt(
  database: Parameters<Parameters<DatabaseClient["transaction"]>[0]>[0],
  input: {
    errorTags: readonly KatakanaSpeedErrorTag[];
    isCorrect: boolean;
    itemId: string;
    nowIso: string;
    responseMs: number;
  }
) {
  const current = await database.query.katakanaItemState.findFirst({
    where: (table, { eq }) => eq(table.itemId, input.itemId)
  });
  const slowCorrect = input.errorTags.includes("slow_correct");
  const fluentCorrect = input.isCorrect && !slowCorrect;
  const recentResponseMs = [
    ...parseJsonArray<number>(current?.recentResponseMsJson ?? "[]"),
    input.responseMs
  ].slice(-10);
  const correctStreak = fluentCorrect ? (current?.correctStreak ?? 0) + 1 : 0;
  const status =
    fluentCorrect && correctStreak >= 2
      ? "review"
      : input.isCorrect || current?.status !== "new"
        ? "learning"
        : "learning";

  await upsertKatakanaItemState(database, {
    bestRtMs:
      input.isCorrect && !slowCorrect
        ? Math.min(current?.bestRtMs ?? input.responseMs, input.responseMs)
        : (current?.bestRtMs ?? null),
    correctCount: (current?.correctCount ?? 0) + (input.isCorrect ? 1 : 0),
    correctStreak,
    createdAt: current?.createdAt ?? input.nowIso,
    itemId: input.itemId,
    lapses: (current?.lapses ?? 0) + (input.isCorrect ? 0 : 1),
    lastAttemptAt: input.nowIso,
    lastCorrectAt: fluentCorrect
      ? input.nowIso
      : (current?.lastCorrectAt ?? null),
    lastErrorTagsJson: JSON.stringify(input.errorTags),
    lastResponseMs: input.responseMs,
    recentResponseMsJson: JSON.stringify(recentResponseMs),
    reps: (current?.reps ?? 0) + 1,
    seenCount: (current?.seenCount ?? 0) + 1,
    slowCorrectCount: (current?.slowCorrectCount ?? 0) + (slowCorrect ? 1 : 0),
    slowStreak: slowCorrect
      ? (current?.slowStreak ?? 0) + 1
      : fluentCorrect
        ? 0
        : (current?.slowStreak ?? 0),
    status,
    updatedAt: input.nowIso,
    wrongCount: (current?.wrongCount ?? 0) + (input.isCorrect ? 0 : 1)
  });
}

async function refreshSessionRollup(
  database: Parameters<Parameters<DatabaseClient["transaction"]>[0]>[0],
  input: {
    durationMs?: number | null;
    endedAt?: string | null;
    nowIso: string;
    sessionId: string;
    status: "active" | "completed" | "abandoned";
  }
) {
  const attempts = await listKatakanaAttemptLogsBySession(
    database,
    input.sessionId
  );
  const responseTimes = attempts
    .map((attempt) => attempt.responseMs)
    .sort((left, right) => left - right);
  const errorTagCounts = countValues(
    attempts.flatMap((attempt) =>
      parseJsonArray<KatakanaSpeedErrorTag>(attempt.errorTagsJson)
    )
  );
  const confusionCounts = countValues(
    attempts
      .map((attempt) => attempt.confusedWithItemId)
      .filter((itemId): itemId is string => Boolean(itemId))
  );
  const recommendedFocus = [
    ...new Set([...topKeys(errorTagCounts, 3), ...topKeys(confusionCounts, 3)])
  ];
  const rollup = {
    correctAttempts: attempts.filter((attempt) => attempt.isCorrect === 1)
      .length,
    mainConfusionsJson: JSON.stringify(topKeys(confusionCounts, 5)),
    mainErrorTagsJson: JSON.stringify(topKeys(errorTagCounts, 5)),
    medianRtMs: percentile(responseTimes, 0.5),
    p90RtMs: percentile(responseTimes, 0.9),
    recommendedFocusJson: JSON.stringify(recommendedFocus),
    slowCorrectCount: attempts.filter((attempt) =>
      parseJsonArray<KatakanaSpeedErrorTag>(attempt.errorTagsJson).includes(
        "slow_correct"
      )
    ).length,
    totalAttempts: attempts.length
  };

  await updateKatakanaSessionRollup(database, {
    ...rollup,
    durationMs: input.durationMs ?? null,
    endedAt: input.endedAt ?? null,
    id: input.sessionId,
    status: input.status,
    updatedAt: input.nowIso
  });

  return rollup;
}

function parseJsonArray<T>(value: string): T[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value: string): Record<string, unknown> {
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

function normalizeMetricsJson(value: unknown): string {
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

function normalizeRanGridMetricsJson(
  value: unknown,
  trial: KatakanaTrialRow | null
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
  const cells = Array.from({ length: totalItems }, (_, index) => ({
    column: (index % columns) + 1,
    index,
    itemId: sourceItemIds[index] ?? featureCells[index]?.itemId ?? "",
    row: Math.floor(index / columns) + 1,
    surface: sourceSurfaces[index] ?? featureCells[index]?.surface ?? ""
  }));
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
  const correctItems = totalItems - errors;
  const durationMs = Math.max(
    0,
    Math.round(
      nullableNumber(raw.durationMs) ?? nullableNumber(raw.responseMs) ?? 0
    )
  );
  const score = scoreKatakanaSpeedRanGrid({
    correctItems,
    responseMs: durationMs,
    totalItems
  });
  const canonical: Record<string, unknown> = {
    ...raw,
    adjustedItemsPerSecond: score.adjustedItemsPerSecond,
    cells,
    cellItemIds: cells.map((cell) => cell.itemId),
    cellSurfaces: cells.map((cell) => cell.surface),
    columns,
    correctItems,
    durationMs,
    errorRate: totalItems > 0 ? roundTo(errors / totalItems, 3) : 0,
    errors,
    itemsPerSecond: score.itemsPerSecond,
    rows,
    schemaVersion: 1,
    totalItems
  };

  if (hasWrongCellIndexes) {
    canonical.wrongCellIndexes = wrongCellIndexes;
    canonical.wrongCells = wrongCellIndexes.flatMap((index) => {
      const cell = cells[index];
      return cell ? [cell] : [];
    });
  }

  return JSON.stringify(canonical);
}

function buildRanGridCellsFromTrial(trial: KatakanaTrialRow | null) {
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

function parseWrongCellIndexes(value: unknown, totalItems: number) {
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

function parseUnknownObject(value: unknown): Record<string, unknown> {
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

function parseUnknownStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function assertKatakanaSelfRating(
  selfRating: string
): asserts selfRating is KatakanaSpeedSelfRating {
  if (!["clean", "hesitated", "wrong"].includes(selfRating)) {
    throw new Error("Invalid Katakana Speed self rating.");
  }
}

function parseKatakanaSelfRating(
  selfRating: string | null | undefined
): KatakanaSpeedSelfRating | null {
  if (!selfRating) {
    return null;
  }

  return ["clean", "hesitated", "wrong"].includes(selfRating)
    ? (selfRating as KatakanaSpeedSelfRating)
    : null;
}

function selfRatingErrorTags(
  selfRating: KatakanaSpeedSelfRating
): KatakanaSpeedErrorTag[] {
  if (selfRating === "hesitated") {
    return ["slow_correct"];
  }
  if (selfRating === "wrong") {
    return ["unclassified_error"];
  }

  return [];
}

function assertKatakanaExerciseResultIdentity(
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

function percentile(values: readonly number[], percentileValue: number) {
  if (values.length === 0) {
    return null;
  }

  if (percentileValue === 0.5 && values.length % 2 === 0) {
    const upperIndex = values.length / 2;
    const lower = values[upperIndex - 1] ?? null;
    const upper = values[upperIndex] ?? null;

    if (lower !== null && upper !== null) {
      return Math.round((lower + upper) / 2);
    }
  }

  const index = Math.ceil(values.length * percentileValue) - 1;
  return values[Math.max(0, Math.min(values.length - 1, index))] ?? null;
}

function countValues(values: readonly string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function topKeys(counts: ReadonlyMap<string, number>, limit: number) {
  return [...counts.entries()]
    .sort(
      ([leftKey, leftCount], [rightKey, rightCount]) =>
        rightCount - leftCount || leftKey.localeCompare(rightKey)
    )
    .slice(0, limit)
    .map(([key]) => key);
}

function mapKatakanaSpeedSessionSummary(
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

function mapKatakanaTrialRow(row: KatakanaTrialRow): KatakanaSpeedTrialPlan {
  const item = getKatakanaSpeedItemById(row.itemId);
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
    mode: row.mode,
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

function mapKatakanaAttemptRow(
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

function mapKatakanaAnalyticsAttemptRow(
  attempt: KatakanaAttemptRow
): KatakanaSpeedAnalyticsAttempt {
  return mapKatakanaAttemptRow(attempt);
}

function mapKatakanaExerciseResultRow(
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

function mapKatakanaAnalyticsExerciseResultRow(
  result: KatakanaExerciseResultRow
): KatakanaSpeedAnalyticsExerciseResult {
  return mapKatakanaExerciseResultRow(result);
}

function mapKatakanaAnalyticsItemStateRow(
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

function mapKatakanaConfusionEdgeRow(
  row: KatakanaConfusionEdgeRow
): KatakanaSpeedAnalyticsConfusionEdge {
  return {
    confusionCount: row.confusionCount,
    expectedItemId: row.expectedItemId,
    metrics: parseJsonObject(row.metricsJson),
    observedItemId: row.observedItemId
  };
}

function buildFocusItems(itemIds: readonly string[]): KatakanaSpeedFocusItem[] {
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

function nullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
