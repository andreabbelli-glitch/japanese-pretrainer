import { db, type DatabaseClient } from "@/db";
import {
  countKanjiClashAutomaticNewPairIntroductions,
  listEligibleKanjiClashSubjects,
  listKanjiClashPairStatesByPairKeys
} from "@/db/queries";

import {
  loadKanjiClashManualContrastCandidates,
  type KanjiClashManualContrastSeed
} from "./manual-contrast.ts";
import { loadManualKanjiClashQueueSnapshot } from "./manual-queue-loader.ts";
import { buildKanjiClashQueueSnapshot } from "./queue.ts";
import { generateKanjiClashCandidates } from "./pairing.ts";
import type {
  KanjiClashPairState,
  KanjiClashQueueSnapshot,
  KanjiClashSessionMode,
  KanjiClashScope
} from "./types.ts";

export type LoadKanjiClashQueueSnapshotInput = {
  dailyNewLimit?: number | null;
  database?: DatabaseClient;
  mediaIds?: string[];
  mode: KanjiClashSessionMode;
  now?: Date;
  requestedSize?: number | null;
  resolvedManualContrastSeed?: KanjiClashManualContrastSeed | Promise<KanjiClashManualContrastSeed>;
  scope: KanjiClashScope;
  seenPairKeys?: string[];
  seenRoundKeys?: string[];
};

export async function loadKanjiClashQueueSnapshot(
  input: LoadKanjiClashQueueSnapshotInput
): Promise<KanjiClashQueueSnapshot> {
  const database = input.database ?? db;
  const now = input.now ?? new Date();
  const manualContrastSeedPromise =
    input.resolvedManualContrastSeed ??
    loadKanjiClashManualContrastCandidates({
      database,
      mediaIds: input.mediaIds
    });
  const [eligibleSubjects, manualContrastSeed] = await Promise.all([
    listEligibleKanjiClashSubjects(database, {
      mediaIds: input.mediaIds
    }),
    manualContrastSeedPromise
  ]);

  if (input.mode === "manual") {
    return loadManualKanjiClashQueueSnapshot({
      database,
      eligibleSubjects,
      manualContrastSeed,
      now,
      requestedSize: input.requestedSize,
      scope: input.scope,
      seenPairKeys: input.seenPairKeys,
      seenRoundKeys: input.seenRoundKeys
    });
  }

  return loadAutomaticKanjiClashQueueSnapshot({
    dailyNewLimit: input.dailyNewLimit,
    database,
    eligibleSubjects,
    manualContrastSeed,
    mode: input.mode,
    now,
    requestedSize: input.requestedSize,
    scope: input.scope,
    seenPairKeys: input.seenPairKeys,
    seenRoundKeys: input.seenRoundKeys
  });
}

async function loadAutomaticKanjiClashQueueSnapshot(input: {
  dailyNewLimit?: number | null;
  database: DatabaseClient;
  eligibleSubjects: Awaited<ReturnType<typeof listEligibleKanjiClashSubjects>>;
  manualContrastSeed: KanjiClashManualContrastSeed;
  mode: KanjiClashSessionMode;
  now: Date;
  requestedSize?: number | null;
  scope: KanjiClashScope;
  seenPairKeys?: string[];
  seenRoundKeys?: string[];
}): Promise<KanjiClashQueueSnapshot> {
  const automaticCandidates = generateKanjiClashCandidates(
    input.eligibleSubjects
  ).filter(
    (candidate) =>
      !input.manualContrastSeed.suppressedContrastKeys.has(candidate.pairKey)
  );
  const automaticPairStatesPromise =
    automaticCandidates.length > 0
      ? listKanjiClashPairStatesByPairKeys(
          input.database,
          automaticCandidates.map((candidate) => candidate.pairKey)
        )
      : Promise.resolve(new Map<string, KanjiClashPairState>());
  const introducedTodayCountPromise = countKanjiClashAutomaticNewPairIntroductions(
    {
      database: input.database,
      endAt: startOfNextLocalDay(input.now).toISOString(),
      startAt: startOfLocalDay(input.now).toISOString()
    }
  );
  const [automaticPairStates, introducedTodayCount] = await Promise.all([
    automaticPairStatesPromise,
    introducedTodayCountPromise
  ]);
  const candidates = [
    ...input.manualContrastSeed.candidates,
    ...automaticCandidates
  ];
  const pairStates = new Map<string, KanjiClashPairState>([
    ...automaticPairStates,
    ...input.manualContrastSeed.pairStates
  ]);

  return buildKanjiClashQueueSnapshot({
    candidates,
    dailyNewLimit: input.dailyNewLimit,
    mode: input.mode,
    newIntroducedTodayCount: introducedTodayCount,
    now: input.now,
    pairStates,
    requestedSize: input.requestedSize,
    scope: input.scope,
    seenPairKeys: input.seenPairKeys,
    seenRoundKeys: input.seenRoundKeys
  });
}

function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function startOfNextLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate() + 1);
}
