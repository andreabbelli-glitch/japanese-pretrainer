import { randomUUID } from "node:crypto";

import { db, type DatabaseClient } from "@/db";
import {
  getKatakanaSessionRow,
  insertKatakanaExerciseBlocks,
  insertKatakanaSession,
  insertKatakanaTrials
} from "@/db/queries";

import { generateKatakanaSpeedSessionPlan } from "../model";
import type {
  KatakanaSpeedManualExercise,
  KatakanaSpeedSessionMode,
  KatakanaSpeedState,
  KatakanaSpeedTrialMode,
  KatakanaSpeedTrialPlan
} from "../types";
import type {
  KatakanaSpeedSessionRecap,
  StartKatakanaSpeedSessionResult
} from "./contracts";
import {
  assertKatakanaSpeedManualExercise,
  assertKatakanaSpeedSessionMode,
  assertNeverKatakanaSpeedSessionMode
} from "./codecs";
import { loadKatakanaSpeedState, refreshSessionRollup } from "./rollups";
import {
  snapshotKatakanaTrial,
  type ExpandedKatakanaTrialPlan
} from "./mappers";

export async function startKatakanaSpeedSession(input: {
  count?: number;
  database?: DatabaseClient;
  manualExercise?: KatakanaSpeedManualExercise;
  mode?: KatakanaSpeedSessionMode;
  now?: Date;
  seed?: string;
}): Promise<StartKatakanaSpeedSessionResult> {
  const database = input.database ?? db;
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const sessionId = `katakana-speed-session-${input.seed ?? randomUUID()}`;
  const mode = input.mode ?? "daily";
  assertKatakanaSpeedSessionMode(mode);
  assertKatakanaSpeedManualExercise(input.manualExercise);

  return database.transaction(async (transaction) => {
    const state = await loadKatakanaSpeedState(transaction, now);
    const seed = input.seed ?? sessionId;
    const count =
      input.count ??
      defaultKatakanaSpeedSessionCount(mode, input.manualExercise);
    const plan = generateExpandedKatakanaSpeedSessionPlan({
      count,
      manualExercise: input.manualExercise,
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

function generateExpandedKatakanaSpeedSessionPlan(input: {
  count: number;
  manualExercise?: KatakanaSpeedManualExercise;
  mode: KatakanaSpeedSessionMode;
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
    manualExercise: input.manualExercise,
    now: input.now,
    seed: input.seed,
    sessionMode: input.mode,
    state: input.state
  }) as readonly ExpandedKatakanaTrialPlan[];
  const exerciseId = input.manualExercise
    ? `${input.sessionId}:manual:${input.manualExercise}`
    : `${input.sessionId}:${input.mode}`;
  const trials = generatedTrials.map((trial) => ({
    ...trial,
    blockId: `${input.sessionId}:${trial.blockId ?? `${input.mode}-block`}`,
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
        focusId:
          typeof snapshot.features.focusId === "string"
            ? snapshot.features.focusId
            : undefined,
        manualExercise: input.manualExercise,
        sessionMode: input.mode
      },
      mode: trial.mode,
      sortOrder: existing?.sortOrder ?? blocksById.size,
      title: trainingBlockTitle(trial.blockId, trial.metadataRole)
    });
  }

  return {
    blocks: [...blocksById.values()],
    trials
  };
}

function defaultKatakanaSpeedSessionCount(
  mode: KatakanaSpeedSessionMode,
  manualExercise?: KatakanaSpeedManualExercise
) {
  if (manualExercise === "ran_grid") {
    return 1;
  }
  if (manualExercise === "romaji_to_katakana") {
    return 12;
  }
  if (manualExercise === "contrast") {
    return 16;
  }
  if (manualExercise === "reading") {
    return 16;
  }
  if (mode === "repair") {
    return 34;
  }
  if (mode === "diagnostic_probe") {
    return 24;
  }
  if (mode === "daily") {
    return 32;
  }

  return assertNeverKatakanaSpeedSessionMode(mode);
}

function trainingBlockTitle(
  blockId: string | undefined,
  role: KatakanaSpeedTrialPlan["metadataRole"]
) {
  if (blockId?.includes("manual-romaji-to-katakana")) {
    return "Romaji -> katakana";
  }
  if (blockId?.includes("manual-contrast")) {
    return "Contrasti";
  }
  if (blockId?.includes("manual-reading")) {
    return "Lettura";
  }
  if (blockId?.includes("manual-ran-grid")) {
    return "RAN grid";
  }
  if (blockId?.includes("b1-contrast")) {
    return "Contrasti rapidi";
  }
  if (blockId?.includes("b2-reading")) {
    return "Lettura a tempo";
  }
  if (blockId?.includes("b3-transfer")) {
    return "Transfer";
  }
  if (blockId?.includes("b3-final")) {
    return "Verifica finale";
  }

  if (role === "ran_grid") {
    return "RAN grid";
  }

  return "Daily drill";
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
